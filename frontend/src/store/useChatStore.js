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
  messages: [],
  contacts: [],
  selectedUser: null,
  isMessagesLoading: false,
  isContactsLoading: false,

  setSelectedUser: (selectedUser) => set({ selectedUser }),

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
            plainText = "🔒 [Tin nhắn cũ không thể giải mã]";
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

      set({ messages: decryptedMessages });
    } catch (error) {
      console.log("Lỗi lấy tin nhắn:", error);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async (messageData) => {
    try {
      const { messages, selectedUser } = get();
      let payloadToSend = { text: messageData.text, image: messageData.image };

      if (selectedUser.publicKey) {
        const { authUser, myPrivateKey } = useAuthStore.getState();

        // Đóng gói ảnh và chữ
        const combinedPayload = JSON.stringify({
          text: messageData.text || "",
          image: messageData.image || "",
        });

        // Xuất Private Key đang lưu ra dạng Base64 để đem đi ký số
        const myPrivateKeyBase64 = await E2EE.exportPrivateKey(myPrivateKey);

        const encryptedData = await E2EE.encryptMessage(
          combinedPayload,
          selectedUser.publicKey,
          authUser.publicKey,
          myPrivateKeyBase64, // <-- Bơm khóa vào đây để ký
        );

        payloadToSend = { ...encryptedData, image: "" };
      }

      const res = await axiosInstance.post(
        `/messages/send/${messageData.receiverId}`,
        payloadToSend,
      );

      const newMessageForMe = {
        ...res.data,
        text: messageData.text,
        image: messageData.image,
      };
      set({ messages: [...messages, newMessageForMe] });
    } catch (error) {
      console.log("Lỗi gửi tin nhắn:", error);
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
          const decryptedString = await E2EE.decryptMessage(
            newMessage,
            myPrivateKey,
            senderPubKey,
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
