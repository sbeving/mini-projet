/**
 * Logs Routes
 * API endpoints for log ingestion and querying
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { createLog, createLogs, getRecentErrors, getServices, LogInput, queryLogs } from '../services/logs.js';

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

export default router;
