import { NextRequest } from "next/server";
import { initDatabase, sql } from "@/lib/db";

// 初始化数据库
initDatabase().catch(console.error);

// GET 请求处理程序 - 获取所有日志
export async function GET() {
  try {
    // 执行查询获取所有日志，按创建时间降序排列
    const logs = await sql`
      SELECT * FROM logs ORDER BY created_at DESC
    `;

    // 返回日志数据
    return Response.json({ success: true, data: logs });
  } catch (error) {
    console.error("获取日志失败:", error);
    return new Response(
      JSON.stringify({ success: false, error: "获取日志失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// POST 请求处理程序 - 创建新日志
export async function POST(request: NextRequest) {
  try {
    // 解析请求体
    const body = await request.json();

    // 将日志数据插入数据库
    const result = await sql`
      INSERT INTO logs (data) VALUES (${JSON.stringify(body)}) RETURNING *
    `;

    // 返回成功响应
    return new Response(
      JSON.stringify({
        success: true,
        message: "日志保存成功",
        data: result[0],
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("保存日志失败:", error);
    return new Response(
      JSON.stringify({ success: false, error: "保存日志失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
