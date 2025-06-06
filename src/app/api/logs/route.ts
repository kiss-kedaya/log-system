import { NextRequest } from "next/server";
import { initDatabase, sql } from "@/lib/db";
import { hybridDecrypt, hybridEncrypt, getClientPublicKey } from "@/lib/hybridCrypto";
import { generateRSAKeyPair } from "@/lib/rsaUtils";
import { cookies } from "next/headers";

// 初始化数据库
initDatabase().catch(console.error);

// 确保RSA密钥已生成
generateRSAKeyPair();

// 获取会话ID从cookie
async function getSessionId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("client_session_id");
  return sessionCookie?.value;
}

// GET 请求处理程序 - 获取日志（支持分页和搜索）
export async function GET(request: NextRequest) {
  try {
    // 获取客户端会话ID
    const sessionId = await getSessionId();
    // 获取客户端公钥
    const clientPublicKey = sessionId ? getClientPublicKey(sessionId) : undefined;

    // 获取URL参数
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "20", 10);
    const start = parseInt(url.searchParams.get("start") || "0", 10);
    const end = url.searchParams.get("end")
      ? parseInt(url.searchParams.get("end") || "0", 10)
      : null;
    const keyword = url.searchParams.get("keyword") || "";
    const field = url.searchParams.get("field") || "";
    const startDate = url.searchParams.get("startDate") || "";
    const endDate = url.searchParams.get("endDate") || "";

    // 计算偏移量，优先使用start/end参数
    const offset = start || (page - 1) * pageSize;
    const limit = end ? end - start : pageSize;

    // 构建搜索条件
    const searchConditions = [];

    // 关键词搜索（字段指定或全局）
    if (keyword) {
      if (field) {
        if (field === "id") {
          // 搜索ID字段
          searchConditions.push(sql`id::text ILIKE ${`%${keyword}%`}`);
        } else {
          // 搜索data中的特定字段
          searchConditions.push(sql`data->>${field} ILIKE ${`%${keyword}%`}`);
        }
      } else {
        // 全文搜索
        searchConditions.push(sql`data::text ILIKE ${`%${keyword}%`}`);
      }
    }

    // 日期范围搜索
    if (startDate) {
      searchConditions.push(sql`created_at >= ${new Date(startDate)}`);
    }

    if (endDate) {
      // 设置为当天的23:59:59
      const endDateTime = new Date(endDate);
      endDateTime.setHours(23, 59, 59, 999);
      searchConditions.push(sql`created_at <= ${endDateTime}`);
    }

    // 构建WHERE子句
    let whereClause = sql``;
    if (searchConditions.length > 0) {
      // 手动构建AND条件
      if (searchConditions.length === 1) {
        whereClause = sql`WHERE ${searchConditions[0]}`;
      } else {
        let combinedCondition = searchConditions[0];
        for (let i = 1; i < searchConditions.length; i++) {
          combinedCondition = sql`${combinedCondition} AND ${searchConditions[i]}`;
        }
        whereClause = sql`WHERE ${combinedCondition}`;
      }
    }

    // 获取总数量（用于分页）
    const countResult = await sql`
      SELECT COUNT(*) as total FROM public.logs ${whereClause}
    `;

    const totalLogs = parseInt(countResult[0].total.toString() || "0", 10);
    const totalPages = Math.ceil(totalLogs / pageSize);

    // 获取分页数据
    const logs = await sql`
      SELECT * FROM public.logs 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    // 准备响应数据
    const responseData = {
      success: true,
      data: logs,
      pagination: {
        page,
        pageSize,
        totalLogs,
        totalPages,
        start,
        end: start + (Array.isArray(logs) ? logs.length : 0),
      },
    };

    // 加密日志数据，如果有客户端公钥则使用混合加密
    const encryptedData = clientPublicKey
      ? hybridEncrypt(responseData, clientPublicKey)
      : hybridEncrypt(responseData); // 回退到旧方式

    // 返回二进制数据
    return new Response(encryptedData, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
      },
    });
  } catch (error) {
    console.error("获取日志失败:", error);

    // 获取客户端会话ID和公钥
    const sessionId = await getSessionId();
    const clientPublicKey = sessionId ? getClientPublicKey(sessionId) : undefined;

    // 加密错误消息
    const encryptedError = clientPublicKey
      ? hybridEncrypt({ success: false, error: "获取日志失败" }, clientPublicKey)
      : hybridEncrypt({ success: false, error: "获取日志失败" });

    // 返回二进制数据
    return new Response(encryptedError, {
      status: 500,
      headers: { "Content-Type": "application/octet-stream" },
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

    if (!body || typeof body !== "object") {
      throw new Error("无效的请求数据");
    }

    // 将日志数据插入数据库
    const result = await sql`
      INSERT INTO public.logs (data) VALUES (${JSON.stringify(
        body
      )}) RETURNING *
    `;

    // 获取客户端会话ID和公钥
    const sessionId = await getSessionId();
    const clientPublicKey = sessionId ? getClientPublicKey(sessionId) : undefined;

    // 加密成功响应
    const encryptedResponse = clientPublicKey
      ? hybridEncrypt({
          success: true,
          message: "日志保存成功",
          data: result[0],
        }, clientPublicKey)
      : hybridEncrypt({
          success: true,
          message: "日志保存成功",
          data: result[0],
        });

    // 返回二进制数据
    return new Response(encryptedResponse, {
      status: 201,
      headers: { "Content-Type": "application/octet-stream" },
    });
  } catch (error) {
    console.error("保存日志失败:", error);

    // 获取客户端会话ID和公钥
    const sessionId = await getSessionId();
    const clientPublicKey = sessionId ? getClientPublicKey(sessionId) : undefined;

    // 加密错误消息
    const encryptedError = clientPublicKey
      ? hybridEncrypt({ success: false, error: "保存日志失败" }, clientPublicKey)
      : hybridEncrypt({ success: false, error: "保存日志失败" });

    // 返回二进制数据
    return new Response(encryptedError, {
      status: 500,
      headers: { "Content-Type": "application/octet-stream" },
    });
  }
}

// DELETE 请求处理程序 - 删除指定ID的日志
export async function DELETE(request: NextRequest) {
  try {
    // 获取客户端会话ID和公钥
    const sessionId = await getSessionId();
    const clientPublicKey = sessionId ? getClientPublicKey(sessionId) : undefined;

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
        const encryptedError = clientPublicKey
          ? hybridEncrypt({ success: false, error: "无效的日志ID参数" }, clientPublicKey)
          : hybridEncrypt({ success: false, error: "无效的日志ID参数" });

        return new Response(encryptedError, {
          status: 400,
          headers: { "Content-Type": "application/octet-stream" },
        });
      }

      // 执行批量删除操作
      const result = await sql`
        DELETE FROM public.logs WHERE id = ANY(${idArray}) RETURNING id
      `;

      // 加密成功响应
      const encryptedResponse = clientPublicKey
        ? hybridEncrypt({
            success: true,
            message: "日志批量删除成功",
            data: { count: result.length, ids: result.map((row) => row.id) },
          }, clientPublicKey)
        : hybridEncrypt({
            success: true,
            message: "日志批量删除成功",
            data: { count: result.length, ids: result.map((row) => row.id) },
          });

      return new Response(encryptedResponse, {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" },
      });
    } else if (id) {
      // 单个删除
      // 执行删除操作
      const result = await sql`
        DELETE FROM public.logs WHERE id = ${id} RETURNING id
      `;

      // 检查是否找到并删除了日志
      if (result.length === 0) {
        const encryptedError = clientPublicKey
          ? hybridEncrypt({ success: false, error: "未找到指定ID的日志" }, clientPublicKey)
          : hybridEncrypt({ success: false, error: "未找到指定ID的日志" });

        return new Response(encryptedError, {
          status: 404,
          headers: { "Content-Type": "application/octet-stream" },
        });
      }

      // 加密成功响应
      const encryptedResponse = clientPublicKey
        ? hybridEncrypt({
            success: true,
            message: "日志删除成功",
            data: { id: result[0].id },
          }, clientPublicKey)
        : hybridEncrypt({
            success: true,
            message: "日志删除成功",
            data: { id: result[0].id },
          });

      return new Response(encryptedResponse, {
        status: 200,
        headers: { "Content-Type": "application/octet-stream" },
      });
    } else {
      const encryptedError = clientPublicKey
        ? hybridEncrypt({ success: false, error: "缺少日志ID参数" }, clientPublicKey)
        : hybridEncrypt({ success: false, error: "缺少日志ID参数" });

      return new Response(encryptedError, {
        status: 400,
        headers: { "Content-Type": "application/octet-stream" },
      });
    }
  } catch (error) {
    console.error("删除日志失败:", error);

    // 获取客户端会话ID和公钥
    const sessionId = await getSessionId();
    const clientPublicKey = sessionId ? getClientPublicKey(sessionId) : undefined;

    // 加密错误消息
    const encryptedError = clientPublicKey
      ? hybridEncrypt({ success: false, error: "删除日志失败" }, clientPublicKey)
      : hybridEncrypt({ success: false, error: "删除日志失败" });

    return new Response(encryptedError, {
      status: 500,
      headers: { "Content-Type": "application/octet-stream" },
    });
  }
}
