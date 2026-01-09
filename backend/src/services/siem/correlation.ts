/**
 * SIEM Log Correlation Engine
 * Pattern matching and event correlation across multiple log sources
 */

import {
  CorrelationRule,
  CorrelatedEvent,
  ThreatSeverity,
  RuleCondition,
} from './types.js';

// ============================================================
// CORRELATION RULE DEFINITIONS
// ============================================================

const DEFAULT_CORRELATION_RULES: CorrelationRule[] = [
  {
    id: 'corr-brute-force-distributed',
    name: 'Distributed Brute Force',
    description: 'Multiple IPs attempting to login to same target',
    enabled: true,
    eventPatterns: [],
    conditions: [
      { field: 'message', operator: 'contains', value: 'failed login' }
    ],
    threshold: 10,
    minDistinctSources: 3,
    timeWindow: '5m',
    minMatchCount: 10,
    groupBy: ['destinationIp', 'userId'],
    severity: 'high',
    threatType: 'correlation',
    tags: ['brute-force', 'distributed'],
  },
  {
    id: 'corr-lateral-movement',
    name: 'Lateral Movement Chain',
    description: 'Sequential access to multiple internal systems',
    enabled: true,
    eventPatterns: [],
    conditions: [
      { field: 'message', operator: 'regex', value: 'ssh|rdp|smb|winrm|remote access' }
    ],
    threshold: 3,
    minDistinctSources: 1,
    timeWindow: '15m',
    minMatchCount: 3,
    groupBy: ['sourceIp'],
    severity: 'high',
    threatType: 'correlation',
    tags: ['lateral-movement'],
  },
  {
    id: 'corr-recon-to-exploit',
    name: 'Reconnaissance to Exploitation',
    description: 'Scanning activity followed by exploitation attempts',
    enabled: true,
    eventPatterns: [],
    conditions: [
      { field: 'message', operator: 'regex', value: 'scan|probe|enum|exploit|attack' }
    ],
    threshold: 5,
    minDistinctSources: 1,
    timeWindow: '30m',
    minMatchCount: 5,
    groupBy: ['sourceIp'],
    severity: 'critical',
    threatType: 'correlation',
    tags: ['reconnaissance', 'exploit'],
  },
  {
    id: 'corr-data-exfil',
    name: 'Data Exfiltration Pattern',
    description: 'Unusual data transfer patterns indicating exfiltration',
    enabled: true,
    eventPatterns: [],
    conditions: [
      { field: 'message', operator: 'regex', value: 'upload|transfer|export|copy.*external' }
    ],
    threshold: 3,
    minDistinctSources: 1,
    timeWindow: '1h',
    minMatchCount: 3,
    groupBy: ['sourceIp', 'userId'],
    severity: 'critical',
    threatType: 'correlation',
    tags: ['exfiltration'],
  },
];

// ============================================================
// CORRELATION ENGINE CLASS
// ============================================================

interface EventWindow {
  events: { id: string; timestamp: Date; data: Record<string, unknown> }[];
  sources: Set<string>;
}

class LogCorrelationEngine {
  private rules: Map<string, CorrelationRule> = new Map();
  private eventWindows: Map<string, EventWindow> = new Map();
  private correlatedEvents: Map<string, CorrelatedEvent> = new Map();

  constructor() {
    // Load default rules
    for (const rule of DEFAULT_CORRELATION_RULES) {
      this.rules.set(rule.id, rule);
    }
  }

  // Get all rules
  getRules(): CorrelationRule[] {
    return Array.from(this.rules.values());
  }

  // Get rule by ID
  getRule(id: string): CorrelationRule | undefined {
    return this.rules.get(id);
  }

  // Add or update rule
  upsertRule(rule: CorrelationRule): void {
    this.rules.set(rule.id, rule);
  }

  // Delete rule
  deleteRule(id: string): boolean {
    return this.rules.delete(id);
  }

  // Get correlated events
  getCorrelatedEvents(): CorrelatedEvent[] {
    return Array.from(this.correlatedEvents.values());
  }

