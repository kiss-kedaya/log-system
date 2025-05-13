import { NextResponse } from "next/server";
import { generateRSAKeyPair, getPublicKey } from "@/lib/rsaUtils";

/**
 * 初始化RSA密钥对，并返回公钥
 * 客户端应在首次加载时调用此API获取公钥
 */
export async function GET() {
  try {
    // 生成RSA密钥对（如果尚未生成）
    generateRSAKeyPair();
    
    // 获取公钥
    const publicKey = getPublicKey();
    
    // 返回公钥给客户端
    return NextResponse.json({
      success: true,
      publicKey
    });
  } catch (error) {
    console.error("初始化RSA密钥失败:", error);
    return NextResponse.json(
      { success: false, error: "初始化RSA密钥失败" },
      { status: 500 }
    );
  }
} 