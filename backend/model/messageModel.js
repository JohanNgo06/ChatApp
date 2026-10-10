import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    text: {
      type: String,
      // ĐÃ BỎ `required: true` vì tin nhắn có thể chỉ chứa File/Ảnh
      // ĐÃ BỎ `required: true` vì tin nhắn có thể chỉ chứa File/Ảnh
    },
    encryptedAesKey: {
      type: String,
    },
    senderEncryptedAesKey: {
      type: String,
    },
    iv: {
      type: String,
    },
    shaHash: {
      type: String,
    },
    image: {
      type: String,
    },
  },
  { timestamps: true },
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
