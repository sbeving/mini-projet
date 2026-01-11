"use client";

import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import {
  Activity,
  BarChart3,
  Clock,
  Loader2,
  MessageSquare,
  MousePointer,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
  Eye,
  Filter,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type DateRange = "today" | "7d" | "30d" | "90d";

interface TabProps {
  label: string;
  icon: React.ReactNode;
  value: string;
}

const TABS: TabProps[] = [
  { label: "Overview", icon: <BarChart3 className="h-4 w-4" />, value: "overview" },
  { label: "Users", icon: <Users className="h-4 w-4" />, value: "users" },
  { label: "Activity", icon: <Activity className="h-4 w-4" />, value: "activity" },
  { label: "Chats", icon: <MessageSquare className="h-4 w-4" />, value: "chats" },
];

// API Types
interface PlatformAnalytics {
  summary: {
    totalUsers: number;
    activeUsers: number;
    newUsers: number;
    chatSessions: number;
    chatMessages: number;
    logsIngested: number;
  };
  activityByType: Array<{ type: string; count: number }>;
  topUsers: Array<{ id: string; name: string; email: string; activityCount: number }>;
  dailyStats: Array<{ date: string; users: number; activities: number }>;
}

interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  avgSessionDuration: number;
  userGrowth: Array<{ date: string; count: number; cumulative: number }>;
  usersByRole: Array<{ role: string; count: number }>;
  topActiveUsers: Array<{ id: string; name: string; email: string; role: string; activityCount: number }>;
}

interface ActivityAnalytics {
  activityByType: Array<{ type: string; count: number }>;
  activityByHour: Array<{ hour: number; count: number }>;
  activityByDayOfWeek: Array<{ dayOfWeek: number; count: number }>;
  dailyActivity: Array<{ date: string; count: number }>;
  recentActivities: Array<{
    id: string;
    type: string;
    path?: string;
    duration?: number;
    createdAt: string;
    user?: { id: string; name: string; email: string };
  }>;
}

