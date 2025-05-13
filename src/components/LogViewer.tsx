"use client";

import { useState, useEffect, useRef } from "react";
import { LogForm } from "@/components/LogForm";

type Log = {
  id: number;
  data: Record<string, unknown>;
  created_at: string;
};

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

type HoverInfo = {
  content: unknown;
  x: number;
  y: number;
};

type DeleteConfirmInfo = {
  id: number;
  isDeleting: boolean;
};

export function LogViewer() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'created_at', direction: 'desc' });
  const [logKeys, setLogKeys] = useState<string[]>([]);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmInfo | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  
  // 用于跟踪鼠标是否在悬浮框内
  const hoverCardRef = useRef<HTMLDivElement>(null);
  const [isMouseInHoverCard, setIsMouseInHoverCard] = useState(false);

  // 获取日志数据
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/logs");

      if (!response.ok) {
        throw new Error("获取日志失败");
      }

      const data = await response.json();
      const logsData = data.data || [];
      setLogs(logsData);
      
      // 提取所有日志中的键
      if (logsData.length > 0) {
        // 收集所有日志中的所有键
        const allKeys = new Set<string>();
        logsData.forEach((log: Log) => {
          Object.keys(log.data).forEach(key => allKeys.add(key));
        });
        setLogKeys(Array.from(allKeys));
      }
      
      setError(null);
    } catch (err) {
      console.error("获取日志失败:", err);
      setError("获取日志数据失败，请稍后再试");
    } finally {
      setLoading(false);
    }
  };

  // 添加新日志后刷新列表
  const handleLogAdded = () => {
    fetchLogs();
  };

  // 切换日志展开/折叠状态
  const toggleExpand = (id: number) => {
    setExpandedLog(expandedLog === id ? null : id);
  };
  
  // 显示悬浮对象信息
  const handleMouseEnter = (content: unknown, event: React.MouseEvent) => {
    setHoverInfo({
      content,
      x: event.clientX,
      y: event.clientY
    });
  };
  
  // 隐藏悬浮对象信息
  const handleMouseLeave = () => {
    // 仅当鼠标不在悬浮卡片中时才隐藏
    if (!isMouseInHoverCard) {
      setHoverInfo(null);
    }
  };
  
  // 处理鼠标进入悬浮卡片
  const handleHoverCardMouseEnter = () => {
    setIsMouseInHoverCard(true);
  };
  
  // 处理鼠标离开悬浮卡片
  const handleHoverCardMouseLeave = () => {
    setIsMouseInHoverCard(false);
    setHoverInfo(null);
  };
  
  // 显示删除确认对话框
  const handleDeleteClick = (id: number) => {
    setDeleteConfirm({ id, isDeleting: false });
    // 清除之前的成功/错误消息
    setDeleteError(null);
    setDeleteSuccess(null);
  };
  
  // 取消删除
  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };
  
  // 确认删除
  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      setDeleteConfirm({ ...deleteConfirm, isDeleting: true });
      
      const response = await fetch(`/api/logs?id=${deleteConfirm.id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "删除日志失败");
      }
      
      // 删除成功
      setDeleteSuccess(`日志(ID: ${deleteConfirm.id})已成功删除`);
      
      // 从本地状态中移除已删除的日志
      setLogs(prevLogs => prevLogs.filter(log => log.id !== deleteConfirm.id));
      
      // 如果当前展开的是被删除的日志，则关闭展开视图
      if (expandedLog === deleteConfirm.id) {
        setExpandedLog(null);
      }
      
      // 3秒后清除成功消息
      setTimeout(() => {
        setDeleteSuccess(null);
      }, 3000);
      
    } catch (err) {
      console.error("删除日志失败:", err);
      if (err instanceof Error) {
        setDeleteError(err.message || "删除日志失败，请稍后再试");
      } else {
        setDeleteError("删除日志失败，请稍后再试");
      }
    } finally {
      setDeleteConfirm(null);
    }
  };

  // 处理排序
  const handleSort = (key: string) => {
    setSortConfig(prevConfig => {
      if (prevConfig.key === key) {
        // 如果已经在按这个键排序，切换排序方向
        return { key, direction: prevConfig.direction === 'asc' ? 'desc' : 'asc' };
      } else {
        // 否则，使用新键并默认为升序
        return { key, direction: 'asc' };
      }
    });
  };

  // 获取排序图标
  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) {
      return null;
    }
    
    return (
      <span className="ml-1">
        {sortConfig.direction === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  // 排序日志
  const sortedLogs = [...logs].sort((a, b) => {
    if (sortConfig.key === 'id' || sortConfig.key === 'created_at') {
      // 处理内置属性排序
      const valueA = sortConfig.key === 'id' ? a.id : new Date(a.created_at).getTime();
      const valueB = sortConfig.key === 'id' ? b.id : new Date(b.created_at).getTime();
      
      if (sortConfig.direction === 'asc') {
        return valueA - valueB;
      } else {
        return valueB - valueA;
      }
    } else {
      // 处理 data 内属性排序
      const valueA = a.data[sortConfig.key];
      const valueB = b.data[sortConfig.key];
      
      // 处理不同类型的值
      if (valueA === undefined && valueB === undefined) return 0;
      if (valueA === undefined) return 1;
      if (valueB === undefined) return -1;
      
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sortConfig.direction === 'asc' ? valueA - valueB : valueB - valueA;
      } else {
        const strA = String(valueA).toLowerCase();
        const strB = String(valueB).toLowerCase();
        return sortConfig.direction === 'asc' 
          ? strA.localeCompare(strB) 
          : strB.localeCompare(strA);
      }
    }
  });

  // 页面加载时获取日志
  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">添加新日志</h2>
        <LogForm onLogAdded={handleLogAdded} />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">日志列表</h2>
          <button
            onClick={fetchLogs}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
          >
            刷新
          </button>
        </div>
        
        {/* 删除成功消息 */}
        {deleteSuccess && (
          <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
            {deleteSuccess}
          </div>
        )}
        
        {/* 删除错误消息 */}
        {deleteError && (
          <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {deleteError}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">暂无日志数据</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('id')}
                  >
                    ID {getSortIcon('id')}
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('created_at')}
                  >
                    时间 {getSortIcon('created_at')}
                  </th>
                  
                  {/* 动态生成日志属性列 */}
                  {logKeys.map(key => (
                    <th 
                      key={key}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                      onClick={() => handleSort(key)}
                    >
                      {key} {getSortIcon(key)}
                    </th>
                  ))}
                  
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200">
                {sortedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    
                    {/* 动态显示日志属性值 */}
                    {logKeys.map(key => (
                      <td key={key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {typeof log.data[key] === 'object' && log.data[key] !== null ? (
                          <span 
                            className="text-blue-500 cursor-pointer underline"
                            onMouseEnter={(e) => handleMouseEnter(log.data[key], e)}
                            onMouseLeave={handleMouseLeave}
                          >
                            [Object]
                          </span>
                        ) : (
                          String(log.data[key] ?? '-')
                        )}
                      </td>
                    ))}
                    
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => toggleExpand(log.id)}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          {expandedLog === log.id ? '折叠' : '展开'}
                        </button>
                        <button
                          onClick={() => handleDeleteClick(log.id)}
                          className="text-red-500 hover:text-red-700 ml-3"
                        >
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* 展开的日志详情 */}
            {expandedLog !== null && (
              <div className="mt-2 p-4 border bg-gray-50 dark:bg-gray-700 rounded">
                <h3 className="text-sm font-medium mb-2">日志详情 (ID: {expandedLog})</h3>
                <pre className="whitespace-pre-wrap text-sm overflow-x-auto">
                  {JSON.stringify(logs.find(log => log.id === expandedLog)?.data, null, 2)}
                </pre>
              </div>
            )}
            
            {/* 悬浮显示对象信息 */}
            {hoverInfo && (
              <div 
                ref={hoverCardRef}
                className="fixed bg-white dark:bg-gray-800 shadow-lg rounded-md p-4 border border-gray-200 dark:border-gray-700 z-50 max-w-md"
                style={{ 
                  top: `${hoverInfo.y + 10}px`, 
                  left: `${hoverInfo.x + 10}px` 
                }}
                onMouseEnter={handleHoverCardMouseEnter}
                onMouseLeave={handleHoverCardMouseLeave}
              >
                <pre className="whitespace-pre-wrap text-sm overflow-x-auto max-h-60">
                  {JSON.stringify(hoverInfo.content, null, 2)}
                </pre>
              </div>
            )}
            
            {/* 删除确认对话框 */}
            {deleteConfirm && (
              <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md mx-4">
                  <h3 className="text-lg font-semibold mb-4">确认删除</h3>
                  <p className="mb-6">
                    您确定要删除ID为 <span className="font-semibold">{deleteConfirm.id}</span> 的日志吗？此操作无法撤销。
                  </p>
                  <div className="flex justify-end space-x-3">
                    <button
                      onClick={handleCancelDelete}
                      disabled={deleteConfirm.isDeleting}
                      className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100 transition"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleConfirmDelete}
                      disabled={deleteConfirm.isDeleting}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition flex items-center"
                    >
                      {deleteConfirm.isDeleting ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          处理中...
                        </>
                      ) : (
                        "确认删除"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
