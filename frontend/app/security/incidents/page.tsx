'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getStoredToken } from '@/lib/api';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Incident {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'in_progress' | 'contained' | 'resolved' | 'closed';
  priority: number;
  assignee?: string;
  category: string;
  affectedAssets: string[];
  timeline: TimelineEvent[];
  relatedThreats: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

interface TimelineEvent {
  id: string;
  type: 'created' | 'status_change' | 'assignment' | 'note' | 'action' | 'playbook';
  description: string;
  actor: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface Playbook {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: number;
  automated: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function IncidentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showNewIncidentModal, setShowNewIncidentModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');

  const fetchIncidents = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (severityFilter) params.append('severity', severityFilter);
      
      const response = await fetch(`${API_BASE}/api/siem/incidents?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!response.ok) throw new Error('Failed to fetch incidents');
      
      const result = await response.json();
      if (result.success) {
        setIncidents(result.data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter]);

  const fetchPlaybooks = useCallback(async () => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/siem/playbooks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setPlaybooks(result.data || []);
        }
      }
    } catch (err) {
      console.error('Failed to fetch playbooks:', err);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
      return;
    }
    fetchIncidents();
    fetchPlaybooks();
  }, [authLoading, user, router, fetchIncidents, fetchPlaybooks]);

  const updateIncidentStatus = async (incidentId: string, newStatus: string) => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/siem/incidents/${incidentId}/status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      if (response.ok) {
        fetchIncidents();
        if (selectedIncident?.id === incidentId) {
          const result = await response.json();
          setSelectedIncident(result.data);
        }
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  const assignIncident = async (incidentId: string, assignee: string) => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/siem/incidents/${incidentId}/assign`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ assignee }),
      });
      
      if (response.ok) {
        fetchIncidents();
      }
    } catch (err) {
      console.error('Failed to assign incident:', err);
    }
  };

  const runPlaybook = async (incidentId: string, playbookId: string) => {
    const token = getStoredToken();
    if (!token) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/siem/playbooks/${playbookId}/run`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ incidentId }),
      });
      
      if (response.ok) {
        // Refresh incident to show timeline update
        fetchIncidents();
        alert('Playbook execution started!');
      }
    } catch (err) {
      console.error('Failed to run playbook:', err);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-red-400 bg-red-400/10';
      case 'in_progress': return 'text-yellow-400 bg-yellow-400/10';
      case 'contained': return 'text-blue-400 bg-blue-400/10';
      case 'resolved': return 'text-green-400 bg-green-400/10';
      case 'closed': return 'text-gray-400 bg-gray-400/10';
      default: return 'text-gray-400 bg-gray-400/10';
    }
  };

  const getTimelineIcon = (type: string) => {
    switch (type) {
      case 'created': return '🆕';
      case 'status_change': return '🔄';
      case 'assignment': return '👤';
      case 'note': return '📝';
      case 'action': return '⚡';
      case 'playbook': return '📚';
      default: return '•';
    }
  };

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
              <span className="text-gray-200">Incidents</span>
            </div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <span className="text-3xl">🚨</span>
              Incident Response
            </h1>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowNewIncidentModal(true)}
              className="px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded-lg transition-all flex items-center gap-2"
            >
              ➕ New Incident
            </button>
            <button
              onClick={fetchIncidents}
              className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 rounded-lg transition-all"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap gap-4">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-[#1a1a24] border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="contained">Contained</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="px-4 py-2 bg-[#1a1a24] border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
            >
              <option value="">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <span className="text-gray-500 text-sm self-center ml-auto">
              {incidents.length} incidents found
            </span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
            ⚠️ {error}
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Incidents List */}
          <div className={`${selectedIncident ? 'lg:col-span-1' : 'lg:col-span-3'} space-y-3`}>
            {loading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto" />
              </div>
            ) : incidents.length === 0 ? (
              <div className="text-center py-12 bg-[#12121a] border border-gray-800 rounded-xl">
                <span className="text-5xl mb-4 block">📋</span>
                <p className="text-gray-400">No incidents found</p>
              </div>
            ) : (
              incidents.map((incident) => (
                <div
                  key={incident.id}
                  onClick={() => setSelectedIncident(incident)}
                  className={`p-4 bg-[#12121a] border rounded-xl cursor-pointer transition-all hover:bg-[#1a1a24] ${
                    selectedIncident?.id === incident.id 
                      ? 'border-cyan-500/50 ring-1 ring-cyan-500/30' 
                      : 'border-gray-800 hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 text-xs rounded border ${getSeverityColor(incident.severity)}`}>
                        {incident.severity.toUpperCase()}
                      </span>
                      <span className={`px-2 py-0.5 text-xs rounded ${getStatusColor(incident.status)}`}>
                        {incident.status.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">P{incident.priority}</span>
                  </div>
                  <h3 className="font-medium text-gray-200 mb-1">{incident.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2">{incident.description}</p>
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-600">
                    <span>📁 {incident.category}</span>
                    <span>{incident.assignee ? `👤 ${incident.assignee}` : 'Unassigned'}</span>
                    <span>{new Date(incident.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Incident Detail Panel */}
          {selectedIncident && (
            <div className="lg:col-span-2 space-y-4">
              {/* Header */}
              <div className="bg-[#12121a] border border-gray-800 rounded-xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-sm rounded border ${getSeverityColor(selectedIncident.severity)}`}>
                        {selectedIncident.severity.toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 text-sm rounded ${getStatusColor(selectedIncident.status)}`}>
                        {selectedIncident.status.replace('_', ' ')}
                      </span>
                      <span className="text-sm text-gray-500">Priority {selectedIncident.priority}</span>
                    </div>
                    <h2 className="text-xl font-bold">{selectedIncident.title}</h2>
                  </div>
                  <button
                    onClick={() => setSelectedIncident(null)}
                    className="p-2 hover:bg-gray-800 rounded-lg"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-gray-400 mb-4">{selectedIncident.description}</p>
                
                {/* Status Actions */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {['open', 'in_progress', 'contained', 'resolved', 'closed'].map(status => (
                    <button
                      key={status}
                      onClick={() => updateIncidentStatus(selectedIncident.id, status)}
                      className={`px-3 py-1.5 text-sm rounded-lg border transition-all ${
                        selectedIncident.status === status
                          ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400'
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {status.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                {/* Quick Actions */}
                <div className="flex gap-3">
                  <Link
                    href={`/security/investigate?incident=${selectedIncident.id}`}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30 rounded-lg flex items-center gap-2"
                  >
                    🔍 AI Investigation
                  </Link>
                  <button
                    onClick={() => assignIncident(selectedIncident.id, user?.name || 'Current User')}
                    className="px-4 py-2 bg-[#1a1a24] border border-gray-700 rounded-lg flex items-center gap-2"
                  >
                    👤 Assign to Me
                  </button>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Category</h4>
                  <p className="font-medium">{selectedIncident.category}</p>
                </div>
                <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Assignee</h4>
                  <p className="font-medium">{selectedIncident.assignee || 'Unassigned'}</p>
                </div>
                <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Created</h4>
                  <p className="font-medium">{new Date(selectedIncident.createdAt).toLocaleString()}</p>
                </div>
                <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-2">Last Updated</h4>
                  <p className="font-medium">{new Date(selectedIncident.updatedAt).toLocaleString()}</p>
                </div>
              </div>

              {/* Affected Assets */}
              {selectedIncident.affectedAssets?.length > 0 && (
                <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
                  <h4 className="text-sm font-medium text-gray-500 mb-3">Affected Assets</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedIncident.affectedAssets.map((asset, i) => (
                      <span key={i} className="px-3 py-1 bg-[#1a1a24] rounded-lg text-sm">
                        🖥️ {asset}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Playbooks */}
              <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
                <h4 className="text-sm font-medium text-gray-500 mb-3">Response Playbooks</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {playbooks.slice(0, 4).map((playbook) => (
                    <div
                      key={playbook.id}
                      className="p-3 bg-[#1a1a24] border border-gray-700 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-sm">{playbook.name}</span>
                        {playbook.automated && (
                          <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
                            Auto
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mb-2">{playbook.description}</p>
                      <button
                        onClick={() => runPlaybook(selectedIncident.id, playbook.id)}
                        className="w-full px-3 py-1.5 text-sm bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-lg transition-all"
                      >
                        ▶️ Run Playbook
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Timeline */}
              <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
                <h4 className="text-sm font-medium text-gray-500 mb-4">Timeline</h4>
                <div className="space-y-4">
                  {selectedIncident.timeline?.length > 0 ? (
                    selectedIncident.timeline.map((event, i) => (
                      <div key={event.id || i} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className="text-xl">{getTimelineIcon(event.type)}</span>
                          {i < selectedIncident.timeline.length - 1 && (
                            <div className="w-px h-full bg-gray-700 my-2" />
                          )}
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-sm text-gray-200">{event.description}</p>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                            <span>{event.actor}</span>
                            <span>•</span>
                            <span>{new Date(event.timestamp).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm">No timeline events yet</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* New Incident Modal */}
      {showNewIncidentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-[#12121a] border border-gray-800 rounded-xl max-w-lg w-full p-6">
            <h3 className="text-xl font-bold mb-4">Create New Incident</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              // Handle form submission
              setShowNewIncidentModal(false);
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Title</label>
                  <input
                    type="text"
                    className="w-full px-4 py-2 bg-[#1a1a24] border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none"
                    placeholder="Incident title..."
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Description</label>
                  <textarea
                    rows={3}
                    className="w-full px-4 py-2 bg-[#1a1a24] border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none resize-none"
                    placeholder="Describe the incident..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
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
                    <label className="block text-sm text-gray-400 mb-1">Category</label>
                    <select className="w-full px-4 py-2 bg-[#1a1a24] border border-gray-700 rounded-lg focus:border-cyan-500 focus:outline-none">
                      <option value="malware">Malware</option>
                      <option value="phishing">Phishing</option>
                      <option value="data_breach">Data Breach</option>
                      <option value="unauthorized_access">Unauthorized Access</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewIncidentModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-700 rounded-lg hover:bg-gray-800 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 text-orange-400 rounded-lg transition-all"
                >
                  Create Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
