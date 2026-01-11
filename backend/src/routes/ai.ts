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

// ============================================================
// OLLAMA MODEL MANAGEMENT ROUTES
// ============================================================

/**
 * GET /api/ai/ollama/models
 * Get available models from Ollama (local or remote)
 */
router.get('/ollama/models', authenticate, async (req: Request, res: Response) => {
  try {
    const baseUrl = (req.query.baseUrl as string) || process.env.OLLAMA_URL || 'http://ollama:11434';
    
    const response = await fetch(`${baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error('Failed to connect to Ollama');
    }
    
    const data = await response.json();
    const models = (data.models || []).map((m: any) => ({
      name: m.name,
      size: m.size,
      digest: m.digest,
      modifiedAt: m.modified_at,
      details: m.details
    }));
    
    res.json({
      success: true,
      models,
      baseUrl
    });
  } catch (error: any) {
    console.error('Error fetching Ollama models:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch Ollama models'
    });
  }
});

/**
 * POST /api/ai/ollama/pull
 * Pull/download a model to Ollama
 */
router.post('/ollama/pull', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { model, baseUrl: customBaseUrl } = req.body;
    
    if (!model) {
      return res.status(400).json({
        success: false,
        error: 'Model name is required'
      });
    }
    
    const baseUrl = customBaseUrl || process.env.OLLAMA_URL || 'http://ollama:11434';
    
    // Set up streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    const response = await fetch(`${baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: true })
    });
    
    if (!response.ok) {
      res.write(`data: ${JSON.stringify({ error: 'Failed to start model pull', done: true })}\n\n`);
      res.end();
      return;
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      res.write(`data: ${JSON.stringify({ error: 'No response stream', done: true })}\n\n`);
      res.end();
      return;
    }
    
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const text = decoder.decode(value);
      const lines = text.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          res.write(`data: ${JSON.stringify(data)}\n\n`);
          
          if (data.status === 'success') {
            res.write(`data: ${JSON.stringify({ done: true, status: 'success' })}\n\n`);
          }
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
    
    res.end();
  } catch (error: any) {
    console.error('Error pulling Ollama model:', error);
    res.write(`data: ${JSON.stringify({ error: error.message, done: true })}\n\n`);
    res.end();
  }
});

/**
 * DELETE /api/ai/ollama/model/:name
 * Delete a model from Ollama
 */
router.delete('/ollama/model/:name', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const baseUrl = (req.query.baseUrl as string) || process.env.OLLAMA_URL || 'http://ollama:11434';
    
    const response = await fetch(`${baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to delete model');
    }
    
    res.json({
      success: true,
      message: `Model ${name} deleted successfully`
    });
  } catch (error: any) {
    console.error('Error deleting Ollama model:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete model'
    });
  }
});

/**
 * GET /api/ai/ollama/library
 * Get popular models from Ollama library (hardcoded list since no official API)
 */
router.get('/ollama/library', authenticate, async (req: Request, res: Response) => {
  // Popular models for log analysis and chat
  const popularModels = [
    { name: 'qwen2.5:0.5b', description: 'Qwen 2.5 0.5B - Tiny, fast model', size: '395MB', tags: ['fast', 'tiny'] },
    { name: 'qwen2.5:1.5b', description: 'Qwen 2.5 1.5B - Small balanced model', size: '986MB', tags: ['balanced'] },
    { name: 'qwen2.5:3b', description: 'Qwen 2.5 3B - Good quality', size: '1.9GB', tags: ['quality'] },
    { name: 'qwen2.5:7b', description: 'Qwen 2.5 7B - Best quality', size: '4.7GB', tags: ['best'] },
    { name: 'llama3.2:1b', description: 'Llama 3.2 1B - Meta lightweight', size: '1.3GB', tags: ['meta', 'fast'] },
    { name: 'llama3.2:3b', description: 'Llama 3.2 3B - Meta balanced', size: '2.0GB', tags: ['meta', 'balanced'] },
    { name: 'llama3.1:8b', description: 'Llama 3.1 8B - Meta large', size: '4.7GB', tags: ['meta', 'quality'] },
    { name: 'mistral:7b', description: 'Mistral 7B - Excellent reasoning', size: '4.1GB', tags: ['reasoning'] },
    { name: 'codellama:7b', description: 'Code Llama 7B - Code focused', size: '3.8GB', tags: ['code'] },
    { name: 'phi3:mini', description: 'Phi-3 Mini - Microsoft small model', size: '2.3GB', tags: ['microsoft', 'fast'] },
    { name: 'gemma2:2b', description: 'Gemma 2 2B - Google lightweight', size: '1.6GB', tags: ['google', 'fast'] },
    { name: 'gemma2:9b', description: 'Gemma 2 9B - Google quality', size: '5.5GB', tags: ['google', 'quality'] },
    { name: 'deepseek-coder:6.7b', description: 'DeepSeek Coder 6.7B', size: '3.8GB', tags: ['code', 'chinese'] },
    { name: 'nomic-embed-text', description: 'Nomic Embed - Text embeddings', size: '274MB', tags: ['embeddings'] },
  ];
  
  res.json({
    success: true,
    models: popularModels
  });
});

/**
 * POST /api/ai/ollama/configure
 * Configure Ollama connection (local or remote)
 */
router.post('/ollama/configure', authenticate, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { baseUrl, defaultModel } = req.body;
    
    // Test connection
    const testUrl = baseUrl || 'http://ollama:11434';
    const testResponse = await fetch(`${testUrl}/api/tags`);
    
    if (!testResponse.ok) {
      throw new Error('Cannot connect to Ollama at ' + testUrl);
    }
    
    // Configure the provider
    await aiManager.configureProvider('ollama' as AIProviderType, {
      baseUrl: testUrl,
      model: defaultModel
    });
    
    // Set environment variable for future use (in memory)
    process.env.OLLAMA_URL = testUrl;
    if (defaultModel) {
      process.env.OLLAMA_MODEL = defaultModel;
    }
    
    res.json({
      success: true,
      message: 'Ollama configured successfully',
      baseUrl: testUrl,
      defaultModel
    });
  } catch (error: any) {
    console.error('Error configuring Ollama:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to configure Ollama'
    });
  }
});

export default router;
