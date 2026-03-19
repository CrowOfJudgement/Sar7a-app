import { Router } from "express";
import * as userService from "./user.service.js";
import { auth } from "../../middleware/auth.middleware.js";
import { validation } from "../../middleware/validation.js";
const userRouter = Router();
import * as user from "./user.validation.js";
import { multerEnum } from "../../enum/multer.enum.js";
import { multer_local } from "../../middleware/multer.js";

userRouter.post('/users/signup', 
    multer_local({ custom_types: [...multerEnum.image] }).fields([{ name: "attachments" }]), 
    validation(user.signUpSchema), 
    userService.signUp 
);
userRouter.post("/users/confirm-email", validation(user.confirmEmailSchema), userService.confirmEmail);
userRouter.post("/signIn", validation(user.signInSchema), userService.signIn);
userRouter.post("/signIn/confirm", validation(user.confirmSignInSchema), userService.confirmSignIn);
userRouter.get('/profile', auth, userService.getProfile);
userRouter.post("/users/2fa/enable", auth, userService.requestTwoFactorEnable);
userRouter.post("/users/2fa/verify", auth, validation(user.otpOnlySchema), userService.verifyTwoFactorEnable);
userRouter.patch("/users/password", auth, validation(user.updatePasswordSchema), userService.updatePassword);
userRouter.post("/users/password/forgot", validation(user.forgetPasswordSchema), userService.forgetPassword);
userRouter.post("/users/password/reset", validation(user.resetPasswordSchema), userService.resetPassword);
userRouter.post("/logout", auth, userService.logout);
userRouter.post('/loginWithGmail', validation(user.loginWithGmailSchema), userService.loginWithGmail);
export default userRouter;
