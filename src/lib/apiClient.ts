import { encryptData, decryptData } from "./clientHybridCrypto";

type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: PaginationInfo;
};

// 日志类型定义
export type Log = {
  id: number;
  data: Record<string, unknown>;
  created_at: string;
};

// 分页信息类型
export type PaginationInfo = {
  page: number;
  pageSize: number;
  totalLogs: number;
  totalPages: number;
  start: number;
  end: number;
};

// 日志查询参数类型
export type LogQueryParams = {
  page?: number;
  pageSize?: number;
  start?: number;
  end?: number;
  keyword?: string;
  field?: string;
  startDate?: string;
  endDate?: string;
};

/**
 * 通用API请求函数，自动处理加密/解密和认证
 */
export async function apiRequest<T = unknown>(
  url: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  data?: unknown
): Promise<ApiResponse<T>> {
  try {
    // 获取认证令牌
    const token = localStorage.getItem("auth_token");
    if (!token) {
      throw new Error("未登录或会话已过期，请重新登录");
    }

    const requestInit: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    // 如果有请求体数据，进行加密
    if (data && method !== "GET") {
      // 加密数据
      const encryptedData = await encryptData(data);

      // 将加密数据转换为Blob
      const blob = new Blob([new Uint8Array(encryptedData)], {
        type: "application/octet-stream",
      });

      requestInit.body = blob;
      // 添加Content-Type头
      requestInit.headers = {
        ...requestInit.headers,
        "Content-Type": "application/octet-stream",
      };
    }

    // 发送请求
    const response = await fetch(url, requestInit);

    if (!response.ok) {
      // 获取并解密错误响应
      const encryptedError = await response.arrayBuffer();
      const errorData = decryptData(encryptedError) as ApiResponse;

      // 如果是未授权错误，清除令牌并刷新页面
      if (response.status === 401) {
        localStorage.removeItem("auth_token");
        window.location.href = "/login";
      }

      throw new Error(errorData.error || `HTTP错误 ${response.status}`);
    }

    // 获取并解密成功响应
    const encryptedResponse = await response.arrayBuffer();
    return decryptData(encryptedResponse) as ApiResponse<T>;
  } catch (error) {
    console.error("API请求失败:", error);

    // 如果是登录过期，重定向到登录页
    if (
      (error as Error).message.includes("未登录") ||
      (error as Error).message.includes("会话已过期")
    ) {
      localStorage.removeItem("auth_token");
      window.location.href = "/login";
    }

    return {
      success: false,
      error: (error as Error).message || "请求失败",
    };
  }
}

/**
 * 构建带查询参数的URL
 */
export function buildUrl(
  baseUrl: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  if (!params) return baseUrl;

  const url = new URL(baseUrl, window.location.origin);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.append(key, String(value));
    }
  });

  return url.pathname + url.search;
}

/**
 * 获取日志（支持分页和搜索）
 */
export async function fetchLogs(params?: LogQueryParams) {
  const url = buildUrl("/api/logs", params);
  return apiRequest<Log[]>(url);
}

/**
 * 删除单个日志
 */
export async function deleteLog(id: number) {
  return apiRequest(`/api/logs?id=${id}`, "DELETE");
}

/**
 * 批量删除日志
 */
export async function bulkDeleteLogs(ids: number[]) {
  const idsParam = ids.join(",");
  return apiRequest(`/api/logs?ids=${idsParam}`, "DELETE");
}
