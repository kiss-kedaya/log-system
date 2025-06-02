"use client";

import CryptoJS from "crypto-js";
import * as forge from "node-forge";

// 定义WebCrypto API类型
type AlgorithmIdentifier = string | Algorithm;

const IV_LENGTH = Number(process.env.IV_LENGTH) || 16;
const SERVER_AES_KEY = process.env.SERVER_AES_KEY || "defaultAESKey123";

// 存储RSA公钥
let rsaPublicKey: string | null = null;

// 存储客户端的RSA密钥对
let clientRsaKeyPair: {
  privateKey: string;
  publicKey: string;
} | null = null;

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
 * 1. 从服务器获取RSA公钥
 * 2. 生成客户端RSA密钥对
 * 3. 将客户端公钥发送到服务器
 */
export async function initCryptoSystem(): Promise<boolean> {
  try {
    // 检查是否已有服务器公钥
    const existingServerKey = getRSAPublicKey();
    
    // 1. 从服务器获取RSA公钥
    if (!existingServerKey) {
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

      // 保存服务器公钥
      setRSAPublicKey(data.publicKey);
    }

    // 2. 生成客户端RSA密钥对（如果还没有生成）
    if (!clientRsaKeyPair) {
      clientRsaKeyPair = await generateRSAKeyPair();
    }

    // 3. 将客户端公钥发送到服务器
    const uploadResponse = await fetch("/api/initKeys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientPublicKey: clientRsaKeyPair.publicKey,
      }),
    });

    if (!uploadResponse.ok) {
      throw new Error("向服务器上传客户端公钥失败");
    }

    return true;
  } catch (error) {
    console.error("初始化加密系统失败:", error);
    // 显示更友好的错误信息
    alert("无法初始化加密系统: " + (error as Error).message);
    return false;
  }
}

/**
 * 生成RSA密钥对
 * 使用WebCrypto API生成RSA密钥对
 */
