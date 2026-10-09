import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import { useAuthStore } from "./useAuthStore";
import toast from "react-hot-toast";

const errMsg = (e) => e.response?.data?.message || e.message;

export const useFriendStore = create((set, get) => ({
  friends: [],
  requests: [],
  suggestions: [],
  searchResults: [],
  isLoading: true,
  isSearching: false,
  error: null,

  fetchAll: async () => {
    set({ isLoading: true, error: null });
    try {
      const [friends, requests, suggestions] = await Promise.all([
        axiosInstance.get("/friends/list"),
        axiosInstance.get("/friends/requests"),
        axiosInstance.get("/friends/suggestions"),
      ]);
      set({
        friends: friends.data,
        requests: requests.data,
        suggestions: suggestions.data,
      });
    } catch (e) {
      set({ error: errMsg(e) });
    } finally {
      set({ isLoading: false });
    }
  },

  searchUsers: async (q) => {
    if (!q.trim()) return set({ searchResults: [] });
    set({ isSearching: true, error: null });
    try {
      const res = await axiosInstance.get("/friends/search", { params: { q } });
      set({ searchResults: res.data });
    } catch (e) {
      set({ error: errMsg(e) });
    } finally {
      set({ isSearching: false });
    }
  },

  clearSearch: () => set({ searchResults: [] }),

  sendRequest: async (userId) => {
    try {
      await axiosInstance.post(`/friends/request/${userId}`);
      // Bỏ người đó khỏi gợi ý và kết quả tìm kiếm
      set({
        suggestions: get().suggestions.filter((u) => u._id !== userId),
        searchResults: get().searchResults.filter((u) => u._id !== userId),
      });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  acceptRequest: async (requestId) => {
    try {
      await axiosInstance.post(`/friends/accept/${requestId}`);
      const req = get().requests.find((r) => r._id === requestId);
      set({
        requests: get().requests.filter((r) => r._id !== requestId),
        friends: req ? [req.sender, ...get().friends] : get().friends,
      });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  rejectRequest: async (requestId) => {
    try {
      await axiosInstance.delete(`/friends/reject/${requestId}`);
      set({ requests: get().requests.filter((r) => r._id !== requestId) });
    } catch (e) {
      set({ error: errMsg(e) });
    }
  },

  subscribeToFriendEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    // Lắng nghe: Có người gửi lời mời kết bạn
    socket.on("newFriendRequest", (newRequest) => {
      set((state) => ({
        requests: [newRequest, ...state.requests],
      }));
      toast.success(`Bạn có lời mời kết bạn mới!`);
    });

    // Lắng nghe: Có người vừa đồng ý kết bạn với bạn
    socket.on("friendRequestAccepted", (newFriend) => {
      set((state) => ({
        friends: [...state.friends, newFriend],
      }));
      toast.success(`${newFriend.name} đã chấp nhận kết bạn!`);
    });
  },

  unsubscribeFromFriendEvents: () => {
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.off("newFriendRequest");
    socket.off("friendRequestAccepted");
  },
}));
