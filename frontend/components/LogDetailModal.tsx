"use client";

import { Log } from "@/lib/api";
import { 
  AlertCircle, 
  AlertTriangle, 
  Bug, 
  CheckCircle, 
  Clock, 
  Copy, 
  Info, 
  Server, 
  Skull, 
  X 
} from "lucide-react";
import { useEffect, useState } from "react";

interface LogDetailModalProps {
  log: Log | null;
  isOpen: boolean;
  onClose: () => void;
}

const levelConfig = {
  DEBUG: { icon: Bug, color: "text-gray-500", bg: "bg-gray-500/10" },
  INFO: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10" },
  WARN: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
  ERROR: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
  FATAL: { icon: Skull, color: "text-red-700", bg: "bg-red-700/10" },
};

/**
 * Modal for displaying detailed log information
 */
export default function LogDetailModal({
  log,
  isOpen,
  onClose,
}: LogDetailModalProps) {
  const [copied, setCopied] = useState(false);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen || !log) return null;

  const config = levelConfig[log.level as keyof typeof levelConfig] || levelConfig.INFO;
  const Icon = config.icon;

  const formatTimestamp = (ts: string) => {
    const date = new Date(ts);
    return {
      date: date.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
      }),
      relative: getRelativeTime(date),
    };
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  const timestamp = formatTimestamp(log.timestamp);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const fullLogJson = JSON.stringify(log, null, 2);

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative bg-card border border-border rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bg}`}>
              <Icon className={`h-5 w-5 ${config.color}`} />
            </div>
            <div>
              <h2 className="font-semibold text-lg">Log Details</h2>
              <p className="text-sm text-muted-foreground">{log.id}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-border rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Level Badge */}
          <div className="flex items-center gap-4">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${config.bg} ${config.color}`}
            >
              {log.level}
            </span>
            <span className="text-sm text-muted-foreground">
              {timestamp.relative}
            </span>
          </div>

          {/* Message */}
          <div className="bg-background rounded-lg p-4 border border-border">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Message
            </h3>
            <p className="font-mono text-sm whitespace-pre-wrap break-all">
              {log.message}
            </p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Service */}
            <div className="bg-background rounded-lg p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Server className="h-4 w-4" />
                <span className="text-sm font-medium">Service</span>
              </div>
              <p className="font-semibold">{log.service}</p>
            </div>

            {/* Timestamp */}
            <div className="bg-background rounded-lg p-4 border border-border">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">Timestamp</span>
              </div>
              <p className="font-semibold">{timestamp.time}</p>
              <p className="text-sm text-muted-foreground">{timestamp.date}</p>
            </div>
          </div>

          {/* Metadata */}
          {log.meta && Object.keys(log.meta).length > 0 && (
            <div className="bg-background rounded-lg p-4 border border-border">
              <h3 className="text-sm font-medium text-muted-foreground mb-2">
                Metadata
              </h3>
              <pre className="font-mono text-sm overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(log.meta, null, 2)}
              </pre>
            </div>
          )}

          {/* Raw JSON */}
          <div className="bg-background rounded-lg border border-border">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h3 className="text-sm font-medium text-muted-foreground">
                Raw Log (JSON)
              </h3>
              <button
                onClick={() => copyToClipboard(fullLogJson)}
                className="flex items-center gap-2 px-3 py-1 text-sm bg-card border border-border rounded-lg hover:bg-border transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="text-green-500">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-48">
              {fullLogJson}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