async function generateRSAKeyPair(): Promise<{
  privateKey: string;
  publicKey: string;
}> {
  try {
    // 使用浏览器的WebCrypto API
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSA-OAEP",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]), // 65537
        hash: "SHA-256",
      },
      true, // 可导出
      ["encrypt", "decrypt"]
    );

    // 导出公钥为PEM格式
    const publicKeySpki = await window.crypto.subtle.exportKey(
      "spki",
      keyPair.publicKey
    );
    const publicKeyBase64 = btoa(
      String.fromCharCode(...new Uint8Array(publicKeySpki))
    );
    const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64.match(/.{1,64}/g)?.join("\n")}\n-----END PUBLIC KEY-----`;

    // 导出私钥为PEM格式
    const privateKeyPkcs8 = await window.crypto.subtle.exportKey(
      "pkcs8",
      keyPair.privateKey
    );
    const privateKeyBase64 = btoa(
      String.fromCharCode(...new Uint8Array(privateKeyPkcs8))
    );
    const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${privateKeyBase64.match(/.{1,64}/g)?.join("\n")}\n-----END PRIVATE KEY-----`;

    return {
      privateKey: privateKeyPem,
      publicKey: publicKeyPem,
    };
  } catch (error) {
    console.error("生成RSA密钥对失败:", error);
    throw new Error(`生成RSA密钥对失败: ${(error as Error).message}`);
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
 * 处理服务器返回的混合加密数据
 */
export function decryptData(encryptedBytes: ArrayBufferLike): unknown {
  try {
    // 转换ArrayBuffer为Uint8Array
    const bytes = new Uint8Array(encryptedBytes);
    
    // 检查是否有客户端RSA密钥对
    if (clientRsaKeyPair) {
      try {
        // 尝试使用客户端RSA密钥解密（服务器使用混合加密）
        return decryptWithClientKey(bytes);
      } catch (rsaError) {
        console.warn("尝试用客户端RSA密钥解密失败，回退到使用共享密钥:", rsaError);
        // 如果失败，回退到传统的共享密钥解密
      }
    }
    
    // 传统的共享密钥解密（回退机制）
    return decryptWithSharedKey(bytes);
  } catch (error) {
    console.error("客户端解密失败:", error);
    throw new Error("解密数据失败: " + (error as Error).message);
  }
}

/**
 * 使用客户端RSA私钥解密服务器发送的混合加密数据
 * 
 * 格式: [RSA加密的AES密钥][IV][AES加密的数据]
 */
async function decryptWithClientKey(data: Uint8Array): Promise<unknown> {
  try {
    // 验证客户端密钥是否可用
    if (!clientRsaKeyPair || !clientRsaKeyPair.privateKey) {
      throw new Error("客户端RSA密钥对未初始化");
    }

    // 获取已导入的私钥
    const privateKey = await importPrivateKey(clientRsaKeyPair.privateKey);
    
    // 确定RSA加密数据的长度 (通常为256字节对于2048位RSA密钥)
    const rsaBlockSize = 256;
    
    // 提取密钥、IV和加密数据
    const encryptedAesKey = data.slice(0, rsaBlockSize);
    const iv = data.slice(rsaBlockSize, rsaBlockSize + IV_LENGTH);
    const encryptedContent = data.slice(rsaBlockSize + IV_LENGTH);
    
    // 使用客户端RSA私钥解密AES密钥
    // @ts-expect-error - WebCrypto API类型问题
    const aesKeyBuffer = await window.crypto.subtle.decrypt(
      { 
        name: "RSA-OAEP",
        hash: "SHA-256", 
      },
      privateKey,
      encryptedAesKey
    );

    // 将AES密钥转换为CryptoJS格式
    const aesKey = uint8ArrayToWordArray(new Uint8Array(aesKeyBuffer));
    const ivWordArray = uint8ArrayToWordArray(iv);
    const encryptedContentWordArray = uint8ArrayToWordArray(encryptedContent);
    
    // 格式化为CryptoJS能理解的格式
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: encryptedContentWordArray,
      iv: ivWordArray,
      key: aesKey
    });
    
    // 使用AES解密数据
    const decrypted = CryptoJS.AES.decrypt(
      cipherParams,
      aesKey,
      {
        iv: ivWordArray,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
      }
    );
    
    // 转换为UTF-8字符串
    const decryptedText = decrypted.toString(CryptoJS.enc.Utf8);
    
    // 尝试解析为JSON
    try {
      return JSON.parse(decryptedText);
    } catch {
      // 如果不是JSON，直接返回文本
      return decryptedText;
    }
  } catch (error) {
    console.error("使用客户端密钥解密失败:", error);
    throw error;
  }
}

/**
 * 将PEM格式私钥导入为CryptoKey对象
 */
async function importPrivateKey(pemKey: string): Promise<CryptoKey> {
  try {
    // 提取PEM中的base64编码部分
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = pemKey.substring(
      pemHeader.length,
      pemKey.length - pemFooter.length
    ).replace(/\s/g, "");
    
    // base64解码为二进制数组
    const binaryDerString = atob(pemContents);
    const binaryDer = new Uint8Array(binaryDerString.length);
    
    for (let i = 0; i < binaryDerString.length; i++) {
      binaryDer[i] = binaryDerString.charCodeAt(i);
    }
    
    // 导入私钥
    // @ts-expect-error - WebCrypto API类型问题
    return await window.crypto.subtle.importKey(
      "pkcs8",
      binaryDer,
      {
        name: "RSA-OAEP",
        hash: "SHA-256",
      },
      false,
      ["decrypt"]
    );
  } catch (error) {
    console.error("导入私钥失败:", error);
    throw new Error("导入私钥失败: " + (error as Error).message);
  }
}

/**
 * 使用共享AES密钥解密数据（传统方式，作为回退机制）
 */
function decryptWithSharedKey(bytes: Uint8Array): unknown {
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
}
