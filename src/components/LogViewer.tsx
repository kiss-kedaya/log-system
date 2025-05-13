"use client";

import { useState, useEffect, useRef } from "react";
import { LogForm } from "@/components/LogForm";
import { decryptData } from "@/lib/clientHybridCrypto";

type Log = {
  id: number;
  data: Record<string, unknown>;
  created_at: string;
};

type SortConfig = {
  key: string;
  direction: "asc" | "desc";
};

type HoverInfo = {
  content: unknown;
  x: number;
  y: number;
};

type DeleteConfirmInfo = {
  id: number | number[];
  isDeleting: boolean;
};

type ApiResponse = {
  success: boolean;
  data?: unknown;
  error?: string;
  message?: string;
};

// 搜索参数类型
type SearchParams = {
  keyword: string;
  startDate: string;
  endDate: string;
};

export function LogViewer() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedLog, setExpandedLog] = useState<number | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "created_at",
    direction: "desc",
  });
  const [logKeys, setLogKeys] = useState<string[]>([]);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirmInfo | null>(
    null
  );
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);
  // 新增状态：选中的日志ID列表
  const [selectedLogs, setSelectedLogs] = useState<number[]>([]);
  // 新增状态：是否全选
  const [selectAll, setSelectAll] = useState(false);
  // 新增状态：搜索参数
  const [searchParams, setSearchParams] = useState<SearchParams>({
    keyword: '',
    startDate: '',
    endDate: ''
  });
  // 新增状态：输入中的搜索参数
  const [inputSearchParams, setInputSearchParams] = useState<SearchParams>({
    keyword: '',
    startDate: '',
    endDate: ''
  });

  // 用于跟踪鼠标是否在悬浮框内
  const hoverCardRef = useRef<HTMLDivElement>(null);
  const [isMouseInHoverCard, setIsMouseInHoverCard] = useState(false);

  // 获取日志数据
  const fetchLogs = async () => {
    try {
      setLoading(true);
      
      // 构建请求URL，添加搜索参数
      let url = "/api/logs";
      const params = new URLSearchParams();
      
      if (searchParams.keyword.trim()) {
        params.append("keyword", searchParams.keyword.trim());
      }
      
      if (searchParams.startDate) {
        params.append("startDate", searchParams.startDate);
      }
      
      if (searchParams.endDate) {
        params.append("endDate", searchParams.endDate);
      }
      
      // 添加参数到URL
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error("获取日志失败");
      }

      // 获取二进制数据
      const encryptedData = await response.arrayBuffer();

      // 在客户端直接解密响应
      const decryptedData = decryptData(encryptedData) as ApiResponse;

      if (!decryptedData.success) {
        throw new Error(decryptedData.error || "获取日志失败");
      }

      const logsData = (decryptedData.data as Log[]) || [];
      setLogs(logsData);
      // 重置选中的日志列表
      setSelectedLogs([]);
      setSelectAll(false);

      // 提取所有日志中的键
      if (logsData.length > 0) {
        // 收集所有日志中的所有键
        const allKeys = new Set<string>();
        logsData.forEach((log: Log) => {
          Object.keys(log.data).forEach((key) => allKeys.add(key));
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

  // 处理搜索参数变化
  const handleSearchParamChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInputSearchParams(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 处理搜索表单提交
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // 更新搜索参数状态并触发新的搜索
    setSearchParams(inputSearchParams);
  };

  // 重置搜索表单
  const handleResetSearch = () => {
    const emptyParams = {
      keyword: '',
      startDate: '',
      endDate: ''
    };
    
    // 重置输入和实际搜索参数
    setInputSearchParams(emptyParams);
    setSearchParams(emptyParams);
  };

  // 监听搜索参数变化，重新获取日志
  useEffect(() => {
    fetchLogs();
  }, [searchParams]);

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
      y: event.clientY,
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

  // 显示批量删除确认对话框
  const handleBulkDeleteClick = () => {
    if (selectedLogs.length === 0) return;
    
    setDeleteConfirm({ id: selectedLogs, isDeleting: false });
    // 清除之前的成功/错误消息
    setDeleteError(null);
    setDeleteSuccess(null);
  };

  // 取消删除
  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  // 确认删除（单个或批量）
  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;

    try {
      setDeleteConfirm({ ...deleteConfirm, isDeleting: true });

      // 判断是单个删除还是批量删除
      if (Array.isArray(deleteConfirm.id)) {
        // 批量删除
        const idsParam = deleteConfirm.id.join(',');
        const response = await fetch(`/api/logs?ids=${idsParam}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          // 获取二进制错误响应
          const encryptedError = await response.arrayBuffer();
          // 客户端直接解密错误响应
          const errorData = decryptData(encryptedError) as ApiResponse;
          throw new Error(errorData.error || "批量删除日志失败");
        }

        // 获取并解密成功响应
        const encryptedSuccess = await response.arrayBuffer();
        const successData = decryptData(encryptedSuccess) as ApiResponse;

        // 删除成功
        setDeleteSuccess(`已成功删除 ${(successData.data as {count: number})?.count || deleteConfirm.id.length} 条日志`);

        // 从本地状态中移除已删除的日志
        setLogs((prevLogs) => {
          // 这里我们确定deleteConfirm.id是一个数组
          const idsToDelete = deleteConfirm.id as number[];
          return prevLogs.filter((log) => !idsToDelete.includes(log.id));
        });

        // 重置选中状态
        setSelectedLogs([]);
        setSelectAll(false);

        // 如果当前展开的日志在被删除列表中，则关闭展开视图
        if (expandedLog !== null) {
          const idsToDelete = deleteConfirm.id as number[];
          if (idsToDelete.includes(expandedLog)) {
            setExpandedLog(null);
          }
        }
      } else {
        // 单个删除
        const response = await fetch(`/api/logs?id=${deleteConfirm.id}`, {
          method: "DELETE",
        });

        if (!response.ok) {
          // 获取二进制错误响应
          const encryptedError = await response.arrayBuffer();
          // 客户端直接解密错误响应
          const errorData = decryptData(encryptedError) as ApiResponse;
          throw new Error(errorData.error || "删除日志失败");
        }

        // 获取并解密成功响应
        const encryptedSuccess = await response.arrayBuffer();
        // 解密响应但不需要使用结果
        decryptData(encryptedSuccess);

        // 删除成功
        setDeleteSuccess(`日志(ID: ${deleteConfirm.id})已成功删除`);

        // 从本地状态中移除已删除的日志
        setLogs((prevLogs) =>
          prevLogs.filter((log) => log.id !== deleteConfirm.id)
        );

        // 从选中列表中移除
        setSelectedLogs(prev => prev.filter(id => id !== deleteConfirm.id));

        // 如果当前展开的是被删除的日志，则关闭展开视图
        if (expandedLog === deleteConfirm.id) {
          setExpandedLog(null);
        }
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

  // 处理单个日志选择
  const handleSelectLog = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedLogs(prev => [...prev, id]);
    } else {
      setSelectedLogs(prev => prev.filter(logId => logId !== id));
      setSelectAll(false);
    }
  };

  // 处理全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      // 全选所有日志
      setSelectedLogs(logs.map(log => log.id));
    } else {
      // 取消全选
      setSelectedLogs([]);
    }
  };

  // 当日志数据更新时，更新全选状态
  useEffect(() => {
    if (logs.length > 0 && selectedLogs.length === logs.length) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedLogs, logs]);

  // 处理排序
  const handleSort = (key: string) => {
    setSortConfig((prevConfig) => {
      if (prevConfig.key === key) {
        // 如果已经在按这个键排序，切换排序方向
        return {
          key,
          direction: prevConfig.direction === "asc" ? "desc" : "asc",
        };
      } else {
        // 否则，使用新键并默认为升序
        return { key, direction: "asc" };
      }
    });
  };

  // 获取排序图标
  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) {
      return null;
    }

    return (
      <span className="ml-1">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>
    );
  };

  // 排序日志
  const sortedLogs = [...logs].sort((a, b) => {
    if (sortConfig.key === "id" || sortConfig.key === "created_at") {
      // 处理内置属性排序
      const valueA =
        sortConfig.key === "id" ? a.id : new Date(a.created_at).getTime();
      const valueB =
        sortConfig.key === "id" ? b.id : new Date(b.created_at).getTime();

      if (sortConfig.direction === "asc") {
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

      if (typeof valueA === "number" && typeof valueB === "number") {
        return sortConfig.direction === "asc"
          ? valueA - valueB
          : valueB - valueA;
      } else {
        const strA = String(valueA).toLowerCase();
        const strB = String(valueB).toLowerCase();
        return sortConfig.direction === "asc"
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

      {/* 搜索区域 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">搜索日志</h2>
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="keyword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                关键词
              </label>
              <input
                type="text"
                id="keyword"
                name="keyword"
                value={inputSearchParams.keyword}
                onChange={handleSearchParamChange}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="搜索日志内容"
              />
            </div>
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                开始日期
              </label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={inputSearchParams.startDate}
                onChange={handleSearchParamChange}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                结束日期
              </label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={inputSearchParams.endDate}
                onChange={handleSearchParamChange}
                className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={handleResetSearch}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
            >
              重置
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              搜索
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">日志列表</h2>
          <div className="flex items-center space-x-2">
            {selectedLogs.length > 0 && (
              <button
                onClick={handleBulkDeleteClick}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition"
              >
                批量删除 ({selectedLogs.length})
              </button>
            )}
            <button
              onClick={fetchLogs}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
            >
              刷新
            </button>
          </div>
        </div>

        {/* 当前搜索条件提示 */}
        {(searchParams.keyword || searchParams.startDate || searchParams.endDate) && (
          <div className="mb-4 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded flex justify-between items-center dark:bg-blue-900 dark:border-blue-800 dark:text-blue-200">
            <div>
              当前搜索:
              {searchParams.keyword && <span className="ml-1">关键词 "{searchParams.keyword}"</span>}
              {searchParams.startDate && <span className="ml-1">从 {searchParams.startDate}</span>}
              {searchParams.endDate && <span className="ml-1">到 {searchParams.endDate}</span>}
            </div>
            <button 
              onClick={handleResetSearch}
              className="text-sm underline"
            >
              清除搜索
            </button>
          </div>
        )}

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
                  {/* 全选复选框 */}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
                    />
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("id")}
                  >
                    ID {getSortIcon("id")}
                  </th>
                  <th
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort("created_at")}
                  >
                    时间 {getSortIcon("created_at")}
                  </th>

                  {/* 动态生成日志属性列 */}
                  {logKeys.map((key) => (
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
                  <tr
                    key={log.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {/* 单选复选框 */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <input
                        type="checkbox"
                        checked={selectedLogs.includes(log.id)}
                        onChange={(e) => handleSelectLog(log.id, e.target.checked)}
                        className="form-checkbox h-4 w-4 text-blue-600 transition duration-150 ease-in-out"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </td>

                    {/* 动态显示日志属性值 */}
                    {logKeys.map((key) => (
                      <td
                        key={key}
                        className="px-6 py-4 whitespace-nowrap text-sm text-gray-500"
                      >
                        {typeof log.data[key] === "object" &&
                        log.data[key] !== null ? (
                          <span
                            className="text-blue-500 cursor-pointer underline"
                            onMouseEnter={(e) =>
                              handleMouseEnter(log.data[key], e)
                            }
                            onMouseLeave={handleMouseLeave}
                          >
                            {Object.keys(log.data[key] as object).length > 0
                              ? "查看对象"
                              : "空对象"}
                          </span>
                        ) : (
                          String(log.data[key] ?? "")
                        )}
                      </td>
                    ))}

                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => toggleExpand(log.id)}
                        className="text-blue-600 hover:text-blue-900 mr-3"
                      >
                        {expandedLog === log.id ? "收起" : "展开"}
                      </button>
                      <button
                        onClick={() => handleDeleteClick(log.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 展开的日志详情 */}
        {expandedLog !== null && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <h3 className="text-lg font-medium mb-2">
              日志详情 (ID: {expandedLog})
            </h3>
            <pre className="bg-white dark:bg-gray-800 p-4 rounded overflow-x-auto text-sm">
              {JSON.stringify(
                logs.find((log) => log.id === expandedLog)?.data || {},
                null,
                2
              )}
            </pre>
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">确认删除</h3>
            <p className="mb-6">
              {Array.isArray(deleteConfirm.id)
                ? `确定要删除选中的 ${deleteConfirm.id.length} 条日志吗？`
                : `确定要删除 ID 为 ${deleteConfirm.id} 的日志吗？`}
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500"
                disabled={deleteConfirm.isDeleting}
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
                disabled={deleteConfirm.isDeleting}
              >
                {deleteConfirm.isDeleting ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 悬浮对象信息卡片 */}
      {hoverInfo && (
        <div
          ref={hoverCardRef}
          onMouseEnter={handleHoverCardMouseEnter}
          onMouseLeave={handleHoverCardMouseLeave}
          style={{
            position: "fixed",
            left: `${hoverInfo.x}px`,
            top: `${hoverInfo.y + 20}px`,
            maxWidth: "400px",
            maxHeight: "300px",
            zIndex: 1000,
          }}
          className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-3 overflow-auto border border-gray-200 dark:border-gray-700"
        >
          <pre className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
            {JSON.stringify(hoverInfo.content, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
