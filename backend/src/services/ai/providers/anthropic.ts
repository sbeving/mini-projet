/**
 * Anthropic (Claude) AI Provider
 * Supports Claude 3.5, Claude 3, etc.
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

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface AnthropicStreamEvent {
  type: string;
  index?: number;
  delta?: {
    type: string;
    text?: string;
    stop_reason?: string;
  };
  content_block?: {
    type: string;
    text: string;
  };
  message?: {
    id: string;
    model: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

// Known Claude models
const CLAUDE_MODELS: AIModel[] = [
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    provider: 'anthropic',
    contextWindow: 200000,
    maxTokens: 8192,
    supportsFunctions: true,
    supportsStreaming: true,
    supportsVision: true,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    description: 'Most intelligent model, best for complex tasks',
  },
  {
    id: 'claude-3-5-haiku-20241022',
    name: 'claude-3-5-haiku-20241022',
    displayName: 'Claude 3.5 Haiku',
    provider: 'anthropic',
    contextWindow: 200000,
    maxTokens: 8192,
    supportsFunctions: true,
    supportsStreaming: true,
    supportsVision: true,
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
    description: 'Fastest model, great for quick tasks',
  },
  {
    id: 'claude-3-opus-20240229',
    name: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus',
    provider: 'anthropic',
    contextWindow: 200000,
    maxTokens: 4096,
    supportsFunctions: true,
    supportsStreaming: true,
    supportsVision: true,
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    description: 'Powerful model for complex reasoning',
  },
];

export class AnthropicProvider implements AIProvider {
  readonly type: AIProviderType = 'anthropic';
  readonly name = 'Anthropic (Claude)';
  
  private apiKey: string;
  private baseUrl: string;
  private defaultModel: string;
  private timeout: number;
  private apiVersion: string;

  constructor(options?: {
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
    timeout?: number;
  }) {
    this.apiKey = options?.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.baseUrl = options?.baseUrl || 'https://api.anthropic.com/v1';
    this.defaultModel = options?.defaultModel || 'claude-3-5-sonnet-20241022';
    this.timeout = options?.timeout || 120000;
    this.apiVersion = '2023-06-01';
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': this.apiVersion,
    };
  }

  async checkHealth(): Promise<boolean> {
    if (!this.apiKey) return false;
    
    // Anthropic doesn't have a dedicated health endpoint
    // We'll try a minimal request
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({
          model: this.defaultModel,
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Hi' }],
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      // Even an error response means the API is reachable
      return response.status !== 500 && response.status !== 503;
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
        modelsAvailable: healthy ? CLAUDE_MODELS.length : 0,
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
    // Anthropic doesn't have a models list endpoint
    // Return hardcoded list if API key is valid
    if (!this.apiKey) return [];
    return CLAUDE_MODELS;
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const startTime = Date.now();
    const model = request.model || this.defaultModel;
    
    // Build messages (Anthropic requires alternating user/assistant)
    const messages: AnthropicMessage[] = [];
    
    for (const msg of request.messages) {
      if (msg.role === 'system') continue; // Handle separately
      
      // Anthropic requires alternating roles
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === msg.role) {
        // Merge consecutive same-role messages
        lastMsg.content += '\n\n' + msg.content;
      } else {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    // Ensure first message is from user
    if (messages.length === 0 || messages[0].role !== 'user') {
      throw new Error('Conversation must start with a user message');
    }

    const systemPrompt = request.systemPrompt || 
      request.messages.find(m => m.role === 'system')?.content || 
      DEFAULT_SYSTEM_PROMPTS.logAnalysis;

    const body = {
      model,
      system: systemPrompt,
      messages,
      max_tokens: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.7,
      top_p: request.topP ?? 0.9,
      stream: false,
    };

    console.log(`[Anthropic] Calling model ${model}...`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Anthropic API error: ${(errorData as { error?: { message?: string } }).error?.message || response.statusText}`);
      }

      const data = await response.json() as AnthropicResponse;
      const responseTime = Date.now() - startTime;

      console.log(`[Anthropic] Response received in ${responseTime}ms`);

      const textContent = data.content.find(c => c.type === 'text');

      return {
        id: data.id,
        model: data.model,
        provider: this.type,
        content: textContent?.text || '',
        finishReason: this.mapStopReason(data.stop_reason),
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        },
        responseTime,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Anthropic request timed out after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  async *chatStream(request: ChatCompletionRequest): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured');
    }

    const model = request.model || this.defaultModel;
    
    const messages: AnthropicMessage[] = [];
    for (const msg of request.messages) {
      if (msg.role === 'system') continue;
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === msg.role) {
        lastMsg.content += '\n\n' + msg.content;
      } else {
        messages.push({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        });
      }
    }

    if (messages.length === 0 || messages[0].role !== 'user') {
      throw new Error('Conversation must start with a user message');
    }

    const systemPrompt = request.systemPrompt || 
      request.messages.find(m => m.role === 'system')?.content || 
      DEFAULT_SYSTEM_PROMPTS.logAnalysis;

    const body = {
      model,
      system: systemPrompt,
      messages,
      max_tokens: request.maxTokens ?? 2048,
      temperature: request.temperature ?? 0.7,
      stream: true,
    };

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Anthropic API error: ${(errorData as { error?: { message?: string } }).error?.message || response.statusText}`);
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
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          try {
            const event = JSON.parse(trimmed.slice(6)) as AnthropicStreamEvent;
            
            if (event.type === 'content_block_delta' && event.delta?.text) {
              yield {
                id: `anthropic-stream-${Date.now()}`,
                content: event.delta.text,
                done: false,
              };
            } else if (event.type === 'message_stop') {
              yield {
                id: `anthropic-stream-${Date.now()}`,
                content: '',
                done: true,
                finishReason: 'stop',
              };
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      throw error;
    }
  }

  private mapStopReason(reason?: string): ChatCompletionResponse['finishReason'] {
    switch (reason) {
      case 'end_turn': return 'stop';
      case 'max_tokens': return 'length';
      case 'stop_sequence': return 'stop';
      default: return 'stop';
    }
  }
}
