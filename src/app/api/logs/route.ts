import { NextRequest } from "next/server";
import { initDatabase, sql } from "@/lib/db";
import { hybridDecrypt, hybridEncrypt } from "@/lib/hybridCrypto";
import { generateRSAKeyPair } from "@/lib/rsaUtilsBase64";

// 初始化数据库
initDatabase().catch(console.error);

// 确保RSA密钥已生成
generateRSAKeyPair();

// GET 请求处理程序 - 获取所有日志
export async function GET() {
  try {
    // 执行查询获取所有日志，按创建时间降序排列
    const logs = await sql`
      SELECT * FROM logs ORDER BY created_at DESC
    `;

    // 加密日志数据
    const encryptedData = hybridEncrypt({ success: true, data: logs });
    
    // 返回二进制数据
    return new Response(encryptedData, { 
      status: 200, 
      headers: { 
        "Content-Type": "application/octet-stream"
      } 
    });
  } catch (error) {
    console.error("获取日志失败:", error);
    
    // 加密错误消息
    const encryptedError = hybridEncrypt({ 
      success: false, 
      error: "获取日志失败" 
    });
    
    // 返回二进制数据
    return new Response(encryptedError, { 
      status: 500, 
      headers: { "Content-Type": "application/octet-stream" } 
    });
  }
}

// POST 请求处理程序 - 创建新日志
export async function POST(request: NextRequest) {
  try {
    // 获取请求体的二进制数据
    const arrayBuffer = await request.arrayBuffer();
    
    // 将二进制数据转换为Buffer
    const buffer = Buffer.from(arrayBuffer);
    
    // 使用混合解密处理
    const body = hybridDecrypt(buffer);
    
    if (!body || typeof body !== 'object') {
      throw new Error("无效的请求数据");
    }

    // 将日志数据插入数据库
    const result = await sql`
      INSERT INTO logs (data) VALUES (${JSON.stringify(body)}) RETURNING *
    `;

    // 加密成功响应
    const encryptedResponse = hybridEncrypt({
      success: true,
      message: "日志保存成功",
      data: result[0],
    });

    // 返回二进制数据
    return new Response(encryptedResponse, { 
      status: 201, 
      headers: { "Content-Type": "application/octet-stream" } 
    });
  } catch (error) {
    console.error("保存日志失败:", error);
    
    // 加密错误消息
    const encryptedError = hybridEncrypt({ 
      success: false, 
      error: "保存日志失败" 
    });
    
    // 返回二进制数据
    return new Response(encryptedError, { 
      status: 500, 
      headers: { "Content-Type": "application/octet-stream" } 
    });
  }
}

// DELETE 请求处理程序 - 删除指定ID的日志
export async function DELETE(request: NextRequest) {
  try {
    // 从URL中获取要删除的日志ID
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const ids = url.searchParams.get("ids");

    // 判断是单个删除还是批量删除
    if (ids) {
      // 批量删除
      const idArray = ids.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      
      if (idArray.length === 0) {
        const encryptedError = hybridEncrypt({ 
          success: false, 
          error: "无效的日志ID参数" 
        });
        
        return new Response(encryptedError, { 
          status: 400, 
          headers: { "Content-Type": "application/octet-stream" } 
        });
      }

      // 执行批量删除操作
      const result = await sql`
        DELETE FROM logs WHERE id = ANY(${idArray}) RETURNING id
      `;

      // 加密成功响应
      const encryptedResponse = hybridEncrypt({ 
        success: true, 
        message: "日志批量删除成功",
        data: { count: result.length, ids: result.map(row => row.id) }
      });
      
      return new Response(encryptedResponse, { 
        status: 200, 
        headers: { "Content-Type": "application/octet-stream" } 
      });
    } else if (id) {
      // 单个删除
      // 执行删除操作
      const result = await sql`
        DELETE FROM logs WHERE id = ${id} RETURNING id
      `;

      // 检查是否找到并删除了日志
      if (result.length === 0) {
        const encryptedError = hybridEncrypt({ 
          success: false, 
          error: "未找到指定ID的日志" 
        });
        
        return new Response(encryptedError, { 
          status: 404, 
          headers: { "Content-Type": "application/octet-stream" } 
        });
      }

      // 加密成功响应
      const encryptedResponse = hybridEncrypt({ 
        success: true, 
        message: "日志删除成功",
        data: { id: result[0].id } 
      });
      
      return new Response(encryptedResponse, { 
        status: 200, 
        headers: { "Content-Type": "application/octet-stream" } 
      });
    } else {
      const encryptedError = hybridEncrypt({ 
        success: false, 
        error: "缺少日志ID参数" 
      });
      
      return new Response(encryptedError, { 
        status: 400, 
        headers: { "Content-Type": "application/octet-stream" } 
      });
    }
  } catch (error) {
    console.error("删除日志失败:", error);
    
    // 加密错误消息
    const encryptedError = hybridEncrypt({ 
      success: false, 
      error: "删除日志失败" 
    });
    
    return new Response(encryptedError, { 
      status: 500, 
      headers: { "Content-Type": "application/octet-stream" } 
    });
  }
}
