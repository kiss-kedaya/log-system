import crypto from "crypto";
import { getPrivateKey } from "./rsaUtils";
import { IV_LENGTH, SERVER_AES_KEY } from "./cryptoConfig";

// 定义解密错误类型
export class DecryptionError extends Error {
  stage: string;
  originalError: Error;

  constructor(message: string, stage: string, originalError: Error) {
    super(message);
    this.name = "DecryptionError";
    this.stage = stage;
    this.originalError = originalError;
  }
}

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
    // 数据格式验证
    if (!encryptedData || encryptedData.length < 256 + IV_LENGTH) {
      throw new DecryptionError(
        "加密数据格式无效或不完整", 
        "数据验证", 
        new Error("数据长度不足")
      );
    }

    // 获取服务器的RSA私钥
    const privateKey = getPrivateKey();
    if (!privateKey) {
      throw new DecryptionError(
        "无法获取RSA私钥", 
        "密钥获取", 
        new Error("RSA私钥不存在或无效")
      );
    }

    // 假设RSA加密后的AES密钥长度为固定值(通常是256字节/2048位RSA)
    const rsaOutputSize = 256; // RSA-2048输出固定为256字节

    // 提取RSA加密的AES密钥
    const encryptedAesKey = encryptedData.slice(0, rsaOutputSize);

    // 提取AES IV
    const iv = encryptedData.slice(rsaOutputSize, rsaOutputSize + IV_LENGTH);

    // 提取AES加密的数据
    const encryptedContent = encryptedData.slice(rsaOutputSize + IV_LENGTH);

    let aesKey;
    try {
      // 使用RSA私钥解密AES密钥
      aesKey = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: "sha256", // 匹配客户端的SHA-256哈希算法
        },
        encryptedAesKey
      );
    } catch (rsaError) {
      console.error("RSA解密失败:", rsaError);
      throw new DecryptionError(
        "RSA解密AES密钥失败", 
        "RSA解密", 
        rsaError as Error
      );
    }

    try {
      // 使用解密出的AES密钥和IV解密数据
      const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
      let decrypted = decipher.update(encryptedContent);
      decrypted = Buffer.concat([decrypted, decipher.final()]);

      // 转换为字符串并尝试解析JSON
      const decryptedText = decrypted.toString("utf8");
      try {
        return JSON.parse(decryptedText);
      } catch (jsonError) {
        console.error("JSON解析失败:", jsonError);
        // 如果无法解析为JSON，则返回文本
        return decryptedText;
      }
    } catch (aesError) {
      console.error("AES解密失败:", aesError);
      throw new DecryptionError(
        "AES解密数据失败", 
        "AES解密", 
        aesError as Error
      );
    }
  } catch (error) {
    // 已经是DecryptionError类型则直接抛出
    if (error instanceof DecryptionError) {
      throw error;
    }
    
    // 其他未知错误
    console.error("混合解密失败:", error);
    throw new DecryptionError(
      "解密数据失败", 
      "未知阶段", 
      error as Error
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
    throw new Error("加密数据失败");
  }
}
