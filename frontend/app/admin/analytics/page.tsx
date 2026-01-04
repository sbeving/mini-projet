"use client";

import { useToast } from "@/components/Toast";
import { useAuth } from "@/lib/auth-context";
import {
  ActivityAnalytics,
  ChatAnalytics,
  fetchActivityAnalytics,
  fetchChatAnalytics,
  fetchPlatformAnalytics,
  fetchUserAnalytics,
  PlatformAnalytics,
  UserAnalytics,
} from "@/lib/api";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Clock,
  Eye,
  Filter,
  Loader2,
  MessageSquare,
  MousePointer,
  RefreshCw,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

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

      const [platform, users, activity, chats] = await Promise.all([
        fetchPlatformAnalytics(days),
        fetchUserAnalytics(days),
        fetchActivityAnalytics(days),
        fetchChatAnalytics(days),
      ]);

      setPlatformData(platform);
      setUsersData(users);
      setActivityData(activity);
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
          <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl animate-pulse">
            <BarChart3 className="h-8 w-8 text-white" />
          </div>
          <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          <p className="text-slate-400 text-sm">Loading analytics...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="space-y-6 p-4 md:p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950/50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-white">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            Analytics Dashboard
          </h1>
          <p className="text-slate-400 mt-2">Monitor platform usage and engagement</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-800/50 backdrop-blur border border-white/10 rounded-xl p-1">
            {(["today", "7d", "30d", "90d"] as DateRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-4 py-2 text-sm rounded-lg transition-all font-medium ${
                  dateRange === range
                    ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {range === "today" ? "Today" : range}
              </button>
            ))}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2.5 bg-slate-800/50 border border-white/10 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white"
          >
            <RefreshCw className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 border border-white/10 rounded-xl p-1.5 w-fit overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.value
                ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg"
                : "text-slate-400 hover:text-white hover:bg-white/5"
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
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={handleRefresh} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white">
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
                <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                      <Activity className="h-4 w-4 text-white" />
                    </div>
                    Activity Breakdown
                  </h3>
                  <div className="space-y-3">
                    {platformData.activityByType.length > 0 ? (
                      platformData.activityByType.map((item) => (
                        <div key={item.type} className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-3">
                            <ActivityIcon type={item.type} />
                            <span className="text-sm text-slate-300">{item.type.replace(/_/g, " ")}</span>
                          </div>
                          <span className="font-semibold text-white bg-slate-700/50 px-3 py-1 rounded-lg">{item.count}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-slate-500 py-8">No activity data</p>
                    )}
                  </div>
                </div>

                <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                      <Users className="h-4 w-4 text-white" />
                    </div>
                    Most Active Users
                  </h3>
                  <div className="space-y-2">
                    {platformData.topUsers.length > 0 ? (
                      platformData.topUsers.slice(0, 5).map((user, i) => (
                        <div key={user.id} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-white/5">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white ${
                              i === 0 ? 'bg-gradient-to-br from-amber-400 to-orange-500' :
                              i === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400' :
                              i === 2 ? 'bg-gradient-to-br from-amber-600 to-amber-700' : 'bg-slate-700'
                            }`}>{i + 1}</div>
                            <div>
                              <p className="text-sm font-medium text-white">{user.name}</p>
                              <p className="text-xs text-slate-400">{user.email}</p>
                            </div>
                          </div>
                          <span className="text-sm font-medium text-indigo-400">{user.activityCount} actions</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-center text-slate-500 py-8">No users found</p>
                    )}
                  </div>
                </div>
              </div>

              {platformData.dailyStats.length > 0 && (
                <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 text-white">Daily Activity Trend</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {platformData.dailyStats.slice(0, 7).reverse().map((day) => (
                      <div key={day.date} className="bg-slate-700/50 rounded-xl p-3 text-center">
                        <p className="text-xs text-slate-400">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}</p>
                        <p className="text-lg font-bold text-white">{day.users}</p>
                        <p className="text-xs text-slate-400">users</p>
                        <p className="text-sm font-medium text-indigo-400 mt-1">{day.activities}</p>
                        <p className="text-xs text-slate-400">actions</p>
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

              <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-white">Users by Role</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {usersData.usersByRole.map((item) => (
                    <div key={item.role} className="bg-slate-700/50 rounded-xl p-4 text-center">
                      <p className="text-3xl font-bold text-white">{item.count}</p>
                      <p className="text-sm text-slate-400 mt-1">{item.role}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-white">Top Active Users</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-white/10">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Rank</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">User</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Role</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Activities</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {usersData.topActiveUsers.map((user, i) => (
                        <tr key={user.id} className="hover:bg-white/5">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold ${
                              i === 0 ? 'bg-amber-500/20 text-amber-400' :
                              i === 1 ? 'bg-slate-400/20 text-slate-300' :
                              i === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-slate-700 text-slate-400'
                            }`}>{i + 1}</span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-white">{user.name}</p>
                            <p className="text-sm text-slate-400">{user.email}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              user.role === 'ADMIN' ? 'bg-purple-500/20 text-purple-400' :
                              user.role === 'STAFF' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-600/50 text-slate-300'
                            }`}>{user.role}</span>
                          </td>
                          <td className="px-4 py-3 font-medium text-indigo-400">{user.activityCount}</td>
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
              <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-white">Activity by Type</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {activityData.activityByType.map((item) => (
                    <div key={item.type} className="bg-slate-700/50 rounded-xl p-4 text-center hover:bg-slate-700 transition-colors">
                      <ActivityIcon type={item.type} size="lg" />
                      <p className="text-2xl font-bold mt-3 text-white">{item._count.type}</p>
                      <p className="text-xs text-slate-400 mt-1">{item.type.replace(/_/g, " ")}</p>
                    </div>
                  ))}
                </div>
              </div>

              {activityData.activityByHour.length > 0 && (
                <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 text-white">Activity by Hour</h3>
                  <div className="flex gap-1 overflow-x-auto pb-2">
                    {Array.from({ length: 24 }, (_, h) => {
                      const hourData = activityData.activityByHour.find((x) => x.hour === h);
                      const count = hourData?.count || 0;
                      const maxCount = Math.max(...activityData.activityByHour.map((x) => x.count), 1);
                      const height = Math.max((count / maxCount) * 100, 5);
                      return (
                        <div key={h} className="flex flex-col items-center min-w-[28px]">
                          <div className="h-24 flex items-end">
                            <div className="w-5 bg-gradient-to-t from-indigo-600 to-purple-500 rounded-t" style={{ height: `${height}%` }} title={`${count} activities`} />
                          </div>
                          <span className="text-xs text-slate-500 mt-1">{h}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {activityData.activityByDayOfWeek.length > 0 && (
                <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold mb-4 text-white">Activity by Day</h3>
                  <div className="grid grid-cols-7 gap-2">
                    {[0, 1, 2, 3, 4, 5, 6].map((dow) => {
                      const dayData = activityData.activityByDayOfWeek.find((x) => x.dow === dow);
                      return (
                        <div key={dow} className="bg-slate-700/50 rounded-xl p-3 text-center">
                          <p className="text-xs text-slate-400">{getDayName(dow)}</p>
                          <p className="text-xl font-bold text-white mt-1">{dayData?.count || 0}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-white">Recent Activities</h3>
                <div className="space-y-2">
                  {activityData.recentActivities.length > 0 ? (
                    activityData.recentActivities.slice(0, 10).map((activity) => (
                      <div key={activity.id} className="flex items-center justify-between py-3 px-4 rounded-xl bg-slate-700/30 hover:bg-slate-700/50">
                        <div className="flex items-center gap-3">
                          <ActivityIcon type={activity.type} />
                          <div>
                            <p className="text-sm font-medium text-white">{activity.user?.name || "Unknown"}</p>
                            <p className="text-xs text-slate-400">{activity.type.replace(/_/g, " ")}{activity.path && ` • ${activity.path}`}</p>
                          </div>
                        </div>
                        <span className="text-xs text-slate-500">{new Date(activity.createdAt).toLocaleString()}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-slate-500 py-8">No recent activities</p>
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

              <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-white">Messages by Role</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {chatData.messagesByRole.map((item) => (
                    <div key={item.role} className="bg-slate-700/50 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${item.role === 'user' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                          {item.role === 'user' ? <Users className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
                        </div>
                        <span className="font-medium text-white capitalize">{item.role}</span>
                      </div>
                      <span className="text-2xl font-bold text-white">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-white">Top Chatters</h3>
                <div className="space-y-3">
                  {chatData.topChatters.length > 0 ? (
                    chatData.topChatters.map((user, i) => (
                      <div key={user.id} className="flex items-center justify-between py-3 px-4 rounded-xl bg-slate-700/30 hover:bg-slate-700/50">
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                            i === 0 ? 'bg-amber-500/20 text-amber-400' :
                            i === 1 ? 'bg-slate-400/20 text-slate-300' :
                            i === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-slate-700 text-slate-400'
                          }`}>{i + 1}</span>
                          <div>
                            <p className="font-medium text-white">{user.name}</p>
                            <p className="text-xs text-slate-400">{user.email}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-indigo-400">{user.sessionCount} sessions</p>
                          <p className="text-xs text-slate-400">{user.messageCount} messages</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-slate-500 py-8">No chat data yet</p>
                  )}
                </div>
              </div>

              <div className="bg-slate-800/50 border border-white/10 rounded-2xl p-6">
                <h3 className="text-lg font-semibold mb-4 text-white">Recent Chat Sessions</h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-white/10">
                      <tr>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Title</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">User</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Messages</th>
                        <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {chatData.recentSessions.map((session) => (
                        <tr key={session.id} className="hover:bg-white/5">
                          <td className="px-4 py-3"><p className="font-medium text-white truncate max-w-xs">{session.title}</p></td>
                          <td className="px-4 py-3 text-sm text-slate-300">{session.user?.name || "Unknown"}</td>
                          <td className="px-4 py-3 font-medium text-indigo-400">{session.messageCount}</td>
                          <td className="px-4 py-3 text-sm text-slate-400">{new Date(session.createdAt).toLocaleString()}</td>
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
  change?: number;
  isString?: boolean;
}

function MetricCard({ title, value, icon, color, subtitle, change, isString }: MetricCardProps) {
  const gradients = {
    primary: "from-indigo-500 to-purple-600",
    success: "from-emerald-500 to-teal-600",
    warning: "from-amber-500 to-orange-600",
    error: "from-rose-500 to-red-600",
    accent: "from-violet-500 to-fuchsia-600",
  };

  return (
    <div className="bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl p-5 hover:bg-slate-800/70 transition-all">
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradients[color]} flex items-center justify-center shadow-lg`}>
          <div className="text-white">{icon}</div>
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-lg ${change >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
            {change >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="text-2xl font-bold text-white">{isString ? value : typeof value === "number" ? value.toLocaleString() : value}</p>
      <p className="text-sm text-slate-400 mt-1">{title}</p>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
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

  const getGradient = () => {
    switch (type) {
      case "LOGIN":
      case "LOGOUT":
        return "from-emerald-500 to-teal-600";
      case "PAGE_VIEW":
        return "from-indigo-500 to-purple-600";
      case "CHAT_MESSAGE":
      case "CHAT_START":
        return "from-violet-500 to-fuchsia-600";
      case "LOG_VIEW":
      case "LOG_SEARCH":
        return "from-amber-500 to-orange-600";
      default:
        return "from-slate-500 to-slate-600";
    }
  };

  return (
    <div className={`${wrapperSize} rounded-lg bg-gradient-to-br ${getGradient()} flex items-center justify-center shadow text-white`}>
      {getIcon()}
    </div>
  );
}
