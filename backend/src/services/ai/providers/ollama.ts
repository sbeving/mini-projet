/**
 * Ollama AI Provider
 * Supports both local dockerized Ollama and remote Ollama instances
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

interface OllamaTagsResponse {
  models?: Array<{
    name: string;
    size: number;
    digest: string;
    modified_at: string;
    details?: {
      parameter_size?: string;
      quantization_level?: string;
      family?: string;
    };
  }>;
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaProvider implements AIProvider {
  readonly type: AIProviderType = 'ollama';
  readonly name = 'Ollama';
  
  private baseUrl: string;
  private defaultModel: string;
  private timeout: number;

  constructor(options?: {
    baseUrl?: string;
    defaultModel?: string;
    timeout?: number;
  }) {
    this.baseUrl = options?.baseUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    this.defaultModel = options?.defaultModel || process.env.OLLAMA_MODEL || 'qwen2.5:0.5b';
    this.timeout = options?.timeout || 120000; // 2 minutes default
  }

  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`${this.baseUrl}/api/tags`, {
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
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];
      
      const data = await response.json() as OllamaTagsResponse;
      
      return (data.models || []).map((m) => ({
        id: m.name,
        name: m.name,
        displayName: this.formatModelName(m.name),
        provider: this.type,
        contextWindow: this.estimateContextWindow(m.name),
        maxTokens: 4096,
        supportsFunctions: false,
        supportsStreaming: true,
        supportsVision: m.name.includes('llava') || m.name.includes('vision'),
        description: m.details?.family 
          ? `${m.details.family} - ${m.details.parameter_size || 'Unknown size'}`
          : undefined,
      }));
    } catch {
      return [];
    }
  }

  private formatModelName(name: string): string {
    return name
      .replace(/:latest$/, '')
      .replace(/([a-z])(\d)/g, '$1 $2')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private estimateContextWindow(modelName: string): number {
    // Estimate based on known models
    if (modelName.includes('qwen')) return 32768;
    if (modelName.includes('llama3')) return 8192;
    if (modelName.includes('mistral')) return 32768;
    if (modelName.includes('codellama')) return 16384;
    if (modelName.includes('deepseek')) return 16384;
    return 4096; // Default
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const startTime = Date.now();
    const model = request.model || this.defaultModel;
    
    // Build messages array
    const messages = [];
    
    // Add system prompt
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    } else if (request.messages[0]?.role !== 'system') {
      messages.push({ role: 'system', content: DEFAULT_SYSTEM_PROMPTS.logAnalysis });
    }
    
    // Add conversation messages
    messages.push(...request.messages.filter(m => m.role !== 'system'));

    const body = {
      model,
      messages,
      stream: false,
      options: {
        temperature: request.temperature ?? 0.7,
        top_p: request.topP ?? 0.9,
        num_predict: request.maxTokens ?? 2048,
      },
    };

    console.log(`[Ollama] Calling model ${model}...`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Ollama API error: ${errorText}`);
      }

      const data = await response.json() as OllamaChatResponse;
      const responseTime = Date.now() - startTime;

      console.log(`[Ollama] Response received in ${responseTime}ms`);

      return {
        id: `ollama-${Date.now()}`,
        model,
        provider: this.type,
        content: data.message.content,
        finishReason: data.done ? 'stop' : 'length',
        usage: {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        },
        responseTime,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Ollama request timed out after ${this.timeout}ms`);
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(`Cannot connect to Ollama at ${this.baseUrl}. Make sure Ollama is running.`);
      }
      throw error;
    }
  }

  async *chatStream(request: ChatCompletionRequest): AsyncGenerator<StreamChunk, void, unknown> {
    const model = request.model || this.defaultModel;
    
    // Build messages array
    const messages = [];
    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    } else if (request.messages[0]?.role !== 'system') {
      messages.push({ role: 'system', content: DEFAULT_SYSTEM_PROMPTS.logAnalysis });
    }
    messages.push(...request.messages.filter(m => m.role !== 'system'));

    const body = {
      model,
      messages,
      stream: true,
      options: {
        temperature: request.temperature ?? 0.7,
        top_p: request.topP ?? 0.9,
        num_predict: request.maxTokens ?? 2048,
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.statusText}`);
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
          if (!line.trim()) continue;
          
          try {
            const chunk = JSON.parse(line) as OllamaChatResponse;
            yield {
              id: `ollama-stream-${Date.now()}`,
              content: chunk.message.content,
              done: chunk.done,
              finishReason: chunk.done ? 'stop' : undefined,
            };
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    } catch (error) {
      throw error;
    }
  }
}
