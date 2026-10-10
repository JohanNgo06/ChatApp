import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import { useAuthStore } from "./useAuthStore.js";
import { E2EE, buf2base64 } from "../lib/E2EE.js"; // Import thêm buf2base64
import { E2EE, buf2base64 } from "../lib/E2EE.js"; // Import thêm buf2base64

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
  isTyping: false,
  isTyping: false,

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
          // BỎ QUA GIẢI MÃ NẾU ĐÂY LÀ TIN NHẮN FILE (Sẽ giải mã khi user bấm Tải xuống)
          if (msg.fileUrl) {
            return msg;
          }

          // BỎ QUA GIẢI MÃ NẾU ĐÂY LÀ TIN NHẮN FILE (Sẽ giải mã khi user bấm Tải xuống)
          if (msg.fileUrl) {
            return msg;
          }

          const isMe = msg.senderId === authUser._id;
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

  sendMessage: async ({ text, image, file, receiverId }) => {
  sendMessage: async ({ text, image, file, receiverId }) => {
    const { selectedUser } = get();
    if (!selectedUser) return false;
    set({ sendError: null });


    try {
      let success = true;
      const { authUser, myPrivateKey } = useAuthStore.getState();

      if (!myPrivateKey && selectedUser.publicKey) {
        set({
          sendError:
            "Trình duyệt này không có khóa riêng của bạn nên không thể mã hóa tin nhắn.",
        });
        return false;
      }
      let success = true;
      const { authUser, myPrivateKey } = useAuthStore.getState();

      if (!myPrivateKey && selectedUser.publicKey) {
        set({
          sendError:
            "Trình duyệt này không có khóa riêng của bạn nên không thể mã hóa tin nhắn.",
        });
        return false;
      }

      // ==========================================
      // 1. NẾU CÓ FILE -> MÃ HÓA VÀ GỬI THÀNH 1 TIN NHẮN RIÊNG
      // ==========================================
      if (file && selectedUser.publicKey) {
        const myPrivateKeyBase64 = await E2EE.exportPrivateKey(myPrivateKey);

        console.log(`[FILE] Bắt đầu mã hóa file: ${file.name}`);
        const encryptedFile = await E2EE.encryptFile(
          file.buffer,
          selectedUser.publicKey,
          authUser.publicKey,
          myPrivateKeyBase64,
        );

        const payloadToSend = {
          fileBase64: encryptedFile.fileBase64,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          encryptedAesKey: encryptedFile.encryptedAesKey,
          senderEncryptedAesKey: encryptedFile.senderEncryptedAesKey,
          iv: encryptedFile.iv,
          shaHash: encryptedFile.shaHash,
        };

        const res = await axiosInstance.post(
          `/messages/send/${receiverId}`,
          payloadToSend,
        );
        if (get().selectedUser?._id === receiverId) {
          set({ messages: [...get().messages, res.data] });
        }
      }

      // ==========================================
      // 2. NẾU CÓ TEXT / IMAGE -> GỬI THÊM 1 TIN NHẮN
      // ==========================================
      if (text || image) {
        let payloadToSend = { text, image };

        if (selectedUser.publicKey) {
          const combinedPayload = JSON.stringify({
            text: text || "",
            image: image || "",
          });
          const myPrivateKeyBase64 = await E2EE.exportPrivateKey(myPrivateKey);
      // ==========================================
      // 1. NẾU CÓ FILE -> MÃ HÓA VÀ GỬI THÀNH 1 TIN NHẮN RIÊNG
      // ==========================================
      if (file && selectedUser.publicKey) {
        const myPrivateKeyBase64 = await E2EE.exportPrivateKey(myPrivateKey);

        console.log(`[FILE] Bắt đầu mã hóa file: ${file.name}`);
        const encryptedFile = await E2EE.encryptFile(
          file.buffer,
          selectedUser.publicKey,
          authUser.publicKey,
          myPrivateKeyBase64,
        );

        const payloadToSend = {
          fileBase64: encryptedFile.fileBase64,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          encryptedAesKey: encryptedFile.encryptedAesKey,
          senderEncryptedAesKey: encryptedFile.senderEncryptedAesKey,
          iv: encryptedFile.iv,
          shaHash: encryptedFile.shaHash,
        };

        const res = await axiosInstance.post(
          `/messages/send/${receiverId}`,
          payloadToSend,
        );
        if (get().selectedUser?._id === receiverId) {
          set({ messages: [...get().messages, res.data] });
        }
      }

      // ==========================================
      // 2. NẾU CÓ TEXT / IMAGE -> GỬI THÊM 1 TIN NHẮN
      // ==========================================
      if (text || image) {
        let payloadToSend = { text, image };

        if (selectedUser.publicKey) {
          const combinedPayload = JSON.stringify({
            text: text || "",
            image: image || "",
          });
          const myPrivateKeyBase64 = await E2EE.exportPrivateKey(myPrivateKey);

          const encryptedData = await E2EE.encryptMessage(
            combinedPayload,
            selectedUser.publicKey,
            authUser.publicKey,
            myPrivateKeyBase64,
          );
          const encryptedData = await E2EE.encryptMessage(
            combinedPayload,
            selectedUser.publicKey,
            authUser.publicKey,
            myPrivateKeyBase64,
          );

          payloadToSend = { ...encryptedData, image: "" };
        }

        const res = await axiosInstance.post(
          `/messages/send/${receiverId}`,
          payloadToSend,
        );
        if (get().selectedUser?._id === receiverId) {
          set({ messages: [...get().messages, { ...res.data, text, image }] });
        }
          payloadToSend = { ...encryptedData, image: "" };
        }

        const res = await axiosInstance.post(
          `/messages/send/${receiverId}`,
          payloadToSend,
        );
        if (get().selectedUser?._id === receiverId) {
          set({ messages: [...get().messages, { ...res.data, text, image }] });
        }
      }

      return success;

      return success;
    } catch (error) {
      set({
        sendError: error.response?.data?.message || "Gửi tin nhắn thất bại",
      });
      return false;
    }
  },

  // ==========================================
  // HÀM TẢI VÀ GIẢI MÃ FILE KHI USER BẤM NÚT
  // ==========================================
  downloadFile: async (msg) => {
    try {
      const { authUser, myPrivateKey } = useAuthStore.getState();
      const { selectedUser } = get();

      const isMe = msg.senderId === authUser._id;
      const senderPubKey = isMe ? authUser.publicKey : selectedUser.publicKey;

      // 1. Tải file đã mã hóa từ Cloudinary dưới dạng nhị phân (Buffer)
      const response = await fetch(msg.fileUrl);
      const buffer = await response.arrayBuffer();

      // 2. Chuyển thành Base64 để đưa vào hàm giải mã
      const fileBase64 = buf2base64(buffer);
      const encryptedPayload = {
        fileBase64: fileBase64,
        encryptedAesKey: isMe ? msg.senderEncryptedAesKey : msg.encryptedAesKey,
        iv: msg.iv,
        shaHash: msg.shaHash,
      };

      // 3. Giải mã bằng khóa Private
      const decryptedBuffer = await E2EE.decryptFile(
        encryptedPayload,
        myPrivateKey,
        senderPubKey,
      );

      if (!decryptedBuffer) {
        throw new Error("Lỗi giải mã hoặc Chữ ký số không hợp lệ.");
      }

      // 4. Tạo URL để trình duyệt tự động tải xuống
      const blob = new Blob([decryptedBuffer], {
        type: msg.fileType || "application/octet-stream",
      });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error("Lỗi tải/giải mã file:", error);
      return null;
    }
  },

  // ==========================================
  // HÀM TẢI VÀ GIẢI MÃ FILE KHI USER BẤM NÚT
  // ==========================================
  downloadFile: async (msg) => {
    try {
      const { authUser, myPrivateKey } = useAuthStore.getState();
      const { selectedUser } = get();

      const isMe = msg.senderId === authUser._id;
      const senderPubKey = isMe ? authUser.publicKey : selectedUser.publicKey;

      // 1. Tải file đã mã hóa từ Cloudinary dưới dạng nhị phân (Buffer)
      const response = await fetch(msg.fileUrl);
      const buffer = await response.arrayBuffer();

      // 2. Chuyển thành Base64 để đưa vào hàm giải mã
      const fileBase64 = buf2base64(buffer);
      const encryptedPayload = {
        fileBase64: fileBase64,
        encryptedAesKey: isMe ? msg.senderEncryptedAesKey : msg.encryptedAesKey,
        iv: msg.iv,
        shaHash: msg.shaHash,
      };

      // 3. Giải mã bằng khóa Private
      const decryptedBuffer = await E2EE.decryptFile(
        encryptedPayload,
        myPrivateKey,
        senderPubKey,
      );

      if (!decryptedBuffer) {
        throw new Error("Lỗi giải mã hoặc Chữ ký số không hợp lệ.");
      }

      // 4. Tạo URL để trình duyệt tự động tải xuống
      const blob = new Blob([decryptedBuffer], {
        type: msg.fileType || "application/octet-stream",
      });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error("Lỗi tải/giải mã file:", error);
      return null;
    }
  },

  subscribeToMessages: () => {
    const { selectedUser } = get();
    if (!selectedUser) return;
    const socket = useAuthStore.getState().socket;
    if (!socket) return;

    socket.on("newMessage", async (newMessage) => {
      set({ isTyping: false }); // Tắt typing

      if (newMessage.senderId === selectedUser._id) {
        if (newMessage.fileUrl) {
          set({ messages: [...get().messages, newMessage] });
          // Báo cho server tin nhắn File đã được đọc
          socket.emit("markMessageAsRead", {
            messageId: newMessage._id,
            senderId: newMessage.senderId,
          });
          return;
        }

        const { myPrivateKey } = useAuthStore.getState();
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

        // THÊM: Báo cho server tin nhắn Text/Ảnh đã được đọc ngay lập tức vì đang mở đoạn chat
        socket.emit("markMessageAsRead", {
          messageId: newMessage._id,
          senderId: newMessage.senderId,
        });
      }
    });

    // Lắng nghe người kia đang gõ phím
    socket.on("userTyping", ({ senderId }) => {
      if (get().selectedUser?._id === senderId) set({ isTyping: true });
    });
    socket.on("userStoppedTyping", ({ senderId }) => {
      if (get().selectedUser?._id === senderId) set({ isTyping: false });
    });

    // ==========================================
    // THÊM LẮNG NGHE SỰ KIỆN "ĐÃ XEM"
    // ==========================================
    socket.on("messageRead", ({ messageId }) => {
      // Cập nhật 1 tin nhắn
      set({
        messages: get().messages.map((msg) =>
          msg._id === messageId ? { ...msg, isRead: true } : msg,
        ),
      });
    });

    socket.on("messagesReadBulk", () => {
      // Cập nhật TOÀN BỘ tin nhắn của mình thành Đã xem (khi người kia mở khung chat)
      set({
        messages: get().messages.map((msg) => ({ ...msg, isRead: true })),
      });
    });
  },

  unsubscribeFromMessages: () => {
    const socket = useAuthStore.getState().socket;
    if (socket) {
      socket.off("newMessage");
      socket.off("userTyping");
      socket.off("userStoppedTyping");
      socket.off("messageRead"); // NHỚ TẮT
      socket.off("messagesReadBulk"); // NHỚ TẮT
    }
  },
}));
