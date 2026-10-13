/**
 * ==============================================================================
 * ------------------------------------------------------------------------------
 * Ứng dụng sử dụng mô hình Mã hóa lai (Hybrid Encryption) kết hợp 3 thuật toán:
 * 1. AES : Mã hóa đối xứng, tốc độ cực nhanh -> Dùng để mã hóa dữ liệu thực tế (Tin nhắn, File).
 * 2. RSA : Mã hóa bất đối xứng, độ bảo mật cao -> Dùng để trao đổi/gửi chiếc "Khóa AES" một cách an toàn.
 * 3. SHA : Hàm băm một chiều -> Kết hợp với RSA để tạo Chữ ký điện tử, kiểm tra tính toàn vẹn và chống giả mạo.
 * ==============================================================================
 */

// Chuyển đổi qua lại giữa ArrayBuffer (Nhị phân) và Base64 (Chuỗi để lưu DB)
export const buf2base64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

export const base642buf = (b64) => {
  const binary_string = window.atob(b64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
};

export const E2EE = {
  // ==========================================
  // PHẦN 1: RSA - THUẬT TOÁN BẤT ĐỐI XỨNG (ASYMMETRIC)
  // Mỗi user có 1 cặp khóa. Public Key công khai cho mọi người để "khóa" tin nhắn. Private Key giấu kín để "mở khóa".
  // ==========================================

  // Hàm tạo cặp khóa RSA 2048-bit khi user đăng ký tài khoản
  generateRSAKeyPair: async () => {
    return await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP", // OAEP là chuẩn padding an toàn chống lại các cuộc tấn công bản rõ
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"],
    );
  },

  // Chuyển đổi Public Key ra Base64 để gửi lên Database
  exportPublicKey: async (publicKey) => {
    const exported = await window.crypto.subtle.exportKey("spki", publicKey);
    return buf2base64(exported);
  },

  // Đọc Public Key từ Database để sử dụng
  importPublicKey: async (base64Key) => {
    return await window.crypto.subtle.importKey(
      "spki",
      base642buf(base64Key),
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"],
    );
  },

  // Chuyển đổi Private Key ra Base64 để lưu vào localStorage của trình duyệt
  exportPrivateKey: async (privateKey) => {
    const exported = await window.crypto.subtle.exportKey("pkcs8", privateKey);
    return buf2base64(exported);
  },

  // Đọc Private Key từ localStorage để giải mã
  importPrivateKey: async (base64Key) => {
    return await window.crypto.subtle.importKey(
      "pkcs8",
      base642buf(base64Key),
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["decrypt"],
    );
  },

  // ==========================================
  // PHẦN 2: SHA-256 - HÀM BĂM (HASH FUNCTION)
  //  SHA biến đổi mọi nội dung thành 1 chuỗi 256-bit duy nhất (fingerprint). Bất kỳ thay đổi nhỏ nào ở dữ liệu gốc cũng làm chuỗi này thay đổi hoàn toàn.
  // ==========================================
  hashSHA256: async (text) => {
    const encoded = new TextEncoder().encode(text);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", encoded);
    return buf2base64(hashBuffer);
  },

  // ==========================================
  // PHẦN 3: CHỮ KÝ ĐIỆN TỬ (DIGITAL SIGNATURE) = SHA-256 + RSA
  //  Đảo ngược logic của RSA. Người gửi dùng Private Key của mình để KÝ, người nhận dùng Public Key của người gửi để KIỂM TRA. Giúp chống giả mạo danh tính.
  // ==========================================

  // Hàm tạo chữ ký số
  signMessage: async (plainText, myPrivateKeyBase64) => {
    const privKey = await window.crypto.subtle.importKey(
      "pkcs8",
      base642buf(myPrivateKeyBase64),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, // Thuật toán ký số chuyên dụng của RSA
      true,
      ["sign"],
    );
    const encoded = new TextEncoder().encode(plainText);
    const signatureBuffer = await window.crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      privKey,
      encoded,
    );
    return buf2base64(signatureBuffer); // Trả về con dấu điện tử
  },

  // Hàm kiểm tra chữ ký số
  verifySignature: async (
    plainText,
    signatureBase64,
    senderPublicKeyBase64,
  ) => {
    const pubKey = await window.crypto.subtle.importKey(
      "spki",
      base642buf(senderPublicKeyBase64),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["verify"],
    );
    const encoded = new TextEncoder().encode(plainText);
    return await window.crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      pubKey,
      base642buf(signatureBase64),
      encoded,
    );
  },

  // ==========================================
  // PHẦN 4: LUỒNG MÃ HÓA TIN NHẮN (HYBRID ENCRYPTION)
  //  Đây là cốt lõi của hệ thống, giải quyết bài toán "RSA quá chậm để mã hóa dữ liệu lớn".
  // ==========================================
  encryptMessage: async (
    plainText,
    receiverPublicKeyBase64,
    myPublicKeyBase64,
    myPrivateKeyBase64,
  ) => {
    // Bước 1 (Tính Xác Thực): Tạo chữ ký số cho nội dung để chứng minh người gửi
    const digitalSignature = await E2EE.signMessage(
      plainText,
      myPrivateKeyBase64,
    );

    // Bước 2 (AES): Sinh ra 1 khóa AES dùng một lần (Session Key) cho tin nhắn này.
    const aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 }, // Dùng AES-GCM 256-bit rất mạnh và nhanh
      true,
      ["encrypt", "decrypt"],
    );

    // Bước 3 (AES): Dùng khóa AES vừa tạo để mã hóa nội dung tin nhắn
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // Vector khởi tạo giúp cùng 1 nội dung mã hóa ra kết quả khác nhau
    const encodedText = new TextEncoder().encode(plainText);
    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      encodedText,
    );

    // Bước 4 (RSA): Dùng Public Key của người nhận để khóa chặt chiếc "Khóa AES" lại.
    // Chỉ người nhận có Private Key mới mở được ổ khóa này để lấy khóa AES bên trong.
    const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
    const receiverPubKey = await E2EE.importPublicKey(receiverPublicKeyBase64);
    const encryptedAesBuffer = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      receiverPubKey,
      rawAesKey,
    );

    // Bước 5: Khóa chiếc khóa AES bằng chính Public Key của mình để mình cũng có thể xem lại tin nhắn đã gửi.
    let senderEncryptedAesBuffer = null;
    if (myPublicKeyBase64) {
      const myPubKey = await E2EE.importPublicKey(myPublicKeyBase64);
      senderEncryptedAesBuffer = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        myPubKey,
        rawAesKey,
      );
    }

    // Trả về gói hàng đã mã hóa hoàn toàn
    return {
      text: buf2base64(cipherBuffer), // Dữ liệu bị băm nát bởi AES
      encryptedAesKey: buf2base64(encryptedAesBuffer), // Chìa khóa AES bị khóa bởi RSA người nhận
      senderEncryptedAesKey: senderEncryptedAesBuffer
        ? buf2base64(senderEncryptedAesBuffer)
        : "",
      iv: buf2base64(iv),
      shaHash: digitalSignature, // Con dấu chống giả mạo
    };
  },

  // ==========================================
  // PHẦN 5: LUỒNG GIẢI MÃ TIN NHẮN
  //  Quy trình ngược lại hoàn toàn với lúc gửi.
  // ==========================================
  decryptMessage: async (
    encryptedPayload,
    myPrivateKey,
    senderPublicKeyBase64,
  ) => {
    try {
      if (!encryptedPayload.encryptedAesKey) return encryptedPayload.text;

      // Bước 1 (RSA): Dùng Private Key của mình để giải mã lấy lại chiếc "Khóa AES"
      const decryptedAesRaw = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        myPrivateKey,
        base642buf(encryptedPayload.encryptedAesKey),
      );

      // Định hình lại khóa AES từ chuỗi byte thô
      const aesKey = await window.crypto.subtle.importKey(
        "raw",
        decryptedAesRaw,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"],
      );

      // Bước 2 (AES): Dùng khóa AES đã lấy lại được để giải mã nội dung tin nhắn
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base642buf(encryptedPayload.iv) },
        aesKey,
        base642buf(encryptedPayload.text),
      );
      const plainText = new TextDecoder().decode(decryptedBuffer); // Có được văn bản gốc!

      // Bước 3 (Xác thực): Quét chữ ký số bằng Public Key của người gửi để đảm bảo hacker không sửa đổi tin nhắn giữa đường
      if (senderPublicKeyBase64 && encryptedPayload.shaHash) {
        try {
          const isValidSignature = await E2EE.verifySignature(
            plainText,
            encryptedPayload.shaHash,
            senderPublicKeyBase64,
          );
          if (!isValidSignature) {
            return "[CẢNH BÁO: CHỮ KÝ SỐ KHÔNG HỢP LỆ! Tin nhắn giả mạo.]";
          }
        } catch (e) {
          return "[Lỗi định dạng Chữ ký số - Có thể do khóa bị cũ]";
        }
      }

      return plainText;
    } catch (error) {
      return "[Lỗi giải mã E2EE]";
    }
  },

  // ==========================================
  // PHẦN 6 & 7: MÃ HÓA/GIẢI MÃ FILE
  //  Tương tự như tin nhắn, nhưng AES đặc biệt phát huy sức mạnh ở đây vì nó có thể mã hóa file hàng MB trong chớp mắt, điều mà RSA không thể làm được.
  // ==========================================
  encryptFile: async (
    fileBuffer,
    receiverPublicKeyBase64,
    myPublicKeyBase64,
    myPrivateKeyBase64,
  ) => {
    // 1. Ký số file gốc (SHA + RSA)
    const privKey = await window.crypto.subtle.importKey(
      "pkcs8",
      base642buf(myPrivateKeyBase64),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["sign"],
    );
    const signatureBuffer = await window.crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      privKey,
      fileBuffer,
    );

    // 2. Sinh khóa phiên AES cho file
    const aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );

    // 3. Mã hóa toàn bộ dữ liệu file bằng AES (Tốc độ cao)
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      fileBuffer,
    );

    // 4. Khóa chiếc khóa AES lại bằng RSA của người nhận
    const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
    const receiverPubKey = await E2EE.importPublicKey(receiverPublicKeyBase64);
    const encryptedAesBuffer = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      receiverPubKey,
      rawAesKey,
    );

    // 5. Khóa chiếc khóa AES lại bằng RSA của chính mình
    let senderEncryptedAesBuffer = null;
    if (myPublicKeyBase64) {
      const myPubKey = await E2EE.importPublicKey(myPublicKeyBase64);
      senderEncryptedAesBuffer = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        myPubKey,
        rawAesKey,
      );
    }

    return {
      fileBase64: buf2base64(cipherBuffer),
      encryptedAesKey: buf2base64(encryptedAesBuffer),
      senderEncryptedAesKey: senderEncryptedAesBuffer
        ? buf2base64(senderEncryptedAesBuffer)
        : "",
      iv: buf2base64(iv),
      shaHash: buf2base64(signatureBuffer),
    };
  },

  //Giải mã file

  decryptFile: async (
    encryptedPayload,
    myPrivateKey,
    senderPublicKeyBase64,
  ) => {
    try {
      if (!encryptedPayload.encryptedAesKey || !encryptedPayload.fileBase64)
        return null;

      // 1. Dùng RSA Private lấy lại khóa AES
      const decryptedAesRaw = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        myPrivateKey,
        base642buf(encryptedPayload.encryptedAesKey),
      );
      const aesKey = await window.crypto.subtle.importKey(
        "raw",
        decryptedAesRaw,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"],
      );

      // 2. Dùng khóa AES mở khóa File nhị phân
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base642buf(encryptedPayload.iv) },
        aesKey,
        base642buf(encryptedPayload.fileBase64),
      );

      // 3. Quét Chữ ký số chống sửa đổi
      if (senderPublicKeyBase64 && encryptedPayload.shaHash) {
        try {
          const pubKey = await window.crypto.subtle.importKey(
            "spki",
            base642buf(senderPublicKeyBase64),
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            true,
            ["verify"],
          );
          const isValidSignature = await window.crypto.subtle.verify(
            "RSASSA-PKCS1-v1_5",
            pubKey,
            base642buf(encryptedPayload.shaHash),
            decryptedBuffer,
          );
          if (!isValidSignature) {
            console.error(
              "[E2EE] CẢNH BÁO: Chữ ký số bị sai! File có thể đã bị sửa đổi.",
            );
            return null;
          }
        } catch (e) {
          console.error("[E2EE] Lỗi quét chữ ký số", e);
          return null;
        }
      }

      return decryptedBuffer;
    } catch (error) {
      console.error("[E2EE] Lỗi giải mã file:", error);
      return null;
    }
  },

  // ==========================================
  // PHẦN 8 & 9: XỬ LÝ ĐA NHẬN (GROUP CHAT)
  // Thay vì mã hóa file N lần cho N người (rất tốn tài nguyên), ta chỉ mã hóa file 1 lần bằng 1 khóa AES chung. Sau đó copy khóa AES thành N bản, và khóa từng bản bằng RSA Public Key của từng người.
  // ==========================================
  encryptMessageForGroup: async (
    plainText,
    participants,
    myPrivateKeyBase64,
  ) => {
    const digitalSignature = await E2EE.signMessage(
      plainText,
      myPrivateKeyBase64,
    );

    // 1. Tạo MỘT khóa AES duy nhất cho cả nhóm
    const aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(plainText);

    // 2. Chỉ mã hóa nội dung tin nhắn đúng 1 lần (Tiết kiệm CPU)
    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      encodedText,
    );
    const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
    const groupEncryptedKeys = {}; // Danh sách ổ khóa của từng người

    // 3. Dùng RSA của từng thành viên khóa cái AES Key chung này lại
    for (const user of participants) {
      if (!user.publicKey) continue;
      try {
        const userPubKey = await E2EE.importPublicKey(user.publicKey);
        const encryptedAesBuffer = await window.crypto.subtle.encrypt(
          { name: "RSA-OAEP" },
          userPubKey,
          rawAesKey,
        );
        groupEncryptedKeys[user._id] = buf2base64(encryptedAesBuffer); // Gắn tên ID người nhận vào ổ khóa tương ứng
      } catch (err) {
        console.error(`Lỗi mã hóa khóa cho user ${user._id}`, err);
      }
    }

    return {
      text: buf2base64(cipherBuffer),
      groupEncryptedKeys, // Backend sẽ phát đúng ổ khóa cho đúng người
      iv: buf2base64(iv),
      shaHash: digitalSignature,
    };
  },

  encryptFileForGroup: async (fileBuffer, participants, myPrivateKeyBase64) => {
    const privKey = await window.crypto.subtle.importKey(
      "pkcs8",
      base642buf(myPrivateKeyBase64),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["sign"],
    );
    const signatureBuffer = await window.crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      privKey,
      fileBuffer,
    );

    // 1. Tạo MỘT khóa AES duy nhất cho File nhóm
    const aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    // 2. Chỉ mã hóa File đúng 1 lần
    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      fileBuffer,
    );

    const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
    const groupEncryptedKeys = {};

    // 3. Khóa AES Key bằng RSA của từng thành viên
    for (const user of participants) {
      if (!user.publicKey) continue;
      try {
        const userPubKey = await E2EE.importPublicKey(user.publicKey);
        const encryptedAesBuffer = await window.crypto.subtle.encrypt(
          { name: "RSA-OAEP" },
          userPubKey,
          rawAesKey,
        );
        groupEncryptedKeys[user._id] = buf2base64(encryptedAesBuffer);
      } catch (err) {
        console.error(`Lỗi mã hóa khóa File cho user ${user._id}`, err);
      }
    }

    return {
      fileBase64: buf2base64(cipherBuffer),
      groupEncryptedKeys,
      iv: buf2base64(iv),
      shaHash: buf2base64(signatureBuffer),
    };
  },
};
