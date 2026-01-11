/**
 * Logs Routes
 * API endpoints for log ingestion and querying
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { createLog, createLogs, getRecentErrors, getServices, LogInput, queryLogs } from '../services/logs.js';
import { broadcastLog, broadcastLogs } from './stream.js';

const router = Router();

// Validation schemas
const singleLogSchema = z.object({
  timestamp: z.string().optional(),
  level: z.string().optional(),
  service: z.string().optional(),
  message: z.string(),
  meta: z.record(z.unknown()).optional(),
});

const batchLogSchema = z.array(singleLogSchema);

const querySchema = z.object({
  level: z.string().optional(),
  service: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional(),
});

/**
 * POST /api/logs
 * Ingest a single log entry
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const input = singleLogSchema.parse(req.body);
    const log = await createLog(input as LogInput);
    
    // Broadcast to connected SSE clients in real-time
    broadcastLog(log);
    
    res.status(201).json({
      success: true,
      log: {
        timestamp: log.timestamp.toISOString(),
        level: log.level,
        service: log.service,
        message: log.message,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid log format',
        details: error.errors,
      });
      return;
    }
    console.error('Log ingestion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ingest log',
    });
  }
});

/**
 * POST /api/logs/batch
 * Ingest multiple log entries at once
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const inputs = batchLogSchema.parse(req.body);
    const count = await createLogs(inputs as LogInput[]);
    
    // Broadcast batch to connected SSE clients in real-time
    // Transform inputs to match expected format
    const logsForBroadcast = inputs.map(input => ({
      timestamp: input.timestamp || new Date().toISOString(),
      level: input.level || 'INFO',
      service: input.service || 'unknown',
      message: input.message
    }));
    broadcastLogs(logsForBroadcast);
    
    res.status(201).json({
      success: true,
      count,
      message: `Ingested ${count} logs`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid batch format',
        details: error.errors,
      });
      return;
    }
    console.error('Batch ingestion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ingest batch',
    });
  }
});

/**
 * GET /api/logs
 * Query logs with optional filters
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const query = querySchema.parse(req.query);
    
    const result = await queryLogs({
      level: query.level,
      service: query.service,
      startTime: query.startTime ? new Date(query.startTime) : undefined,
      endTime: query.endTime ? new Date(query.endTime) : undefined,
      limit: query.limit,
      offset: query.offset,
      search: query.search,
    });
    
    res.json({
      success: true,
      ...result,
      logs: result.logs.map(log => ({
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        level: log.level,
        service: log.service,
        message: log.message,
        meta: log.meta,
      })),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid query parameters',
        details: error.errors,
      });
      return;
    }
    console.error('Log query error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to query logs',
    });
  }
});

/**
 * GET /api/logs/errors
 * Get recent error logs
 */
router.get('/errors', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const minutesAgo = Math.min(parseInt(req.query.minutesAgo as string) || 60, 10080); // Max 7 days
    
    const errors = await getRecentErrors(limit, minutesAgo);
    
    res.json({
      success: true,
      count: errors.length,
      logs: errors.map(log => ({
        id: log.id,
        timestamp: log.timestamp.toISOString(),
        level: log.level,
        service: log.service,
        message: log.message,
        meta: log.meta,
      })),
    });
  } catch (error) {
    console.error('Error fetching errors:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch errors',
    });
  }
});

/**
 * GET /api/logs/services
 * Get list of all services that have logged
 */
router.get('/services', async (_req: Request, res: Response) => {
  try {
    const services = await getServices();
    
    res.json({
      success: true,
      services,
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch services',
    });
  }
});

// Agent ingest schema - accepts logs from remote agents
const agentIngestSchema = z.object({
  agent: z.object({
    hostname: z.string(),
    environment: z.string().optional(),
    version: z.string().optional(),
    tags: z.record(z.string()).optional(),
  }),
  logs: z.array(z.object({
    timestamp: z.string(),
    level: z.string(),
    service: z.string(),
    message: z.string(),
    meta: z.record(z.unknown()).optional(),
  })),
});

