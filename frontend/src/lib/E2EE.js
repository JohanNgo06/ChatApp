/* eslint-disable no-unused-vars */
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
  // 1. RSA: TẠO KHÓA BẤT ĐỐI XỨNG
  // ==========================================
  generateRSAKeyPair: async () => {
    return await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["encrypt", "decrypt"],
    );
  },
  exportPublicKey: async (publicKey) => {
    const exported = await window.crypto.subtle.exportKey("spki", publicKey);
    return buf2base64(exported);
  },
  importPublicKey: async (base64Key) => {
    return await window.crypto.subtle.importKey(
      "spki",
      base642buf(base64Key),
      { name: "RSA-OAEP", hash: "SHA-256" },
      true,
      ["encrypt"],
    );
  },
  exportPrivateKey: async (privateKey) => {
    const exported = await window.crypto.subtle.exportKey("pkcs8", privateKey);
    return buf2base64(exported);
  },
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
  // 2. SHA-256: HÀM BĂM KIỂM TRA TOÀN VẸN
  // ==========================================
  hashSHA256: async (text) => {
    const encoded = new TextEncoder().encode(text);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", encoded);
    return buf2base64(hashBuffer);
  },

  // ==========================================
  // 3. CHỮ KÝ SỐ (RSASSA-PKCS1-v1_5)
  // ==========================================
  signMessage: async (plainText, myPrivateKeyBase64) => {
    // Ép trình duyệt đọc Private Key dưới định dạng Ký số
    const privKey = await window.crypto.subtle.importKey(
      "pkcs8",
      base642buf(myPrivateKeyBase64),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      true,
      ["sign"],
    );
    const encoded = new TextEncoder().encode(plainText);
    const signatureBuffer = await window.crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      privKey,
      encoded,
    );
    return buf2base64(signatureBuffer);
  },

  verifySignature: async (
    plainText,
    signatureBase64,
    senderPublicKeyBase64,
  ) => {
    // Ép trình duyệt đọc Public Key dưới định dạng Xác thực ký số
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
  // 4. QUY TRÌNH GỬI
  // ==========================================
  encryptMessage: async (
    plainText,
    receiverPublicKeyBase64,
    myPublicKeyBase64,
    myPrivateKeyBase64,
  ) => {
    //Ký số nội dung bằng Private Key của người gửi
    const digitalSignature = await E2EE.signMessage(
      plainText,
      myPrivateKeyBase64,
    );

    //Sinh khóa phiên AES
    const aesKey = await window.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );

    //Mã hóa nội dung tin nhắn bằng khóa phiên AES
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encodedText = new TextEncoder().encode(plainText);
    const cipherBuffer = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      aesKey,
      encodedText,
    );

    //Lấy khóa public người nhận để mã hóa khóa phiên
    const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
    const receiverPubKey = await E2EE.importPublicKey(receiverPublicKeyBase64);
    const encryptedAesBuffer = await window.crypto.subtle.encrypt(
      { name: "RSA-OAEP" },
      receiverPubKey,
      rawAesKey,
    );

    //Lấy chính public key của người gửi để mã hóa khóa phiên
    let senderEncryptedAesBuffer = null;
    if (myPublicKeyBase64) {
      const myPubKey = await E2EE.importPublicKey(myPublicKeyBase64);
      senderEncryptedAesBuffer = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        myPubKey,
        rawAesKey,
      );
    }

    //Đóng gói và gửi cho người nhận
    return {
      text: buf2base64(cipherBuffer), //Tin nhắn đã mã hóa
      encryptedAesKey: buf2base64(encryptedAesBuffer), //Khóa phiên đã mã hóa
      senderEncryptedAesKey: senderEncryptedAesBuffer //Khóa phiên được mã hóa bằng chính public key của mình
        ? buf2base64(senderEncryptedAesBuffer)
        : "",
      iv: buf2base64(iv),
      shaHash: digitalSignature, // Cất Chữ ký số vào trường shaHash
    };
  },

  // ==========================================
  // 5. QUY TRÌNH NHẬN
  // ==========================================
  decryptMessage: async (
    encryptedPayload,
    myPrivateKey,
    senderPublicKeyBase64,
  ) => {
    try {
      if (!encryptedPayload.encryptedAesKey) return encryptedPayload.text;

      //Giải mã khóa AES bằng khóa private của người nhận
      const decryptedAesRaw = await window.crypto.subtle.decrypt(
        //Khóa AES còn là dạng byte (thô)
        { name: "RSA-OAEP" },
        myPrivateKey,
        base642buf(encryptedPayload.encryptedAesKey),
      );
      const aesKey = await window.crypto.subtle.importKey(
        //Đúc lại thành khóa AES hoàn chỉnh
        "raw",
        decryptedAesRaw,
        { name: "AES-GCM" },
        true,
        ["encrypt", "decrypt"],
      );

      //Dùng khóa AES vừa giải mã được để giải mã phần nội dung tin nhắn
      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: base642buf(encryptedPayload.iv) },
        aesKey,
        base642buf(encryptedPayload.text),
      );
      const plainText = new TextDecoder().decode(decryptedBuffer);

      //Xác thực Chữ ký số bằng Public Key của người gửi
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
};
