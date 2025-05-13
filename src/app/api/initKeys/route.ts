import { NextResponse } from "next/server";
import { generateRSAKeyPair, getPublicKey, hasExistingKeys } from "@/lib/rsaUtils";

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
            message: "请在Vercel仪表板中设置RSA_PRIVATE_KEY和RSA_PUBLIC_KEY环境变量"
          },
          { status: 500 }
        );
      }
    }
    
    try {
      // 获取公钥
      const publicKey = getPublicKey();
      
      // 返回公钥给客户端
      return NextResponse.json({
        success: true,
        publicKey
      });
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