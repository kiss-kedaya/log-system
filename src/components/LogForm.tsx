"use client";

import { useState } from "react";
import { encryptData, decryptData } from "@/lib/clientCrypto";

interface LogFormProps {
  onLogAdded: () => void;
}

export function LogForm({ onLogAdded }: LogFormProps) {
  const [jsonInput, setJsonInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // 验证JSON格式
      let parsedData;
      try {
        // 解析JSON
        parsedData = JSON.parse(jsonInput);
      } catch {
        setError("JSON格式无效，请检查输入");
        return;
      }

      setLoading(true);
      setError(null);
      setSuccess(false);

      // 在客户端直接加密数据 - 返回ArrayBuffer
      const encryptedData = encryptData(parsedData);

      // 将ArrayBufferLike转换为Blob类型，Blob是Fetch API支持的BodyInit类型
      const blob = new Blob([new Uint8Array(encryptedData)], {
        type: "application/octet-stream",
      });

      // 发送加密请求
      const response = await fetch("/api/logs", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
        },
        body: blob,
      });

      if (!response.ok) {
        // 获取二进制错误响应
        const encryptedError = await response.arrayBuffer();

        // 在客户端直接解密错误响应
        const errorData = decryptData(encryptedError);

        if (
          typeof errorData === "object" &&
          errorData !== null &&
          "error" in errorData
        ) {
          throw new Error(
            (errorData as { error: string }).error || "保存日志失败"
          );
        } else {
          throw new Error("保存日志失败");
        }
      }

      // 获取并解密成功响应
      const encryptedSuccess = await response.arrayBuffer();
      // 解密响应但不需要使用结果
      decryptData(encryptedSuccess);

      // 处理成功响应
      setSuccess(true);
      setJsonInput(""); // 清空输入
      onLogAdded(); // 通知父组件刷新日志列表

      // 3秒后清除成功消息
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: unknown) {
      console.error("提交日志失败:", err);
      // 处理不同类型的错误
      if (err instanceof Error) {
        setError(err.message || "提交日志失败，请稍后再试");
      } else {
        setError("提交日志失败，请稍后再试");
      }
    } finally {
      setLoading(false);
    }
  };

  // 显示格式化提示的示例JSON
  const formatExample = () => {
    const example = {
      level: "info",
      message: "用户登录成功",
      user_id: 12345,
      timestamp: new Date().toISOString(),
      details: {
        ip: "192.168.1.1",
        browser: "Chrome",
      },
    };

    setJsonInput(JSON.stringify(example, null, 2));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <div className="flex justify-between items-center mb-2">
          <label htmlFor="jsonInput" className="block text-sm font-medium">
            JSON数据
          </label>
          <button
            type="button"
            onClick={formatExample}
            className="text-sm text-blue-500 hover:text-blue-700"
          >
            使用示例
          </button>
        </div>
        <textarea
          id="jsonInput"
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          rows={10}
          className="w-full border rounded-md p-2 font-mono text-sm"
          placeholder='{"level": "info", "message": "这是一条日志"}'
          required
        />
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          日志保存成功！
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
            处理中...
          </span>
        ) : (
          "提交日志"
        )}
      </button>
    </form>
  );
}
