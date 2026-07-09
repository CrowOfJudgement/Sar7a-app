import { asyncHandler } from "../utils/errorHandling.js";

export const authorization = (roles = []) => {
    return asyncHandler(async (req, res, next) => {
        if (!roles.includes(req.user?.role)) {
            return next(new Error("UnAuthorized", { cause: 403 }));
        }

        next();
    });
};
