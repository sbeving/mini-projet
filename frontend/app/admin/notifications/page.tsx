'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getStoredToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { 
  Bell, Check, X, RefreshCw, Settings, Zap, 
  Eye, EyeOff, Play, Save, Loader2, AlertCircle,
  MessageSquare, Mail, Phone, Send, Hash, Plus, Trash2,
  ExternalLink, Info, ChevronDown, ChevronUp
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface NotificationConfig {
  twilio?: {
    accountSid: string;
    authToken: string;
    fromNumber: string;
    toNumbers: string[];
    enabled: boolean;
  };
  sendgrid?: {
    apiKey: string;
    fromEmail: string;
    toEmails: string[];
    enabled: boolean;
  };
  slack?: {
    webhookUrl: string;
    channel?: string;
    enabled: boolean;
  };
  discord?: {
    webhookUrl: string;
    enabled: boolean;
  };
  telegram?: {
    botToken: string;
    chatIds: string[];
    enabled: boolean;
  };
}

// Provider definitions
const PROVIDERS = [
  {
    id: 'twilio',
    name: 'Twilio SMS',
    icon: '📱',
    description: 'Send SMS alerts to phone numbers',
    color: 'red',
    docsUrl: 'https://console.twilio.com',
    features: ['SMS', 'Instant', 'Global']
  },
  {
    id: 'sendgrid',
    name: 'SendGrid Email',
    icon: '📧',
    description: 'Send email alerts via SendGrid',
    color: 'blue',
    docsUrl: 'https://app.sendgrid.com',
    features: ['Email', 'Rich HTML', 'Reliable']
  },
  {
    id: 'slack',
    name: 'Slack',
    icon: '💬',
    description: 'Post alerts to Slack channels',
    color: 'purple',
    docsUrl: 'https://api.slack.com/apps',
    features: ['Team', 'Rich Format', 'Threads']
  },
  {
    id: 'discord',
    name: 'Discord',
    icon: '🎮',
    description: 'Send alerts to Discord webhooks',
    color: 'indigo',
    docsUrl: 'https://discord.com/developers',
    features: ['Embeds', 'Colorful', 'Team']
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: '✈️',
    description: 'Send alerts via Telegram bot',
    color: 'cyan',
    docsUrl: 'https://core.telegram.org/bots',
    features: ['Fast', 'Secure', 'Mobile']
  },
];

