"use client";

import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

interface ServicesChartProps {
  data: Array<{ service: string; errorCount: number }>;
  loading?: boolean;
}

/**
 * Bar chart showing top error-prone services
 */
export default function ServicesChart({ data, loading }: ServicesChartProps) {
  if (loading) {
    return (
      <div className="bg-card rounded-lg p-6 border border-border">
        <div className="h-4 bg-border rounded w-1/3 mb-4"></div>
        <div className="h-64 bg-border/50 rounded animate-pulse"></div>
      </div>
    );
  }

  // Color scale for bars
  const colors = ["#ef4444", "#f97316", "#f59e0b", "#eab308", "#84cc16"];

  return (
    <div className="bg-card rounded-lg p-6 border border-border">
      <h3 className="text-lg font-semibold mb-4">Top Error-Prone Services</h3>
      {data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          No error data available
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis type="number" stroke="#71717a" fontSize={12} />
              <YAxis
                type="category"
                dataKey="service"
                stroke="#71717a"
                fontSize={12}
                width={100}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#111118",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                }}
                labelStyle={{ color: "#fafafa" }}
                formatter={(value: number) => [`${value} errors`, "Errors"]}
              />
              <Bar dataKey="errorCount" name="Errors" radius={[0, 4, 4, 0]}>
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colors[index % colors.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
