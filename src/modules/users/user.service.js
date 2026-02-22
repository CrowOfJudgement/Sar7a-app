import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { successResponse } from "../../utils/response.js";
import { asyncHandler } from "../../utils/errorHandling.js";
import userModel from "../../DB/models/user.model.js";
import * as db_service from "../../DB/db.service.js";

const JWT_SECRET = 'ay 7aga';
const SALT_ROUNDS = 10;

const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};






export const signUp = asyncHandler(async (req, res, next) => {
    const { firstName, lastName, email, password, age, gender } = req.body;


    

    if (!firstName || !lastName || !email || !password) {
        return next(new Error("All fields are required", { cause: 400 }));
    }

    const emailExist = await db_service.findone({ 
        model: userModel, 
        filter: { email } 
    });
    
    if (emailExist) {
        return next(new Error("Email already exists", { cause: 409 }));
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await db_service.create({
        model: userModel,
        data: { 
            firstName, 
            lastName, 
            email, 
            password: hashedPassword, 
            age, 
            gender 
        }
    });

    const token = generateToken(user._id);

    const userResponse = {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName,
        email: user.email,
        age: user.age,
        gender: user.gender
    };

    return successResponse(res, { 
        message: "User registered successfully", 
        data: { 
            user: userResponse,
            token 
        }, 
        status: 201 
    });
});

export const signIn = asyncHandler(async (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return next(new Error("Email and password are required", { cause: 400 }));
    }

    const user = await db_service.findone({ 
        model: userModel, 
        filter: { email } 
    });

    if (!user) {
        return next(new Error("Invalid email or password", { cause: 401 }));
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
        return next(new Error("Invalid email or password", { cause: 401 }));
    }

    const token = jwt.sign(
    { id: user._id }, 
    process.env.JWT_SECRET || 'ay 7aga', 
    { expiresIn: '1d' }
);

    const userResponse = {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName,
        email: user.email,
        age: user.age,
        gender: user.gender
    };

    return successResponse(res, { 
        message: "Login successful", 
        data: { 
            user: userResponse,
            token 
        } 
    });
});

export const getProfile = asyncHandler(async (req, res, next) => {
    const user = req.user.toObject();
    delete user.password; 

    return successResponse(res, {
        message: "Profile data fetched successfully",
        data: { user }
    });
});