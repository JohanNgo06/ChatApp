import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getConversations,
  accessConversation,
  createGroupChat,
} from "../controller/conversationController.js";

const conversationRoute = Router();
conversationRoute.use(authMiddleware);

conversationRoute.post("/group/create", createGroupChat);
conversationRoute.get("/:partnerId", accessConversation);
conversationRoute.get("/", getConversations);

export default conversationRoute;
