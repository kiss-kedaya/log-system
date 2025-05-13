'use client';

import { useState } from 'react';

interface LogFormProps {
  onLogAdded: () => void;
}

export function LogForm({ onLogAdded }: LogFormProps) {
  const [jsonInput, setJsonInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // 验证JSON格式
      try {
        // 只验证JSON格式，不需要使用解析结果
        JSON.parse(jsonInput);
      } catch {
        setError('JSON格式无效，请检查输入');
        return;
      }
      
      setLoading(true);
      setError(null);
      setSuccess(false);
      
      // 发送请求
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonInput,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '保存日志失败');
      }
      
      // 处理成功响应
      setSuccess(true);
      setJsonInput(''); // 清空输入
      onLogAdded(); // 通知父组件刷新日志列表
      
      // 3秒后清除成功消息
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: unknown) {
      console.error('提交日志失败:', err);
      // 处理不同类型的错误
      if (err instanceof Error) {
        setError(err.message || '提交日志失败，请稍后再试');
      } else {
        setError('提交日志失败，请稍后再试');
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
        browser: "Chrome"
      }
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
          loading ? 'bg-blue-300' : 'bg-blue-500 hover:bg-blue-600'
        } transition-colors`}
      >
        {loading ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            处理中...
          </span>
        ) : (
          '提交日志'
        )}
      </button>
    </form>
  );
} 