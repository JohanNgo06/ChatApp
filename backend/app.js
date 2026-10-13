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

// CẤU HÌNH CORS CHO CÁC API EXPRESS (Trỏ về URL của Vercel)
const allowedOrigins = ["http://localhost:5173"];
if (ENV.CLIENT_URL) {
  allowedOrigins.push(ENV.CLIENT_URL);
}

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

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
