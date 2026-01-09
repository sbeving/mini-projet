/**
 * AI Manager
 * Central orchestrator for all AI providers
 * Handles provider selection, fallbacks, and configuration
 */

import {
  AIProvider,
  AIProviderType,
  AIModel,
  AIProviderStatus,
  AIProviderConfig,
  ChatCompletionRequest,
  ChatCompletionResponse,
  StreamChunk,
  DEFAULT_MODELS,
  DEFAULT_SYSTEM_PROMPTS,
} from './types.js';

import {
  OllamaProvider,
  OpenAIProvider,
  AnthropicProvider,
  GeminiProvider,
  OpenRouterProvider,
  GrokProvider,
} from './providers/index.js';

interface AIManagerConfig {
  defaultProvider?: AIProviderType;
  defaultModel?: string;
  systemPrompt?: string;
  fallbackEnabled?: boolean;
  fallbackOrder?: AIProviderType[];
  providers?: Partial<Record<AIProviderType, {
    enabled?: boolean;
    apiKey?: string;
    baseUrl?: string;
    defaultModel?: string;
  }>>;
}

class AIManager {
  private providers: Map<AIProviderType, AIProvider> = new Map();
  private defaultProvider: AIProviderType = 'ollama';
  private defaultModel?: string;
  private systemPrompt: string = DEFAULT_SYSTEM_PROMPTS.logAnalysis;
  private fallbackEnabled: boolean = true;
  private fallbackOrder: AIProviderType[] = ['ollama', 'openai', 'anthropic', 'gemini', 'openrouter', 'grok'];

  constructor() {
    this.initializeProviders();
  }

  /**
   * Initialize all providers based on environment configuration
   */
  private initializeProviders(): void {
    // Ollama - always available (local or remote)
    this.providers.set('ollama', new OllamaProvider({
      baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
      defaultModel: process.env.OLLAMA_MODEL || 'qwen2.5:0.5b',
    }));

    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.providers.set('openai', new OpenAIProvider({
        apiKey: process.env.OPENAI_API_KEY,
        baseUrl: process.env.OPENAI_BASE_URL,
      }));
    }

    // Anthropic (Claude)
    if (process.env.ANTHROPIC_API_KEY) {
      this.providers.set('anthropic', new AnthropicProvider({
        apiKey: process.env.ANTHROPIC_API_KEY,
      }));
    }

