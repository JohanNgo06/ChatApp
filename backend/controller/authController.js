import User from "../model/userModel.js";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { ENV } from "../lib/env.js";
import cloudinary from "../lib/cloudinary.js";
import nodemailer from "nodemailer";

// Khởi tạo dịch vụ Nodemailer để hệ thống tự động gửi email
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

    // Bước 1: Tìm người dùng trong Database dựa vào ID gửi lên
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy người dùng" });

    // Bước 2: Chặn xác minh lại nếu tài khoản đã được active trước đó
    if (user.isVerified)
      return res.status(400).json({ message: "Tài khoản đã được xác minh" });

    // Bước 3: So khớp mã OTP và kiểm tra thời gian (OTP chỉ sống 5 phút)
    if (user.otp !== otp)
      return res.status(400).json({ message: "Mã OTP không chính xác" });
    if (user.otpExpires < new Date())
      return res.status(400).json({ message: "Mã OTP đã hết hạn" });

    // Bước 4: Hợp lệ -> Chuyển trạng thái xác minh thành true
    user.isVerified = true;

    // Bước 5 (Quan trọng): Xóa sạch OTP khỏi Database để hacker không thể dùng lại mã này
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();

    // Bước 6: Định danh phiên đăng nhập bằng cách tạo JWT Token
    const token = jwt.sign({ userId: user._id }, ENV.JWT_SECRET, {
      expiresIn: ENV.JWT_EXPIRES_IN,
    });

    // Bước 7: Trả Token về Frontend qua HTTP-Only Cookie (Bảo mật hơn localStorage vì chống được tấn công XSS)
    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "strict",
      secure: ENV.NODE_ENV !== "development",
    });

    // Bước 8: Xóa trường password trước khi trả cục data user về cho Frontend hiển thị
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
  // Bước 1: Khởi tạo Transaction (Đảm bảo nếu lỗi giữa chừng thì Rollback toàn bộ, không tạo ra data rác)
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { name, email, password, publicKey } = req.body;

    // Bước 2: Validate dữ liệu đầu vào (Không được rỗng, độ dài MK, định dạng Email)
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

    // Bước 3: Kiểm tra xem Email đã tồn tại trong hệ thống chưa
    const isExists = await User.findOne({ email });
    if (isExists) {
      // Logic xử lý linh hoạt: Nếu mail có rồi nhưng CHƯA xác minh OTP -> Xóa cho họ đăng ký lại. Nếu xác minh rồi -> Báo lỗi trùng.
      if (!isExists.isVerified) {
        await User.findByIdAndDelete(isExists._id);
      } else {
        return res.status(400).json({ message: "Email đã được sử dụng" });
      }
    }

    // Bước 4: Bảo mật Mật khẩu bằng thuật toán Bcrypt (Tạo Salt ngẫu nhiên và băm qua 1024 vòng lặp)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Bước 5: Kiểm tra Tài khoản Test để bỏ qua luồng OTP nếu cần
    const isTestAccount =
      ENV.NODE_ENV !== "production" && TEST_EMAILS.includes(email);

    // Bước 6: Random ra 6 số OTP tự nhiên và set thời hạn 5 phút
    const otp = isTestAccount
      ? null
      : Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = isTestAccount
      ? null
      : new Date(Date.now() + 5 * 60 * 1000);

    // Bước 7: Lưu User vào DB (Chạy ngầm trong Session Transaction)
    const newUser = await User.create(
      [
        {
          name,
          email,
          password: hashedPassword, // Chỉ lưu mã băm, không lưu text gốc
          publicKey: publicKey || "",
          isVerified: isTestAccount,
          otp: otp,
          otpExpires: otpExpires,
        },
      ],
      { session },
    );

    // Bước 8A: Nếu là tài khoản Test -> Commit lưu DB luôn, cấp JWT Token và dừng hàm tại đây
    if (isTestAccount) {
      await session.commitTransaction();
      session.endSession();

      const token = jwt.sign({ userId: newUser[0]._id }, ENV.JWT_SECRET, {
        expiresIn: "7d",
      });

      return res.status(200).json({
        success: true,
        message: "Đăng ký thành công (Bypass OTP)",
        data: {
          userId: newUser[0]._id,
          token: token,
        },
        user: newUser[0],
        requireOtp: false,
      });
    }

    // Bước 8B: Nếu là tài khoản thực -> Định dạng giao diện Email (HTML) chứa mã OTP
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

    // Bước 9: Gọi hàm gửi mail. Đợi mail gửi thành công thì mới Commit lưu dữ liệu vào DB
    await transporter.sendMail(mailOptions);
    await session.commitTransaction();
    session.endSession();

    // Bước 10: Trả về cho Frontend tín hiệu "requireOtp: true" để Frontend mở màn hình nhập OTP
    res.status(200).json({
      success: true,
      message: "Vui lòng kiểm tra email để lấy mã OTP",
      data: { userId: newUser[0]._id },
      requireOtp: true,
    });
  } catch (error) {
    // Nếu có lỗi (VD: Rớt mạng không gửi được mail) -> Hủy bỏ Transaction, data user sẽ không bị lưu vào DB
    await session.abortTransaction();
    session.endSession();
    next(error);
  }
};

