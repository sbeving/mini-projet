'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getStoredToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Toast from '@/components/Toast';

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

export default function AdminAISettingsPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  
  // Form states
  const [defaultProvider, setDefaultProvider] = useState('');
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [selectedPromptType, setSelectedPromptType] = useState('logAnalysis');
  
  // API Key configuration
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  
  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push('/dashboard');
    }
  }, [user, authLoading, isAdmin, router]);

  useEffect(() => {
    const token = getStoredToken();
    if (token && !authLoading && isAdmin) {
      fetchData();
    }
  }, [authLoading, isAdmin]);

  const fetchData = async () => {
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
      setToast({ message: 'Failed to load AI configuration', type: 'error' });
    } finally {
      setLoading(false);
    }
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
        setToast({ message: `${providerName} is working! Response: "${data.response}"`, type: 'success' });
        fetchData(); // Refresh to get updated status
      } else {
        setToast({ message: `${providerName} test failed: ${data.error}`, type: 'error' });
      }
    } catch (error: any) {
      setToast({ message: `Test failed: ${error.message}`, type: 'error' });
    } finally {
      setTesting(null);
    }
  };

  const configureProvider = async (providerName: string) => {
    const token = getStoredToken();
    const apiKey = apiKeyInputs[providerName];
    if (!apiKey) {
      setToast({ message: 'Please enter an API key', type: 'error' });
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
        setToast({ message: `${providerName} configured successfully!`, type: 'success' });
        setApiKeyInputs(prev => ({ ...prev, [providerName]: '' }));
        fetchData();
      } else {
        setToast({ message: data.error || 'Configuration failed', type: 'error' });
      }
    } catch (error: any) {
      setToast({ message: error.message, type: 'error' });
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
        setToast({ message: `Default provider set to ${defaultProvider}`, type: 'success' });
      } else {
        setToast({ message: data.error, type: 'error' });
      }
    } catch (error: any) {
      setToast({ message: error.message, type: 'error' });
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
        setToast({ message: 'System prompt updated!', type: 'success' });
      } else {
        setToast({ message: data.error, type: 'error' });
      }
    } catch (error: any) {
      setToast({ message: error.message, type: 'error' });
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

  const getProviderIcon = (name: string): string => {
    const icons: Record<string, string> = {
      ollama: '🦙',
      openai: '🤖',
      anthropic: '🧠',
      gemini: '✨',
      openrouter: '🔀',
      grok: '⚡'
    };
    return icons[name] || '🔌';
  };

  const getProviderDescription = (name: string): string => {
    const descriptions: Record<string, string> = {
      ollama: 'Local AI - Run models locally using Docker or external Ollama server',
      openai: 'OpenAI GPT-4, GPT-4o, GPT-3.5 Turbo models',
      anthropic: 'Claude 3.5 Sonnet, Claude 3 Opus, Haiku models',
      gemini: 'Google Gemini Pro, Flash with 1M+ context windows',
      openrouter: 'Multi-model gateway - Access 100+ models through one API',
      grok: 'xAI Grok models with real-time knowledge'
    };
    return descriptions[name] || 'AI Provider';
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900">
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">AI Provider Settings</h1>
          <p className="text-gray-400 mt-2">
            Configure AI providers for log analysis and chat functionality
          </p>
        </div>

        {/* Provider Status Cards */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Providers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {['ollama', 'openai', 'anthropic', 'gemini', 'openrouter', 'grok'].map((providerName) => {
              const provider = providers.find(p => p.name === providerName);
              const isConfigured = provider?.configured ?? false;
              const isAvailable = provider?.available ?? false;
              
              return (
                <div
                  key={providerName}
                  className={`bg-gray-800 rounded-lg p-6 border-2 transition-all ${
                    isAvailable
                      ? 'border-green-500/50 hover:border-green-500'
                      : isConfigured
                      ? 'border-yellow-500/50 hover:border-yellow-500'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{getProviderIcon(providerName)}</span>
                      <div>
                        <h3 className="text-lg font-semibold text-white capitalize">
                          {providerName}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {getProviderDescription(providerName)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Status Badge */}
                  <div className="mb-4">
                    {isAvailable ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400">
                        ✓ Available
                      </span>
                    ) : isConfigured ? (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/20 text-yellow-400">
                        ⚠ Configured (Not Responding)
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-500/20 text-gray-400">
                        Not Configured
                      </span>
                    )}
                  </div>
                  
                  {/* Current Model */}
                  {provider?.model && (
                    <p className="text-sm text-gray-400 mb-4">
                      Model: <span className="text-cyan-400">{provider.model}</span>
                    </p>
                  )}
                  
                  {/* Error Message */}
                  {provider?.error && (
                    <p className="text-sm text-red-400 mb-4">
                      {provider.error}
                    </p>
                  )}
                  
                  {/* API Key Input (not for Ollama) */}
                  {providerName !== 'ollama' && (
                    <div className="space-y-3">
                      <div className="relative">
                        <input
                          type={showApiKeys[providerName] ? 'text' : 'password'}
                          placeholder="Enter API Key"
                          value={apiKeyInputs[providerName] || ''}
                          onChange={(e) => setApiKeyInputs(prev => ({ 
                            ...prev, 
                            [providerName]: e.target.value 
                          }))}
                          className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowApiKeys(prev => ({ 
                            ...prev, 
                            [providerName]: !prev[providerName] 
                          }))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showApiKeys[providerName] ? '👁️' : '👁️‍🗨️'}
                        </button>
                      </div>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={() => configureProvider(providerName)}
                          disabled={saving || !apiKeyInputs[providerName]}
                          className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
                        >
                          {saving ? 'Saving...' : 'Save Key'}
                        </button>
                        <button
                          onClick={() => testProvider(providerName)}
                          disabled={testing === providerName}
                          className="px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
                        >
                          {testing === providerName ? 'Testing...' : 'Test'}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Ollama specific */}
                  {providerName === 'ollama' && (
                    <div className="space-y-2">
                      <p className="text-sm text-gray-400">
                        Ollama runs locally in Docker. No API key needed.
                      </p>
                      <button
                        onClick={() => testProvider('ollama')}
                        disabled={testing === 'ollama'}
                        className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        {testing === 'ollama' ? 'Testing...' : 'Test Connection'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Default Provider Selection */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">Default Provider</h2>
          <p className="text-gray-400 mb-4">
            Select which AI provider to use by default for chat and analysis.
          </p>
          
          <div className="flex items-center gap-4">
            <select
              value={defaultProvider}
              onChange={(e) => setDefaultProvider(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {providers.filter(p => p.available).map((provider) => (
                <option key={provider.name} value={provider.name}>
                  {getProviderIcon(provider.name)} {provider.name.charAt(0).toUpperCase() + provider.name.slice(1)}
                </option>
              ))}
            </select>
            
            <button
              onClick={setDefaultProviderHandler}
              disabled={saving}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white rounded-lg transition-colors font-medium"
            >
              {saving ? 'Saving...' : 'Set Default'}
            </button>
          </div>
        </div>

        {/* System Prompt Configuration */}
        <div className="bg-gray-800 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">System Prompt</h2>
          <p className="text-gray-400 mb-4">
            Customize the system prompt used for AI responses. This affects how the AI analyzes logs and responds to queries.
          </p>
          
          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => loadDefaultPrompt('logAnalysis')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPromptType === 'logAnalysis'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Log Analysis
            </button>
            <button
              onClick={() => loadDefaultPrompt('security')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPromptType === 'security'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Security Focus
            </button>
            <button
              onClick={() => loadDefaultPrompt('general')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPromptType === 'general'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              General Assistant
            </button>
          </div>
          
          <textarea
            value={currentPrompt}
            onChange={(e) => setCurrentPrompt(e.target.value)}
            rows={10}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
            placeholder="Enter your system prompt..."
          />
          
          <div className="flex justify-end mt-4">
            <button
              onClick={updateSystemPrompt}
              disabled={saving}
              className="px-6 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 text-white rounded-lg transition-colors font-medium"
            >
              {saving ? 'Saving...' : 'Save System Prompt'}
            </button>
          </div>
        </div>

        {/* Available Models */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Available Models</h2>
          <p className="text-gray-400 mb-4">
            Models available from your configured providers.
          </p>
          
          {models.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="py-3 px-4 text-gray-400 font-medium">Provider</th>
                    <th className="py-3 px-4 text-gray-400 font-medium">Model</th>
                    <th className="py-3 px-4 text-gray-400 font-medium">Description</th>
                    <th className="py-3 px-4 text-gray-400 font-medium">Context</th>
                  </tr>
                </thead>
                <tbody>
                  {models.slice(0, 20).map((model, idx) => (
                    <tr key={`${model.provider}-${model.id}-${idx}`} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                      <td className="py-3 px-4 text-gray-300">
                        <span className="mr-2">{getProviderIcon(model.provider)}</span>
                        {model.provider}
                      </td>
                      <td className="py-3 px-4 text-white font-mono text-sm">{model.id}</td>
                      <td className="py-3 px-4 text-gray-400 text-sm">{model.description || '-'}</td>
                      <td className="py-3 px-4 text-gray-400 text-sm">
                        {model.contextLength ? `${(model.contextLength / 1000).toFixed(0)}K` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {models.length > 20 && (
                <p className="text-gray-400 text-sm mt-4 text-center">
                  Showing 20 of {models.length} models
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              No models available. Configure and test a provider first.
            </div>
          )}
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
