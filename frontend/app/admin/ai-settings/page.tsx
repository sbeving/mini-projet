'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getStoredToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { 
  Bot, Check, X, RefreshCw, Settings, Zap, Server, 
  Key, Eye, EyeOff, Play, Save, Loader2, AlertCircle,
  Sparkles, MessageSquare, Shield, ChevronDown, ChevronUp,
  Copy, ExternalLink, Info
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface AIProvider {
  name: string;
  type: string;
  configured: boolean;
  available: boolean;
  error?: string;
  model?: string;
  capabilities?: string[];
}

interface AIConfig {
  defaultProvider: string;
  fallbackProviders: string[];
  providers: Record<string, any>;
  systemPrompts: {
    current: string;
    defaults: Record<string, string>;
  };
}

interface AIModel {
  id: string;
  name: string;
  provider: string;
  description?: string;
  contextLength?: number;
}

// Provider configuration
const PROVIDERS = [
  { 
    id: 'ollama', 
    name: 'Ollama', 
    icon: '🦙', 
    description: 'Run AI models locally - Free & Private',
    color: 'green',
    requiresKey: false,
    docsUrl: 'https://ollama.ai',
    features: ['Local', 'Free', 'Privacy']
  },
  { 
    id: 'openai', 
    name: 'OpenAI', 
    icon: '🤖', 
    description: 'GPT-4o, GPT-4 Turbo, GPT-3.5',
    color: 'emerald',
    requiresKey: true,
    docsUrl: 'https://platform.openai.com',
    features: ['Best Quality', 'Fast', 'Reliable']
  },
  { 
    id: 'anthropic', 
    name: 'Anthropic', 
    icon: '🧠', 
    description: 'Claude 3.5 Sonnet, Claude 3 Opus',
    color: 'orange',
    requiresKey: true,
    docsUrl: 'https://console.anthropic.com',
    features: ['Long Context', 'Safe', 'Accurate']
  },
  { 
    id: 'gemini', 
    name: 'Google Gemini', 
    icon: '✨', 
    description: 'Gemini Pro, Gemini Flash - 1M+ context',
    color: 'blue',
    requiresKey: true,
    docsUrl: 'https://ai.google.dev',
    features: ['Huge Context', 'Multimodal', 'Fast']
  },
  { 
    id: 'openrouter', 
    name: 'OpenRouter', 
    icon: '🔀', 
    description: 'Access 100+ models through one API',
    color: 'purple',
    requiresKey: true,
    docsUrl: 'https://openrouter.ai',
    features: ['Multi-Model', 'Pay-per-use', 'Flexible']
  },
  { 
    id: 'grok', 
    name: 'xAI Grok', 
    icon: '⚡', 
    description: 'Grok models with real-time knowledge',
    color: 'red',
    requiresKey: true,
    docsUrl: 'https://x.ai',
    features: ['Real-time', 'Uncensored', 'Fast']
  },
];

