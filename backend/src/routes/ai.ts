import { Router, Request, Response } from 'express';
import { aiManager } from '../services/ai/index.js';
import { AIProviderType } from '../services/ai/types.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';

const router = Router();

// ============================================================
// PUBLIC ROUTES (No authentication required)
// ============================================================

/**
 * GET /api/ai/health
 * Public health check for AI providers (no auth required)
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const defaultProvider = aiManager.getDefaultProvider();
    res.json({
      success: true,
      aiEnabled: true,
      defaultProvider,
      supportedProviders: ['ollama', 'openai', 'anthropic', 'gemini', 'openrouter', 'grok']
    });
  } catch (error) {
    console.error('Error checking AI health:', error);
    res.status(500).json({
      success: false,
      error: 'AI service unavailable'
    });
  }
});

// ============================================================
// AUTHENTICATED ROUTES (Authenticated users)
// ============================================================

/**
 * GET /api/ai/status
 * Get status of all configured AI providers
 */
router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const status = await aiManager.getAllStatus();
    res.json({
      success: true,
      data: status,
      defaultProvider: aiManager.getDefaultProvider(),
      fallbackProviders: aiManager.getFallbackProviders()
    });
  } catch (error) {
    console.error('Error getting AI status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI provider status'
    });
  }
});

/**
 * GET /api/ai/models
 * Get available models from all providers
 */
router.get('/models', authenticate, async (req: Request, res: Response) => {
  try {
    const { provider } = req.query;
    
    if (provider && typeof provider === 'string') {
      // Get models for specific provider
      const models = await aiManager.getModels(provider as AIProviderType);
      res.json({
        success: true,
        provider,
        models
      });
    } else {
      // Get all models
      const allModels = await aiManager.getAllModels();
      res.json({
        success: true,
        models: allModels
      });
    }
  } catch (error) {
    console.error('Error getting models:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI models'
    });
  }
});

/**
 * GET /api/ai/providers
 * Get list of available providers and their configuration status
 */
router.get('/providers', authenticate, async (req: Request, res: Response) => {
  try {
    const status = await aiManager.getAllStatus();
    const providers = Object.entries(status).map(([name, info]) => ({
      name,
      type: name,
      configured: info.configured,
      available: info.available,
      error: info.error,
      model: info.model,
      capabilities: info.capabilities
    }));
    
    res.json({
      success: true,
      providers,
      default: aiManager.getDefaultProvider()
    });
  } catch (error) {
    console.error('Error getting providers:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI providers'
    });
  }
});

/**
 * POST /api/ai/chat
 * Send a chat message using the configured AI provider
 */
router.post('/chat', authenticate, async (req: Request, res: Response) => {
  try {
    const { messages, model, provider, stream = false, systemPrompt } = req.body;
    
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Messages array is required'
      });
    }
    
    // Validate messages format
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return res.status(400).json({
          success: false,
          error: 'Each message must have role and content'
        });
      }
    }
    
    if (stream) {
      // Set up SSE for streaming
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      
      try {
        const streamGenerator = await aiManager.chatStream({
          messages,
          model,
          provider: provider as AIProviderType,
          systemPrompt
        });
        
        for await (const chunk of streamGenerator) {
          if (chunk.done) {
            res.write(`data: ${JSON.stringify({ done: true, usage: chunk.usage })}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ content: chunk.content, done: false })}\n\n`);
          }
        }
        
        res.end();
      } catch (error: any) {
        res.write(`data: ${JSON.stringify({ error: error.message, done: true })}\n\n`);
        res.end();
      }
    } else {
      // Non-streaming response
      const response = await aiManager.chat({
        messages,
        model,
        provider: provider as AIProviderType,
        systemPrompt
      });
      
      res.json({
        success: true,
        data: response
      });
    }
  } catch (error: any) {
    console.error('Error in AI chat:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get AI response'
    });
  }
});

/**
 * POST /api/ai/test
 * Test a specific provider with a simple message
 */
