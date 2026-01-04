/**
 * API Client
 * Handles all communication with the backend API
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Types
export interface Log {
  id: string;
  timestamp: string;
  level: string;
  service: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface LogQueryParams {
  level?: string;
  service?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface LogsResponse {
  success: boolean;
  logs: Log[];
  total: number;
  limit: number;
  offset: number;
}

export interface DashboardStats {
  totalLogs: number;
  totalErrors: number;
  errorRate: number;
  levelCounts: Record<string, number>;
  topErrorServices: Array<{ service: string; errorCount: number }>;
  recentCritical: Log[];
  timeRange: {
    start: string;
    end: string;
    minutesAgo: number;
  };
}

export interface TimelineDataPoint {
  timestamp: number;
  DEBUG: number;
  INFO: number;
  WARN: number;
  ERROR: number;
  FATAL: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  context?: {
    logsAnalyzed: number;
    timeRange: string;
    sampleLogs?: Array<{
      timestamp: string;
      level: string;
      service: string;
      message: string;
    }>;
  };
}

export interface ChatFilters {
  level?: string;
  service?: string;
  timeRange?: '15m' | '1h' | '6h' | '24h' | '7d';
}

// API Functions

/**
 * Fetch logs with optional filters
 */
export async function fetchLogs(params: LogQueryParams = {}): Promise<LogsResponse> {
  const searchParams = new URLSearchParams();
  if (params.level) searchParams.set('level', params.level);
  if (params.service) searchParams.set('service', params.service);
  if (params.startTime) searchParams.set('startTime', params.startTime);
  if (params.endTime) searchParams.set('endTime', params.endTime);
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.offset) searchParams.set('offset', params.offset.toString());
  if (params.search) searchParams.set('search', params.search);

  const response = await fetch(`${API_URL}/api/logs?${searchParams}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch logs: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Fetch dashboard statistics
 */
export async function fetchDashboardStats(
  range: '15m' | '1h' | '6h' | '24h' | '7d' = '24h'
): Promise<DashboardStats> {
  const response = await fetch(`${API_URL}/api/analytics/stats?range=${range}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch stats: ${response.statusText}`);
  }
  const result = await response.json();
  return result.data;
}

/**
 * Fetch timeline data for charts
 */
export async function fetchTimeline(
  range: '15m' | '1h' | '6h' | '24h' | '7d' = '24h'
): Promise<TimelineDataPoint[]> {
  const response = await fetch(`${API_URL}/api/analytics/timeline?range=${range}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch timeline: ${response.statusText}`);
  }
  const result = await response.json();
  return result.data;
}

/**
 * Fetch list of services
 */
export async function fetchServices(): Promise<string[]> {
  const response = await fetch(`${API_URL}/api/logs/services`);
  if (!response.ok) {
    throw new Error(`Failed to fetch services: ${response.statusText}`);
  }
  const result = await response.json();
  return result.services;
}

/**
 * Send a chat message and get AI response
 */
export async function sendChatMessage(
  message: string,
  filters?: ChatFilters
): Promise<{
  response: string;
  context: {
    logsAnalyzed: number;
    timeRange: string;
    sampleLogs?: Array<{
      timestamp: string;
      level: string;
      service: string;
      message: string;
    }>;
  };
}> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, filters }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `Chat request failed: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get chat suggestions
 */
export async function fetchChatSuggestions(): Promise<string[]> {
  const response = await fetch(`${API_URL}/api/chat/suggestions`);
  if (!response.ok) {
    return [
      'What issues occurred in the last hour?',
      'Summarize the error patterns',
      'Which services need attention?',
    ];
  }
  const result = await response.json();
  return result.suggestions;
}

/**
 * Check backend health
 */
export async function checkHealth(): Promise<{
  status: string;
  services: { database: string; api: string };
}> {
  const response = await fetch(`${API_URL}/health`);
  return response.json();
}

/**
 * Check Ollama health
 */
export async function checkOllamaHealth(): Promise<{
  available: boolean;
  models: string[];
  configured_model: string;
}> {
  const response = await fetch(`${API_URL}/api/chat/health`);
  const result = await response.json();
  return result.ollama;
}

// ==================== Authentication ====================

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'STAFF' | 'USER';
  active?: boolean;
  createdAt?: string;
  lastLogin?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  token?: string;
  error?: string;
}

export interface UsersResponse {
  success: boolean;
  users: User[];
  total: number;
  limit: number;
  offset: number;
}

// Token storage
const TOKEN_KEY = 'logchat_token';
const USER_KEY = 'logchat_user';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const user = localStorage.getItem(USER_KEY);
  return user ? JSON.parse(user) : null;
}

