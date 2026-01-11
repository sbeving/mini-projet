'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getStoredToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { 
  Bot, Check, X, RefreshCw, Settings, Zap, Server, 
  Key, Eye, EyeOff, Play, Save, Loader2, AlertCircle,
  Sparkles, MessageSquare, Shield, ChevronDown, ChevronUp,
  Copy, ExternalLink, Info, Download, Trash2, Globe, HardDrive
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

interface OllamaModel {
  name: string;
  size: number;
  digest: string;
  modifiedAt: string;
  details?: any;
}

interface LibraryModel {
  name: string;
  description: string;
  size: string;
  tags: string[];
}

// Provider configuration
const PROVIDERS = [
  { id: 'ollama', name: 'Ollama', icon: '🦙', description: 'Run AI models locally - Free & Private', color: 'green', requiresKey: false, docsUrl: 'https://ollama.ai', features: ['Local', 'Free', 'Privacy'] },
  { id: 'openai', name: 'OpenAI', icon: '🤖', description: 'GPT-4o, GPT-4 Turbo, GPT-3.5', color: 'emerald', requiresKey: true, docsUrl: 'https://platform.openai.com', features: ['Best Quality', 'Fast', 'Reliable'] },
  { id: 'anthropic', name: 'Anthropic', icon: '🧠', description: 'Claude 3.5 Sonnet, Claude 3 Opus', color: 'orange', requiresKey: true, docsUrl: 'https://console.anthropic.com', features: ['Long Context', 'Safe', 'Accurate'] },
  { id: 'gemini', name: 'Google Gemini', icon: '✨', description: 'Gemini Pro, Gemini Flash - 1M+ context', color: 'blue', requiresKey: true, docsUrl: 'https://ai.google.dev', features: ['Huge Context', 'Multimodal', 'Fast'] },
  { id: 'openrouter', name: 'OpenRouter', icon: '🔀', description: 'Access 100+ models through one API', color: 'purple', requiresKey: true, docsUrl: 'https://openrouter.ai', features: ['Multi-Model', 'Pay-per-use', 'Flexible'] },
  { id: 'grok', name: 'xAI Grok', icon: '⚡', description: 'Grok models with real-time knowledge', color: 'red', requiresKey: true, docsUrl: 'https://x.ai', features: ['Real-time', 'Uncensored', 'Fast'] },
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
  
  const [defaultProvider, setDefaultProvider] = useState('');
  const [currentPrompt, setCurrentPrompt] = useState('');
  const [selectedPromptType, setSelectedPromptType] = useState('logAnalysis');
  
  const [apiKeyInputs, setApiKeyInputs] = useState<Record<string, string>>({});
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  
  const [ollamaUrl, setOllamaUrl] = useState('http://ollama:11434');
  const [ollamaModels, setOllamaModels] = useState<OllamaModel[]>([]);
  const [libraryModels, setLibraryModels] = useState<LibraryModel[]>([]);
  const [pullingModel, setPullingModel] = useState<string | null>(null);
  const [pullProgress, setPullProgress] = useState<Record<string, string>>({});
  const [customModelName, setCustomModelName] = useState('');
  const [useExternalOllama, setUseExternalOllama] = useState(false);
  const [externalOllamaUrl, setExternalOllamaUrl] = useState('');
  
  const [activeTab, setActiveTab] = useState<'providers' | 'ollama' | 'prompts'>('providers');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push('/dashboard');
    }
  }, [user, authLoading, isAdmin, router]);

  const fetchOllamaModels = useCallback(async () => {
    const token = getStoredToken();
    try {
      const baseUrl = useExternalOllama ? externalOllamaUrl : ollamaUrl;
      const res = await fetch(`${API_URL}/api/ai/ollama/models?baseUrl=${encodeURIComponent(baseUrl)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setOllamaModels(data.models);
      }
    } catch (error) {
      console.error('Error fetching Ollama models:', error);
    }
  }, [useExternalOllama, externalOllamaUrl, ollamaUrl]);

  const fetchData = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      setLoading(true);
      
      const providersRes = await fetch(`${API_URL}/api/ai/providers`, { headers: { Authorization: `Bearer ${token}` } });
      const providersData = await providersRes.json();
      if (providersData.success) {
        setProviders(providersData.providers);
        setDefaultProvider(providersData.default);
      }
      
      const configRes = await fetch(`${API_URL}/api/ai/config`, { headers: { Authorization: `Bearer ${token}` } });
      const configData = await configRes.json();
      if (configData.success) {
        setConfig(configData.config);
        setCurrentPrompt(configData.config.systemPrompts.current);
      }
      
      const modelsRes = await fetch(`${API_URL}/api/ai/models`, { headers: { Authorization: `Bearer ${token}` } });
      const modelsData = await modelsRes.json();
      if (modelsData.success) {
        setModels(modelsData.models);
      }
      
      const libraryRes = await fetch(`${API_URL}/api/ai/ollama/library`, { headers: { Authorization: `Bearer ${token}` } });
      const libraryData = await libraryRes.json();
      if (libraryData.success) {
        setLibraryModels(libraryData.models);
      }
      
      await fetchOllamaModels();
    } catch (error) {
      console.error('Error fetching AI config:', error);
      showToast('Failed to load AI configuration', 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchOllamaModels]);

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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: providerName, apiKey: apiKeyInputs[providerName] || undefined })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ ${providerName} is working!`, 'success');
        fetchData();
      } else {
        showToast(`❌ ${providerName} test failed: ${data.error}`, 'error');
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
    if (!apiKey) { showToast('Please enter an API key', 'error'); return; }
    
    try {
      setSaving(true);
      const testRes = await fetch(`${API_URL}/api/ai/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: providerName, apiKey })
      });
      const testData = await testRes.json();
      if (!testData.success) {
        showToast(`API key validation failed: ${testData.error}`, 'error');
        setSaving(false);
        return;
      }
      
      const res = await fetch(`${API_URL}/api/ai/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: providerName, apiKey })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`✅ ${providerName} configured and verified!`, 'success');
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
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ provider: defaultProvider })
      });
      const data = await res.json();
      if (data.success) { showToast(`Default provider set to ${defaultProvider}`, 'success'); }
      else { showToast(data.error, 'error'); }
    } catch (error: any) { showToast(error.message, 'error'); }
    finally { setSaving(false); }
  };

  const updateSystemPrompt = async () => {
    const token = getStoredToken();
    try {
      setSaving(true);
      const res = await fetch(`${API_URL}/api/ai/system-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: currentPrompt, type: selectedPromptType })
      });
      const data = await res.json();
      if (data.success) { showToast('System prompt updated!', 'success'); }
      else { showToast(data.error, 'error'); }
    } catch (error: any) { showToast(error.message, 'error'); }
    finally { setSaving(false); }
  };

  const loadDefaultPrompt = (type: string) => {
    if (config?.systemPrompts.defaults[type]) {
      setCurrentPrompt(config.systemPrompts.defaults[type]);
      setSelectedPromptType(type);
    }
  };

  const configureOllama = async () => {
    const token = getStoredToken();
    try {
      setSaving(true);
      const baseUrl = useExternalOllama ? externalOllamaUrl : 'http://ollama:11434';
      const res = await fetch(`${API_URL}/api/ai/ollama/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ baseUrl })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Ollama configured at ${baseUrl}`, 'success');
        setOllamaUrl(baseUrl);
        fetchOllamaModels();
      } else { showToast(data.error, 'error'); }
    } catch (error: any) { showToast(error.message, 'error'); }
    finally { setSaving(false); }
  };

  const pullModel = async (modelName: string) => {
    const token = getStoredToken();
    try {
      setPullingModel(modelName);
      setPullProgress(prev => ({ ...prev, [modelName]: 'Starting...' }));
      const baseUrl = useExternalOllama ? externalOllamaUrl : ollamaUrl;
      const response = await fetch(`${API_URL}/api/ai/ollama/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ model: modelName, baseUrl })
      });
      const reader = response.body?.getReader();
      if (!reader) { throw new Error('No response stream'); }
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split('\n').filter(line => line.startsWith('data: '));
        for (const line of lines) {
          try {
            const data = JSON.parse(line.replace('data: ', ''));
            if (data.error) { showToast(`Download failed: ${data.error}`, 'error'); setPullingModel(null); return; }
            if (data.status) {
              let progress = data.status;
              if (data.completed && data.total) { progress = `${data.status} ${Math.round((data.completed / data.total) * 100)}%`; }
              setPullProgress(prev => ({ ...prev, [modelName]: progress }));
            }
            if (data.done) { showToast(`✅ Model ${modelName} downloaded!`, 'success'); setPullingModel(null); fetchOllamaModels(); return; }
          } catch { }
        }
      }
    } catch (error: any) { showToast(`Download failed: ${error.message}`, 'error'); setPullingModel(null); }
  };

  const deleteModel = async (modelName: string) => {
    const token = getStoredToken();
    if (!confirm(`Delete ${modelName}?`)) return;
    try {
      const baseUrl = useExternalOllama ? externalOllamaUrl : ollamaUrl;
      const res = await fetch(`${API_URL}/api/ai/ollama/model/${encodeURIComponent(modelName)}?baseUrl=${encodeURIComponent(baseUrl)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) { showToast(`Model ${modelName} deleted`, 'success'); fetchOllamaModels(); }
      else { showToast(data.error, 'error'); }
    } catch (error: any) { showToast(error.message, 'error'); }
  };

  const getProviderStatus = (providerId: string) => providers.find(p => p.name === providerId);

  const getColorClasses = (color: string, isActive: boolean) => {
    const colors: Record<string, { bg: string; border: string }> = {
      green: { bg: isActive ? 'bg-green-500/20' : 'bg-surface', border: isActive ? 'border-green-500/50' : 'border-border' },
      emerald: { bg: isActive ? 'bg-emerald-500/20' : 'bg-surface', border: isActive ? 'border-emerald-500/50' : 'border-border' },
      orange: { bg: isActive ? 'bg-orange-500/20' : 'bg-surface', border: isActive ? 'border-orange-500/50' : 'border-border' },
      blue: { bg: isActive ? 'bg-blue-500/20' : 'bg-surface', border: isActive ? 'border-blue-500/50' : 'border-border' },
      purple: { bg: isActive ? 'bg-purple-500/20' : 'bg-surface', border: isActive ? 'border-purple-500/50' : 'border-border' },
      red: { bg: isActive ? 'bg-red-500/20' : 'bg-surface', border: isActive ? 'border-red-500/50' : 'border-border' },
    };
    return colors[color] || colors.blue;
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center"><Bot className="w-8 h-8 text-primary" /></div>
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted">Loading AI settings...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  const availableProviders = providers.filter(p => p.available);
  const configuredCount = providers.filter(p => p.configured).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3"><Bot className="w-8 h-8 text-primary" />AI Provider Settings</h1>
          <p className="text-muted mt-1">Configure AI providers for log analysis and chat functionality</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-xl hover:bg-surface-hover transition-colors disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh
        </button>
      </div>

      <div className="flex gap-2 mb-6 border-b border-border pb-4">
        {[{ id: 'providers', label: 'Providers', icon: <Server className="w-4 h-4" /> }, { id: 'ollama', label: 'Ollama Models', icon: <HardDrive className="w-4 h-4" /> }, { id: 'prompts', label: 'System Prompts', icon: <MessageSquare className="w-4 h-4" /> }].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-colors ${activeTab === tab.id ? 'bg-primary text-white' : 'bg-surface border border-border text-muted hover:bg-surface-hover'}`}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'providers' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-surface border border-border rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center"><Zap className="w-6 h-6 text-primary" /></div>
                <div><p className="text-2xl font-bold text-foreground">{availableProviders.length}</p><p className="text-sm text-muted">Active Providers</p></div>
              </div>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center"><Settings className="w-6 h-6 text-green-400" /></div>
                <div><p className="text-2xl font-bold text-foreground">{configuredCount}</p><p className="text-sm text-muted">Configured</p></div>
              </div>
            </div>
            <div className="bg-surface border border-border rounded-2xl p-5">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center"><Server className="w-6 h-6 text-purple-400" /></div>
                <div><p className="text-2xl font-bold text-foreground">{models.length}</p><p className="text-sm text-muted">Available Models</p></div>
              </div>
            </div>
          </div>

          {availableProviders.length > 0 && (
            <div className="bg-surface border border-border rounded-2xl p-6 mb-8">
              <div className="flex items-center gap-3 mb-4"><Sparkles className="w-5 h-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">Default Provider</h2></div>
              <p className="text-muted text-sm mb-4">Select which AI provider to use by default for chat and log analysis.</p>
              <div className="flex flex-wrap items-center gap-4">
                <select value={defaultProvider} onChange={(e) => setDefaultProvider(e.target.value)} className="flex-1 min-w-[200px] bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                  {availableProviders.map((provider) => {
                    const cfg = PROVIDERS.find(p => p.id === provider.name);
                    return <option key={provider.name} value={provider.name}>{cfg?.icon} {cfg?.name || provider.name}</option>;
                  })}
                </select>
                <button onClick={setDefaultProviderHandler} disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Set Default
                </button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {PROVIDERS.map((providerConfig) => {
              const status = getProviderStatus(providerConfig.id);
              const isConfigured = status?.configured ?? false;
              const isAvailable = status?.available ?? false;
              const isExpanded = expandedProvider === providerConfig.id;
              const colors = getColorClasses(providerConfig.color, isAvailable);
              
              return (
                <div key={providerConfig.id} className={`${colors.bg} border ${colors.border} rounded-2xl overflow-hidden transition-all`}>
                  <div className="p-5 cursor-pointer hover:bg-surface-hover/50 transition-colors" onClick={() => setExpandedProvider(isExpanded ? null : providerConfig.id)}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-4xl">{providerConfig.icon}</span>
                        <div>
                          <h3 className="text-lg font-bold text-foreground">{providerConfig.name}</h3>
                          <p className="text-sm text-muted">{providerConfig.description}</p>
                          <div className="flex flex-wrap gap-1 mt-2">{providerConfig.features.map(f => <span key={f} className="px-2 py-0.5 text-xs rounded-full bg-background text-muted">{f}</span>)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isAvailable ? <span className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400"><Check className="w-3 h-3" />Active</span>
                        : isConfigured ? <span className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/20 text-yellow-400"><AlertCircle className="w-3 h-3" />Error</span>
                        : <span className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-surface text-muted border border-border"><X className="w-3 h-3" />Not Set</span>}
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-muted" /> : <ChevronDown className="w-5 h-5 text-muted" />}
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-border/50 pt-4 space-y-4">
                      {status?.model && <div className="flex items-center gap-2 text-sm"><span className="text-muted">Model:</span><code className="px-2 py-1 bg-background rounded text-primary font-mono">{status.model}</code></div>}
                      {status?.error && <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400"><AlertCircle className="w-4 h-4 inline mr-2" />{status.error}</div>}
                      {providerConfig.requiresKey ? (
                        <div className="space-y-3">
                          <label className="block text-sm font-medium text-foreground">API Key<a href={providerConfig.docsUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary hover:underline inline-flex items-center gap-1 text-xs">Get key <ExternalLink className="w-3 h-3" /></a></label>
                          <div className="relative">
                            <input type={showApiKeys[providerConfig.id] ? 'text' : 'password'} placeholder={isConfigured ? '••••••••' : 'Enter API Key'} value={apiKeyInputs[providerConfig.id] || ''} onChange={(e) => setApiKeyInputs(prev => ({ ...prev, [providerConfig.id]: e.target.value }))} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary pr-12" />
                            <button type="button" onClick={() => setShowApiKeys(prev => ({ ...prev, [providerConfig.id]: !prev[providerConfig.id] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground p-1">{showApiKeys[providerConfig.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => configureProvider(providerConfig.id)} disabled={saving || !apiKeyInputs[providerConfig.id]} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}Save & Test</button>
                            <button onClick={() => testProvider(providerConfig.id)} disabled={testing === providerConfig.id} className="flex items-center justify-center gap-2 px-4 py-2.5 bg-surface border border-border text-foreground rounded-xl hover:bg-surface-hover transition-colors disabled:opacity-50">{testing === providerConfig.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}Test</button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-xl text-sm text-green-400"><Info className="w-4 h-4 inline mr-2" />Ollama runs locally. Manage models in "Ollama Models" tab.</div>
                          <button onClick={() => testProvider('ollama')} disabled={testing === 'ollama'} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-surface border border-border text-foreground rounded-xl hover:bg-surface-hover transition-colors disabled:opacity-50">{testing === 'ollama' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}Test Connection</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {activeTab === 'ollama' && (
        <div className="space-y-6">
          <div className="bg-surface border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4"><Globe className="w-5 h-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">Ollama Connection</h2></div>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <button onClick={() => setUseExternalOllama(false)} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${!useExternalOllama ? 'bg-primary text-white' : 'bg-background border border-border text-muted'}`}><HardDrive className="w-4 h-4" />Local (Docker)</button>
                <button onClick={() => setUseExternalOllama(true)} className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-colors ${useExternalOllama ? 'bg-primary text-white' : 'bg-background border border-border text-muted'}`}><Globe className="w-4 h-4" />External URL</button>
              </div>
              {useExternalOllama && (
                <div className="flex gap-2">
                  <input type="url" placeholder="http://your-ollama-server:11434" value={externalOllamaUrl} onChange={(e) => setExternalOllamaUrl(e.target.value)} className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary" />
                  <button onClick={configureOllama} disabled={saving} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Connect</button>
                </div>
              )}
              <p className="text-sm text-muted">Current: <code className="px-2 py-0.5 bg-background rounded">{useExternalOllama ? externalOllamaUrl || 'Not set' : ollamaUrl}</code></p>
            </div>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3"><HardDrive className="w-5 h-5 text-green-400" /><h2 className="text-lg font-semibold text-foreground">Installed Models</h2><span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-sm rounded-full">{ollamaModels.length}</span></div>
              <button onClick={fetchOllamaModels} className="flex items-center gap-2 text-sm text-primary hover:underline"><RefreshCw className="w-4 h-4" />Refresh</button>
            </div>
            {ollamaModels.length > 0 ? (
              <div className="space-y-2">{ollamaModels.map((model) => (
                <div key={model.name} className="flex items-center justify-between p-3 bg-background rounded-xl">
                  <div className="flex items-center gap-3"><span className="text-2xl">🦙</span><div><code className="text-primary font-mono">{model.name}</code><p className="text-xs text-muted">{formatBytes(model.size)}</p></div></div>
                  <button onClick={() => deleteModel(model.name)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}</div>
            ) : (
              <div className="text-center py-8 text-muted"><HardDrive className="w-12 h-12 mx-auto mb-3 opacity-50" /><p>No models installed. Download from below.</p></div>
            )}
          </div>

          <div className="bg-surface border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4"><Download className="w-5 h-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">Download Custom Model</h2></div>
            <div className="flex gap-2">
              <input type="text" placeholder="Model name (e.g., llama3.2:3b)" value={customModelName} onChange={(e) => setCustomModelName(e.target.value)} className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary" />
              <button onClick={() => { if (customModelName) { pullModel(customModelName); setCustomModelName(''); } }} disabled={!customModelName || pullingModel !== null} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50">{pullingModel === customModelName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}Download</button>
            </div>
            <p className="text-xs text-muted mt-2">Browse all at <a href="https://ollama.com/library" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ollama.com/library</a></p>
          </div>

          <div className="bg-surface border border-border rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4"><Sparkles className="w-5 h-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">Popular Models</h2></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {libraryModels.map((model) => {
                const isInstalled = ollamaModels.some(m => m.name === model.name);
                const isDownloading = pullingModel === model.name;
                return (
                  <div key={model.name} className="flex items-center justify-between p-4 bg-background rounded-xl border border-border/50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2"><code className="text-primary font-mono text-sm">{model.name}</code>{isInstalled && <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Installed</span>}</div>
                      <p className="text-xs text-muted mt-1">{model.description}</p>
                      <div className="flex items-center gap-2 mt-2"><span className="text-xs text-muted bg-surface px-2 py-0.5 rounded">{model.size}</span>{model.tags.map(tag => <span key={tag} className="text-xs text-muted bg-surface px-2 py-0.5 rounded">{tag}</span>)}</div>
                    </div>
                    {!isInstalled ? (
                      <button onClick={() => pullModel(model.name)} disabled={isDownloading || pullingModel !== null} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50 ml-4">
                        {isDownloading ? <><Loader2 className="w-4 h-4 animate-spin" /><span className="text-xs">{pullProgress[model.name] || 'Downloading...'}</span></> : <><Download className="w-4 h-4" />Download</>}
                      </button>
                    ) : <Check className="w-5 h-5 text-green-400 ml-4" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'prompts' && (
        <div className="bg-surface border border-border rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-4"><MessageSquare className="w-5 h-5 text-primary" /><h2 className="text-lg font-semibold text-foreground">System Prompt</h2></div>
          <p className="text-muted text-sm mb-4">Customize how the AI behaves when analyzing logs.</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {[{ id: 'logAnalysis', label: 'Log Analysis', icon: <Server className="w-4 h-4" /> }, { id: 'security', label: 'Security Focus', icon: <Shield className="w-4 h-4" /> }, { id: 'general', label: 'General', icon: <Bot className="w-4 h-4" /> }].map(preset => (
              <button key={preset.id} onClick={() => loadDefaultPrompt(preset.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${selectedPromptType === preset.id ? 'bg-primary text-white' : 'bg-background border border-border text-muted hover:bg-surface-hover'}`}>{preset.icon}{preset.label}</button>
            ))}
          </div>
          <textarea value={currentPrompt} onChange={(e) => setCurrentPrompt(e.target.value)} rows={12} className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm resize-none" placeholder="Enter your system prompt..." />
          <div className="flex justify-between items-center mt-4">
            <p className="text-xs text-muted">{currentPrompt.length} characters</p>
            <button onClick={updateSystemPrompt} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save Prompt</button>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 max-w-md ${toast.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : toast.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'}`}>
          {toast.type === 'success' ? <Check className="w-5 h-5 flex-shrink-0" /> : toast.type === 'error' ? <X className="w-5 h-5 flex-shrink-0" /> : <Info className="w-5 h-5 flex-shrink-0" />}
          <span className="text-sm">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 hover:opacity-70 flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}
