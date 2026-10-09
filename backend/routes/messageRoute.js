import { Router } from "express";
import {
  getMessages,
  sendMessage,
  getUsersForSidebar,
} from "../controller/messageController.js";
import authMiddleware from "../middleware/authMiddleware.js";

const messageRoute = Router();

messageRoute.use(authMiddleware);

messageRoute.get("/users", authMiddleware, getUsersForSidebar);

messageRoute.get("/:partnerId", getMessages);
messageRoute.post("/send/:partnerId", sendMessage);

export default messageRoute;
