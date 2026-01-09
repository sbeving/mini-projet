'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getStoredToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface ThreatStats {
  total: number;
  bySeverity: { critical: number; high: number; medium: number; low: number };
  byStatus: { active: number; investigating: number; mitigated: number; resolved: number };
  recentCount: number;
}

interface IncidentStats {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
}

interface AlertStats {
  totalRules: number;
  enabledRules: number;
  recentAlerts: number;
}

interface CorrelationStats {
  totalRules: number;
  correlatedEvents: number;
}

interface DashboardData {
  threats: ThreatStats;
  incidents: IncidentStats;
  alerts: AlertStats;
  correlations: CorrelationStats;
  recentThreats: Threat[];
  recentIncidents: Incident[];
}

interface Threat {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: string;
  title: string;
  description: string;
  createdAt: string;
  source: string;
  mitreAttack?: { technique: string; tactic: string };
}

interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  createdAt: string;
  assignee?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function SecurityDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchDashboard = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/siem/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Failed to fetch dashboard');
      
      const result = await response.json();
      if (result.success) {
        setData(result.data);
        setLastUpdate(new Date());
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    fetchDashboard();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [authLoading, user, router, fetchDashboard]);

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
      case 'active': case 'open': return 'text-red-400';
      case 'investigating': case 'in_progress': return 'text-yellow-400';
      case 'mitigated': case 'resolved': case 'closed': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl">🛡️</span>
              </div>
            </div>
            <p className="text-gray-400 animate-pulse">Loading Security Dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <span className="text-4xl">🛡️</span>
              Security Operations Center
            </h1>
            <p className="text-gray-400 mt-1">
              Real-time threat monitoring and incident response
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-sm">
              <p className="text-gray-500">Last updated</p>
              <p className="text-gray-300">{lastUpdate?.toLocaleTimeString()}</p>
            </div>
            <button
              onClick={fetchDashboard}
              className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg transition-all flex items-center gap-2"
            >
              <span className="animate-spin-slow">🔄</span>
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            ⚠️ {error}
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Active Threats */}
          <Link href="/security/threats" className="group">
            <div className="bg-[#12121a] border border-red-500/20 rounded-xl p-6 hover:border-red-500/50 transition-all hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">🎯</span>
                <span className={`text-sm px-2 py-1 rounded ${
                  (data?.threats.bySeverity.critical || 0) > 0 
                    ? 'bg-red-500/20 text-red-400 animate-pulse' 
                    : 'bg-gray-500/20 text-gray-400'
                }`}>
                  {data?.threats.bySeverity.critical || 0} Critical
                </span>
              </div>
              <p className="text-4xl font-bold text-red-400">{data?.threats.byStatus.active || 0}</p>
              <p className="text-gray-400 text-sm mt-1">Active Threats</p>
              <div className="mt-4 flex gap-2 text-xs">
                <span className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded">
                  {data?.threats.bySeverity.high || 0} High
                </span>
                <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded">
                  {data?.threats.bySeverity.medium || 0} Med
                </span>
              </div>
            </div>
          </Link>

          {/* Open Incidents */}
          <Link href="/security/incidents" className="group">
            <div className="bg-[#12121a] border border-orange-500/20 rounded-xl p-6 hover:border-orange-500/50 transition-all hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">🚨</span>
                <span className="text-sm px-2 py-1 rounded bg-orange-500/20 text-orange-400">
                  {data?.incidents.inProgress || 0} In Progress
                </span>
              </div>
              <p className="text-4xl font-bold text-orange-400">{data?.incidents.open || 0}</p>
              <p className="text-gray-400 text-sm mt-1">Open Incidents</p>
              <div className="mt-4 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-orange-500 to-yellow-500 transition-all"
                  style={{ 
                    width: `${data?.incidents.total 
                      ? ((data.incidents.resolved / data.incidents.total) * 100) 
                      : 0}%` 
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {data?.incidents.resolved || 0} / {data?.incidents.total || 0} resolved
              </p>
            </div>
          </Link>

          {/* Alert Rules */}
          <Link href="/security/alerts" className="group">
            <div className="bg-[#12121a] border border-cyan-500/20 rounded-xl p-6 hover:border-cyan-500/50 transition-all hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">📋</span>
                <span className="text-sm px-2 py-1 rounded bg-cyan-500/20 text-cyan-400">
                  {data?.alerts.enabledRules || 0} Active
                </span>
              </div>
              <p className="text-4xl font-bold text-cyan-400">{data?.alerts.totalRules || 0}</p>
              <p className="text-gray-400 text-sm mt-1">Alert Rules</p>
              <div className="mt-4 text-xs">
                <span className="text-yellow-400">
                  ⚡ {data?.alerts.recentAlerts || 0} alerts (24h)
                </span>
              </div>
            </div>
          </Link>

          {/* Correlations */}
          <Link href="/security/correlations" className="group">
            <div className="bg-[#12121a] border border-purple-500/20 rounded-xl p-6 hover:border-purple-500/50 transition-all hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">🔗</span>
                <span className="text-sm px-2 py-1 rounded bg-purple-500/20 text-purple-400">
                  AI Powered
                </span>
              </div>
              <p className="text-4xl font-bold text-purple-400">{data?.correlations.correlatedEvents || 0}</p>
              <p className="text-gray-400 text-sm mt-1">Correlated Events</p>
              <div className="mt-4 text-xs text-purple-300">
                📊 {data?.correlations.totalRules || 0} correlation rules
              </div>
            </div>
          </Link>
        </div>

        {/* Threat Severity Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Severity Breakdown */}
          <div className="bg-[#12121a] border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>📊</span> Threat Severity Distribution
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Critical', value: data?.threats.bySeverity.critical || 0, color: 'bg-red-500' },
                { label: 'High', value: data?.threats.bySeverity.high || 0, color: 'bg-orange-500' },
                { label: 'Medium', value: data?.threats.bySeverity.medium || 0, color: 'bg-yellow-500' },
                { label: 'Low', value: data?.threats.bySeverity.low || 0, color: 'bg-blue-500' },
              ].map((item) => {
                const total = data?.threats.total || 1;
                const percentage = (item.value / total) * 100;
                return (
                  <div key={item.label} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">{item.label}</span>
                      <span className="text-white font-medium">{item.value}</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${item.color} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Threats */}
          <div className="lg:col-span-2 bg-[#12121a] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <span>🎯</span> Recent Threats
              </h3>
              <Link href="/security/threats" className="text-sm text-cyan-400 hover:text-cyan-300">
                View All →
              </Link>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
              {data?.recentThreats?.length ? (
                data.recentThreats.map((threat) => (
                  <Link
                    key={threat.id}
                    href={`/security/threats/${threat.id}`}
                    className="block p-4 bg-[#1a1a24] hover:bg-[#22222e] rounded-lg border border-gray-700/50 hover:border-gray-600 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs rounded border ${getSeverityColor(threat.severity)}`}>
                            {threat.severity.toUpperCase()}
                          </span>
                          <span className="text-xs text-gray-500">{threat.type}</span>
                        </div>
                        <h4 className="font-medium text-gray-200 line-clamp-1">{threat.title}</h4>
                        <p className="text-sm text-gray-500 line-clamp-1 mt-1">{threat.description}</p>
                      </div>
                      <div className="text-right text-xs text-gray-500 ml-4">
                        <p>{new Date(threat.createdAt).toLocaleDateString()}</p>
                        <p className={getStatusColor(threat.status)}>{threat.status}</p>
                      </div>
                    </div>
                    {threat.mitreAttack && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded">
                          MITRE: {threat.mitreAttack.technique}
                        </span>
                        <span className="text-gray-600">{threat.mitreAttack.tactic}</span>
                      </div>
                    )}
                  </Link>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <span className="text-4xl mb-2 block">✨</span>
                  No recent threats detected
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions & Recent Incidents */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions */}
          <div className="bg-[#12121a] border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span>⚡</span> Quick Actions
            </h3>
            <div className="space-y-3">
              <Link
                href="/security/investigate"
                className="flex items-center gap-3 p-3 bg-gradient-to-r from-cyan-500/10 to-purple-500/10 hover:from-cyan-500/20 hover:to-purple-500/20 border border-cyan-500/30 rounded-lg transition-all group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">🔍</span>
                <div>
                  <p className="font-medium">AI Investigation</p>
                  <p className="text-xs text-gray-400">Start new AI-powered investigation</p>
                </div>
              </Link>
              <Link
                href="/security/alerts/new"
                className="flex items-center gap-3 p-3 bg-[#1a1a24] hover:bg-[#22222e] border border-gray-700 rounded-lg transition-all group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">➕</span>
                <div>
                  <p className="font-medium">Create Alert Rule</p>
                  <p className="text-xs text-gray-400">Define new detection rules</p>
                </div>
              </Link>
              <Link
                href="/security/playbooks"
                className="flex items-center gap-3 p-3 bg-[#1a1a24] hover:bg-[#22222e] border border-gray-700 rounded-lg transition-all group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">📚</span>
                <div>
                  <p className="font-medium">Response Playbooks</p>
                  <p className="text-xs text-gray-400">Automated incident response</p>
                </div>
              </Link>
              <Link
                href="/security/iocs"
                className="flex items-center gap-3 p-3 bg-[#1a1a24] hover:bg-[#22222e] border border-gray-700 rounded-lg transition-all group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">🔴</span>
                <div>
                  <p className="font-medium">IOC Management</p>
                  <p className="text-xs text-gray-400">Indicators of Compromise</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Incidents */}
          <div className="lg:col-span-2 bg-[#12121a] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <span>🚨</span> Recent Incidents
              </h3>
              <Link href="/security/incidents" className="text-sm text-cyan-400 hover:text-cyan-300">
                View All →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-700">
                    <th className="pb-2 font-medium">ID</th>
                    <th className="pb-2 font-medium">Title</th>
                    <th className="pb-2 font-medium">Severity</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {data?.recentIncidents?.length ? (
                    data.recentIncidents.map((incident) => (
                      <tr key={incident.id} className="hover:bg-[#1a1a24] transition-colors">
                        <td className="py-3 font-mono text-xs text-gray-400">
                          {incident.id.slice(0, 8)}
                        </td>
                        <td className="py-3">
                          <Link 
                            href={`/security/incidents/${incident.id}`}
                            className="text-gray-200 hover:text-cyan-400 transition-colors"
                          >
                            {incident.title}
                          </Link>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 text-xs rounded border ${getSeverityColor(incident.severity)}`}>
                            {incident.severity}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`text-sm ${getStatusColor(incident.status)}`}>
                            {incident.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 text-sm text-gray-500">
                          {new Date(incident.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-gray-500">
                        <span className="text-4xl mb-2 block">📋</span>
                        No recent incidents
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* AI-Powered SIEM Features */}
        <div className="mt-8">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <span>🤖</span> AI-Powered Security Intelligence
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Threat Intelligence */}
            <Link href="/security/threat-intel" className="group">
              <div className="bg-gradient-to-br from-[#12121a] to-[#1a1a28] border border-purple-500/20 rounded-xl p-6 hover:border-purple-500/50 transition-all hover:scale-[1.02] h-full">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">🌐</span>
                  <div>
                    <h4 className="font-semibold text-white">Threat Intelligence</h4>
                    <p className="text-xs text-gray-500">IOC enrichment & feeds</p>
                  </div>
                </div>
                <p className="text-sm text-gray-400">
                  Real-time threat feeds, IOC enrichment, and global threat landscape monitoring.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-purple-400">
                  <span className="px-2 py-1 bg-purple-500/10 rounded">10+ Feeds</span>
                  <span className="px-2 py-1 bg-purple-500/10 rounded">Auto-enrichment</span>
                </div>
              </div>
            </Link>

            {/* SOAR */}
            <Link href="/security/soar" className="group">
              <div className="bg-gradient-to-br from-[#12121a] to-[#1a2820] border border-green-500/20 rounded-xl p-6 hover:border-green-500/50 transition-all hover:scale-[1.02] h-full">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">⚡</span>
                  <div>
                    <h4 className="font-semibold text-white">SOAR Engine</h4>
                    <p className="text-xs text-gray-500">Automated response</p>
                  </div>
                </div>
                <p className="text-sm text-gray-400">
                  Security orchestration with automated playbooks and response actions.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-green-400">
                  <span className="px-2 py-1 bg-green-500/10 rounded">Playbooks</span>
                  <span className="px-2 py-1 bg-green-500/10 rounded">Auto-remediate</span>
                </div>
              </div>
            </Link>

            {/* UEBA */}
            <Link href="/security/ueba" className="group">
              <div className="bg-gradient-to-br from-[#12121a] to-[#281a1a] border border-orange-500/20 rounded-xl p-6 hover:border-orange-500/50 transition-all hover:scale-[1.02] h-full">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">👤</span>
                  <div>
                    <h4 className="font-semibold text-white">UEBA</h4>
                    <p className="text-xs text-gray-500">Behavioral analytics</p>
                  </div>
                </div>
                <p className="text-sm text-gray-400">
                  User & Entity Behavior Analytics with AI-powered anomaly detection.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-orange-400">
                  <span className="px-2 py-1 bg-orange-500/10 rounded">Risk Scoring</span>
                  <span className="px-2 py-1 bg-orange-500/10 rounded">Peer Groups</span>
                </div>
              </div>
            </Link>

            {/* ML Anomaly Detection */}
            <Link href="/security/ml-anomaly" className="group">
              <div className="bg-gradient-to-br from-[#12121a] to-[#1a1a28] border border-cyan-500/20 rounded-xl p-6 hover:border-cyan-500/50 transition-all hover:scale-[1.02] h-full">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">🧠</span>
                  <div>
                    <h4 className="font-semibold text-white">ML Detection</h4>
                    <p className="text-xs text-gray-500">Machine learning</p>
                  </div>
                </div>
                <p className="text-sm text-gray-400">
                  Advanced ML models for pattern recognition and anomaly detection.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-cyan-400">
                  <span className="px-2 py-1 bg-cyan-500/10 rounded">Multi-model</span>
                  <span className="px-2 py-1 bg-cyan-500/10 rounded">Auto-learn</span>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* System Status Footer */}
        <div className="mt-8 p-4 bg-[#12121a] border border-gray-800 rounded-xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-gray-400">All Systems Operational</span>
              </div>
              <div className="text-sm text-gray-500">
                Threat Detection: <span className="text-green-400">Active</span>
              </div>
              <div className="text-sm text-gray-500">
                AI Analysis: <span className="text-green-400">Online</span>
              </div>
              <div className="text-sm text-gray-500">
                ML Models: <span className="text-green-400">Running</span>
              </div>
            </div>
            <div className="text-xs text-gray-600">
              Powered by AI-SIEM v3.0 • Next-Gen Threat Intelligence • Breakthrough AI
            </div>
          </div>
        </div>
      </main>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #1a1a24;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #333;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #444;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 2s linear infinite;
        }
      `}</style>
    </div>
  );
}
