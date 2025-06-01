"use client";

import React from "react";
import { useState, useEffect, useRef } from "react";
import {
  fetchLogs,
  deleteLog,
  bulkDeleteLogs,
  LogQueryParams,
  PaginationInfo,
} from "@/lib/apiClient";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

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

// 新增：搜索过滤器类型
type SearchFilters = {
  keyword: string; // 关键词（搜索或排除）
  searchType: string; // 搜索类型（字段）
  searchMode: "include" | "exclude"; // 搜索模式：包含或排除
  startDate: string; // 开始日期
  endDate: string; // 结束日期
};

// 新增：分页控制类型
type PaginationControls = {
  currentPage: number;
  pageSize: number;
  pageSizeOptions: number[];
};

export function LogViewer() {
  const router = useRouter();
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

  // 新增：搜索过滤器状态
  const [searchFilters, setSearchFilters] = useState<SearchFilters>({
    keyword: "",
    startDate: "",
    endDate: "",
    searchType: "",
    searchMode: "include",
  });

  // 新增：分页控制状态
  const [pagination, setPagination] = useState<PaginationControls>({
    currentPage: 1,
    pageSize: 20,
    pageSizeOptions: [10, 20, 50, 100, 200],
  });

  // 新增：分页信息状态
  const [paginationInfo, setPaginationInfo] = useState<PaginationInfo | null>(
    null
  );

  // 新增：是否使用前端或后端搜索
  const [useServerSearch, setUseServerSearch] = useState(false);

  // 用于跟踪鼠标是否在悬浮框内
  const hoverCardRef = useRef<HTMLDivElement>(null);
  const [isMouseInHoverCard, setIsMouseInHoverCard] = useState(false);

  // 获取日志数据
  const fetchLogsData = async (serverParams?: LogQueryParams) => {
    try {
      setLoading(true);

      // 构建API查询参数
      const params: LogQueryParams = serverParams || {
        page: pagination.currentPage,
        pageSize: pagination.pageSize,
      };

      // 如果需要使用服务器端搜索，添加搜索参数
      if (useServerSearch && !serverParams) {
        if (searchFilters.keyword) {
          params.keyword = searchFilters.keyword;
          params.field = searchFilters.searchType || "";
        }
        if (searchFilters.startDate) {
          params.startDate = searchFilters.startDate;
        }
        if (searchFilters.endDate) {
          params.endDate = searchFilters.endDate;
        }
      }

      const response = await fetchLogs(params);

      if (!response.success) {
        throw new Error(response.error || "获取日志失败");
      }

      // 确保response.data是数组
      const logsData = Array.isArray(response.data) ? response.data : [];
      setLogs(logsData);

      // 更新分页信息
      if (response.pagination) {
        setPaginationInfo(response.pagination);
        // 同步当前页码
        setPagination((prev) => ({
          ...prev,
          currentPage: response.pagination?.page || 1,
        }));
      }

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

  // 新增: 处理分页切换
  const handlePageChange = (pageNumber: number) => {
    setPagination((prev) => ({
      ...prev,
      currentPage: pageNumber,
    }));
    // 如果使用服务器端搜索，重新获取数据
    if (useServerSearch) {
      fetchLogsData({
        page: pageNumber,
        pageSize: pagination.pageSize,
        keyword: searchFilters.keyword || undefined,
        field: searchFilters.searchType || undefined,
        startDate: searchFilters.startDate || undefined,
        endDate: searchFilters.endDate || undefined,
      });
    }
  };

  // 新增: 处理每页条数变更
  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPageSize = parseInt(e.target.value, 10);
    setPagination((prev) => ({
      ...prev,
      pageSize: newPageSize,
      currentPage: 1, // 重置到第一页
    }));

    // 如果使用服务器端搜索，重新获取数据
    if (useServerSearch) {
      fetchLogsData({
        page: 1,
        pageSize: newPageSize,
        keyword: searchFilters.keyword || undefined,
        field: searchFilters.searchType || undefined,
        startDate: searchFilters.startDate || undefined,
        endDate: searchFilters.endDate || undefined,
      });
    }
  };

  // 新增：切换搜索模式（前端/后端）
  const toggleSearchMode = () => {
    setUseServerSearch((prev) => !prev);
  };

  // 新增：使用服务器端搜索
  const handleServerSearch = () => {
    fetchLogsData({
      page: 1, // 重置到第一页
      pageSize: pagination.pageSize,
      keyword: searchFilters.keyword || undefined,
      field: searchFilters.searchType || undefined,
      startDate: searchFilters.startDate || undefined,
      endDate: searchFilters.endDate || undefined,
    });
  };

  // 新增：补充获取日志
  const fetchAdditionalLogs = async () => {
    if (!paginationInfo) return;

    try {
      setLoading(true);

      // 获取当前列表之后的日志
      const response = await fetchLogs({
        start: paginationInfo.end,
        end: paginationInfo.end + pagination.pageSize,
        keyword: searchFilters.keyword || undefined,
        field: searchFilters.searchType || undefined,
        startDate: searchFilters.startDate || undefined,
        endDate: searchFilters.endDate || undefined,
      });

      if (!response.success) {
        throw new Error(response.error || "获取补充日志失败");
      }

      const additionalLogs = (response.data as Log[]) || [];

      // 合并日志
      setLogs((prev) => [...prev, ...additionalLogs]);

      // 更新分页信息
      if (response.pagination) {
        setPaginationInfo(response.pagination);
      }

      return additionalLogs.length;
    } catch (err) {
      console.error("获取补充日志失败:", err);
      return 0;
    } finally {
      setLoading(false);
    }
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
        const response = await bulkDeleteLogs(deleteConfirm.id);

        if (!response.success) {
          throw new Error(response.error || "批量删除日志失败");
        }

        // 删除成功
        setDeleteSuccess(
          `已成功删除 ${
            (response.data as { count: number })?.count ||
            deleteConfirm.id.length
          } 条日志`
        );

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
        const response = await deleteLog(deleteConfirm.id);

        if (!response.success) {
          throw new Error(response.error || "删除日志失败");
        }

        // 删除成功
        setDeleteSuccess(`日志(ID: ${deleteConfirm.id})已成功删除`);

        // 从本地状态中移除已删除的日志
        setLogs((prevLogs) =>
          prevLogs.filter((log) => log.id !== deleteConfirm.id)
        );

        // 从选中列表中移除
        setSelectedLogs((prev) => prev.filter((id) => id !== deleteConfirm.id));

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
      setSelectedLogs((prev) => [...prev, id]);
    } else {
      setSelectedLogs((prev) => prev.filter((logId) => logId !== id));
      setSelectAll(false);
    }
  };

  // 处理全选/取消全选
  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      // 全选所有日志
      setSelectedLogs(logs.map((log) => log.id));
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
      <span className="ml-1 text-blue-500">
        {sortConfig.direction === "asc" ? (
          <svg
            className="w-4 h-4 inline"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M5 15l7-7 7 7"
            ></path>
          </svg>
        ) : (
          <svg
            className="w-4 h-4 inline"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            ></path>
          </svg>
        )}
      </span>
    );
  };

  // 修改 handleSearchFilterChange 函数
  const handleSearchFilterChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setSearchFilters((prev) => ({
      ...prev,
      [name]: value,
    }));

    // 如果是服务端搜索，不要在这里立即触发搜索
    // 用户需要点击"搜索"按钮来触发
  };

  // 修改 handleResetFilters 函数
  const handleResetFilters = () => {
    setSearchFilters({
      keyword: "",
      startDate: "",
      endDate: "",
      searchType: "",
      searchMode: "include",
    });

    // 如果使用服务器端搜索，重置后触发搜索
    if (useServerSearch) {
      fetchLogsData({
        page: 1,
        pageSize: pagination.pageSize,
      });
    }
  };

  // 过滤日志函数
  const filterLogs = (logs: Log[]) => {
    if (!Array.isArray(logs) || logs.length === 0) {
      return [];
    }
    
    return logs.filter((log) => {
      // 关键词过滤
      if (searchFilters.keyword) {
        const isMatching = (() => {
          // 根据搜索类型过滤
          if (searchFilters.searchType) {
            if (searchFilters.searchType === "id") {
              // 按ID搜索
              return String(log.id)
                .toLowerCase()
                .includes(searchFilters.keyword.toLowerCase());
            } else if (searchFilters.searchType === "time") {
              // 按时间搜索
              return new Date(log.created_at)
                .toLocaleString()
                .toLowerCase()
                .includes(searchFilters.keyword.toLowerCase());
            } else {
              // 按特定字段搜索
              const value = log.data[searchFilters.searchType];
              if (value === undefined || value === null) {
                return false;
              }

              if (typeof value === "object") {
                // 对象类型：转为JSON字符串进行搜索
                return JSON.stringify(value)
                  .toLowerCase()
                  .includes(searchFilters.keyword.toLowerCase());
              } else {
                // 基本类型：转为字符串进行搜索
                return String(value)
                  .toLowerCase()
                  .includes(searchFilters.keyword.toLowerCase());
              }
            }
          } else {
            // 无类型，全局搜索
            return isLogMatchingKeyword(log, searchFilters.keyword);
          }
        })();

        // 根据搜索模式决定是包含还是排除
        if (searchFilters.searchMode === "include" && !isMatching) {
          return false;
        }
        if (searchFilters.searchMode === "exclude" && isMatching) {
          return false;
        }
      }

      // 日期范围过滤
      const logDate = new Date(log.created_at).getTime();

      // 开始日期过滤
      if (searchFilters.startDate) {
        const startDate = new Date(searchFilters.startDate).setHours(
          0,
          0,
          0,
          0
        );
        if (logDate < startDate) {
          return false;
        }
      }

      // 结束日期过滤
      if (searchFilters.endDate) {
        const endDate = new Date(searchFilters.endDate).setHours(
          23,
          59,
          59,
          999
        );
        if (logDate > endDate) {
          return false;
        }
      }

      return true;
    });
  };

  // 新增：检查日志是否包含关键词
  const isLogMatchingKeyword = (log: Log, keyword: string) => {
    const keywordLower = keyword.toLowerCase();

    // 检查ID
    if (String(log.id).includes(keywordLower)) {
      return true;
    }

    // 检查日期
    if (
      new Date(log.created_at)
        .toLocaleString()
        .toLowerCase()
        .includes(keywordLower)
    ) {
      return true;
    }

    // 检查日志内容
    for (const key in log.data) {
      const value = log.data[key];
      if (value !== null && value !== undefined) {
        if (typeof value === "object") {
          // 对象类型：转为JSON字符串进行搜索
          if (JSON.stringify(value).toLowerCase().includes(keywordLower)) {
            return true;
          }
        } else {
          // 基本类型：转为字符串进行搜索
          if (String(value).toLowerCase().includes(keywordLower)) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // 排序日志
  const sortedLogs = Array.isArray(logs) ? [...logs].sort((a, b) => {
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
        // 修复数字排序：确保进行数值比较
        return sortConfig.direction === "asc"
          ? Number(valueA) - Number(valueB)
          : Number(valueB) - Number(valueA);
      } else {
        // 尝试将字符串转换为数字进行比较
        const numA = !isNaN(Number(valueA)) ? Number(valueA) : null;
        const numB = !isNaN(Number(valueB)) ? Number(valueB) : null;

        if (numA !== null && numB !== null) {
          // 如果两个值都可以转换为数字，进行数值比较
          return sortConfig.direction === "asc" ? numA - numB : numB - numA;
        } else {
          // 否则进行字符串比较
          const strA = String(valueA).toLowerCase();
          const strB = String(valueB).toLowerCase();
          return sortConfig.direction === "asc"
            ? strA.localeCompare(strB)
            : strB.localeCompare(strA);
        }
      }
    }
  }) : [];

  // 新增：过滤并排序日志
  const filteredAndSortedLogs = filterLogs(sortedLogs);

  // 页面加载时获取日志
  useEffect(() => {
    fetchLogsData();
  }, []);

  // 登出功能
  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    router.push("/login");
  };

  return (
    <div className="space-y-6 p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-100 dark:border-gray-700"
      >
        <div className="flex justify-between items-center mb-6 border-b border-gray-100 dark:border-gray-700 pb-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center">
            <svg
              className="w-6 h-6 mr-2 text-blue-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              ></path>
            </svg>
            日志列表
          </h2>
          <div className="flex items-center space-x-3">
            {selectedLogs.length > 0 && (
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleBulkDeleteClick}
                className="px-4 py-2 bg-red-500 text-white rounded-lg shadow-md hover:bg-red-600 transition-all duration-200 flex items-center"
              >
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  ></path>
                </svg>
                批量删除 ({selectedLogs.length})
              </motion.button>
            )}
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => fetchLogsData()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow-md hover:bg-blue-600 transition-all duration-200 flex items-center"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                ></path>
              </svg>
              刷新
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg shadow-md hover:bg-gray-700 transition-all duration-200 flex items-center"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                ></path>
              </svg>
              登出
            </motion.button>
          </div>
        </div>

        {/* 搜索过滤器 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-100 dark:border-gray-700"
        >
          <div className="flex flex-wrap md:flex-nowrap items-center gap-4">
            {/* 搜索/排除选择和关键词输入 */}
            <div className="flex h-11 items-center rounded-lg overflow-hidden shadow-sm border border-gray-200 dark:border-gray-600 w-full md:w-auto">
              <div className="bg-gray-50 dark:bg-gray-700 px-3 py-2 h-full flex items-center">
                <svg
                  className="w-5 h-5 text-gray-500 dark:text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                  ></path>
                </svg>
              </div>
              <select
                id="searchType"
                name="searchType"
                value={searchFilters.searchType}
                onChange={handleSearchFilterChange}
                className="h-full px-3 py-2 border-none focus:outline-none text-sm bg-white dark:bg-gray-600 rounded-r-lg"
              >
                <option value="">全部字段</option>
                <option value="id">ID</option>
                <option value="time">时间</option>
                {logKeys.map((key) => (
                  <option key={`search-${key}`} value={key}>
                    {key}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center flex-1 min-w-0">
              <div className="flex h-11 w-full items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden shadow-sm">
                <div className="flex h-full items-center rounded-l-md overflow-hidden">
                  <select
                    id="searchMode"
                    name="searchMode"
                    value={searchFilters.searchMode}
                    onChange={handleSearchFilterChange}
                    className="h-full px-3 py-2 border-none focus:outline-none text-sm bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium"
                  >
                    <option value="include">搜索</option>
                    <option value="exclude">排除</option>
                  </select>
                </div>
                <div className="flex-1 relative h-full">
                  <input
                    type="text"
                    id="keyword"
                    name="keyword"
                    value={searchFilters.keyword}
                    onChange={handleSearchFilterChange}
                    placeholder={
                      searchFilters.searchMode === "include"
                        ? "搜索关键词..."
                        : "排除包含这些词的日志..."
                    }
                    className="h-full w-full px-4 py-2 border-none focus:outline-none focus:ring-blue-500 text-gray-700 dark:text-gray-200"
                  />
                  {searchFilters.keyword && (
                    <button
                      onClick={() =>
                        setSearchFilters({ ...searchFilters, keyword: "" })
                      }
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M6 18L18 6M6 6l12 12"
                        ></path>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 日期范围选择 */}
            <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
              <div className="relative">
                <div className="flex h-11 items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-gray-50 dark:bg-gray-700 px-3 py-2 h-full flex items-center">
                    <svg
                      className="w-5 h-5 text-gray-500 dark:text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      ></path>
                    </svg>
                  </div>
                  <input
                    type="date"
                    id="startDate"
                    name="startDate"
                    value={searchFilters.startDate}
                    onChange={handleSearchFilterChange}
                    className="h-full px-3 py-2 border-none focus:outline-none focus:ring-blue-500 bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                    placeholder="开始日期"
                  />
                </div>
                <span className="absolute -top-5 left-12 text-xs font-medium text-gray-500 dark:text-gray-400">
                  开始日期
                </span>
              </div>

              <div className="relative">
                <div className="flex h-11 items-center border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden shadow-sm">
                  <div className="bg-gray-50 dark:bg-gray-700 px-3 py-2 h-full flex items-center">
                    <svg
                      className="w-5 h-5 text-gray-500 dark:text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      ></path>
                    </svg>
                  </div>
                  <input
                    type="date"
                    id="endDate"
                    name="endDate"
                    value={searchFilters.endDate}
                    onChange={handleSearchFilterChange}
                    className="h-full px-3 py-2 border-none focus:outline-none focus:ring-blue-500 bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200"
                    placeholder="结束日期"
                  />
                </div>
                <span className="absolute -top-5 left-12 text-xs font-medium text-gray-500 dark:text-gray-400">
                  结束日期
                </span>
              </div>

              {/* 重置按钮 */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleResetFilters}
                className="h-11 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-all duration-200 shadow-sm whitespace-nowrap flex items-center"
              >
                <svg
                  className="w-4 h-4 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  ></path>
                </svg>
                重置过滤器
              </motion.button>
            </div>
          </div>

          {/* 显示过滤结果统计 */}
          <AnimatePresence>
            {(searchFilters.keyword ||
              searchFilters.startDate ||
              searchFilters.endDate) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 text-sm text-gray-600 dark:text-gray-400 flex items-center"
              >
                <svg
                  className="w-4 h-4 mr-1 text-blue-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  ></path>
                </svg>
                过滤结果:{" "}
                <span className="font-semibold text-blue-600 dark:text-blue-400 mx-1">
                  {filteredAndSortedLogs.length}
                </span>{" "}
                / {logs.length} 条日志
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* 状态消息区域 */}
        <AnimatePresence>
          {/* 删除成功消息 */}
          {deleteSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 bg-green-50 border-l-4 border-green-500 text-green-700 p-4 rounded-lg shadow-sm flex items-center"
            >
              <svg
                className="w-5 h-5 mr-2 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
              {deleteSuccess}
            </motion.div>
          )}

          {/* 删除错误消息 */}
          {deleteError && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-4 bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-sm flex items-center"
            >
              <svg
                className="w-5 h-5 mr-2 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
              {deleteError}
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <svg
              className="animate-spin h-12 w-12 text-blue-500 mb-4"
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
            <span className="text-lg text-gray-600 dark:text-gray-300">
              加载日志数据中...
            </span>
          </motion.div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-50 border-l-4 border-red-500 text-red-700 p-6 rounded-lg shadow-sm flex flex-col items-center justify-center"
          >
            <svg
              className="w-12 h-12 text-red-500 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              ></path>
            </svg>
            <span className="text-lg font-medium">{error}</span>
            <button
              onClick={() => fetchLogsData()}
              className="mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-all duration-200 flex items-center"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                ></path>
              </svg>
              重试
            </button>
          </motion.div>
        ) : logs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 flex flex-col items-center"
          >
            <svg
              className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              ></path>
            </svg>
            <p className="text-xl text-gray-500 dark:text-gray-400 font-medium">
              暂无日志数据
            </p>
            <p className="text-gray-400 dark:text-gray-500 mt-2">
              当有新的日志产生时会自动显示在这里
            </p>
          </motion.div>
        ) : filteredAndSortedLogs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 flex flex-col items-center"
          >
            <svg
              className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              ></path>
            </svg>
            <p className="text-xl text-gray-500 dark:text-gray-400 font-medium">
              没有匹配的日志数据
            </p>
            <p className="text-gray-400 dark:text-gray-500 mt-2">
              尝试调整过滤条件后再次搜索
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-4 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-600 rounded-lg transition-all duration-200 flex items-center"
            >
              <svg
                className="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                ></path>
              </svg>
              重置过滤器
            </button>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="overflow-x-auto rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm"
          >
            <div className="max-h-[1000px] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10 shadow-sm">
                  <tr>
                    {/* 全选复选框 */}
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      <div className="flex items-center">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={selectAll}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            className="h-5 w-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 transition-all duration-150"
                          />
                          <span className="absolute inset-0 bg-blue-500 opacity-0 group-checked:opacity-100 transition-opacity"></span>
                        </div>
                      </div>
                    </th>
                    <th
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-150 cursor-pointer group"
                      onClick={() => handleSort("id")}
                    >
                      <div className="flex items-center">
                        <span>ID</span>
                        <span className="ml-1 transform transition-transform duration-200">
                          {getSortIcon("id") || (
                            <svg
                              className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                              ></path>
                            </svg>
                          )}
                        </span>
                      </div>
                    </th>
                    <th
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-150 cursor-pointer group"
                      onClick={() => handleSort("created_at")}
                    >
                      <div className="flex items-center">
                        <span>时间</span>
                        <span className="ml-1 transform transition-transform duration-200">
                          {getSortIcon("created_at") || (
                            <svg
                              className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                              ></path>
                            </svg>
                          )}
                        </span>
                      </div>
                    </th>

                    {/* 动态生成日志属性列 */}
                    {logKeys.map((key) => (
                      <th
                        key={key}
                        className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors duration-150 cursor-pointer group"
                        onClick={() => handleSort(key)}
                      >
                        <div className="flex items-center">
                          <span>{key}</span>
                          <span className="ml-1 transform transition-transform duration-200">
                            {getSortIcon(key) || (
                              <svg
                                className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"
                                ></path>
                              </svg>
                            )}
                          </span>
                        </div>
                      </th>
                    ))}

                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredAndSortedLogs.map((log) => (
                    <React.Fragment key={log.id}>
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 ${
                          selectedLogs.includes(log.id)
                            ? "bg-blue-50 dark:bg-blue-900/20"
                            : ""
                        } ${
                          expandedLog === log.id
                            ? "bg-gray-50 dark:bg-gray-700/50"
                            : ""
                        }`}
                      >
                        {/* 单选复选框 */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={selectedLogs.includes(log.id)}
                              onChange={(e) =>
                                handleSelectLog(log.id, e.target.checked)
                              }
                              className="h-5 w-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 transition-all duration-150"
                            />
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700 dark:text-gray-300">
                          {log.id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center">
                            <svg
                              className="w-4 h-4 mr-1.5 text-gray-400 dark:text-gray-500"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              ></path>
                            </svg>
                            {new Date(log.created_at).toLocaleString()}
                          </div>
                        </td>

                        {/* 动态显示日志属性值 */}
                        {logKeys.map((key) => (
                          <td
                            key={key}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400"
                          >
                            {typeof log.data[key] === "object" &&
                            log.data[key] !== null ? (
                              <motion.span
                                whileHover={{ scale: 1.05 }}
                                className="text-blue-500 dark:text-blue-400 cursor-pointer flex items-center font-medium bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded text-xs"
                                onMouseEnter={(e) =>
                                  handleMouseEnter(log.data[key], e)
                                }
                                onMouseLeave={handleMouseLeave}
                              >
                                <svg
                                  className="w-3.5 h-3.5 mr-1"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  xmlns="http://www.w3.org/2000/svg"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth="2"
                                    d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"
                                  ></path>
                                </svg>
                                对象数据
                              </motion.span>
                            ) : (
                              <span
                                className={`${
                                  log.data[key]
                                    ? ""
                                    : "text-gray-400 dark:text-gray-600 italic"
                                }`}
                              >
                                {String(log.data[key] ?? "-")}
                              </span>
                            )}
                          </td>
                        ))}

                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex space-x-3">
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => toggleExpand(log.id)}
                              className={`px-2.5 py-1 rounded-md flex items-center text-xs font-medium ${
                                expandedLog === log.id
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                                  : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              } transition-colors duration-150`}
                            >
                              <svg
                                className={`w-3.5 h-3.5 mr-1 transition-transform duration-200 ${
                                  expandedLog === log.id ? "rotate-180" : ""
                                }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M19 9l-7 7-7-7"
                                ></path>
                              </svg>
                              {expandedLog === log.id ? "折叠" : "展开"}
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleDeleteClick(log.id)}
                              className="px-2.5 py-1 rounded-md flex items-center text-xs font-medium bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors duration-150"
                            >
                              <svg
                                className="w-3.5 h-3.5 mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                xmlns="http://www.w3.org/2000/svg"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth="2"
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                ></path>
                              </svg>
                              删除
                            </motion.button>
                          </div>
                        </td>
                      </motion.tr>

                      {/* 行内展开的日志详情 */}
                      <AnimatePresence>
                        {expandedLog === log.id && (
                          <motion.tr
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <td
                              colSpan={logKeys.length + 4}
                              className="px-0 py-0 border-0"
                            >
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="mx-4 my-2 p-5 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700"
                              >
                                <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100 dark:border-gray-700">
                                  <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200 flex items-center">
                                    <svg
                                      className="w-5 h-5 mr-2 text-blue-500"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                      ></path>
                                    </svg>
                                    日志详情{" "}
                                    <span className="text-gray-500 dark:text-gray-400 ml-2 font-normal">
                                      ID: {log.id}
                                    </span>
                                  </h3>
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setExpandedLog(null)}
                                    className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-150"
                                  >
                                    <svg
                                      className="w-5 h-5 text-gray-500 dark:text-gray-400"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                      xmlns="http://www.w3.org/2000/svg"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth="2"
                                        d="M6 18L18 6M6 6l12 12"
                                      ></path>
                                    </svg>
                                  </motion.button>
                                </div>
                                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden">
                                  <pre className="whitespace-pre-wrap text-sm p-4 overflow-x-auto max-h-96 text-gray-700 dark:text-gray-300">
                                    {JSON.stringify(log.data, null, 2)}
                                  </pre>
                                </div>
                              </motion.div>
                            </td>
                          </motion.tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* 悬浮显示对象信息 */}
        <AnimatePresence>
          {hoverInfo && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
              ref={hoverCardRef}
              className="fixed bg-white dark:bg-gray-800 shadow-xl rounded-lg p-4 border border-gray-200 dark:border-gray-700 z-50 max-w-md"
              style={{
                top: `${hoverInfo.y + 10}px`,
                left: `${hoverInfo.x + 10}px`,
              }}
              onMouseEnter={handleHoverCardMouseEnter}
              onMouseLeave={handleHoverCardMouseLeave}
            >
              <div className="flex justify-between items-center mb-2 pb-1 border-b border-gray-100 dark:border-gray-700">
                <h4 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  对象数据
                </h4>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  点击外部关闭
                </span>
              </div>
              <pre className="whitespace-pre-wrap text-sm overflow-x-auto max-h-60 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md text-gray-700 dark:text-gray-300">
                {JSON.stringify(hoverInfo.content, null, 2)}
              </pre>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 删除确认对话框 */}
        <AnimatePresence>
          {deleteConfirm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-md mx-4"
              >
                <div className="flex items-center mb-4 text-red-500">
                  <svg
                    className="w-8 h-8 mr-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    ></path>
                  </svg>
                  <h3 className="text-xl font-bold">确认删除</h3>
                </div>

                <p className="mb-6 text-gray-600 dark:text-gray-300">
                  {Array.isArray(deleteConfirm.id) ? (
                    <>
                      您确定要删除选中的{" "}
                      <span className="font-semibold text-red-500">
                        {deleteConfirm.id.length}
                      </span>{" "}
                      条日志吗？此操作无法撤销。
                    </>
                  ) : (
                    <>
                      您确定要删除ID为{" "}
                      <span className="font-semibold text-red-500">
                        {deleteConfirm.id}
                      </span>{" "}
                      的日志吗？此操作无法撤销。
                    </>
                  )}
                </p>

                <div className="flex justify-end space-x-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleCancelDelete}
                    disabled={deleteConfirm.isDeleting}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors duration-200"
                  >
                    取消
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleConfirmDelete}
                    disabled={deleteConfirm.isDeleting}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors duration-200 flex items-center shadow-md"
                  >
                    {deleteConfirm.isDeleting ? (
                      <>
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
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4 mr-2"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          ></path>
                        </svg>
                        确认删除
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 在表格底部添加分页控件 */}
        {!loading && !error && logs.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col md:flex-row justify-between items-center mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 border border-gray-100 dark:border-gray-700"
          >
            {/* 每页条数选择 */}
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                每页显示:
              </span>
              <select
                value={pagination.pageSize}
                onChange={handlePageSizeChange}
                className="h-9 px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {pagination.pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            {/* 分页信息 */}
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4 md:mb-0">
              {paginationInfo ? (
                <>
                  显示 {paginationInfo.start + 1} - {paginationInfo.end} 条，共{" "}
                  {paginationInfo.totalLogs} 条记录
                </>
              ) : (
                <>显示 {logs.length} 条记录</>
              )}
            </div>

            {/* 分页按钮 */}
            {paginationInfo &&
              paginationInfo.totalPages > 1 &&
              useServerSearch && (
                <div className="flex items-center space-x-1">
                  {/* 首页按钮 */}
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={paginationInfo.page === 1}
                    className={`w-9 h-9 flex items-center justify-center rounded-md ${
                      paginationInfo.page === 1
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                      ></path>
                    </svg>
                  </button>

                  {/* 上一页按钮 */}
                  <button
                    onClick={() => handlePageChange(paginationInfo.page - 1)}
                    disabled={paginationInfo.page === 1}
                    className={`w-9 h-9 flex items-center justify-center rounded-md ${
                      paginationInfo.page === 1
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 19l-7-7 7-7"
                      ></path>
                    </svg>
                  </button>

                  {/* 页码 */}
                  {Array.from({
                    length: Math.min(5, paginationInfo.totalPages),
                  }).map((_, i) => {
                    // 显示当前页及其前后共5页
                    let pageNum = paginationInfo.page - 2 + i;

                    // 调整显示的页码，确保始终显示5个页码（如果总页数>=5）
                    if (pageNum < 1) pageNum = i + 1;
                    if (pageNum > paginationInfo.totalPages)
                      pageNum = paginationInfo.totalPages - (4 - i);

                    // 确保页码在有效范围内
                    if (pageNum < 1 || pageNum > paginationInfo.totalPages)
                      return null;

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`w-9 h-9 flex items-center justify-center rounded-md ${
                          pageNum === paginationInfo.page
                            ? "bg-blue-500 text-white"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  {/* 下一页按钮 */}
                  <button
                    onClick={() => handlePageChange(paginationInfo.page + 1)}
                    disabled={paginationInfo.page === paginationInfo.totalPages}
                    className={`w-9 h-9 flex items-center justify-center rounded-md ${
                      paginationInfo.page === paginationInfo.totalPages
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 5l7 7-7 7"
                      ></path>
                    </svg>
                  </button>

                  {/* 末页按钮 */}
                  <button
                    onClick={() => handlePageChange(paginationInfo.totalPages)}
                    disabled={paginationInfo.page === paginationInfo.totalPages}
                    className={`w-9 h-9 flex items-center justify-center rounded-md ${
                      paginationInfo.page === paginationInfo.totalPages
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 5l7 7-7 7M5 5l7 7-7 7"
                      ></path>
                    </svg>
                  </button>
                </div>
              )}

            {/* 搜索模式切换 */}
            <div className="flex items-center mt-4 md:mt-0 md:ml-4">
              <button
                onClick={toggleSearchMode}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  useServerSearch
                    ? "bg-blue-500"
                    : "bg-gray-300 dark:bg-gray-600"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform ${
                    useServerSearch ? "translate-x-5" : "translate-x-1"
                  }`}
                ></span>
              </button>
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                {useServerSearch ? "服务器端搜索" : "前端搜索"}
              </span>

              {/* 补充加载按钮（仅在前端搜索模式下显示） */}
              {!useServerSearch && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fetchAdditionalLogs()}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg shadow-sm hover:bg-blue-600 transition-colors duration-200 flex items-center"
                  disabled={loading}
                >
                  {loading ? (
                    <svg
                      className="animate-spin h-4 w-4 mr-2"
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
                  ) : (
                    <svg
                      className="w-4 h-4 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 14l-7 7m0 0l-7-7m7 7V3"
                      ></path>
                    </svg>
                  )}
                  加载更多
                </motion.button>
              )}

              {/* 服务端搜索按钮 */}
              {useServerSearch && searchFilters.keyword && (
                <button
                  onClick={() => handleServerSearch()}
                  className="ml-2 px-3 py-1 bg-blue-500 text-white rounded-md text-sm flex items-center"
                >
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    ></path>
                  </svg>
                  搜索
                </button>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
