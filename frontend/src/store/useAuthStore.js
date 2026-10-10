import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import { io } from "socket.io-client";
import { E2EE } from "../lib/E2EE.js";
import toast from "react-hot-toast";

const BASE_URL =
  import.meta.env.MODE === "development" ? "http://localhost:5000" : "/";

const keyName = (userId) => `chat-private-key-${userId}`;

export const useAuthStore = create((set, get) => ({
  onlineUsers: [],
  authUser: null,
  isCheckingAuth: true,
  isSigningUp: false,
  isSigningIn: false,
  isVerifyingOTP: false,
  socket: null,
  myPrivateKey: null,

  // Các biến tạm để lưu trữ chờ xác minh OTP
  pendingUserId: null,
  pendingPrivateKeyBase64: null,
  pendingPrivateKey: null,

  connectSocket: () => {
    const { authUser } = get();
    if (!authUser || get().socket?.connected) return;

    const socket = io(BASE_URL, {
      query: { userId: authUser._id },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 2000,
    });

    socket.on("getOnlineUsers", (ids) => set({ onlineUsers: ids }));
    socket.connect();
    set({ socket });
  },

  disconnectSocket: () => {
    if (get().socket?.connected) {
      get().socket.disconnect();
      set({ socket: null, onlineUsers: [] });
    }
  },

  checkAuth: async () => {
    try {
      const res = await axiosInstance.get("/auth/check");
      set({ authUser: res.data });
      const storedKey = localStorage.getItem(keyName(res.data._id));
      if (storedKey) {
        const privKey = await E2EE.importPrivateKey(storedKey);
        set({ myPrivateKey: privKey });
      }
      get().connectSocket();
    } catch (error) {
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      // 1. Tạo khóa RSA
      const keyPair = await E2EE.generateRSAKeyPair();
      const pubKeyBase64 = await E2EE.exportPublicKey(keyPair.publicKey);
      const privKeyBase64 = await E2EE.exportPrivateKey(keyPair.privateKey);

      const payload = { ...data, publicKey: pubKeyBase64 };

      // 2. Gọi API Đăng ký (Trả về userId thay vì token)
      const res = await axiosInstance.post("/auth/signup", payload);

      // 3. Lưu thông tin tạm thời vào State để chờ bước xác minh OTP
      set({
        pendingUserId: res.data.data.userId,
        pendingPrivateKeyBase64: privKeyBase64,
        pendingPrivateKey: keyPair.privateKey,
      });

      toast.success(
        res.data.message || "Vui lòng kiểm tra email để lấy mã OTP",
      );
      return true; // Trả về true để Component chuyển sang màn hình OTP
    } catch (error) {
      toast.error(error.response?.data?.message || "Lỗi đăng ký");
      return false;
    } finally {
      set({ isSigningUp: false });
    }
  },

  verifyOTP: async (otp) => {
    set({ isVerifyingOTP: true });
    try {
      const { pendingUserId, pendingPrivateKeyBase64, pendingPrivateKey } =
        get();
      if (!pendingUserId)
        throw new Error("Không tìm thấy thông tin chờ xác minh.");

      // 1. Gửi OTP lên server
      const res = await axiosInstance.post("/auth/verify-otp", {
        userId: pendingUserId,
        otp,
      });

      const user = res.data.data.user;
      const token = res.data.data.token;

      // 2. Lưu token và Khóa bí mật (chỉ thực hiện khi đã verify thành công)
      localStorage.setItem("chat-token", token);
      localStorage.setItem(keyName(user._id), pendingPrivateKeyBase64);

      // 3. Cập nhật State và xóa dữ liệu tạm
      set({
        authUser: user,
        myPrivateKey: pendingPrivateKey,
        pendingUserId: null,
        pendingPrivateKeyBase64: null,
        pendingPrivateKey: null,
      });

      get().connectSocket();
      toast.success("Xác minh tài khoản thành công!");
      return true;
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Mã OTP không hợp lệ hoặc đã hết hạn",
      );
      return false;
    } finally {
      set({ isVerifyingOTP: false });
    }
  },

  signin: async (data) => {
    set({ isSigningIn: true });
    try {
      const res = await axiosInstance.post("/auth/signin", data);
      localStorage.setItem("chat-token", res.data.data.token);
      set({ authUser: res.data.data.user });
      const storedKey = localStorage.getItem(keyName(res.data.data.user._id));
      if (storedKey) {
        const privKey = await E2EE.importPrivateKey(storedKey);
        set({ myPrivateKey: privKey });
      }
      get().connectSocket();
      toast.success("Đăng nhập thành công!");
    } catch (error) {
      toast.error(error.response?.data?.message || "Lỗi đăng nhập");
    } finally {
      set({ isSigningIn: false });
    }
  },

  signout: async () => {
    try {
      await axiosInstance.post("/auth/signout");
      localStorage.removeItem("chat-token");
      set({ authUser: null, myPrivateKey: null });
      get().disconnectSocket();
    } catch (error) {
      toast.error(error.response?.data?.message || "Lỗi đăng xuất");
    }
  },
}));
