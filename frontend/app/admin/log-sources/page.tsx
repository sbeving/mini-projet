'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { 
  Key, Plus, Copy, RefreshCw, Trash2, Activity, ExternalLink, 
  Server, Globe, Wifi, Webhook, Database, Cloud, Shield, 
  Terminal, Code, CheckCircle2, XCircle, Clock, Loader2
} from 'lucide-react';
import Toast from '@/components/Toast';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Source type configuration
const SOURCE_TYPES = [
  { value: 'API', label: 'REST API', icon: Code, description: 'Send logs via HTTP POST requests', color: 'primary' },
  { value: 'WEBHOOK', label: 'Webhook', icon: Webhook, description: 'Receive logs from external webhooks', color: 'purple' },
  { value: 'SYSLOG', label: 'Syslog', icon: Terminal, description: 'Traditional syslog protocol (RFC 5424)', color: 'green' },
  { value: 'AGENT', label: 'Agent', icon: Shield, description: 'LogChat agent for Windows/Linux', color: 'orange' },
  { value: 'CLOUD', label: 'Cloud Service', icon: Cloud, description: 'AWS, Azure, GCP integrations', color: 'blue' },
  { value: 'DATABASE', label: 'Database', icon: Database, description: 'Database audit logs', color: 'yellow' },
] as const;

interface LogSource {
  id: string;
  name: string;
  description: string | null;
  type: string;
  apiKey: string;
  allowedIps: string[];
  allowedDomains?: string[];
  allowedHostnames?: string[];
  webhookUrl: string | null;
  isActive: boolean;
  rateLimit: number;
  rateLimitWindow: number;
  lastUsedAt: string | null;
  createdAt: string;
  logsReceived?: number;
  createdBy: {
    name: string;
    email: string;
  };
}

