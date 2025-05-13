"use client";

import { useEffect, useState } from "react";
import { initCryptoSystem } from "@/lib/clientHybridCrypto";

export function CryptoInitializer() {
  const [, setInitialized] = useState(false); // 使用状态但不需要读取值
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function initialize() {
      try {
        const success = await initCryptoSystem();
        if (success) {
          setInitialized(true);
        } else {
          setError("加密系统初始化失败");
        }
      } catch (err) {
        console.error("加密系统初始化出错:", err);
        setError("加密系统初始化出错");
      }
    }

    initialize();
  }, []);

  // 仅渲染一个不可见的元素（或错误消息）
  return (
    <>
      {error && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white p-2 text-center z-50">
          加密系统初始化失败，部分功能可能无法正常工作。请刷新页面重试。
        </div>
      )}
    </>
  );
} 