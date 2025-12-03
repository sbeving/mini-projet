/**
 * Chat Routes
 * API endpoint for AI-powered log analysis chat
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { getStatsForLLM, TIME_RANGES, TimeRangeKey } from '../services/analytics.js';
import { getRecentErrors, queryLogs } from '../services/logs.js';
import { analyzeLogs, checkOllamaHealth, listModels } from '../services/ollama.js';

const router = Router();

// Chat request validation schema
const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  filters: z.object({
    level: z.string().optional(),
    service: z.string().optional(),
    timeRange: z.enum(['15m', '1h', '6h', '24h', '7d']).default('1h'),
  }).optional(),
});

/**
 * POST /api/chat
 * Send a message to the log analysis AI
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { message, filters } = chatRequestSchema.parse(req.body);
    const timeRange = filters?.timeRange || '1h';
    const minutesAgo = TIME_RANGES[timeRange as TimeRangeKey];
    
    console.log(`[Chat] Processing query: "${message.substring(0, 50)}..."`);
    
    // Build time filter
    const startTime = new Date(Date.now() - minutesAgo * 60 * 1000);
    
    // Fetch relevant logs based on filters
    const logsResult = await queryLogs({
      level: filters?.level,
      service: filters?.service,
      startTime,
      limit: 100, // Fetch more logs for context
    });
    
    // Also get recent errors specifically for better context
    const errors = await getRecentErrors(20, minutesAgo);
    
    // Combine and deduplicate logs
    const allLogs = [...logsResult.logs];
    for (const error of errors) {
      if (!allLogs.find(l => l.id === error.id)) {
        allLogs.push(error);
      }
    }
    
    // Sort by timestamp descending
    allLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Get stats summary
    const stats = await getStatsForLLM(minutesAgo);
    
    // Format logs for LLM
    const formattedLogs = allLogs.map(log => ({
      timestamp: log.timestamp,
      level: log.level,
      service: log.service,
      message: log.message,
    }));
    
    // Call Ollama for analysis
    const aiResponse = await analyzeLogs(formattedLogs, stats, message);
    
    // Return response with context
    res.json({
      success: true,
      response: aiResponse,
      context: {
        logsAnalyzed: allLogs.length,
        timeRange,
        filters: filters || {},
        // Include a few sample logs for reference
        sampleLogs: formattedLogs.slice(0, 5).map(l => ({
          timestamp: l.timestamp instanceof Date ? l.timestamp.toISOString() : l.timestamp,
          level: l.level,
          service: l.service,
          message: l.message.substring(0, 200),
        })),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: error.errors,
      });
      return;
    }
    
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process chat message',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/chat/health
 * Check if Ollama is available
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const [isHealthy, models] = await Promise.all([
      checkOllamaHealth(),
      listModels(),
    ]);
    
    res.json({
      success: true,
      ollama: {
        available: isHealthy,
        models,
        configured_model: process.env.OLLAMA_MODEL || 'qwen2.5:3b',
      },
    });
  } catch (error) {
    console.error('Ollama health check error:', error);
    res.json({
      success: true,
      ollama: {
        available: false,
        models: [],
        error: 'Failed to connect to Ollama',
      },
    });
  }
});

/**
 * GET /api/chat/suggestions
 * Get suggested questions based on current log state
 */
router.get('/suggestions', async (_req: Request, res: Response) => {
  try {
    const stats = await getStatsForLLM(60);
    const errors = await getRecentErrors(5, 60);
    
    const suggestions: string[] = [
      'What issues occurred in the last hour?',
      'Summarize the error patterns I should be aware of',
    ];
    
    // Add dynamic suggestions based on data
    if (errors.length > 0) {
      const services = [...new Set(errors.map(e => e.service))];
      if (services.length > 0) {
        suggestions.push(`What's happening with ${services[0]}?`);
      }
      suggestions.push('What are the most critical errors right now?');
    }
    
    suggestions.push('Give me a health overview of the system');
    suggestions.push('Which services need attention?');
    
    res.json({
      success: true,
      suggestions: suggestions.slice(0, 5),
    });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.json({
      success: true,
      suggestions: [
        'What issues occurred in the last hour?',
        'Summarize the current error patterns',
        'Which services have the most errors?',
      ],
    });
  }
});

export default router;