export default function NotificationsPage() {
  const { user, loading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  
  const [config, setConfig] = useState<NotificationConfig>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  
  // Form states
  const [forms, setForms] = useState<Record<string, any>>({
    twilio: { accountSid: '', authToken: '', fromNumber: '', toNumbers: [''], enabled: true },
    sendgrid: { apiKey: '', fromEmail: '', toEmails: [''], enabled: true },
    slack: { webhookUrl: '', channel: '', enabled: true },
    discord: { webhookUrl: '', enabled: true },
    telegram: { botToken: '', chatIds: [''], enabled: true },
  });
  
  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      router.push('/dashboard');
    }
  }, [user, authLoading, isAdmin, router]);

  const fetchConfig = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      setLoading(true);
      
      const res = await fetch(`${API_URL}/api/notifications/config`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (data.success) {
        setConfig(data.config);
        // Initialize forms with existing config
        Object.entries(data.config).forEach(([provider, providerConfig]: [string, any]) => {
          setForms(prev => ({
            ...prev,
            [provider]: { ...prev[provider], ...providerConfig }
          }));
        });
      }
    } catch (error) {
      console.error('Error fetching notification config:', error);
      showToast('Failed to load notification settings', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (token && !authLoading && isAdmin) {
      fetchConfig();
    }
  }, [authLoading, isAdmin, fetchConfig]);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const updateForm = (provider: string, field: string, value: any) => {
    setForms(prev => ({
      ...prev,
      [provider]: { ...prev[provider], [field]: value }
    }));
  };

  const addArrayItem = (provider: string, field: string) => {
    setForms(prev => ({
      ...prev,
      [provider]: { 
        ...prev[provider], 
        [field]: [...(prev[provider][field] || []), ''] 
      }
    }));
  };

  const updateArrayItem = (provider: string, field: string, index: number, value: string) => {
    setForms(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: prev[provider][field].map((item: string, i: number) => i === index ? value : item)
      }
    }));
  };

  const removeArrayItem = (provider: string, field: string, index: number) => {
    setForms(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: prev[provider][field].filter((_: string, i: number) => i !== index)
      }
    }));
  };

  const configureProvider = async (provider: string) => {
    const token = getStoredToken();
    const form = forms[provider];
    
    try {
      setSaving(provider);
      
      const res = await fetch(`${API_URL}/api/notifications/configure/${provider}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });
      
      const data = await res.json();
      
      if (data.success) {
        showToast(`${provider} configured successfully!`, 'success');
        fetchConfig();
      } else {
        showToast(data.error || 'Configuration failed', 'error');
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setSaving(null);
    }
  };

  const testProvider = async (provider: string) => {
    const token = getStoredToken();
    const form = forms[provider];
    
    try {
      setTesting(provider);
      
      const res = await fetch(`${API_URL}/api/notifications/test/${provider}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });
      
      const data = await res.json();
      
      if (data.success) {
        showToast(data.message, 'success');
      } else {
        showToast(data.error || data.message || 'Test failed', 'error');
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    } finally {
      setTesting(null);
    }
  };

  const deleteProvider = async (provider: string) => {
    const token = getStoredToken();
    
    try {
      const res = await fetch(`${API_URL}/api/notifications/configure/${provider}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      
      if (data.success) {
        showToast(`${provider} removed`, 'success');
        fetchConfig();
      }
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const getColorClasses = (color: string, isActive: boolean) => {
    const colors: Record<string, { bg: string; border: string; text: string }> = {
      red: { 
        bg: isActive ? 'bg-red-500/20' : 'bg-surface', 
        border: isActive ? 'border-red-500/50' : 'border-border', 
        text: 'text-red-400' 
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
      indigo: { 
        bg: isActive ? 'bg-indigo-500/20' : 'bg-surface', 
        border: isActive ? 'border-indigo-500/50' : 'border-border', 
        text: 'text-indigo-400' 
      },
      cyan: { 
        bg: isActive ? 'bg-cyan-500/20' : 'bg-surface', 
        border: isActive ? 'border-cyan-500/50' : 'border-border', 
        text: 'text-cyan-400' 
      },
    };
    return colors[color] || colors.blue;
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center">
            <Bell className="w-8 h-8 text-primary" />
          </div>
          <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
          <p className="text-muted">Loading notification settings...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) return null;

  const configuredCount = Object.values(config).filter(c => c?.enabled).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <Bell className="w-8 h-8 text-primary" />
            Alert Notifications
          </h1>
          <p className="text-muted mt-1">
            Configure SMS, Email, Slack, Discord & Telegram alerts for critical logs
          </p>
        </div>
        <button
          onClick={fetchConfig}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-xl hover:bg-surface-hover transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-primary/10 border border-primary/30 rounded-2xl p-4 mb-8 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
        <div>
          <h3 className="font-semibold text-foreground">When are notifications sent?</h3>
          <p className="text-sm text-muted">
            Notifications are triggered when logs with <span className="text-red-400 font-medium">ERROR</span>, 
            <span className="text-red-500 font-medium ml-1">FATAL</span>, or 
            <span className="text-orange-400 font-medium ml-1">CRITICAL</span> levels are ingested.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{configuredCount}</p>
              <p className="text-sm text-muted">Active Channels</p>
            </div>
          </div>
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
              <Settings className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{PROVIDERS.length}</p>
              <p className="text-sm text-muted">Available Providers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Provider Cards */}
      <div className="space-y-4">
        {PROVIDERS.map((providerDef) => {
          const providerConfig = config[providerDef.id as keyof NotificationConfig];
          const isConfigured = !!providerConfig;
          const isEnabled = providerConfig?.enabled ?? false;
          const isExpanded = expandedProvider === providerDef.id;
          const colors = getColorClasses(providerDef.color, isEnabled);
          const form = forms[providerDef.id];

          return (
            <div
              key={providerDef.id}
              className={`${colors.bg} border ${colors.border} rounded-2xl overflow-hidden transition-all`}
            >
              {/* Header */}
              <div 
                className="p-5 cursor-pointer hover:bg-surface-hover/50 transition-colors"
                onClick={() => setExpandedProvider(isExpanded ? null : providerDef.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">{providerDef.icon}</span>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">
                        {providerDef.name}
                      </h3>
                      <p className="text-sm text-muted">{providerDef.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {providerDef.features.map(feature => (
                          <span key={feature} className="px-2 py-0.5 text-xs rounded-full bg-background text-muted">
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isEnabled ? (
                      <span className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-500/20 text-green-400">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    ) : isConfigured ? (
                      <span className="flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/20 text-yellow-400">
                        <AlertCircle className="w-3 h-3" /> Disabled
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
                  {/* Twilio Form */}
                  {providerDef.id === 'twilio' && (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">
                            Account SID
                            <a href={providerDef.docsUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary text-xs hover:underline inline-flex items-center gap-1">
                              Get credentials <ExternalLink className="w-3 h-3" />
                            </a>
                          </label>
                          <input
                            type="text"
                            placeholder="AC..."
                            value={form.accountSid}
                            onChange={(e) => updateForm('twilio', 'accountSid', e.target.value)}
                            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-foreground mb-2">Auth Token</label>
                          <div className="relative">
                            <input
                              type={showSecrets.twilio ? 'text' : 'password'}
                              placeholder="••••••••"
                              value={form.authToken}
                              onChange={(e) => updateForm('twilio', 'authToken', e.target.value)}
                              className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary pr-12"
                            />
                            <button
                              type="button"
                              onClick={() => setShowSecrets(prev => ({ ...prev, twilio: !prev.twilio }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                            >
                              {showSecrets.twilio ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">From Number</label>
                        <input
                          type="text"
                          placeholder="+1234567890"
                          value={form.fromNumber}
                          onChange={(e) => updateForm('twilio', 'fromNumber', e.target.value)}
                          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">To Numbers</label>
                        {form.toNumbers.map((num: string, idx: number) => (
                          <div key={idx} className="flex gap-2 mb-2">
                            <input
                              type="text"
                              placeholder="+1234567890"
                              value={num}
                              onChange={(e) => updateArrayItem('twilio', 'toNumbers', idx, e.target.value)}
                              className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            {form.toNumbers.length > 1 && (
                              <button onClick={() => removeArrayItem('twilio', 'toNumbers', idx)} className="p-3 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => addArrayItem('twilio', 'toNumbers')} className="flex items-center gap-2 text-sm text-primary hover:underline">
                          <Plus className="w-4 h-4" /> Add number
                        </button>
                      </div>
                    </>
                  )}

                  {/* SendGrid Form */}
                  {providerDef.id === 'sendgrid' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          API Key
                          <a href={providerDef.docsUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary text-xs hover:underline inline-flex items-center gap-1">
                            Get key <ExternalLink className="w-3 h-3" />
                          </a>
                        </label>
                        <div className="relative">
                          <input
                            type={showSecrets.sendgrid ? 'text' : 'password'}
                            placeholder="SG.xxxxx..."
                            value={form.apiKey}
                            onChange={(e) => updateForm('sendgrid', 'apiKey', e.target.value)}
                            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary pr-12"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecrets(prev => ({ ...prev, sendgrid: !prev.sendgrid }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                          >
                            {showSecrets.sendgrid ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">From Email</label>
                        <input
                          type="email"
                          placeholder="alerts@yourcompany.com"
                          value={form.fromEmail}
                          onChange={(e) => updateForm('sendgrid', 'fromEmail', e.target.value)}
                          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">To Emails</label>
                        {form.toEmails.map((email: string, idx: number) => (
                          <div key={idx} className="flex gap-2 mb-2">
                            <input
                              type="email"
                              placeholder="admin@company.com"
                              value={email}
                              onChange={(e) => updateArrayItem('sendgrid', 'toEmails', idx, e.target.value)}
                              className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            {form.toEmails.length > 1 && (
                              <button onClick={() => removeArrayItem('sendgrid', 'toEmails', idx)} className="p-3 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => addArrayItem('sendgrid', 'toEmails')} className="flex items-center gap-2 text-sm text-primary hover:underline">
                          <Plus className="w-4 h-4" /> Add email
                        </button>
                      </div>
                    </>
                  )}

                  {/* Slack Form */}
                  {providerDef.id === 'slack' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Webhook URL
                          <a href={providerDef.docsUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary text-xs hover:underline inline-flex items-center gap-1">
                            Create webhook <ExternalLink className="w-3 h-3" />
                          </a>
                        </label>
                        <input
                          type="url"
                          placeholder="https://hooks.slack.com/services/..."
                          value={form.webhookUrl}
                          onChange={(e) => updateForm('slack', 'webhookUrl', e.target.value)}
                          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Channel (optional)</label>
                        <input
                          type="text"
                          placeholder="#alerts"
                          value={form.channel || ''}
                          onChange={(e) => updateForm('slack', 'channel', e.target.value)}
                          className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                      </div>
                    </>
                  )}

                  {/* Discord Form */}
                  {providerDef.id === 'discord' && (
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        Webhook URL
                        <a href={providerDef.docsUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary text-xs hover:underline inline-flex items-center gap-1">
                          Create webhook <ExternalLink className="w-3 h-3" />
                        </a>
                      </label>
                      <input
                        type="url"
                        placeholder="https://discord.com/api/webhooks/..."
                        value={form.webhookUrl}
                        onChange={(e) => updateForm('discord', 'webhookUrl', e.target.value)}
                        className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <p className="text-xs text-muted mt-2">
                        <Info className="w-3 h-3 inline mr-1" />
                        Server Settings → Integrations → Webhooks → New Webhook
                      </p>
                    </div>
                  )}

                  {/* Telegram Form */}
                  {providerDef.id === 'telegram' && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">
                          Bot Token
                          <a href={providerDef.docsUrl} target="_blank" rel="noopener noreferrer" className="ml-2 text-primary text-xs hover:underline inline-flex items-center gap-1">
                            Create bot <ExternalLink className="w-3 h-3" />
                          </a>
                        </label>
                        <div className="relative">
                          <input
                            type={showSecrets.telegram ? 'text' : 'password'}
                            placeholder="123456789:ABCdefGHIjkl..."
                            value={form.botToken}
                            onChange={(e) => updateForm('telegram', 'botToken', e.target.value)}
                            className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary pr-12"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSecrets(prev => ({ ...prev, telegram: !prev.telegram }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                          >
                            {showSecrets.telegram ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                        <p className="text-xs text-muted mt-2">
                          <Info className="w-3 h-3 inline mr-1" />
                          Message @BotFather on Telegram to create a bot
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-foreground mb-2">Chat IDs</label>
                        {form.chatIds.map((chatId: string, idx: number) => (
                          <div key={idx} className="flex gap-2 mb-2">
                            <input
                              type="text"
                              placeholder="-1001234567890"
                              value={chatId}
                              onChange={(e) => updateArrayItem('telegram', 'chatIds', idx, e.target.value)}
                              className="flex-1 bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder-muted focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                            {form.chatIds.length > 1 && (
                              <button onClick={() => removeArrayItem('telegram', 'chatIds', idx)} className="p-3 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button onClick={() => addArrayItem('telegram', 'chatIds')} className="flex items-center gap-2 text-sm text-primary hover:underline">
                          <Plus className="w-4 h-4" /> Add chat ID
                        </button>
                        <p className="text-xs text-muted mt-2">
                          Add your bot to a group, then use @userinfobot to get the chat ID
                        </p>
                      </div>
                    </>
                  )}

                  {/* Enable Toggle */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => updateForm(providerDef.id, 'enabled', !form.enabled)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${form.enabled ? 'bg-green-500' : 'bg-surface border border-border'}`}
                    >
                      <span className={`absolute w-5 h-5 bg-white rounded-full top-0.5 transition-all ${form.enabled ? 'left-6' : 'left-0.5'}`} />
                    </button>
                    <span className="text-sm text-foreground">
                      {form.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      onClick={() => configureProvider(providerDef.id)}
                      disabled={saving === providerDef.id}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-dark transition-colors disabled:opacity-50"
                    >
                      {saving === providerDef.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Configuration
                    </button>
                    <button
                      onClick={() => testProvider(providerDef.id)}
                      disabled={testing === providerDef.id}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-surface border border-border text-foreground rounded-xl hover:bg-surface-hover transition-colors disabled:opacity-50"
                    >
                      {testing === providerDef.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      Test
                    </button>
                    {isConfigured && (
                      <button
                        onClick={() => deleteProvider(providerDef.id)}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500/30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
