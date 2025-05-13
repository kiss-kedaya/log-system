import { NextRequest } from "next/server";
import { initDatabase, sql } from "@/lib/db";
import { hybridDecrypt, hybridEncrypt } from "@/lib/hybridCrypto";
import { generateRSAKeyPair } from "@/lib/rsaUtils";

// 初始化数据库
initDatabase().catch((err) => {
  console.error("数据库初始化失败:", err);
});

// 确保RSA密钥已生成
try {
  generateRSAKeyPair();
} catch (error) {
  console.error("RSA密钥生成失败:", error);
}

// 定义错误详情接口
interface ErrorDetails {
  name?: string;
  message?: string;
  stack?: string;
  [key: string]: any;
}

// 创建更详细的错误响应
function createErrorResponse(
  status: number,
  errorMessage: string,
  errorDetails?: ErrorDetails
) {
  const errorPayload = {
    success: false,
    error: errorMessage,
    errorDetails: errorDetails ? JSON.stringify(errorDetails) : undefined,
  };

  try {
    // 尝试加密错误信息
    const encryptedError = hybridEncrypt(errorPayload);
    return new Response(encryptedError, {
      status: status,
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch (encryptError: any) {
    // 如果加密失败，则返回纯文本错误信息（应急方案）
    console.error("加密错误信息失败:", encryptError);
    return new Response(JSON.stringify(errorPayload), {
      status: status,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// GET 请求处理程序 - 获取日志
export async function GET(request: NextRequest) {
  try {
    // 从URL中获取搜索参数
    const url = new URL(request.url);
    const keyword = url.searchParams.get("keyword");
    const startDate = url.searchParams.get("startDate");
    const endDate = url.searchParams.get("endDate");

    let logs;

    // 根据搜索条件构建查询
    if (
      (keyword && keyword.trim() !== "") ||
      (startDate && startDate.trim() !== "") ||
      (endDate && endDate.trim() !== "")
    ) {
      // 构建不同的查询组合
      if (keyword && startDate && endDate) {
        // 关键词 + 开始日期 + 结束日期
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1);
        const endDateWithTime = endDateObj.toISOString().split("T")[0];

        logs = await sql`
          SELECT * FROM logs 
          WHERE data::text ILIKE ${"%" + keyword + "%"} 
          AND created_at >= ${startDate} 
          AND created_at < ${endDateWithTime}
          ORDER BY created_at DESC
        `;
      } else if (keyword && startDate) {
        // 关键词 + 开始日期
        logs = await sql`
          SELECT * FROM logs 
          WHERE data::text ILIKE ${"%" + keyword + "%"} 
          AND created_at >= ${startDate}
          ORDER BY created_at DESC
        `;
      } else if (keyword && endDate) {
        // 关键词 + 结束日期
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1);
        const endDateWithTime = endDateObj.toISOString().split("T")[0];

        logs = await sql`
          SELECT * FROM logs 
          WHERE data::text ILIKE ${"%" + keyword + "%"} 
          AND created_at < ${endDateWithTime}
          ORDER BY created_at DESC
        `;
      } else if (startDate && endDate) {
        // 开始日期 + 结束日期
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1);
        const endDateWithTime = endDateObj.toISOString().split("T")[0];

        logs = await sql`
          SELECT * FROM logs 
          WHERE created_at >= ${startDate} 
          AND created_at < ${endDateWithTime}
          ORDER BY created_at DESC
        `;
      } else if (keyword) {
        // 只有关键词
        logs = await sql`
          SELECT * FROM logs 
          WHERE data::text ILIKE ${"%" + keyword + "%"}
          ORDER BY created_at DESC
        `;
      } else if (startDate) {
        // 只有开始日期
        logs = await sql`
          SELECT * FROM logs 
          WHERE created_at >= ${startDate}
          ORDER BY created_at DESC
        `;
      } else if (endDate) {
        // 只有结束日期
        const endDateObj = new Date(endDate);
        endDateObj.setDate(endDateObj.getDate() + 1);
        const endDateWithTime = endDateObj.toISOString().split("T")[0];

        logs = await sql`
          SELECT * FROM logs 
          WHERE created_at < ${endDateWithTime}
          ORDER BY created_at DESC
        `;
      }
    } else {
      // 没有搜索条件，获取所有日志
      logs = await sql`
        SELECT * FROM logs ORDER BY created_at DESC
      `;
    }

    try {
      // 加密日志数据
      const encryptedData = hybridEncrypt({ success: true, data: logs });

      // 返回二进制数据
      return new Response(encryptedData, {
        status: 200,
        headers: {
          "Content-Type": "application/octet-stream",
        },
      });
    } catch (encryptError: any) {
      console.error("加密日志数据失败:", encryptError);
      return createErrorResponse(500, "加密日志数据失败", {
        name: encryptError.name,
        message: encryptError.message,
        stack: encryptError.stack,
      });
    }
  } catch (error: any) {
    console.error("获取日志失败:", error);
    return createErrorResponse(500, "获取日志失败", {
      name: error.name,
      message: error.message,
      stack: error.stack,
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

    let body;
    try {
      // 使用混合解密处理
      body = hybridDecrypt(buffer);
    } catch (decryptError: any) {
      console.error("混合解密失败:", decryptError);
      return createErrorResponse(400, "解密请求数据失败", {
        name: decryptError.name,
        message: decryptError.message,
        stack: decryptError.stack,
      });
    }

    if (!body || typeof body !== "object") {
      return createErrorResponse(400, "无效的请求数据", {
        receivedType: typeof body,
      });
    }

    try {
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
        headers: { "Content-Type": "application/octet-stream" },
      });
    } catch (dbError: any) {
      console.error("数据库操作失败:", dbError);
      return createErrorResponse(500, "保存日志到数据库失败", {
        name: dbError.name,
        message: dbError.message,
        stack: dbError.stack,
      });
    }
  } catch (error: any) {
    console.error("保存日志失败:", error);
    return createErrorResponse(500, "保存日志失败", {
      name: error.name,
      message: error.message,
      stack: error.stack,
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
      const idArray = ids
        .split(",")
        .map((id) => parseInt(id, 10))
        .filter((id) => !isNaN(id));

      if (idArray.length === 0) {
        return createErrorResponse(400, "无效的日志ID参数", {
          receivedIds: ids,
        });
      }

      try {
        // 执行批量删除操作
        const result = await sql`
          DELETE FROM logs WHERE id = ANY(${idArray}) RETURNING id
        `;

        // 加密成功响应
        const encryptedResponse = hybridEncrypt({
          success: true,
          message: "日志批量删除成功",
          data: { count: result.length, ids: result.map((row) => row.id) },
        });

        return new Response(encryptedResponse, {
          status: 200,
          headers: { "Content-Type": "application/octet-stream" },
        });
      } catch (dbError: any) {
        console.error("批量删除数据库操作失败:", dbError);
        return createErrorResponse(500, "批量删除日志失败", {
          name: dbError.name,
          message: dbError.message,
          stack: dbError.stack,
        });
      }
    } else if (id) {
      try {
        // 单个删除
        // 执行删除操作
        const result = await sql`
          DELETE FROM logs WHERE id = ${id} RETURNING id
        `;

        // 检查是否找到并删除了日志
        if (result.length === 0) {
          return createErrorResponse(404, "未找到指定ID的日志", {
            requestedId: id,
          });
        }

        // 加密成功响应
        const encryptedResponse = hybridEncrypt({
          success: true,
          message: "日志删除成功",
          data: { id: result[0].id },
        });

        return new Response(encryptedResponse, {
          status: 200,
          headers: { "Content-Type": "application/octet-stream" },
        });
      } catch (dbError: any) {
        console.error("删除日志数据库操作失败:", dbError);
        return createErrorResponse(500, "删除日志失败", {
          name: dbError.name,
          message: dbError.message,
          stack: dbError.stack,
        });
      }
    } else {
      return createErrorResponse(400, "缺少日志ID参数", { url: request.url });
    }
  } catch (error: any) {
    console.error("删除日志失败:", error);
    return createErrorResponse(500, "删除日志失败", {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }
}
