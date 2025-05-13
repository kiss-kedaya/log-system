import crypto from "crypto";
import { getPrivateKey } from "./rsaUtils";
import {
  IV_LENGTH,
  SERVER_AES_KEY,
  PROTOCOL_VERSION,
  ENCRYPTED_AES_KEY_SIZE_LENGTH,
} from "./cryptoConfig";

/**
 * 服务器端混合解密
 * 处理客户端发来的RSA加密的AES密钥和AES加密的数据
 *
 * 数据格式:
 * | 协议版本(1字节) | 加密AES密钥长度(4字节) | RSA加密的AES密钥 | AES IV(16字节) | AES加密的数据 |
 *
 * @param encryptedData 混合加密的完整数据
 * @returns 解密后的原始数据
 */
export function hybridDecrypt(encryptedData: Buffer): unknown {
  try {
    console.log("开始服务器端混合解密...");
    console.log("收到加密数据总长度:", encryptedData.length, "字节");

    // 读取协议版本
    const version = encryptedData.readUInt8(0);
    console.log("协议版本:", version);
    if (version !== PROTOCOL_VERSION) {
      throw new Error(`不支持的加密协议版本: ${version}`);
    }

    // 读取RSA加密的AES密钥长度
    const encryptedKeySize = encryptedData.readUInt32BE(1);
    console.log("加密AES密钥长度:", encryptedKeySize, "字节");

    // 提取RSA加密的AES密钥
    const encryptedAesKey = encryptedData.slice(
      1 + ENCRYPTED_AES_KEY_SIZE_LENGTH,
      1 + ENCRYPTED_AES_KEY_SIZE_LENGTH + encryptedKeySize
    );
    console.log("提取的加密AES密钥长度:", encryptedAesKey.length, "字节");

    // 计算IV的起始位置
    const ivPosition = 1 + ENCRYPTED_AES_KEY_SIZE_LENGTH + encryptedKeySize;
    console.log("IV起始位置:", ivPosition);

    // 提取AES IV
    const iv = encryptedData.slice(ivPosition, ivPosition + IV_LENGTH);
    console.log("IV长度:", iv.length, "字节");

    // 提取AES加密的数据
    const encryptedContent = encryptedData.slice(ivPosition + IV_LENGTH);
    console.log("加密内容长度:", encryptedContent.length, "字节");

    // 获取服务器的RSA私钥
    const privateKey = getPrivateKey();
    console.log("获取到私钥");

    try {
      // 使用RSA私钥解密AES密钥
      console.log("尝试RSA解密AES密钥...");
      const aesKey = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256", // 匹配客户端的SHA-256哈希算法
        },
        encryptedAesKey
      );
      console.log("RSA解密成功，AES密钥长度:", aesKey.length, "字节");

      // 使用解密出的AES密钥和IV解密数据
      console.log("尝试AES解密数据...");
      const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
      let decrypted = decipher.update(encryptedContent);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      console.log("AES解密成功，解密后数据长度:", decrypted.length, "字节");

      // 转换为字符串并尝试解析JSON
      const decryptedText = decrypted.toString("utf8");
      try {
        return JSON.parse(decryptedText);
      } catch {
        return decryptedText;
      }
    } catch (decryptError) {
      console.error("RSA/AES解密具体错误:", decryptError);
      throw decryptError;
    }
  } catch (error) {
    console.error("混合解密失败:", error);
    throw new Error("解密数据失败");
  }
}

/**
 * 服务器端加密（用于向客户端发送数据）
 * 使用固定密钥进行AES加密
 *
 * @param data 要加密的数据
 * @returns 加密的完整数据
 */
export function hybridEncrypt(data: unknown): Buffer {
  try {
    // 将数据转换为JSON字符串
    const text = typeof data === "string" ? data : JSON.stringify(data);

    // 创建传统的AES加密数据
    const iv = crypto.randomBytes(IV_LENGTH);

    // 确保密钥长度正确 (AES-128需要16字节密钥)
    const key = SERVER_AES_KEY.padEnd(16, "0").slice(0, 16);
    const aesKey = Buffer.from(key); // 使用固定的服务器密钥

    // 使用AES加密数据
    const cipher = crypto.createCipheriv("aes-128-cbc", aesKey, iv);
    let encrypted = cipher.update(text, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // 组合IV和加密数据
    return Buffer.concat([iv, encrypted]);
  } catch (error) {
    console.error("加密失败:", error);
    throw new Error("加密数据失败");
  }
}
