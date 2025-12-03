/**
 * Server-Sent Events (SSE) Stream Route
 * Real-time log streaming for live dashboard updates
 */

import { Response, Router } from 'express';
import { prisma } from '../index.js';

const router = Router();

// Store active SSE connections
const clients: Set<Response> = new Set();

/**
 * SSE endpoint for real-time log streaming
 * GET /api/stream/logs
 */
router.get('/logs', async (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Add client to set
  clients.add(res);
  console.log(`SSE client connected. Total clients: ${clients.size}`);

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to log stream', timestamp: new Date().toISOString() })}\n\n`);

  // Send heartbeat every 30 seconds to keep connection alive
  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);

  // Handle client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
    console.log(`SSE client disconnected. Total clients: ${clients.size}`);
  });
});

/**
 * Broadcast a log to all connected SSE clients
 */
export function broadcastLog(log: any) {
  const data = JSON.stringify(log);
  clients.forEach((client) => {
    try {
      client.write(`event: log\ndata: ${data}\n\n`);
    } catch (err) {
      console.error('Error broadcasting to client:', err);
      clients.delete(client);
    }
  });
}

/**
 * Broadcast stats update to all connected SSE clients
 */
export function broadcastStats(stats: any) {
  const data = JSON.stringify(stats);
  clients.forEach((client) => {
    try {
      client.write(`event: stats\ndata: ${data}\n\n`);
    } catch (err) {
      console.error('Error broadcasting stats to client:', err);
      clients.delete(client);
    }
  });
}

/**
 * SSE endpoint for real-time stats
 * Sends aggregated stats every 5 seconds
 * GET /api/stream/stats
 */
router.get('/stats', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const sendStats = async () => {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      
      // Get recent stats
      const [totalLogs, errorCount, recentLogs] = await Promise.all([
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
          where: { timestamp: { gte: oneHourAgo } },
          orderBy: { timestamp: 'desc' },
          take: 5,
          select: {
            id: true,
            timestamp: true,
            level: true,
            service: true,
            message: true,
          }
        })
      ]);

      const errorRate = totalLogs > 0 ? ((errorCount / totalLogs) * 100).toFixed(1) : '0';

      res.write(`event: stats\ndata: ${JSON.stringify({
        totalLogs,
        errorCount,
        errorRate,
        recentLogs,
        timestamp: now.toISOString()
      })}\n\n`);
    } catch (err) {
      console.error('Error sending stats:', err);
    }
  };

  // Send initial stats
  await sendStats();

  // Send stats every 5 seconds
  const statsInterval = setInterval(sendStats, 5000);

  // Heartbeat every 30 seconds
  const heartbeat = setInterval(() => {
    res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(statsInterval);
    clearInterval(heartbeat);
  });
});

export default router;
