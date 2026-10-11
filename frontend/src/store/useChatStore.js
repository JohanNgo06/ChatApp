import { create } from "zustand";
import { axiosInstance } from "../lib/axios.js";
import { useAuthStore } from "./useAuthStore.js";
import { E2EE, buf2base64 } from "../lib/E2EE.js";

// =========================================
// HELPER FUNCTIONS
// =========================================

// Hàm tách JSON sau khi giải mã
const parseDecryptedPayload = (decryptedString, originalImage) => {
  try {
    const parsed = JSON.parse(decryptedString);
    if (parsed.text !== undefined || parsed.image !== undefined) {
      return { text: parsed.text, image: parsed.image };
    }
  } catch (error) {
    console.error(error);
  }
  return { text: decryptedString, image: originalImage };
};

// Hàm tìm đúng AES Key cho người đang mở màn hình (Hỗ trợ cả Group và 1-1)
const extractMyAesKey = (msg, myUserId, isMe) => {
  if (msg.groupEncryptedKeys && msg.groupEncryptedKeys[myUserId]) {
    // Nếu là chat nhóm, lấy Key trong Map của mình
    return msg.groupEncryptedKeys[myUserId];
  } else if (isMe && msg.senderEncryptedAesKey) {
    // 1-1, là người gửi tự đọc lại tin nhắn của mình
    return msg.senderEncryptedAesKey;
  } else if (!isMe && msg.encryptedAesKey) {
    // 1-1, là người nhận đọc tin nhắn
    return msg.encryptedAesKey;
  }
  return null;
};

// Hàm tìm Public Key của người gửi (Hỗ trợ cả Group và 1-1)
const findSenderPublicKey = (msgSenderIdStr, isMe, selectedUser, authUser) => {
  if (selectedUser.isGroupChat) {
    // Trong chat nhóm, tìm user trong mảng participants
    const sender = selectedUser.participants?.find(
      (p) => p._id === msgSenderIdStr,
    );
    return sender?.publicKey;
  }
  return isMe ? authUser.publicKey : selectedUser.publicKey;
};

