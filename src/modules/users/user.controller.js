import { Router } from "express";
import * as userService from "./user.service.js";
import { auth } from "../../middleware/auth.middleware.js";
import { validation } from "../../middleware/validation.js";
const userRouter = Router();
import * as user from "./user.validation.js";
import { multerEnum } from "../../enum/multer.enum.js";
import { multer_local } from "../../middleware/multer.js";
import { OAuth2Client } from 'google-auth-library';
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

userRouter.post('/users/signup', 
    multer_local({ custom_types: [...multerEnum.image] }).fields([{ name: "attachments" }]), 
    validation(user.signUpSchema), 
    userService.signUp 
);
userRouter.post("/signIn", validation(user.signInSchema), userService.signIn);
userRouter.get('/profile', auth, userService.getProfile);
userRouter.post('/loginWithGmail', validation(user.signInSchema), userService.loginWithGmail);
export default userRouter;
