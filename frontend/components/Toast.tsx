"use client";

import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from "lucide-react";
import { createContext, ReactNode, useCallback, useContext, useState } from "react";

// Toast types
export type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

/**
 * Toast Provider component
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newToast = { ...toast, id };
    
    setToasts((prev) => [...prev, newToast]);

    // Auto remove after duration (default 5 seconds)
    const duration = toast.duration ?? 5000;
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

/**
 * Hook to use toast notifications
 */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// Icon map
const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

// Color map
const colorMap = {
  success: "bg-green-500/10 border-green-500/50 text-green-500",
  error: "bg-red-500/10 border-red-500/50 text-red-500",
  warning: "bg-amber-500/10 border-amber-500/50 text-amber-500",
  info: "bg-blue-500/10 border-blue-500/50 text-blue-500",
};

/**
 * Toast Container - renders all active toasts
 */
function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-lg border backdrop-blur-sm shadow-lg animate-slide-in ${colorMap[toast.type]}`}
          >
            <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold">{toast.title}</p>
              {toast.message && (
                <p className="text-sm opacity-90 mt-1">{toast.message}</p>
              )}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 hover:opacity-70 transition-opacity"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Simple standalone Toast component for direct usage
 */
interface SimpleToastProps {
  message: string;
  type: "success" | "error" | "warning" | "info";
  onClose: () => void;
}

export default function Toast({ message, type, onClose }: SimpleToastProps) {
  const Icon = iconMap[type];
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`flex items-start gap-3 p-4 rounded-lg border backdrop-blur-sm shadow-lg animate-slide-in ${colorMap[type]}`}
      >
        <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 hover:opacity-70 transition-opacity"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
