import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../model/messageModel.js";
import { ENV } from "./env.js"; // Đảm bảo import ENV

const app = express();
const server = http.createServer(app);

// CẤU HÌNH CORS CHO SOCKET.IO
const allowedOrigins = [
  "http://localhost:5173",
  "https://chat-app-beta-beryl-36.vercel.app",
];
if (ENV.CLIENT_URL) {
  allowedOrigins.push(ENV.CLIENT_URL);
}

const io = new Server(server, {
  cors: {
    origin: "https://chat-app-beta-beryl-36.vercel.app",
    methods: ["GET", "POST"],
    credentials: true, // Quan trọng để gửi kèm cookie/token
  },
});

// Biến lưu trữ ID của các user đang online: { userId: socketId }
const userSocketMap = {};

// HÀM QUAN TRỌNG: Lấy socketId của một user dựa vào userId của họ
const getReceiverSocketId = (userId) => {
  return userSocketMap[userId];
};

io.on("connection", (socket) => {
  console.log("Một người dùng đã kết nối:", socket.id);

  // Lấy userId từ frontend gửi lên
  const userId = socket.handshake.query.userId;

  if (userId && userId !== "undefined") {
    userSocketMap[userId] = socket.id;
  }

  socket.on("typing", ({ receiverId }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userTyping", { senderId: userId });
    }
  });

  socket.on("stopTyping", ({ receiverId }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("userStoppedTyping", { senderId: userId });
    }
  });

  socket.on("markMessageAsRead", async ({ messageId, senderId }) => {
    try {
      await Message.findByIdAndUpdate(messageId, { isRead: true });
      const senderSocketId = getReceiverSocketId(senderId);
      if (senderSocketId) {
        io.to(senderSocketId).emit("messageRead", { messageId });
      }
    } catch (error) {
      console.log("Lỗi đánh dấu đã đọc real-time:", error);
    }
  });

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  socket.on("disconnect", () => {
    console.log("Người dùng đã ngắt kết nối:", socket.id);
    if (userId) {
      delete userSocketMap[userId];
    }
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { app, io, server, getReceiverSocketId };
