import Message from "../model/messageModel.js";
import Conversation from "../model/conversationModel.js";
import User from "../model/userModel.js";
import { io, getReceiverSocketId } from "../lib/socket.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;

    // Lấy danh sách tất cả user TRỪ người đang đăng nhập
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

    res.status(200).json(messages);
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const partnerId = req.params.partnerId;
    const { text, image, encryptedAesKey, senderEncryptedAesKey, iv, shaHash } =
      req.body;

    let conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, partnerId] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [currentUserId, partnerId],
      });
    }
    const newMessage = await Message.create({
      senderId: currentUserId,
      conversationId: conversation._id,
      text,
      image,
      encryptedAesKey,
      senderEncryptedAesKey,
      iv,
      shaHash,
    });
    const receiverSocketId = getReceiverSocketId(partnerId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", newMessage);
    }
    conversation.lastMessage = newMessage._id;
    await conversation.save();

    res.status(200).json(newMessage);
  } catch (error) {
    next(error);
  }
};
