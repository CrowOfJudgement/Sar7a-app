import { Router } from "express";
import * as messageService from "./message.service.js";
import { auth } from "../../middleware/auth.middleware.js";
import { validation } from "../../middleware/validation.js";
import * as message from "./message.validation.js";
import { multerEnum } from "../../enum/multer.enum.js";
import { multer_local } from "../../middleware/multer.js";

const messageRouter = Router();

messageRouter.post(
  "/messages",
  multer_local({ custom_types: [...multerEnum.image] }).fields([
    { name: "attachments" },
  ]),
  validation(message.sendMessageSchema),
  message.validateRecipientExists,
  messageService.sendMessage,
);

messageRouter.get(
  "/messages/:messageId",
  auth,
  validation(message.getMessageSchema),
  messageService.getMessage,
);

export default messageRouter;