/**
 * POST /api/logs/ingest
 * Ingest logs from remote agents with API key authentication
 * This is the main endpoint used by logchat-agent
 */
router.post('/ingest', async (req: Request, res: Response) => {
  try {
    // Verify API key from header
    const apiKey = req.headers['x-api-key'] as string || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      res.status(401).json({
        success: false,
        error: 'API key required',
        message: 'Provide API key via X-API-Key header or Authorization: Bearer <key>',
      });
      return;
    }
    
    // Validate API key against database
    const logSource = await prisma.logSource.findFirst({
      where: {
        apiKey: apiKey,
        isActive: true,
      },
    });
    
    if (!logSource) {
      res.status(403).json({
        success: false,
        error: 'Invalid or inactive API key',
      });
      return;
    }
    
    // Parse and validate request body
    const data = agentIngestSchema.parse(req.body);
    
    // Add agent metadata to each log
    const logsWithMeta: LogInput[] = data.logs.map(log => ({
      timestamp: log.timestamp,
      level: log.level,
      service: log.service,
      message: log.message,
      meta: {
        ...log.meta,
        _agent: {
          hostname: data.agent.hostname,
          environment: data.agent.environment,
          version: data.agent.version,
          tags: data.agent.tags,
          sourceId: logSource.id,
          sourceName: logSource.name,
        },
      },
    }));
    
    // Insert logs
    const count = await createLogs(logsWithMeta);
    
    // Broadcast to connected SSE clients
    const logsForBroadcast = logsWithMeta.map(log => ({
      timestamp: log.timestamp || new Date().toISOString(),
      level: log.level || 'INFO',
      service: log.service || 'unknown',
      message: log.message,
    }));
    broadcastLogs(logsForBroadcast);
    
    // Update log source last seen timestamp
    await prisma.logSource.update({
      where: { id: logSource.id },
      data: { 
        lastSeenAt: new Date(),
        // Increment log count if field exists
      },
    });
    
    res.status(201).json({
      success: true,
      received: count,
      agent: data.agent.hostname,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request format',
        details: error.errors,
      });
      return;
    }
    console.error('Agent ingest error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ingest logs',
    });
  }
});

/**
 * POST /api/logs/agent/heartbeat
 * Agent heartbeat to report status and metrics
 */
router.post('/agent/heartbeat', async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers['x-api-key'] as string || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      res.status(401).json({ success: false, error: 'API key required' });
      return;
    }
    
    const logSource = await prisma.logSource.findFirst({
      where: { apiKey, isActive: true },
    });
    
    if (!logSource) {
      res.status(403).json({ success: false, error: 'Invalid API key' });
      return;
    }
    
    const { hostname, version, uptime, logsCollected, bufferedLogs, collectors } = req.body;
    
    // Update log source with heartbeat info
    await prisma.logSource.update({
      where: { id: logSource.id },
      data: {
        lastSeenAt: new Date(),
        config: {
          ...((logSource.config as object) || {}),
          lastHeartbeat: {
            hostname,
            version,
            uptime,
            logsCollected,
            bufferedLogs,
            collectors,
            receivedAt: new Date().toISOString(),
          },
        },
      },
    });
    
    res.json({
      success: true,
      serverTime: new Date().toISOString(),
      config: logSource.config,
    });
  } catch (error) {
    console.error('Heartbeat error:', error);
    res.status(500).json({ success: false, error: 'Heartbeat failed' });
  }
});

/**
 * GET /api/logs/agent/config
 * Get agent configuration from server (optional remote config)
 */
router.get('/agent/config', async (req: Request, res: Response) => {
  try {
    const apiKey = req.headers['x-api-key'] as string || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      res.status(401).json({ success: false, error: 'API key required' });
      return;
    }
    
    const logSource = await prisma.logSource.findFirst({
      where: { apiKey, isActive: true },
    });
    
    if (!logSource) {
      res.status(403).json({ success: false, error: 'Invalid API key' });
      return;
    }
    
    res.json({
      success: true,
      config: logSource.config || {},
      name: logSource.name,
      environment: logSource.environment,
    });
  } catch (error) {
    console.error('Config fetch error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch config' });
  }
});

export default router;
