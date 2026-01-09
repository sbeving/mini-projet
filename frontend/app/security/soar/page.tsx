'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getStoredToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Link from 'next/link';

interface PlaybookStep {
  id: string;
  name: string;
  action: string;
  description?: string;
  requiresApproval?: boolean;
  waitBefore?: number;
}

interface Playbook {
  id: string;
  name: string;
  description: string;
  trigger: string;
  severity: string;
  enabled: boolean;
  steps: PlaybookStep[];
  createdAt: string;
  lastExecuted?: string;
  executionCount: number;
  successRate: number;
}

interface PlaybookExecution {
  id: string;
  playbookId: string;
  playbookName: string;
  status: 'running' | 'completed' | 'failed' | 'pending_approval';
  startedAt: string;
  completedAt?: string;
  triggeredBy: string;
  context: Record<string, unknown>;
  stepResults: StepResult[];
}

interface StepResult {
  stepId: string;
  actionType: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

interface PendingApproval {
  id: string;
  actionType: string;
  parameters: Record<string, unknown>;
  playbookName: string;
  requestedAt: string;
  requestedBy: string;
}

interface SOARStats {
  totalPlaybooks: number;
  enabledPlaybooks: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  actionsExecuted: number;
  pendingApprovals: number;
}

interface ActionDefinition {
  type: string;
  name: string;
  description: string;
  category: string;
  parameters: { name: string; type: string; required: boolean; description: string }[];
  requiresApproval: boolean;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const triggerLabels: Record<string, string> = {
  threat_detected: '🚨 Threat Detected',
  incident_created: '📋 Incident Created',
  severity_critical: '🔴 Critical Severity',
  severity_high: '🟠 High Severity',
  ioc_match: '🎯 IOC Match',
  manual: '👤 Manual Trigger',
};

const statusColors: Record<string, string> = {
  running: 'bg-blue-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  pending_approval: 'bg-yellow-500',
  pending: 'bg-gray-500',
  skipped: 'bg-gray-400',
};

const riskColors: Record<string, string> = {
  low: 'text-green-400 bg-green-900/30',
  medium: 'text-yellow-400 bg-yellow-900/30',
  high: 'text-orange-400 bg-orange-900/30',
  critical: 'text-red-400 bg-red-900/30',
};

export default function SOARDashboard() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [stats, setStats] = useState<SOARStats | null>(null);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [executions, setExecutions] = useState<PlaybookExecution[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [actions, setActions] = useState<ActionDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [activeTab, setActiveTab] = useState<'overview' | 'playbooks' | 'history' | 'approvals' | 'actions'>('overview');
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [executeModalOpen, setExecuteModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const headers = { Authorization: `Bearer ${token}` };
      
      const [statsRes, playbooksRes, historyRes, pendingRes, actionsRes] = await Promise.all([
        fetch(`${API_BASE}/api/siem/soar/stats`, { headers }),
        fetch(`${API_BASE}/api/siem/soar/playbooks`, { headers }),
        fetch(`${API_BASE}/api/siem/soar/history?limit=50`, { headers }),
        fetch(`${API_BASE}/api/siem/soar/pending`, { headers }),
        fetch(`${API_BASE}/api/siem/soar/actions`, { headers }),
      ]);
      
      if (statsRes.ok) setStats(await statsRes.json());
      if (playbooksRes.ok) setPlaybooks(await playbooksRes.json());
      if (historyRes.ok) setExecutions(await historyRes.json());
      if (pendingRes.ok) setPendingApprovals(await pendingRes.json());
      if (actionsRes.ok) setActions(await actionsRes.json());
      
      setError(null);
    } catch (err) {
      setError('Failed to fetch SOAR data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const executePlaybook = async (playbookId: string, context: Record<string, unknown> = {}) => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/siem/soar/playbooks/${playbookId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ context }),
      });
      
      if (response.ok) {
        await fetchData();
        setExecuteModalOpen(false);
        setSelectedPlaybook(null);
      } else {
        throw new Error('Failed to execute playbook');
      }
    } catch (err) {
      setError('Failed to execute playbook');
    }
  };

