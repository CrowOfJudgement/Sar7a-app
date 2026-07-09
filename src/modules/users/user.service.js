import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes, randomUUID } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { successResponse } from "../../utils/response.js";
import { asyncHandler } from "../../utils/errorHandling.js";
import userModel from "../../DB/models/user.model.js";
import * as redisService from "../../DB/redis/redis.service.js";
import { sendEmail, generateOtp } from "../../utils/email/send.email.js";
import { eventEmitter } from "../../utils/email/email.events.js";
import { emailEnum } from "../../enum/email.enum.js";
import { PROVIDER } from "../../enum/user.enum.js";
import { otpEmailTemplate } from "../../utils/email/email.template.js";

const JWT_SECRET = process.env.JWT_SECRET || "ay 7aga";
const SALT_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = 10;
const OTP_EXPIRY_SECONDS = OTP_EXPIRY_MINUTES * 60;
const MAX_CONFIRMATION_OTP_ATTEMPTS = 3;
const CONFIRMATION_OTP_BLOCK_MINUTES = 5;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_BLOCK_MINUTES = 5;
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: "24h",
        jwtid: randomUUID()
    });
};

const getOtpExpiryDate = () => new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
const normalizeEmail = (email) => String(email).trim().toLowerCase();
const splitGoogleName = ({ name, givenName, familyName, email }) => {
    const fallbackName = email.split("@")[0];
    const [firstNameFromFullName, ...lastNameParts] = String(name || fallbackName).trim().split(/\s+/);
    const firstName = givenName || firstNameFromFullName || "Google";
    const lastName = familyName || lastNameParts.join(" ") || "User";

    return {
        firstName: firstName.length >= 3 ? firstName : `${firstName}User`,
        lastName: lastName.length >= 3 ? lastName : `${lastName}User`
    };
};
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const confirmationOtpKey = (email) => `confirmation_otp:${normalizeEmail(email)}`;
const confirmationOtpAttemptKey = (email) => `confirmation_otp_attempts:${normalizeEmail(email)}`;
const confirmationOtpBlockedKey = (email) => `confirmation_otp_blocked:${normalizeEmail(email)}`;

const findUserByEmail = (email) => {
    const normalizedEmail = normalizeEmail(email);
    return userModel.findOne({
        email: {
            $regex: `^${escapeRegex(normalizedEmail)}$`,
            $options: "i"
        }
    });
};

const sanitizeUser = (user) => {
    const userObject = user.toObject ? user.toObject() : { ...user };
    delete userObject.password;
    delete userObject.confirmationOtp;
    delete userObject.twoFactorSetupOtp;
    delete userObject.loginOtp;
    delete userObject.passwordResetOtp;
    return userObject;
};

const verifyGoogleAccount = async (idToken) => {
    const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    if (!payload?.email) {
        throw new Error("Invalid Google account payload", { cause: 401 });
    }

    return payload;
};

const createAuthResponse = (user, message) => ({
    message,
    data: {
        user: sanitizeUser(user),
        token: generateToken({ id: user._id, email: user.email })
    }
});

const sendOtpEmail = async ({ to, subject, otp, action }) => {
    await sendEmail({
        to,
        subject,
        html: otpEmailTemplate({
            title: subject,
            subtitle: action,
            otp,
            expiresInMinutes: OTP_EXPIRY_MINUTES,
            brandName: "Saraha App"
        })
    });
};

const storeOtp = async (user, fieldName) => {
    const otp = String(await generateOtp());
    user[fieldName] = {
        code: await bcrypt.hash(otp, SALT_ROUNDS),
        expiresAt: getOtpExpiryDate()
    };
    await user.save();
    return otp;
};

const clearOtp = (user, fieldName) => {
    user[fieldName] = undefined;
};

const hasActiveOtp = (storedOtp) => {
    return Boolean(storedOtp?.expiresAt && storedOtp.expiresAt.getTime() > Date.now());
};

