/**
 * OpenAI AI Provider
 * Supports OpenAI API (GPT-4, GPT-3.5, etc.)
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

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIChatResponse {
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

interface OpenAIStreamChunk {
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

interface OpenAIModelsResponse {
  data: Array<{
    id: string;
    object: string;
    created: number;
    owned_by: string;
  }>;
}

// Known OpenAI models with their specs
const OPENAI_MODELS: Record<string, Partial<AIModel>> = {
  'gpt-4o': {
    displayName: 'GPT-4o',
    contextWindow: 128000,
    maxTokens: 16384,
    supportsFunctions: true,
    supportsVision: true,
    costPer1kInput: 0.005,
    costPer1kOutput: 0.015,
  },
  'gpt-4o-mini': {
    displayName: 'GPT-4o Mini',
    contextWindow: 128000,
    maxTokens: 16384,
    supportsFunctions: true,
    supportsVision: true,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
  },
  'gpt-4-turbo': {
    displayName: 'GPT-4 Turbo',
    contextWindow: 128000,
    maxTokens: 4096,
    supportsFunctions: true,
    supportsVision: true,
    costPer1kInput: 0.01,
    costPer1kOutput: 0.03,
  },
  'gpt-3.5-turbo': {
    displayName: 'GPT-3.5 Turbo',
    contextWindow: 16385,
    maxTokens: 4096,
    supportsFunctions: true,
    supportsVision: false,
    costPer1kInput: 0.0005,
    costPer1kOutput: 0.0015,
  },
};

export class OpenAIProvider implements AIProvider {
  readonly type: AIProviderType = 'openai';
  readonly name = 'OpenAI';
  
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
    this.apiKey = options?.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseUrl = options?.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.defaultModel = options?.defaultModel || 'gpt-4o-mini';
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
      
      const data = await response.json() as OpenAIModelsResponse;
      
      // Filter to only chat models
      const chatModels = data.data.filter(m => 
        m.id.includes('gpt-') && 
        !m.id.includes('instruct') &&
        !m.id.includes('0301') &&
        !m.id.includes('0314')
      );
      
      return chatModels.map((m) => {
        const specs = OPENAI_MODELS[m.id] || {};
        return {
          id: m.id,
          name: m.id,
          displayName: specs.displayName || m.id,
          provider: this.type,
          contextWindow: specs.contextWindow || 4096,
          maxTokens: specs.maxTokens || 4096,
          supportsFunctions: specs.supportsFunctions ?? true,
          supportsStreaming: true,
          supportsVision: specs.supportsVision ?? false,
          costPer1kInput: specs.costPer1kInput,
          costPer1kOutput: specs.costPer1kOutput,
        };
      });
    } catch {
      return [];
    }
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const startTime = Date.now();
    const model = request.model || this.defaultModel;
    
    // Build messages
    const messages: OpenAIMessage[] = [];
    
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

    console.log(`[OpenAI] Calling model ${model}...`);

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
        throw new Error(`OpenAI API error: ${(errorData as { error?: { message?: string } }).error?.message || response.statusText}`);
      }

      const data = await response.json() as OpenAIChatResponse;
      const responseTime = Date.now() - startTime;

      console.log(`[OpenAI] Response received in ${responseTime}ms`);

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
        throw new Error(`OpenAI request timed out after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  async *chatStream(request: ChatCompletionRequest): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const model = request.model || this.defaultModel;
    
    const messages: OpenAIMessage[] = [];
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
        throw new Error(`OpenAI API error: ${(errorData as { error?: { message?: string } }).error?.message || response.statusText}`);
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
            const chunk = JSON.parse(trimmed.slice(6)) as OpenAIStreamChunk;
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