export function storeAuth(token: string, user: User): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function authHeaders(): Record<string, string> {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Login user
 */
export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const result = await response.json();
  
  if (result.success && result.token && result.user) {
    storeAuth(result.token, result.user);
  }

  return result;
}

/**
 * Register new user
 */
export async function register(
  email: string,
  password: string,
  name: string,
  role?: 'ADMIN' | 'STAFF' | 'USER'
): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, role }),
  });

  return response.json();
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  try {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { ...authHeaders() },
    });
  } catch {
    // Ignore errors
  }
  clearAuth();
}

/**
 * Get current user
 */
export async function getCurrentUser(): Promise<User | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: { ...authHeaders() },
    });

    if (!response.ok) {
      clearAuth();
      return null;
    }

    const result = await response.json();
    if (result.success && result.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      return result.user;
    }
    return null;
  } catch {
    clearAuth();
    return null;
  }
}

/**
 * Fetch all users (admin only)
 */
export async function fetchUsers(params: {
  limit?: number;
  offset?: number;
  role?: string;
  search?: string;
} = {}): Promise<UsersResponse> {
  const searchParams = new URLSearchParams();
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.offset) searchParams.set('offset', params.offset.toString());
  if (params.role) searchParams.set('role', params.role);
  if (params.search) searchParams.set('search', params.search);

  const response = await fetch(`${API_URL}/api/auth/users?${searchParams}`, {
    headers: { ...authHeaders() },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }

  return response.json();
}

/**
 * Create user (admin only)
 */
export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  role?: 'ADMIN' | 'STAFF' | 'USER';
}): Promise<AuthResponse> {
  const response = await fetch(`${API_URL}/api/auth/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });

  return response.json();
}

/**
 * Update user (admin only)
 */
export async function updateUser(
  id: string,
  data: {
    name?: string;
    email?: string;
    role?: 'ADMIN' | 'STAFF' | 'USER';
    active?: boolean;
    password?: string;
  }
): Promise<{ success: boolean; user?: User; error?: string }> {
  const response = await fetch(`${API_URL}/api/auth/users/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });

  return response.json();
}

/**
 * Delete user (admin only)
 */
export async function deleteUser(id: string): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`${API_URL}/api/auth/users/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });

  return response.json();
}

// ========== Chat Sessions API ==========

export interface ChatSessionSummary {
  id: string;
  title: string;
  archived: boolean;
  messageCount: number;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSessionFull {
  id: string;
  title: string;
  archived: boolean;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
  messages: Array<{
    id: string;
    role: string;
    content: string;
    responseTime?: number;
    tokensUsed?: number;
    createdAt: string;
  }>;
}

export interface ChatSessionsResponse {
  sessions: ChatSessionSummary[];
  total: number;
}

/**
 * Fetch user's chat sessions
 */
export async function fetchChatSessions(params: {
  archived?: boolean;
  limit?: number;
  offset?: number;
} = {}): Promise<ChatSessionsResponse> {
  const searchParams = new URLSearchParams();
  if (params.archived) searchParams.set('archived', 'true');
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.offset) searchParams.set('offset', params.offset.toString());

  const response = await fetch(`${API_URL}/api/chat-sessions?${searchParams}`, {
    headers: { ...authHeaders() },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch chat sessions');
  }

  return response.json();
}

/**
 * Get a specific chat session with messages
 */
export async function fetchChatSession(id: string): Promise<ChatSessionFull> {
  const response = await fetch(`${API_URL}/api/chat-sessions/${id}`, {
    headers: { ...authHeaders() },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch chat session');
  }

  return response.json();
}

/**
 * Create a new chat session
 */
export async function createChatSession(title?: string): Promise<ChatSessionFull> {
  const response = await fetch(`${API_URL}/api/chat-sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw new Error('Failed to create chat session');
  }

  return response.json();
}

/**
 * Add a message to a chat session
 */
export async function addChatMessage(
  sessionId: string,
  data: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    responseTime?: number;
    tokensUsed?: number;
  }
): Promise<{ id: string; createdAt: string }> {
  const response = await fetch(`${API_URL}/api/chat-sessions/${sessionId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to add message');
  }

  return response.json();
}

/**
 * Update chat session title
 */
export async function updateChatSessionTitle(
  id: string,
  title: string
): Promise<{ id: string; title: string }> {
  const response = await fetch(`${API_URL}/api/chat-sessions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ title }),
  });

  if (!response.ok) {
    throw new Error('Failed to update chat session');
  }

  return response.json();
}

/**
 * Archive a chat session
 */
