"use client";

import { TimelineDataPoint } from "@/lib/api";
import {
    Area,
    AreaChart,
    CartesianGrid,
    Legend,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

interface LogsChartProps {
  data: TimelineDataPoint[];
  loading?: boolean;
}

/**
 * Area chart showing logs over time by level
 */
export default function LogsChart({ data, loading }: LogsChartProps) {
  if (loading) {
    return (
      <div className="bg-card rounded-lg p-6 border border-border">
        <div className="h-4 bg-border rounded w-1/4 mb-4"></div>
        <div className="h-64 bg-border/50 rounded animate-pulse"></div>
      </div>
    );
  }

  // Format data for chart
  const chartData = data.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }),
    ERROR: point.ERROR + point.FATAL,
    WARN: point.WARN,
    INFO: point.INFO,
    DEBUG: point.DEBUG,
  }));

  return (
    <div className="bg-card rounded-lg p-6 border border-border">
      <h3 className="text-lg font-semibold mb-4">Logs Over Time</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="time"
              stroke="#71717a"
              fontSize={12}
              tickLine={false}
            />
            <YAxis stroke="#71717a" fontSize={12} tickLine={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111118",
                border: "1px solid #27272a",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#fafafa" }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="ERROR"
              stackId="1"
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.6}
              name="Errors"
            />
            <Area
              type="monotone"
              dataKey="WARN"
              stackId="1"
              stroke="#f59e0b"
              fill="#f59e0b"
              fillOpacity={0.6}
              name="Warnings"
            />
            <Area
              type="monotone"
              dataKey="INFO"
              stackId="1"
              stroke="#3b82f6"
              fill="#3b82f6"
              fillOpacity={0.6}
              name="Info"
            />
            <Area
              type="monotone"
              dataKey="DEBUG"
              stackId="1"
              stroke="#6b7280"
              fill="#6b7280"
              fillOpacity={0.6}
              name="Debug"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