export default function LogSourcesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [sources, setSources] = useState<LogSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState<LogSource | null>(null);
  const [newSource, setNewSource] = useState({
    name: '',
    description: '',
    type: 'API',
    allowedIps: '',
    allowedDomains: '',
    allowedHostnames: '',
    webhookUrl: '',
    rateLimit: 1000,
    rateLimitWindow: 60,
  });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'ADMIN')) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && user.role === 'ADMIN') {
      fetchSources();
    }
  }, [user]);

  const fetchSources = async () => {
    try {
      setRefreshing(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/log-sources`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources || []);
      }
    } catch (error) {
      console.error('Failed to fetch log sources:', error);
      setToast({ message: 'Failed to fetch log sources', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreate = async () => {
    try {
      const token = localStorage.getItem('token');
      const allowedIps = newSource.allowedIps.split(',').map((ip) => ip.trim()).filter(Boolean);
      const allowedDomains = newSource.allowedDomains.split(',').map((d) => d.trim()).filter(Boolean);
      const allowedHostnames = newSource.allowedHostnames.split(',').map((h) => h.trim()).filter(Boolean);

      const res = await fetch(`${API_URL}/api/log-sources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newSource,
          allowedIps,
          allowedDomains,
          allowedHostnames,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data.apiKey);
        setToast({ message: 'Log source created successfully!', type: 'success' });
        fetchSources();
        setNewSource({
          name: '',
          description: '',
          type: 'API',
          allowedIps: '',
          allowedDomains: '',
          allowedHostnames: '',
          webhookUrl: '',
          rateLimit: 1000,
          rateLimitWindow: 60,
        });
      } else {
        const error = await res.json();
        setToast({ message: error.error || 'Failed to create log source', type: 'error' });
      }
    } catch (error) {
      console.error('Error creating log source:', error);
      setToast({ message: 'Failed to create log source', type: 'error' });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete log source "${name}"? This cannot be undone.`)) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/log-sources/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setToast({ message: 'Log source deleted', type: 'success' });
        fetchSources();
      } else {
        setToast({ message: 'Failed to delete log source', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Failed to delete log source', type: 'error' });
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/api/log-sources/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (res.ok) {
        setToast({ message: `Log source ${!isActive ? 'activated' : 'deactivated'}`, type: 'success' });
        fetchSources();
      } else {
        setToast({ message: 'Failed to update log source', type: 'error' });
      }
    } catch (error) {
      setToast({ message: 'Failed to update log source', type: 'error' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setToast({ message: 'Copied to clipboard!', type: 'success' });
  };

  const getSourceTypeConfig = (type: string) => {
    return SOURCE_TYPES.find(t => t.value === type) || SOURCE_TYPES[0];
  };

  const getColorClass = (color: string) => {
    const colors: Record<string, string> = {
      primary: 'bg-primary/20 text-primary border-primary/30',
      purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      green: 'bg-green-500/20 text-green-400 border-green-500/30',
      orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    };
    return colors[color] || colors.primary;
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center">
            <Key className="h-8 w-8 text-primary" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-muted text-sm">Loading log sources...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <Key className="h-5 w-5 text-primary" />
            </div>
            Log Sources & API Keys
          </h1>
          <p className="text-muted mt-2">Manage API keys, webhooks, and log ingestion sources</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSources}
            disabled={refreshing}
            className="p-2.5 bg-surface border border-border hover:bg-surface-hover rounded-xl text-muted hover:text-foreground transition-colors"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowDocsModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-border hover:bg-surface-hover rounded-xl text-foreground transition"
          >
            <Code className="w-5 h-5" />
            <span className="hidden sm:inline">API Docs</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl hover:bg-primary-dark transition"
          >
            <Plus className="w-5 h-5" />
            Create Source
          </button>
        </div>
      </div>

      {/* Source Types Guide */}
      <div className="bg-surface border border-border rounded-2xl p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">Supported Source Types</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {SOURCE_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <div key={type.value} className={`p-3 rounded-xl border ${getColorClass(type.color)} text-center`}>
                <Icon className="w-6 h-6 mx-auto mb-2" />
                <p className="text-sm font-medium">{type.label}</p>
                <p className="text-xs opacity-80 mt-1">{type.description}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Log Sources Grid */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">Active Sources ({sources.length})</h3>
        <div className="grid gap-4">
          {sources.map((source) => {
            const typeConfig = getSourceTypeConfig(source.type);
            const TypeIcon = typeConfig.icon;
            return (
              <div
                key={source.id}
                className="bg-surface border border-border rounded-2xl p-6 hover:border-primary/30 transition"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getColorClass(typeConfig.color)}`}>
                      <TypeIcon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{source.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-2 py-0.5 text-xs rounded-full border ${getColorClass(typeConfig.color)}`}>
                          {typeConfig.label}
                        </span>
                        <span className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded-full ${
                          source.isActive
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-gray-500/20 text-gray-400'
                        }`}>
                          {source.isActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {source.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      {source.description && (
                        <p className="text-muted text-sm mt-2">{source.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted mt-2">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(source.createdAt).toLocaleDateString()}
                        </span>
                        {source.lastUsedAt && (
                          <span>Last used {new Date(source.lastUsedAt).toLocaleDateString()}</span>
                        )}
                        <span>by {source.createdBy.name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setSelectedSource(source); setShowDocsModal(true); }}
                      className="p-2 hover:bg-surface-hover rounded-lg transition text-muted hover:text-foreground"
                      title="View Integration Docs"
                    >
                      <Code className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(source.id, source.isActive)}
                      className="p-2 hover:bg-surface-hover rounded-lg transition"
                      title={source.isActive ? 'Deactivate' : 'Activate'}
                    >
                      <Activity className={`w-5 h-5 ${source.isActive ? 'text-green-400' : 'text-gray-400'}`} />
                    </button>
                    <button
                      onClick={() => handleDelete(source.id, source.name)}
                      className="p-2 hover:bg-red-500/10 rounded-lg transition text-red-400"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* API Key */}
                  <div className="bg-background rounded-xl p-3">
                    <div className="flex justify-between items-center">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-muted mb-1">API Key</div>
                        <code className="text-sm text-foreground font-mono truncate block">{source.apiKey}</code>
                      </div>
                      <button
                        onClick={() => copyToClipboard(source.apiKey)}
                        className="ml-3 p-2 hover:bg-surface-hover rounded-lg transition flex-shrink-0"
                        title="Copy API key"
                      >
                        <Copy className="w-4 h-4 text-primary" />
                      </button>
                    </div>
                  </div>

                  {/* Rate Limits */}
                  <div className="bg-background rounded-xl p-3">
                    <div className="text-xs text-muted mb-1">Rate Limit</div>
                    <div className="text-foreground font-semibold">
                      {source.rateLimit.toLocaleString()} requests / {source.rateLimitWindow}s
                    </div>
                  </div>
                </div>

                {/* Access Restrictions */}
                {source.allowedIps.length > 0 && (
                  <div className="mt-3 p-3 bg-background rounded-xl">
                    <div className="text-xs text-muted mb-2">Access Restrictions</div>
                    <div className="flex flex-wrap gap-2">
                      {source.allowedIps.map((ip, idx) => (
                        <span key={`ip-${idx}`} className="flex items-center gap-1 px-2 py-1 bg-surface rounded text-xs font-mono text-foreground">
                          <Server className="w-3 h-3 text-blue-400" /> {ip}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {source.webhookUrl && (
                  <div className="mt-3 p-3 bg-background rounded-xl">
                    <div className="text-xs text-muted mb-1">Webhook URL</div>
                    <a
                      href={source.webhookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline flex items-center gap-1 text-sm"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {source.webhookUrl}
                    </a>
                  </div>
                )}
              </div>
            );
          })}

          {sources.length === 0 && (
            <div className="text-center py-12 text-muted">
              <Key className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p className="text-lg">No log sources yet</p>
              <p className="text-sm mt-2">Create your first log source to start ingesting logs</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-foreground mb-4">Create Log Source</h2>

            {createdKey ? (
              <div className="space-y-4">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <p className="text-yellow-400 font-semibold mb-2">⚠️ Save this API key securely!</p>
                  <p className="text-muted text-sm">
                    This is the only time you'll see the full API key. Store it in a secure location.
                  </p>
                </div>

                <div className="bg-background rounded-lg p-4">
                  <div className="text-sm text-muted mb-2">API Key</div>
                  <code className="block bg-surface border border-border rounded p-3 text-foreground font-mono text-sm break-all">
                    {createdKey}
                  </code>
                  <button
                    onClick={() => copyToClipboard(createdKey)}
                    className="mt-3 flex items-center gap-2 text-primary hover:underline"
                  >
                    <Copy className="w-4 h-4" />
                    Copy to clipboard
                  </button>
                </div>

                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreatedKey(null);
                  }}
                  className="w-full bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Name *</label>
                  <input
                    type="text"
                    value={newSource.name}
                    onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground"
                    placeholder="Production API"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Description</label>
                  <textarea
                    value={newSource.description}
                    onChange={(e) => setNewSource({ ...newSource, description: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground"
                    rows={2}
                    placeholder="Main production log source..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">Type</label>
                  <select
                    value={newSource.type}
                    onChange={(e) => setNewSource({ ...newSource, type: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground"
                  >
                    <option value="API">API</option>
                    <option value="WEBHOOK">Webhook</option>
                    <option value="SYSLOG">Syslog</option>
                    <option value="AGENT">Agent</option>
                    <option value="CLOUD">Cloud</option>
                    <option value="DATABASE">Database</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Allowed IPs (comma-separated, leave empty for all)
                  </label>
                  <input
                    type="text"
                    value={newSource.allowedIps}
                    onChange={(e) => setNewSource({ ...newSource, allowedIps: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground"
                    placeholder="192.168.1.0/24, 10.0.0.1"
                  />
                  <p className="text-xs text-muted mt-1">CIDR notation supported</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Allowed Domains (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newSource.allowedDomains}
                    onChange={(e) => setNewSource({ ...newSource, allowedDomains: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground"
                    placeholder="*.example.com, api.myapp.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Allowed Hostnames (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={newSource.allowedHostnames}
                    onChange={(e) => setNewSource({ ...newSource, allowedHostnames: e.target.value })}
                    className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground"
                    placeholder="server-01, prod-api-*"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Rate Limit</label>
                    <input
                      type="number"
                      value={newSource.rateLimit}
                      onChange={(e) => setNewSource({ ...newSource, rateLimit: Number(e.target.value) })}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">Window (seconds)</label>
                    <input
                      type="number"
                      value={newSource.rateLimitWindow}
                      onChange={(e) => setNewSource({ ...newSource, rateLimitWindow: Number(e.target.value) })}
                      className="w-full bg-background border border-border rounded-lg px-4 py-2 text-foreground"
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleCreate}
                    disabled={!newSource.name}
                    className="flex-1 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition disabled:opacity-50"
                  >
                    Create Log Source
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewSource({
                        name: '',
                        description: '',
                        type: 'API',
                        allowedIps: '',
                        allowedDomains: '',
                        allowedHostnames: '',
                        webhookUrl: '',
                        rateLimit: 1000,
                        rateLimitWindow: 60,
                      });
                    }}
                    className="px-4 py-2 border border-border rounded-lg hover:bg-surface-hover transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* API Documentation Modal */}
      {showDocsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-border">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-foreground">
                  {selectedSource ? `Integration: ${selectedSource.name}` : 'API Documentation'}
                </h2>
                <button
                  onClick={() => { setShowDocsModal(false); setSelectedSource(null); }}
                  className="p-2 hover:bg-surface-hover rounded-lg transition text-muted"
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Quick Start */}
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-3">Quick Start</h3>
                <p className="text-muted text-sm mb-4">
                  Send logs to LogChat using HTTP POST requests with your API key.
                </p>
              </div>

              {/* API Endpoint */}
              <div className="bg-background rounded-xl p-4">
                <div className="text-xs text-muted mb-2">Endpoint</div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-sm text-primary font-mono">
                    POST {API_URL}/api/logs/ingest
                  </code>
                  <button
                    onClick={() => copyToClipboard(`${API_URL}/api/logs/ingest`)}
                    className="p-2 hover:bg-surface-hover rounded-lg transition"
                  >
                    <Copy className="w-4 h-4 text-primary" />
                  </button>
                </div>
              </div>

              {/* Headers */}
              <div>
                <h4 className="font-medium text-foreground mb-2">Required Headers</h4>
                <div className="bg-background rounded-xl p-4 font-mono text-sm">
                  <div className="text-muted">Content-Type: <span className="text-foreground">application/json</span></div>
                  <div className="text-muted">X-API-Key: <span className="text-primary">{selectedSource?.apiKey || 'YOUR_API_KEY'}</span></div>
                </div>
              </div>

              {/* Example cURL */}
              <div>
                <h4 className="font-medium text-foreground mb-2">cURL Example</h4>
                <div className="bg-background rounded-xl p-4 relative">
                  <pre className="text-sm text-foreground font-mono whitespace-pre-wrap overflow-x-auto">
{`curl -X POST ${API_URL}/api/logs/ingest \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${selectedSource?.apiKey || 'YOUR_API_KEY'}" \\
  -d '{
    "level": "info",
    "service": "my-app",
    "message": "User logged in successfully",
    "meta": {
      "userId": "12345",
      "ip": "192.168.1.100"
    }
  }'`}
                  </pre>
                  <button
                    onClick={() => copyToClipboard(`curl -X POST ${API_URL}/api/logs/ingest -H "Content-Type: application/json" -H "X-API-Key: ${selectedSource?.apiKey || 'YOUR_API_KEY'}" -d '{"level": "info", "service": "my-app", "message": "User logged in"}'`)}
                    className="absolute top-3 right-3 p-2 hover:bg-surface-hover rounded-lg transition"
                  >
                    <Copy className="w-4 h-4 text-primary" />
                  </button>
                </div>
              </div>

              {/* Python Example */}
              <div>
                <h4 className="font-medium text-foreground mb-2">Python Example</h4>
                <div className="bg-background rounded-xl p-4 relative">
                  <pre className="text-sm text-foreground font-mono whitespace-pre-wrap overflow-x-auto">
{`import requests

response = requests.post(
    "${API_URL}/api/logs/ingest",
    headers={
        "Content-Type": "application/json",
        "X-API-Key": "${selectedSource?.apiKey || 'YOUR_API_KEY'}"
    },
    json={
        "level": "error",
        "service": "payment-service",
        "message": "Payment failed",
        "meta": {"orderId": "ORD-123", "amount": 99.99}
    }
)
print(response.json())`}
                  </pre>
                </div>
              </div>

              {/* Log Levels */}
              <div>
                <h4 className="font-medium text-foreground mb-2">Log Levels</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {['debug', 'info', 'warning', 'error', 'critical'].map((level) => (
                    <div key={level} className={`px-3 py-2 rounded-lg text-center text-sm ${
                      level === 'debug' ? 'bg-gray-500/20 text-gray-400' :
                      level === 'info' ? 'bg-blue-500/20 text-blue-400' :
                      level === 'warning' ? 'bg-yellow-500/20 text-yellow-400' :
                      level === 'error' ? 'bg-orange-500/20 text-orange-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      {level}
                    </div>
                  ))}
                </div>
              </div>

              {/* Batch Ingestion */}
              <div>
                <h4 className="font-medium text-foreground mb-2">Batch Ingestion</h4>
                <p className="text-muted text-sm mb-3">
                  Send multiple logs in a single request for better performance.
                </p>
                <div className="bg-background rounded-xl p-4">
                  <pre className="text-sm text-foreground font-mono whitespace-pre-wrap">
{`POST ${API_URL}/api/logs/ingest/batch

{
  "logs": [
    {"level": "info", "service": "api", "message": "Request started"},
    {"level": "info", "service": "api", "message": "Request completed"}
  ]
}`}
                  </pre>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border">
              <button
                onClick={() => { setShowDocsModal(false); setSelectedSource(null); }}
                className="w-full bg-primary text-white py-2.5 rounded-xl hover:bg-primary-dark transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      )}
    </div>
  );
}
