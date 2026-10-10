import Message from "../model/messageModel.js";
import Conversation from "../model/conversationModel.js";
import User from "../model/userModel.js";
import { io, getReceiverSocketId } from "../lib/socket.js";
import cloudinary from "../lib/cloudinary.js"; // THÊM IMPORT CLOUDINARY

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId },
    }).select("-password -privateKey");

    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Lỗi tại getUsersForSidebar: ", error.message);
    res.status(500).json({ error: "Lỗi server nội bộ" });
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const partnerId = req.params.partnerId;

    const conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, partnerId] },
    });

    if (!conversation) {
      return res.status(200).json([]);
    }

    const messages = await Message.find({
      conversationId: conversation._id,
    }).sort({ createdAt: 1 });

    const unreadMessages = messages.filter(
      (m) => m.senderId.toString() === partnerId.toString() && !m.isRead,
    );

    if (unreadMessages.length > 0) {
      // Cập nhật DB
      await Message.updateMany(
        { _id: { $in: unreadMessages.map((m) => m._id) } },
        { $set: { isRead: true } },
      );
      // Bắn Socket cho người gửi biết TẤT CẢ tin nhắn đã được xem
      const partnerSocketId = getReceiverSocketId(partnerId);
      if (partnerSocketId) {
        io.to(partnerSocketId).emit("messagesReadBulk", {
          conversationId: conversation._id,
        });
      }
    }

    res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const partnerId = req.params.partnerId;

    // Nhận thêm các trường liên quan đến File từ Frontend gửi lên
    const {
      text,
      image,
      encryptedAesKey,
      senderEncryptedAesKey,
      iv,
      shaHash,
      fileBase64,
      fileName,
      fileType,
      fileSize,
    } = req.body;

    let conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, partnerId] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [currentUserId, partnerId],
      });
    }

    // ==========================================
    // 1. XỬ LÝ UPLOAD FILE MÃ HÓA LÊN CLOUDINARY
    // ==========================================
    let uploadedFileUrl = "";
    if (fileBase64) {
      // Cloudinary yêu cầu định dạng data URI cho file upload
      const fileDataUri = fileBase64.startsWith("data:")
        ? fileBase64
        : `data:application/octet-stream;base64,${fileBase64}`;

      const uploadResponse = await cloudinary.uploader.upload(fileDataUri, {
        resource_type: "raw", // Bắt buộc dùng 'raw' vì Cloudinary không đọc được file đã bị AES mã hóa
        folder: "chat_files",
      });
      uploadedFileUrl = uploadResponse.secure_url;
    }

    // ==========================================
    // 2. LƯU VÀO DATABASE
    // ==========================================
    const newMessage = await Message.create({
      senderId: currentUserId,
      conversationId: conversation._id,
      text: text || "", // Tránh lỗi nếu text bị rỗng
      image: image || "",
      encryptedAesKey,
      senderEncryptedAesKey,
      iv,
      shaHash,
      // Lưu thông tin file
      fileUrl: uploadedFileUrl || "",
      fileName: fileName || "",
      fileType: fileType || "",
      fileSize: fileSize || 0,
    });

    // ==========================================
    // 3. PHÁT SÓNG QUA SOCKET.IO
    // ==========================================
    const receiverSocketId = getReceiverSocketId(partnerId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }

    conversation.lastMessage = newMessage._id;
    await conversation.save();

    res.status(200).json(newMessage);
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn:", error);
    next(error);
  }
};
