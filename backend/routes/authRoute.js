import { Router } from "express";
import {
  signup,
  signin,
  signout,
  updateProfile,
  checkAuth,
  searchUsers,
} from "../controller/authController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import arcjetMiddleware from "../middleware/arcjetMiddleware.js";

const authRoute = Router();

authRoute.use(arcjetMiddleware);

authRoute.post("/signin", signin);
authRoute.post("/signout", signout);
authRoute.post("/signup", signup);
authRoute.get("/check", authMiddleware, checkAuth);

authRoute.put("/update-profile", authMiddleware, updateProfile);
authRoute.get("/search", authMiddleware, searchUsers);
export default authRoute;