const sendConfirmationEmailOtp = async (email, { allowResend = false } = {}) => {
    const blockedTtl = await redisService.getTTL(confirmationOtpBlockedKey(email));
    if (blockedTtl > 0) {
        throw new Error(`You are blocked from requesting a new OTP. Try again after ${blockedTtl} seconds.`, { cause: 429 });
    }

    const otpTtl = await redisService.getTTL(confirmationOtpKey(email));
    if (otpTtl > 0 && !allowResend) {
        throw new Error(`You already have an active OTP. Try again after ${otpTtl} seconds.`, { cause: 429 });
    }

    const attemptKey = confirmationOtpAttemptKey(email);
    const currentAttempts = Number(await redisService.get(attemptKey)) || 0;

    if (currentAttempts >= MAX_CONFIRMATION_OTP_ATTEMPTS) {
        await redisService.setValue({
            key: confirmationOtpBlockedKey(email),
            value: "true",
            ttl: CONFIRMATION_OTP_BLOCK_MINUTES * 60
        });
        throw new Error(`You exceeded the maximum number of OTP requests. Try again after ${CONFIRMATION_OTP_BLOCK_MINUTES} minutes.`, { cause: 429 });
    }

    const otp = String(await generateOtp());

    await new Promise((resolve, reject) => {
        eventEmitter.emit(emailEnum.confirmEmail, async () => {
            try {
                await sendOtpEmail({
                    to: email,
                    subject: "Confirm your Saraha account",
                    otp,
                    action: "Use this OTP to confirm your email address"
                });
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });

    await redisService.setValue({
        key: confirmationOtpKey(email),
        value: await bcrypt.hash(otp, SALT_ROUNDS),
        ttl: OTP_EXPIRY_SECONDS
    });

    await redisService.setValue({
        key: attemptKey,
        value: currentAttempts + 1,
        ttl: OTP_EXPIRY_SECONDS
    });
};

const validateOtp = async (otp, storedOtp) => {
    if (!storedOtp?.code || !storedOtp?.expiresAt) {
        return false;
    }

    if (storedOtp.expiresAt.getTime() < Date.now()) {
        return false;
    }

    return bcrypt.compare(String(otp), storedOtp.code);
};

const resetLoginSecurityState = (user) => {
    user.failedLoginAttempts = 0;
    user.loginBlockedUntil = undefined;
};

const getBlockedMessage = (blockedUntil) => {
    const remainingSeconds = Math.ceil((blockedUntil.getTime() - Date.now()) / 1000);
    return `Account is temporarily locked. Try again after ${Math.max(remainingSeconds, 1)} seconds.`;
};

export const signUp = asyncHandler(async (req, res, next) => {
    const { firstName, lastName, password, age, gender } = req.body;
    const email = normalizeEmail(req.body.email);

    const emailExist = await findUserByEmail(email);
    if (emailExist) {
        if (!emailExist.confirmed) {
            emailExist.firstName = firstName;
            emailExist.lastName = lastName;
            emailExist.password = await bcrypt.hash(password, SALT_ROUNDS);
            emailExist.age = age;
            emailExist.gender = gender;
            emailExist.confirmationOtp = undefined;

            if (req.files?.attachments) {
                const attachments = [];
                for (const file of req.files.attachments) {
                    attachments.push(file.path);
                }
                emailExist.attachments = attachments;
                emailExist.profilePicture = req.files.attachments[0].path;
            }

            await emailExist.save();

            await sendConfirmationEmailOtp(email);

            return successResponse(res, {
                message: "Account already exists but is not confirmed. A new confirmation OTP has been sent.",
                data: {
                    user: sanitizeUser(emailExist),
                    requiresEmailConfirmation: true
                }
            });
        }

        return next(new Error("Email already exists", { cause: 409 }));
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const attachments = [];
    let profilePicture = "";

    if (req.files?.attachments) {
        for (const file of req.files.attachments) {
            attachments.push(file.path);
        }
        profilePicture = req.files.attachments[0].path;
    }

    const user = await userModel.create({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        age,
        gender,
        profilePicture,
        attachments
    });

    await sendConfirmationEmailOtp(email);

    return successResponse(res, {
        message: "User registered successfully. Please confirm your email using the OTP sent to your inbox.",
        data: {
            user: sanitizeUser(user),
            requiresEmailConfirmation: true
        },
        status: 201
    });
});

export const confirmEmail = asyncHandler(async (req, res, next) => {
    const { otp } = req.body;
    const email = normalizeEmail(req.body.email);

    const user = await userModel
        .findOne({
            email: {
                $regex: `^${escapeRegex(email)}$`,
                $options: "i"
            }
        })
        .select("+confirmationOtp.code");

    if (!user) {
        return next(new Error("User not found", { cause: 404 }));
    }

    if (user.confirmed) {
        return successResponse(res, {
            message: "Email is already confirmed",
            data: { user: sanitizeUser(user) }
        });
    }

    let isValidOtp = false;
    const storedConfirmationOtpHash = await redisService.get(confirmationOtpKey(email));

    if (storedConfirmationOtpHash) {
        isValidOtp = await bcrypt.compare(String(otp), storedConfirmationOtpHash);
    } else {
        isValidOtp = await validateOtp(otp, user.confirmationOtp);
    }

    if (!isValidOtp) {
        return next(new Error("Invalid or expired OTP", { cause: 401 }));
    }

    user.confirmed = true;
    clearOtp(user, "confirmationOtp");
    await user.save();
    await redisService.deleteKey(confirmationOtpKey(email));
    await redisService.deleteKey(confirmationOtpAttemptKey(email));
    await redisService.deleteKey(confirmationOtpBlockedKey(email));

    return successResponse(res, {
        message: "Email confirmed successfully",
        data: { user: sanitizeUser(user) }
    });
});

export const resendConfirmationOtp = asyncHandler(async (req, res, next) => {
    const email = normalizeEmail(req.body.email);

    const user = await findUserByEmail(email);
    if (!user) {
        return next(new Error("User not found", { cause: 404 }));
    }

    if (user.confirmed) {
        return next(new Error("Email is already confirmed", { cause: 400 }));
    }

    await sendConfirmationEmailOtp(email, { allowResend: true });

    return successResponse(res, {
        message: "A new confirmation OTP has been sent to your email.",
        data: {
            email: user.email,
            requiresEmailConfirmation: true
        }
    });
});

export const signIn = asyncHandler(async (req, res, next) => {
    const { password } = req.body;
    const email = normalizeEmail(req.body.email);

    const user = await findUserByEmail(email).select("+password");

    if (!user) {
        return next(new Error("Invalid email or password", { cause: 401 }));
    }

    if (!user.confirmed) {
        return next(new Error("Please confirm your email before logging in", { cause: 403 }));
    }

    if (user.loginBlockedUntil && user.loginBlockedUntil.getTime() > Date.now()) {
        return next(new Error(getBlockedMessage(user.loginBlockedUntil), { cause: 403 }));
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        user.failedLoginAttempts += 1;

        if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
            user.loginBlockedUntil = new Date(Date.now() + LOGIN_BLOCK_MINUTES * 60 * 1000);
            user.failedLoginAttempts = 0;
            await user.save();
            return next(new Error("Account is temporarily locked for 5 minutes due to repeated failed login attempts", { cause: 403 }));
        }

        await user.save();
        return next(new Error("Invalid email or password", { cause: 401 }));
    }

    resetLoginSecurityState(user);

    if (user.twoFactorEnabled) {
        const otp = await storeOtp(user, "loginOtp");
        await sendOtpEmail({
            to: user.email,
            subject: "Your login verification code",
            otp,
            action: "Use this OTP to complete your login"
        });

        return successResponse(res, {
            message: "Password verified. A login OTP has been sent to your email.",
            data: {
                requiresTwoFactor: true,
                email: user.email
            }
        });
    }

    await user.save();

    const token = generateToken({ id: user._id, email: user.email });

    return successResponse(res, {
        message: "Login successful",
        data: {
            user: sanitizeUser(user),
            token
        }
    });
});

export const confirmSignIn = asyncHandler(async (req, res, next) => {
    const { otp } = req.body;
    const email = normalizeEmail(req.body.email);

    const user = await userModel
        .findOne({
            email: {
                $regex: `^${escapeRegex(email)}$`,
                $options: "i"
            }
        })
        .select("+loginOtp.code");

    if (!user) {
        return next(new Error("User not found", { cause: 404 }));
    }

    const isValidOtp = await validateOtp(otp, user.loginOtp);
    if (!isValidOtp) {
        return next(new Error("Invalid or expired OTP", { cause: 401 }));
    }

    clearOtp(user, "loginOtp");
    resetLoginSecurityState(user);
    await user.save();

    const token = generateToken({ id: user._id, email: user.email });

    return successResponse(res, {
        message: "Login confirmed successfully",
        data: {
            user: sanitizeUser(user),
            token
        }
    });
});

export const resendSignInOtp = asyncHandler(async (req, res, next) => {
    const email = normalizeEmail(req.body.email);

    const user = await findUserByEmail(email);
    if (!user) {
        return next(new Error("User not found", { cause: 404 }));
    }

    if (!user.confirmed) {
        return next(new Error("Please confirm your email before logging in", { cause: 403 }));
    }

    if (!user.twoFactorEnabled) {
        return next(new Error("Two-step verification is not enabled for this account", { cause: 400 }));
    }

    if (!hasActiveOtp(user.loginOtp)) {
        return next(new Error("No pending login verification request found. Please sign in again.", { cause: 400 }));
    }

    const otp = await storeOtp(user, "loginOtp");
    await sendOtpEmail({
        to: user.email,
        subject: "Your login verification code",
        otp,
        action: "Use this OTP to complete your login"
    });

    return successResponse(res, {
        message: "A new login OTP has been sent to your email.",
        data: {
            requiresTwoFactor: true,
            email: user.email
        }
    });
});

export const requestTwoFactorEnable = asyncHandler(async (req, res) => {
    const user = req.user;

    const otp = await storeOtp(user, "twoFactorSetupOtp");
    await sendOtpEmail({
        to: user.email,
        subject: "Enable two-step verification",
        otp,
        action: "Use this OTP to enable two-step verification on your account"
    });

    return successResponse(res, {
        message: "A verification OTP has been sent to your email to enable two-step verification."
    });
});

export const resendTwoFactorEnableOtp = asyncHandler(async (req, res, next) => {
    const user = await userModel.findById(req.user._id);

    if (!user) {
        return next(new Error("User not found", { cause: 404 }));
    }

    if (user.twoFactorEnabled) {
        return next(new Error("Two-step verification is already enabled", { cause: 400 }));
    }

    if (!hasActiveOtp(user.twoFactorSetupOtp)) {
        return next(new Error("No pending two-step verification setup request found. Please start setup again.", { cause: 400 }));
    }

    const otp = await storeOtp(user, "twoFactorSetupOtp");
    await sendOtpEmail({
        to: user.email,
        subject: "Enable two-step verification",
        otp,
        action: "Use this OTP to enable two-step verification on your account"
    });

    return successResponse(res, {
        message: "A new verification OTP has been sent to your email to enable two-step verification."
    });
});

export const verifyTwoFactorEnable = asyncHandler(async (req, res, next) => {
    const { otp } = req.body;

    const user = await userModel
        .findById(req.user._id)
        .select("+twoFactorSetupOtp.code");

    if (!user) {
        return next(new Error("User not found", { cause: 404 }));
    }

    const isValidOtp = await validateOtp(otp, user.twoFactorSetupOtp);
    if (!isValidOtp) {
        return next(new Error("Invalid or expired OTP", { cause: 401 }));
    }

    user.twoFactorEnabled = true;
    clearOtp(user, "twoFactorSetupOtp");
    await user.save();

    return successResponse(res, {
        message: "Two-step verification enabled successfully",
        data: { user: sanitizeUser(user) }
    });
});

export const updatePassword = asyncHandler(async (req, res, next) => {
    const { currentPassword, newPassword } = req.body;

    const user = await userModel.findById(req.user._id).select("+password");

    if (!user) {
        return next(new Error("User not found", { cause: 404 }));
    }

    if (user.provider !== "system") {
        return next(new Error("Password update is not available for this account provider", { cause: 400 }));
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
        return next(new Error("Current password is incorrect", { cause: 401 }));
    }

    if (currentPassword === newPassword) {
        return next(new Error("New password must be different from the current password", { cause: 400 }));
    }

    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.changeCredentialTime = new Date();
    await user.save();

    return successResponse(res, {
        message: "Password updated successfully"
    });
});

export const forgetPassword = asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);

    const user = await findUserByEmail(email);

    if (user && user.provider === "system" && user.confirmed) {
        const otp = await storeOtp(user, "passwordResetOtp");
        await sendOtpEmail({
            to: user.email,
            subject: "Reset your password",
            otp,
            action: "Use this OTP to reset your password"
        });
    }

    return successResponse(res, {
        message: "If the account exists a password reset OTP has been sent to the registered email."
    });
});

