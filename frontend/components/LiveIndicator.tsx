"use client";

import { Activity, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

interface LiveIndicatorProps {
  isConnected: boolean;
  lastUpdate?: Date | null;
  logsPerMinute?: number;
}

/**
 * Live activity indicator showing real-time connection status
 */
export default function LiveIndicator({
  isConnected,
  lastUpdate,
  logsPerMinute = 0,
}: LiveIndicatorProps) {
  const [pulse, setPulse] = useState(false);

  // Pulse animation on data update
  useEffect(() => {
    if (lastUpdate) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 500);
      return () => clearTimeout(timer);
    }
  }, [lastUpdate]);

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-card rounded-lg border border-border">
      {/* Connection Status */}
      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <div className="relative">
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full animate-ping" />
            </div>
            <span className="text-sm text-green-500 font-medium">Live</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-red-500" />
            <span className="text-sm text-red-500 font-medium">Offline</span>
          </>
        )}
      </div>

      {/* Separator */}
      <div className="w-px h-4 bg-border" />

      {/* Activity */}
      <div className="flex items-center gap-2">
        <Activity 
          className={`h-4 w-4 ${pulse ? "text-primary scale-125" : "text-muted-foreground"} transition-all duration-200`}
        />
        <span className="text-sm text-muted-foreground">
          {logsPerMinute.toFixed(1)}/min
        </span>
      </div>

      {/* Last Update */}
      {lastUpdate && (
        <>
          <div className="w-px h-4 bg-border" />
          <span className="text-xs text-muted-foreground">
            Updated {formatRelativeTime(lastUpdate)}
          </span>
        </>
      )}
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSeconds < 5) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  return date.toLocaleTimeString();
}

/**
 * Animated pulse dot for indicating live updates
 */
export function PulseDot({ 
  color = "bg-green-500",
  size = "small" 
}: { 
  color?: string;
  size?: "small" | "medium" | "large";
}) {
  const sizeClasses = {
    small: "w-2 h-2",
    medium: "w-3 h-3",
    large: "w-4 h-4",
  };

  return (
    <span className="relative flex">
      <span
        className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-75`}
      />
      <span
        className={`relative inline-flex rounded-full ${color} ${sizeClasses[size]}`}
      />
    </span>
  );
}
