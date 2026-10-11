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

    // ==========================================
    // KIỂM TRA XEM CÓ PHẢI TÀI KHOẢN TEST KHÔNG
    // ==========================================
    const isTestAccount =
      ENV.NODE_ENV !== "production" && TEST_EMAILS.includes(email);

    // CHỈ TẠO OTP NẾU LÀ NGƯỜI DÙNG THẬT
    const otp = isTestAccount
      ? null
      : Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = isTestAccount
      ? null
      : new Date(Date.now() + 5 * 60 * 1000);

    const newUser = await User.create(
      [
        {
          name,
          email,
          password: hashedPassword,
          publicKey: publicKey || "",
          isVerified: isTestAccount, // Nếu là Test Account -> Xác minh luôn
          otp: otp,
          otpExpires: otpExpires,
        },
      ],
      { session },
    );

    // ==========================================
    // PHÂN NHÁNH: TÀI KHOẢN TEST vs TÀI KHOẢN THẬT
    // ==========================================
    if (isTestAccount) {
      // NẾU LÀ TÀI KHOẢN TEST: Không gửi email, cấp quyền luôn
      await session.commitTransaction();
      session.endSession();

      console.log(`[TEST MODE]: Bỏ qua OTP cho tài khoản mới ${email}`);

      // 1. TẠO TOKEN TẠI ĐÂY (Giống cách bạn làm ở hàm login/verifyOtp)
      // Lưu ý: Nếu bạn có một hàm generateToken riêng (VD: import generateToken from '../lib/utils.js') thì hãy dùng nó.
      // Còn nếu dùng trực tiếp thư viện jsonwebtoken, bạn có thể viết như sau:
      const token = jwt.sign({ userId: newUser[0]._id }, ENV.JWT_SECRET, {
        expiresIn: "7d",
      });

      // (Tùy chọn) Nếu ứng dụng của bạn lưu Token vào Cookie:
      // res.cookie("jwt", token, { maxAge: 7 * 24 * 60 * 60 * 1000, httpOnly: true, sameSite: "strict" });

      return res.status(200).json({
        success: true,
        message: "Đăng ký thành công (Bypass OTP)",
        data: {
          userId: newUser[0]._id,
          token: token, // <--- QUAN TRỌNG: Trả về Token để Frontend lưu vào localStorage
        },
        user: newUser[0],
        requireOtp: false, // Báo cho Frontend không cần hiện form nhập OTP
      });
    }

    // NẾU LÀ TÀI KHOẢN THẬT: Gửi email bình thường
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
      requireOtp: true, // Báo cho Frontend mở form nhập OTP
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
