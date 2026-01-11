'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getStoredToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

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
      // Handle both response formats: direct data or { success: true, data: ... }
      const dashboardData = result.success !== undefined ? result.data : result;
      
      if (dashboardData) {
        // Transform the data to match expected format
        setData({
          threats: {
            total: dashboardData.threats?.total || 0,
            bySeverity: dashboardData.threats?.bySeverity || { critical: 0, high: 0, medium: 0, low: 0 },
            byStatus: dashboardData.threats?.byStatus || { active: 0, investigating: 0, mitigated: 0, resolved: 0 },
            recentCount: dashboardData.threats?.recentTrend || 0,
          },
          incidents: {
            total: dashboardData.incidents?.total || 0,
            open: dashboardData.incidents?.open || 0,
            inProgress: dashboardData.incidents?.inProgress || 0,
            resolved: dashboardData.incidents?.resolved || 0,
          },
          alerts: {
            totalRules: dashboardData.alerts?.topRules?.length || 0,
            enabledRules: dashboardData.alerts?.topRules?.length || 0,
            recentAlerts: dashboardData.alerts?.triggeredToday || 0,
          },
          correlations: {
            totalRules: dashboardData.correlations?.activePatterns || 0,
            correlatedEvents: dashboardData.correlations?.total || 0,
          },
          recentThreats: [],
          recentIncidents: [],
        });
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
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-orange-500/20 rounded-2xl flex items-center justify-center">
            <span className="text-3xl">🛡️</span>
          </div>
          <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin" />
          <p className="text-muted animate-pulse">Loading Security Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-foreground">
            <div className="w-10 h-10 bg-orange-500/20 rounded-xl flex items-center justify-center">
              <span className="text-xl">🛡️</span>
            </div>
            Security Operations Center
          </h1>
          <p className="text-muted mt-2">
            Real-time threat monitoring and incident response
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm">
            <p className="text-muted">Last updated</p>
            <p className="text-foreground">{lastUpdate?.toLocaleTimeString()}</p>
          </div>
          <button
            onClick={fetchDashboard}
            className="flex items-center gap-2 px-4 py-2.5 bg-surface border border-border hover:bg-surface-hover rounded-xl transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
          ⚠️ {error}
        </div>
      )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Active Threats */}
          <Link href="/security/threats" className="group">
            <div className="bg-surface border border-red-500/20 rounded-2xl p-6 hover:border-red-500/50 transition-all hover:scale-[1.02]">
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
              <p className="text-muted text-sm mt-1">Active Threats</p>
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
            <div className="bg-surface border border-orange-500/20 rounded-2xl p-6 hover:border-orange-500/50 transition-all hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">🚨</span>
                <span className="text-sm px-2 py-1 rounded bg-orange-500/20 text-orange-400">
                  {data?.incidents.inProgress || 0} In Progress
                </span>
              </div>
              <p className="text-4xl font-bold text-orange-400">{data?.incidents.open || 0}</p>
              <p className="text-muted text-sm mt-1">Open Incidents</p>
              <div className="mt-4 h-2 bg-surface-hover rounded-full overflow-hidden">
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
            <div className="bg-surface border border-cyan-500/20 rounded-2xl p-6 hover:border-cyan-500/50 transition-all hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">📋</span>
                <span className="text-sm px-2 py-1 rounded bg-cyan-500/20 text-cyan-400">
                  {data?.alerts.enabledRules || 0} Active
                </span>
              </div>
              <p className="text-4xl font-bold text-cyan-400">{data?.alerts.totalRules || 0}</p>
              <p className="text-muted text-sm mt-1">Alert Rules</p>
              <div className="mt-4 text-xs">
                <span className="text-yellow-400">
                  ⚡ {data?.alerts.recentAlerts || 0} alerts (24h)
                </span>
              </div>
            </div>
          </Link>

          {/* Correlations */}
          <Link href="/security/correlations" className="group">
            <div className="bg-surface border border-purple-500/20 rounded-2xl p-6 hover:border-purple-500/50 transition-all hover:scale-[1.02]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">🔗</span>
                <span className="text-sm px-2 py-1 rounded bg-purple-500/20 text-purple-400">
                  AI Powered
                </span>
              </div>
              <p className="text-4xl font-bold text-purple-400">{data?.correlations.correlatedEvents || 0}</p>
              <p className="text-muted text-sm mt-1">Correlated Events</p>
              <div className="mt-4 text-xs text-purple-300">
                📊 {data?.correlations.totalRules || 0} correlation rules
              </div>
            </div>
          </Link>
        </div>

        {/* Threat Severity Distribution */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Severity Breakdown */}
          <div className="bg-surface border border-border rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
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
                      <span className="text-muted">{item.label}</span>
                      <span className="text-foreground font-medium">{item.value}</span>
                    </div>
                    <div className="h-2 bg-surface-hover rounded-full overflow-hidden">
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
          <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                <span>🎯</span> Recent Threats
              </h3>
              <Link href="/security/threats" className="text-sm text-primary hover:underline">
                View All →
              </Link>
            </div>
            <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
              {data?.recentThreats?.length ? (
                data.recentThreats.map((threat) => (
                  <Link
                    key={threat.id}
                    href={`/security/threats/${threat.id}`}
                    className="block p-4 bg-background hover:bg-surface-hover rounded-xl border border-border hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs rounded border ${getSeverityColor(threat.severity)}`}>
                            {threat.severity.toUpperCase()}
                          </span>
                          <span className="text-xs text-muted">{threat.type}</span>
                        </div>
                        <h4 className="font-medium text-foreground line-clamp-1">{threat.title}</h4>
                        <p className="text-sm text-muted line-clamp-1 mt-1">{threat.description}</p>
                      </div>
                      <div className="text-right text-xs text-muted ml-4">
                        <p>{new Date(threat.createdAt).toLocaleDateString()}</p>
                        <p className={getStatusColor(threat.status)}>{threat.status}</p>
                      </div>
                    </div>
                    {threat.mitreAttack && (
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded">
                          MITRE: {threat.mitreAttack.technique}
                        </span>
                        <span className="text-muted">{threat.mitreAttack.tactic}</span>
                      </div>
                    )}
                  </Link>
                ))
              ) : (
                <div className="text-center py-8 text-muted">
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
          <div className="bg-surface border border-border rounded-2xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
              <span>⚡</span> Quick Actions
            </h3>
            <div className="space-y-3">
              <Link
                href="/security/investigate"
                className="flex items-center gap-3 p-3 bg-gradient-to-r from-primary/10 to-purple-500/10 hover:from-primary/20 hover:to-purple-500/20 border border-primary/30 rounded-xl transition-all group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">🔍</span>
                <div>
                  <p className="font-medium text-foreground">AI Investigation</p>
                  <p className="text-xs text-muted">Start new AI-powered investigation</p>
                </div>
              </Link>
              <Link
                href="/security/alerts/new"
                className="flex items-center gap-3 p-3 bg-background hover:bg-surface-hover border border-border rounded-xl transition-all group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">➕</span>
                <div>
                  <p className="font-medium text-foreground">Create Alert Rule</p>
                  <p className="text-xs text-muted">Define new detection rules</p>
                </div>
              </Link>
              <Link
                href="/security/playbooks"
                className="flex items-center gap-3 p-3 bg-background hover:bg-surface-hover border border-border rounded-xl transition-all group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">📚</span>
                <div>
                  <p className="font-medium text-foreground">Response Playbooks</p>
                  <p className="text-xs text-muted">Automated incident response</p>
                </div>
              </Link>
              <Link
                href="/security/iocs"
                className="flex items-center gap-3 p-3 bg-background hover:bg-surface-hover border border-border rounded-xl transition-all group"
              >
                <span className="text-2xl group-hover:scale-110 transition-transform">🔴</span>
                <div>
                  <p className="font-medium text-foreground">IOC Management</p>
                  <p className="text-xs text-muted">Indicators of Compromise</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Incidents */}
          <div className="lg:col-span-2 bg-surface border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                <span>🚨</span> Recent Incidents
              </h3>
              <Link href="/security/incidents" className="text-sm text-primary hover:underline">
                View All →
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted border-b border-border">
                    <th className="pb-2 font-medium">ID</th>
                    <th className="pb-2 font-medium">Title</th>
                    <th className="pb-2 font-medium">Severity</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data?.recentIncidents?.length ? (
                    data.recentIncidents.map((incident) => (
                      <tr key={incident.id} className="hover:bg-surface-hover transition-colors">
                        <td className="py-3 font-mono text-xs text-muted">
                          {incident.id.slice(0, 8)}
                        </td>
                        <td className="py-3">
                          <Link 
                            href={`/security/incidents/${incident.id}`}
                            className="text-foreground hover:text-primary transition-colors"
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
                        <td className="py-3 text-sm text-muted">
                          {new Date(incident.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted">
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
        <div className="mt-6">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-foreground">
            <span>🤖</span> AI-Powered Security Intelligence
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Threat Intelligence */}
            <Link href="/security/threat-intel" className="group">
              <div className="bg-surface border border-purple-500/20 rounded-2xl p-6 hover:border-purple-500/50 transition-all hover:scale-[1.02] h-full">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">🌐</span>
                  <div>
                    <h4 className="font-semibold text-foreground">Threat Intelligence</h4>
                    <p className="text-xs text-muted">IOC enrichment & feeds</p>
                  </div>
                </div>
                <p className="text-sm text-muted">
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
              <div className="bg-surface border border-green-500/20 rounded-2xl p-6 hover:border-green-500/50 transition-all hover:scale-[1.02] h-full">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">⚡</span>
                  <div>
                    <h4 className="font-semibold text-foreground">SOAR Engine</h4>
                    <p className="text-xs text-muted">Automated response</p>
                  </div>
                </div>
                <p className="text-sm text-muted">
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
              <div className="bg-surface border border-orange-500/20 rounded-2xl p-6 hover:border-orange-500/50 transition-all hover:scale-[1.02] h-full">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">👤</span>
                  <div>
                    <h4 className="font-semibold text-foreground">UEBA</h4>
                    <p className="text-xs text-muted">Behavioral analytics</p>
                  </div>
                </div>
                <p className="text-sm text-muted">
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
              <div className="bg-surface border border-primary/20 rounded-2xl p-6 hover:border-primary/50 transition-all hover:scale-[1.02] h-full">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">🧠</span>
                  <div>
                    <h4 className="font-semibold text-foreground">ML Detection</h4>
                    <p className="text-xs text-muted">Machine learning</p>
                  </div>
                </div>
                <p className="text-sm text-muted">
                  Advanced ML models for pattern recognition and anomaly detection.
                </p>
                <div className="mt-4 flex items-center gap-2 text-xs text-primary">
                  <span className="px-2 py-1 bg-primary/10 rounded">Multi-model</span>
                  <span className="px-2 py-1 bg-primary/10 rounded">Auto-learn</span>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* System Status Footer */}
        <div className="mt-6 p-4 bg-surface border border-border rounded-2xl">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm text-muted">All Systems Operational</span>
              </div>
              <div className="text-sm text-muted">
                Threat Detection: <span className="text-green-400">Active</span>
              </div>
              <div className="text-sm text-muted">
                AI Analysis: <span className="text-green-400">Online</span>
              </div>
              <div className="text-sm text-muted">
                ML Models: <span className="text-green-400">Running</span>
              </div>
            </div>
            <div className="text-xs text-muted">
              Powered by AI-SIEM v3.0 • Next-Gen Threat Intelligence
            </div>
          </div>
        </div>
      </div>
  );
}
