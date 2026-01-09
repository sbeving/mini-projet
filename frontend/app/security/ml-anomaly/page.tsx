'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getStoredToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface Anomaly {
  id: string;
  type: 'point' | 'contextual' | 'collective' | 'pattern' | 'seasonal';
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: string;
  field: string;
  message: string;
  value: number;
  expectedValue?: number;
  expectedRange?: { min: number; max: number };
  deviation: number;
  confidence: number;
  timestamp: string;
  context: Record<string, unknown>;
  relatedLogs?: string[];
}

interface ModelInfo {
  id: string;
  name: string;
  type: 'isolation_forest' | 'autoencoder' | 'lstm' | 'statistical' | 'ensemble';
  status: 'active' | 'training' | 'needs_retrain' | 'error';
  accuracy: number;
  lastTrained: string;
  logsSeen: number;
  anomaliesDetected: number;
  featureCount: number;
  description: string;
}

interface MLStats {
  totalAnomalies: number;
  anomaliesByType: Record<string, number>;
  anomaliesBySeverity: Record<string, number>;
  avgConfidence: number;
  modelsActive: number;
  falsePositiveRate: number;
  detectionRate: number;
}

interface TrendData {
  timestamp: string;
  count: number;
  avgSeverity: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const severityColors = {
  critical: { bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500' },
  high: { bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500' },
  medium: { bg: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-yellow-500' },
  low: { bg: 'bg-green-500', text: 'text-green-400', border: 'border-green-500' },
};

const anomalyTypeIcons: Record<string, string> = {
  point: '📍',
  contextual: '🔄',
  collective: '📊',
  pattern: '🔍',
  seasonal: '📅',
};

const modelTypeIcons: Record<string, string> = {
  isolation_forest: '🌲',
  autoencoder: '🧠',
  lstm: '⏳',
  statistical: '📈',
  ensemble: '🎯',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-500',
  training: 'bg-blue-500',
  needs_retrain: 'bg-yellow-500',
  error: 'bg-red-500',
};

export default function MLAnomalyDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [stats, setStats] = useState<MLStats | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'anomalies' | 'models' | 'analysis'>('overview');
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const fetchData = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [statsRes, anomaliesRes, modelsRes, trendsRes] = await Promise.all([
        fetch(`${API_BASE}/api/siem/ml/stats`, { headers }),
        fetch(`${API_BASE}/api/siem/ml/anomalies?timeRange=${timeRange}&limit=100`, { headers }),
        fetch(`${API_BASE}/api/siem/ml/models`, { headers }),
        fetch(`${API_BASE}/api/siem/ml/trends?timeRange=${timeRange}`, { headers }),
      ]);
      
      if (statsRes.ok) setStats(await statsRes.json());
      if (anomaliesRes.ok) setAnomalies(await anomaliesRes.json());
      if (modelsRes.ok) setModels(await modelsRes.json());
      if (trendsRes.ok) setTrends(await trendsRes.json());
      
      setError(null);
    } catch (err) {
      setError('Failed to fetch ML anomaly data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  const trainModel = async (modelId: string) => {
    const token = getStoredToken();
    if (!token) return;
    
    setIsAnalyzing(true);
    try {
      const response = await fetch(`${API_BASE}/api/siem/ml/models/${modelId}/train`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        await fetchData();
      }
    } catch (err) {
      setError('Failed to train model');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeNow = async () => {
    const token = getStoredToken();
    if (!token) return;
    
    setIsAnalyzing(true);
    try {
      const response = await fetch(`${API_BASE}/api/siem/ml/analyze`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        await fetchData();
      }
    } catch (err) {
      setError('Failed to run analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const markFalsePositive = async (anomalyId: string) => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      await fetch(`${API_BASE}/api/siem/ml/anomalies/${anomalyId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ isFalsePositive: true }),
      });
      
      setAnomalies(prev => prev.filter(a => a.id !== anomalyId));
      setSelectedAnomaly(null);
    } catch (err) {
      setError('Failed to mark as false positive');
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      fetchData();
      const interval = setInterval(fetchData, 10000);
      return () => clearInterval(interval);
    }
  }, [user, authLoading, router, fetchData]);

  const filteredAnomalies = anomalies.filter(a => 
    severityFilter === 'all' || a.severity === severityFilter
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar />
      
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
              🤖 ML Anomaly Detection
            </h1>
            <p className="text-gray-400 mt-1">
              Machine learning-powered behavioral and pattern anomaly detection
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white text-sm"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
            <button
              onClick={analyzeNow}
              disabled={isAnalyzing}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 px-4 py-2 rounded font-medium text-white flex items-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  Analyzing...
                </>
              ) : (
                <>🔬 Analyze Now</>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-800 p-1 rounded-lg w-fit">
          {(['overview', 'anomalies', 'models', 'analysis'] as const).map((tab) => (
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
              {tab === 'anomalies' && '⚠️ Anomalies'}
              {tab === 'models' && '🧠 Models'}
              {tab === 'analysis' && '📈 Analysis'}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-3xl font-bold text-blue-400">{stats.totalAnomalies}</div>
                <div className="text-gray-400 text-sm">Total Anomalies</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-3xl font-bold text-green-400">{stats.modelsActive}</div>
                <div className="text-gray-400 text-sm">Active Models</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-3xl font-bold text-purple-400">{(stats.avgConfidence * 100).toFixed(1)}%</div>
                <div className="text-gray-400 text-sm">Avg Confidence</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-3xl font-bold text-yellow-400">{(stats.detectionRate * 100).toFixed(1)}%</div>
                <div className="text-gray-400 text-sm">Detection Rate</div>
              </div>
            </div>

            {/* Distribution Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* By Severity */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">🎯 By Severity</h3>
                <div className="space-y-3">
                  {Object.entries(stats.anomaliesBySeverity).map(([severity, count]) => (
                    <div key={severity} className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${severityColors[severity as keyof typeof severityColors]?.bg || 'bg-gray-500'}`} />
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-300 capitalize">{severity}</span>
                          <span className="text-gray-400">{count}</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${severityColors[severity as keyof typeof severityColors]?.bg || 'bg-gray-500'}`}
                            style={{ width: `${(count / stats.totalAnomalies) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Type */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">📊 By Type</h3>
                <div className="space-y-3">
                  {Object.entries(stats.anomaliesByType).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-xl">{anomalyTypeIcons[type] || '❓'}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-300 capitalize">{type}</span>
                          <span className="text-gray-400">{count}</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${(count / stats.totalAnomalies) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Trend Chart */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">📈 Anomaly Trend</h3>
              <div className="h-48 flex items-end gap-1">
                {trends.map((point, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center">
                    <div 
                      className="w-full bg-blue-500 rounded-t"
                      style={{ 
                        height: `${Math.max(4, (point.count / Math.max(...trends.map(t => t.count))) * 100)}%`,
                        opacity: 0.3 + (point.avgSeverity * 0.7)
                      }}
                      title={`${point.count} anomalies`}
                    />
                    <span className="text-gray-500 text-xs mt-1 -rotate-45">
                      {new Date(point.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Critical Anomalies */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">🚨 Recent Critical Anomalies</h3>
              <div className="space-y-2">
                {anomalies.filter(a => a.severity === 'critical' || a.severity === 'high').slice(0, 5).map((anomaly) => (
                  <div 
                    key={anomaly.id}
                    className={`flex items-center justify-between p-3 bg-gray-700/50 rounded border-l-4 cursor-pointer hover:bg-gray-700 ${severityColors[anomaly.severity].border}`}
                    onClick={() => setSelectedAnomaly(anomaly)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{anomalyTypeIcons[anomaly.type]}</span>
                      <div>
                        <div className="text-white font-medium">{anomaly.message}</div>
                        <div className="text-gray-400 text-xs">{anomaly.source} - {anomaly.field}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`px-2 py-1 rounded text-xs ${severityColors[anomaly.severity].text} bg-gray-800`}>
                        {(anomaly.confidence * 100).toFixed(0)}% confidence
                      </span>
                      <span className="text-gray-500 text-sm">
                        {new Date(anomaly.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Anomalies Tab */}
        {activeTab === 'anomalies' && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex gap-2">
              <select
                value={severityFilter}
                onChange={(e) => setSeverityFilter(e.target.value)}
                className="bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Anomalies Table */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="text-left p-3 text-gray-300 font-medium">Type</th>
                    <th className="text-left p-3 text-gray-300 font-medium">Severity</th>
                    <th className="text-left p-3 text-gray-300 font-medium">Source</th>
                    <th className="text-left p-3 text-gray-300 font-medium">Message</th>
                    <th className="text-left p-3 text-gray-300 font-medium">Deviation</th>
                    <th className="text-left p-3 text-gray-300 font-medium">Confidence</th>
                    <th className="text-left p-3 text-gray-300 font-medium">Time</th>
                    <th className="text-left p-3 text-gray-300 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAnomalies.map((anomaly) => (
                    <tr 
                      key={anomaly.id} 
                      className="border-t border-gray-700/50 hover:bg-gray-700/30 cursor-pointer"
                      onClick={() => setSelectedAnomaly(anomaly)}
                    >
                      <td className="p-3">
                        <span className="text-xl" title={anomaly.type}>
                          {anomalyTypeIcons[anomaly.type]}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded text-xs ${severityColors[anomaly.severity].text} bg-gray-800`}>
                          {anomaly.severity}
                        </span>
                      </td>
                      <td className="p-3 text-gray-300">{anomaly.source}</td>
                      <td className="p-3 text-white text-sm max-w-xs truncate">{anomaly.message}</td>
                      <td className="p-3">
                        <span className={`font-mono ${anomaly.deviation > 3 ? 'text-red-400' : 'text-yellow-400'}`}>
                          {anomaly.deviation.toFixed(2)}σ
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${anomaly.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-gray-400 text-xs">{(anomaly.confidence * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="p-3 text-gray-400 text-sm">
                        {new Date(anomaly.timestamp).toLocaleString()}
                      </td>
                      <td className="p-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            markFalsePositive(anomaly.id);
                          }}
                          className="text-gray-400 hover:text-white text-sm"
                          title="Mark as false positive"
                        >
                          ❌
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Models Tab */}
        {activeTab === 'models' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {models.map((model) => (
              <div key={model.id} className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{modelTypeIcons[model.type]}</span>
                    <div>
                      <h3 className="text-white font-semibold text-lg">{model.name}</h3>
                      <p className="text-gray-400 text-sm capitalize">{model.type.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <span className={`w-3 h-3 rounded-full ${statusColors[model.status]}`} title={model.status} />
                </div>
                
                <p className="text-gray-400 text-sm mb-4">{model.description}</p>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-700/50 rounded p-3 text-center">
                    <div className="text-xl font-bold text-green-400">{(model.accuracy * 100).toFixed(1)}%</div>
                    <div className="text-gray-500 text-xs">Accuracy</div>
                  </div>
                  <div className="bg-gray-700/50 rounded p-3 text-center">
                    <div className="text-xl font-bold text-blue-400">{model.featureCount}</div>
                    <div className="text-gray-500 text-xs">Features</div>
                  </div>
                  <div className="bg-gray-700/50 rounded p-3 text-center">
                    <div className="text-xl font-bold text-purple-400">{(model.logsSeen / 1000).toFixed(1)}k</div>
                    <div className="text-gray-500 text-xs">Logs Seen</div>
                  </div>
                  <div className="bg-gray-700/50 rounded p-3 text-center">
                    <div className="text-xl font-bold text-yellow-400">{model.anomaliesDetected}</div>
                    <div className="text-gray-500 text-xs">Detected</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    Last trained: {new Date(model.lastTrained).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => trainModel(model.id)}
                    disabled={model.status === 'training'}
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 px-3 py-1 rounded text-white text-sm"
                  >
                    {model.status === 'training' ? 'Training...' : 'Retrain'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Analysis Tab */}
        {activeTab === 'analysis' && (
          <div className="space-y-6">
            {/* Detection Performance */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">📈 Detection Performance</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="inline-block relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#374151" strokeWidth="10" />
                      <circle 
                        cx="50" cy="50" r="45" fill="none" 
                        stroke="#22c55e" strokeWidth="10"
                        strokeDasharray={`${(stats?.detectionRate || 0) * 283} 283`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">{((stats?.detectionRate || 0) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="text-gray-400 mt-2">Detection Rate</div>
                </div>
                
                <div className="text-center">
                  <div className="inline-block relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#374151" strokeWidth="10" />
                      <circle 
                        cx="50" cy="50" r="45" fill="none" 
                        stroke="#ef4444" strokeWidth="10"
                        strokeDasharray={`${(stats?.falsePositiveRate || 0) * 283} 283`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">{((stats?.falsePositiveRate || 0) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="text-gray-400 mt-2">False Positive Rate</div>
                </div>
                
                <div className="text-center">
                  <div className="inline-block relative w-32 h-32">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="#374151" strokeWidth="10" />
                      <circle 
                        cx="50" cy="50" r="45" fill="none" 
                        stroke="#a855f7" strokeWidth="10"
                        strokeDasharray={`${(stats?.avgConfidence || 0) * 283} 283`}
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">{((stats?.avgConfidence || 0) * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="text-gray-400 mt-2">Avg Confidence</div>
                </div>
              </div>
            </div>

            {/* Feature Importance */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">🔍 Top Features Used in Detection</h3>
              <div className="space-y-3">
                {[
                  { name: 'Request Frequency', importance: 0.85 },
                  { name: 'Session Duration', importance: 0.72 },
                  { name: 'Error Rate', importance: 0.68 },
                  { name: 'Payload Size', importance: 0.61 },
                  { name: 'Geographic Anomaly', importance: 0.55 },
                  { name: 'Time of Day', importance: 0.48 },
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-32 text-gray-300 text-sm">{feature.name}</div>
                    <div className="flex-1 h-4 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                        style={{ width: `${feature.importance * 100}%` }}
                      />
                    </div>
                    <div className="w-12 text-gray-400 text-sm text-right">
                      {(feature.importance * 100).toFixed(0)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Anomaly Detail Modal */}
        {selectedAnomaly && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{anomalyTypeIcons[selectedAnomaly.type]}</span>
                  <div>
                    <h3 className="text-xl font-semibold text-white">{selectedAnomaly.message}</h3>
                    <p className="text-gray-400 capitalize">{selectedAnomaly.type} anomaly</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAnomaly(null)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className={`text-2xl font-bold ${severityColors[selectedAnomaly.severity].text}`}>
                    {selectedAnomaly.severity.toUpperCase()}
                  </div>
                  <div className="text-gray-400 text-sm">Severity</div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-400">
                    {(selectedAnomaly.confidence * 100).toFixed(1)}%
                  </div>
                  <div className="text-gray-400 text-sm">Confidence</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm mb-6">
                <div>
                  <span className="text-gray-400">Source:</span>
                  <span className="text-white ml-2">{selectedAnomaly.source}</span>
                </div>
                <div>
                  <span className="text-gray-400">Field:</span>
                  <span className="text-white ml-2">{selectedAnomaly.field}</span>
                </div>
                <div>
                  <span className="text-gray-400">Observed Value:</span>
                  <span className="text-white ml-2">{selectedAnomaly.value}</span>
                </div>
                <div>
                  <span className="text-gray-400">Expected Value:</span>
                  <span className="text-white ml-2">
                    {selectedAnomaly.expectedValue || 
                     (selectedAnomaly.expectedRange ? 
                       `${selectedAnomaly.expectedRange.min} - ${selectedAnomaly.expectedRange.max}` : 
                       'N/A')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Deviation:</span>
                  <span className={`ml-2 font-mono ${selectedAnomaly.deviation > 3 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {selectedAnomaly.deviation.toFixed(2)}σ
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Detected At:</span>
                  <span className="text-white ml-2">
                    {new Date(selectedAnomaly.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
              
              {selectedAnomaly.context && Object.keys(selectedAnomaly.context).length > 0 && (
                <div className="mb-6">
                  <h4 className="text-white font-medium mb-2">Context</h4>
                  <pre className="bg-gray-900 rounded p-3 text-xs text-gray-300 overflow-x-auto">
                    {JSON.stringify(selectedAnomaly.context, null, 2)}
                  </pre>
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  onClick={() => markFalsePositive(selectedAnomaly.id)}
                  className="flex-1 bg-red-600 hover:bg-red-500 px-4 py-2 rounded font-medium text-white"
                >
                  ❌ Mark False Positive
                </button>
                <button
                  onClick={() => setSelectedAnomaly(null)}
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
