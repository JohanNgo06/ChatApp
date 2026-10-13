import axios from "axios";

export const axiosInstance = axios.create({
  // THAY THẾ bằng đúng URL Backend Render của bạn
  baseURL: "https://whatsoup-backend.onrender.com/api",
  withCredentials: true, // Quan trọng: Yêu cầu trình duyệt gửi kèm Cookie
});

axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("chat-token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);
