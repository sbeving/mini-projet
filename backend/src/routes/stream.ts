/**
 * Server-Sent Events (SSE) Stream Route
 * Real-time log streaming for live dashboard updates
 */

import { Response, Router } from 'express';
import { prisma } from '../index.js';

const router = Router();

// Store active SSE connections for different streams
interface SSEClient {
  res: Response;
  type: 'logs' | 'stats' | 'all';
  connectedAt: Date;
}

const clients: Map<string, SSEClient> = new Map();
let clientIdCounter = 0;

// Standalone buffer for tracking logs per second
const logBuffer: { timestamp: number; isError: boolean }[] = [];

// Metrics for real-time tracking
const realtimeMetrics = {
  logsPerSecond: 0,
  errorsPerSecond: 0,
  lastLogTimestamp: new Date(),
};

// Calculate logs per second every second
setInterval(() => {
  const oneSecondAgo = Date.now() - 1000;
  const recentLogs = logBuffer.filter(l => l.timestamp > oneSecondAgo);
  realtimeMetrics.logsPerSecond = recentLogs.length;
  realtimeMetrics.errorsPerSecond = recentLogs.filter(l => l.isError).length;
  
  // Keep only last 10 seconds of data to prevent memory issues
  const tenSecondsAgo = Date.now() - 10000;
  while (logBuffer.length > 0 && logBuffer[0].timestamp < tenSecondsAgo) {
    logBuffer.shift();
  }
}, 1000);

/**
 * Get current connection count (for health checks)
 */
export function getConnectionCount(): number {
  return clients.size;
}

/**
 * Get current real-time metrics
 */
export function getRealtimeMetrics() {
  return {
    ...realtimeMetrics,
    activeConnections: clients.size
  };
}

/**
 * Broadcast a new log to all connected SSE clients
 * Called from log ingestion routes when new logs are created
 */
export function broadcastLog(log: any) {
  // Track in buffer for metrics
  const isError = log.level === 'ERROR' || log.level === 'FATAL';
  logBuffer.push({ timestamp: Date.now(), isError });
  realtimeMetrics.lastLogTimestamp = new Date();
  
  const data = JSON.stringify({
    type: 'new_log',
    log,
    metrics: {
      logsPerSecond: realtimeMetrics.logsPerSecond,
      errorsPerSecond: realtimeMetrics.errorsPerSecond,
      activeConnections: clients.size
    },
    timestamp: new Date().toISOString()
  });
  
  let broadcasted = 0;
  clients.forEach((client, clientId) => {
    try {
      client.res.write(`event: log\ndata: ${data}\n\n`);
      broadcasted++;
    } catch (err) {
      console.error(`[SSE] Error broadcasting to client ${clientId}:`, err);
      clients.delete(clientId);
    }
  });
  
  if (broadcasted > 0) {
    console.log(`[SSE] Broadcasted log to ${broadcasted} clients`);
  }
}

/**
 * Broadcast multiple logs at once (for batch ingestion)
 */
export function broadcastLogs(logs: any[]) {
  logs.forEach(log => {
    const isError = log.level === 'ERROR' || log.level === 'FATAL';
    logBuffer.push({ timestamp: Date.now(), isError });
  });
  realtimeMetrics.lastLogTimestamp = new Date();
  
  const data = JSON.stringify({
    type: 'batch_logs',
    count: logs.length,
    logs: logs.slice(0, 10), // Send first 10 only
    metrics: {
      logsPerSecond: realtimeMetrics.logsPerSecond,
      errorsPerSecond: realtimeMetrics.errorsPerSecond,
      activeConnections: clients.size
    },
    timestamp: new Date().toISOString()
  });
  
  clients.forEach((client, clientId) => {
    try {
      client.res.write(`event: batch\ndata: ${data}\n\n`);
    } catch (err) {
      console.error(`[SSE] Error broadcasting batch to client ${clientId}:`, err);
      clients.delete(clientId);
    }
  });
  
  console.log(`[SSE] Broadcasted ${logs.length} logs to ${clients.size} clients`);
}

/**
 * Broadcast stats update to all connected SSE clients
 */
export function broadcastStats(stats: any) {
  const data = JSON.stringify({
    ...stats,
    realtime: {
      logsPerSecond: realtimeMetrics.logsPerSecond,
      errorsPerSecond: realtimeMetrics.errorsPerSecond,
      activeConnections: clients.size
    }
  });
  
  clients.forEach((client, clientId) => {
    if (client.type === 'stats') {
      try {
        client.res.write(`event: stats\ndata: ${data}\n\n`);
      } catch (err) {
        console.error(`[SSE] Error broadcasting stats to client ${clientId}:`, err);
        clients.delete(clientId);
      }
    }
  });
}

