/**
 * Google Gemini AI Provider
 * Supports Gemini Pro, Gemini Flash, etc.
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

interface GeminiContent {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
    safetyRatings?: Array<{
      category: string;
      probability: string;
    }>;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

interface GeminiStreamChunk {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text: string }>;
    };
    finishReason?: string;
  }>;
}

interface GeminiModelsResponse {
  models: Array<{
    name: string;
    displayName: string;
    description: string;
    inputTokenLimit: number;
    outputTokenLimit: number;
    supportedGenerationMethods: string[];
  }>;
}

// Known Gemini models
const GEMINI_MODELS: AIModel[] = [
  {
    id: 'gemini-1.5-pro',
    name: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    provider: 'gemini',
    contextWindow: 2000000,
    maxTokens: 8192,
    supportsFunctions: true,
    supportsStreaming: true,
    supportsVision: true,
    costPer1kInput: 0.00125,
    costPer1kOutput: 0.005,
    description: 'Best for complex reasoning with 2M context',
  },
  {
    id: 'gemini-1.5-flash',
    name: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    provider: 'gemini',
    contextWindow: 1000000,
    maxTokens: 8192,
    supportsFunctions: true,
    supportsStreaming: true,
    supportsVision: true,
    costPer1kInput: 0.000075,
    costPer1kOutput: 0.0003,
    description: 'Fast and efficient with 1M context',
  },
  {
    id: 'gemini-2.0-flash-exp',
    name: 'gemini-2.0-flash-exp',
    displayName: 'Gemini 2.0 Flash (Experimental)',
    provider: 'gemini',
    contextWindow: 1000000,
    maxTokens: 8192,
    supportsFunctions: true,
    supportsStreaming: true,
    supportsVision: true,
    description: 'Latest experimental model',
  },
];

export class GeminiProvider implements AIProvider {
  readonly type: AIProviderType = 'gemini';
  readonly name = 'Google Gemini';
  
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
    this.apiKey = options?.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    this.baseUrl = options?.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    this.defaultModel = options?.defaultModel || 'gemini-1.5-flash';
    this.timeout = options?.timeout || 60000;
  }

  async checkHealth(): Promise<boolean> {
    if (!this.apiKey) return false;
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(
        `${this.baseUrl}/models?key=${this.apiKey}`,
        { signal: controller.signal }
      );
      
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
      const response = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`);
      if (!response.ok) return GEMINI_MODELS;
      
      const data = await response.json() as GeminiModelsResponse;
      
      // Filter to generative models only
      const generativeModels = data.models.filter(m => 
        m.supportedGenerationMethods?.includes('generateContent') &&
        m.name.includes('gemini')
      );

      return generativeModels.map(m => {
        const modelId = m.name.replace('models/', '');
        const knownModel = GEMINI_MODELS.find(km => km.id === modelId);
        
        return {
          id: modelId,
          name: modelId,
          displayName: m.displayName || modelId,
          provider: this.type,
          contextWindow: m.inputTokenLimit || 32768,
          maxTokens: m.outputTokenLimit || 8192,
          supportsFunctions: true,
          supportsStreaming: true,
          supportsVision: modelId.includes('vision') || modelId.includes('1.5') || modelId.includes('2.0'),
          costPer1kInput: knownModel?.costPer1kInput,
          costPer1kOutput: knownModel?.costPer1kOutput,
          description: m.description,
        };
      });
    } catch {
      return GEMINI_MODELS;
    }
  }

  async chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const startTime = Date.now();
    const model = request.model || this.defaultModel;
    
    // Build contents array
    const contents: GeminiContent[] = [];
    
    for (const msg of request.messages) {
      if (msg.role === 'system') continue; // Handle separately
      
      const role = msg.role === 'assistant' ? 'model' : 'user';
      contents.push({
        role,
        parts: [{ text: msg.content }],
      });
    }

    const systemPrompt = request.systemPrompt || 
      request.messages.find(m => m.role === 'system')?.content || 
      DEFAULT_SYSTEM_PROMPTS.logAnalysis;

    const body = {
      contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        topP: request.topP ?? 0.9,
        maxOutputTokens: request.maxTokens ?? 2048,
      },
    };

    console.log(`[Gemini] Calling model ${model}...`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      const response = await fetch(
        `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API error: ${(errorData as { error?: { message?: string } }).error?.message || response.statusText}`);
      }

      const data = await response.json() as GeminiResponse;
      const responseTime = Date.now() - startTime;

      console.log(`[Gemini] Response received in ${responseTime}ms`);

      const candidate = data.candidates?.[0];
      const textContent = candidate?.content?.parts?.[0]?.text || '';

      return {
        id: `gemini-${Date.now()}`,
        model,
        provider: this.type,
        content: textContent,
        finishReason: this.mapFinishReason(candidate?.finishReason),
        usage: {
          promptTokens: data.usageMetadata?.promptTokenCount || 0,
          completionTokens: data.usageMetadata?.candidatesTokenCount || 0,
          totalTokens: data.usageMetadata?.totalTokenCount || 0,
        },
        responseTime,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Gemini request timed out after ${this.timeout}ms`);
      }
      throw error;
    }
  }

  async *chatStream(request: ChatCompletionRequest): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const model = request.model || this.defaultModel;
    
    const contents: GeminiContent[] = [];
    for (const msg of request.messages) {
      if (msg.role === 'system') continue;
      const role = msg.role === 'assistant' ? 'model' : 'user';
      contents.push({
        role,
        parts: [{ text: msg.content }],
      });
    }

    const systemPrompt = request.systemPrompt || 
      request.messages.find(m => m.role === 'system')?.content || 
      DEFAULT_SYSTEM_PROMPTS.logAnalysis;

    const body = {
      contents,
      systemInstruction: {
        parts: [{ text: systemPrompt }],
      },
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        topP: request.topP ?? 0.9,
        maxOutputTokens: request.maxTokens ?? 2048,
      },
    };

    try {
      const response = await fetch(
        `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Gemini API error: ${(errorData as { error?: { message?: string } }).error?.message || response.statusText}`);
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
            const chunk = JSON.parse(trimmed.slice(6)) as GeminiStreamChunk;
            const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const finishReason = chunk.candidates?.[0]?.finishReason;
            
            if (text || finishReason) {
              yield {
                id: `gemini-stream-${Date.now()}`,
                content: text,
                done: finishReason === 'STOP',
                finishReason: finishReason || undefined,
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

  private mapFinishReason(reason?: string): ChatCompletionResponse['finishReason'] {
    switch (reason) {
      case 'STOP': return 'stop';
      case 'MAX_TOKENS': return 'length';
      case 'SAFETY': return 'content_filter';
      default: return 'stop';
    }
  }
}
