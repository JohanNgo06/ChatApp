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
    // Đặt tên biến rõ ràng: có thể là ID của Group hoặc ID của User khác
    const receiverIdOrGroupId = req.params.partnerId;

    // 1. Thử tìm xem ID truyền lên có phải là ID của Group không
    let conversation = await Conversation.findById(receiverIdOrGroupId);

    // 2. Nếu không tìm thấy Group, nghĩa là đây là Chat 1-1, tìm theo logic cũ
    if (!conversation) {
      conversation = await Conversation.findOne({
        participants: { $all: [currentUserId, receiverIdOrGroupId] },
        isGroupChat: { $ne: true }, // Đảm bảo không lấy nhầm group
      });
    }

    if (!conversation) {
      return res.status(200).json([]);
    }

    const messages = await Message.find({
      conversationId: conversation._id,
    }).sort({ createdAt: 1 });

    // ==========================================
    // LOGIC ĐÁNH DẤU ĐÃ ĐỌC (Tạm thời chỉ áp dụng cho 1-1)
    // ==========================================
    if (!conversation.isGroupChat) {
      const unreadMessages = messages.filter(
        // Thay partnerId bằng receiverIdOrGroupId
        (m) =>
          m.senderId.toString() === receiverIdOrGroupId.toString() && !m.isRead,
      );

      if (unreadMessages.length > 0) {
        // Cập nhật DB
        await Message.updateMany(
          { _id: { $in: unreadMessages.map((m) => m._id) } },
          { $set: { isRead: true } },
        );
        // Bắn Socket cho người gửi biết TẤT CẢ tin nhắn đã được xem
        const partnerSocketId = getReceiverSocketId(receiverIdOrGroupId); // Sửa ở đây
        if (partnerSocketId) {
          io.to(partnerSocketId).emit("messagesReadBulk", {
            conversationId: conversation._id,
          });
        }
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
    const receiverIdOrGroupId = req.params.partnerId;

    // Nhận thêm các trường liên quan đến File từ Frontend gửi lên
    const {
      text,
      image,
      iv,
      shaHash,
      encryptedAesKey,
      senderEncryptedAesKey, // Dùng cho 1-1
      groupEncryptedKeys, // Dùng cho Group
      fileBase64,
      fileName,
      fileType,
      fileSize,
    } = req.body;

    let conversation = await Conversation.findById(receiverIdOrGroupId);

    // Nếu không tìm thấy Group, nghĩa là đang chat 1-1, tìm theo logic cũ
    if (!conversation) {
      conversation = await Conversation.findOne({
        participants: { $all: [currentUserId, receiverIdOrGroupId] },
        isGroupChat: { $ne: true }, // Đảm bảo là chat 1-1
      });

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [currentUserId, receiverIdOrGroupId],
          isGroupChat: false,
        });
      }
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
      text: text || "",
      image: image || "",
      iv,
      shaHash,
      encryptedAesKey,
      senderEncryptedAesKey,
      groupEncryptedKeys: groupEncryptedKeys || {}, // LƯU MAP KEY CỦA NHÓM
      fileUrl: uploadedFileUrl || "",
      fileName: fileName || "",
      fileType: fileType || "",
      fileSize: fileSize || 0,
    });

    // 3. PHÁT SÓNG QUA SOCKET.IO
    if (conversation.isGroupChat) {
      // Nếu là chat nhóm: Bắn sự kiện cho tất cả thành viên trong nhóm (trừ người gửi)
      conversation.participants.forEach((participantId) => {
        if (participantId.toString() !== currentUserId.toString()) {
          const receiverSocketId = getReceiverSocketId(
            participantId.toString(),
          );
          if (receiverSocketId) {
            io.to(receiverSocketId).emit("newMessage", newMessage);
          }
        }
      });
    } else {
      // Nếu là chat 1-1 logic cũ
      // Nếu receiverIdOrGroupId ở đây không phải Group ID, thì nó là User ID của partner
      const receiverSocketId = getReceiverSocketId(receiverIdOrGroupId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newMessage", newMessage);
      }
    }

    conversation.lastMessage = newMessage._id;
    await conversation.save();

    res.status(200).json(newMessage);
  } catch (error) {
    console.error("Lỗi khi gửi tin nhắn:", error);
    next(error);
  }
};