export async function archiveChatSession(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/chat-sessions/${id}/archive`, {
    method: 'POST',
    headers: { ...authHeaders() },
  });

  if (!response.ok) {
    throw new Error('Failed to archive chat session');
  }
}

/**
 * Delete a chat session
 */
export async function deleteChatSession(id: string): Promise<void> {
  const response = await fetch(`${API_URL}/api/chat-sessions/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });

  if (!response.ok) {
    throw new Error('Failed to delete chat session');
  }
}

// ========== Admin Analytics API ==========

export interface PlatformAnalytics {
  summary: {
    activeUsers: number;
    newUsers: number;
    totalUsers: number;
    chatSessions: number;
    chatMessages: number;
    logsIngested: number;
  };
  activityByType: Array<{ type: string; count: number }>;
  dailyStats: Array<{
    date: string;
    users: number;
    activities: number;
  }>;
  topUsers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    lastLogin?: string;
    activityCount: number;
  }>;
}

export interface UserAnalytics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  avgSessionDuration: number;
  userGrowth: Array<{
    date: string;
    count: number;
    cumulative: number;
  }>;
  usersByRole: Array<{
    role: string;
    count: number;
  }>;
  topActiveUsers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    lastLogin?: string;
    activityCount: number;
  }>;
}

export interface ActivityAnalytics {
  activityByType: Array<{ type: string; _count: { type: number } }>;
  activityByHour: Array<{ hour: number; count: number }>;
  activityByDayOfWeek: Array<{ dow: number; count: number }>;
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

export interface ChatAnalytics {
  totalSessions: number;
  totalMessages: number;
  avgMessagesPerSession: number;
  avgResponseTime: number;
  totalTokensUsed: number;
  messagesByRole: Array<{ role: string; count: number }>;
  dailyActivity: Array<{ date: string; sessions: number; messages: number }>;
  topChatters: Array<{
    id: string;
    name: string;
    email: string;
    sessionCount: number;
    messageCount: number;
  }>;
  recentSessions: Array<{
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    user?: { id: string; name: string; email: string };
    messageCount: number;
  }>;
}

export interface UserEngagement {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    createdAt: string;
    lastLogin?: string;
  };
  stats: {
    totalChatSessions: number;
    totalActivities: number;
    daysSinceRegistration: number;
    avgSessionDuration: number;
    firstActivityDate?: string;
  };
  recentChatSessions: Array<{
    id: string;
    title: string;
    messageCount: number;
    createdAt: string;
    updatedAt: string;
  }>;
  recentActivities: Array<{
    id: string;
    type: string;
    path?: string;
    duration?: number;
    createdAt: string;
  }>;
  activitySummary: {
    activityBreakdown: Array<{ type: string; count: number }>;
    totalTimeSpent: number;
    sessionCount: number;
    chatMessageCount: number;
  };
}

/**
 * Fetch platform overview analytics (admin/staff)
 */
export async function fetchPlatformAnalytics(days = 30): Promise<PlatformAnalytics> {
  const response = await fetch(`${API_URL}/api/admin/analytics/overview?days=${days}`, {
    headers: { ...authHeaders() },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch platform analytics');
  }

  return response.json();
}

/**
 * Fetch user analytics (admin/staff)
 */
export async function fetchUserAnalytics(days = 30): Promise<UserAnalytics> {
  const response = await fetch(`${API_URL}/api/admin/analytics/users?days=${days}`, {
    headers: { ...authHeaders() },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch user analytics');
  }

  return response.json();
}

/**
 * Fetch activity analytics (admin/staff)
 */
export async function fetchActivityAnalytics(days = 30): Promise<ActivityAnalytics> {
  const response = await fetch(`${API_URL}/api/admin/analytics/activity?days=${days}`, {
    headers: { ...authHeaders() },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch activity analytics');
  }

  return response.json();
}

/**
 * Fetch chat analytics (admin/staff)
 */
export async function fetchChatAnalytics(days = 30): Promise<ChatAnalytics> {
  const response = await fetch(`${API_URL}/api/admin/analytics/chats?days=${days}`, {
    headers: { ...authHeaders() },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch chat analytics');
  }

  return response.json();
}

/**
 * Fetch detailed user engagement (admin only)
 */
export async function fetchUserEngagement(userId: string, days = 30): Promise<UserEngagement> {
  const response = await fetch(
    `${API_URL}/api/admin/analytics/user/${userId}?days=${days}`,
    { headers: { ...authHeaders() } }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch user engagement');
  }

  return response.json();
}

/**
 * Export analytics data (admin only)
 */
export async function exportAnalytics(
  type: 'users' | 'activities' | 'chats',
  days = 30
): Promise<{ type: string; exportedAt: string; recordCount: number; data: unknown[] }> {
  const response = await fetch(`${API_URL}/api/admin/analytics/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ type, days }),
  });

  if (!response.ok) {
    throw new Error('Failed to export analytics');
  }

  return response.json();
}