export const resendPasswordResetOtp = asyncHandler(async (req, res) => {
    const email = normalizeEmail(req.body.email);

    const user = await findUserByEmail(email);

    if (user && user.provider === "system" && user.confirmed && hasActiveOtp(user.passwordResetOtp)) {
        const otp = await storeOtp(user, "passwordResetOtp");
        await sendOtpEmail({
            to: user.email,
            subject: "Reset your password",
            otp,
            action: "Use this OTP to reset your password"
        });
    }

    return successResponse(res, {
        message: "If a password reset request is active, a new OTP has been sent to the registered email."
    });
});

export const resetPassword = asyncHandler(async (req, res, next) => {
    const { otp, newPassword } = req.body;
    const email = normalizeEmail(req.body.email);

    const user = await userModel
        .findOne({
            email: {
                $regex: `^${escapeRegex(email)}$`,
                $options: "i"
            }
        })
        .select("+passwordResetOtp.code");

    if (!user) {
        return next(new Error("User not found", { cause: 404 }));
    }

    if (user.provider !== "system") {
        return next(new Error("Password reset is not available for this account provider", { cause: 400 }));
    }

    const isValidOtp = await validateOtp(otp, user.passwordResetOtp);
    if (!isValidOtp) {
        return next(new Error("Invalid or expired OTP", { cause: 401 }));
    }

    user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
    user.changeCredentialTime = new Date();
    clearOtp(user, "passwordResetOtp");
    resetLoginSecurityState(user);
    await user.save();

    return successResponse(res, {
        message: "Password reset successfully"
    });
});