// =========================================
// ZUSTAND STORE
// =========================================
export const useChatStore = create((set, get) => ({
  sendError: null,
  messages: [],
  contacts: [],
  selectedUser: null,
  isMessagesLoading: false,
  isContactsLoading: false,
  isTyping: false,
  conversations: [],
  isConversationsLoading: false,

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

  getConversations: async () => {
    set({ isConversationsLoading: true });
    try {
      const res = await axiosInstance.get("/conversation/");
      set({ conversations: res.data.data });
    } catch (error) {
      console.log("Lỗi lấy danh sách đoạn chat:", error);
    } finally {
      set({ isConversationsLoading: false });
    }
  },

  createGroup: async (groupName, users) => {
    try {
      const res = await axiosInstance.post("/conversation/group/create", {
        groupName,
        users,
      });
      // Thêm nhóm mới tạo lên đầu danh sách conversations hiện tại
      set({ conversations: [res.data.data, ...get().conversations] });
      return res.data.data;
    } catch (error) {
      console.error("Lỗi tạo nhóm:", error);
      return null;
    }
  },

  getMessages: async (userIdOrGroupId) => {
    set({ isMessagesLoading: true });
    try {
      const res = await axiosInstance.get(`/messages/${userIdOrGroupId}`);
      const rawMessages = res.data;
      const { authUser, myPrivateKey } = useAuthStore.getState();
      const { selectedUser } = get();

      const decryptedMessages = await Promise.all(
        rawMessages.map(async (msg) => {
          if (msg.fileUrl) {
            return msg; // File sẽ được giải mã riêng khi bấm nút tải
          }

          const senderIdStr = msg.senderId._id || msg.senderId;
          const isMe = senderIdStr === authUser._id;
          const senderPubKey = findSenderPublicKey(
            senderIdStr,
            isMe,
            selectedUser,
            authUser,
          );

          let plainText = msg.text;
          let finalImage = msg.image;

          // Lấy đúng AES Key của mình
          const myEncryptedAesKey = extractMyAesKey(msg, authUser._id, isMe);

          if (myEncryptedAesKey && myPrivateKey && senderPubKey) {
            // Đúc lại payload giả để tái sử dụng hàm E2EE cũ
            const payloadToDecrypt = {
              ...msg,
              encryptedAesKey: myEncryptedAesKey,
            };

            const decryptedString = await E2EE.decryptMessage(
              payloadToDecrypt,
              myPrivateKey,
              senderPubKey,
            );

            // Xử lý cảnh báo chữ ký số
            if (decryptedString.startsWith("[CẢNH BÁO")) {
              plainText = decryptedString;
            } else {
              const parsed = parseDecryptedPayload(decryptedString, msg.image);
              plainText = parsed.text;
              finalImage = parsed.image;
            }
          } else if (
            msg.encryptedAesKey ||
            (msg.groupEncryptedKeys &&
              Object.keys(msg.groupEncryptedKeys).length > 0)
          ) {
            plainText = "[Tin nhắn không thể giải mã]";
          }

          return { ...msg, text: plainText, image: finalImage };
        }),
      );

      if (get().selectedUser?._id !== userIdOrGroupId) return;
      set({ messages: decryptedMessages });
    } catch (error) {
      console.log("Lỗi lấy tin nhắn:", error);
    } finally {
      set({ isMessagesLoading: false });
    }
  },

  sendMessage: async ({ text, image, file, receiverId }) => {
    const { selectedUser } = get();
    if (!selectedUser) return false;
    set({ sendError: null });

    try {
      const { authUser, myPrivateKey } = useAuthStore.getState();

      if (!myPrivateKey) {
        set({
          sendError:
            "Trình duyệt này không có khóa riêng của bạn nên không thể mã hóa tin nhắn.",
        });
        return false;
      }

      const myPrivateKeyBase64 = await E2EE.exportPrivateKey(myPrivateKey);

      // ===================================
      // 1. GỬI FILE
      // ===================================
      if (file) {
        let encryptedFile = {};

        if (selectedUser.isGroupChat) {
          // GỬI FILE NHÓM
          encryptedFile = await E2EE.encryptFileForGroup(
            file.buffer,
            selectedUser.participants,
            myPrivateKeyBase64,
          );
        } else {
          // GỬI FILE 1-1
          if (!selectedUser.publicKey) {
            set({ sendError: "Người dùng này chưa có khóa công khai." });
            return false;
          }
          encryptedFile = await E2EE.encryptFile(
            file.buffer,
            selectedUser.publicKey,
            authUser.publicKey,
            myPrivateKeyBase64,
          );
        }

        const payloadToSend = {
          fileBase64: encryptedFile.fileBase64,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          iv: encryptedFile.iv,
          shaHash: encryptedFile.shaHash,
          // Lưu khóa 1-1
          encryptedAesKey: encryptedFile.encryptedAesKey,
          senderEncryptedAesKey: encryptedFile.senderEncryptedAesKey,
          // Lưu khóa Nhóm
          groupEncryptedKeys: encryptedFile.groupEncryptedKeys,
        };

        const res = await axiosInstance.post(
          `/messages/send/${receiverId}`,
          payloadToSend,
        );
        if (get().selectedUser?._id === receiverId) {
          set({ messages: [...get().messages, res.data] });
        }
      }

      // ===================================
      // 2. GỬI TEXT / IMAGE
      // ===================================
      if (text || image) {
        const combinedPayload = JSON.stringify({
          text: text || "",
          image: image || "",
        });

        let payloadToSend = {};

        if (selectedUser.isGroupChat) {
          // GỬI TEXT NHÓM
          const encryptedGroupData = await E2EE.encryptMessageForGroup(
            combinedPayload,
            selectedUser.participants,
            myPrivateKeyBase64,
          );
          payloadToSend = encryptedGroupData;
        } else {
          // GỬI TEXT 1-1
          if (!selectedUser.publicKey) {
            set({ sendError: "Người dùng này chưa có khóa công khai." });
            return false;
          }
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
      }

      return true;
    } catch (error) {
      set({
        sendError: error.response?.data?.message || "Gửi tin nhắn thất bại",
      });
      return false;
    }
  },

  downloadFile: async (msg) => {
    try {
      const { authUser, myPrivateKey } = useAuthStore.getState();
      const { selectedUser } = get();

      const senderIdStr = msg.senderId._id || msg.senderId;
      const isMe = senderIdStr === authUser._id;
      const senderPubKey = findSenderPublicKey(
        senderIdStr,
        isMe,
        selectedUser,
        authUser,
      );

      const response = await fetch(msg.fileUrl);
      const buffer = await response.arrayBuffer();
      const fileBase64 = buf2base64(buffer);

      // Tìm đúng AES Key
      const myEncryptedAesKey = extractMyAesKey(msg, authUser._id, isMe);

      const encryptedPayload = {
        fileBase64: fileBase64,
        encryptedAesKey: myEncryptedAesKey,
        iv: msg.iv,
        shaHash: msg.shaHash,
      };

      const decryptedBuffer = await E2EE.decryptFile(
        encryptedPayload,
        myPrivateKey,
        senderPubKey,
      );

      if (!decryptedBuffer) {
        throw new Error("Lỗi giải mã hoặc Chữ ký số không hợp lệ.");
      }

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
      set({ isTyping: false });

      // CẬP NHẬT KIỂM TRA CHO CHAT NHÓM: Tin nhắn này thuộc về conversation đang mở
      if (
        newMessage.conversationId === selectedUser._id ||
        newMessage.senderId === selectedUser._id
      ) {
        if (newMessage.fileUrl) {
          set({ messages: [...get().messages, newMessage] });
          socket.emit("markMessageAsRead", {
            messageId: newMessage._id,
            senderId: newMessage.senderId,
          });
          return;
        }

        const { authUser, myPrivateKey } = useAuthStore.getState();
        const senderIdStr = newMessage.senderId._id || newMessage.senderId;
        const isMe = senderIdStr === authUser._id;

        const senderPubKey = findSenderPublicKey(
          senderIdStr,
          isMe,
          selectedUser,
          authUser,
        );
        const myEncryptedAesKey = extractMyAesKey(
          newMessage,
          authUser._id,
          isMe,
        );

        let plainText = newMessage.text;
        let finalImage = newMessage.image;

        if (myEncryptedAesKey && myPrivateKey && senderPubKey) {
          const payloadToDecrypt = {
            ...newMessage,
            encryptedAesKey: myEncryptedAesKey,
          };

          const decryptedString = await E2EE.decryptMessage(
            payloadToDecrypt,
            myPrivateKey,
            senderPubKey,
          );

          if (decryptedString.startsWith("[CẢNH BÁO")) {
            plainText = decryptedString;
          } else {
            const parsed = parseDecryptedPayload(
              decryptedString,
              newMessage.image,
            );
            plainText = parsed.text;
            finalImage = parsed.image;
          }
        }

        const decryptedMessage = {
          ...newMessage,
          text: plainText,
          image: finalImage,
        };

        set({ messages: [...get().messages, decryptedMessage] });
        socket.emit("markMessageAsRead", {
          messageId: newMessage._id,
          senderId: newMessage.senderId,
        });
      }
    });

    socket.on("userTyping", ({ senderId }) => {
      // Logic gõ phím hiện tại của bạn chỉ thiết kế cho 1-1,
      // với group sẽ cần cải tiến server sau, tạm thời giữ nguyên
      if (get().selectedUser?._id === senderId) set({ isTyping: true });
    });

    socket.on("userStoppedTyping", ({ senderId }) => {
      if (get().selectedUser?._id === senderId) set({ isTyping: false });
    });

    socket.on("messageRead", ({ messageId }) => {
      set({
        messages: get().messages.map((msg) =>
          msg._id === messageId ? { ...msg, isRead: true } : msg,
        ),
      });
    });

    socket.on("messagesReadBulk", () => {
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
      socket.off("messageRead");
      socket.off("messagesReadBulk");
    }
  },
}));