interface ChatAnalytics {
  totalSessions: number;
  totalMessages: number;
  avgMessagesPerSession: number;
  avgResponseTime: number;
  totalTokensUsed: number;
  messagesByRole: Array<{ role: string; count: number }>;
  topChatters: Array<{ id: string; name: string; email: string; sessionCount: number; totalMessages: number }>;
  recentSessions: Array<{ id: string; title: string; createdAt: string; messageCount: number; user?: { name: string } }>;
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AnalyticsDashboard() {
  const router = useRouter();
  const { isAdmin, loading: authLoading } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState<DateRange>("7d");
  const [refreshing, setRefreshing] = useState(false);

  const [platformData, setPlatformData] = useState<PlatformAnalytics | null>(null);
  const [usersData, setUsersData] = useState<UserAnalytics | null>(null);
  const [activityData, setActivityData] = useState<ActivityAnalytics | null>(null);
  const [chatData, setChatData] = useState<ChatAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push("/dashboard");
    }
  }, [authLoading, isAdmin, router]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const days = dateRange === "today" ? 1 : dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
      const headers = { ...authHeaders() };

      const [platformRes, usersRes, activityRes, chatsRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/analytics/overview?days=${days}`, { headers }),
        fetch(`${API_URL}/api/admin/analytics/users?days=${days}`, { headers }),
        fetch(`${API_URL}/api/admin/analytics/activity?days=${days}`, { headers }),
        fetch(`${API_URL}/api/admin/analytics/chats?days=${days}`, { headers }),
      ]);

      if (!platformRes.ok || !usersRes.ok || !activityRes.ok || !chatsRes.ok) {
        throw new Error("Failed to fetch analytics data");
      }

      const [platform, users, activity, chats] = await Promise.all([
        platformRes.json(),
        usersRes.json(),
        activityRes.json(),
        chatsRes.json(),
      ]);

      setPlatformData(platform);
      setUsersData(users);
      // Normalize activity data structure
      setActivityData({
        ...activity,
        activityByType: activity.activityByType?.map((a: any) => ({
          type: a.type,
          count: a.count ?? a._count?.type ?? 0,
        })) || [],
        activityByDayOfWeek: activity.activityByDayOfWeek?.map((d: any) => ({
          dayOfWeek: d.dayOfWeek ?? d.dow ?? 0,
          count: d.count ?? 0,
        })) || [],
      });
      setChatData(chats);
    } catch (err) {
      console.error("Failed to load analytics:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      addToast({
        type: "error",
        title: "Failed to load analytics",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, [dateRange, addToast]);

  useEffect(() => {
    if (isAdmin) {
      loadData();
    }
  }, [isAdmin, loadData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
    addToast({ type: "success", title: "Analytics refreshed", duration: 2000 });
  };

  const formatDuration = (ms: number) => {
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
  };

  const getDayName = (dow: number) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dow] || '';

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center">
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-muted text-sm">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-foreground">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            Analytics Dashboard
          </h1>
          <p className="text-muted mt-2">Monitor platform usage and engagement</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
            {(["today", "7d", "30d", "90d"] as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 text-sm rounded-lg transition-all font-medium ${
                  dateRange === range
                    ? "bg-primary text-white"
                    : "text-muted hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                {range === "today" ? "Today" : range}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-surface border border-border hover:bg-surface-hover rounded-xl text-muted hover:text-foreground transition-colors"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-xl p-1.5 w-fit overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.value
                ? "bg-primary text-white"
                : "text-muted hover:text-foreground hover:bg-surface-hover"
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={handleRefresh} className="px-4 py-2 bg-primary hover:bg-primary-dark rounded-lg text-white">
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === "overview" && platformData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard title="Total Users" value={platformData.summary.totalUsers} icon={<Users className="h-5 w-5" />} color="primary" subtitle={`${platformData.summary.activeUsers} active`} />
                <MetricCard title="New Users" value={platformData.summary.newUsers} icon={<UserCheck className="h-5 w-5" />} color="success" subtitle="This period" />
                <MetricCard title="Chat Sessions" value={platformData.summary.chatSessions} icon={<MessageSquare className="h-5 w-5" />} color="accent" subtitle={`${platformData.summary.chatMessages} messages`} />
                <MetricCard title="Logs Ingested" value={platformData.summary.logsIngested} icon={<BarChart3 className="h-5 w-5" />} color="warning" subtitle="This period" />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-surface border border-border rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
                    <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                      <Activity className="h-4 w-4 text-primary" />
                    </div>
                    Activity Breakdown
                  </h3>
                  <div className="space-y-3">
                    {platformData.activityByType.length > 0 ? (
                      platformData.activityByType.map((item) => (
                        <div key={item.type} className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-3">
                            <ActivityIcon type={item.type} />
                            <span className="text-sm text-foreground">{item.type.replace(/_/g, " ")}</span>
                          </div>
                          <span className="font-semibold text-foreground bg-surface-hover px-3 py-1 rounded-lg">{item.count}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted py-8">No activity data</p>
                    )}
                  </div>
                </div>

                <div className="bg-surface border border-border rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-foreground">
                    <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                      <Users className="h-4 w-4 text-green-400" />
                    </div>
                    Most Active Users
                  </h3>
                  <div className="space-y-2">
                    {platformData.topUsers.length > 0 ? (
                      platformData.topUsers.slice(0, 5).map((user, i) => (
                        <div key={user.id} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-surface-hover">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white ${
                              i === 0 ? 'bg-yellow-500' :
                              i === 1 ? 'bg-gray-400' :
                              i === 2 ? 'bg-amber-700' : 'bg-gray-600'
                            }`}>{i + 1}</div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{user.name}</p>
                              <p className="text-xs text-muted">{user.email}</p>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-primary">{user.activityCount} actions</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-muted py-8">No users found</p>
                    )}
                  </div>
                </div>
              </div>

              {platformData.dailyStats.length > 0 && (
                <div className="bg-surface border border-border rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Daily Activity Trend</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {platformData.dailyStats.slice(0, 7).reverse().map((day) => (
                      <div key={day.date} className="bg-surface-hover rounded-xl p-3 text-center">
                        <p className="text-xs text-muted">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</p>
                        <p className="text-lg font-bold text-foreground">{day.users}</p>
                        <p className="text-xs text-muted">users</p>
                        <p className="text-sm font-medium text-primary mt-1">{day.activities}</p>
                        <p className="text-xs text-muted">actions</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Users Tab */}
          {activeTab === "users" && usersData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <MetricCard title="Total Users" value={usersData.totalUsers} icon={<Users className="h-5 w-5" />} color="primary" />
                <MetricCard title="Active Users" value={usersData.activeUsers} icon={<UserCheck className="h-5 w-5" />} color="success" subtitle="Last 7 days" />
                <MetricCard title="Inactive Users" value={usersData.inactiveUsers} icon={<Users className="h-5 w-5" />} color="warning" />
                <MetricCard title="Avg Session" value={formatDuration(usersData.avgSessionDuration)} icon={<Clock className="h-5 w-5" />} color="accent" isString />
              </div>

              <div className="bg-surface border border-border rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-foreground">Users by Role</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {usersData.usersByRole.map((item) => (
                    <div key={item.role} className="bg-surface-hover rounded-xl p-4 text-center">
                      <p className="text-3xl font-bold text-foreground">{item.count}</p>
                      <p className="text-sm text-muted mt-1">{item.role}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-foreground">Top Active Users</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-muted">Rank</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-muted">User</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-muted">Role</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-muted">Activities</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {usersData.topActiveUsers.map((user, i) => (
                        <tr key={user.id} className="hover:bg-surface-hover">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold text-white ${
                              i === 0 ? 'bg-yellow-500' :
                              i === 1 ? 'bg-gray-400' :
                              i === 2 ? 'bg-amber-700' : 'bg-gray-600'
                            }`}>{i + 1}</span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{user.name}</p>
                            <p className="text-sm text-muted">{user.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              user.role === 'ADMIN' ? 'bg-red-500/20 text-red-400' :
                              user.role === 'STAFF' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'
                            }`}>{user.role}</span>
                          </td>
                          <td className="px-4 py-3 font-medium text-primary">{user.activityCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Activity Tab */}
          {activeTab === "activity" && activityData && (
            <div className="space-y-6">
              <div className="bg-surface border border-border rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-foreground">Activity by Type</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {activityData.activityByType.map((item) => (
                    <div key={item.type} className="bg-surface-hover rounded-xl p-4 text-center hover:bg-card transition-colors">
                      <ActivityIcon type={item.type} size="lg" />
                      <p className="text-2xl font-bold mt-3 text-foreground">{item.count}</p>
                      <p className="text-xs text-muted mt-1">{item.type.replace(/_/g, " ")}</p>
                    </div>
                  ))}
                </div>
              </div>

              {activityData.activityByHour.length > 0 && (
                <div className="bg-surface border border-border rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Activity by Hour</h3>
                  <div className="flex gap-1 overflow-x-auto pb-2">
                    {Array.from({ length: 24 }, (_, h) => {
                      const hourData = activityData.activityByHour.find((x) => x.hour === h);
                      const count = hourData?.count || 0;
                      const maxCount = Math.max(...activityData.activityByHour.map((x) => x.count), 1);
                      const height = Math.max((count / maxCount) * 100, 5);
                      return (
                        <div key={h} className="flex flex-col items-center min-w-[28px]">
                          <div className="h-24 flex items-end">
                            <div className="w-5 bg-primary rounded-t" style={{ height: `${height}%` }} title={`${count} activities`} />
                          </div>
                          <span className="text-xs text-muted mt-1">{h}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activityData.activityByDayOfWeek.length > 0 && (
                <div className="bg-surface border border-border rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Activity by Day</h3>
                  <div className="grid grid-cols-7 gap-2">
                    {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
                      const dayData = activityData.activityByDayOfWeek.find((x) => x.dayOfWeek === dow);
                      return (
                        <div key={dow} className="bg-surface-hover rounded-xl p-3 text-center">
                          <p className="text-xs text-muted">{getDayName(dow)}</p>
                          <p className="text-xl font-bold text-foreground mt-1">{dayData?.count || 0}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-surface border border-border rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-foreground">Recent Activities</h3>
                <div className="space-y-2">
                  {activityData.recentActivities.length > 0 ? (
                    activityData.recentActivities.slice(0, 10).map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between py-3 px-4 rounded-xl bg-surface-hover hover:bg-card">
                        <div className="flex items-center gap-3">
                          <ActivityIcon type={activity.type} />
                          <div>
                            <p className="text-sm font-medium text-foreground">{activity.user?.name || "Unknown"}</p>
                            <p className="text-xs text-muted">{activity.type.replace(/_/g, " ")}{activity.path && ` • ${activity.path}`}</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted">{new Date(activity.createdAt).toLocaleString()}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted py-8">No recent activities</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Chats Tab */}
          {activeTab === "chats" && chatData && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <MetricCard title="Total Sessions" value={chatData.totalSessions} icon={<MessageSquare className="h-5 w-5" />} color="primary" />
                <MetricCard title="Total Messages" value={chatData.totalMessages} icon={<MessageSquare className="h-5 w-5" />} color="accent" />
                <MetricCard title="Avg per Session" value={chatData.avgMessagesPerSession.toFixed(1)} icon={<BarChart3 className="h-5 w-5" />} color="success" isString />
                <MetricCard title="Avg Response" value={formatDuration(chatData.avgResponseTime)} icon={<Clock className="h-5 w-5" />} color="warning" isString />
                <MetricCard title="Tokens Used" value={chatData.totalTokensUsed} icon={<Activity className="h-5 w-5" />} color="primary" />
              </div>

              <div className="bg-surface border border-border rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-foreground">Messages by Role</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {chatData.messagesByRole.map((item) => (
                    <div key={item.role} className="bg-surface-hover rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.role === 'user' ? 'bg-primary/20 text-primary' : 'bg-green-500/20 text-green-400'}`}>
                          {item.role === 'user' ? <Users className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
                        </div>
                        <span className="font-medium text-foreground capitalize">{item.role}</span>
                      </div>
                      <span className="text-2xl font-bold text-foreground">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-foreground">Top Chatters</h3>
                <div className="space-y-3">
                  {chatData.topChatters.length > 0 ? (
                    chatData.topChatters.map((user, i) => (
                      <div key={user.id} className="flex items-center justify-between py-3 px-4 rounded-xl bg-surface-hover hover:bg-card">
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white ${
                            i === 0 ? 'bg-yellow-500' :
                            i === 1 ? 'bg-gray-400' :
                            i === 2 ? 'bg-amber-700' : 'bg-gray-600'
                          }`}>{i + 1}</span>
                          <div>
                            <p className="font-medium text-foreground">{user.name}</p>
                            <p className="text-xs text-muted">{user.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-primary">{user.sessionCount} sessions</p>
                          <p className="text-xs text-muted">{user.totalMessages} messages</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-muted py-8">No chat data yet</p>
                  )}
                </div>
              </div>

              <div className="bg-surface border border-border rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-foreground">Recent Chat Sessions</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-border">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-muted">Title</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-muted">User</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-muted">Messages</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-muted">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {chatData.recentSessions.map((session) => (
                        <tr key={session.id} className="hover:bg-surface-hover">
                          <td className="px-4 py-3"><p className="font-medium text-foreground truncate max-w-xs">{session.title}</p></td>
                          <td className="px-4 py-3 text-sm text-muted">{session.user?.name || "Unknown"}</td>
                          <td className="px-4 py-3 font-medium text-primary">{session.messageCount}</td>
                          <td className="px-4 py-3 text-sm text-muted">{new Date(session.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface MetricCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: "primary" | "success" | "warning" | "error" | "accent";
  subtitle?: string;
  isString?: boolean;
}

function MetricCard({ title, value, icon, color, subtitle, isString }: MetricCardProps) {
  const colors = {
    primary: "bg-primary/20 text-primary",
    success: "bg-green-500/20 text-green-400",
    warning: "bg-yellow-500/20 text-yellow-400",
    error: "bg-red-500/20 text-red-400",
    accent: "bg-purple-500/20 text-purple-400",
  };

  return (
    <div className="bg-surface border border-border rounded-2xl p-5 hover:bg-surface-hover transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${colors[color]} flex items-center justify-center`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{isString ? value : typeof value === "number" ? value.toLocaleString() : value}</p>
      <p className="text-sm text-muted mt-1">{title}</p>
      {subtitle && <p className="text-xs text-muted mt-0.5">{subtitle}</p>}
    </div>
  );
}

interface ActivityIconProps {
  type: string;
  size?: "sm" | "lg";
}

function ActivityIcon({ type, size = "sm" }: ActivityIconProps) {
  const iconSize = size === "lg" ? "h-6 w-6" : "h-4 w-4";
  const wrapperSize = size === "lg" ? "w-12 h-12" : "w-8 h-8";

  const getIcon = () => {
    switch (type) {
      case "LOGIN":
      case "LOGOUT":
        return <UserCheck className={iconSize} />;
      case "PAGE_VIEW":
        return <Eye className={iconSize} />;
      case "CHAT_MESSAGE":
      case "CHAT_START":
        return <MessageSquare className={iconSize} />;
      case "LOG_VIEW":
        return <BarChart3 className={iconSize} />;
      case "LOG_SEARCH":
        return <Filter className={iconSize} />;
      default:
        return <MousePointer className={iconSize} />;
    }
  };

  const getColor = () => {
    switch (type) {
      case "LOGIN":
      case "LOGOUT":
        return "bg-green-500/20 text-green-400";
      case "PAGE_VIEW":
        return "bg-primary/20 text-primary";
      case "CHAT_MESSAGE":
      case "CHAT_START":
        return "bg-purple-500/20 text-purple-400";
      case "LOG_VIEW":
      case "LOG_SEARCH":
        return "bg-yellow-500/20 text-yellow-400";
      default:
        return "bg-gray-500/20 text-gray-400";
    }
  };

  return (
    <div className={`${wrapperSize} rounded-lg ${getColor()} flex items-center justify-center`}>
      {getIcon()}
    </div>
  );
}
