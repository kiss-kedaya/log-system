import crypto from "crypto";

/**
 * 检查是否已经存在RSA密钥
 * 使用BASE64编码版本的环境变量
 */
export function hasExistingKeys(): boolean {
  return (
    !!process.env.RSA_PRIVATE_KEY_BASE64 && !!process.env.RSA_PUBLIC_KEY_BASE64
  );
}

/**
 * 生成RSA密钥对并存储到环境变量(BASE64编码版本)
 * 注意：在生产环境，这些环境变量需要在Vercel仪表板中设置
 * 这个函数主要用于开发环境或首次部署时
 */
export function generateRSAKeyPair() {
  // 检查密钥是否已存在于环境变量中
  if (hasExistingKeys()) {
    console.log("RSA密钥对已存在于环境变量中，跳过生成步骤");
    return;
  }

  console.log("生成新的RSA密钥对...");

  // 生成2048位RSA密钥对
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });

  // 将密钥转换为BASE64编码
  const privateKeyBase64 = Buffer.from(privateKey).toString("base64");
  const publicKeyBase64 = Buffer.from(publicKey).toString("base64");

  // 在开发环境中，将生成的密钥临时存储在内存中的环境变量
  // 在生产环境，这一步是无效的，因为无法动态修改环境变量
  // 需要在Vercel仪表板中手动设置
  process.env.RSA_PRIVATE_KEY_BASE64 = privateKeyBase64;
  process.env.RSA_PUBLIC_KEY_BASE64 = publicKeyBase64;

  console.log("RSA密钥对生成成功（开发环境）");
  console.log(
    "警告：在生产环境(Vercel)中，请在环境变量中手动设置RSA_PRIVATE_KEY_BASE64和RSA_PUBLIC_KEY_BASE64"
  );
}

/**
 * 获取公钥
 * 从环境变量中读取BASE64编码版本，并解码为PEM格式
 */
export function getPublicKey(): string {
  const publicKeyBase64 = process.env.RSA_PUBLIC_KEY_BASE64;
  if (!publicKeyBase64) {
    throw new Error("公钥未设置，请在环境变量中设置RSA_PUBLIC_KEY_BASE64");
  }

  try {
    // 从BASE64解码为原始PEM格式
    return Buffer.from(publicKeyBase64, "base64").toString("utf8");
  } catch (error) {
    console.error("解码公钥失败:", error);
    throw new Error("公钥格式错误，请确保设置了正确的BASE64编码公钥");
  }
}

/**
 * 获取私钥
 * 从环境变量中读取BASE64编码版本，并解码为PEM格式
 */
export function getPrivateKey(): string {
  const privateKeyBase64 = process.env.RSA_PRIVATE_KEY_BASE64;
  if (!privateKeyBase64) {
    throw new Error("私钥未设置，请在环境变量中设置RSA_PRIVATE_KEY_BASE64");
  }

  try {
    // 从BASE64解码为原始PEM格式
    return Buffer.from(privateKeyBase64, "base64").toString("utf8");
  } catch (error) {
    console.error("解码私钥失败:", error);
    throw new Error("私钥格式错误，请确保设置了正确的BASE64编码私钥");
  }
}

/**
 * 使用RSA公钥加密数据（仅加密小数据，如AES密钥）
 */
export function encryptWithPublicKey(data: string, publicKey: string): Buffer {
  const buffer = Buffer.from(data);
  return crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    buffer
  );
}

/**
 * 使用RSA私钥解密数据
 */
export function decryptWithPrivateKey(
  encryptedData: Buffer,
  privateKey: string
): string {
  return crypto
    .privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      encryptedData
    )
    .toString();
}
