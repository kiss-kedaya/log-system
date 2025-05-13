import { NextRequest, NextResponse } from "next/server";
import * as jose from 'jose';

// JWT密钥，与验证API中使用的相同
// 注意：在生产环境中，这应该通过环境变量注入，且应与auth/verify中使用的相同密钥
const JWT_SECRET = process.env.JWT_SECRET || "kedaya";

// 不需要验证的路径
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/verify",
  "/api/initKeys",
  "/_next",
  "/favicon.ico",
];

// 特殊调试日志函数 - 只在非生产环境打印
function debugLog(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") {
    console.log("[中间件]", ...args);
  }
}

// 检查路径是否为公开路径
function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((publicPath) => path.startsWith(publicPath));
}

// 从请求头中解析令牌
function extractToken(request: NextRequest): string | null {
  // 优先从Authorization头中获取
  const authHeader = request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // 如果Authorization头中没有令牌，尝试从Cookie中获取
  const token = request.cookies.get("auth_token")?.value;

  // 尝试从URL中获取token (用于处理重定向问题)
  if (!token) {
    const urlToken = request.nextUrl.searchParams.get("auth_token");
    if (urlToken) {
      return urlToken;
    }
  }

  return token || null;
}

// 验证令牌是否有效
async function verifyToken(token: string): Promise<boolean> {
  try {
    debugLog("开始验证令牌:", token.substring(0, 15) + "...");
    
    // 使用jose库验证JWT令牌
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(JWT_SECRET);
    
    await jose.jwtVerify(token, secretKey);
    debugLog("令牌验证成功");
    return true;
  } catch (error) {
    debugLog("令牌验证失败:", error);
    return false;
  }
}

// 中间件主函数
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  debugLog("处理路径:", path);

  // 如果是公开路径，允许访问
  if (isPublicPath(path)) {
    debugLog("公开路径，直接访问:", path);
    return NextResponse.next();
  }

  // 获取令牌
  const token = extractToken(request);
  debugLog("提取的令牌:", token ? "存在" : "不存在");

  // 防止无限重定向：如果已经是登录页，不再重定向
  if (path === "/login") {
    debugLog("已经在登录页，允许访问");
    return NextResponse.next();
  }

  // 检查令牌有效性
  const isValid = token ? await verifyToken(token) : false;
  debugLog("令牌验证结果:", isValid ? "有效" : "无效");

  // 如果是API路由但没有有效令牌，返回401错误
  if (path.startsWith("/api/") && !isValid) {
    debugLog("API路径但无效令牌，返回401");
    return new NextResponse(
      JSON.stringify({ success: false, error: "未授权访问" }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  // 如果是页面路由但没有有效令牌，重定向到登录页
  if (!isValid) {
    debugLog("无效令牌，重定向到登录页");
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  // 通过验证，继续处理请求
  debugLog("通过验证，继续处理请求");
  return NextResponse.next();
}

// 配置中间件应该匹配的路径
export const config = {
  matcher: [
    /*
     * 匹配所有请求路径，除了:
     * - api路由 (/api/*)
     * - 静态文件 (/_next/static/*, /_next/image/*, /favicon.ico)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
