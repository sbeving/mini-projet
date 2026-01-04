"use client";

import { Activity, Radio, Wifi, WifiOff, Zap } from "lucide-react";
import { useEffect, useState } from "react";

interface LiveIndicatorProps {
  isConnected: boolean;
  lastUpdate?: Date | null;
  logsPerMinute?: number;
  logsPerSecond?: number;
  errorsPerSecond?: number;
  activeConnections?: number;
}

/**
 * Live activity indicator showing real-time connection status
 */
export default function LiveIndicator({
  isConnected,
  lastUpdate,
  logsPerMinute = 0,
  logsPerSecond = 0,
  errorsPerSecond = 0,
  activeConnections = 0,
}: LiveIndicatorProps) {
  const [pulse, setPulse] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Pulse animation on data update
  useEffect(() => {
    if (lastUpdate) {
      setPulse(true);
      const timer = setTimeout(() => setPulse(false), 500);
      return () => clearTimeout(timer);
    }
  }, [lastUpdate]);

  return (
    <div 
      className="relative flex items-center gap-3 px-4 py-2 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
      onMouseEnter={() => setShowDetails(true)}
      onMouseLeave={() => setShowDetails(false)}
    >
      {/* Connection Status */}
      <div className="flex items-center gap-2">
        {isConnected ? (
          <>
            <div className="relative">
              <Radio className="h-4 w-4 text-red-500 animate-pulse" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-red-500 rounded-full animate-ping" />
            </div>
            <span className="text-sm text-red-500 font-bold uppercase tracking-wide">Live</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-medium">Offline</span>
          </>
        )}
      </div>

      {/* Separator */}
      <div className="w-px h-4 bg-border" />

      {/* Real-time Metrics */}
      <div className="flex items-center gap-2">
        <Zap 
          className={`h-4 w-4 ${logsPerSecond > 0 ? "text-yellow-500" : "text-muted-foreground"} ${pulse ? "scale-125" : ""} transition-all duration-200`}
        />
        <span className="text-sm font-mono">
          <span className={logsPerSecond > 0 ? "text-yellow-500" : "text-muted-foreground"}>
            {logsPerSecond.toFixed(1)}
          </span>
          <span className="text-muted-foreground">/s</span>
        </span>
      </div>

      {/* Errors indicator */}
      {errorsPerSecond > 0 && (
        <>
          <div className="w-px h-4 bg-border" />
          <span className="text-sm font-mono text-red-400">
            ⚠️ {errorsPerSecond.toFixed(1)} err/s
          </span>
        </>
      )}

      {/* Hover Details Panel */}
      {showDetails && isConnected && (
        <div className="absolute top-full left-0 mt-2 p-3 bg-card border border-border rounded-lg shadow-xl z-50 min-w-[200px]">
          <div className="text-xs font-medium text-muted-foreground mb-2">Real-Time Stats</div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Logs/second:</span>
              <span className="font-mono text-yellow-500">{logsPerSecond.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Logs/minute:</span>
              <span className="font-mono">{logsPerMinute.toFixed(0)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Errors/second:</span>
              <span className={`font-mono ${errorsPerSecond > 0 ? "text-red-400" : "text-green-400"}`}>
                {errorsPerSecond.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Active viewers:</span>
              <span className="font-mono text-blue-400">{activeConnections}</span>
            </div>
            {lastUpdate && (
              <div className="flex justify-between text-sm pt-1 border-t border-border">
                <span className="text-muted-foreground">Last update:</span>
                <span className="font-mono text-xs">{formatRelativeTime(lastUpdate)}</span>
              </div>
            )}
          </div>
        </div>
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
