import Joi from "joi";
import userModel from "../../DB/models/user.model.js";
import { asyncHandler } from "../../utils/errorHandling.js";

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export const sendMessageSchema = {
  body: Joi.object({
    content: Joi.string().min(1).max(2000).required(),
    userId: Joi.string().pattern(objectIdPattern).required(),
  }),
};

export const getMessageSchema = {
  params: Joi.object({
    messageId: Joi.string().pattern(objectIdPattern).required(),
  }),
};

export const validateRecipientExists = asyncHandler(async (req, res, next) => {
  const userId = req.body.userId || req.params.userId;
  if (!userId) {
    return next(new Error("Recipient id not provided", { cause: 400 }));
  }

  const user = await userModel.findById(userId);
  if (!user) {
    return next(new Error("Recipient user does not exist", { cause: 404 }));
  }

  next();
});
