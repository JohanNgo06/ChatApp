import { Router } from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  getFriends,
  getRequests,
  searchUsers,
  getSuggestions,
  sendRequest,
  acceptRequest,
  rejectRequest,
} from "../controller/friendController.js";

const friendRouter = Router();
friendRouter.use(authMiddleware);

friendRouter.get("/list", getFriends);
friendRouter.get("/requests", getRequests);
friendRouter.get("/search", searchUsers);
friendRouter.get("/suggestions", getSuggestions);
friendRouter.post("/request/:userId", sendRequest);
friendRouter.post("/accept/:requestId", acceptRequest);
friendRouter.delete("/reject/:requestId", rejectRequest);

export default friendRouter;
