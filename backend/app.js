/* eslint-disable no-unused-vars */
import express from "express";
import { ENV } from "./lib/env.js";
import { app, server } from "./lib/socket.js";

import errorMiddleware from "./middleware/errorMiddleware.js";
import path from "path";
import authRoute from "./routes/authRoute.js";
import messageRoute from "./routes/messageRoute.js";
import friendRoute from "./routes/friendRoute.js";
import { connectToDB } from "./lib/db.js";
import conversationRoute from "./routes/conversationRoute.js";
import cors from "cors";

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const allowedOrigins = [
  "http://localhost:5173",
  ENV.CLIENT_URL, // <--- Trên Dashboard Render, tạo biến CLIENT_URL điền link Vercel của bạn vào
];

app.use(
  cors({
    origin: [
      "http://localhost:5173", // Dành cho lúc bạn chạy dev ở máy
      "https://chat-app-three-tau-14.vercel.app", // Dành cho Vercel (Lấy chính xác từ ảnh bạn gửi, không có dấu / ở cuối)
    ],
    credentials: true, // Rất quan trọng để gửi được Cookie chứa JWT
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  }),
);

// Bắt buộc phải có dòng này để xử lý Preflight Request (OPTIONS) của trình duyệt
app.options("/(.*)", cors());

app.use("/api/auth", authRoute);
app.use("/api/messages", messageRoute);
app.use("/api/conversation", conversationRoute);
app.use("/api/friends", friendRoute);

app.use(errorMiddleware);

const PORT = ENV.PORT || 5000;

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  connectToDB();
});
