import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173"], // Domain frontend của bạn
    methods: ["GET", "POST"],
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
