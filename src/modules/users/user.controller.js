import { Router } from "express";
import * as userService from "./user.service.js";
import { auth } from "../../middleware/auth.middleware.js";
import { validation } from "../../middleware/validation.js";
const userRouter = Router();
import * as user from "./user.validation.js";

userRouter.post('/users/signup', validation(user.signUpSchema),userService.signUp);
userRouter.post("/signIn", validation(user.signInSchema),userService.signIn);
userRouter.get('/profile', auth,userService.getProfile);
export default userRouter;