/**
 * SSE endpoint for real-time log streaming
 * GET /api/stream/logs
 */
router.get('/logs', async (req, res) => {
  const clientId = `logs-${++clientIdCounter}`;
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  // Add client to map
  clients.set(clientId, { res, type: 'logs', connectedAt: new Date() });
  console.log(`[SSE] Client ${clientId} connected to logs stream. Total: ${clients.size}`);

  // Send initial connection event with current metrics
  res.write(`event: connected\ndata: ${JSON.stringify({ 
    clientId,
    message: 'Connected to real-time log stream', 
    timestamp: new Date().toISOString(),
    activeConnections: clients.size
  })}\n\n`);

  // Send heartbeat every 15 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ 
        timestamp: new Date().toISOString(),
        logsPerSecond: realtimeMetrics.logsPerSecond,
        activeConnections: clients.size
      })}\n\n`);
    } catch (err) {
      clearInterval(heartbeat);
      clients.delete(clientId);
    }
  }, 15000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(clientId);
    console.log(`[SSE] Client ${clientId} disconnected. Total: ${clients.size}`);
  });
});

/**
 * SSE endpoint for real-time stats dashboard
 * Sends aggregated stats every 2 seconds for responsive updates
 * GET /api/stream/stats
 */
router.get('/stats', async (req, res) => {
  const clientId = `stats-${++clientIdCounter}`;
  
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Add client to map
  clients.set(clientId, { res, type: 'stats', connectedAt: new Date() });
  console.log(`[SSE] Client ${clientId} connected to stats stream. Total: ${clients.size}`);

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ 
    clientId,
    message: 'Connected to real-time stats stream',
    timestamp: new Date().toISOString()
  })}\n\n`);

  const sendStats = async () => {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      // Get comprehensive stats
      const [totalLogs, errorCount, recentLogs, servicesBreakdown, lastMinuteLogs] = await Promise.all([
        prisma.log.count({
          where: { timestamp: { gte: oneHourAgo } }
        }),
        prisma.log.count({
          where: { 
            timestamp: { gte: oneHourAgo },
            level: { in: ['ERROR', 'FATAL'] }
          }
        }),
        prisma.log.findMany({
          where: { timestamp: { gte: fiveMinutesAgo } },
          orderBy: { timestamp: 'desc' },
          take: 10,
          select: {
            id: true,
            timestamp: true,
            level: true,
            service: true,
            message: true,
          }
        }),
        prisma.log.groupBy({
          by: ['service'],
          where: { timestamp: { gte: oneHourAgo } },
          _count: { id: true }
        }),
        prisma.log.count({
          where: { timestamp: { gte: new Date(now.getTime() - 60 * 1000) } }
        })
      ]);

      const errorRate = totalLogs > 0 ? ((errorCount / totalLogs) * 100).toFixed(1) : '0';

      const statsData = {
        // Database stats
        totalLogs,
        errorCount,
        errorRate: parseFloat(errorRate),
        recentLogs,
        services: servicesBreakdown.map(s => ({ service: s.service, count: s._count.id })),
        lastMinuteLogs,
        
        // Real-time metrics
        realtime: {
          logsPerSecond: realtimeMetrics.logsPerSecond,
          errorsPerSecond: realtimeMetrics.errorsPerSecond,
          activeConnections: clients.size
        },
        
        // Timestamp
        timestamp: now.toISOString()
      };

      res.write(`event: stats\ndata: ${JSON.stringify(statsData)}\n\n`);
    } catch (err) {
      console.error('[SSE] Error sending stats:', err);
    }
  };

  // Send initial stats immediately
  await sendStats();

  // Send stats every 2 seconds for real-time feel
  const statsInterval = setInterval(sendStats, 2000);

  // Heartbeat every 20 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ 
        timestamp: new Date().toISOString(),
        logsPerSecond: realtimeMetrics.logsPerSecond,
        activeConnections: clients.size
      })}\n\n`);
    } catch (err) {
      clearInterval(heartbeat);
      clearInterval(statsInterval);
      clients.delete(clientId);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(statsInterval);
    clearInterval(heartbeat);
    clients.delete(clientId);
    console.log(`[SSE] Client ${clientId} disconnected. Total: ${clients.size}`);
  });
});

export default router;
