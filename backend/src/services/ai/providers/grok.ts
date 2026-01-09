/**
 * xAI (Grok) AI Provider
 * Supports Grok models
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

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GrokResponse {
  id: string;
  object: string;
  created: number;
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

interface GrokStreamChunk {
  id: string;
  object: string;
  created: number;
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

// Known Grok models
const GROK_MODELS: AIModel[] = [
  {
    id: 'grok-2-latest',
    name: 'grok-2-latest',
    displayName: 'Grok 2',
    provider: 'grok',
    contextWindow: 131072,
    maxTokens: 8192,
    supportsFunctions: true,
    supportsStreaming: true,
    supportsVision: true,
    description: 'Latest Grok 2 model with vision capabilities',
  },
  {
    id: 'grok-2-1212',
    name: 'grok-2-1212',
    displayName: 'Grok 2 (Dec 2024)',
    provider: 'grok',
    contextWindow: 131072,
    maxTokens: 8192,
    supportsFunctions: true,
    supportsStreaming: true,
    supportsVision: true,
    description: 'Grok 2 December 2024 snapshot',
  },
  {
    id: 'grok-beta',
    name: 'grok-beta',
    displayName: 'Grok Beta',
    provider: 'grok',
    contextWindow: 131072,
    maxTokens: 8192,
    supportsFunctions: true,
    supportsStreaming: true,
    supportsVision: false,
    description: 'Grok beta model',
  },
];

export class GrokProvider implements AIProvider {
  readonly type: AIProviderType = 'grok';
  readonly name = 'xAI (Grok)';
  
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private timeout: number;

  constructor(options?: {
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
    timeout?: number;
  }) {
    this.apiKey = options?.apiKey || process.env.XAI_API_KEY || process.env.GROK_API_KEY || '';
    this.baseUrl = options?.baseUrl || 'https://api.x.ai/v1';
    this.defaultModel = options?.defaultModel || 'grok-2-latest';
    this.timeout = options?.timeout || 60000;
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };
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
      
      return {
        provider: this.type,
        name: this.name,
        healthy,
        latency: Date.now() - startTime,
        modelsAvailable: healthy ? GROK_MODELS.length : 0,
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
    return GROK_MODELS;
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.apiKey) {
      throw new Error('xAI/Grok API key not configured');
    }

    const startTime = Date.now();
    const model = request.model || this.defaultModel;
    
    // Build messages
    const messages: GrokMessage[] = [];
    
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
      stream: false,
    };

    console.log(`[Grok] Calling model ${model}...`);

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
        throw new Error(`Grok API error: ${(errorData as { error?: { message?: string } }).error?.message || response.statusText}`);
      }

      const data = await response.json() as GrokResponse;
      const responseTime = Date.now() - startTime;

      console.log(`[Grok] Response received in ${responseTime}ms`);

      return {
        id: data.id,
        model: data.model,
        provider: this.type,
        content: data.choices[0]?.message?.content || '',
        finishReason: this.mapFinishReason(data.choices[0]?.finish_reason),
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
        responseTime,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Grok request timed out after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  async *chatStream(request: ChatCompletionRequest): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.apiKey) {
      throw new Error('xAI/Grok API key not configured');
    }

    const model = request.model || this.defaultModel;
    
    const messages: GrokMessage[] = [];
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
        throw new Error(`Grok API error: ${(errorData as { error?: { message?: string } }).error?.message || response.statusText}`);
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
            const chunk = JSON.parse(trimmed.slice(6)) as GrokStreamChunk;
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
