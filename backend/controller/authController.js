import User from "../model/userModel.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { ENV } from "../lib/env.js";
import cloudinary from "../lib/cloudinary.js";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: ENV.USER_EMAIL,
    pass: ENV.PASS_EMAIL,
  },
});

export const verifyOTP = async (req, res, next) => {
  try {
    const { userId, otp } = req.body;

    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy người dùng" });

    if (user.isVerified)
      return res.status(400).json({ message: "Tài khoản đã được xác minh" });

    // Kiểm tra mã OTP và thời gian hết hạn
    if (user.otp !== otp)
      return res.status(400).json({ message: "Mã OTP không chính xác" });
    if (user.otpExpires < new Date())
      return res.status(400).json({ message: "Mã OTP đã hết hạn" });

    // Cập nhật trạng thái xác minh và xóa mã OTP
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // CẤP TOKEN SAU KHI XÁC MINH THÀNH CÔNG
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
      message: "Xác minh thành công",
      data: { token, user: userResponse },
    });
  } catch (error) {
    next(error);
  }
};

export const signup = async (req, res, next) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { name, email, password, publicKey } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be 6 characters or above" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const isExists = await User.findOne({ email });

    if (isExists) {
      // FIX LỖI ĐĂNG KÝ LẠI: Nếu tài khoản tồn tại nhưng CHƯA xác minh -> Xóa đi cho phép đăng ký lại
      if (!isExists.isVerified) {
        await User.findByIdAndDelete(isExists._id);
      } else {
        return res.status(400).json({ message: "Email đã được sử dụng" });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // TẠO MÃ OTP 6 SỐ
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000); // OTP hết hạn sau 5 phút

    const newUser = await User.create(
      [
        {
          name,
          email,
          password: hashedPassword,
          publicKey: publicKey || "",
          isVerified: false,
          otp: otp,
          otpExpires: otpExpires,
        },
      ],
      { session },
    );

    // GỬI EMAIL
    const mailOptions = {
      from: `"WhatSoup App" <${ENV.USER_EMAIL}>`,
      to: email,
      subject: "Mã xác nhận đăng ký tài khoản",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Xin chào ${name},</h2>
          <p>Cảm ơn bạn đã đăng ký tài khoản. Đây là mã xác nhận (OTP) của bạn:</p>
          <h1 style="color: #5c40e8; letter-spacing: 5px;">${otp}</h1>
          <p>Mã này sẽ hết hạn trong vòng 5 phút.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      success: true,
      message: "Vui lòng kiểm tra email để lấy mã OTP",
      data: { userId: newUser[0]._id },
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
      return res.status(404).json({ message: "Tài khoản không tồn tại" });
    }

    // FIX LỖI ĐĂNG NHẬP: Chặn đứng tài khoản chưa nhập OTP
    if (!user.isVerified) {
      return res.status(401).json({
        message:
          "Tài khoản chưa được xác minh. Vui lòng đăng ký lại để nhận mã OTP.",
      });
    }

    const comparePassword = await bcrypt.compare(password, user.password);

    if (!comparePassword) {
      return res.status(401).json({ message: "Sai email hoặc mật khẩu" });
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
      message: "Đăng nhập thành công",
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
    const keyword = req.query.keyword;

    if (!keyword) {
      return res.status(200).json([]);
    }

    const currentUserId = req.user._id;

    const users = await User.find({
      _id: { $ne: currentUserId },
      $or: [
        { name: { $regex: keyword, $options: "i" } },
        { email: { $regex: keyword, $options: "i" } },
      ],
    }).select("-password -privateKey");

    res.status(200).json(users);
  } catch (error) {
    console.error("Lỗi tại controller searchUsers:", error.message);
    res
      .status(500)
      .json({ message: "Lỗi server nội bộ", error: error.message });
  }
};
