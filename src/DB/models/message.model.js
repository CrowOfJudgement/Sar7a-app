import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    attachments: [String],
  },
  {
    timestamps: true,
  },
);

const messageModel = mongoose.model("message", messageSchema);
export default messageModel;
