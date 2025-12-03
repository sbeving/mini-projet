/**
 * Analytics Routes
 * API endpoints for log statistics and dashboard data
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import {
    getDashboardStats,
    getLogCountsByLevel,
    getLogsOverTime,
    getTopErrorServices,
    getTotalLogCount,
    TIME_RANGES,
    TimeRangeKey,
} from '../services/analytics.js';

const router = Router();

// Validation schema for time range
const timeRangeSchema = z.object({
  range: z.enum(['15m', '1h', '6h', '24h', '7d']).default('24h'),
});

/**
 * GET /api/analytics/stats
 * Get comprehensive dashboard statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { range } = timeRangeSchema.parse(req.query);
    const minutesAgo = TIME_RANGES[range as TimeRangeKey];
    
    const stats = await getDashboardStats(minutesAgo);
    
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        details: error.errors,
      });
      return;
    }
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch stats',
    });
  }
});

/**
 * GET /api/analytics/levels
 * Get log counts by level
 */
router.get('/levels', async (req: Request, res: Response) => {
  try {
    const { range } = timeRangeSchema.parse(req.query);
    const minutesAgo = TIME_RANGES[range as TimeRangeKey];
    
    const counts = await getLogCountsByLevel(minutesAgo);
    
    res.json({
      success: true,
      data: counts,
      timeRange: range,
    });
  } catch (error) {
    console.error('Levels error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch level counts',
    });
  }
});

/**
 * GET /api/analytics/total
 * Get total log count
 */
router.get('/total', async (req: Request, res: Response) => {
  try {
    const { range } = timeRangeSchema.parse(req.query);
    const minutesAgo = TIME_RANGES[range as TimeRangeKey];
    
    const total = await getTotalLogCount(minutesAgo);
    
    res.json({
      success: true,
      total,
      timeRange: range,
    });
  } catch (error) {
    console.error('Total count error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch total count',
    });
  }
});

/**
 * GET /api/analytics/top-errors
 * Get top services by error count
 */
router.get('/top-errors', async (req: Request, res: Response) => {
  try {
    const { range } = timeRangeSchema.parse(req.query);
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const minutesAgo = TIME_RANGES[range as TimeRangeKey];
    
    const services = await getTopErrorServices(limit, minutesAgo);
    
    res.json({
      success: true,
      data: services,
      timeRange: range,
    });
  } catch (error) {
    console.error('Top errors error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch top error services',
    });
  }
});

/**
 * GET /api/analytics/timeline
 * Get logs over time for charts
 */
router.get('/timeline', async (req: Request, res: Response) => {
  try {
    const { range } = timeRangeSchema.parse(req.query);
    const minutesAgo = TIME_RANGES[range as TimeRangeKey];
    
    // Determine bucket size based on time range
    let bucketMinutes = 5;
    if (range === '6h') bucketMinutes = 15;
    if (range === '24h') bucketMinutes = 30;
    if (range === '7d') bucketMinutes = 120;
    
    const timeline = await getLogsOverTime(minutesAgo, bucketMinutes);
    
    res.json({
      success: true,
      data: timeline,
      timeRange: range,
      bucketMinutes,
    });
  } catch (error) {
    console.error('Timeline error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch timeline',
    });
  }
});

export default router;
