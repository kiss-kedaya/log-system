import crypto from 'crypto';

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
    console.log('RSA密钥对已存在于环境变量中，跳过生成步骤');
    return;
  }

  console.log('生成新的RSA密钥对...');
  
  // 生成2048位RSA密钥对
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  // 在开发环境中，将生成的密钥临时存储在内存中的环境变量
  // 在生产环境，这一步是无效的，因为无法动态修改环境变量
  // 需要在Vercel仪表板中手动设置
  process.env.RSA_PRIVATE_KEY = privateKey;
  process.env.RSA_PUBLIC_KEY = publicKey;
  
  console.log('RSA密钥对生成成功（开发环境）');
  console.log('警告：在生产环境(Vercel)中，请在环境变量中手动设置RSA_PRIVATE_KEY和RSA_PUBLIC_KEY');
}

/**
 * 获取公钥
 * 从环境变量中读取
 */
export function getPublicKey(): string {
  const publicKey = process.env.RSA_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error('公钥未设置，请在环境变量中设置RSA_PUBLIC_KEY');
  }
  return publicKey;
}

/**
 * 获取私钥
 * 从环境变量中读取
 */
export function getPrivateKey(): string {
  const privateKey = process.env.RSA_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('私钥未设置，请在环境变量中设置RSA_PRIVATE_KEY');
  }
  return privateKey;
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
      oaepHash: 'sha256'
    },
    buffer
  );
}

/**
 * 使用RSA私钥解密数据
 */
export function decryptWithPrivateKey(encryptedData: Buffer, privateKey: string): string {
  return crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256'
    },
    encryptedData
  ).toString();
} 