import { Server } from "socket.io";
import http from "http";
import express from "express";
import Message from "../model/messageModel.js";
import { ENV } from "./env.js"; // IMPORT ENV ĐỂ LẤY CLIENT_URL

const app = express();
const server = http.createServer(app);

// CẤU HÌNH CORS CHO SOCKET.IO
// Chấp nhận localhost khi Dev và CLIENT_URL (Vercel) khi đưa lên mạng
const allowedOrigins = ["http://localhost:5173"];
if (ENV.CLIENT_URL) {
  allowedOrigins.push(ENV.CLIENT_URL);
}

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
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

  // Lấy userId từ frontend gửi lên (trong hàm connectSocket của bạn)
  const userId = socket.handshake.query.userId;

  if (userId && userId !== "undefined") {
    userSocketMap[userId] = socket.id;
  }

  socket.on("typing", ({ receiverId }) => {
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      // Bắn sự kiện "userTyping" kèm ID của người đang gõ cho người nhận
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
        // Báo ngược lại cho người gửi biết tin nhắn này đã được đọc
        io.to(senderSocketId).emit("messageRead", { messageId });
      }
    } catch (error) {
      console.log("Lỗi đánh dấu đã đọc real-time:", error);
    }
  });

  // PHÁT TÍN HIỆU REAL-TIME: Báo cho TẤT CẢ client biết danh sách online mới nhất
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // Khi người dùng đóng tab, mất mạng hoặc đăng xuất (Disconnect)
  socket.on("disconnect", () => {
    console.log("Người dùng đã ngắt kết nối:", socket.id);
    if (userId) {
      delete userSocketMap[userId]; // Xóa khỏi danh sách online
    }
    // PHÁT TÍN HIỆU LẠI: Báo cho mọi người là có người vừa offline
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

// Xuất thêm getReceiverSocketId ra ngoài cùng app, io, server
export { app, io, server, getReceiverSocketId };
