/**
 * OpenRouter AI Provider
 * Meta-provider that gives access to multiple AI models through one API
 */

import {
  AIProvider,
  AIProviderType,
  AIModel,
  AIProviderStatus,
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  DEFAULT_SYSTEM_PROMPTS,
} from '../types.js';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenRouterResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface OpenRouterStreamChunk {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }>;
}

interface OpenRouterModelsResponse {
  data: Array<{
    id: string;
    name: string;
    description?: string;
    context_length: number;
    pricing: {
      prompt: string;
      completion: string;
    };
    top_provider?: {
      max_completion_tokens?: number;
    };
    architecture?: {
      modality: string;
    };
  }>;
}

// Popular models on OpenRouter
const POPULAR_OPENROUTER_MODELS: Partial<AIModel>[] = [
  {
    id: 'anthropic/claude-3.5-sonnet',
    displayName: 'Claude 3.5 Sonnet (via OpenRouter)',
    contextWindow: 200000,
    maxTokens: 8192,
  },
  {
    id: 'openai/gpt-4o',
    displayName: 'GPT-4o (via OpenRouter)',
    contextWindow: 128000,
    maxTokens: 16384,
  },
  {
    id: 'google/gemini-pro-1.5',
    displayName: 'Gemini 1.5 Pro (via OpenRouter)',
    contextWindow: 1000000,
    maxTokens: 8192,
  },
  {
    id: 'meta-llama/llama-3.1-70b-instruct',
    displayName: 'Llama 3.1 70B (via OpenRouter)',
    contextWindow: 131072,
    maxTokens: 4096,
  },
  {
    id: 'mistralai/mistral-large',
    displayName: 'Mistral Large (via OpenRouter)',
    contextWindow: 128000,
    maxTokens: 8192,
  },
  {
    id: 'deepseek/deepseek-chat',
    displayName: 'DeepSeek Chat (via OpenRouter)',
    contextWindow: 64000,
    maxTokens: 8192,
  },
];

export class OpenRouterProvider implements AIProvider {
  readonly type: AIProviderType = 'openrouter';
  readonly name = 'OpenRouter';
  
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private timeout: number;
  private siteUrl?: string;
  private siteName?: string;

  constructor(options?: {
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
    timeout?: number;
    siteUrl?: string;
    siteName?: string;
  }) {
    this.apiKey = options?.apiKey || process.env.OPENROUTER_API_KEY || '';
    this.baseUrl = options?.baseUrl || 'https://openrouter.ai/api/v1';
    this.defaultModel = options?.defaultModel || 'anthropic/claude-3.5-sonnet';
    this.timeout = options?.timeout || 120000;
    this.siteUrl = options?.siteUrl || process.env.OPENROUTER_SITE_URL;
    this.siteName = options?.siteName || process.env.OPENROUTER_SITE_NAME || 'LogChat SIEM';
  }

  private get headers(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
    
    if (this.siteUrl) {
      headers['HTTP-Referer'] = this.siteUrl;
    }
    if (this.siteName) {
      headers['X-Title'] = this.siteName;
    }
    
    return headers;
  }

  async checkHealth(): Promise<boolean> {
    if (!this.apiKey) return false;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: this.headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
  }

  async getStatus(): Promise<AIProviderStatus> {
    const startTime = Date.now();
    
    if (!this.apiKey) {
      return {
        provider: this.type,
        name: this.name,
        healthy: false,
        error: 'API key not configured',
        modelsAvailable: 0,
      };
    }

    try {
      const healthy = await this.checkHealth();
      const models = healthy ? await this.listModels() : [];
      
      return {
        provider: this.type,
        name: this.name,
        healthy,
        latency: Date.now() - startTime,
        modelsAvailable: models.length,
      };
    } catch (error) {
      return {
        provider: this.type,
        name: this.name,
        healthy: false,
        latency: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        modelsAvailable: 0,
      };
    }
  }

  async listModels(): Promise<AIModel[]> {
    if (!this.apiKey) return [];
    
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: this.headers,
      });
      
      if (!response.ok) return [];
      
      const data = await response.json() as OpenRouterModelsResponse;
      
      return data.data.map((m) => {
        const popular = POPULAR_OPENROUTER_MODELS.find(pm => pm.id === m.id);
        const promptPrice = parseFloat(m.pricing.prompt) * 1000;
        const completionPrice = parseFloat(m.pricing.completion) * 1000;
        
        return {
          id: m.id,
          name: m.id,
          displayName: popular?.displayName || m.name || m.id,
          provider: this.type,
          contextWindow: m.context_length || 4096,
          maxTokens: m.top_provider?.max_completion_tokens || 4096,
          supportsFunctions: m.id.includes('gpt') || m.id.includes('claude'),
          supportsStreaming: true,
          supportsVision: m.architecture?.modality?.includes('multimodal') || 
                          m.id.includes('vision') || 
                          m.id.includes('gpt-4o'),
          costPer1kInput: promptPrice,
          costPer1kOutput: completionPrice,
          description: m.description,
        };
      });
    } catch {
      return [];
    }
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const startTime = Date.now();
    const model = request.model || this.defaultModel;
    
    // Build messages
    const messages: OpenRouterMessage[] = [];
    
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    } else if (request.messages[0]?.role !== 'system') {
      messages.push({ role: 'system', content: DEFAULT_SYSTEM_PROMPTS.logAnalysis });
    }
    
    messages.push(...request.messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })));

    const body = {
      model,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2048,
      top_p: request.topP ?? 0.9,
      stream: false,
    };

    console.log(`[OpenRouter] Calling model ${model}...`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenRouter API error: ${(errorData as { error?: { message?: string } }).error?.message || response.statusText}`);
      }

      const data = await response.json() as OpenRouterResponse;
      const responseTime = Date.now() - startTime;

      console.log(`[OpenRouter] Response received in ${responseTime}ms`);

      return {
        id: data.id,
        model: data.model,
        provider: this.type,
        content: data.choices[0]?.message?.content || '',
        finishReason: this.mapFinishReason(data.choices[0]?.finish_reason),
        usage: {
          promptTokens: data.usage?.prompt_tokens || 0,
          completionTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        },
        responseTime,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`OpenRouter request timed out after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  async *chatStream(request: ChatCompletionRequest): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.apiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const model = request.model || this.defaultModel;
    
    const messages: OpenRouterMessage[] = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    } else if (request.messages[0]?.role !== 'system') {
      messages.push({ role: 'system', content: DEFAULT_SYSTEM_PROMPTS.logAnalysis });
    }
    messages.push(...request.messages.filter(m => m.role !== 'system').map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })));

    const body = {
      model,
      messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens ?? 2048,
      top_p: request.topP ?? 0.9,
      stream: true,
    };

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenRouter API error: ${(errorData as { error?: { message?: string } }).error?.message || response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const chunk = JSON.parse(trimmed.slice(6)) as OpenRouterStreamChunk;
            const content = chunk.choices[0]?.delta?.content || '';
            const finishReason = chunk.choices[0]?.finish_reason;
            
            yield {
              id: chunk.id,
              content,
              done: finishReason === 'stop',
              finishReason: finishReason || undefined,
            };
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      throw error;
    }
  }

  private mapFinishReason(reason?: string): ChatCompletionResponse['finishReason'] {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'tool_calls': return 'tool_calls';
      case 'content_filter': return 'content_filter';
      default: return 'stop';
    }
  }
}
