'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getStoredToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface AlertRule {
  id: string;
  name: string;
  description: string;
  type: 'threshold' | 'pattern' | 'anomaly' | 'correlation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  enabled: boolean;
  conditions: RuleCondition[];
  actions: RuleAction[];
  cooldown: number;
  triggerCount: number;
  lastTriggered?: string;
  createdAt: string;
  updatedAt: string;
}

interface RuleCondition {
  field: string;
  operator: string;
  value: string | number;
  logicalOperator?: 'AND' | 'OR';
}

interface RuleAction {
  type: 'email' | 'webhook' | 'incident' | 'slack';
  config: Record<string, unknown>;
}

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: string;
  message: string;
  triggeredAt: string;
  acknowledged: boolean;
  acknowledgedBy?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AlertsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'rules' | 'alerts'>('rules');
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRule, setSelectedRule] = useState<AlertRule | null>(null);
  const [showNewRuleModal, setShowNewRuleModal] = useState(false);

  const fetchRules = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/siem/rules`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Failed to fetch rules');
      
      const result = await response.json();
      if (result.success) {
        setRules(result.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAlerts = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/siem/alerts?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Failed to fetch alerts');
      
      const result = await response.json();
      if (result.success) {
        setAlerts(result.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    fetchRules();
    fetchAlerts();
  }, [authLoading, user, router, fetchRules, fetchAlerts]);

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/siem/rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ enabled }),
      });
      
      if (response.ok) {
        fetchRules();
      }
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const acknowledgeAlert = async (alertId: string) => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/siem/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        fetchAlerts();
      }
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const deleteRule = async (ruleId: string) => {
    const token = getStoredToken();
    if (!token || !confirm('Are you sure you want to delete this rule?')) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/siem/rules/${ruleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        fetchRules();
        if (selectedRule?.id === ruleId) {
          setSelectedRule(null);
        }
      }
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'threshold': return '📊';
      case 'pattern': return '🔍';
      case 'anomaly': return '🤖';
      case 'correlation': return '🔗';
      default: return '📋';
    }
  };

  const getOperatorLabel = (op: string) => {
    const ops: Record<string, string> = {
      'eq': '=',
      'neq': '≠',
      'gt': '>',
      'gte': '≥',
      'lt': '<',
      'lte': '≤',
      'contains': 'contains',
      'regex': 'matches',
    };
    return ops[op] || op;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <Navbar />
      
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
              <Link href="/security" className="hover:text-cyan-400">Security</Link>
              <span>/</span>
              <span className="text-gray-200">Alerts & Rules</span>
            </div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <span className="text-3xl">🔔</span>
              Alert Rules Engine
            </h1>
          </div>
          <button
            onClick={() => setShowNewRuleModal(true)}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 rounded-lg flex items-center gap-2"
          >
            ➕ Create Rule
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-6 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'rules'
                ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                : 'bg-[#12121a] border border-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            📋 Rules ({rules.length})
          </button>
          <button
            onClick={() => setActiveTab('alerts')}
            className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
              activeTab === 'alerts'
                ? 'bg-orange-500/20 border border-orange-500/50 text-orange-400'
                : 'bg-[#12121a] border border-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            🔔 Alerts
            {alerts.filter(a => !a.acknowledged).length > 0 && (
              <span className="px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                {alerts.filter(a => !a.acknowledged).length}
              </span>
            )}
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            ⚠️ {error}
          </div>
        )}

        {/* Rules Tab */}
        {activeTab === 'rules' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Rules List */}
            <div className={`${selectedRule ? 'lg:col-span-1' : 'lg:col-span-3'} space-y-3`}>
              {loading ? (
                <div className="text-center py-12">
                  <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
                </div>
              ) : rules.length === 0 ? (
                <div className="text-center py-12 bg-[#12121a] border border-gray-800 rounded-xl">
                  <span className="text-5xl mb-4 block">📋</span>
                  <p className="text-gray-400 mb-4">No alert rules configured</p>
                  <button
                    onClick={() => setShowNewRuleModal(true)}
                    className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg"
                  >
                    Create your first rule
                  </button>
                </div>
              ) : (
                rules.map((rule) => (
                  <div
                    key={rule.id}
                    onClick={() => setSelectedRule(rule)}
                    className={`p-4 bg-[#12121a] border rounded-xl cursor-pointer transition-all hover:bg-[#1a1a24] ${
                      selectedRule?.id === rule.id 
                        ? 'border-cyan-500/50 ring-1 ring-cyan-500/30' 
                        : 'border-gray-800 hover:border-gray-700'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{getTypeIcon(rule.type)}</span>
                        <span className={`px-2 py-0.5 text-xs rounded border ${getSeverityColor(rule.severity)}`}>
                          {rule.severity}
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => toggleRule(rule.id, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:ring-2 peer-focus:ring-cyan-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                      </label>
                    </div>
                    <h3 className="font-medium text-gray-200 mb-1">{rule.name}</h3>
                    <p className="text-sm text-gray-500 line-clamp-2">{rule.description}</p>
                    <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
                      <span>🔔 {rule.triggerCount} triggers</span>
                      {rule.lastTriggered && (
                        <span>Last: {new Date(rule.lastTriggered).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Rule Detail Panel */}
            {selectedRule && (
              <div className="lg:col-span-2 space-y-4">
                {/* Header */}
                <div className="bg-[#12121a] border border-gray-800 rounded-xl p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-3xl">{getTypeIcon(selectedRule.type)}</span>
                        <div>
                          <h2 className="text-xl font-bold">{selectedRule.name}</h2>
                          <span className={`px-2 py-0.5 text-xs rounded border ${getSeverityColor(selectedRule.severity)}`}>
                            {selectedRule.severity}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedRule.enabled}
                          onChange={(e) => toggleRule(selectedRule.id, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-700 peer-focus:ring-2 peer-focus:ring-cyan-500/50 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-cyan-500"></div>
                      </label>
                      <button
                        onClick={() => setSelectedRule(null)}
                        className="p-2 hover:bg-gray-800 rounded-lg"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  <p className="text-gray-400">{selectedRule.description}</p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-cyan-400">{selectedRule.triggerCount}</div>
                    <div className="text-sm text-gray-500">Total Triggers</div>
                  </div>
                  <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-yellow-400">{selectedRule.cooldown}s</div>
                    <div className="text-sm text-gray-500">Cooldown</div>
                  </div>
                  <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4 text-center">
                    <div className="text-3xl font-bold text-purple-400">{selectedRule.conditions.length}</div>
                    <div className="text-sm text-gray-500">Conditions</div>
                  </div>
                </div>

                {/* Conditions */}
                <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-4">Conditions</h4>
                  <div className="space-y-2">
                    {selectedRule.conditions.map((condition, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {i > 0 && (
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded">
                            {condition.logicalOperator || 'AND'}
                          </span>
                        )}
                        <div className="flex-1 p-3 bg-[#1a1a24] rounded-lg font-mono text-sm">
                          <span className="text-cyan-400">{condition.field}</span>
                          <span className="text-gray-500 mx-2">{getOperatorLabel(condition.operator)}</span>
                          <span className="text-yellow-400">{String(condition.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-4">Actions</h4>
                  <div className="grid grid-cols-2 gap-3">
                    {selectedRule.actions.map((action, i) => (
                      <div key={i} className="p-3 bg-[#1a1a24] rounded-lg flex items-center gap-3">
                        <span className="text-2xl">
                          {action.type === 'email' ? '📧' : 
                           action.type === 'webhook' ? '🔗' :
                           action.type === 'incident' ? '🚨' :
                           action.type === 'slack' ? '💬' : '⚡'}
                        </span>
                        <div>
                          <div className="font-medium capitalize">{action.type}</div>
                          <div className="text-xs text-gray-500">
                            {action.type === 'email' && 'Send email notification'}
                            {action.type === 'webhook' && 'Call webhook URL'}
                            {action.type === 'incident' && 'Create incident'}
                            {action.type === 'slack' && 'Send Slack message'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Created</h4>
                    <p className="font-medium">{new Date(selectedRule.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
                    <h4 className="text-sm font-medium text-gray-500 mb-2">Last Triggered</h4>
                    <p className="font-medium">
                      {selectedRule.lastTriggered 
                        ? new Date(selectedRule.lastTriggered).toLocaleString() 
                        : 'Never'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button className="flex-1 px-4 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg flex items-center justify-center gap-2">
                    ✏️ Edit Rule
                  </button>
                  <button
                    onClick={() => deleteRule(selectedRule.id)}
                    className="px-4 py-2 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-2"
                  >
                    🗑️ Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            {alerts.length === 0 ? (
              <div className="text-center py-12 bg-[#12121a] border border-gray-800 rounded-xl">
                <span className="text-5xl mb-4 block">✅</span>
                <p className="text-gray-400">No alerts to display</p>
              </div>
            ) : (
              <>
                {/* Unacknowledged Alerts */}
                {alerts.filter(a => !a.acknowledged).length > 0 && (
                  <div className="bg-[#12121a] border border-orange-500/30 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-orange-500/10 border-b border-orange-500/30 flex items-center justify-between">
                      <h3 className="font-medium text-orange-400">
                        🔔 Pending Alerts ({alerts.filter(a => !a.acknowledged).length})
                      </h3>
                    </div>
                    <div className="divide-y divide-gray-800">
                      {alerts.filter(a => !a.acknowledged).map((alert) => (
                        <div key={alert.id} className="p-4 flex items-center justify-between hover:bg-[#1a1a24]">
                          <div className="flex items-center gap-4">
                            <span className={`px-2 py-1 text-xs rounded border ${getSeverityColor(alert.severity)}`}>
                              {alert.severity}
                            </span>
                            <div>
                              <div className="font-medium">{alert.ruleName}</div>
                              <div className="text-sm text-gray-500">{alert.message}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-500">
                              {new Date(alert.triggeredAt).toLocaleString()}
                            </span>
                            <button
                              onClick={() => acknowledgeAlert(alert.id)}
                              className="px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-sm"
                            >
                              ✓ Acknowledge
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Acknowledged Alerts */}
                {alerts.filter(a => a.acknowledged).length > 0 && (
                  <div className="bg-[#12121a] border border-gray-800 rounded-xl overflow-hidden">
                    <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-800">
                      <h3 className="font-medium text-gray-400">
                        ✓ Acknowledged ({alerts.filter(a => a.acknowledged).length})
                      </h3>
                    </div>
                    <div className="divide-y divide-gray-800">
                      {alerts.filter(a => a.acknowledged).map((alert) => (
                        <div key={alert.id} className="p-4 flex items-center justify-between opacity-60">
                          <div className="flex items-center gap-4">
                            <span className={`px-2 py-1 text-xs rounded border ${getSeverityColor(alert.severity)}`}>
                              {alert.severity}
                            </span>
                            <div>
                              <div className="font-medium">{alert.ruleName}</div>
                              <div className="text-sm text-gray-500">{alert.message}</div>
                            </div>
                          </div>
                          <div className="text-sm text-gray-500">
                            Ack'd by {alert.acknowledgedBy || 'Unknown'} • {new Date(alert.triggeredAt).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* New Rule Modal */}
      {showNewRuleModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#12121a] border border-gray-800 rounded-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Create Alert Rule</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              setShowNewRuleModal(false);
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Rule Name</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-[#1a1a24] border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
                    placeholder="e.g., High Error Rate Alert"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    rows={2}
                    className="w-full px-4 py-2 bg-[#1a1a24] border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none resize-none"
                    placeholder="Describe what this rule monitors..."
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Type</label>
                    <select className="w-full px-4 py-2 bg-[#1a1a24] border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none">
                      <option value="threshold">📊 Threshold</option>
                      <option value="pattern">🔍 Pattern</option>
                      <option value="anomaly">🤖 Anomaly</option>
                      <option value="correlation">🔗 Correlation</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Severity</label>
                    <select className="w-full px-4 py-2 bg-[#1a1a24] border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none">
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-1">Cooldown (sec)</label>
                    <input
                      type="number"
                      defaultValue={300}
                      className="w-full px-4 py-2 bg-[#1a1a24] border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
                    />
                  </div>
                </div>
                
                {/* Conditions Builder */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Conditions</label>
                  <div className="p-4 bg-[#1a1a24] border border-gray-700 rounded-lg space-y-2">
                    <div className="grid grid-cols-4 gap-2">
                      <input
                        type="text"
                        placeholder="Field (e.g., level)"
                        className="px-3 py-2 bg-[#0a0a0f] border border-gray-700 rounded-lg text-sm"
                      />
                      <select className="px-3 py-2 bg-[#0a0a0f] border border-gray-700 rounded-lg text-sm">
                        <option value="eq">=</option>
                        <option value="neq">≠</option>
                        <option value="gt">&gt;</option>
                        <option value="gte">≥</option>
                        <option value="lt">&lt;</option>
                        <option value="lte">≤</option>
                        <option value="contains">contains</option>
                        <option value="regex">regex</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Value"
                        className="px-3 py-2 bg-[#0a0a0f] border border-gray-700 rounded-lg text-sm"
                      />
                      <button type="button" className="px-3 py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-sm">
                        + Add
                      </button>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Actions</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-3 p-3 bg-[#1a1a24] border border-gray-700 rounded-lg cursor-pointer hover:border-cyan-500/50">
                      <input type="checkbox" className="w-4 h-4 accent-cyan-500" />
                      <span className="text-xl">📧</span>
                      <span>Email Notification</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-[#1a1a24] border border-gray-700 rounded-lg cursor-pointer hover:border-cyan-500/50">
                      <input type="checkbox" className="w-4 h-4 accent-cyan-500" />
                      <span className="text-xl">🚨</span>
                      <span>Create Incident</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-[#1a1a24] border border-gray-700 rounded-lg cursor-pointer hover:border-cyan-500/50">
                      <input type="checkbox" className="w-4 h-4 accent-cyan-500" />
                      <span className="text-xl">💬</span>
                      <span>Slack Message</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 bg-[#1a1a24] border border-gray-700 rounded-lg cursor-pointer hover:border-cyan-500/50">
                      <input type="checkbox" className="w-4 h-4 accent-cyan-500" />
                      <span className="text-xl">🔗</span>
                      <span>Webhook</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewRuleModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 rounded-lg transition-all"
                >
                  Create Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
