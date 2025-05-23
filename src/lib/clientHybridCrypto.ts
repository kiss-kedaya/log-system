"use client";

import CryptoJS from "crypto-js";
import * as forge from "node-forge";

const IV_LENGTH = Number(process.env.IV_LENGTH) || 16;
const SERVER_AES_KEY = process.env.SERVER_AES_KEY || "defaultAESKey123";

// 存储RSA公钥
let rsaPublicKey: string | null = null;

/**
 * 设置RSA公钥
 */
export function setRSAPublicKey(publicKey: string) {
  rsaPublicKey = publicKey;
  localStorage.setItem("rsa_public_key", publicKey);
}

/**
 * 获取RSA公钥
 */
export function getRSAPublicKey(): string | null {
  if (!rsaPublicKey) {
    // 尝试从localStorage恢复
    rsaPublicKey = localStorage.getItem("rsa_public_key");
  }
  return rsaPublicKey;
}

/**
 * 初始化加密系统
 * 从服务器获取RSA公钥
 */
export async function initCryptoSystem(): Promise<boolean> {
  try {
    // 检查是否已有公钥
    const existingKey = getRSAPublicKey();
    if (existingKey) {
      return true;
    }

    // 从服务器获取公钥
    const response = await fetch("/api/initKeys");
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.error || `服务器响应状态码: ${response.status}`;
      throw new Error(`获取RSA公钥失败: ${errorMessage}`);
    }

    const data = await response.json();
    if (!data.success || !data.publicKey) {
      throw new Error(
        "获取RSA公钥失败: " +
          (data.message || data.error || "未知错误") +
          "。请确保服务器已配置RSA_PRIVATE_KEY和RSA_PUBLIC_KEY环境变量。"
      );
    }

    // 保存公钥
    setRSAPublicKey(data.publicKey);
    return true;
  } catch (error) {
    console.error("初始化加密系统失败:", error);
    // 显示更友好的错误信息
    alert("无法初始化加密系统: " + (error as Error).message);
    return false;
  }
}

/**
 * 将WordArray转换为Uint8Array
 */
