# Vercel环境变量设置指南

## 问题背景

由于Vercel使用无服务器(serverless)架构，其文件系统是只读的，无法在运行时创建或修改文件。这意味着我们无法在运行时动态生成并存储RSA密钥对到文件系统中。

错误示例:
```
初始化RSA密钥失败: Error: ENOENT: no such file or directory, mkdir '/var/task/keys'
```

## 解决方案

我们需要将RSA密钥对存储在环境变量中，而不是文件系统中。请按照以下步骤在Vercel中配置环境变量：

### 1. 生成RSA密钥对

首先，在本地生成RSA密钥对。可以使用以下方法之一：

#### 方法一：使用OpenSSL（推荐）

如果你有OpenSSL工具，请在命令行执行以下命令：

```bash
# 生成私钥
openssl genpkey -algorithm RSA -out private.key -pkeyopt rsa_keygen_bits:2048

# 从私钥生成公钥
openssl rsa -pubout -in private.key -out public.key
```

#### 方法二：使用在线工具

如果无法使用OpenSSL，可以使用安全的在线RSA密钥生成工具，如：
- [https://cryptotools.net/rsagen](https://cryptotools.net/rsagen)
- 注意：选择2048位密钥长度，格式为PEM

#### 方法三：使用Node.js生成

可以在本地运行以下Node.js脚本生成密钥对：

```javascript
const crypto = require('crypto');
const fs = require('fs');

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

console.log('==== 私钥 ====');
console.log(privateKey);
console.log('==== 公钥 ====');
console.log(publicKey);

// 保存到文件（可选）
fs.writeFileSync('private.key', privateKey);
fs.writeFileSync('public.key', publicKey);
```

### 2. 将密钥添加到Vercel环境变量

1. 登录Vercel仪表板
2. 选择你的项目
3. 点击"Settings"选项卡
4. 找到"Environment Variables"部分
5. 添加以下两个环境变量：
   - `RSA_PRIVATE_KEY`：粘贴你的私钥内容（包括开头的`-----BEGIN PRIVATE KEY-----`和结尾的`-----END PRIVATE KEY-----`）
   - `RSA_PUBLIC_KEY`：粘贴你的公钥内容（包括开头的`-----BEGIN PUBLIC KEY-----`和结尾的`-----END PUBLIC KEY-----`）
   
> **重要提示**：由于RSA密钥可能包含换行符，在Vercel仪表板中添加时需要特别注意。确保完整复制和粘贴整个密钥，包括所有换行符。

### 3. 部署应用

设置好环境变量后，重新部署应用。现在，应用将使用环境变量中的RSA密钥，而不是尝试读取文件系统。

## 常见问题

### Q: 为什么我需要在环境变量中存储密钥？
A: Vercel的无服务器(serverless)架构提供的文件系统是只读的，无法在运行时创建或修改文件。

### Q: 将密钥存储在环境变量中安全吗？
A: Vercel的环境变量是加密存储的，通常比文件系统更安全。但请记住，私钥是敏感信息，永远不应该在客户端或公开代码中使用。

### Q: 部署后还是出现错误怎么办？
A: 请检查以下几点：
1. 环境变量名称是否正确（区分大小写）
2. 密钥格式是否完整（包括头尾标记和所有换行符）
3. 检查服务器日志以获取更详细的错误信息 