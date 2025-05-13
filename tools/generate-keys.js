/**
 * RSA密钥生成工具
 * 
 * 此脚本生成RSA密钥对并以多种格式输出，方便在Vercel环境变量中使用
 * 
 * 使用方法: node generate-keys.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 确保输出目录存在
const outputDir = path.join(__dirname, 'keys');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

console.log('正在生成RSA密钥对...');

// 生成RSA密钥对
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

// 保存到文件
const privateKeyPath = path.join(outputDir, 'private.key');
const publicKeyPath = path.join(outputDir, 'public.key');

fs.writeFileSync(privateKeyPath, privateKey);
fs.writeFileSync(publicKeyPath, publicKey);

// BASE64编码版本（适用于环境变量）
const privateKeyBase64 = Buffer.from(privateKey).toString('base64');
const publicKeyBase64 = Buffer.from(publicKey).toString('base64');

// 保存BASE64版本
fs.writeFileSync(path.join(outputDir, 'private.key.base64'), privateKeyBase64);
fs.writeFileSync(path.join(outputDir, 'public.key.base64'), publicKeyBase64);

console.log('\n======= RSA密钥生成完成 =======');
console.log(`\n密钥已保存到目录: ${outputDir}`);

console.log('\n======= 标准PEM格式 (推荐使用) =======');
console.log('\n== 私钥 ==');
console.log(privateKey);
console.log('\n== 公钥 ==');
console.log(publicKey);

console.log('\n======= BASE64编码 (如果PEM格式在环境变量中出现问题，可使用此格式) =======');
console.log('\n== 私钥(BASE64) ==');
console.log(privateKeyBase64);
console.log('\n== 公钥(BASE64) ==');
console.log(publicKeyBase64);

console.log('\n======= Vercel环境变量设置 =======');
console.log('在Vercel仪表板中添加以下环境变量:');
console.log('1. RSA_PRIVATE_KEY: 私钥(PEM格式，包含换行符)');
console.log('2. RSA_PUBLIC_KEY: 公钥(PEM格式，包含换行符)');
console.log('3. DATABASE_URL: 数据库连接字符串');
console.log('4. AES_KEY: (可选)AES加密密钥');

console.log('\n如果PEM格式不工作，可使用BASE64编码版本:');
console.log('1. RSA_PRIVATE_KEY_BASE64: 私钥(BASE64格式)');
console.log('2. RSA_PUBLIC_KEY_BASE64: 公钥(BASE64格式)');
console.log('但需要先修改rsaUtils.ts中的getPrivateKey和getPublicKey函数来使用BASE64版本'); 