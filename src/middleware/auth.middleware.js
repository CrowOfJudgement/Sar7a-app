import { asyncHandler } from '../utils/errorHandling.js'; 
import jwt from 'jsonwebtoken';
import userModel from '../DB/models/user.model.js';
import * as redisService from '../DB/redis/redis.service.js';

const JWT_SECRET = process.env.JWT_SECRET || 'ay 7aga';

export const generateToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};

export const auth = asyncHandler(async (req, res, next) => {
    const { authorization } = req.headers;
    
    if (!authorization?.startsWith("Bearer ")) {
        return next(new Error("Token required", { cause: 400 }));
    }

    const token = authorization.split(" ")[1];
    

    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded?.id) {
        return next(new Error("Invalid token", { cause: 400 }));
    }

    if (decoded.jti) {
        const isRevoked = await redisService.get(`revoked_token:${decoded.jti}`);
        if (isRevoked) {
            return next(new Error("Token has been revoked", { cause: 401 }));
        }
    }

    const user = await userModel.findById(decoded.id);
    if (!user) {
        return next(new Error("User not found", { cause: 404 }));
    }

    if (user.changeCredentialTime && (user.changeCredentialTime.getTime() / 1000) > decoded.iat) {
        return next(new Error("Invalid token because of logout", { cause: 401 }));
    }

    if (user.isDeleted || user.status === 'blocked') {
        return next(new Error("User account is disabled", { cause: 403 }));
    }

    req.user = user; 
    req.decoded = decoded;

    next();
});





