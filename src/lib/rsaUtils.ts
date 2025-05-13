import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// 定义密钥路径
const KEYS_DIR = path.join(process.cwd(), 'keys');
const PRIVATE_KEY_PATH = path.join(KEYS_DIR, 'private.key');
const PUBLIC_KEY_PATH = path.join(KEYS_DIR, 'public.key');

// 确保密钥目录存在
export function ensureKeysDirectory() {
  if (!fs.existsSync(KEYS_DIR)) {
    fs.mkdirSync(KEYS_DIR, { recursive: true });
  }
}

// 生成RSA密钥对
export function generateRSAKeyPair() {
  ensureKeysDirectory();
  
  // 检查私钥是否已存在
  if (fs.existsSync(PRIVATE_KEY_PATH) && fs.existsSync(PUBLIC_KEY_PATH)) {
    console.log('RSA密钥对已存在，跳过生成步骤');
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

  // 保存密钥到文件
  fs.writeFileSync(PRIVATE_KEY_PATH, privateKey);
  fs.writeFileSync(PUBLIC_KEY_PATH, publicKey);
  
  console.log('RSA密钥对生成成功');
}

// 读取公钥（用于客户端）
export function getPublicKey(): string {
  if (!fs.existsSync(PUBLIC_KEY_PATH)) {
    throw new Error('公钥文件不存在，请先生成密钥对');
  }
  return fs.readFileSync(PUBLIC_KEY_PATH, 'utf8');
}

// 读取私钥（仅服务器使用）
export function getPrivateKey(): string {
  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    throw new Error('私钥文件不存在，请先生成密钥对');
  }
  return fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');
}

// 使用RSA公钥加密数据（仅加密小数据，如AES密钥）
export function encryptWithPublicKey(data: string, publicKey: string): Buffer {
  const buffer = Buffer.from(data);
  return crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
    },
    buffer
  );
}

// 使用RSA私钥解密数据
export function decryptWithPrivateKey(encryptedData: Buffer, privateKey: string): string {
  return crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
    },
    encryptedData
  ).toString();
} 