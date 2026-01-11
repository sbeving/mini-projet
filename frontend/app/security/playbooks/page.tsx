"use client";

import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Clock,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Zap,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface PlaybookStep {
  id: string;
  name: string;
  action: string;
  parameters: Record<string, unknown>;
  onSuccess?: string;
  onFailure?: string;
}

interface Playbook {
  id: string;
  name: string;
  description: string;
  trigger: {
    type: string;
    conditions: Array<{
      field: string;
      operator: string;
      value: unknown;
    }>;
  };
  steps: PlaybookStep[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  executionCount?: number;
  lastExecutedAt?: string;
}

export default function PlaybooksPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { addToast } = useToast();

  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [authLoading, user, router]);

  const fetchPlaybooks = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("logchat_token");
      const response = await fetch(`${API_URL}/api/siem/playbooks`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setPlaybooks(data.playbooks || data || []);
      }
    } catch (error) {
      console.error("Failed to fetch playbooks:", error);
      addToast({
        type: "error",
        title: "Error",
        message: "Failed to load playbooks",
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    if (user) {
      fetchPlaybooks();
    }
  }, [user, fetchPlaybooks]);

  const executePlaybook = async (playbookId: string) => {
    try {
      const token = localStorage.getItem("logchat_token");
      const response = await fetch(
        `${API_URL}/api/siem/soar/playbooks/${playbookId}/execute`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ context: {} }),
        }
      );

      if (response.ok) {
        addToast({
          type: "success",
          title: "Playbook Executed",
          message: "Playbook execution started successfully",
        });
        fetchPlaybooks();
      } else {
        throw new Error("Failed to execute playbook");
      }
    } catch (error) {
      console.error("Execute error:", error);
      addToast({
        type: "error",
        title: "Error",
        message: "Failed to execute playbook",
      });
    }
  };

  const filteredPlaybooks = playbooks.filter(
    (pb) =>
      pb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pb.description.toLowerCase().includes(searchQuery.toLowerCase())
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
                  <BookOpen className="h-6 w-6 text-cyan-500" />
                  Security Playbooks
                </h1>
                <p className="text-sm text-gray-400">
                  Automated response playbooks for security incidents
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {isAdmin && (
                <button
                  onClick={() => router.push("/security/soar")}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Create Playbook
                </button>
              )}
              <button
                onClick={fetchPlaybooks}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-500/10 rounded-lg">
                <BookOpen className="h-5 w-5 text-cyan-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Playbooks</p>
                <p className="text-2xl font-bold">{playbooks.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Zap className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Active Playbooks</p>
                <p className="text-2xl font-bold">
                  {playbooks.filter((p) => p.enabled).length}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Play className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Executions</p>
                <p className="text-2xl font-bold">
                  {playbooks.reduce((sum, p) => sum + (p.executionCount || 0), 0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
          <input
            type="text"
            placeholder="Search playbooks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-[#12121a] border border-gray-800 rounded-xl focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Playbooks List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPlaybooks.length === 0 ? (
              <div className="col-span-2 text-center py-12 text-gray-500">
                <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No playbooks found</p>
              </div>
            ) : (
              filteredPlaybooks.map((playbook) => (
                <div
                  key={playbook.id}
                  className="bg-[#12121a] border border-gray-800 rounded-xl p-4 hover:border-gray-700 transition-colors cursor-pointer"
                  onClick={() => setSelectedPlaybook(playbook)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{playbook.name}</h3>
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            playbook.enabled
                              ? "bg-green-500/10 text-green-400"
                              : "bg-gray-500/10 text-gray-400"
                          }`}
                        >
                          {playbook.enabled ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 line-clamp-2">
                        {playbook.description}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-500" />
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <Settings className="h-3 w-3" />
                      {playbook.steps.length} steps
                    </span>
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {playbook.trigger.type}
                    </span>
                    {playbook.executionCount !== undefined && (
                      <span className="flex items-center gap-1">
                        <Play className="h-3 w-3" />
                        {playbook.executionCount} runs
                      </span>
                    )}
                  </div>

                  {isAdmin && (
                    <div className="mt-3 pt-3 border-t border-gray-800">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          executePlaybook(playbook.id);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 rounded-lg text-sm transition-colors"
                      >
                        <Play className="h-3 w-3" />
                        Execute Now
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Playbook Detail Modal */}
        {selectedPlaybook && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[#12121a] border border-gray-800 rounded-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold">{selectedPlaybook.name}</h2>
                    <p className="text-gray-400">{selectedPlaybook.description}</p>
                  </div>
                  <button
                    onClick={() => setSelectedPlaybook(null)}
                    className="p-2 hover:bg-gray-800 rounded-lg"
                  >
                    ×
                  </button>
                </div>

                <div className="mb-4">
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-cyan-500" />
                    Trigger
                  </h3>
                  <div className="bg-gray-900 rounded-lg p-3 text-sm">
                    <p>Type: {selectedPlaybook.trigger.type}</p>
                    <p>
                      Conditions: {selectedPlaybook.trigger.conditions.length} rule(s)
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-2">
                    <Settings className="h-4 w-4 text-purple-500" />
                    Steps ({selectedPlaybook.steps.length})
                  </h3>
                  <div className="space-y-2">
                    {selectedPlaybook.steps.map((step, index) => (
                      <div
                        key={step.id}
                        className="bg-gray-900 rounded-lg p-3 flex items-center gap-3"
                      >
                        <div className="w-6 h-6 rounded-full bg-cyan-600 flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        <div>
                          <p className="font-medium">{step.name}</p>
                          <p className="text-sm text-gray-400">{step.action}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedPlaybook.lastExecutedAt && (
                  <div className="mt-4 pt-4 border-t border-gray-800 text-sm text-gray-400 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Last executed:{" "}
                    {new Date(selectedPlaybook.lastExecutedAt).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
