/**
 * AI Provider Types and Interfaces
 * Unified type system for multi-provider AI support
 */

export type AIProviderType = 
  | 'ollama'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'openrouter'
  | 'grok';

export interface AIProviderConfig {
  id: string;
  name: string;
  type: AIProviderType;
  enabled: boolean;
  isDefault: boolean;
  baseUrl?: string;
  apiKey?: string;
  models: AIModel[];
  options?: Record<string, unknown>;
}

export interface AIModel {
  id: string;
  name: string;
  displayName: string;
  provider: AIProviderType;
  contextWindow: number;
  maxTokens: number;
  supportsFunctions: boolean;
  supportsStreaming: boolean;
  supportsVision: boolean;
  costPer1kInput?: number;
  costPer1kOutput?: number;
  description?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  name?: string;
}

export interface ChatCompletionRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stream?: boolean;
  systemPrompt?: string;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  provider: AIProviderType;
  content: string;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  responseTime: number;
}

export interface StreamChunk {
  id: string;
  content: string;
  done: boolean;
  finishReason?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProviderStatus {
  provider: AIProviderType;
  name: string;
  healthy: boolean;
  latency?: number;
  error?: string;
  modelsAvailable: number;
  configured?: boolean;
  available?: boolean;
  model?: string;
  capabilities?: string[];
}

export interface AIProvider {
  readonly type: AIProviderType;
  readonly name: string;
  
  /**
   * Check if the provider is healthy and reachable
   */
  checkHealth(): Promise<boolean>;
  
  /**
   * Get detailed status of the provider
   */
  getStatus(): Promise<AIProviderStatus>;
  
  /**
   * List available models from this provider
   */
  listModels(): Promise<AIModel[]>;
  
  /**
   * Generate a chat completion
   */
  chat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  
  /**
   * Generate a streaming chat completion
   */
  chatStream(request: ChatCompletionRequest): AsyncGenerator<StreamChunk, void, unknown>;
}

// Default system prompts
export const DEFAULT_SYSTEM_PROMPTS = {
  logAnalysis: `You are a log analysis assistant. You are given application logs and high-level statistics from a system. Your job is to explain what is happening, highlight anomalies, and answer questions clearly and concisely.

You must:
- Identify main issues, failures, or anomalies in the logs
- Summarize error patterns by service and time
- Suggest probable root causes based only on the provided logs
- Be specific and reference actual log entries when relevant
- Keep responses focused and actionable

Do NOT:
- Invent events that are not supported by the logs
- Make assumptions about infrastructure not mentioned in logs
- Provide generic advice unrelated to the actual log content

Format your response in clear sections if the answer requires multiple points.`,
  
  general: `You are a helpful AI assistant for a SIEM (Security Information and Event Management) platform. You help users analyze logs, understand security events, and provide actionable insights.`,
  
  security: `You are a cybersecurity expert analyzing security logs. Focus on:
- Identifying potential threats and vulnerabilities
- Detecting anomalous patterns
- Providing threat intelligence context
- Recommending remediation steps
- Following security best practices`,
};

// Provider-specific default models
export const DEFAULT_MODELS: Record<AIProviderType, string> = {
  ollama: 'qwen2.5:0.5b',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-20241022',
  gemini: 'gemini-1.5-flash',
  openrouter: 'anthropic/claude-3.5-sonnet',
  grok: 'grok-2-latest',
};
