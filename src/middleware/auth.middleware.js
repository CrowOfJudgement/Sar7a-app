import { asyncHandler } from '../utils/errorHandling.js'; 
import jwt from 'jsonwebtoken';
import userModel from '../DB/models/user.model.js';
const JWT_SECRET = 'ay 7aga';

export const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};
export const auth = asyncHandler(async (req, res, next) => {
    const { authorization } = req.headers;
    if (!authorization?.startsWith("Bearer ")) {
        return next(new Error("Token required", { cause: 400 }));
    }

    const token = authorization.split(" ")[1];
const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ay 7aga');

const user = await userModel.findById(decoded.id);
    
    if (!user) {
        return next(new Error("User not found", { cause: 404 }));
    }

    req.user = user; 

    next();
});