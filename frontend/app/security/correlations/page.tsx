"use client";

import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Clock,
  Filter,
  GitBranch,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Zap,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface CorrelationRule {
  id: string;
  name: string;
  description: string;
  conditions: Array<{
    field: string;
    operator: string;
    value: string;
  }>;
  timeWindow: number;
  threshold: number;
  severity: "low" | "medium" | "high" | "critical";
  enabled: boolean;
}

interface CorrelatedEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  timestamp: string;
  events: Array<{
    id: string;
    type: string;
    source: string;
    timestamp: string;
  }>;
  severity: string;
  score: number;
}

interface CorrelationStats {
  totalRules: number;
  enabledRules: number;
  eventsCorrelated: number;
  alertsGenerated: number;
}

export default function CorrelationsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { addToast } = useToast();

  const [rules, setRules] = useState<CorrelationRule[]>([]);
  const [events, setEvents] = useState<CorrelatedEvent[]>([]);
  const [stats, setStats] = useState<CorrelationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"rules" | "events" | "stats">("rules");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("logchat_token");
      const headers = { Authorization: `Bearer ${token}` };

      const [rulesRes, eventsRes, statsRes] = await Promise.all([
        fetch(`${API_URL}/api/siem/correlations`, { headers }),
        fetch(`${API_URL}/api/siem/correlations/events?limit=50`, { headers }),
        fetch(`${API_URL}/api/siem/correlations/stats`, { headers }),
      ]);

      if (rulesRes.ok) {
        const rulesData = await rulesRes.json();
        setRules(rulesData.rules || rulesData || []);
      }
      if (eventsRes.ok) {
        const eventsData = await eventsRes.json();
        setEvents(eventsData.events || eventsData || []);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error("Failed to fetch correlations:", error);
      addToast({
        type: "error",
        title: "Error",
        message: "Failed to load correlation data",
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "text-red-400 bg-red-400/10";
      case "high":
        return "text-orange-400 bg-orange-400/10";
      case "medium":
        return "text-yellow-400 bg-yellow-400/10";
      default:
        return "text-blue-400 bg-blue-400/10";
    }
  };

  const filteredRules = rules.filter(
    (rule) =>
      rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-[#0d0d15]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/security")}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <GitBranch className="h-6 w-6 text-cyan-500" />
                  Event Correlations
                </h1>
                <p className="text-sm text-gray-400">
                  Correlation rules and detected event patterns
                </p>
              </div>
            </div>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 rounded-lg">
                  <Shield className="h-5 w-5 text-cyan-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Total Rules</p>
                  <p className="text-2xl font-bold">{stats.totalRules}</p>
                </div>
              </div>
            </div>
            <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/10 rounded-lg">
                  <Zap className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Enabled Rules</p>
                  <p className="text-2xl font-bold">{stats.enabledRules}</p>
                </div>
              </div>
            </div>
            <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Activity className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Events Correlated</p>
                  <p className="text-2xl font-bold">{stats.eventsCorrelated}</p>
                </div>
              </div>
            </div>
            <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Alerts Generated</p>
                  <p className="text-2xl font-bold">{stats.alertsGenerated}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: "rules", label: "Correlation Rules", icon: Filter },
            { id: "events", label: "Correlated Events", icon: GitBranch },
            { id: "stats", label: "Statistics", icon: BarChart3 },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                activeTab === tab.id
                  ? "bg-cyan-600 text-white"
                  : "bg-[#12121a] text-gray-400 hover:bg-gray-800"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search rules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#12121a] border border-gray-800 rounded-xl focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          </div>
        ) : activeTab === "rules" ? (
          <div className="space-y-4">
            {filteredRules.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No correlation rules found</p>
              </div>
            ) : (
              filteredRules.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-[#12121a] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{rule.name}</h3>
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(
                            rule.severity
                          )}`}
                        >
                          {rule.severity}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            rule.enabled
                              ? "bg-green-500/10 text-green-400"
                              : "bg-gray-500/10 text-gray-400"
                          }`}
                        >
                          {rule.enabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-3">{rule.description}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Time Window: {rule.timeWindow}s
                        </span>
                        <span>Threshold: {rule.threshold}</span>
                        <span>Conditions: {rule.conditions.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : activeTab === "events" ? (
          <div className="space-y-4">
            {events.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No correlated events found</p>
              </div>
            ) : (
              events.map((event) => (
                <div
                  key={event.id}
                  className="bg-[#12121a] border border-gray-800 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold">{event.ruleName}</h3>
                      <p className="text-sm text-gray-400">
                        {new Date(event.timestamp).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${getSeverityColor(
                          event.severity
                        )}`}
                      >
                        {event.severity}
                      </span>
                      <span className="text-sm text-gray-400">
                        Score: {event.score}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-400">
                    {event.events.length} events correlated
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="bg-[#12121a] border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">Correlation Statistics</h3>
            <div className="text-gray-400">
              View detailed statistics about correlation performance and detection rates.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
