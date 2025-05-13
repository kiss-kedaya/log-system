import { NextRequest } from "next/server";
import { hybridDecrypt, hybridEncrypt } from "@/lib/hybridCrypto";
import * as jose from "jose";

// 系统密钥，应该放在环境变量中
const SYSTEM_SECRET_KEY = process.env.SYSTEM_SECRET_KEY || "kedaya";
// JWT密钥，用于签名令牌
const JWT_SECRET = process.env.JWT_SECRET || "kedaya";
// 令牌有效期 (24小时)
const TOKEN_EXPIRY = "365d";

// 验证密钥并生成令牌
export async function POST(request: NextRequest) {
  try {
    console.log("[验证API] 收到验证请求");

    // 获取请求体的二进制数据
    const arrayBuffer = await request.arrayBuffer();

    // 将二进制数据转换为Buffer
    const buffer = Buffer.from(arrayBuffer);

    // 使用RSA私钥解密数据
    const data = hybridDecrypt(buffer);
    console.log("[验证API] 解密数据:", data);

    if (!data || typeof data !== "object" || !("secretKey" in data)) {
      throw new Error("无效的请求数据");
    }

    // 验证密钥是否正确
    const userSecretKey = (data as { secretKey: string }).secretKey;

    if (userSecretKey !== SYSTEM_SECRET_KEY) {
      console.log("[验证API] 密钥验证失败");
      const encryptedError = hybridEncrypt({
        success: false,
        error: "密钥错误",
      });

      return new Response(encryptedError, {
        status: 401,
        headers: { "Content-Type": "application/octet-stream" },
      });
    }

    // 生成JWT令牌
    const payload = {
      authorized: true,
      timestamp: Date.now(),
    };

    // 创建一个编码器
    const encoder = new TextEncoder();
    // 将密钥转换为Uint8Array
    const jwtSecretKey = encoder.encode(JWT_SECRET);

    // 创建JWT令牌
    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(TOKEN_EXPIRY)
      .sign(jwtSecretKey);

    console.log("[验证API] 生成JWT令牌:", token.substring(0, 20) + "...");

    // 加密成功响应
    const encryptedResponse = hybridEncrypt({
      success: true,
      message: "验证成功",
      token: token,
    });

    // 返回二进制数据
    return new Response(encryptedResponse, {
      status: 200,
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch (error) {
    console.error("[验证API] 验证失败:", error);

    // 加密错误消息
    const encryptedError = hybridEncrypt({
      success: false,
      error: "验证失败",
    });

    // 返回二进制数据
    return new Response(encryptedError, {
      status: 500,
      headers: { "Content-Type": "application/octet-stream" },
    });
  }
}
