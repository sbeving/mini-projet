'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import { Key, Plus, Copy, RefreshCw, Trash2, Settings, Activity, ExternalLink } from 'lucide-react';
import Toast from '@/components/Toast';

interface LogSource {
  id: string;
  name: string;
  description: string | null;
  type: string;
  apiKey: string;
  allowedIps: string[];
  webhookUrl: string | null;
  isActive: boolean;
  rateLimit: number;
  rateLimitWindow: number;
  lastUsedAt: string | null;
  createdAt: string;
  createdBy: {
    name: string;
    email: string;
  };
}

export default function LogSourcesPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [sources, setSources] = useState<LogSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSource, setNewSource] = useState({
    name: '',
    description: '',
    type: 'API',
    allowedIps: '',
    webhookUrl: '',
    rateLimit: 1000,
    rateLimitWindow: 60,
  });
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

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
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/log-sources', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSources(data.sources);
      }
    } catch (error) {
      console.error('Failed to fetch log sources:', error);
      setToast({ message: 'Failed to fetch log sources', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const token = localStorage.getItem('token');
      const allowedIps = newSource.allowedIps
        .split(',')
        .map((ip) => ip.trim())
        .filter(Boolean);

      const res = await fetch('http://localhost:3001/api/log-sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...newSource,
          allowedIps,
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
      const res = await fetch(`http://localhost:3001/api/log-sources/${id}`, {
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
      const res = await fetch(`http://localhost:3001/api/log-sources/${id}`, {
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="flex items-center justify-center h-[80vh]">
          <div className="text-muted">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Key className="w-8 h-8 text-primary" />
              Log Sources & API Keys
            </h1>
            <p className="text-muted mt-1">Manage API keys, webhooks, and log ingestion sources</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-dark transition"
          >
            <Plus className="w-5 h-5" />
            Create Log Source
          </button>
        </div>

        {/* Log Sources Grid */}
        <div className="grid gap-4">
          {sources.map((source) => (
            <div
              key={source.id}
              className="bg-surface border border-border rounded-xl p-6 hover:border-primary/50 transition"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold text-foreground">{source.name}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        source.isActive
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-gray-500/20 text-gray-400'
                      }`}
                    >
                      {source.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="px-2 py-1 text-xs rounded-full bg-primary/20 text-primary">
                      {source.type}
                    </span>
                  </div>
                  {source.description && (
                    <p className="text-muted text-sm mb-3">{source.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-sm text-muted">
                    <span>Created by {source.createdBy.name}</span>
                    <span>•</span>
                    <span>{new Date(source.createdAt).toLocaleDateString()}</span>
                    {source.lastUsedAt && (
                      <>
                        <span>•</span>
                        <span>Last used {new Date(source.lastUsedAt).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
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

              <div className="space-y-3">
                {/* API Key */}
                <div className="bg-background/50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <div className="flex-1">
                      <div className="text-xs text-muted mb-1">API Key</div>
                      <code className="text-sm text-foreground font-mono">{source.apiKey}</code>
                    </div>
                    <button
                      onClick={() => copyToClipboard(source.apiKey)}
                      className="ml-4 p-2 hover:bg-surface-hover rounded-lg transition"
                      title="Copy API key"
                    >
                      <Copy className="w-4 h-4 text-primary" />
                    </button>
                  </div>
                </div>

                {/* IP Whitelist */}
                {source.allowedIps.length > 0 && (
                  <div className="bg-background/50 rounded-lg p-3">
                    <div className="text-xs text-muted mb-1">Allowed IPs</div>
                    <div className="flex flex-wrap gap-2">
                      {source.allowedIps.map((ip, idx) => (
                        <span key={idx} className="px-2 py-1 bg-surface rounded text-xs font-mono text-foreground">
                          {ip}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rate Limits */}
                <div className="flex gap-4 text-sm">
                  <div className="flex-1 bg-background/50 rounded-lg p-3">
                    <div className="text-xs text-muted mb-1">Rate Limit</div>
                    <div className="text-foreground font-semibold">
                      {source.rateLimit} requests / {source.rateLimitWindow}s
                    </div>
                  </div>
                  {source.webhookUrl && (
                    <div className="flex-1 bg-background/50 rounded-lg p-3">
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
              </div>
            </div>
          ))}

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