  const handleApproval = async (actionId: string, approved: boolean) => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const endpoint = approved ? 'approve' : 'reject';
      const response = await fetch(`${API_BASE}/api/siem/soar/pending/${actionId}/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        await fetchData();
      }
    } catch (err) {
      setError(`Failed to ${approved ? 'approve' : 'reject'} action`);
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

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navbar />
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500" />
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
              ⚡ Security Orchestration & Automation
            </h1>
            <p className="text-gray-400 mt-1">
              Automated response playbooks and security orchestration
            </p>
          </div>
          
          {pendingApprovals.length > 0 && (
            <button
              onClick={() => setActiveTab('approvals')}
              className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-500 px-4 py-2 rounded text-white font-medium animate-pulse"
            >
              ⏳ {pendingApprovals.length} Pending Approval{pendingApprovals.length > 1 ? 's' : ''}
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded text-red-200">
            {error}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-800 p-1 rounded-lg w-fit">
          {(['overview', 'playbooks', 'history', 'approvals', 'actions'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors relative ${
                activeTab === tab
                  ? 'bg-purple-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {tab === 'overview' && '📊 Overview'}
              {tab === 'playbooks' && '📚 Playbooks'}
              {tab === 'history' && '📜 History'}
              {tab === 'approvals' && (
                <>
                  ⏳ Approvals
                  {pendingApprovals.length > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {pendingApprovals.length}
                    </span>
                  )}
                </>
              )}
              {tab === 'actions' && '⚙️ Actions'}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-3xl font-bold text-purple-400">{stats.totalPlaybooks}</div>
                <div className="text-gray-400 text-sm">Total Playbooks</div>
                <div className="text-green-400 text-xs mt-1">{stats.enabledPlaybooks} enabled</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-3xl font-bold text-cyan-400">{stats.totalExecutions}</div>
                <div className="text-gray-400 text-sm">Total Executions</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-3xl font-bold text-green-400">
                  {stats.totalExecutions > 0 
                    ? Math.round((stats.successfulExecutions / stats.totalExecutions) * 100) 
                    : 0}%
                </div>
                <div className="text-gray-400 text-sm">Success Rate</div>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-3xl font-bold text-yellow-400">{stats.pendingApprovals}</div>
                <div className="text-gray-400 text-sm">Pending Approvals</div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">🚀 Recent Executions</h3>
                <div className="space-y-3">
                  {executions.slice(0, 5).map((exec) => (
                    <div key={exec.id} className="flex items-center justify-between p-3 bg-gray-700/50 rounded">
                      <div>
                        <div className="text-white font-medium">{exec.playbookName}</div>
                        <div className="text-gray-400 text-xs">
                          {new Date(exec.startedAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${statusColors[exec.status]}`} />
                        <span className="text-gray-300 text-sm capitalize">
                          {exec.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                  {executions.length === 0 && (
                    <div className="text-gray-500 text-center py-4">No recent executions</div>
                  )}
                </div>
              </div>

              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">📊 Execution Stats</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Successful</span>
                      <span className="text-green-400">{stats.successfulExecutions}</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full"
                        style={{ width: `${stats.totalExecutions > 0 ? (stats.successfulExecutions / stats.totalExecutions) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Failed</span>
                      <span className="text-red-400">{stats.failedExecutions}</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-red-500 rounded-full"
                        style={{ width: `${stats.totalExecutions > 0 ? (stats.failedExecutions / stats.totalExecutions) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-700">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Actions Executed</span>
                      <span className="text-purple-400 font-bold">{stats.actionsExecuted}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Playbooks Tab */}
        {activeTab === 'playbooks' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {playbooks.map((playbook) => (
              <div
                key={playbook.id}
                className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-purple-500 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-white font-semibold">{playbook.name}</h3>
                    <p className="text-gray-400 text-sm mt-1">{playbook.description}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${
                    playbook.enabled 
                      ? 'bg-green-900/50 text-green-400' 
                      : 'bg-gray-700 text-gray-400'
                  }`}>
                    {playbook.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                    {triggerLabels[playbook.trigger] || playbook.trigger}
                  </span>
                </div>
                
                <div className="text-xs text-gray-500 mb-3">
                  {playbook.steps.length} steps • {playbook.executionCount} executions • {playbook.successRate}% success
                </div>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedPlaybook(playbook);
                      setExecuteModalOpen(true);
                    }}
                    className="flex-1 bg-purple-600 hover:bg-purple-500 px-3 py-2 rounded text-sm font-medium text-white transition-colors"
                  >
                    ▶ Execute
                  </button>
                  <button className="bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded text-sm text-white transition-colors">
                    ✏️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* History Tab */}
        {activeTab === 'history' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="text-left p-3 text-gray-300 font-medium">Playbook</th>
                  <th className="text-left p-3 text-gray-300 font-medium">Status</th>
                  <th className="text-left p-3 text-gray-300 font-medium">Triggered By</th>
                  <th className="text-left p-3 text-gray-300 font-medium">Started</th>
                  <th className="text-left p-3 text-gray-300 font-medium">Duration</th>
                  <th className="text-left p-3 text-gray-300 font-medium">Steps</th>
                </tr>
              </thead>
              <tbody>
                {executions.map((exec) => (
                  <tr key={exec.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                    <td className="p-3 text-white font-medium">{exec.playbookName}</td>
                    <td className="p-3">
                      <span className={`flex items-center gap-2`}>
                        <span className={`w-2 h-2 rounded-full ${statusColors[exec.status]}`} />
                        <span className="text-gray-300 text-sm capitalize">
                          {exec.status.replace('_', ' ')}
                        </span>
                      </span>
                    </td>
                    <td className="p-3 text-gray-400 text-sm">{exec.triggeredBy}</td>
                    <td className="p-3 text-gray-400 text-sm">
                      {new Date(exec.startedAt).toLocaleString()}
                    </td>
                    <td className="p-3 text-gray-400 text-sm">
                      {exec.completedAt 
                        ? `${Math.round((new Date(exec.completedAt).getTime() - new Date(exec.startedAt).getTime()) / 1000)}s`
                        : 'Running...'}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {exec.stepResults.map((step, i) => (
                          <span
                            key={i}
                            className={`w-3 h-3 rounded-sm ${statusColors[step.status]}`}
                            title={`${step.actionType}: ${step.status}`}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Approvals Tab */}
        {activeTab === 'approvals' && (
          <div className="space-y-4">
            {pendingApprovals.length === 0 ? (
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-12 text-center">
                <div className="text-6xl mb-4">✅</div>
                <h3 className="text-xl font-semibold text-white mb-2">No Pending Approvals</h3>
                <p className="text-gray-400">All actions have been processed</p>
              </div>
            ) : (
              pendingApprovals.map((approval) => (
                <div key={approval.id} className="bg-gray-800 border border-yellow-500/50 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-white font-semibold">{approval.actionType}</h3>
                      <p className="text-gray-400 text-sm">Playbook: {approval.playbookName}</p>
                      <p className="text-gray-500 text-xs mt-1">
                        Requested by {approval.requestedBy} at {new Date(approval.requestedAt).toLocaleString()}
                      </p>
                      <div className="mt-2 text-xs font-mono text-gray-500">
                        {JSON.stringify(approval.parameters, null, 2)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleApproval(approval.id, true)}
                        className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded text-white font-medium"
                      >
                        ✓ Approve
                      </button>
                      <button
                        onClick={() => handleApproval(approval.id, false)}
                        className="bg-red-600 hover:bg-red-500 px-4 py-2 rounded text-white font-medium"
                      >
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Actions Tab */}
        {activeTab === 'actions' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {actions.map((action) => (
              <div key={action.type} className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="text-white font-semibold">{action.name}</h3>
                    <p className="text-gray-400 text-sm">{action.description}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs ${riskColors[action.riskLevel]}`}>
                    {action.riskLevel} risk
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                    {action.category}
                  </span>
                  {action.requiresApproval && (
                    <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-1 rounded">
                      Requires Approval
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  Parameters: {action.parameters.map(p => p.name).join(', ')}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Execute Modal */}
        {executeModalOpen && selectedPlaybook && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-lg w-full mx-4">
              <h3 className="text-xl font-semibold text-white mb-2">Execute Playbook</h3>
              <p className="text-gray-400 mb-4">{selectedPlaybook.name}</p>
              
              <div className="mb-4">
                <div className="text-sm text-gray-300 mb-2">Steps to execute:</div>
                <div className="space-y-2">
                  {selectedPlaybook.steps.map((step, i) => (
                    <div key={step.id} className="flex items-center gap-2 text-sm">
                      <span className="w-6 h-6 bg-gray-700 rounded-full flex items-center justify-center text-xs text-gray-400">
                        {i + 1}
                      </span>
                      <span className="text-gray-300">{step.name}</span>
                      {step.requiresApproval && (
                        <span className="text-yellow-400 text-xs">⏳</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => executePlaybook(selectedPlaybook.id)}
                  className="flex-1 bg-purple-600 hover:bg-purple-500 px-4 py-2 rounded font-medium text-white"
                >
                  ▶ Execute Now
                </button>
                <button
                  onClick={() => {
                    setExecuteModalOpen(false);
                    setSelectedPlaybook(null);
                  }}
                  className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
