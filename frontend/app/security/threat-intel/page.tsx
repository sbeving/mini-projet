'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getStoredToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface IOC {
  id: string;
  type: 'ip' | 'domain' | 'hash' | 'url' | 'email' | 'file_path';
  value: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
  source: string;
  firstSeen: string;
  lastSeen: string;
  tags: string[];
  malwareFamily?: string;
  threatActor?: string;
}

interface ThreatFeed {
  id: string;
  name: string;
  type: string;
  source: string;
  lastUpdated: string;
  enabled: boolean;
  confidence: number;
  indicatorCount?: number;
}

interface ThreatIntelStats {
  totalIndicators: number;
  activeThreats: number;
  feedsActive: number;
  recentMatches: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
  topMalwareFamilies: Array<{ name: string; count: number }>;
  topThreatActors: Array<{ name: string; count: number }>;
}

interface EnrichmentResult {
  indicator: string;
  type: string;
  reputation: {
    score: number;
    category: string;
    sources: string[];
  };
  relatedIOCs: string[];
  context: Record<string, unknown>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const severityColors = {
  critical: 'bg-red-100 text-red-800 border-red-200',
  high: 'bg-orange-100 text-orange-800 border-orange-200',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  low: 'bg-blue-100 text-blue-800 border-blue-200',
};

const typeIcons: Record<string, string> = {
  ip: '🌐',
  domain: '🔗',
  hash: '#️⃣',
  url: '🔗',
  email: '📧',
  file_path: '📁',
};

export default function ThreatIntelligence() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [stats, setStats] = useState<ThreatIntelStats | null>(null);
  const [feeds, setFeeds] = useState<ThreatFeed[]>([]);
  const [recentIOCs, setRecentIOCs] = useState<IOC[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Lookup state
  const [lookupValue, setLookupValue] = useState('');
  const [lookupType, setLookupType] = useState<string>('ip');
  const [lookupResult, setLookupResult] = useState<EnrichmentResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'feeds' | 'lookup' | 'iocs'>('overview');

  const fetchData = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [statsRes, feedsRes] = await Promise.all([
        fetch(`${API_BASE}/api/siem/threat-intel/stats`, { headers }),
        fetch(`${API_BASE}/api/siem/threat-intel/feeds`, { headers }),
      ]);
      
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (feedsRes.ok) {
        setFeeds(await feedsRes.json());
      }
      
      setError(null);
    } catch (err) {
      setError('Failed to fetch threat intelligence data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLookup = async () => {
    const token = getStoredToken();
    if (!token || !lookupValue.trim()) return;
    
    setLookupLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/siem/threat-intel/enrich`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ indicator: lookupValue.trim(), type: lookupType }),
      });
      
      if (response.ok) {
        setLookupResult(await response.json());
      } else {
        throw new Error('Lookup failed');
      }
    } catch (err) {
      setError('Lookup failed');
    } finally {
      setLookupLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    if (user) {
      fetchData();
      const interval = setInterval(fetchData, 30000);
      return () => clearInterval(interval);
    }
  }, [user, authLoading, router, fetchData]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500" />
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
              🛡️ Threat Intelligence
            </h1>
            <p className="text-gray-400 mt-1">
              Real-time threat feeds, IOC database, and indicator enrichment
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Live Feeds Active
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-800 p-1 rounded-lg w-fit">
          {(['overview', 'feeds', 'lookup', 'iocs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {tab === 'overview' && '📊 Overview'}
              {tab === 'feeds' && '📡 Threat Feeds'}
              {tab === 'lookup' && '🔍 IOC Lookup'}
              {tab === 'iocs' && '🎯 IOC Database'}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-3xl font-bold text-cyan-400">{stats.totalIndicators.toLocaleString()}</div>
                <div className="text-gray-400 text-sm">Total IOCs</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-3xl font-bold text-red-400">{stats.activeThreats}</div>
                <div className="text-gray-400 text-sm">Active Threats</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-3xl font-bold text-green-400">{stats.feedsActive}</div>
                <div className="text-gray-400 text-sm">Active Feeds</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-3xl font-bold text-yellow-400">{stats.recentMatches}</div>
                <div className="text-gray-400 text-sm">Recent Matches</div>
              </div>
            </div>

            {/* Distribution Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* By Type */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">IOCs by Type</h3>
                <div className="space-y-3">
                  {Object.entries(stats.byType).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-xl">{typeIcons[type] || '📌'}</span>
                      <div className="flex-1">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-300 capitalize">{type}</span>
                          <span className="text-gray-400">{count}</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-cyan-500 rounded-full"
                            style={{ width: `${(count / stats.totalIndicators) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* By Severity */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">IOCs by Severity</h3>
                <div className="space-y-3">
                  {Object.entries(stats.bySeverity).map(([severity, count]) => {
                    const colorMap: Record<string, string> = {
                      critical: 'bg-red-500',
                      high: 'bg-orange-500',
                      medium: 'bg-yellow-500',
                      low: 'bg-blue-500',
                    };
                    return (
                      <div key={severity} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${colorMap[severity]}`} />
                        <div className="flex-1">
                          <div className="flex justify-between text-sm mb-1">
                            <span className="text-gray-300 capitalize">{severity}</span>
                            <span className="text-gray-400">{count}</span>
                          </div>
                          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${colorMap[severity]} rounded-full`}
                              style={{ width: `${(count / stats.totalIndicators) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Top Threats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">🦠 Top Malware Families</h3>
                <div className="space-y-2">
                  {stats.topMalwareFamilies.slice(0, 5).map((family, i) => (
                    <div key={family.name} className="flex items-center justify-between p-2 bg-gray-700/50 rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-sm">#{i + 1}</span>
                        <span className="text-gray-200 font-medium">{family.name}</span>
                      </div>
                      <span className="text-red-400 font-mono">{family.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">👤 Top Threat Actors</h3>
                <div className="space-y-2">
                  {stats.topThreatActors.slice(0, 5).map((actor, i) => (
                    <div key={actor.name} className="flex items-center justify-between p-2 bg-gray-700/50 rounded">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-sm">#{i + 1}</span>
                        <span className="text-gray-200 font-medium">{actor.name}</span>
                      </div>
                      <span className="text-orange-400 font-mono">{actor.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Feeds Tab */}
        {activeTab === 'feeds' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <div className="p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">📡 Active Threat Feeds</h3>
            </div>
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="text-left p-3 text-gray-300 font-medium">Feed</th>
                  <th className="text-left p-3 text-gray-300 font-medium">Type</th>
                  <th className="text-left p-3 text-gray-300 font-medium">Source</th>
                  <th className="text-left p-3 text-gray-300 font-medium">Last Updated</th>
                  <th className="text-left p-3 text-gray-300 font-medium">Confidence</th>
                  <th className="text-left p-3 text-gray-300 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {feeds.map((feed) => (
                  <tr key={feed.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                    <td className="p-3 text-white font-medium">{feed.name}</td>
                    <td className="p-3 text-gray-300 capitalize">{feed.type}</td>
                    <td className="p-3 text-cyan-400 text-sm font-mono">{feed.source}</td>
                    <td className="p-3 text-gray-400 text-sm">
                      {new Date(feed.lastUpdated).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full"
                            style={{ width: `${feed.confidence}%` }}
                          />
                        </div>
                        <span className="text-gray-400 text-sm">{feed.confidence}%</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        feed.enabled 
                          ? 'bg-green-900/50 text-green-400' 
                          : 'bg-gray-700 text-gray-400'
                      }`}>
                        {feed.enabled ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Lookup Tab */}
        {activeTab === 'lookup' && (
          <div className="space-y-6">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">🔍 IOC Enrichment Lookup</h3>
              <div className="flex gap-4">
                <select
                  value={lookupType}
                  onChange={(e) => setLookupType(e.target.value)}
                  className="bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white"
                >
                  <option value="ip">IP Address</option>
                  <option value="domain">Domain</option>
                  <option value="hash">File Hash</option>
                  <option value="url">URL</option>
                  <option value="email">Email</option>
                </select>
                <input
                  type="text"
                  value={lookupValue}
                  onChange={(e) => setLookupValue(e.target.value)}
                  placeholder={`Enter ${lookupType} to lookup...`}
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-4 py-2 text-white placeholder-gray-400"
                  onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
                />
                <button
                  onClick={handleLookup}
                  disabled={lookupLoading || !lookupValue.trim()}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 px-6 py-2 rounded font-medium text-white transition-colors"
                >
                  {lookupLoading ? 'Searching...' : 'Lookup'}
                </button>
              </div>
            </div>

            {lookupResult && (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">🎯 Enrichment Results</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Indicator</div>
                    <div className="text-white font-mono">{lookupResult.indicator}</div>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Type</div>
                    <div className="text-white capitalize">{lookupResult.type}</div>
                  </div>
                  <div className="bg-gray-700/50 rounded-lg p-4">
                    <div className="text-gray-400 text-sm mb-1">Reputation Score</div>
                    <div className={`text-2xl font-bold ${
                      lookupResult.reputation.score >= 70 ? 'text-red-400' :
                      lookupResult.reputation.score >= 40 ? 'text-yellow-400' : 'text-green-400'
                    }`}>
                      {lookupResult.reputation.score}/100
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="text-gray-400 text-sm mb-2">Category</div>
                    <span className={`px-3 py-1 rounded text-sm ${
                      lookupResult.reputation.category === 'malicious' 
                        ? 'bg-red-900/50 text-red-400'
                        : lookupResult.reputation.category === 'suspicious'
                        ? 'bg-yellow-900/50 text-yellow-400'
                        : 'bg-green-900/50 text-green-400'
                    }`}>
                      {lookupResult.reputation.category}
                    </span>
                  </div>
                  
                  <div>
                    <div className="text-gray-400 text-sm mb-2">Intelligence Sources</div>
                    <div className="flex flex-wrap gap-2">
                      {lookupResult.reputation.sources.map((src) => (
                        <span key={src} className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">
                          {src}
                        </span>
                      ))}
                    </div>
                  </div>

                  {lookupResult.relatedIOCs.length > 0 && (
                    <div>
                      <div className="text-gray-400 text-sm mb-2">Related IOCs</div>
                      <div className="flex flex-wrap gap-2">
                        {lookupResult.relatedIOCs.map((ioc) => (
                          <span key={ioc} className="px-2 py-1 bg-red-900/30 border border-red-500/30 rounded text-xs text-red-300 font-mono">
                            {ioc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* IOCs Tab */}
        {activeTab === 'iocs' && stats && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎯</div>
              <h3 className="text-xl font-semibold text-white mb-2">IOC Database Browser</h3>
              <p className="text-gray-400 mb-4">
                Search and browse {stats.totalIndicators.toLocaleString()} indicators of compromise
              </p>
              <div className="max-w-md mx-auto">
                <input
                  type="text"
                  placeholder="Search IOCs by value, type, or source..."
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400"
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
