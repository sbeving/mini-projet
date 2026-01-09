'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getStoredToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Threat {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'investigating' | 'mitigated' | 'resolved' | 'false_positive';
  title: string;
  description: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  indicators?: string[];
  mitreAttack?: { technique: string; tactic: string; description?: string };
  affectedAssets?: string[];
  relatedLogs?: string[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const THREAT_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'malware', label: 'Malware' },
  { value: 'intrusion', label: 'Intrusion' },
  { value: 'data_exfiltration', label: 'Data Exfiltration' },
  { value: 'brute_force', label: 'Brute Force' },
  { value: 'privilege_escalation', label: 'Privilege Escalation' },
  { value: 'lateral_movement', label: 'Lateral Movement' },
  { value: 'command_control', label: 'C2 Communication' },
  { value: 'anomaly', label: 'Anomaly' },
];

const SEVERITY_LEVELS = [
  { value: '', label: 'All Severities' },
  { value: 'critical', label: 'Critical', color: 'text-red-500' },
  { value: 'high', label: 'High', color: 'text-orange-500' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-500' },
  { value: 'low', label: 'Low', color: 'text-blue-500' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active', color: 'text-red-400' },
  { value: 'investigating', label: 'Investigating', color: 'text-yellow-400' },
  { value: 'mitigated', label: 'Mitigated', color: 'text-blue-400' },
  { value: 'resolved', label: 'Resolved', color: 'text-green-400' },
  { value: 'false_positive', label: 'False Positive', color: 'text-gray-400' },
];

export default function ThreatsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [threats, setThreats] = useState<Threat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedThreat, setSelectedThreat] = useState<Threat | null>(null);
  
  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'severity'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchThreats = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (typeFilter) params.append('type', typeFilter);
      if (severityFilter) params.append('severity', severityFilter);
      if (statusFilter) params.append('status', statusFilter);
      
      const url = `${API_BASE}/api/siem/threats?${params.toString()}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Failed to fetch threats');
      
      const result = await response.json();
      if (result.success) {
        setThreats(result.data || []);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, severityFilter, statusFilter]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    fetchThreats();
  }, [authLoading, user, router, fetchThreats]);

  const updateThreatStatus = async (threatId: string, newStatus: string) => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/siem/threats/${threatId}/status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (response.ok) {
        fetchThreats();
        if (selectedThreat?.id === threatId) {
          setSelectedThreat(prev => prev ? { ...prev, status: newStatus as Threat['status'] } : null);
        }
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const startInvestigation = async (threatId: string) => {
    router.push(`/security/investigate?threat=${threatId}`);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500 bg-red-500/10 border-red-500/30';
      case 'high': return 'text-orange-500 bg-orange-500/10 border-orange-500/30';
      case 'medium': return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/30';
      case 'low': return 'text-blue-500 bg-blue-500/10 border-blue-500/30';
      default: return 'text-gray-500 bg-gray-500/10 border-gray-500/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-red-400 bg-red-400/10';
      case 'investigating': return 'text-yellow-400 bg-yellow-400/10';
      case 'mitigated': return 'text-blue-400 bg-blue-400/10';
      case 'resolved': return 'text-green-400 bg-green-400/10';
      case 'false_positive': return 'text-gray-400 bg-gray-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      default: return '⚪';
    }
  };

  // Filter and sort threats
  const filteredThreats = threats
    .filter(t => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          t.title.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.source.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'severity') {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const diff = severityOrder[b.severity] - severityOrder[a.severity];
        return sortOrder === 'desc' ? diff : -diff;
      }
      const diff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return sortOrder === 'desc' ? diff : -diff;
    });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <Link href="/security" className="hover:text-cyan-400">Security</Link>
              <span>/</span>
              <span className="text-gray-200">Threats</span>
            </div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <span className="text-3xl">🎯</span>
              Threat Detection
            </h1>
          </div>
          <button
            onClick={fetchThreats}
            className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg transition-all"
          >
            🔄 Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <input
                type="text"
                placeholder="Search threats..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 bg-[#1a1a24] border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 bg-[#1a1a24] border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
            >
              {THREAT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-4 py-2 bg-[#1a1a24] border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
            >
              {SEVERITY_LEVELS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-[#1a1a24] border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4 mt-4 text-sm">
            <span className="text-gray-500">Sort by:</span>
            <button
              onClick={() => setSortBy('createdAt')}
              className={`px-3 py-1 rounded ${sortBy === 'createdAt' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Date
            </button>
            <button
              onClick={() => setSortBy('severity')}
              className={`px-3 py-1 rounded ${sortBy === 'severity' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-gray-200'}`}
            >
              Severity
            </button>
            <button
              onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
              className="px-3 py-1 text-gray-400 hover:text-gray-200"
            >
              {sortOrder === 'desc' ? '↓' : '↑'}
            </button>
            <span className="text-gray-600 ml-auto">
              {filteredThreats.length} threats found
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            ⚠️ {error}
          </div>
        )}

        {/* Threats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Threats List */}
          <div className={`${selectedThreat ? 'lg:col-span-1' : 'lg:col-span-3'} space-y-3`}>
            {loading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
              </div>
            ) : filteredThreats.length === 0 ? (
              <div className="text-center py-12 bg-[#12121a] border border-gray-800 rounded-xl">
                <span className="text-5xl mb-4 block">✨</span>
                <p className="text-gray-400">No threats found</p>
                <p className="text-gray-600 text-sm mt-2">Adjust your filters or check back later</p>
              </div>
            ) : (
              filteredThreats.map((threat) => (
                <div
                  key={threat.id}
                  onClick={() => setSelectedThreat(threat)}
                  className={`p-4 bg-[#12121a] border rounded-xl cursor-pointer transition-all hover:bg-[#1a1a24] ${
                    selectedThreat?.id === threat.id 
                      ? 'border-cyan-500/50 ring-1 ring-cyan-500/30' 
                      : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{getSeverityIcon(threat.severity)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`px-2 py-0.5 text-xs rounded border ${getSeverityColor(threat.severity)}`}>
                          {threat.severity.toUpperCase()}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(threat.status)}`}>
                          {threat.status.replace('_', ' ')}
                        </span>
                        <span className="text-xs text-gray-600">{threat.type}</span>
                      </div>
                      <h3 className="font-medium text-gray-200 truncate">{threat.title}</h3>
                      <p className="text-sm text-gray-500 truncate mt-1">{threat.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                        <span>📍 {threat.source}</span>
                        <span>🕐 {new Date(threat.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Threat Detail Panel */}
          {selectedThreat && (
            <div className="lg:col-span-2 bg-[#12121a] border border-gray-800 rounded-xl overflow-hidden sticky top-4">
              <div className={`p-4 border-b border-gray-800 ${getSeverityColor(selectedThreat.severity).replace('text-', 'bg-').replace('500', '500/10')}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{getSeverityIcon(selectedThreat.severity)}</span>
                    <span className={`px-2 py-1 text-sm rounded border ${getSeverityColor(selectedThreat.severity)}`}>
                      {selectedThreat.severity.toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-400">{selectedThreat.type}</span>
                  </div>
                  <button
                    onClick={() => setSelectedThreat(null)}
                    className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 max-h-[calc(100vh-200px)] overflow-y-auto">
                <h2 className="text-xl font-bold mb-2">{selectedThreat.title}</h2>
                <p className="text-gray-400 mb-6">{selectedThreat.description}</p>

                {/* Status Actions */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Status Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.slice(1).map(status => (
                      <button
                        key={status.value}
                        onClick={() => updateThreatStatus(selectedThreat.id, status.value)}
                        className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                          selectedThreat.status === status.value
                            ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                            : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-200'
                        }`}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-3 mb-6">
                  <button
                    onClick={() => startInvestigation(selectedThreat.id)}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 hover:from-cyan-500/30 hover:to-purple-500/30 border border-cyan-500/30 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <span>🔍</span> AI Investigation
                  </button>
                  <Link
                    href={`/security/incidents/new?threat=${selectedThreat.id}`}
                    className="flex-1 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 rounded-lg transition-all flex items-center justify-center gap-2"
                  >
                    <span>🚨</span> Create Incident
                  </Link>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-3 bg-[#1a1a24] rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Source</p>
                    <p className="text-sm font-medium">{selectedThreat.source}</p>
                  </div>
                  <div className="p-3 bg-[#1a1a24] rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Detected At</p>
                    <p className="text-sm font-medium">{new Date(selectedThreat.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-[#1a1a24] rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Last Updated</p>
                    <p className="text-sm font-medium">{new Date(selectedThreat.updatedAt).toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-[#1a1a24] rounded-lg">
                    <p className="text-xs text-gray-500 mb-1">Threat ID</p>
                    <p className="text-sm font-mono">{selectedThreat.id.slice(0, 12)}...</p>
                  </div>
                </div>

                {/* MITRE ATT&CK */}
                {selectedThreat.mitreAttack && (
                  <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                    <h4 className="text-sm font-medium text-purple-400 mb-2 flex items-center gap-2">
                      <span>⚔️</span> MITRE ATT&CK Mapping
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-gray-500">Technique</p>
                        <p className="text-sm font-medium">{selectedThreat.mitreAttack.technique}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Tactic</p>
                        <p className="text-sm font-medium">{selectedThreat.mitreAttack.tactic}</p>
                      </div>
                    </div>
                    {selectedThreat.mitreAttack.description && (
                      <p className="text-sm text-gray-400 mt-2">{selectedThreat.mitreAttack.description}</p>
                    )}
                  </div>
                )}

                {/* Indicators */}
                {selectedThreat.indicators && selectedThreat.indicators.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Indicators of Compromise</h4>
                    <div className="space-y-2">
                      {selectedThreat.indicators.map((ioc, i) => (
                        <div key={i} className="p-2 bg-[#1a1a24] rounded font-mono text-sm text-red-400 break-all">
                          {ioc}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Affected Assets */}
                {selectedThreat.affectedAssets && selectedThreat.affectedAssets.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Affected Assets</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedThreat.affectedAssets.map((asset, i) => (
                        <span key={i} className="px-3 py-1 bg-[#1a1a24] rounded-lg text-sm">
                          🖥️ {asset}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