export const signUpWithGmail = asyncHandler(async (req, res, next) => {
    const { idToken } = req.body;
    const payload = await verifyGoogleAccount(idToken);
    const email = normalizeEmail(payload.email);

    let user = await findUserByEmail(email);

    if (!user) {
        const { firstName, lastName } = splitGoogleName({
            name: payload.name,
            givenName: payload.given_name,
            familyName: payload.family_name,
            email
        });

        user = await userModel.create({
            firstName,
            lastName,
            email,
            password: await bcrypt.hash(randomBytes(32).toString("hex"), SALT_ROUNDS),
            profilePicture: payload.picture,
            confirmed: payload.email_verified ?? true,
            provider: PROVIDER.GOOGLE
        });
    }

    if (user.provider === PROVIDER.SYSTEM) {
        return next(new Error("This email is already registered with local authentication", { cause: 409 }));
    }

    return successResponse(res, createAuthResponse(user, "Google signup successful"));
});

export const loginWithGmail = asyncHandler(async (req, res, next) => {
    const { idToken } = req.body;
    const payload = await verifyGoogleAccount(idToken);
    const email = normalizeEmail(payload.email);

    const user = await userModel.findOne({
        email: {
            $regex: `^${escapeRegex(email)}$`,
            $options: "i"
        },
        provider: PROVIDER.GOOGLE
    });

    if (!user) {
        return next(new Error("No Google account found for this email", { cause: 404 }));
    }

    return successResponse(res, createAuthResponse(user, "Google login successful"));
});

export const getProfile = asyncHandler(async (req, res) => {
    return successResponse(res, {
        message: "Profile retrieved successfully",
        data: { user: sanitizeUser(req.user) }
    });
});

export const logout = asyncHandler(async (req, res) => {
    const tokenExp = req.decoded.exp;
    const now = Math.floor(Date.now() / 1000);
    const remainingTime = tokenExp - now;

    if (req.decoded.jti) {
        await redisService.setValue({
            key: `revoked_token:${req.decoded.jti}`,
            value: "true",
            ttl: remainingTime > 0 ? remainingTime : 1
        });
    }

    return successResponse(res, {
        message: "Logged out successfully"
    });
});