    // Google Gemini
    if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
      this.providers.set('gemini', new GeminiProvider({
        apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      }));
    }

    // OpenRouter
    if (process.env.OPENROUTER_API_KEY) {
      this.providers.set('openrouter', new OpenRouterProvider({
        apiKey: process.env.OPENROUTER_API_KEY,
      }));
    }

    // xAI (Grok)
    if (process.env.XAI_API_KEY || process.env.GROK_API_KEY) {
      this.providers.set('grok', new GrokProvider({
        apiKey: process.env.XAI_API_KEY || process.env.GROK_API_KEY,
      }));
    }

    // Determine default provider
    const envDefault = process.env.DEFAULT_AI_PROVIDER as AIProviderType | undefined;
    if (envDefault && this.providers.has(envDefault)) {
      this.defaultProvider = envDefault;
    }

    this.defaultModel = process.env.DEFAULT_AI_MODEL;
    
    if (process.env.AI_SYSTEM_PROMPT) {
      this.systemPrompt = process.env.AI_SYSTEM_PROMPT;
    }

    console.log(`[AIManager] Initialized with providers: ${Array.from(this.providers.keys()).join(', ')}`);
    console.log(`[AIManager] Default provider: ${this.defaultProvider}`);
  }

  /**
   * Configure the AI manager
   */
  configure(config: AIManagerConfig): void {
    if (config.defaultProvider) {
      this.defaultProvider = config.defaultProvider;
    }
    if (config.defaultModel) {
      this.defaultModel = config.defaultModel;
    }
    if (config.systemPrompt) {
      this.systemPrompt = config.systemPrompt;
    }
    if (config.fallbackEnabled !== undefined) {
      this.fallbackEnabled = config.fallbackEnabled;
    }
    if (config.fallbackOrder) {
      this.fallbackOrder = config.fallbackOrder;
    }

    // Reinitialize providers with custom config
    if (config.providers) {
      for (const [type, providerConfig] of Object.entries(config.providers)) {
        const providerType = type as AIProviderType;
        if (providerConfig.enabled === false) {
          this.providers.delete(providerType);
          continue;
        }

        this.initializeProvider(providerType, providerConfig);
      }
    }
  }

  /**
   * Initialize or reinitialize a specific provider
   */
  private initializeProvider(
    type: AIProviderType,
    config: { apiKey?: string; baseUrl?: string; defaultModel?: string }
  ): void {
    switch (type) {
      case 'ollama':
        this.providers.set('ollama', new OllamaProvider(config));
        break;
      case 'openai':
        if (config.apiKey) {
          this.providers.set('openai', new OpenAIProvider(config));
        }
        break;
      case 'anthropic':
        if (config.apiKey) {
          this.providers.set('anthropic', new AnthropicProvider(config));
        }
        break;
      case 'gemini':
        if (config.apiKey) {
          this.providers.set('gemini', new GeminiProvider(config));
        }
        break;
      case 'openrouter':
        if (config.apiKey) {
          this.providers.set('openrouter', new OpenRouterProvider(config));
        }
        break;
      case 'grok':
        if (config.apiKey) {
          this.providers.set('grok', new GrokProvider(config));
        }
        break;
    }
  }

  /**
   * Get a specific provider
   */
  getProvider(type?: AIProviderType): AIProvider | undefined {
    return this.providers.get(type || this.defaultProvider);
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): AIProviderType[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get status of all providers
   */
  async getAllStatus(): Promise<AIProviderStatus[]> {
    const statuses = await Promise.all(
      Array.from(this.providers.entries()).map(async ([type, provider]) => {
        try {
          return await provider.getStatus();
        } catch (error) {
          return {
            provider: type,
            name: provider.name,
            healthy: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            modelsAvailable: 0,
          };
        }
      })
    );
    return statuses;
  }

  /**
   * Get all models from all providers
   */
  async getAllModels(): Promise<AIModel[]> {
    const allModels: AIModel[] = [];
    
    for (const [type, provider] of this.providers) {
      try {
        const models = await provider.listModels();
        allModels.push(...models);
      } catch (error) {
        console.error(`[AIManager] Failed to get models from ${type}:`, error);
      }
    }
    
    return allModels;
  }

  /**
   * Get models from a specific provider
   */
  async getModels(providerType?: AIProviderType): Promise<AIModel[]> {
    const provider = this.getProvider(providerType);
    if (!provider) return [];
    
    try {
      return await provider.listModels();
    } catch {
      return [];
    }
  }

  /**
   * Chat with automatic provider selection and fallback
   */
  async chat(request: ChatCompletionRequest & {
    provider?: AIProviderType;
  }): Promise<ChatCompletionResponse> {
    const providerType = request.provider || this.defaultProvider;
    
    // Add default system prompt if not provided
    if (!request.systemPrompt && !request.messages.some(m => m.role === 'system')) {
      request.systemPrompt = this.systemPrompt;
    }

    // Set default model if not provided
    if (!request.model && this.defaultModel) {
      request.model = this.defaultModel;
    }

    // Try primary provider
    const primaryProvider = this.getProvider(providerType);
    if (primaryProvider) {
      try {
        return await primaryProvider.chat(request);
      } catch (error) {
        console.error(`[AIManager] Primary provider ${providerType} failed:`, error);
        
        if (!this.fallbackEnabled) {
          throw error;
        }
      }
    }

    // Try fallback providers
    if (this.fallbackEnabled) {
      for (const fallbackType of this.fallbackOrder) {
        if (fallbackType === providerType) continue;
        
        const fallbackProvider = this.getProvider(fallbackType);
        if (!fallbackProvider) continue;

        try {
          console.log(`[AIManager] Trying fallback provider: ${fallbackType}`);
          
          // Use the fallback provider's default model
          const fallbackRequest = {
            ...request,
            model: DEFAULT_MODELS[fallbackType],
          };
          
          return await fallbackProvider.chat(fallbackRequest);
        } catch (error) {
          console.error(`[AIManager] Fallback provider ${fallbackType} failed:`, error);
        }
      }
    }

    throw new Error('All AI providers failed. Please check your configuration.');
  }

  /**
   * Stream chat with automatic provider selection and fallback
   */
  async *chatStream(request: ChatCompletionRequest & {
    provider?: AIProviderType;
  }): AsyncGenerator<StreamChunk, void, unknown> {
    const providerType = request.provider || this.defaultProvider;
    
    // Add default system prompt if not provided
    if (!request.systemPrompt && !request.messages.some(m => m.role === 'system')) {
      request.systemPrompt = this.systemPrompt;
    }

    // Set default model if not provided
    if (!request.model && this.defaultModel) {
      request.model = this.defaultModel;
    }

    const provider = this.getProvider(providerType);
    if (!provider) {
      throw new Error(`Provider ${providerType} not available`);
    }

    try {
      yield* provider.chatStream(request);
    } catch (error) {
      console.error(`[AIManager] Stream failed for ${providerType}:`, error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): {
    defaultProvider: AIProviderType;
    defaultModel?: string;
    systemPrompt: string;
    fallbackEnabled: boolean;
    providers: AIProviderType[];
  } {
    return {
      defaultProvider: this.defaultProvider,
      defaultModel: this.defaultModel,
      systemPrompt: this.systemPrompt,
      fallbackEnabled: this.fallbackEnabled,
      providers: this.getAvailableProviders(),
    };
  }

  /**
   * Update system prompt
   */
  setSystemPrompt(prompt: string): void {
    this.systemPrompt = prompt;
    console.log('[AIManager] System prompt updated');
  }

  /**
   * Get current system prompt
   */
  getSystemPrompt(): string {
    return this.systemPrompt;
  }

  /**
   * Set default provider
   */
  setDefaultProvider(provider: AIProviderType): void {
    if (this.providers.has(provider)) {
      this.defaultProvider = provider;
      console.log(`[AIManager] Default provider set to: ${provider}`);
    } else {
      throw new Error(`Provider ${provider} is not available`);
    }
  }

  /**
   * Set default model
   */
  setDefaultModel(model: string): void {
    this.defaultModel = model;
    console.log(`[AIManager] Default model set to: ${model}`);
  }

  /**
   * Get default provider
   */
  getDefaultProvider(): AIProviderType {
    return this.defaultProvider;
  }

  /**
   * Get fallback providers
   */
  getFallbackProviders(): AIProviderType[] {
    return this.fallbackOrder;
  }

  /**
   * Set fallback providers
   */
  setFallbackProviders(providers: AIProviderType[]): void {
    this.fallbackOrder = providers;
    console.log(`[AIManager] Fallback providers set to: ${providers.join(', ')}`);
  }

  /**
   * Configure a specific provider
   */
  async configureProvider(
    type: AIProviderType,
    config: { apiKey?: string; baseUrl?: string; model?: string; enabled?: boolean }
  ): Promise<void> {
    if (config.enabled === false) {
      this.providers.delete(type);
      console.log(`[AIManager] Provider ${type} disabled`);
      return;
    }

    this.initializeProvider(type, {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      defaultModel: config.model,
    });
    
    console.log(`[AIManager] Provider ${type} configured`);
  }

  /**
   * Get status of a specific provider
   */
  async getProviderStatus(type: AIProviderType): Promise<AIProviderStatus | null> {
    const provider = this.getProvider(type);
    if (!provider) return null;
    
    try {
      return await provider.getStatus();
    } catch (error) {
      return {
        provider: type,
        name: provider.name,
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        modelsAvailable: 0,
      };
    }
  }

  /**
   * Get all system prompts
   */
  getSystemPrompts(): {
    current: string;
    defaults: {
      logAnalysis: string;
      general: string;
      security: string;
    };
  } {
    return {
      current: this.systemPrompt,
      defaults: {
        logAnalysis: DEFAULT_SYSTEM_PROMPTS.logAnalysis,
        general: DEFAULT_SYSTEM_PROMPTS.general,
        security: DEFAULT_SYSTEM_PROMPTS.security,
      }
    };
  }

  /**
   * Set system prompt by type
   */
  setSystemPromptByType(type: keyof typeof DEFAULT_SYSTEM_PROMPTS, prompt?: string): void {
    if (prompt) {
      this.systemPrompt = prompt;
    } else if (DEFAULT_SYSTEM_PROMPTS[type]) {
      this.systemPrompt = DEFAULT_SYSTEM_PROMPTS[type];
    }
    console.log(`[AIManager] System prompt updated to type: ${type}`);
  }
}

// Singleton instance
export const aiManager = new AIManager();

// Re-export types
export * from './types.js';
