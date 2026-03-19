import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { OAuth2Client } from "google-auth-library";
import { successResponse } from "../../utils/response.js";
import { asyncHandler } from "../../utils/errorHandling.js";
import userModel from "../../DB/models/user.model.js";
import * as redisService from "../../DB/redis/redis.service.js";
import { sendEmail, generateOtp } from "../../utils/email/send.email.js";

const JWT_SECRET = process.env.JWT_SECRET || "ay 7aga";
const SALT_ROUNDS = 10;
const OTP_EXPIRY_MINUTES = 10;
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
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

const sendOtpEmail = async ({ to, subject, otp, action }) => {
    await sendEmail({
        to,
        subject,
        html: `<h1>${action}</h1><p>Your OTP is <strong>${otp}</strong>.</p><p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p>`
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
            const otp = String(await generateOtp());

            emailExist.firstName = firstName;
            emailExist.lastName = lastName;
            emailExist.password = await bcrypt.hash(password, SALT_ROUNDS);
            emailExist.age = age;
            emailExist.gender = gender;
            emailExist.confirmationOtp = {
                code: await bcrypt.hash(otp, SALT_ROUNDS),
                expiresAt: getOtpExpiryDate()
            };

            if (req.files?.attachments) {
                const attachments = [];
                for (const file of req.files.attachments) {
                    attachments.push(file.path);
                }
                emailExist.attachments = attachments;
                emailExist.profilePicture = req.files.attachments[0].path;
            }

            await emailExist.save();

            await sendOtpEmail({
                to: email,
                subject: "Confirm your Saraha account",
                otp,
                action: "Use this OTP to confirm your email address"
            });

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

    const otp = String(await generateOtp());

    const user = await userModel.create({
        firstName,
        lastName,
        email,
        password: hashedPassword,
        age,
        gender,
        profilePicture,
        attachments,
        confirmationOtp: {
            code: await bcrypt.hash(otp, SALT_ROUNDS),
            expiresAt: getOtpExpiryDate()
        }
    });

    await sendOtpEmail({
        to: email,
        subject: "Confirm your Saraha account",
        otp,
        action: "Use this OTP to confirm your email address"
    });

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

    const isValidOtp = await validateOtp(otp, user.confirmationOtp);
    if (!isValidOtp) {
        return next(new Error("Invalid or expired OTP", { cause: 401 }));
    }

    user.confirmed = true;
    clearOtp(user, "confirmationOtp");
    await user.save();

    return successResponse(res, {
        message: "Email confirmed successfully",
        data: { user: sanitizeUser(user) }
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
        message: "If the account exists, a password reset OTP has been sent to the registered email."
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

export const loginWithGmail = asyncHandler(async (req, res) => {
    const { idToken } = req.body;

    const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID
    });

    const { email, given_name, family_name } = ticket.getPayload();

    let user = await findUserByEmail(email);

    if (!user) {
        user = await userModel.create({
            firstName: given_name,
            lastName: family_name,
            email,
            password: await bcrypt.hash(Math.random().toString(36), SALT_ROUNDS),
            confirmed: true,
            provider: "google"
        });
    }

    const token = generateToken({ id: user._id, email: user.email });

    return successResponse(res, {
        message: "Success",
        data: {
            user: sanitizeUser(user),
            token
        }
    });
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
