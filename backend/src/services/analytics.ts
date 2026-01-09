/**
 * Analytics Service
 * Computes statistics and aggregations on log data
 */

import { prisma } from '../lib/prisma.js';

// Time range presets in minutes
export const TIME_RANGES = {
  '15m': 15,
  '1h': 60,
  '6h': 360,
  '24h': 1440,
  '7d': 10080,
} as const;

export type TimeRangeKey = keyof typeof TIME_RANGES;

/**
 * Get log counts grouped by level for a time range
 */
export async function getLogCountsByLevel(minutesAgo: number = 60) {
  const startTime = new Date(Date.now() - minutesAgo * 60 * 1000);
  
  const counts = await prisma.log.groupBy({
    by: ['level'],
    where: {
      timestamp: { gte: startTime },
    },
    _count: { _all: true },
  });
  
  // Convert to a more usable format
  const result: Record<string, number> = {
    DEBUG: 0,
    INFO: 0,
    WARN: 0,
    ERROR: 0,
    FATAL: 0,
  };
  
  for (const item of counts) {
    result[item.level] = item._count._all;
  }
  
  return result;
}

/**
 * Get total log count for a time range
 */
export async function getTotalLogCount(minutesAgo: number = 1440) {
  const startTime = new Date(Date.now() - minutesAgo * 60 * 1000);
  
  return prisma.log.count({
    where: { timestamp: { gte: startTime } },
  });
}

/**
 * Get top N services by error count
 */
export async function getTopErrorServices(limit: number = 10, minutesAgo: number = 1440) {
  const startTime = new Date(Date.now() - minutesAgo * 60 * 1000);
  
  const services = await prisma.log.groupBy({
    by: ['service'],
    where: {
      level: { in: ['ERROR', 'FATAL'] },
      timestamp: { gte: startTime },
    },
    _count: { _all: true },
    orderBy: { _count: { service: 'desc' } },
    take: limit,
  });
  
  return services.map(s => ({
    service: s.service,
    errorCount: s._count._all,
  }));
}

/**
 * Get logs grouped by time bucket (for charts)
 * Returns counts per level for each time bucket
 */
export async function getLogsOverTime(
  minutesAgo: number = 60,
  bucketMinutes: number = 5
) {
  const startTime = new Date(Date.now() - minutesAgo * 60 * 1000);
  
  // Use raw query for time bucketing (PostgreSQL date_trunc)
  const buckets = await prisma.$queryRaw<Array<{
    bucket: Date;
    level: string;
    count: bigint;
  }>>`
    SELECT 
      date_trunc('hour', timestamp) + 
        (floor(extract(minute from timestamp) / ${bucketMinutes}) * ${bucketMinutes} || ' minutes')::interval 
        AS bucket,
      level,
      COUNT(*) as count
    FROM logs
    WHERE timestamp >= ${startTime}
    GROUP BY bucket, level
    ORDER BY bucket ASC
  `;
  
  // Transform into a format suitable for charts
  const bucketMap = new Map<string, Record<string, number>>();
  
  for (const row of buckets) {
    const key = row.bucket.toISOString();
    if (!bucketMap.has(key)) {
      bucketMap.set(key, { timestamp: row.bucket.getTime(), DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0, FATAL: 0 } as any);
    }
    const bucket = bucketMap.get(key)!;
    bucket[row.level] = Number(row.count);
  }
  
  return Array.from(bucketMap.values()).sort((a: any, b: any) => a.timestamp - b.timestamp);
}

/**
 * Get comprehensive stats for dashboard
 */
export async function getDashboardStats(minutesAgo: number = 1440) {
  const startTime = new Date(Date.now() - minutesAgo * 60 * 1000);
  
  const [totalLogs, levelCounts, topErrorServices, recentCritical] = await Promise.all([
    // Total logs
    prisma.log.count({
      where: { timestamp: { gte: startTime } },
    }),
    
    // Counts by level
    getLogCountsByLevel(minutesAgo),
    
    // Top error services
    getTopErrorServices(5, minutesAgo),
    
    // Recent critical/fatal events
    prisma.log.findMany({
      where: {
        level: 'FATAL',
        timestamp: { gte: startTime },
      },
      orderBy: { timestamp: 'desc' },
      take: 5,
    }),
  ]);
  
  const totalErrors = levelCounts.ERROR + levelCounts.FATAL;
  const errorRate = totalLogs > 0 ? (totalErrors / totalLogs) * 100 : 0;
  
  return {
    totalLogs,
    totalErrors,
    errorRate: Math.round(errorRate * 100) / 100,
    levelCounts,
    topErrorServices,
    recentCritical,
    timeRange: {
      start: startTime.toISOString(),
      end: new Date().toISOString(),
      minutesAgo,
    },
  };
}

/**
 * Get stats formatted for LLM context
 */
export async function getStatsForLLM(minutesAgo: number = 60): Promise<string> {
  const stats = await getDashboardStats(minutesAgo);
  
  let text = `Log Statistics (last ${minutesAgo} minutes):\n`;
  text += `- Total logs: ${stats.totalLogs}\n`;
  text += `- Total errors: ${stats.totalErrors} (${stats.errorRate}% error rate)\n`;
  text += `- By level: DEBUG=${stats.levelCounts.DEBUG}, INFO=${stats.levelCounts.INFO}, WARN=${stats.levelCounts.WARN}, ERROR=${stats.levelCounts.ERROR}, FATAL=${stats.levelCounts.FATAL}\n`;
  
  if (stats.topErrorServices.length > 0) {
    text += `\nTop error-prone services:\n`;
    for (const svc of stats.topErrorServices) {
      text += `  - ${svc.service}: ${svc.errorCount} errors\n`;
    }
  }
  
  if (stats.recentCritical.length > 0) {
    text += `\nRecent critical events:\n`;
    for (const log of stats.recentCritical) {
      text += `  - [${log.timestamp.toISOString()}] ${log.service}: ${log.message}\n`;
    }
  }
  
  return text;
}
