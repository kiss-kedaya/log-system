import crypto from "crypto";

/**
 * 检查是否已经存在RSA密钥
 * 在Vercel环境中，我们使用环境变量存储密钥，而不是文件系统
 */
export function hasExistingKeys(): boolean {
  return !!process.env.RSA_PRIVATE_KEY && !!process.env.RSA_PUBLIC_KEY;
}

/**
 * 生成RSA密钥对并存储到环境变量
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

  // 在开发环境中，将生成的密钥临时存储在内存中的环境变量
  // 在生产环境，这一步是无效的，因为无法动态修改环境变量
  // 需要在Vercel仪表板中手动设置
  process.env.RSA_PRIVATE_KEY = privateKey;
  process.env.RSA_PUBLIC_KEY = publicKey;

  console.log("RSA密钥对生成成功（开发环境）");
  console.log(
    "警告：在生产环境(Vercel)中，请在环境变量中手动设置RSA_PRIVATE_KEY和RSA_PUBLIC_KEY"
  );
}

/**
 * 获取公钥
 * 从环境变量中读取，并确保格式正确
 */
export function getPublicKey(): string {
  const publicKey = process.env.RSA_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error("公钥未设置，请在环境变量中设置RSA_PUBLIC_KEY");
  }

  // 确保公钥格式正确
  let formattedKey = publicKey;

  // 检查是否已经有正确的格式头部和尾部
  const hasHeader = formattedKey.includes("-----BEGIN PUBLIC KEY-----");
  const hasFooter = formattedKey.includes("-----END PUBLIC KEY-----");

  // 如果缺少头部或尾部，添加它们
  if (!hasHeader) {
    formattedKey = "-----BEGIN PUBLIC KEY-----\n" + formattedKey;
  }
  if (!hasFooter) {
    formattedKey = formattedKey + "\n-----END PUBLIC KEY-----";
  }

  // 确保PEM格式的每64个字符后有一个换行符
  // 首先去除所有现有的换行符，然后按照PEM格式要求重新添加
  if (!formattedKey.includes("\n")) {
    // 提取头部、内容和尾部
    const header = "-----BEGIN PUBLIC KEY-----";
    const footer = "-----END PUBLIC KEY-----";
    const content = formattedKey
      .replace(header, "")
      .replace(footer, "")
      .replace(/\s+/g, ""); // 移除所有空白字符

    // 按照PEM格式重新格式化内容（每64个字符一行）
    let formattedContent = "";
    for (let i = 0; i < content.length; i += 64) {
      formattedContent += content.substring(i, i + 64) + "\n";
    }

    // 重新组装PEM格式的私钥
    formattedKey = header + "\n" + formattedContent + footer;
  }

  return formattedKey;
}

/**
 * 获取私钥
 * 从环境变量中读取，并确保格式正确
 */
export function getPrivateKey(): string {
  const privateKey = process.env.RSA_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("私钥未设置，请在环境变量中设置RSA_PRIVATE_KEY");
  }

  // 确保私钥格式正确
  let formattedKey = privateKey;

  // 检查是否已经有正确的格式头部和尾部
  const hasHeader = formattedKey.includes("-----BEGIN PRIVATE KEY-----");
  const hasFooter = formattedKey.includes("-----END PRIVATE KEY-----");

  // 如果缺少头部或尾部，添加它们
  if (!hasHeader) {
    formattedKey = "-----BEGIN PRIVATE KEY-----\n" + formattedKey;
  }
  if (!hasFooter) {
    formattedKey = formattedKey + "\n-----END PRIVATE KEY-----";
  }

  // 确保PEM格式的每64个字符后有一个换行符
  // 首先去除所有现有的换行符，然后按照PEM格式要求重新添加
  if (!formattedKey.includes("\n")) {
    // 提取头部、内容和尾部
    const header = "-----BEGIN PRIVATE KEY-----";
    const footer = "-----END PRIVATE KEY-----";
    const content = formattedKey
      .replace(header, "")
      .replace(footer, "")
      .replace(/\s+/g, ""); // 移除所有空白字符

    // 按照PEM格式重新格式化内容（每64个字符一行）
    let formattedContent = "";
    for (let i = 0; i < content.length; i += 64) {
      formattedContent += content.substring(i, i + 64) + "\n";
    }

    // 重新组装PEM格式的私钥
    formattedKey = header + "\n" + formattedContent + footer;
  }

  return formattedKey;
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
