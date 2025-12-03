"use client";

import { Log } from "@/lib/api";
import { ChevronLeft, ChevronRight, ExternalLink, Search } from "lucide-react";
import { useState } from "react";
import LogDetailModal from "./LogDetailModal";

interface LogTableProps {
  logs: Log[];
  loading?: boolean;
  totalLogs: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  searchQuery?: string;
  highlightNew?: boolean;
}

/**
 * Log level badge color mapping
 */
const levelColors: Record<string, string> = {
  DEBUG: "bg-gray-500/20 text-gray-400",
  INFO: "bg-blue-500/20 text-blue-400",
  WARN: "bg-amber-500/20 text-amber-400",
  WARNING: "bg-amber-500/20 text-amber-400",
  ERROR: "bg-red-500/20 text-red-400",
  FATAL: "bg-red-700/20 text-red-500",
  CRITICAL: "bg-red-700/20 text-red-500",
};

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Highlight search terms in text
 */
function highlightText(text: string, query?: string): React.ReactNode {
  if (!query || query.trim() === "") return text;
  
  const parts = text.split(new RegExp(`(${query})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-primary/30 text-primary px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/**
 * Paginated table displaying logs with click-to-expand functionality
 */
export default function LogTable({
  logs,
  loading,
  totalLogs,
  page,
  pageSize,
  onPageChange,
  searchQuery,
  highlightNew = false,
}: LogTableProps) {
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const totalPages = Math.ceil(totalLogs / pageSize);
  const startItem = page * pageSize + 1;
  const endItem = Math.min((page + 1) * pageSize, totalLogs);

  const handleLogClick = (log: Log) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedLog(null);
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-12 bg-border/50 rounded animate-shimmer"
            ></div>
          ))}
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium mb-2">No logs found</p>
        <p className="text-sm">Try adjusting your filters or search query</p>
      </div>
    );
  }

  return (
    <div>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left text-sm text-muted-foreground">
              <th className="px-4 py-3 font-medium">Timestamp</th>
              <th className="px-4 py-3 font-medium">Level</th>
              <th className="px-4 py-3 font-medium">Service</th>
              <th className="px-4 py-3 font-medium">Message</th>
              <th className="px-4 py-3 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, index) => (
              <tr
                key={log.id}
                onClick={() => handleLogClick(log)}
                className={`border-b border-border hover:bg-primary/5 cursor-pointer transition-all group ${
                  highlightNew && index === 0 ? "animate-highlight" : ""
                } ${log.level === "ERROR" || log.level === "FATAL" ? "hover:bg-red-500/5" : ""}`}
              >
                <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                  {formatTimestamp(log.timestamp)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      levelColors[log.level] || levelColors.INFO
                    }`}
                  >
                    {log.level}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium whitespace-nowrap">
                  {highlightText(log.service, searchQuery)}
                </td>
                <td className="px-4 py-3 text-sm max-w-xl truncate">
                  {highlightText(log.message, searchQuery)}
                </td>
                <td className="px-4 py-3">
                  <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-border">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{startItem}</span>-
          <span className="font-medium text-foreground">{endItem}</span> of{" "}
          <span className="font-medium text-foreground">{totalLogs.toLocaleString()}</span> logs
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(0)}
            disabled={page === 0}
            className="px-3 py-1.5 text-sm rounded-lg hover:bg-card disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            First
          </button>
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0}
            className="p-2 rounded-lg hover:bg-card disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm px-2">
            Page <span className="font-medium">{page + 1}</span> of{" "}
            <span className="font-medium">{totalPages}</span>
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1}
            className="p-2 rounded-lg hover:bg-card disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => onPageChange(totalPages - 1)}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 text-sm rounded-lg hover:bg-card disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Last
          </button>
        </div>
      </div>

      {/* Log Detail Modal */}
      <LogDetailModal
        log={selectedLog}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </div>
  );
}
