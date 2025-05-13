# Vercel环境变量设置指南

## 问题背景

由于Vercel使用无服务器(serverless)架构，其文件系统是只读的，无法在运行时创建或修改文件。这意味着我们无法在运行时动态生成并存储RSA密钥对到文件系统中。

错误示例:
```
初始化RSA密钥失败: Error: ENOENT: no such file or directory, mkdir '/var/task/keys'
```

## 解决方案

我们需要在Vercel中设置以下环境变量：

### 1. RSA密钥对环境变量

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

### 2. 数据库连接环境变量

系统需要设置数据库连接字符串，以便能正确存储和检索日志数据。

#### 数据库推荐
我们推荐使用Neon（PostgreSQL）或者其他兼容Vercel的数据库服务：
- [Neon](https://neon.tech/) - 提供免费的PostgreSQL数据库服务
- [Supabase](https://supabase.com/) - 同样提供PostgreSQL服务
- [PlanetScale](https://planetscale.com/) - MySQL兼容数据库

#### 获取连接字符串
1. 注册并登录您选择的数据库服务
2. 创建一个新的数据库项目
3. 找到并复制数据库连接字符串(Connection String)
   - 这通常在数据库仪表板的"连接"或"设置"部分
   - 格式类似：`postgresql://username:password@hostname:port/database`

### 3. 将环境变量添加到Vercel

1. 登录Vercel仪表板
2. 选择你的项目
3. 点击"Settings"选项卡
4. 找到"Environment Variables"部分
5. 添加以下环境变量：
   - `RSA_PRIVATE_KEY`：粘贴你的私钥内容（包括开头的`-----BEGIN PRIVATE KEY-----`和结尾的`-----END PRIVATE KEY-----`）
   - `RSA_PUBLIC_KEY`：粘贴你的公钥内容（包括开头的`-----BEGIN PUBLIC KEY-----`和结尾的`-----END PUBLIC KEY-----`）
   - `DATABASE_URL`：粘贴你的数据库连接字符串
   - `AES_KEY`：设置一个AES加密密钥，例如：`your-secret-aes-key-for-encryption`（可选，建议30个字符以上的随机字符串）
   
> **重要提示**：
> - 由于RSA密钥可能包含换行符，在Vercel仪表板中添加时需要特别注意。确保完整复制和粘贴整个密钥，包括所有换行符。
> - 数据库连接字符串中包含敏感信息，请确保它不会泄露或提交到代码仓库中。

### 4. RSA密钥格式问题的特别说明

RSA密钥的格式必须严格按照PEM标准，包括：
1. 正确的开头和结尾标记
2. 每64个字符一个换行符
3. 保留所有原始格式

#### 复制RSA密钥的正确方法

当你生成了密钥后，请遵循以下步骤确保格式正确：

1. 使用文本编辑器（如VS Code、Notepad++等）打开密钥文件
2. 确保看到完整的密钥，包括：
   - 私钥的`-----BEGIN PRIVATE KEY-----`和`-----END PRIVATE KEY-----`
   - 公钥的`-----BEGIN PUBLIC KEY-----`和`-----END PUBLIC KEY-----`
3. 选择整个文件内容（Ctrl+A）并复制（Ctrl+C）
4. 在Vercel环境变量输入框中粘贴（Ctrl+V）

#### 如何处理Vercel仪表板中的换行符问题

如果你无法在Vercel的环境变量输入框中保留换行符，可以使用以下替代方法：

1. **使用Vercel CLI设置环境变量**：
   ```bash
   vercel env add RSA_PRIVATE_KEY
   ```
   使用此命令时，可以将内容粘贴到打开的编辑器中，这样可以保留所有格式。

2. **使用BASE64编码**（高级选项）：
   如果上述方法都不起作用，可以考虑修改代码，使用BASE64编码的密钥：
   ```javascript
   // 在本地将密钥进行BASE64编码
   const fs = require('fs');
   const privateKeyBase64 = fs.readFileSync('private.key').toString('base64');
   console.log(privateKeyBase64); // 将此设置为环境变量

   // 然后修改rsaUtils.ts中的getPrivateKey函数
   function getPrivateKey() {
     const privateKeyBase64 = process.env.RSA_PRIVATE_KEY_BASE64;
     if (!privateKeyBase64) throw new Error('私钥未设置');
     return Buffer.from(privateKeyBase64, 'base64').toString();
   }
   ```

### 5. 部署应用

设置好环境变量后，重新部署应用。现在，应用将使用环境变量中的RSA密钥和数据库连接信息。

## 常见问题

### Q: 为什么我需要在环境变量中存储密钥？
A: Vercel的无服务器(serverless)架构提供的文件系统是只读的，无法在运行时创建或修改文件。

### Q: 将密钥存储在环境变量中安全吗？
A: Vercel的环境变量是加密存储的，通常比文件系统更安全。但请记住，私钥是敏感信息，永远不应该在客户端或公开代码中使用。

### Q: 部署后出现"DECODER routines::unsupported"错误怎么办？
A: 这通常表示RSA私钥格式不正确。请确保：
1. 私钥完整，包括头部和尾部标记
2. 保留了所有换行符
3. 按照上述"RSA密钥格式问题的特别说明"部分的指导操作

### Q: 部署后出现"保存日志失败"错误怎么办？
A: 这通常意味着数据库连接失败。请检查：
1. 是否正确设置了`DATABASE_URL`环境变量
2. 数据库连接字符串格式是否正确
3. 数据库服务是否处于活动状态
4. 数据库防火墙是否允许Vercel服务器的连接

### Q: 部署后还是出现其他错误怎么办？
A: 请检查以下几点：
1. 环境变量名称是否正确（区分大小写）
2. 密钥格式是否完整（包括头尾标记和所有换行符）
3. 检查服务器日志以获取更详细的错误信息 