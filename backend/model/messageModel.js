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
    // ==========================================
    // CÁC TRƯỜNG MỚI ĐỂ LƯU FILE MÃ HÓA
    // ==========================================
    fileUrl: {
      type: String, // Link tải file thô (đã mã hóa) từ Cloudinary
    },
    fileName: {
      type: String, // Tên file gốc (ví dụ: bao-cao.pdf) để hiển thị UI
    },
    fileType: {
      type: String, // Đuôi file (pdf, docx, zip...) để chọn Icon UI
    },
    fileSize: {
      type: Number, // Dung lượng file (byte)
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
