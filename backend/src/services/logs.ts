/**
 * Log Service
 * Handles log parsing, validation, and database operations
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../index.js';

// Types for log data
export interface ParsedLog {
  timestamp: Date;
  level: string;
  service: string;
  message: string;
  raw: string;
  meta?: Record<string, unknown>;
}

export interface LogInput {
  timestamp?: string;
  level?: string;
  service?: string;
  message: string;
  meta?: Record<string, unknown>;
}

// Valid log levels
const VALID_LEVELS = ['DEBUG', 'INFO', 'WARN', 'WARNING', 'ERROR', 'FATAL', 'CRITICAL'];

/**
 * Parse a raw log line to extract structured fields
 * Supports formats like: "2025-01-01T12:34:56Z [ERROR] auth-service: Failed to validate token"
 */
export function parseRawLogLine(raw: string): Partial<ParsedLog> {
  const result: Partial<ParsedLog> = { raw };
  
  // Try to extract timestamp (ISO 8601 format)
  const timestampMatch = raw.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)/);
  if (timestampMatch) {
    const parsed = new Date(timestampMatch[1]);
    if (!isNaN(parsed.getTime())) {
      result.timestamp = parsed;
    }
  }
  
  // Try to extract log level
  const levelMatch = raw.match(/\[(DEBUG|INFO|WARN|WARNING|ERROR|FATAL|CRITICAL)\]/i);
  if (levelMatch) {
    result.level = levelMatch[1].toUpperCase();
    // Normalize WARNING to WARN
    if (result.level === 'WARNING') result.level = 'WARN';
  }
  
  // Try to extract service name (word before colon after level)
  const serviceMatch = raw.match(/\]\s*([a-zA-Z0-9_-]+):/);
  if (serviceMatch) {
    result.service = serviceMatch[1];
  }
  
  // Extract message (everything after the service name and colon)
  const messageMatch = raw.match(/:\s*(.+)$/);
  if (messageMatch) {
    result.message = messageMatch[1].trim();
  } else {
    // Fallback: use the whole raw string as message
    result.message = raw;
  }
  
  return result;
}

/**
 * Validate and normalize log level
 */
function normalizeLevel(level?: string): string {
  if (!level) return 'INFO';
  const upper = level.toUpperCase();
  if (upper === 'WARNING') return 'WARN';
  if (upper === 'CRITICAL') return 'FATAL';
  return VALID_LEVELS.includes(upper) ? upper : 'INFO';
}

/**
 * Create a log entry from input data
 * Handles both structured and raw log formats
 */
export async function createLog(input: LogInput): Promise<ParsedLog> {
  let parsed: ParsedLog;
  
  // If we have structured data, use it
  if (input.level && input.service) {
    parsed = {
      timestamp: input.timestamp ? new Date(input.timestamp) : new Date(),
      level: normalizeLevel(input.level),
      service: input.service,
      message: input.message,
      raw: JSON.stringify(input),
      meta: input.meta,
    };
  } else {
    // Parse the raw message
    const fromRaw = parseRawLogLine(input.message);
    parsed = {
      timestamp: fromRaw.timestamp || new Date(),
      level: normalizeLevel(fromRaw.level),
      service: fromRaw.service || 'unknown',
      message: fromRaw.message || input.message,
      raw: input.message,
      meta: input.meta,
    };
  }
  
  // Validate timestamp
  if (isNaN(parsed.timestamp.getTime())) {
    parsed.timestamp = new Date();
  }
  
  // Store in database
  await prisma.log.create({
    data: {
      timestamp: parsed.timestamp,
      level: parsed.level,
      service: parsed.service,
      message: parsed.message,
      raw: parsed.raw,
      meta: parsed.meta as Prisma.InputJsonValue,
    },
  });
  
  return parsed;
}

/**
 * Create multiple log entries at once (batch insert)
 */
export async function createLogs(inputs: LogInput[]): Promise<number> {
  const data = inputs.map(input => {
    let parsed: ParsedLog;
    
    if (input.level && input.service) {
      parsed = {
        timestamp: input.timestamp ? new Date(input.timestamp) : new Date(),
        level: normalizeLevel(input.level),
        service: input.service,
        message: input.message,
        raw: JSON.stringify(input),
        meta: input.meta,
      };
    } else {
      const fromRaw = parseRawLogLine(input.message);
      parsed = {
        timestamp: fromRaw.timestamp || new Date(),
        level: normalizeLevel(fromRaw.level),
        service: fromRaw.service || 'unknown',
        message: fromRaw.message || input.message,
        raw: input.message,
        meta: input.meta,
      };
    }
    
    if (isNaN(parsed.timestamp.getTime())) {
      parsed.timestamp = new Date();
    }
    
    return {
      timestamp: parsed.timestamp,
      level: parsed.level,
      service: parsed.service,
      message: parsed.message,
      raw: parsed.raw,
      meta: parsed.meta as Prisma.InputJsonValue,
    };
  });
  
  const result = await prisma.log.createMany({ data });
  return result.count;
}

// Query options for fetching logs
export interface LogQueryOptions {
  level?: string;
  service?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
  offset?: number;
  search?: string;
}

/**
 * Query logs with filters
 */
export async function queryLogs(options: LogQueryOptions = {}) {
  const { level, service, startTime, endTime, limit = 100, offset = 0, search } = options;
  
  const where: Prisma.LogWhereInput = {};
  
  if (level) {
    where.level = level.toUpperCase();
  }
  
  if (service) {
    where.service = service;
  }
  
  if (startTime || endTime) {
    where.timestamp = {};
    if (startTime) where.timestamp.gte = startTime;
    if (endTime) where.timestamp.lte = endTime;
  }
  
  if (search) {
    where.OR = [
      { message: { contains: search, mode: 'insensitive' } },
      { service: { contains: search, mode: 'insensitive' } },
    ];
  }
  
  const [logs, total] = await Promise.all([
    prisma.log.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.log.count({ where }),
  ]);
  
  return { logs, total, limit, offset };
}

/**
 * Get recent error logs
 */
export async function getRecentErrors(limit: number = 50, minutesAgo: number = 60) {
  const startTime = new Date(Date.now() - minutesAgo * 60 * 1000);
  
  return prisma.log.findMany({
    where: {
      level: { in: ['ERROR', 'FATAL'] },
      timestamp: { gte: startTime },
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
}

/**
 * Get all unique services
 */
export async function getServices() {
  const services = await prisma.log.findMany({
    select: { service: true },
    distinct: ['service'],
    orderBy: { service: 'asc' },
  });
  return services.map(s => s.service);
}
