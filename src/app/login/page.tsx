"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { encryptData, decryptData } from "@/lib/clientHybridCrypto";

// 保存令牌到Cookie和localStorage的函数
function saveAuthToken(token: string) {
  // 保存到localStorage
  localStorage.setItem("auth_token", token);

  // 同时保存到Cookie，使中间件能够读取
  // 设置为Secure; SameSite=Strict可以增强安全性
  const cookieExpiry = new Date();
  cookieExpiry.setDate(cookieExpiry.getDate() + 1); // 1天有效期

  document.cookie = `auth_token=${token}; expires=${cookieExpiry.toUTCString()}; path=/; SameSite=Strict`;

  console.log("[登录] 令牌已保存到localStorage和Cookie，长度:", token.length);
}

export default function LoginPage() {
  const [secretKey, setSecretKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // 网页加载完成后，显示当前登录状态
  useEffect(() => {
    // 检查是否存在token
    try {
      const token = localStorage.getItem("auth_token");
      console.log(
        "[登录页] localStorage中的令牌状态:",
        token ? "存在" : "不存在"
      );

      if (token) {
        // 确保cookie中也存在该令牌
        saveAuthToken(token);
        window.location.href = "/";
      }
    } catch (err) {
      console.error("[登录页] 检查token时出错:", err);
    }
  }, [router]);

  // 处理登录验证
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!secretKey.trim()) {
      setError("请输入密钥");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      console.log("[登录] 开始验证密钥");

      // 加密密钥
      const encryptedData = await encryptData({ secretKey });

      // 将ArrayBuffer转换为Blob
      const blob = new Blob([new Uint8Array(encryptedData)], {
        type: "application/octet-stream",
      });

      // 发送验证请求
      console.log("[登录] 发送验证请求");
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: blob,
      });

      if (!response.ok) {
        console.log("[登录] 服务器返回错误:", response.status);
        // 获取并解密错误消息
        const encryptedError = await response.arrayBuffer();
        const errorData = decryptData(encryptedError) as { error?: string };
        throw new Error(errorData.error || "验证失败");
      }

      // 获取并解密响应数据
      console.log("[登录] 解密响应数据");
      const encryptedSuccess = await response.arrayBuffer();
      const successData = decryptData(encryptedSuccess) as {
        success: boolean;
        token?: string;
        message?: string;
      };

      if (!successData.success) {
        throw new Error(successData.message || "验证失败");
      }

      // 保存认证令牌到localStorage和Cookie
      const token = successData.token || "";
      saveAuthToken(token);

      // 添加时间戳参数，避免缓存
      window.location.href = "/";
    } catch (err) {
      console.error("[登录] 验证失败:", err);
      if (err instanceof Error) {
        setError(err.message || "验证失败，请稍后再试");
      } else {
        setError("验证失败，请稍后再试");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h1 className="text-2xl font-bold text-center mb-6">系统访问验证</h1>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label
              htmlFor="secretKey"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              密钥
            </label>
            <input
              id="secretKey"
              type="password"
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="请输入系统访问密钥"
              required
            />
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 px-4 rounded-md text-white font-medium ${
              loading ? "bg-blue-300" : "bg-blue-500 hover:bg-blue-600"
            } transition-colors`}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                验证中...
              </span>
            ) : (
              "验证"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
