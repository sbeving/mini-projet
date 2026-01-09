/**
 * Chat Routes
 * API endpoint for AI-powered log analysis chat
 * Now supports multiple AI providers via AIManager
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { getStatsForLLM, TIME_RANGES, TimeRangeKey } from '../services/analytics.js';
import { getRecentErrors, queryLogs } from '../services/logs.js';
import { aiManager, AIProviderType } from '../services/ai/index.js';

// Keep legacy imports for backward compatibility during migration
import { analyzeLogs as legacyAnalyzeLogs, checkOllamaHealth, listModels } from '../services/ollama.js';

const router = Router();

// Chat request validation schema
const chatRequestSchema = z.object({
  message: z.string().min(1).max(2000),
  filters: z.object({
    level: z.string().optional(),
    service: z.string().optional(),
    timeRange: z.enum(['15m', '1h', '6h', '24h', '7d']).default('1h'),
  }).optional(),
  // New fields for multi-provider support
  provider: z.enum(['ollama', 'openai', 'anthropic', 'gemini', 'openrouter', 'grok']).optional(),
  model: z.string().optional(),
});

/**
 * Build context prompt from logs and stats
 */
function buildLogContext(logs: any[], stats: any): string {
  const logSummary = logs.slice(0, 50).map(log => 
    `[${log.timestamp instanceof Date ? log.timestamp.toISOString() : log.timestamp}] [${log.level}] [${log.service}] ${log.message.substring(0, 200)}`
  ).join('\n');
  
  const statsContext = `
System Statistics:
- Total Logs: ${stats.totalLogs || 0}
- Error Count: ${stats.errorCount || 0}
- Warning Count: ${stats.warningCount || 0}
- Services Affected: ${stats.services?.join(', ') || 'N/A'}
- Error Rate: ${stats.errorRate || 0}%
`;

  return `${statsContext}\n\nRecent Logs:\n${logSummary}`;
}

/**
 * POST /api/chat
 * Send a message to the log analysis AI
 * Uses AIManager for multi-provider support with fallback
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { message, filters, provider, model } = chatRequestSchema.parse(req.body);
    const timeRange = filters?.timeRange || '1h';
    const minutesAgo = TIME_RANGES[timeRange as TimeRangeKey];
    
    console.log(`[Chat] Processing query: "${message.substring(0, 50)}..." via ${provider || 'default'}`);
    
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
    
    // Build context for AI
    const logContext = buildLogContext(formattedLogs, stats);
    
    // Call AI Manager (with fallback support)
    const startTimeAI = Date.now();
    const aiResponse = await aiManager.chat({
      messages: [
        { role: 'user', content: `${message}\n\n--- LOG CONTEXT ---\n${logContext}` }
      ],
      provider: provider as AIProviderType,
      model,
    });
    const responseTime = Date.now() - startTimeAI;
    
    console.log(`[Chat] AI response received in ${responseTime}ms from ${aiResponse.provider}`);
    
    // Return response with context
    res.json({
      success: true,
      response: aiResponse.content,
      metadata: {
        provider: aiResponse.provider,
        model: aiResponse.model,
        responseTime,
        usage: aiResponse.usage,
      },
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
 * Check AI providers availability (now supports multi-provider)
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    // Get status of all providers via AIManager
    const allStatus = await aiManager.getAllStatus();
    
    // Also check legacy Ollama for backward compatibility
    const [legacyOllamaHealthy, legacyModels] = await Promise.all([
      checkOllamaHealth().catch(() => false),
      listModels().catch(() => []),
    ]);
    
    const defaultProvider = aiManager.getDefaultProvider();
    const availableProviders = allStatus.filter(s => s.healthy).map(s => s.provider);
    
    res.json({
      success: true,
      ai: {
        defaultProvider,
        availableProviders,
        providers: allStatus.reduce((acc, status) => {
          acc[status.provider] = {
            available: status.healthy,
            model: status.model,
            modelsCount: status.modelsAvailable,
            error: status.error,
          };
          return acc;
        }, {} as Record<string, any>),
      },
      // Legacy format for backward compatibility
      ollama: {
        available: legacyOllamaHealthy,
        models: legacyModels,
        configured_model: process.env.OLLAMA_MODEL || 'qwen2.5:0.5b',
      },
    });
  } catch (error) {
    console.error('AI health check error:', error);
    res.json({
      success: true,
      ai: {
        defaultProvider: 'ollama',
        availableProviders: [],
        error: 'Failed to check AI providers',
      },
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