router.post('/test', authenticate, async (req: Request, res: Response) => {
  try {
    const { provider, model, apiKey } = req.body;
    
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Provider is required'
      });
    }
    
    // If API key is provided, temporarily configure the provider
    if (apiKey) {
      await aiManager.configureProvider(provider as AIProviderType, {
        apiKey,
        model
      });
    }
    
    // Send a simple test message
    const response = await aiManager.chat({
      messages: [{ role: 'user', content: 'Hello! Please respond with "OK" to confirm you are working.' }],
      provider: provider as AIProviderType,
      model
    });
    
    res.json({
      success: true,
      message: 'Provider test successful',
      response: response.content,
      model: response.model,
      provider: response.provider
    });
  } catch (error: any) {
    console.error('Error testing provider:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Provider test failed'
    });
  }
});

// ============================================================
// ADMIN ROUTES
// ============================================================

/**
 * POST /api/ai/configure
 * Configure an AI provider (Admin only)
 */
router.post('/configure', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { provider, apiKey, model, baseUrl, enabled } = req.body;
    
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Provider name is required'
      });
    }
    
    await aiManager.configureProvider(provider as AIProviderType, {
      apiKey,
      model,
      baseUrl,
      enabled
    });
    
    // Get updated status
    const status = await aiManager.getProviderStatus(provider as AIProviderType);
    
    res.json({
      success: true,
      message: `Provider ${provider} configured successfully`,
      status
    });
  } catch (error: any) {
    console.error('Error configuring provider:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to configure provider'
    });
  }
});

/**
 * POST /api/ai/default
 * Set the default AI provider (Admin only)
 */
router.post('/default', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { provider } = req.body;
    
    if (!provider) {
      return res.status(400).json({
        success: false,
        error: 'Provider name is required'
      });
    }
    
    aiManager.setDefaultProvider(provider as AIProviderType);
    
    res.json({
      success: true,
      message: `Default provider set to ${provider}`,
      default: provider
    });
  } catch (error: any) {
    console.error('Error setting default provider:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to set default provider'
    });
  }
});

/**
 * POST /api/ai/fallback
 * Set fallback providers order (Admin only)
 */
router.post('/fallback', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { providers } = req.body;
    
    if (!providers || !Array.isArray(providers)) {
      return res.status(400).json({
        success: false,
        error: 'Providers array is required'
      });
    }
    
    aiManager.setFallbackProviders(providers as AIProviderType[]);
    
    res.json({
      success: true,
      message: 'Fallback providers updated',
      fallback: providers
    });
  } catch (error: any) {
    console.error('Error setting fallback providers:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to set fallback providers'
    });
  }
});

/**
 * POST /api/ai/system-prompt
 * Update system prompt (Admin only)
 */
router.post('/system-prompt', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { prompt, type = 'logAnalysis' } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }
    
    // Use setSystemPromptByType for typed prompts, or setSystemPrompt for custom
    if (type && type !== 'custom') {
      aiManager.setSystemPromptByType(type, prompt);
    } else {
      aiManager.setSystemPrompt(prompt);
    }
    
    res.json({
      success: true,
      message: 'System prompt updated',
      type,
      prompt
    });
  } catch (error: any) {
    console.error('Error setting system prompt:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to set system prompt'
    });
  }
});

/**
 * GET /api/ai/system-prompts
 * Get all system prompts (Admin only)
 */
router.get('/system-prompts', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const prompts = aiManager.getSystemPrompts();
    
    res.json({
      success: true,
      prompts
    });
  } catch (error: any) {
    console.error('Error getting system prompts:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get system prompts'
    });
  }
});

/**
 * GET /api/ai/config
 * Get full AI configuration (Admin only)
 */
router.get('/config', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const status = await aiManager.getAllStatus();
    const prompts = aiManager.getSystemPrompts();
    
    res.json({
      success: true,
      config: {
        defaultProvider: aiManager.getDefaultProvider(),
        fallbackProviders: aiManager.getFallbackProviders(),
        providers: status,
        systemPrompts: prompts
      }
    });
  } catch (error: any) {
    console.error('Error getting AI config:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get AI configuration'
    });
  }
});

/**
 * DELETE /api/ai/provider/:name
 * Disable a provider (Admin only)
 */
router.delete('/provider/:name', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    
    await aiManager.configureProvider(name as AIProviderType, {
      enabled: false
    });
    
    res.json({
      success: true,
      message: `Provider ${name} disabled`
    });
  } catch (error: any) {
    console.error('Error disabling provider:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to disable provider'
    });
  }
});

export default router;
