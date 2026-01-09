'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getStoredToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface EntityProfile {
  entityId: string;
  entityType: 'user' | 'endpoint' | 'service' | 'network_segment' | 'application';
  riskScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  riskFactors: string[];
  lastActivity: string;
  firstSeen: string;
  activityCount: number;
  anomalyCount: number;
  peerGroup?: string;
}

interface BehaviorAnomaly {
  id: string;
  entityId: string;
  entityType: string;
  type: 'temporal' | 'location' | 'volume' | 'resource' | 'session' | 'pattern';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  detectedAt: string;
  context: Record<string, unknown>;
  deviation: number;
  baselineValue?: number;
  observedValue?: number;
}

interface PeerGroup {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  avgRiskScore: number;
  characteristics: string[];
}

interface UEBAStats {
  totalEntities: number;
  entitiesByType: Record<string, number>;
  highRiskEntities: number;
  criticalRiskEntities: number;
  recentAnomalies: number;
  anomaliesByType: Record<string, number>;
  avgRiskScore: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const riskColors = {
  critical: { bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500' },
  high: { bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500' },
  medium: { bg: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-yellow-500' },
  low: { bg: 'bg-green-500', text: 'text-green-400', border: 'border-green-500' },
};

const entityIcons: Record<string, string> = {
  user: '👤',
  endpoint: '💻',
  service: '⚙️',
  network_segment: '🌐',
  application: '📱',
};

const anomalyIcons: Record<string, string> = {
  temporal: '🕐',
  location: '📍',
  volume: '📊',
  resource: '🔧',
  session: '🔑',
  pattern: '🔍',
};

export default function UEBADashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [stats, setStats] = useState<UEBAStats | null>(null);
  const [highRiskProfiles, setHighRiskProfiles] = useState<EntityProfile[]>([]);
  const [recentAnomalies, setRecentAnomalies] = useState<BehaviorAnomaly[]>([]);
  const [peerGroups, setPeerGroups] = useState<PeerGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'entities' | 'anomalies' | 'peer-groups'>('overview');
  const [selectedEntity, setSelectedEntity] = useState<EntityProfile | null>(null);
  const [entityFilter, setEntityFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [statsRes, highRiskRes, anomaliesRes, peerGroupsRes] = await Promise.all([
        fetch(`${API_BASE}/api/siem/ueba/stats`, { headers }),
        fetch(`${API_BASE}/api/siem/ueba/high-risk?limit=20`, { headers }),
        fetch(`${API_BASE}/api/siem/ueba/anomalies?limit=50`, { headers }),
        fetch(`${API_BASE}/api/siem/ueba/peer-groups`, { headers }),
      ]);
      
      if (statsRes.ok) setStats(await statsRes.json());
      if (highRiskRes.ok) setHighRiskProfiles(await highRiskRes.json());
      if (anomaliesRes.ok) setRecentAnomalies(await anomaliesRes.json());
      if (peerGroupsRes.ok) setPeerGroups(await peerGroupsRes.json());
      
      setError(null);
    } catch (err) {
      setError('Failed to fetch UEBA data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const analyzeEntity = async (entityId: string, entityType: string) => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/siem/ueba/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          entityId,
          entityType,
          activities: [], // Would include recent activities
        }),
      });
      
      if (response.ok) {
        await fetchData();
      }
    } catch (err) {
      setError('Failed to analyze entity');
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      fetchData();
      const interval = setInterval(fetchData, 15000);
      return () => clearInterval(interval);
    }
  }, [user, authLoading, router, fetchData]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/security" className="text-gray-400 hover:text-gray-200">
                ← Security
              </Link>
            </div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              👤 User &amp; Entity Behavior Analytics
            </h1>
            <p className="text-gray-400 mt-1">
              AI-powered behavioral profiling and anomaly detection
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {stats && stats.criticalRiskEntities > 0 && (
              <span className="flex items-center gap-2 text-sm text-red-400 bg-red-900/30 px-3 py-1 rounded">
                🚨 {stats.criticalRiskEntities} Critical Risk
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-800 p-1 rounded-lg w-fit">
          {(['overview', 'entities', 'anomalies', 'peer-groups'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {tab === 'overview' && '📊 Overview'}
              {tab === 'entities' && '👥 Entities'}
              {tab === 'anomalies' && '⚠️ Anomalies'}
              {tab === 'peer-groups' && '👪 Peer Groups'}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Risk Gauge */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">🎯 Overall Risk Posture</h3>
              <div className="flex items-center gap-8">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="#374151"
                      strokeWidth="10"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke={stats.avgRiskScore >= 70 ? '#ef4444' : stats.avgRiskScore >= 40 ? '#f59e0b' : '#22c55e'}
                      strokeWidth="10"
                      strokeDasharray={`${(stats.avgRiskScore / 100) * 283} 283`}
                      strokeLinecap="round"
                      transform="rotate(-90 50 50)"
                    />
                    <text
                      x="50"
                      y="55"
                      textAnchor="middle"
                      className="text-2xl font-bold"
                      fill="white"
                    >
                      {Math.round(stats.avgRiskScore)}
                    </text>
                  </svg>
                </div>
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-blue-400">{stats.totalEntities}</div>
                    <div className="text-gray-400 text-sm">Total Entities</div>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-red-400">{stats.criticalRiskEntities}</div>
                    <div className="text-gray-400 text-sm">Critical Risk</div>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-orange-400">{stats.highRiskEntities}</div>
                    <div className="text-gray-400 text-sm">High Risk</div>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-yellow-400">{stats.recentAnomalies}</div>
                    <div className="text-gray-400 text-sm">Recent Anomalies</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Distribution Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Entities by Type */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">📊 Entities by Type</h3>
                <div className="space-y-3">
                  {Object.entries(stats.entitiesByType).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-xl">{entityIcons[type] || '📌'}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-300 capitalize">{type.replace('_', ' ')}</span>
                          <span className="text-gray-400">{count}</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${(count / stats.totalEntities) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Anomalies by Type */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">⚠️ Anomalies by Type</h3>
                <div className="space-y-3">
                  {Object.entries(stats.anomaliesByType).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-xl">{anomalyIcons[type] || '❓'}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-300 capitalize">{type}</span>
                          <span className="text-gray-400">{count}</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-yellow-500 rounded-full"
                            style={{ width: `${(count / stats.recentAnomalies) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* High Risk Entities */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">🚨 High Risk Entities</h3>
              <div className="space-y-2">
                {highRiskProfiles.slice(0, 5).map((profile) => (
                  <div 
                    key={profile.entityId} 
                    className={`flex items-center justify-between p-3 bg-gray-700/50 rounded border-l-4 ${riskColors[profile.riskLevel].border}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{entityIcons[profile.entityType]}</span>
                      <div>
                        <div className="text-white font-medium">{profile.entityId}</div>
                        <div className="text-gray-400 text-xs capitalize">{profile.entityType.replace('_', ' ')}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className={`text-lg font-bold ${riskColors[profile.riskLevel].text}`}>
                          {profile.riskScore}
                        </div>
                        <div className="text-gray-500 text-xs">Risk Score</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs ${riskColors[profile.riskLevel].text} bg-gray-800`}>
                        {profile.anomalyCount} anomalies
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Entities Tab */}
        {activeTab === 'entities' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex gap-2">
              <select
                value={entityFilter}
                onChange={(e) => setEntityFilter(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white"
              >
                <option value="all">All Types</option>
                <option value="user">Users</option>
                <option value="endpoint">Endpoints</option>
                <option value="service">Services</option>
                <option value="application">Applications</option>
              </select>
            </div>

            {/* Entity Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {highRiskProfiles
                .filter(p => entityFilter === 'all' || p.entityType === entityFilter)
                .map((profile) => (
                  <div
                    key={profile.entityId}
                    className={`bg-gray-800 border rounded-lg p-4 cursor-pointer hover:border-blue-500 transition-colors ${riskColors[profile.riskLevel].border}`}
                    onClick={() => setSelectedEntity(profile)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{entityIcons[profile.entityType]}</span>
                        <div>
                          <div className="text-white font-medium">{profile.entityId}</div>
                          <div className="text-gray-400 text-xs capitalize">{profile.entityType.replace('_', ' ')}</div>
                        </div>
                      </div>
                      <div className={`text-2xl font-bold ${riskColors[profile.riskLevel].text}`}>
                        {profile.riskScore}
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${riskColors[profile.riskLevel].bg}`}
                          style={{ width: `${profile.riskScore}%` }}
                        />
                      </div>
                    </div>
                    
                    <div className="flex flex-wrap gap-1 mb-3">
                      {profile.riskFactors.slice(0, 3).map((factor, i) => (
                        <span key={i} className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                          {factor}
                        </span>
                      ))}
                    </div>
                    
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{profile.activityCount} activities</span>
                      <span>{profile.anomalyCount} anomalies</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Anomalies Tab */}
        {activeTab === 'anomalies' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="text-left p-3 text-gray-300 font-medium">Type</th>
                  <th className="text-left p-3 text-gray-300 font-medium">Entity</th>
                  <th className="text-left p-3 text-gray-300 font-medium">Severity</th>
                  <th className="text-left p-3 text-gray-300 font-medium">Description</th>
                  <th className="text-left p-3 text-gray-300 font-medium">Deviation</th>
                  <th className="text-left p-3 text-gray-300 font-medium">Detected</th>
                </tr>
              </thead>
              <tbody>
                {recentAnomalies.map((anomaly) => (
                  <tr key={anomaly.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                    <td className="p-3">
                      <span className="text-xl" title={anomaly.type}>
                        {anomalyIcons[anomaly.type]}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span>{entityIcons[anomaly.entityType]}</span>
                        <span className="text-white">{anomaly.entityId}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${riskColors[anomaly.severity].text} bg-gray-800`}>
                        {anomaly.severity}
                      </span>
                    </td>
                    <td className="p-3 text-gray-300 text-sm max-w-xs truncate">{anomaly.description}</td>
                    <td className="p-3">
                      <span className={`font-mono ${anomaly.deviation > 3 ? 'text-red-400' : 'text-yellow-400'}`}>
                        {anomaly.deviation.toFixed(1)}σ
                      </span>
                    </td>
                    <td className="p-3 text-gray-400 text-sm">
                      {new Date(anomaly.detectedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Peer Groups Tab */}
        {activeTab === 'peer-groups' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {peerGroups.map((group) => (
              <div key={group.id} className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-white font-semibold text-lg">{group.name}</h3>
                    <p className="text-gray-400 text-sm">{group.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-400">{group.memberCount}</div>
                    <div className="text-gray-500 text-xs">Members</div>
                  </div>
                </div>
                
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-400">Avg Risk Score</span>
                    <span className={`font-bold ${
                      group.avgRiskScore >= 70 ? 'text-red-400' :
                      group.avgRiskScore >= 40 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {group.avgRiskScore}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        group.avgRiskScore >= 70 ? 'bg-red-500' :
                        group.avgRiskScore >= 40 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${group.avgRiskScore}%` }}
                    />
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-1">
                  {group.characteristics.map((char, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                      {char}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Entity Detail Modal */}
        {selectedEntity && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{entityIcons[selectedEntity.entityType]}</span>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{selectedEntity.entityId}</h3>
                    <p className="text-gray-400 capitalize">{selectedEntity.entityType.replace('_', ' ')}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEntity(null)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className={`text-3xl font-bold ${riskColors[selectedEntity.riskLevel].text}`}>
                    {selectedEntity.riskScore}
                  </div>
                  <div className="text-gray-400 text-sm">Risk Score</div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-3xl font-bold text-yellow-400">{selectedEntity.anomalyCount}</div>
                  <div className="text-gray-400 text-sm">Anomalies</div>
                </div>
              </div>
              
              <div className="mb-6">
                <h4 className="text-white font-medium mb-2">Risk Factors</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedEntity.riskFactors.map((factor, i) => (
                    <span key={i} className="px-3 py-1 bg-red-900/30 text-red-400 rounded text-sm">
                      {factor}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div>
                  <span className="text-gray-400">First Seen:</span>
                  <span className="text-white ml-2">
                    {new Date(selectedEntity.firstSeen).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Last Activity:</span>
                  <span className="text-white ml-2">
                    {new Date(selectedEntity.lastActivity).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Total Activities:</span>
                  <span className="text-white ml-2">{selectedEntity.activityCount}</span>
                </div>
                <div>
                  <span className="text-gray-400">Peer Group:</span>
                  <span className="text-white ml-2">{selectedEntity.peerGroup || 'Unassigned'}</span>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => analyzeEntity(selectedEntity.entityId, selectedEntity.entityType)}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded font-medium text-white"
                >
                  🔍 Re-analyze
                </button>
                <button
                  onClick={() => setSelectedEntity(null)}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-white"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
