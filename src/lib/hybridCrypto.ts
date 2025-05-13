import crypto from "crypto";
import { getPrivateKey } from "./rsaUtils";

const IV_LENGTH = Number(process.env.IV_LENGTH) || 16;
const SERVER_AES_KEY = process.env.SERVER_AES_KEY || "defaultAESKey12";

/**
 * 服务器端混合解密
 * 处理客户端发来的RSA加密的AES密钥和AES加密的数据
 *
 * 简化数据格式:
 * | RSA加密的AES密钥 | AES IV(16字节) | AES加密的数据 |
 *
 * @param encryptedData 混合加密的完整数据
 * @returns 解密后的原始数据
 */
export function hybridDecrypt(encryptedData: Buffer): unknown {
  try {
    // 获取服务器的RSA私钥
    const privateKey = getPrivateKey();

    // 假设RSA加密后的AES密钥长度为固定值(通常是256字节/2048位RSA)
    const rsaOutputSize = 256; // RSA-2048输出固定为256字节

    // 提取RSA加密的AES密钥
    const encryptedAesKey = encryptedData.slice(0, rsaOutputSize);

    // 提取AES IV
    const iv = encryptedData.slice(rsaOutputSize, rsaOutputSize + IV_LENGTH);

    // 提取AES加密的数据
    const encryptedContent = encryptedData.slice(rsaOutputSize + IV_LENGTH);

    try {
      // 使用RSA私钥解密AES密钥 - 使用无填充方式
      const rawDecrypted = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_NO_PADDING, // 无填充
        },
        encryptedAesKey
      );

      // 处理无填充模式解密后的数据：去除前导零
      // 客户端使用32字节AES密钥，所以我们需要从解密结果中提取最后32字节
      // 无填充模式下，解密结果通常会包含前导零
      const aesKeyLength = 32; // AES-256需要32字节密钥
      const decryptedLength = rawDecrypted.length;
      const aesKey =
        decryptedLength <= aesKeyLength
          ? Buffer.concat([
              Buffer.alloc(aesKeyLength - decryptedLength, 0),
              rawDecrypted,
            ]) // 如果结果不足32字节，前面补零
          : rawDecrypted.slice(decryptedLength - aesKeyLength); // 如果超过32字节，取最后32字节

      // 使用解密出的AES密钥和IV解密数据
      const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
      let decrypted = decipher.update(encryptedContent);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

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
    throw new Error(
      "解密数据失败: " +
        (error instanceof Error ? error.message : String(error))
    );
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
    throw new Error(
      "加密数据失败: " +
        (error instanceof Error ? error.message : String(error))
    );
  }
}