export default function AdminAISettingsPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Form states
  const [defaultProvider, setDefaultProvider] = useState('');
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [selectedPromptType, setSelectedPromptType] = useState('logAnalysis');
  
  // API Key configuration
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  
  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push('/dashboard');
    }
  }, [user, authLoading, isAdmin, router]);

  const fetchData = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      setLoading(true);
      
      // Fetch providers
      const providersRes = await fetch(`${API_URL}/api/ai/providers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const providersData = await providersRes.json();
      if (providersData.success) {
        setProviders(providersData.providers);
        setDefaultProvider(providersData.default);
      }
      
      // Fetch config (admin only)
      const configRes = await fetch(`${API_URL}/api/ai/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const configData = await configRes.json();
      if (configData.success) {
        setConfig(configData.config);
        setCurrentPrompt(configData.config.systemPrompts.current);
      }
      
      // Fetch all models
      const modelsRes = await fetch(`${API_URL}/api/ai/models`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const modelsData = await modelsRes.json();
      if (modelsData.success) {
        setModels(modelsData.models);
      }
      
    } catch (error) {
      console.error('Error fetching AI config:', error);
      showToast('Failed to load AI configuration', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (token && !authLoading && isAdmin) {
      fetchData();
    }
  }, [authLoading, isAdmin, fetchData]);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
    showToast('Configuration refreshed', 'success');
  };

  const testProvider = async (providerName: string) => {
    const token = getStoredToken();
    try {
      setTesting(providerName);
      
      const res = await fetch(`${API_URL}/api/ai/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          provider: providerName,
          apiKey: apiKeyInputs[providerName] || undefined
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        showToast(`${providerName} is working! Response received.`, 'success');
        fetchData();
      } else {
        showToast(`${providerName} test failed: ${data.error}`, 'error');
      }
    } catch (error: any) {
      showToast(`Test failed: ${error.message}`, 'error');
    } finally {
      setTesting(null);
    }
  };

  const configureProvider = async (providerName: string) => {
    const token = getStoredToken();
    const apiKey = apiKeyInputs[providerName];
    if (!apiKey) {
      showToast('Please enter an API key', 'error');
      return;
    }
    
    try {
      setSaving(true);
      
      const res = await fetch(`${API_URL}/api/ai/configure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          provider: providerName,
          apiKey
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        showToast(`${providerName} configured successfully!`, 'success');
        setApiKeyInputs(prev => ({ ...prev, [providerName]: '' }));
        fetchData();
      } else {
        showToast(data.error || 'Configuration failed', 'error');
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const setDefaultProviderHandler = async () => {
    const token = getStoredToken();
    try {
      setSaving(true);
      
      const res = await fetch(`${API_URL}/api/ai/default`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ provider: defaultProvider })
      });
      
      const data = await res.json();
      
      if (data.success) {
        showToast(`Default provider set to ${defaultProvider}`, 'success');
      } else {
        showToast(data.error, 'error');
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateSystemPrompt = async () => {
    const token = getStoredToken();
    try {
      setSaving(true);
      
      const res = await fetch(`${API_URL}/api/ai/system-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          prompt: currentPrompt,
          type: selectedPromptType
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        showToast('System prompt updated!', 'success');
      } else {
        showToast(data.error, 'error');
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const loadDefaultPrompt = (type: string) => {
    if (config?.systemPrompts.defaults[type]) {
      setCurrentPrompt(config.systemPrompts.defaults[type]);
      setSelectedPromptType(type);
    }
  };

  const getProviderStatus = (providerId: string) => {
    return providers.find(p => p.name === providerId);
  };

  const getColorClasses = (color: string, isActive: boolean) => {
    const colors: Record<string, { bg: string; border: string; text: string }> = {
      green: { 
        bg: isActive ? 'bg-green-500/20' : 'bg-surface', 
        border: isActive ? 'border-green-500/50' : 'border-border', 
        text: 'text-green-400' 
      },
      emerald: { 
        bg: isActive ? 'bg-emerald-500/20' : 'bg-surface', 
        border: isActive ? 'border-emerald-500/50' : 'border-border', 
        text: 'text-emerald-400' 
      },
      orange: { 
        bg: isActive ? 'bg-orange-500/20' : 'bg-surface', 
        border: isActive ? 'border-orange-500/50' : 'border-border', 
        text: 'text-orange-400' 
      },
      blue: { 
        bg: isActive ? 'bg-blue-500/20' : 'bg-surface', 
        border: isActive ? 'border-blue-500/50' : 'border-border', 
        text: 'text-blue-400' 
      },
      purple: { 
        bg: isActive ? 'bg-purple-500/20' : 'bg-surface', 
        border: isActive ? 'border-purple-500/50' : 'border-border', 
        text: 'text-purple-400' 
      },
      red: { 
        bg: isActive ? 'bg-red-500/20' : 'bg-surface', 
        border: isActive ? 'border-red-500/50' : 'border-border', 
        text: 'text-red-400' 
      },
    };
    return colors[color] || colors.blue;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToast('Copied to clipboard!', 'success');
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center">
            <Bot className="w-8 h-8 text-primary" />
          </div>
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted">Loading AI settings...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  const availableProviders = providers.filter(p => p.available);
  const configuredCount = providers.filter(p => p.configured).length;
  const availableCount = availableProviders.length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Bot className="w-8 h-8 text-primary" />
            AI Provider Settings
          </h1>
          <p className="text-muted mt-1">
            Configure AI providers for log analysis and chat functionality
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-xl hover:bg-surface-hover transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{availableCount}</p>
              <p className="text-sm text-muted">Active Providers</p>
            </div>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <Settings className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{configuredCount}</p>
              <p className="text-sm text-muted">Configured</p>
            </div>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Server className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{models.length}</p>
              <p className="text-sm text-muted">Available Models</p>
            </div>
          </div>
        </div>
      </div>

      {/* Default Provider Selection */}
      {availableProviders.length > 0 && (
        <div className="bg-surface border border-border rounded-2xl p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Default Provider</h2>
          </div>
          <p className="text-muted text-sm mb-4">
            Select which AI provider to use by default for chat and log analysis.
          </p>
          
          <div className="flex flex-wrap items-center gap-4">
            <select
              value={defaultProvider}
              onChange={(e) => setDefaultProvider(e.target.value)}
              className="flex-1 min-w-[200px] bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {availableProviders.map((provider) => {
                const providerConfig = PROVIDERS.find(p => p.id === provider.name);
                return (
                  <option key={provider.name} value={provider.name}>
                    {providerConfig?.icon} {providerConfig?.name || provider.name}
                  </option>
                );
              })}
            </select>
            
            <button
              onClick={setDefaultProviderHandler}
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Set Default
            </button>
          </div>
        </div>
      )}

      {/* Provider Cards */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Server className="w-5 h-5 text-muted" />
          AI Providers
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {PROVIDERS.map((providerConfig) => {
            const status = getProviderStatus(providerConfig.id);
            const isConfigured = status?.configured ?? false;
            const isAvailable = status?.available ?? false;
            const isExpanded = expandedProvider === providerConfig.id;
            const colors = getColorClasses(providerConfig.color, isAvailable);
            
            return (
              <div
                key={providerConfig.id}
                className={`${colors.bg} border ${colors.border} rounded-2xl overflow-hidden transition-all`}
              >
                {/* Header */}
                <div 
                  className="p-5 cursor-pointer hover:bg-surface-hover/50 transition-colors"
                  onClick={() => setExpandedProvider(isExpanded ? null : providerConfig.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-4xl">{providerConfig.icon}</span>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">
                          {providerConfig.name}
                        </h3>
                        <p className="text-sm text-muted">{providerConfig.description}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {providerConfig.features.map(feature => (
                            <span key={feature} className="px-2 py-0.5 text-xs rounded-full bg-background text-muted">
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Status Badge */}
                      {isAvailable ? (
                        <span className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      ) : isConfigured ? (
                        <span className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/20 text-yellow-400">
                          <AlertCircle className="w-3 h-3" /> Error
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-surface text-muted border border-border">
                          <X className="w-3 h-3" /> Not Set
                        </span>
                      )}
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-muted" /> : <ChevronDown className="w-5 h-5 text-muted" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-border/50 pt-4 space-y-4">
                    {/* Current Model */}
                    {status?.model && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted">Current Model:</span>
                        <code className="px-2 py-1 bg-background rounded text-primary font-mono">{status.model}</code>
                      </div>
                    )}

                    {/* Error Message */}
                    {status?.error && (
                      <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400">
                        <AlertCircle className="w-4 h-4 inline mr-2" />
                        {status.error}
                      </div>
                    )}

                    {/* API Key Input (not for Ollama) */}
                    {providerConfig.requiresKey && (
                      <div className="space-y-3">
                        <label className="block text-sm font-medium text-foreground">
                          API Key
                          <a 
                            href={providerConfig.docsUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="ml-2 text-primary hover:underline inline-flex items-center gap-1 text-xs"
                          >
                            Get key <ExternalLink className="w-3 h-3" />
                          </a>
                        </label>
                        <div className="relative">
                          <input
                            type={showApiKeys[providerConfig.id] ? 'text' : 'password'}
                            placeholder={isConfigured ? '••••••••••••••••' : 'Enter API Key'}
                            value={apiKeyInputs[providerConfig.id] || ''}
                            onChange={(e) => setApiKeyInputs(prev => ({ 
                              ...prev, 
                              [providerConfig.id]: e.target.value 
                            }))}
                            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary pr-12"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKeys(prev => ({ 
                              ...prev, 
                              [providerConfig.id]: !prev[providerConfig.id] 
                            }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground p-1"
                          >
                            {showApiKeys[providerConfig.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => configureProvider(providerConfig.id)}
                            disabled={saving || !apiKeyInputs[providerConfig.id]}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                            Save Key
                          </button>
                          <button
                            onClick={() => testProvider(providerConfig.id)}
                            disabled={testing === providerConfig.id}
                            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-surface border border-border text-foreground rounded-xl hover:bg-surface-hover transition-colors disabled:opacity-50"
                          >
                            {testing === providerConfig.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                            Test
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Ollama specific */}
                    {!providerConfig.requiresKey && (
                      <div className="space-y-3">
                        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-sm text-green-400">
                          <Info className="w-4 h-4 inline mr-2" />
                          Ollama runs locally in Docker. No API key needed.
                        </div>
                        <button
                          onClick={() => testProvider('ollama')}
                          disabled={testing === 'ollama'}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-surface border border-border text-foreground rounded-xl hover:bg-surface-hover transition-colors disabled:opacity-50"
                        >
                          {testing === 'ollama' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                          Test Connection
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* System Prompt Configuration */}
      <div className="bg-surface border border-border rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-3 mb-4">
          <MessageSquare className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">System Prompt</h2>
        </div>
        <p className="text-muted text-sm mb-4">
          Customize how the AI behaves when analyzing logs and responding to queries.
        </p>
        
        {/* Preset Buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { id: 'logAnalysis', label: 'Log Analysis', icon: <Server className="w-4 h-4" /> },
            { id: 'security', label: 'Security Focus', icon: <Shield className="w-4 h-4" /> },
            { id: 'general', label: 'General Assistant', icon: <Bot className="w-4 h-4" /> },
          ].map(preset => (
            <button
              key={preset.id}
              onClick={() => loadDefaultPrompt(preset.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                selectedPromptType === preset.id
                  ? 'bg-primary text-white'
                  : 'bg-background border border-border text-muted hover:bg-surface-hover'
              }`}
            >
              {preset.icon}
              {preset.label}
            </button>
          ))}
        </div>
        
        <textarea
          value={currentPrompt}
          onChange={(e) => setCurrentPrompt(e.target.value)}
          rows={8}
          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm resize-none"
          placeholder="Enter your system prompt..."
        />
        
        <div className="flex justify-between items-center mt-4">
          <p className="text-xs text-muted">{currentPrompt.length} characters</p>
          <button
            onClick={updateSystemPrompt}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Prompt
          </button>
        </div>
      </div>

      {/* Available Models */}
      <div className="bg-surface border border-border rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Available Models</h2>
          </div>
          <span className="text-sm text-muted">{models.length} models</span>
        </div>
        
        {models.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-3 px-4 text-muted text-sm font-medium">Provider</th>
                  <th className="py-3 px-4 text-muted text-sm font-medium">Model ID</th>
                  <th className="py-3 px-4 text-muted text-sm font-medium hidden md:table-cell">Description</th>
                  <th className="py-3 px-4 text-muted text-sm font-medium">Context</th>
                  <th className="py-3 px-4 text-muted text-sm font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {models.slice(0, 15).map((model, idx) => {
                  const providerConfig = PROVIDERS.find(p => p.id === model.provider);
                  return (
                    <tr key={`${model.provider}-${model.id}-${idx}`} className="border-b border-border/50 hover:bg-surface-hover/50">
                      <td className="py-3 px-4">
                        <span className="flex items-center gap-2 text-foreground">
                          <span>{providerConfig?.icon || '🔌'}</span>
                          {providerConfig?.name || model.provider}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <code className="text-primary font-mono text-sm">{model.id}</code>
                      </td>
                      <td className="py-3 px-4 text-muted text-sm hidden md:table-cell max-w-xs truncate">
                        {model.description || '-'}
                      </td>
                      <td className="py-3 px-4 text-muted text-sm">
                        {model.contextLength ? `${(model.contextLength / 1000).toFixed(0)}K` : '-'}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => copyToClipboard(model.id)}
                          className="p-1.5 hover:bg-surface rounded-lg transition-colors text-muted hover:text-foreground"
                          title="Copy model ID"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {models.length > 15 && (
              <p className="text-muted text-sm mt-4 text-center">
                Showing 15 of {models.length} models
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <Bot className="w-12 h-12 text-muted mx-auto mb-3" />
            <p className="text-muted">No models available. Configure and test a provider first.</p>
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 ${
          toast.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
          toast.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
          'bg-blue-500/20 text-blue-400 border border-blue-500/30'
        }`}>
          {toast.type === 'success' ? <Check className="w-5 h-5" /> : 
           toast.type === 'error' ? <X className="w-5 h-5" /> : 
           <Info className="w-5 h-5" />}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
