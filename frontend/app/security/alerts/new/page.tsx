"use client";

import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Loader2,
  Plus,
  Save,
  Shield,
  Trash2,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface AlertRuleCondition {
  field: string;
  operator: "equals" | "contains" | "gt" | "lt" | "regex";
  value: string;
}

interface AlertRule {
  name: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  conditions: AlertRuleCondition[];
  enabled: boolean;
  notifications: {
    email: boolean;
    webhook: boolean;
    webhookUrl?: string;
  };
}

export default function NewAlertPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { addToast } = useToast();

  const [saving, setSaving] = useState(false);
  const [rule, setRule] = useState<AlertRule>({
    name: "",
    description: "",
    severity: "medium",
    conditions: [{ field: "", operator: "equals", value: "" }],
    enabled: true,
    notifications: {
      email: false,
      webhook: false,
    },
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    if (!authLoading && user && !isAdmin) {
      router.push("/security/alerts");
      addToast({
        type: "error",
        title: "Access Denied",
        message: "Only admins can create alert rules",
      });
    }
  }, [authLoading, user, isAdmin, router, addToast]);

  const addCondition = () => {
    setRule((prev) => ({
      ...prev,
      conditions: [...prev.conditions, { field: "", operator: "equals", value: "" }],
    }));
  };

  const removeCondition = (index: number) => {
    if (rule.conditions.length > 1) {
      setRule((prev) => ({
        ...prev,
        conditions: prev.conditions.filter((_, i) => i !== index),
      }));
    }
  };

  const updateCondition = (
    index: number,
    field: keyof AlertRuleCondition,
    value: string
  ) => {
    setRule((prev) => ({
      ...prev,
      conditions: prev.conditions.map((cond, i) =>
        i === index ? { ...cond, [field]: value } : cond
      ),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!rule.name.trim()) {
      addToast({
        type: "warning",
        title: "Validation Error",
        message: "Rule name is required",
      });
      return;
    }

    if (rule.conditions.some((c) => !c.field || !c.value)) {
      addToast({
        type: "warning",
        title: "Validation Error",
        message: "All conditions must have field and value",
      });
      return;
    }

    try {
      setSaving(true);
      const token = localStorage.getItem("logchat_token");
      const response = await fetch(`${API_URL}/api/siem/rules`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(rule),
      });

      if (response.ok) {
        addToast({
          type: "success",
          title: "Rule Created",
          message: "Alert rule has been created successfully",
        });
        router.push("/security/alerts");
      } else {
        const error = await response.json();
        throw new Error(error.message || "Failed to create rule");
      }
    } catch (error) {
      console.error("Create rule error:", error);
      addToast({
        type: "error",
        title: "Error",
        message: error instanceof Error ? error.message : "Failed to create rule",
      });
    } finally {
      setSaving(false);
    }
  };

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
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push("/security/alerts")}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Bell className="h-6 w-6 text-cyan-500" />
                New Alert Rule
              </h1>
              <p className="text-sm text-gray-400">
                Create a new detection rule for security alerts
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-[#12121a] border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="h-5 w-5 text-cyan-500" />
              Rule Details
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Rule Name *</label>
                <input
                  type="text"
                  value={rule.name}
                  onChange={(e) => setRule((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Failed Login Detection"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={rule.description}
                  onChange={(e) =>
                    setRule((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Describe what this rule detects..."
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-cyan-500 resize-none h-24"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Severity</label>
                  <select
                    value={rule.severity}
                    onChange={(e) =>
                      setRule((prev) => ({
                        ...prev,
                        severity: e.target.value as AlertRule["severity"],
                      }))
                    }
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-cyan-500"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Status</label>
                  <div className="flex items-center gap-4 h-12">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) =>
                          setRule((prev) => ({ ...prev, enabled: e.target.checked }))
                        }
                        className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                      />
                      <span>Enable rule immediately</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Conditions */}
          <div className="bg-[#12121a] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Detection Conditions
              </h2>
              <button
                type="button"
                onClick={addCondition}
                className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 rounded-lg text-sm transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add Condition
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              Define conditions that must match for this rule to trigger an alert.
            </p>

            <div className="space-y-3">
              {rule.conditions.map((condition, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-gray-900 rounded-lg"
                >
                  <input
                    type="text"
                    value={condition.field}
                    onChange={(e) => updateCondition(index, "field", e.target.value)}
                    placeholder="Field (e.g., source_ip)"
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-cyan-500 text-sm"
                  />
                  <select
                    value={condition.operator}
                    onChange={(e) =>
                      updateCondition(
                        index,
                        "operator",
                        e.target.value as AlertRuleCondition["operator"]
                      )
                    }
                    className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-cyan-500 text-sm"
                  >
                    <option value="equals">equals</option>
                    <option value="contains">contains</option>
                    <option value="gt">greater than</option>
                    <option value="lt">less than</option>
                    <option value="regex">matches regex</option>
                  </select>
                  <input
                    type="text"
                    value={condition.value}
                    onChange={(e) => updateCondition(index, "value", e.target.value)}
                    placeholder="Value"
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-cyan-500 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    disabled={rule.conditions.length === 1}
                    className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-[#12121a] border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Bell className="h-5 w-5 text-purple-500" />
              Notifications
            </h2>

            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rule.notifications.email}
                  onChange={(e) =>
                    setRule((prev) => ({
                      ...prev,
                      notifications: { ...prev.notifications, email: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                />
                <span>Send email notifications</span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rule.notifications.webhook}
                  onChange={(e) =>
                    setRule((prev) => ({
                      ...prev,
                      notifications: { ...prev.notifications, webhook: e.target.checked },
                    }))
                  }
                  className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                />
                <span>Send webhook notifications</span>
              </label>

              {rule.notifications.webhook && (
                <div>
                  <label className="block text-sm font-medium mb-2">Webhook URL</label>
                  <input
                    type="url"
                    value={rule.notifications.webhookUrl || ""}
                    onChange={(e) =>
                      setRule((prev) => ({
                        ...prev,
                        notifications: {
                          ...prev.notifications,
                          webhookUrl: e.target.value,
                        },
                      }))
                    }
                    placeholder="https://..."
                    className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <button
              type="button"
              onClick={() => router.push("/security/alerts")}
              className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Create Rule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
