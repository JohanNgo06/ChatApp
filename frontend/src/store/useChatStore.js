import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import { useAuthStore } from "./useAuthStore.js";
import { E2EE } from "../lib/E2EE.js";

// Hàm tách JSON sau khi giải mã
const parseDecryptedPayload = (decryptedString, originalImage) => {
  try {
    const parsed = JSON.parse(decryptedString);
    if (parsed.text !== undefined || parsed.image !== undefined) {
      return { text: parsed.text, image: parsed.image };
    }
  } catch (error) {
    console.error(error.messages);
  }
  return { text: decryptedString, image: originalImage };
};

export const useChatStore = create((set, get) => ({
  sendError: null,
  messages: [],
  contacts: [],
  selectedUser: null,
  isMessagesLoading: false,
  isContactsLoading: false,

  setSelectedUser: (selectedUser) =>
    set({ selectedUser, messages: [], sendError: null }),

  getContacts: async () => {
    set({ isContactsLoading: true });
    try {
      const res = await axiosInstance.get("/messages/users");
      set({ contacts: res.data });
    } catch (error) {
      console.log("Lỗi lấy danh sách bạn bè:", error);
    } finally {
      set({ isContactsLoading: false });
    }
  },

  getMessages: async (userId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userId}`);
      const rawMessages = res.data;
      const { authUser, myPrivateKey } = useAuthStore.getState();

      const decryptedMessages = await Promise.all(
        rawMessages.map(async (msg) => {
          const isMe = msg.senderId === authUser._id;

          // Lấy Public Key của người gửi để xác thực chữ ký
          const senderPubKey = isMe
            ? authUser.publicKey
            : get().selectedUser.publicKey;

          let plainText = msg.text;
          let finalImage = msg.image;

          if (isMe && msg.senderEncryptedAesKey && myPrivateKey) {
            const fakeMsgObj = {
              ...msg,
              encryptedAesKey: msg.senderEncryptedAesKey,
            };
            const decryptedString = await E2EE.decryptMessage(
              fakeMsgObj,
              myPrivateKey,
              senderPubKey,
            );
            const parsed = parseDecryptedPayload(decryptedString, msg.image);
            plainText = parsed.text;
            finalImage = parsed.image;
          } else if (
            isMe &&
            msg.encryptedAesKey &&
            !msg.senderEncryptedAesKey
          ) {
            plainText = "[Tin nhắn cũ không thể giải mã]";
          } else if (!isMe && msg.encryptedAesKey && myPrivateKey) {
            const decryptedString = await E2EE.decryptMessage(
              msg,
              myPrivateKey,
              senderPubKey,
            );
            const parsed = parseDecryptedPayload(decryptedString, msg.image);
            plainText = parsed.text;
            finalImage = parsed.image;
          }

          return { ...msg, text: plainText, image: finalImage };
        }),
      );
      if (get().selectedUser?._id !== userId) return;
      set({ messages: decryptedMessages });
    } catch (error) {
      console.log("Lỗi lấy tin nhắn:", error);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async ({ text, image, receiverId }) => {
    const { selectedUser } = get();
    if (!selectedUser) return false;
    set({ sendError: null });
    try {
      let payloadToSend = { text, image };

      if (selectedUser.publicKey) {
        const { authUser, myPrivateKey } = useAuthStore.getState();
        if (!myPrivateKey) {
          set({
            sendError:
              "Trình duyệt này không có khóa riêng của bạn nên không thể mã hóa tin nhắn.",
          });
          return false;
        }

        const combinedPayload = JSON.stringify({
          text: text || "",
          image: image || "",
        });
        const myPrivateKeyBase64 = await E2EE.exportPrivateKey(myPrivateKey);

        const startEncryptTime = performance.now();
        const encryptedData = await E2EE.encryptMessage(
          combinedPayload,
          selectedUser.publicKey,
          authUser.publicKey,
          myPrivateKeyBase64,
        );
        const endEncryptTime = performance.now();

        payloadToSend = { ...encryptedData, image: "" };

        // 2. ĐO KÍCH THƯỚC DỮ LIỆU (TÍNH BẰNG KILOBYTE)
        const originalSize = new Blob([combinedPayload]).size;
        const encryptedSize = new Blob([JSON.stringify(payloadToSend)]).size;

        // IN KẾT QUẢ RA CONSOLE (F12)
        console.log("========================================");
        console.log(
          `[THỜI GIAN] Mã hóa & Ký số: ${(endEncryptTime - startEncryptTime).toFixed(2)} ms`,
        );
        console.log(
          `[KÍCH THƯỚC] Bản rõ gốc: ${(originalSize / 1024).toFixed(2)} KB`,
        );
        console.log(
          `[KÍCH THƯỚC] Bản mã gửi đi: ${(encryptedSize / 1024).toFixed(2)} KB`,
        );
        console.log(
          `[ĐÁNH GIÁ] Tỷ lệ phình to dữ liệu: ${((encryptedSize / originalSize) * 100).toFixed(2)}%`,
        );
        console.log("========================================");
      }
      const res = await axiosInstance.post(
        `/messages/send/${receiverId}`,
        payloadToSend,
      );

      if (get().selectedUser?._id === receiverId) {
        set({ messages: [...get().messages, { ...res.data, text, image }] });
      }
      return true;
    } catch (error) {
      set({
        sendError: error.response?.data?.message || "Gửi tin nhắn thất bại",
      });
      return false;
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("newMessage", async (newMessage) => {
      if (newMessage.senderId === selectedUser._id) {
        const { myPrivateKey } = useAuthStore.getState();

        // Lấy Public Key của đối phương để xác thực
        const senderPubKey = selectedUser.publicKey;

        let plainText = newMessage.text;
        let finalImage = newMessage.image;

        if (newMessage.encryptedAesKey && myPrivateKey) {
          // BẮT ĐẦU ĐO THỜI GIAN GIẢI MÃ
          const startDecryptTime = performance.now();

          const decryptedString = await E2EE.decryptMessage(
            newMessage,
            myPrivateKey,
            senderPubKey,
          );

          // KẾT THÚC ĐO THỜI GIAN
          const endDecryptTime = performance.now();
          console.log(
            `⏱️ [THỜI GIAN] Giải mã & Xác thực chữ ký: ${(endDecryptTime - startDecryptTime).toFixed(2)} ms`,
          );

          const parsed = parseDecryptedPayload(
            decryptedString,
            newMessage.image,
          );
          plainText = parsed.text;
          finalImage = parsed.image;
        }

        const decryptedMessage = {
          ...newMessage,
          text: plainText,
          image: finalImage,
        };
        set({ messages: [...get().messages, decryptedMessage] });
      }
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("newMessage");
    }
  },
}));
