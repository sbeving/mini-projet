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
