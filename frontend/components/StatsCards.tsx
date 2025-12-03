"use client";

import { DashboardStats } from "@/lib/api";
import { AlertTriangle, FileText, Server, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

interface StatsCardsProps {
  stats: DashboardStats | null;
  loading?: boolean;
}

/**
 * Animated number counter
 */
function AnimatedNumber({ value, duration = 1000 }: { value: number; duration?: number }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const start = current;
    const end = value;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setCurrent(Math.floor(start + (end - start) * easeOut));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span className="animate-count-up">{current.toLocaleString()}</span>;
}

/**
 * Dashboard statistics cards with animations
 */
export default function StatsCards({ stats, loading }: StatsCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-card rounded-lg p-6 border border-border"
          >
            <div className="h-4 bg-border rounded w-1/2 mb-4 animate-shimmer"></div>
            <div className="h-8 bg-border rounded w-3/4 animate-shimmer"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      title: "Total Logs",
      value: stats.totalLogs,
      subtitle: "In selected period",
      icon: FileText,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderHover: "hover:border-blue-500/50",
      glow: "hover:shadow-blue-500/10",
    },
    {
      title: "Total Errors",
      value: stats.totalErrors,
      subtitle: `${stats.errorRate}% error rate`,
      icon: AlertTriangle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      borderHover: "hover:border-red-500/50",
      glow: "hover:shadow-red-500/10",
      trend: stats.errorRate > 5 ? "up" : "down",
      trendColor: stats.errorRate > 5 ? "text-red-500" : "text-green-500",
    },
    {
      title: "Warning Count",
      value: stats.levelCounts.WARN,
      subtitle: "Warnings logged",
      icon: TrendingUp,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderHover: "hover:border-amber-500/50",
      glow: "hover:shadow-amber-500/10",
    },
    {
      title: "Services",
      value: stats.topErrorServices.length,
      subtitle: "With errors",
      icon: Server,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      borderHover: "hover:border-purple-500/50",
      glow: "hover:shadow-purple-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.title}
            className={`bg-card rounded-lg p-6 border border-border ${card.borderHover} transition-all duration-300 hover-lift hover:shadow-xl ${card.glow}`}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-muted-foreground text-sm">{card.title}</span>
              <div className={`p-2 rounded-lg ${card.bgColor}`}>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <div>
                <div className="text-3xl font-bold mb-1">
                  <AnimatedNumber value={card.value} />
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  {card.trend && (
                    card.trend === "up" ? (
                      <TrendingUp className={`h-3 w-3 ${card.trendColor}`} />
                    ) : (
                      <TrendingDown className={`h-3 w-3 ${card.trendColor}`} />
                    )
                  )}
                  {card.subtitle}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
