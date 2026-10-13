import axios from "axios";

export const axiosInstance = axios.create({
  baseURL:
    import.meta.env.MODE === "development"
      ? "http://localhost:5000/api"
      : "https://whatsoup-backend.onrender.com/api",
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
