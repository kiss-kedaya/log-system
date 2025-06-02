import { NextResponse } from "next/server";
import {
  generateRSAKeyPair,
  getPublicKey,
  hasExistingKeys,
} from "@/lib/rsaUtils";
import { storeClientPublicKey } from "@/lib/hybridCrypto";
import { cookies } from "next/headers";

/**
 * 生成或获取唯一的客户端会话ID
 * 这将用于关联客户端公钥
 */
async function getClientSessionId(): Promise<string> {
  const cookieStore = await cookies();
  let sessionId = cookieStore.get("client_session_id")?.value;
  
  if (!sessionId) {
    // 生成新的会话ID
    sessionId = crypto.randomUUID();
  }
  
  return sessionId;
}

/**
 * 初始化RSA密钥对，并返回公钥
 * 客户端应在首次加载时调用此API获取公钥
 *
 * 在Vercel环境中，密钥对必须预先设置为环境变量，无法动态生成
 */
export async function GET() {
  try {
    // 检查是否已设置环境变量
    if (!hasExistingKeys()) {
      // 尝试生成密钥对（仅在开发环境中有效）
      generateRSAKeyPair();

      // 再次检查环境变量
      if (!hasExistingKeys()) {
        return NextResponse.json(
          {
            success: false,
            error: "RSA密钥未配置",
            message:
              "请在Vercel仪表板中设置RSA_PRIVATE_KEY和RSA_PUBLIC_KEY环境变量",
          },
          { status: 500 }
        );
      }
    }

    try {
      // 获取公钥
      const publicKey = getPublicKey();
      
      // 获取或生成客户端会话ID
      const sessionId = await getClientSessionId();
      
      // 创建响应
      const response = NextResponse.json({
        success: true,
        publicKey,
        sessionId,
      });
      
      // 将会话ID设置为cookie
      response.cookies.set("client_session_id", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 24 * 60 * 60, // 7天有效期
        path: "/",
      });

      return response;
    } catch (keyError) {
      console.error("获取公钥失败:", keyError);
      return NextResponse.json(
        { success: false, error: "获取公钥失败，请检查环境变量" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("初始化RSA密钥失败:", error);
    return NextResponse.json(
      { success: false, error: "初始化RSA密钥失败" },
      { status: 500 }
    );
  }
}

/**
 * 接收并存储客户端的RSA公钥
 */
export async function POST(req: Request) {
  try {
    const sessionId = await getClientSessionId();
    
    // 检查请求体
    const body = await req.json();
    if (!body.clientPublicKey) {
      return NextResponse.json(
        { success: false, error: "缺少客户端公钥" },
        { status: 400 }
      );
    }
    
    // 存储客户端公钥
    storeClientPublicKey(sessionId, body.clientPublicKey);
    
    // 创建响应
    const response = NextResponse.json({
      success: true,
      message: "客户端公钥已成功存储",
      sessionId,
    });
    
    // 确保会话ID在cookie中
    response.cookies.set("client_session_id", sessionId, {
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60, // 7天有效期
      path: "/",
    });
    
    return response;
  } catch (error) {
    console.error("存储客户端公钥失败:", error);
    return NextResponse.json(
      { success: false, error: "存储客户端公钥失败" },
      { status: 500 }
    );
  }
}
