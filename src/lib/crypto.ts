import crypto from "crypto";

if (!process.env.NEXT_PUBLIC_AES_KEY) {
  throw new Error("AES密钥未设置，请在环境变量中设置NEXT_PUBLIC_AES_KEY");
}

// 固定的初始化向量（IV）长度
const IV_LENGTH = 16;

// 处理IV，确保长度为16字节
function processIV(iv?: string): Buffer {
  // 如果未提供IV或IV为空，则随机生成
  if (!iv) {
    return crypto.randomBytes(IV_LENGTH);
  }

  // 创建16字节长度的缓冲区
  const buffer = Buffer.alloc(IV_LENGTH, 0);

  // 将提供的IV转换为Buffer
  const ivBuffer = Buffer.from(iv);

  // 复制IV数据到缓冲区，如果过短则补0，如果过长则截断
  ivBuffer.copy(buffer, 0, 0, Math.min(ivBuffer.length, IV_LENGTH));

  return buffer;
}

// 处理密钥，支持不同长度的密钥
function processKey(key: string): { key: Buffer; algorithm: string } {
  const keyBuffer = Buffer.from(key);

  // 根据密钥长度自动选择算法
  let algorithm: string;
  let processedKey: Buffer;

  if (keyBuffer.length <= 16) {
    // 如果密钥长度小于等于16字节，使用AES-128
    processedKey = Buffer.alloc(16, 0);
    keyBuffer.copy(processedKey, 0, 0, Math.min(keyBuffer.length, 16));
    algorithm = "aes-128-cbc";
  } else if (keyBuffer.length <= 24) {
    // 如果密钥长度小于等于24字节，使用AES-192
    processedKey = Buffer.alloc(24, 0);
    keyBuffer.copy(processedKey, 0, 0, Math.min(keyBuffer.length, 24));
    algorithm = "aes-192-cbc";
  } else {
    // 如果密钥长度大于24字节，使用AES-256
    processedKey = Buffer.alloc(32, 0);
    keyBuffer.copy(processedKey, 0, 0, Math.min(keyBuffer.length, 32));
    algorithm = "aes-256-cbc";
  }

  return { key: processedKey, algorithm };
}

/**
 * 使用AES-CBC算法加密数据，根据密钥长度自动选择AES-128/192/256
 * @param data 要加密的数据
 * @returns 加密后的二进制Buffer（包含IV和加密内容）
 */
export function encrypt(data: unknown): Buffer {
  try {
    // 将对象转换为JSON字符串
    const text = typeof data === "string" ? data : JSON.stringify(data);

    // 处理IV，从环境变量获取或生成随机IV
    const iv = processIV(process.env.NEXT_PUBLIC_AES_IV);

    // 处理密钥，获取合适的算法
    const { key, algorithm } = processKey(process.env.NEXT_PUBLIC_AES_KEY as string);

    // 创建密码器
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    // 加密数据
    let encrypted = cipher.update(text, "utf8");
    encrypted = Buffer.concat([encrypted, cipher.final()]);

    // 组合IV和加密数据，直接返回Buffer
    const result = Buffer.concat([iv, encrypted]);

    // 打印使用的算法信息（调试用）
    console.log(`使用算法: ${algorithm}, IV长度: ${iv.length}`);

    return result;
  } catch (error) {
    console.error("加密失败:", error);
    throw new Error("加密数据失败");
  }
}

/**
 * 解密AES-CBC加密的数据，根据密钥长度自动选择AES-128/192/256
 * @param encryptedData 加密的二进制数据Buffer
 * @returns 解密后的数据
 */
export function decrypt(encryptedData: Buffer): unknown {
  try {
    // 提取IV和加密的内容
    const iv = encryptedData.slice(0, IV_LENGTH);
    const encrypted = encryptedData.slice(IV_LENGTH);

    // 处理密钥，获取合适的算法
    const { key, algorithm } = processKey(process.env.NEXT_PUBLIC_AES_KEY as string);

    // 创建解密器
    const decipher = crypto.createDecipheriv(algorithm, key, iv);

    // 解密数据
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    const decryptedText = decrypted.toString('utf8');

    // 尝试解析JSON，如果不是有效的JSON则返回原始字符串
    try {
      return JSON.parse(decryptedText);
    } catch {
      return decryptedText;
    }
  } catch (error) {
    console.error("解密失败:", error);
    throw new Error("解密数据失败");
  }
}

/**
 * 生成随机的AES密钥
 * @param size 密钥大小 (可选: 128, 192, 256 位)
 * @returns 十六进制字符串格式的密钥
 */
export function generateAesKey(size: 128 | 192 | 256 = 128): string {
  // 计算字节数（位数除以8）
  const bytes = size / 8;
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * 生成随机的初始化向量(IV)
 * @returns 十六进制字符串格式的IV
 */
export function generateIV(): string {
  return crypto.randomBytes(IV_LENGTH).toString("hex");
}
