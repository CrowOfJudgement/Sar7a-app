import { successResponse } from "../../utils/response.js";
import { asyncHandler } from "../../utils/errorHandling.js";
import * as db_service from "../../DB/db.service.js";
import messageModel from "../../DB/models/message.model.js";
import userModel from "../../DB/models/user.model.js";

export const sendMessage = asyncHandler(async (req, res, next) => {
  const { content, userId } = req.body;

  const user = await userModel.findById(userId);
  if (!user) {
    return next(new Error("user not exist", { cause: 404 }));
  }

  const attachments = [];
  if (req.files) {
    if (Array.isArray(req.files)) {
      for (const file of req.files) attachments.push(file.path);
    } else {
      for (const key of Object.keys(req.files)) {
        for (const file of req.files[key]) attachments.push(file.path);
      }
    }
  }

  const message = await db_service.create({
    model: messageModel,
    data: {
      content,
      userId: user._id,
      attachments,
    },
  });

  return successResponse(res, {
    message: "Message sent",
    data: message,
    status: 201,
  });
});

export const getMessage = asyncHandler(async (req, res, next) => {
  const { messageId } = req.params;

  const message = await db_service.findone({
    model: messageModel,
    filter: {
      _id: messageId,
      userId: req.user._id,
    },
  });

  if (!message) {
    return next(new Error("message not exist or not auth", { cause: 404 }));
  }

  return successResponse(res, { message: "Message fetched", data: message });
});
