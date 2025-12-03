"use client";

import { useEffect, useState } from "react";

interface GaugeProps {
  value: number; // 0-100
  label: string;
  colorStart?: string;
  colorEnd?: string;
  size?: number;
  showValue?: boolean;
  animated?: boolean;
}

/**
 * Animated gauge/speedometer component
 */
export default function Gauge({
  value,
  label,
  colorStart = "#22c55e",
  colorEnd = "#ef4444",
  size = 140,
  showValue = true,
  animated = true,
}: GaugeProps) {
  const [currentValue, setCurrentValue] = useState(animated ? 0 : value);
  const circumference = 2 * Math.PI * 45; // radius = 45
  const arcLength = circumference * 0.75; // 270 degrees
  const offset = arcLength - (currentValue / 100) * arcLength;

  // Animate value on change
  useEffect(() => {
    if (!animated) {
      setCurrentValue(value);
      return;
    }

    const start = currentValue;
    const end = value;
    const duration = 1000;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function (ease-out cubic)
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      setCurrentValue(start + (end - start) * easeOut);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, animated]);

  // Calculate color based on value (gradient from green to red)
  const getColor = (val: number) => {
    // Simple interpolation between colors based on value
    if (val <= 33) return colorStart;
    if (val <= 66) return "#f59e0b"; // amber
    return colorEnd;
  };

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size * 0.75}
        viewBox="0 0 120 90"
        className="overflow-visible"
      >
        {/* Background arc */}
        <path
          d="M 15 75 A 45 45 0 1 1 105 75"
          fill="none"
          stroke="currentColor"
          strokeWidth="10"
          strokeLinecap="round"
          className="text-border"
        />
        
        {/* Progress arc */}
        <path
          d="M 15 75 A 45 45 0 1 1 105 75"
          fill="none"
          stroke={getColor(currentValue)}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={arcLength}
          strokeDashoffset={offset}
          className="transition-all duration-300"
          style={{
            filter: `drop-shadow(0 0 6px ${getColor(currentValue)}40)`,
          }}
        />
        
        {/* Center text */}
        {showValue && (
          <text
            x="60"
            y="60"
            textAnchor="middle"
            className="fill-current text-2xl font-bold"
          >
            {Math.round(currentValue)}%
          </text>
        )}
        
        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((tick, i) => {
          const angle = -225 + (tick / 100) * 270;
          const radian = (angle * Math.PI) / 180;
          const outerR = 52;
          const innerR = 48;
          const x1 = 60 + Math.cos(radian) * innerR;
          const y1 = 60 + Math.sin(radian) * innerR;
          const x2 = 60 + Math.cos(radian) * outerR;
          const y2 = 60 + Math.sin(radian) * outerR;
          
          return (
            <line
              key={tick}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="currentColor"
              strokeWidth="2"
              className="text-muted-foreground"
            />
          );
        })}
      </svg>
      <span className="text-sm text-muted-foreground mt-1">{label}</span>
    </div>
  );
}

/**
 * Mini inline gauge for compact displays
 */
export function MiniGauge({ 
  value, 
  size = 40,
  color,
}: { 
  value: number; 
  size?: number;
  color?: string;
}) {
  const circumference = 2 * Math.PI * 15;
  const offset = circumference - (value / 100) * circumference;
  
  return (
    <svg width={size} height={size} viewBox="0 0 40 40">
      <circle
        cx="20"
        cy="20"
        r="15"
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        className="text-border"
      />
      <circle
        cx="20"
        cy="20"
        r="15"
        fill="none"
        stroke={color || (value > 50 ? "#ef4444" : "#22c55e")}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 20 20)"
        className="transition-all duration-500"
      />
      <text
        x="20"
        y="24"
        textAnchor="middle"
        className="fill-current text-xs font-semibold"
      >
        {Math.round(value)}
      </text>
    </svg>
  );
}