function wordArrayToUint8Array(wordArray: CryptoJS.lib.WordArray): Uint8Array {
  const words = wordArray.words;
  const sigBytes = wordArray.sigBytes;
  const u8 = new Uint8Array(sigBytes);

  for (let i = 0; i < sigBytes; i++) {
    u8[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
  }

  return u8;
}

/**
 * 将Uint8Array转换为WordArray
 */
function uint8ArrayToWordArray(u8arr: Uint8Array): CryptoJS.lib.WordArray {
  const len = u8arr.length;
  const words: number[] = [];

  for (let i = 0; i < len; i += 4) {
    words.push(
      ((u8arr[i] || 0) << 24) |
        ((u8arr[i + 1] || 0) << 16) |
        ((u8arr[i + 2] || 0) << 8) |
        (u8arr[i + 3] || 0)
    );
  }

  return CryptoJS.lib.WordArray.create(words, len);
}

/**
 * 使用node-forge进行RSA加密(无填充)
 */
function rsaEncrypt(data: Uint8Array, publicKey: string): Uint8Array {
  try {
    // 解析公钥
    const publicKeyObj = forge.pki.publicKeyFromPem(publicKey);

    // 计算RSA密钥的字节长度
    const keyLength = Math.ceil(publicKeyObj.n.bitLength() / 8);

    // 创建forge buffer并右填充数据
    const buffer = forge.util.createBuffer();

    // 对齐数据长度 - 对于无填充模式，数据必须与模数长度完全相同
    // 注意：这里需要左填充0，因为RSA是大整数运算，低位在右侧
    const paddingLength = keyLength - data.length;

    // 添加前导零填充
    for (let i = 0; i < paddingLength; i++) {
      buffer.putByte(0);
    }

    // 添加实际数据
    for (let i = 0; i < data.length; i++) {
      buffer.putByte(data[i]);
    }

    // 进行无填充RSA加密
    const encrypted = publicKeyObj.encrypt(buffer.getBytes(), "NONE");

    // 将加密结果转换为Uint8Array
    const resultBuffer = forge.util.createBuffer(encrypted);
    const result = new Uint8Array(keyLength);

    for (let i = 0; i < keyLength; i++) {
      result[i] = resultBuffer.getInt(8);
    }

    return result;
  } catch (error) {
    console.error("RSA加密失败:", error);
    throw new Error("RSA加密失败: " + (error as Error).message);
  }
}

/**
 * 混合加密数据
 * 使用临时生成的AES密钥加密数据，然后用RSA公钥加密AES密钥
 */
export async function encryptData(data: unknown): Promise<ArrayBuffer> {
  try {
    const publicKey = getRSAPublicKey();
    if (!publicKey) {
      throw new Error("未设置RSA公钥，请先初始化加密系统");
    }

    // 将数据转换为JSON字符串
    const jsonStr = typeof data === "string" ? data : JSON.stringify(data);

    // 生成随机AES密钥 (256位/32字节)
    const aesKey = CryptoJS.lib.WordArray.random(32);

    // 生成随机IV (16字节)
    const iv = CryptoJS.lib.WordArray.random(IV_LENGTH);

    // 使用AES加密数据
    const encrypted = CryptoJS.AES.encrypt(jsonStr, aesKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    // 获取加密后的数据
    const encryptedContent = encrypted.ciphertext;

    // 将AES密钥转换为Uint8Array
    const aesKeyBytes = wordArrayToUint8Array(aesKey);

    // 使用RSA公钥加密AES密钥
    const encryptedAesKey = rsaEncrypt(aesKeyBytes, publicKey);

    // 创建完整的加密数据包
    // 简化格式：加密密钥 + IV(16字节) + 加密数据
    const ivBytes = wordArrayToUint8Array(iv);
    const contentBytes = wordArrayToUint8Array(encryptedContent);

    const resultBuffer = new ArrayBuffer(
      encryptedAesKey.length + ivBytes.length + contentBytes.length
    );
    const resultUint8 = new Uint8Array(resultBuffer);

    // 写入加密的AES密钥
    resultUint8.set(encryptedAesKey, 0);

    // 写入IV
    resultUint8.set(ivBytes, encryptedAesKey.length);

    // 写入加密内容
    resultUint8.set(contentBytes, encryptedAesKey.length + ivBytes.length);

    return resultBuffer;
  } catch (error) {
    console.error("客户端混合加密失败:", error);
    throw new Error("加密数据失败: " + (error as Error).message);
  }
}

/**
 * 从服务器响应中解密数据
 * 现在服务器发送的是传统AES加密的数据
 */
export function decryptData(encryptedBytes: ArrayBufferLike): unknown {
  try {
    // 转换ArrayBuffer为Uint8Array
    const bytes = new Uint8Array(encryptedBytes);

    // 转换为WordArray
    const encryptedWordArray = uint8ArrayToWordArray(bytes);

    // 提取IV (前16字节) 和加密内容
    const iv = encryptedWordArray.clone();
    iv.sigBytes = IV_LENGTH;
    iv.clamp();

    const encrypted = encryptedWordArray.clone();
    encrypted.words.splice(0, IV_LENGTH / 4);
    encrypted.sigBytes -= IV_LENGTH;

    // 准备密钥 - 使用共享配置中的固定密钥
    const serverKey = SERVER_AES_KEY.padEnd(16, "0").slice(0, 16);
    const key = CryptoJS.enc.Utf8.parse(serverKey);

    // 解密
    const decrypted = CryptoJS.AES.decrypt(
      encrypted.toString(CryptoJS.enc.Base64),
      key,
      {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      }
    );

    // 转换为字符串
    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);

    // 尝试解析JSON
    try {
      return JSON.parse(decryptedText);
    } catch {
      return decryptedText;
    }
  } catch (error) {
    console.error("客户端解密失败:", error);
    throw new Error("解密数据失败: " + (error as Error).message);
  }
}
