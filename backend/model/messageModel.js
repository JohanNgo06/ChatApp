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
    text: { type: String },
    image: { type: String },

    // Dành cho chat 1-1 cũ
    encryptedAesKey: { type: String },
    senderEncryptedAesKey: { type: String },

    // DÀNH CHO CHAT NHÓM: Lưu { "userId1": "encryptedAesKey1", "userId2": "encryptedAesKey2" }
    groupEncryptedKeys: {
      type: Map,
      of: String,
      default: {},
    },

    iv: { type: String },
    shaHash: { type: String },

    // File
    fileUrl: { type: String, default: "" },
    fileName: { type: String, default: "" },
    fileType: { type: String, default: "" },
    fileSize: { type: Number, default: 0 },

    isRead: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const Message = mongoose.model("Message", messageSchema);
export default Message;