  // Process a log for correlation
  correlateLog(log: {
    id: string;
    timestamp: Date;
    message: string;
    level: string;
    service: string;
    sourceIp?: string;
    userId?: string;
    [key: string]: unknown;
  }): CorrelatedEvent[] {
    const results: CorrelatedEvent[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Check if log matches rule conditions
      const matches = this.matchesConditions(log, rule.conditions);
      if (!matches) continue;

      // Get or create event window for this rule + group
      const groupKey = this.buildGroupKey(log, rule.groupBy || []);
      const windowKey = `${rule.id}_${groupKey}`;
      
      let window = this.eventWindows.get(windowKey);
      if (!window) {
        window = { events: [], sources: new Set() };
        this.eventWindows.set(windowKey, window);
      }

      // Add event to window
      window.events.push({
        id: log.id,
        timestamp: log.timestamp,
        data: log as Record<string, unknown>,
      });
      
      if (log.sourceIp) {
        window.sources.add(log.sourceIp);
      }

      // Clean old events outside time window
      const windowMs = this.parseTimeWindow(rule.timeWindow);
      const cutoff = new Date(Date.now() - windowMs);
      window.events = window.events.filter(e => e.timestamp > cutoff);

      // Check if threshold is met
      if (
        window.events.length >= rule.threshold &&
        window.sources.size >= rule.minDistinctSources
      ) {
        const correlatedEvent: CorrelatedEvent = {
          id: `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          correlationRuleId: rule.id,
          ruleName: rule.name,
          severity: rule.severity,
          matchedEvents: window.events.map(e => e.id),
          groupKey,
          firstEventTime: window.events[0].timestamp,
          lastEventTime: window.events[window.events.length - 1].timestamp,
          eventCount: window.events.length,
          description: `${rule.name}: ${window.events.length} events from ${window.sources.size} sources`,
          createdAt: new Date(),
        };

        this.correlatedEvents.set(correlatedEvent.id, correlatedEvent);
        results.push(correlatedEvent);

        // Reset window after correlation is triggered
        this.eventWindows.delete(windowKey);
      }
    }

    return results;
  }

  // Run historical correlation analysis
  async runHistoricalCorrelation(logs: Array<{
    id: string;
    timestamp: Date;
    message: string;
    level: string;
    service: string;
    sourceIp?: string;
    userId?: string;
    [key: string]: unknown;
  }>): Promise<CorrelatedEvent[]> {
    const results: CorrelatedEvent[] = [];
    
    // Sort logs by timestamp
    const sortedLogs = [...logs].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Clear windows for fresh analysis
    this.eventWindows.clear();

    for (const log of sortedLogs) {
      const correlations = this.correlateLog(log);
      results.push(...correlations);
    }

    return results;
  }

  // Analyze attack chain for an IP
  analyzeAttackChain(sourceIp: string): {
    stages: string[];
    events: CorrelatedEvent[];
    riskScore: number;
  } {
    const relatedEvents = Array.from(this.correlatedEvents.values())
      .filter(e => e.groupKey.includes(sourceIp));

    const stages: string[] = [];
    let riskScore = 0;

    for (const event of relatedEvents) {
      const rule = this.rules.get(event.correlationRuleId);
      if (rule) {
        stages.push(rule.name);
        riskScore += this.severityToScore(rule.severity);
      }
    }

    return {
      stages: [...new Set(stages)],
      events: relatedEvents,
      riskScore: Math.min(100, riskScore),
    };
  }

  // Helper: Check if log matches conditions
  private matchesConditions(log: Record<string, unknown>, conditions: RuleCondition[]): boolean {
    for (const condition of conditions) {
      const value = this.extractField(log, condition.field);
      if (!this.evaluateCondition(value, condition)) {
        return false;
      }
    }
    return conditions.length > 0;
  }

  // Helper: Extract nested field value
  private extractField(obj: Record<string, unknown>, field: string): unknown {
    const parts = field.split('.');
    let value: unknown = obj;
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    return value;
  }

  // Helper: Evaluate a single condition
  private evaluateCondition(value: unknown, condition: RuleCondition): boolean {
    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'neq':
        return value !== condition.value;
      case 'contains':
        return typeof value === 'string' && 
          value.toLowerCase().includes(String(condition.value).toLowerCase());
      case 'regex':
        try {
          const regex = new RegExp(String(condition.value), 'i');
          return typeof value === 'string' && regex.test(value);
        } catch {
          return false;
        }
      case 'gt':
        return typeof value === 'number' && value > Number(condition.value);
      case 'lt':
        return typeof value === 'number' && value < Number(condition.value);
      case 'gte':
        return typeof value === 'number' && value >= Number(condition.value);
      case 'lte':
        return typeof value === 'number' && value <= Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(String(value));
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(String(value));
      default:
        return false;
    }
  }

  // Helper: Build group key from log fields
  private buildGroupKey(log: Record<string, unknown>, groupBy: string[]): string {
    return groupBy.map(field => String(log[field] || 'unknown')).join('_');
  }

  // Helper: Parse time window to milliseconds
  private parseTimeWindow(window: string): number {
    const match = window.match(/^(\d+)(m|h)$/);
    if (!match) return 5 * 60 * 1000; // Default 5 minutes
    
    const value = parseInt(match[1], 10);
    const unit = match[2];
    
    return unit === 'h' ? value * 60 * 60 * 1000 : value * 60 * 1000;
  }

  // Helper: Convert severity to numeric score
  private severityToScore(severity: ThreatSeverity): number {
    const scores: Record<ThreatSeverity, number> = {
      critical: 25,
      high: 20,
      medium: 10,
      low: 5,
      info: 1,
    };
    return scores[severity] || 0;
  }
}

// Export singleton instance
export const correlationEngine = new LogCorrelationEngine();
export { LogCorrelationEngine };
