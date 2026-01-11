"use client";

import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/Toast";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Copy,
  Database,
  ExternalLink,
  FileText,
  Globe,
  Hash,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  Upload,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface IOC {
  type: "ip" | "domain" | "url" | "hash" | "email";
  value: string;
  context?: string;
}

interface ThreatIntelFeed {
  id: string;
  name: string;
  description: string;
  url: string;
  type: string;
  lastUpdated: string;
  iocCount: number;
  enabled: boolean;
}

interface ThreatIntelStats {
  totalIOCs: number;
  byType: Record<string, number>;
  feedCount: number;
  lastUpdated: string;
}

export default function IOCsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { addToast } = useToast();

  const [iocs, setIocs] = useState<IOC[]>([]);
  const [feeds, setFeeds] = useState<ThreatIntelFeed[]>([]);
  const [stats, setStats] = useState<ThreatIntelStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [extractText, setExtractText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [activeTab, setActiveTab] = useState<"iocs" | "feeds" | "extract">("iocs");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

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

      const [statsRes, feedsRes] = await Promise.all([
        fetch(`${API_URL}/api/siem/threat-intel/stats`, { headers }),
        fetch(`${API_URL}/api/siem/threat-intel/feeds`, { headers }),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
      if (feedsRes.ok) {
        const data = await feedsRes.json();
        setFeeds(data.feeds || data || []);
      }
    } catch (error) {
      console.error("Failed to fetch IOC data:", error);
      addToast({
        type: "error",
        title: "Error",
        message: "Failed to load IOC data",
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

  const extractIOCs = async () => {
    if (!extractText.trim()) {
      addToast({
        type: "warning",
        title: "Empty Text",
        message: "Please enter text to extract IOCs from",
      });
      return;
    }

    try {
      setExtracting(true);
      const token = localStorage.getItem("logchat_token");
      const response = await fetch(`${API_URL}/api/siem/threat-intel/extract`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: extractText }),
      });

      if (response.ok) {
        const data = await response.json();
        setIocs(data.iocs || []);
        addToast({
          type: "success",
          title: "IOCs Extracted",
          message: `Found ${data.count || data.iocs?.length || 0} indicators`,
        });
        setActiveTab("iocs");
      } else {
        throw new Error("Failed to extract IOCs");
      }
    } catch (error) {
      console.error("Extract error:", error);
      addToast({
        type: "error",
        title: "Error",
        message: "Failed to extract IOCs",
      });
    } finally {
      setExtracting(false);
    }
  };

  const lookupIOC = async (ioc: IOC) => {
    try {
      const token = localStorage.getItem("logchat_token");
      const response = await fetch(`${API_URL}/api/siem/threat-intel/lookup`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ type: ioc.type, value: ioc.value }),
      });

      if (response.ok) {
        const data = await response.json();
        addToast({
          type: "info",
          title: "Lookup Result",
          message: data.found
            ? `Found in ${data.sources?.length || 0} threat feeds`
            : "Not found in threat intelligence feeds",
        });
      }
    } catch (error) {
      console.error("Lookup error:", error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addToast({
      type: "success",
      title: "Copied",
      message: "IOC copied to clipboard",
    });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "ip":
        return <Globe className="h-4 w-4" />;
      case "domain":
        return <Globe className="h-4 w-4" />;
      case "url":
        return <ExternalLink className="h-4 w-4" />;
      case "hash":
        return <Hash className="h-4 w-4" />;
      case "email":
        return <FileText className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "ip":
        return "text-blue-400 bg-blue-400/10";
      case "domain":
        return "text-purple-400 bg-purple-400/10";
      case "url":
        return "text-cyan-400 bg-cyan-400/10";
      case "hash":
        return "text-orange-400 bg-orange-400/10";
      case "email":
        return "text-green-400 bg-green-400/10";
      default:
        return "text-gray-400 bg-gray-400/10";
    }
  };

  const filteredIOCs = iocs.filter((ioc) => {
    const matchesSearch = ioc.value.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || ioc.type === filterType;
    return matchesSearch && matchesType;
  });

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
                  <Database className="h-6 w-6 text-cyan-500" />
                  Indicators of Compromise
                </h1>
                <p className="text-sm text-gray-400">
                  Extract, manage, and lookup threat indicators
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
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-500/10 rounded-lg">
                  <Shield className="h-5 w-5 text-cyan-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Total IOCs</p>
                  <p className="text-2xl font-bold">{stats.totalIOCs}</p>
                </div>
              </div>
            </div>
            <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Globe className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">IPs</p>
                  <p className="text-2xl font-bold">{stats.byType?.ip || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <Hash className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Hashes</p>
                  <p className="text-2xl font-bold">{stats.byType?.hash || 0}</p>
                </div>
              </div>
            </div>
            <div className="bg-[#12121a] border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Database className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Feeds</p>
                  <p className="text-2xl font-bold">{stats.feedCount}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: "iocs", label: "IOC List", icon: Shield },
            { id: "feeds", label: "Threat Feeds", icon: Database },
            { id: "extract", label: "Extract IOCs", icon: Upload },
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

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
          </div>
        ) : activeTab === "iocs" ? (
          <div>
            {/* Search and Filter */}
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search IOCs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[#12121a] border border-gray-800 rounded-xl focus:outline-none focus:border-cyan-500"
                />
              </div>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="px-4 py-3 bg-[#12121a] border border-gray-800 rounded-xl focus:outline-none focus:border-cyan-500"
              >
                <option value="all">All Types</option>
                <option value="ip">IP Addresses</option>
                <option value="domain">Domains</option>
                <option value="url">URLs</option>
                <option value="hash">Hashes</option>
                <option value="email">Emails</option>
              </select>
            </div>

            {/* IOC List */}
            {filteredIOCs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No IOCs found</p>
                <p className="text-sm mt-2">Extract IOCs from text using the Extract tab</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredIOCs.map((ioc, index) => (
                  <div
                    key={index}
                    className="bg-[#12121a] border border-gray-800 rounded-xl p-4 flex items-center justify-between hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`p-2 rounded-lg ${getTypeColor(ioc.type)}`}>
                        {getTypeIcon(ioc.type)}
                      </span>
                      <div>
                        <code className="text-sm font-mono">{ioc.value}</code>
                        {ioc.context && (
                          <p className="text-xs text-gray-500 mt-1">{ioc.context}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(
                          ioc.type
                        )}`}
                      >
                        {ioc.type.toUpperCase()}
                      </span>
                      <button
                        onClick={() => copyToClipboard(ioc.value)}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                        title="Copy"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => lookupIOC(ioc)}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                        title="Lookup"
                      >
                        <Search className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : activeTab === "feeds" ? (
          <div className="space-y-4">
            {feeds.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No threat feeds configured</p>
              </div>
            ) : (
              feeds.map((feed) => (
                <div
                  key={feed.id}
                  className="bg-[#12121a] border border-gray-800 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{feed.name}</h3>
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            feed.enabled
                              ? "bg-green-500/10 text-green-400"
                              : "bg-gray-500/10 text-gray-400"
                          }`}
                        >
                          {feed.enabled ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400">{feed.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>{feed.type}</span>
                        <span>{feed.iocCount} IOCs</span>
                        <span>
                          Updated: {new Date(feed.lastUpdated).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="bg-[#12121a] border border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Upload className="h-5 w-5 text-cyan-500" />
              Extract IOCs from Text
            </h3>
            <p className="text-gray-400 mb-4">
              Paste text containing potential indicators (IPs, domains, URLs, hashes,
              emails) to automatically extract them.
            </p>
            <textarea
              value={extractText}
              onChange={(e) => setExtractText(e.target.value)}
              placeholder="Paste logs, reports, or any text containing potential IOCs..."
              className="w-full h-48 p-4 bg-gray-900 border border-gray-700 rounded-xl focus:outline-none focus:border-cyan-500 resize-none font-mono text-sm"
            />
            <div className="flex justify-end mt-4">
              <button
                onClick={extractIOCs}
                disabled={extracting || !extractText.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {extracting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                Extract IOCs
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
