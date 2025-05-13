# 日志系统

这是一个基于 Next.js 框架的日志系统，使用 Neon 数据库存储日志数据，并可部署在 Vercel 平台上。

## 功能特点

- 日志上传接口：通过 POST 请求发送 JSON 数据
- 日志查看前端界面：直观展示和查询日志
- 响应式设计：适配不同设备屏幕
- 深色模式支持

## 快速开始

### 前提条件

1. [Node.js](https://nodejs.org/) 18.0.0 或更高版本
2. [Neon](https://neon.tech/) 数据库账户

### 安装步骤

1. 克隆仓库

```bash
git clone <仓库地址>
cd log-system
```

2. 安装依赖

```bash
npm install
```

3. 创建 `.env.local` 文件并配置数据库连接

```
DATABASE_URL="postgresql://user:password@endpoint.neon.tech/dbname?sslmode=require"
```

获取 Neon 数据库连接字符串的步骤:
- 注册/登录 [Neon](https://neon.tech/)
- 创建一个新项目
- 在项目的"Connection Details"部分获取连接字符串
- 将连接字符串复制到 `.env.local` 文件中

4. 运行开发服务器

```bash
npm run dev
```

访问 http://localhost:3000 查看应用

### 生产部署

项目可以轻松部署到 Vercel 平台：

1. 在 [Vercel](https://vercel.com) 创建账户
2. 导入你的 GitHub 仓库
3. 在环境变量中添加 `DATABASE_URL`
4. 部署应用

## API 使用说明

### 日志上传

- 端点: `/api/logs`
- 方法: `POST`
- 内容类型: `application/json`
- 请求体: 任意 JSON 格式数据

示例请求:

```bash
curl -X POST http://localhost:3000/api/logs \
  -H "Content-Type: application/json" \
  -d '{"level":"info","message":"用户登录","user_id":123}'
```

成功响应:

```json
{
  "success": true,
  "message": "日志保存成功",
  "data": {
    "id": 1,
    "data": {"level":"info","message":"用户登录","user_id":123},
    "created_at": "2023-08-01T12:34:56.789Z"
  }
}
```

### 获取日志

- 端点: `/api/logs`
- 方法: `GET`

示例请求:

```bash
curl http://localhost:3000/api/logs
```

成功响应:

```json
{
  "success": true,
  "data": [
    {
      "id": 2,
      "data": {"level":"error","message":"服务器错误","code":500},
      "created_at": "2023-08-01T13:45:67.890Z"
    },
    {
      "id": 1,
      "data": {"level":"info","message":"用户登录","user_id":123},
      "created_at": "2023-08-01T12:34:56.789Z"
    }
  ]
}
```

## 技术栈

- [Next.js](https://nextjs.org/) - React 框架
- [Neon](https://neon.tech/) - 无服务器 PostgreSQL 数据库
- [Tailwind CSS](https://tailwindcss.com/) - 样式框架
- [TypeScript](https://www.typescriptlang.org/) - 类型检查

## 许可证

[MIT](LICENSE)
