import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { successResponse } from "../../utils/response.js";
import { asyncHandler } from "../../utils/errorHandling.js";
import userModel from "../../DB/models/user.model.js";
import * as db_service from "../../DB/db.service.js";
import { OAuth2Client } from 'google-auth-library';

const JWT_SECRET = process.env.JWT_SECRET || 'ay 7aga';
const SALT_ROUNDS = 10;
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const generateToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

export const signUp = asyncHandler(async (req, res, next) => {
    const { firstName, lastName, email, password, age, gender } = req.body;

    const emailExist = await db_service.findone({ 
        model: userModel, 
        filter: { email } 
    });
    
    if (emailExist) {
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

    const user = await db_service.create({
        model: userModel,
        data: { 
            firstName, 
            lastName, 
            email, 
            password: hashedPassword, 
            age, 
            gender,
            profilePicture,
            attachments
        }
    });

    const token = generateToken({ id: user._id });

    return successResponse(res, { 
        message: "User registered successfully", 
        data: { user, token }, 
        status: 201 
    });
});

export const signIn = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;

    const user = await db_service.findone({ 
        model: userModel, 
        filter: { email } 
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return next(new Error("Invalid email or password", { cause: 401 }));
    }

    const token = generateToken({ id: user._id });

    return successResponse(res, { 
        message: "Login successful", 
        data: { user, token } 
    });
});

export const loginWithGmail = asyncHandler(async (req, res, next) => {
    const { idToken } = req.body;

    const ticket = await client.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const { email, given_name, family_name } = ticket.getPayload();

    let user = await userModel.findOne({ email });

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
    return res.status(200).json({ message: "Success", token });
});
export const getProfile = asyncHandler(async (req, res, next) => {
    const user = req.user;
    return successResponse(res, { 
        message: "Profile retrieved successfully", 
        data: { user } 
    });
});
