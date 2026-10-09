import User from "../model/userModel.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { ENV } from "../lib/env.js";
import cloudinary from "../lib/cloudinary.js";

export const signup = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { name, email, password, publicKey } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All field are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be 6 character or above" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const isExists = await User.findOne({ email });

    if (isExists) {
      return res.status(404).json({ message: "User already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create(
      [
        {
          name,
          email,
          password: hashedPassword,
          publicKey: publicKey || "",
        },
      ],
      { session },
    );

    const userResponse = newUser[0].toObject();
    delete userResponse.password;

    const token = jwt.sign({ userId: newUser[0]._id }, ENV.JWT_SECRET, {
      expiresIn: ENV.JWT_EXPIRES_IN,
    });

    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "strict",
      secure: ENV.NODE_ENV !== "development",
    });

    await session.commitTransaction();
    session.endSession();
    res.status(200).json({
      success: true,
      message: "Created new user",
      data: { token, user: userResponse },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

export const signin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not exists" });
    }

    const comparePassword = await bcrypt.compare(password, user.password);

    if (!comparePassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = jwt.sign({ userId: user._id }, ENV.JWT_SECRET, {
      expiresIn: ENV.JWT_EXPIRES_IN,
    });

    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "strict",
      secure: ENV.NODE_ENV !== "development",
    });

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: "User signed in successfully",
      data: {
        token,
        user: userResponse,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const signout = async (req, res, next) => {
  try {
    res.cookie("jwt", "", {
      httpOnly: true,
      expires: new Date(0),
    });
    res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (req, res, next) => {
  try {
    const { profilePic } = req.body;

    if (!profilePic)
      return res.status(400).json({ message: "Profile pic is required" });

    const userId = req.user._id;
    const responseUpload = await cloudinary.uploader.upload(profilePic);

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        profilePic: responseUpload.secure_url,
      },
      { new: true },
    );

    const responseData = updatedUser.toObject();
    delete responseData.password;

    res.status(200).json({
      success: true,
      message: "Uploaded profile pic",
      data: { responseData },
    });
  } catch (error) {
    next(error);
  }
};

export const checkAuth = (req, res) => {
  try {
    res.status(200).json(req.user);
  } catch (error) {
    console.log("Error in checkAuth controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const searchUsers = async (req, res) => {
  try {
    // Lấy từ khóa tìm kiếm từ query param (vd: /search?keyword=abc)
    const keyword = req.query.keyword;

    // Nếu không nhập gì, có thể trả về mảng rỗng
    if (!keyword) {
      return res.status(200).json([]);
    }

    // Lấy ID của user đang đăng nhập hiện tại từ middleware
    const currentUserId = req.user._id;

    // Tìm kiếm các user khớp với name hoặc email (không phân biệt chữ hoa chữ thường)
    // VÀ phải LOẠI TRỪ user đang đăng nhập ra khỏi kết quả
    const users = await User.find({
      _id: { $ne: currentUserId }, // $ne: Not Equal (Loại trừ ID của chính mình)
      $or: [
        { name: { $regex: keyword, $options: "i" } }, // $regex để tìm kiếm tương đối (LIKE), $options: "i" là không phân biệt hoa thường
        { email: { $regex: keyword, $options: "i" } },
      ],
    }).select("-password -privateKey"); // BẢO MẬT: Bỏ chọn trường password và privateKey không gửi về Frontend

    res.status(200).json(users);
  } catch (error) {
    console.error("Lỗi tại controller searchUsers:", error.message);
    res
      .status(500)
      .json({ message: "Lỗi server nội bộ", error: error.message });
  }
};
