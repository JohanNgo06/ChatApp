import User from "../model/userModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { ENV } from "../lib/env.js";
import cloudinary from "../lib/cloudinary.js";

const TEST_EMAILS = ["test1@gmail.com", "test2@gmail.com", "admin@test.com"];

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

    // LƯU Ý QUAN TRỌNG: Sửa sameSite thành "none" và secure thành true để chạy được trên Vercel
    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
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
      if (!isExists.isVerified) {
        await User.findByIdAndDelete(isExists._id);
      } else {
        return res.status(400).json({ message: "Email đã được sử dụng" });
      }
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const isTestAccount =
      ENV.NODE_ENV !== "production" && TEST_EMAILS.includes(email);

    const otp = isTestAccount
      ? null
      : Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = isTestAccount
      ? null
      : new Date(Date.now() + 5 * 60 * 1000);

    const newUser = await User.create({
      name,
      email,
      password: hashedPassword,
      publicKey: publicKey || "",
      isVerified: isTestAccount,
      otp: otp,
      otpExpires: otpExpires,
    });

    if (isTestAccount) {
      const token = jwt.sign({ userId: newUser._id }, ENV.JWT_SECRET, {
        expiresIn: "7d",
      });
      return res.status(200).json({
        success: true,
        message: "Đăng ký thành công (Bypass OTP)",
        data: { userId: newUser._id, token: token },
        user: newUser,
        requireOtp: false,
      });
    }

    // GỬI EMAIL BẰNG BREVO API (KHÔNG DÙNG NODEMAILER)
    try {
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "api-key": ENV.BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender: {
            name: "WhatSoup App",
            email: ENV.USER_EMAIL, // Email bạn dùng đăng ký Brevo
          },
          to: [{ email: email }],
          subject: "Mã xác nhận đăng ký tài khoản",
          htmlContent: `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2>Xin chào ${name},</h2>
              <p>Cảm ơn bạn đã đăng ký tài khoản. Đây là mã xác nhận (OTP) của bạn:</p>
              <h1 style="color: #5c40e8; letter-spacing: 5px;">${otp}</h1>
              <p>Mã này sẽ hết hạn trong vòng 5 phút.</p>
            </div>
          `,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Lỗi từ Brevo:", errorData);
        await User.findByIdAndDelete(newUser._id);
        return res
          .status(500)
          .json({ message: "Lỗi hệ thống gửi email. Vui lòng thử lại sau." });
      }
    } catch (mailError) {
      console.error("Lỗi mạng khi gọi Brevo:", mailError);
      await User.findByIdAndDelete(newUser._id);
      return res
        .status(500)
        .json({ message: "Không thể kết nối đến máy chủ gửi email." });
    }

    res.status(200).json({
      success: true,
      message: "Vui lòng kiểm tra email để lấy mã OTP",
      data: { userId: newUser._id },
      requireOtp: true,
    });
  } catch (error) {
    console.error("Lỗi sập hàm signup:", error);
    next(error);
  }
};

export const signin = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user)
      return res.status(404).json({ message: "Tài khoản không tồn tại" });

    if (!user.isVerified) {
      return res.status(401).json({
        message:
          "Tài khoản chưa được xác minh. Vui lòng đăng ký lại để nhận mã OTP.",
      });
    }

    const comparePassword = await bcrypt.compare(password, user.password);
    if (!comparePassword)
      return res.status(401).json({ message: "Sai email hoặc mật khẩu" });

    const token = jwt.sign({ userId: user._id }, ENV.JWT_SECRET, {
      expiresIn: ENV.JWT_EXPIRES_IN,
    });

    // LƯU Ý QUAN TRỌNG: Sửa sameSite thành "none" và secure thành true
    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "none",
      secure: true,
    });

    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      message: "Đăng nhập thành công",
      data: { token, user: userResponse },
    });
  } catch (error) {
    next(error);
  }
};

export const signout = async (req, res, next) => {
  try {
    res.cookie("jwt", "", {
      httpOnly: true,
      sameSite: "none",
      secure: true,
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
    const { profilePic, name, password } = req.body;
    const userId = req.user._id;
    const updateData = {};

    if (name) updateData.name = name;

    if (password) {
      if (password.length < 6)
        return res.status(400).json({ message: "Mật khẩu phải từ 6 ký tự" });
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    if (profilePic) {
      const responseUpload = await cloudinary.uploader.upload(profilePic);
      updateData.profilePic = responseUpload.secure_url;
    }

    if (Object.keys(updateData).length === 0) {
      return res
        .status(400)
        .json({ message: "Không có dữ liệu nào được cập nhật" });
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
    }).select("-password -privateKey");

    res.status(200).json({
      success: true,
      message: "Cập nhật hồ sơ thành công",
      data: updatedUser,
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
    if (!keyword) return res.status(200).json([]);

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
