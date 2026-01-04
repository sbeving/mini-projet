"use client";

import Gauge from "@/components/Gauge";
import LiveIndicator from "@/components/LiveIndicator";
import LogsChart from "@/components/LogsChart";
import LogTable from "@/components/LogTable";
import ServicesChart from "@/components/ServicesChart";
import StatsCards from "@/components/StatsCards";
import { useToast } from "@/components/Toast";
import {
    DashboardStats,
    fetchDashboardStats,
    fetchLogs,
    fetchServices,
    fetchTimeline,
    Log,
    TimelineDataPoint,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Activity, Loader2, RefreshCw, Search, X, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type TimeRange = "15m" | "1h" | "6h" | "24h" | "7d";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/**
 * Dashboard page - Log analytics and monitoring with real-time updates
 */
export default function DashboardPage() {
  const router = useRouter();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { addToast } = useToast();
  
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [timeline, setTimeline] = useState<TimelineDataPoint[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [services, setServices] = useState<string[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [serviceFilter, setServiceFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Live streaming state
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [logsPerMinute, setLogsPerMinute] = useState(0);
  const [newLogCount, setNewLogCount] = useState(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const logCountRef = useRef(0);
  const lastMinuteRef = useRef(Date.now());

  // Live stats from SSE (simpler structure than DashboardStats)
  interface LiveStats {
    totalLogs: number;
    errorCount: number;
    errorRate: number;
    lastMinuteLogs: number;
    services: { service: string; count: number }[];
  }
  const [liveStats, setLiveStats] = useState<LiveStats | null>(null);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Calculate start time based on time range
  const getStartTime = useCallback(() => {
    const ranges: Record<TimeRange, number> = {
      "15m": 15,
      "1h": 60,
      "6h": 360,
      "24h": 1440,
      "7d": 10080,
    };
    return new Date(Date.now() - ranges[timeRange] * 60 * 1000).toISOString();
  }, [timeRange]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [statsData, timelineData, servicesData] = await Promise.all([
        fetchDashboardStats(timeRange),
        fetchTimeline(timeRange),
        fetchServices(),
      ]);

      setStats(statsData);
      setTimeline(timelineData);
      setServices(servicesData);
      setLastUpdate(new Date());
    } catch (err) {
      console.error("Failed to fetch dashboard data:", err);
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  // Fetch logs with filters
  const fetchLogsData = useCallback(async () => {
    try {
      const logsData = await fetchLogs({
        level: levelFilter || undefined,
        service: serviceFilter || undefined,
        search: searchQuery || undefined,
        startTime: getStartTime(),
        limit: pageSize,
        offset: page * pageSize,
      });

      setLogs(logsData.logs);
      setTotalLogs(logsData.total);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    }
  }, [levelFilter, serviceFilter, searchQuery, getStartTime, page]);

  // Real-time metrics state
  const [realtimeMetrics, setRealtimeMetrics] = useState({
    logsPerSecond: 0,
    errorsPerSecond: 0,
    activeConnections: 0
  });

  // Connect to SSE stream
  const connectToStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(`${API_URL}/api/stream/stats`);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      setIsLive(true);
      addToast({
        type: "success",
        title: "🔴 Live Updates Connected",
        message: "Dashboard now shows real-time data",
        duration: 3000,
      });
    };

    eventSource.addEventListener("connected", (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[SSE] Connected:", data);
      } catch (err) {
        console.error("[SSE] Error parsing connected event:", err);
      }
    });

    eventSource.addEventListener("stats", (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastUpdate(new Date(data.timestamp));
        
        // Update real-time metrics
        if (data.realtime) {
          setRealtimeMetrics(data.realtime);
          setLogsPerMinute(Math.round(data.realtime.logsPerSecond * 60));
        }
        
        // Update live stats (separate from dashboard stats, simpler structure)
        if (data.totalLogs !== undefined) {
          setLiveStats({
            totalLogs: data.totalLogs,
            errorCount: data.errorCount,
            errorRate: data.errorRate,
            lastMinuteLogs: data.lastMinuteLogs,
            services: data.services || []
          });
        }

        // Update logs per minute calculation
        logCountRef.current++;
        const now = Date.now();
        if (now - lastMinuteRef.current >= 60000) {
          logCountRef.current = 0;
          lastMinuteRef.current = now;
        }

        // Show toast for new errors
        if (data.recentLogs && data.recentLogs.length > 0) {
          const latestLog = data.recentLogs[0];
          if (latestLog.level === "ERROR" || latestLog.level === "FATAL") {
            setNewLogCount((prev) => prev + 1);
            addToast({
              type: "error",
              title: `⚠️ ${latestLog.level} in ${latestLog.service}`,
              message: latestLog.message.substring(0, 100),
              duration: 5000,
            });
          }
        }
      } catch (err) {
        console.error("[SSE] Error parsing stats:", err);
      }
    });

    eventSource.addEventListener("log", (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("[SSE] New log received:", data.log?.message?.substring(0, 50));
        
        // Update real-time metrics
        if (data.metrics) {
          setRealtimeMetrics(data.metrics);
        }
        
        // Show toast for new log
        if (data.log) {
          setNewLogCount(prev => prev + 1);
          if (data.log.level === "ERROR" || data.log.level === "FATAL") {
            addToast({
              type: "error",
              title: `🔥 ${data.log.level} - ${data.log.service}`,
              message: data.log.message.substring(0, 100),
              duration: 4000,
            });
          }
        }
      } catch (err) {
        console.error("[SSE] Error parsing log:", err);
      }
    });

    eventSource.addEventListener("batch", (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`[SSE] Batch received: ${data.count} logs`);
        
        if (data.metrics) {
          setRealtimeMetrics(data.metrics);
        }
        
        setNewLogCount(prev => prev + data.count);
        addToast({
          type: "info",
          title: `📊 ${data.count} new logs`,
          message: "Batch of logs ingested",
          duration: 2000,
        });
      } catch (err) {
        console.error("[SSE] Error parsing batch:", err);
      }
    });

    eventSource.addEventListener("heartbeat", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.logsPerSecond !== undefined) {
          setRealtimeMetrics(prev => ({
            ...prev,
            logsPerSecond: data.logsPerSecond,
            activeConnections: data.activeConnections || prev.activeConnections
          }));
        }
      } catch (err) {
        // Heartbeat parse errors are fine to ignore
      }
    });

    eventSource.onerror = (err) => {
      console.error("[SSE] Connection error:", err);
      setIsLive(false);
      eventSource.close();
      addToast({
        type: "warning",
        title: "Connection Lost",
        message: "Real-time updates disconnected. Click 'Go Live' to reconnect.",
        duration: 5000,
      });
    };

    return () => {
      eventSource.close();
    };
  }, [addToast]);

  // Disconnect from stream
  const disconnectFromStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setIsLive(false);
      addToast({
        type: "info",
        title: "Live Updates Paused",
        message: "Click 'Go Live' to resume",
        duration: 3000,
      });
    }
  }, [addToast]);

  // Initial data fetch - only when authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchData();
    }
  }, [fetchData, authLoading, isAuthenticated]);

  // Fetch logs when filters change - only when authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      fetchLogsData();
    }
  }, [fetchLogsData, authLoading, isAuthenticated]);

  // Auto-refresh every 30 seconds when not live and authenticated
  useEffect(() => {
    if (isLive || authLoading || !isAuthenticated) return;
    
    const interval = setInterval(() => {
      fetchData();
      fetchLogsData();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchData, fetchLogsData, isLive, authLoading, isAuthenticated]);

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleRefresh = () => {
    fetchData();
    fetchLogsData();
    setNewLogCount(0);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setPage(0);
  };

  // Calculate health score (inverse of error rate)
  const healthScore = stats ? Math.max(0, 100 - stats.errorRate * 10) : 100;

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            Dashboard
            {newLogCount > 0 && (
              <span className="text-sm font-medium px-2 py-1 bg-red-500/20 text-red-400 rounded-full animate-pulse">
                {newLogCount} new
              </span>
            )}
          </h1>
          <p className="text-muted-foreground">
            Monitor your application logs and metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Live Indicator */}
          <LiveIndicator
            isConnected={isLive}
            lastUpdate={lastUpdate}
            logsPerMinute={logsPerMinute}
            logsPerSecond={realtimeMetrics.logsPerSecond}
            errorsPerSecond={realtimeMetrics.errorsPerSecond}
            activeConnections={realtimeMetrics.activeConnections}
          />

          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="15m">Last 15 minutes</option>
            <option value="1h">Last hour</option>
            <option value="6h">Last 6 hours</option>
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
          </select>

          {/* Live Toggle */}
          <button
            onClick={isLive ? disconnectFromStream : connectToStream}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
              isLive
                ? "bg-green-500/20 text-green-400 border border-green-500/50 hover:bg-green-500/30"
                : "bg-card border border-border hover:bg-card hover:border-primary/50"
            }`}
          >
            <Zap className={`h-4 w-4 ${isLive ? "animate-pulse" : ""}`} />
            {isLive ? "Live" : "Go Live"}
          </button>

          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-4 text-destructive animate-shake">
          {error}
        </div>
      )}

      {/* Stats Cards with Gauges */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <StatsCards stats={stats} loading={loading} />
        </div>
        
        {/* Health Gauge */}
        <div className="bg-card rounded-lg p-6 border border-border flex flex-col items-center justify-center card-glow">
          <h3 className="text-sm text-muted-foreground mb-4">System Health</h3>
          <Gauge
            value={healthScore}
            label="Health Score"
            colorStart="#22c55e"
            colorEnd="#ef4444"
            size={160}
          />
          <p className="text-sm text-muted-foreground mt-2">
            {healthScore >= 90 ? "Excellent" : 
             healthScore >= 70 ? "Good" :
             healthScore >= 50 ? "Fair" : "Critical"}
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LogsChart data={timeline} loading={loading} />
        <ServicesChart
          data={stats?.topErrorServices || []}
          loading={loading}
        />
      </div>

      {/* Logs Table */}
      <div className="bg-card rounded-lg border border-border">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Recent Logs
            </h3>
            
            <div className="flex items-center gap-3 flex-1 max-w-2xl">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-10 py-1.5 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {searchQuery && (
                  <button
                    onClick={() => handleSearchChange("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Level Filter */}
              <select
                value={levelFilter}
                onChange={(e) => {
                  setLevelFilter(e.target.value);
                  setPage(0);
                }}
                className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Levels</option>
                <option value="DEBUG">Debug</option>
                <option value="INFO">Info</option>
                <option value="WARN">Warning</option>
                <option value="ERROR">Error</option>
                <option value="FATAL">Fatal</option>
              </select>

              {/* Service Filter */}
              <select
                value={serviceFilter}
                onChange={(e) => {
                  setServiceFilter(e.target.value);
                  setPage(0);
                }}
                className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">All Services</option>
                {services.map((service) => (
                  <option key={service} value={service}>
                    {service}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        <LogTable
          logs={logs}
          loading={loading}
          totalLogs={totalLogs}
          page={page}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          searchQuery={searchQuery}
          highlightNew={isLive}
        />
      </div>
    </div>
  );
}
