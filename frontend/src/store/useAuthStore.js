import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import { io } from "socket.io-client";
import { E2EE } from "../lib/E2EE.js";

const BASE_URL =
  import.meta.env.MODE === "development" ? "http://localhost:5000" : "/";

const keyName = (userId) => `chat-private-key-${userId}`;

export const useAuthStore = create((set, get) => ({
  onlineUsers: [],
  authUser: null,
  isCheckingAuth: true,
  isSigningUp: false,
  isSigningIn: false,
  socket: null,
  myPrivateKey: null,

  connectSocket: () => {
    const { authUser } = get();
    // Nếu chưa đăng nhập hoặc socket đã kết nối rồi thì không tạo thêm
    if (!authUser || get().socket?.connected) return;

    const socket = io(BASE_URL, {
      query: {
        userId: authUser._id,
      },
      // THÊM ĐOẠN CẤU HÌNH NÀY ĐỂ TRỊ LỖI CỦA RENDER FREE:
      transports: ["websocket"], // Ép buộc dùng chuẩn WebSocket nhanh nhất, cấm lùi về Long-Polling
      reconnection: true, // Cho phép tự động kết nối lại khi bị Render ngắt
      reconnectionAttempts: 15, // Cố gắng kết nối lại tối đa 15 lần
      reconnectionDelay: 2000, // Mỗi lần thử cách nhau 2 giây
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
      console.log("Error in auth check: ", error);
      set({ authUser: null });
    } finally {
      set({ isCheckingAuth: false });
    }
  },

  signup: async (data) => {
    set({ isSigningUp: true });
    try {
      // [E2EE] 1. Tự động đúc 1 cặp khóa RSA
      const keyPair = await E2EE.generateRSAKeyPair();
      const pubKeyBase64 = await E2EE.exportPublicKey(keyPair.publicKey);
      const privKeyBase64 = await E2EE.exportPrivateKey(keyPair.privateKey);

      // [E2EE] 2. Gắn Public Key vào data để tạo payload gửi lên Server
      const payload = { ...data, publicKey: pubKeyBase64 };

      // 3. Gọi API Đăng ký
      const res = await axiosInstance.post("/auth/signup", payload);

      // 4. Lấy dữ liệu trả về từ server
      const user = res.data.data.user;
      const token = res.data.data.token;

      // 5. Lưu thông tin vào LocalStorage
      localStorage.setItem("chat-token", token); // Lưu token để giữ đăng nhập
      localStorage.setItem(keyName(user._id), privKeyBase64); // Lưu khóa bí mật E2EE

      // 6. Cập nhật trạng thái (State) của ứng dụng
      set({ authUser: user, myPrivateKey: keyPair.privateKey });

      // 7. Kết nối Socket
      get().connectSocket();

      console.log("Đăng ký thành công!");
    } catch (error) {
      console.log(
        "Lỗi đăng ký:",
        error.response?.data?.message || error.message,
      );
      // Nếu bạn có dùng thư viện toast, bạn có thể thêm: toast.error(error.response?.data?.message) ở đây
    } finally {
      set({ isSigningUp: false });
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
      console.log("Đăng nhập thành công!");
    } catch (error) {
      console.log(
        "Lỗi đăng nhập:",
        error.response?.data?.message || error.message,
      );
    } finally {
      set({ isSigningIn: false });
    }
  },

  signout: async () => {
    try {
      // Vẫn gọi API signout để Backend xóa Cookie (nếu bạn có dùng)
      await axiosInstance.post("/auth/signout");
      localStorage.removeItem("chat-token");
      set({ authUser: null, myPrivateKey: null });
      get().disconnectSocket();
      console.log("Đăng xuất thành công!");
    } catch (error) {
      console.log(
        "Lỗi đăng xuất:",
        error.response?.data?.message || error.message,
      );
    }
  },
}));
