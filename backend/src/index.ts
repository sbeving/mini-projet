/**
 * LogChat Backend - Main Entry Point
 * Express server with API routes for log ingestion, analytics, and chat
 */

import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';

// Import routes
import adminAnalyticsRouter from './routes/admin-analytics.js';
import analyticsRouter from './routes/analytics.js';
import authRouter from './routes/auth.js';
import chatRouter from './routes/chat.js';
import chatSessionsRouter from './routes/chat-sessions.js';
import logsRouter from './routes/logs.js';
import streamRouter from './routes/stream.js';
import logSourcesRouter from './routes/log-sources.js';
import integrationsRouter from './routes/integrations.js';
import auditLogsRouter from './routes/audit-logs.js';
import aiRouter from './routes/ai.js';

// Import services
import { cleanupExpiredSessions, seedDefaultUsers } from './services/auth.js';
import { updateDailyStats } from './services/activity.js';

// Import Prisma from lib (centralized to avoid circular deps)
import { prisma } from './lib/prisma.js';
export { prisma };

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));

// Request logging middleware
app.use((req: Request, _res: Response, next: NextFunction) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', async (_req: Request, res: Response) => {
  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        api: 'running'
      }
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unhealthy', 
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/logs', logsRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/chat-sessions', chatSessionsRouter);
app.use('/api/stream', streamRouter);
app.use('/api/admin/analytics', adminAnalyticsRouter);
app.use('/api/log-sources', logSourcesRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/audit-logs', auditLogsRouter);
app.use('/api/ai', aiRouter);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, async () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║           LogChat Backend API Server                  ║
╠═══════════════════════════════════════════════════════╣
║  🚀 Server running on http://localhost:${PORT}          ║
║  🔐 Auth:         /api/auth                           ║
║  📊 Logs API:     /api/logs                           ║
║  📈 Analytics:    /api/analytics                      ║
║  💬 Chat:         /api/chat                           ║
║  💬 Sessions:     /api/chat-sessions                  ║
║  🤖 AI Providers: /api/ai                             ║
║  📁 Log Sources:  /api/log-sources (admin)            ║
║  🔗 Integrations: /api/integrations (admin)           ║
║  📋 Audit Logs:   /api/audit-logs (admin)             ║
║  📊 Admin:        /api/admin/analytics                ║
║  ❤️  Health:       /health                             ║
╚═══════════════════════════════════════════════════════╝
  `);

  // Seed default users in development
  if (process.env.NODE_ENV === 'development') {
    await seedDefaultUsers();
  }

  // Cleanup expired sessions every hour
  setInterval(async () => {
    const cleaned = await cleanupExpiredSessions();
    if (cleaned > 0) {
      console.log(`Cleaned up ${cleaned} expired sessions`);
    }
  }, 60 * 60 * 1000);

  // Update daily usage stats every hour
  setInterval(async () => {
    try {
      await updateDailyStats();
      console.log('Updated daily usage stats');
    } catch (error) {
      console.error('Failed to update daily stats:', error);
    }
  }, 60 * 60 * 1000);

  // Run initial stats update
  updateDailyStats().catch(console.error);
});

export default app;