export const signin = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Bước 1: Tìm User theo email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Tài khoản không tồn tại" });
    }

    // Bước 2: Chặn đứng luồng đăng nhập nếu tài khoản đó trước đây đăng ký nhưng chưa nhập OTP xác thực
    if (!user.isVerified) {
      return res.status(401).json({
        message:
          "Tài khoản chưa được xác minh. Vui lòng đăng ký lại để nhận mã OTP.",
      });
    }

    // Bước 3: Đối chiếu mật khẩu (Lấy MK người dùng nhập băm ra rồi so sánh với mã băm trong Database)
    const comparePassword = await bcrypt.compare(password, user.password);
    if (!comparePassword) {
      return res.status(401).json({ message: "Sai email hoặc mật khẩu" });
    }

    // Bước 4: Mật khẩu đúng -> Cấp JWT Token
    const token = jwt.sign({ userId: user._id }, ENV.JWT_SECRET, {
      expiresIn: ENV.JWT_EXPIRES_IN,
    });

    // Bước 5: Gắn JWT Token vào HTTP-Only Cookie
    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "strict",
      secure: ENV.NODE_ENV !== "development",
    });

    // Bước 6: Xóa trường mật khẩu trước khi gửi dữ liệu về client
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
    // Để đăng xuất, đơn giản là set lại Cookie JWT thành rỗng và cho thời gian sống (expires) về mốc 0 -> Trình duyệt tự xóa
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
    const { profilePic, name, password } = req.body;
    const userId = req.user._id;

    const updateData = {}; // Object chứa các trường có thay đổi

    // Bước 1: Nếu người dùng có truyền Tên mới lên -> Gắn vào object
    if (name) {
      updateData.name = name;
    }

    // Bước 2: Nếu người dùng muốn đổi mật khẩu -> Validate độ dài, sau đó vẫn phải mã hóa Bcrypt y như lúc Đăng ký
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: "Mật khẩu phải từ 6 ký tự" });
      }
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }

    // Bước 3: Nếu có up ảnh đại diện mới -> Upload file ảnh (Base64) lên Cloudinary (đám mây) và lấy URL ảnh dán vào object update
    if (profilePic) {
      const responseUpload = await cloudinary.uploader.upload(profilePic);
      updateData.profilePic = responseUpload.secure_url;
    }

    // Nếu object trống (người dùng bấm cập nhật nhưng chả điền gì)
    if (Object.keys(updateData).length === 0) {
      return res
        .status(400)
        .json({ message: "Không có dữ liệu nào được cập nhật" });
    }

    // Bước 4: Gọi lệnh update của Mongoose để cập nhật DB, trả về data mới nhất (-password -privateKey để bảo mật)
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
    // API gọi mỗi khi F5 trang để kiểm tra user còn đăng nhập hay không. (Đã được Middleware chạy qua xác thực JWT trước đó)
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

    // Bước 1: Lọc User khác với bản thân mình ($ne: currentUserId)
    // Bước 2: Dùng Regex (Biểu thức chính quy) để tìm theo "Tên" HOẶC ($or) "Email"
    // Tham số $options: "i" có nghĩa là tìm kiếm không phân biệt chữ hoa/chữ thường.
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
