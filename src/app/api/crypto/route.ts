import { NextRequest } from "next/server";
import { encrypt, decrypt } from "@/lib/crypto";

/**
 * 加密API
 * 接收前端发送的JSON数据，返回加密后的字符串
 */
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    
    // 根据路径判断是加密还是解密请求
    if (url.pathname.endsWith('/encrypt')) {
      // 加密请求
      const data = await request.json();
      const encryptedData = encrypt(data);
      
      return new Response(encryptedData, {
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    } else if (url.pathname.endsWith('/decrypt')) {
      // 解密请求
      const encryptedData = await request.text();
      const decryptedData = decrypt(encryptedData);
      
      return Response.json(decryptedData);
    } else {
      // 无效的路径
      return new Response(
        JSON.stringify({ success: false, error: "无效的API路径" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  } catch (error) {
    console.error("加密/解密失败:", error);
    
    return new Response(
      JSON.stringify({ success: false, error: "加密/解密处理失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
} 