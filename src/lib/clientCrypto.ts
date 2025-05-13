"use client";

import CryptoJS from "crypto-js";

// AES密钥，应从环境变量或安全配置获取
const AES_KEY = process.env.NEXT_PUBLIC_AES_KEY || 'a1b2c3d4e5f6g7h8';

// 初始化向量（IV）长度
const IV_LENGTH = 16;

type DecryptedData = string | Record<string, unknown>;

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
 * 在客户端使用AES-CBC算法解密数据
 * @param encryptedBytes 加密的二进制数据
 * @returns 解密后的数据
 */
export function decryptData(encryptedBytes: ArrayBufferLike): DecryptedData {
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

    // 准备密钥
    const key = CryptoJS.enc.Utf8.parse(AES_KEY);

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
      return JSON.parse(decryptedText) as Record<string, unknown>;
    } catch {
      return decryptedText;
    }
  } catch (error) {
    console.error("客户端解密失败:", error);
    throw new Error("解密数据失败");
  }
}

/**
 * 支持传统Base64字符串的解密函数（用于兼容性）
 */
export function decryptBase64Data(encryptedBase64: string): DecryptedData {
  try {
    // 将Base64字符串转换为WordArray
    const encryptedWordArray = CryptoJS.enc.Base64.parse(encryptedBase64);

    // 转换为Uint8Array，再转为ArrayBuffer
    const bytes = wordArrayToUint8Array(encryptedWordArray);

    // 使用主解密函数
    return decryptData(bytes.buffer);
  } catch (error) {
    console.error("Base64解密失败:", error);
    throw new Error("解密数据失败");
  }
}

/**
 * 在客户端使用AES-CBC算法加密数据
 * @param data 要加密的数据
 * @returns 加密后的二进制数据
 */
export function encryptData(data: unknown): ArrayBufferLike {
  try {
    // 将数据转换为JSON字符串
    const jsonStr = typeof data === "string" ? data : JSON.stringify(data);
    
    // 准备密钥
    const key = CryptoJS.enc.Utf8.parse(AES_KEY);
    
    // 生成随机IV (16字节)
    const iv = CryptoJS.lib.WordArray.random(IV_LENGTH);
    
    // 加密
    const encrypted = CryptoJS.AES.encrypt(jsonStr, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    
    // 获取加密后的内容
    const encryptedData = encrypted.ciphertext;
    
    // 组合IV和加密内容
    const combined = CryptoJS.lib.WordArray.create()
      .concat(iv)
      .concat(encryptedData);
    
    // 转换为Uint8Array并返回ArrayBuffer
    return wordArrayToUint8Array(combined).buffer;
  } catch (error) {
    console.error("客户端加密失败:", error);
    throw new Error("加密数据失败");
  }
}

/**
 * 加密并返回Base64字符串（用于兼容性）
 */
export function encryptToBase64(data: unknown): string {
  try {
    // 准备密钥
    const key = CryptoJS.enc.Utf8.parse(AES_KEY);
    
    // 生成随机IV (16字节)
    const iv = CryptoJS.lib.WordArray.random(IV_LENGTH);

    // 将数据转换为JSON字符串
    const jsonStr = typeof data === "string" ? data : JSON.stringify(data);

    // 加密
    const encrypted = CryptoJS.AES.encrypt(jsonStr, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    // 获取加密后的内容
    const encryptedData = encrypted.ciphertext;

    // 组合IV和加密内容
    const combined = CryptoJS.lib.WordArray.create()
      .concat(iv)
      .concat(encryptedData);

    // 返回Base64字符串
    return CryptoJS.enc.Base64.stringify(combined);
  } catch (error) {
    console.error("客户端加密失败:", error);
    throw new Error("加密数据失败");
  }
}
