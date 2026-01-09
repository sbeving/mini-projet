/**
 * SIEM Alert Rules Engine
 * Configurable alert rules with thresholds, patterns, and automated actions
 */

import { prisma } from '../../lib/prisma.js';
import { 
  AlertRule, 
  RuleCondition, 
  ThreatSeverity, 
  AlertAction,
  RuleTimeWindow,
} from './types.js';

// ============================================================
// DEFAULT ALERT RULES
// ============================================================

const DEFAULT_RULES: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt' | 'triggerCount'>[] = [
  {
    name: 'High Error Rate',
    description: 'Alert when error rate exceeds 10% in 5 minutes',
    enabled: true,
    severity: 'high',
    type: 'threshold',
    conditions: [
      { field: 'level', operator: 'eq', value: 'error' }
    ],
    conditionLogic: 'and',
    aggregation: {
      function: 'count',
      threshold: 50,
      timeWindow: '5m',
    },
    actions: [],
    tags: ['error', 'availability'],
    mitreMapping: [],
    createdBy: 'system',
  },
  {
    name: 'Multiple Failed Logins',
    description: 'Alert on 5+ failed login attempts from same IP in 5 minutes',
    enabled: true,
    severity: 'high',
    type: 'threshold',
    conditions: [
      { field: 'message', operator: 'contains', value: 'failed login' },
    ],
    conditionLogic: 'and',
    aggregation: {
      function: 'count',
      groupBy: ['sourceIp'],
      threshold: 5,
      timeWindow: '5m',
    },
    actions: [],
    tags: ['authentication', 'brute-force'],
    mitreMapping: ['T1110'],
    createdBy: 'system',
  },
  {
    name: 'Critical System Error',
    description: 'Immediate alert on critical level logs',
    enabled: true,
    severity: 'critical',
    type: 'pattern',
    conditions: [
      { field: 'level', operator: 'eq', value: 'critical' }
    ],
    conditionLogic: 'and',
    actions: [],
    tags: ['critical', 'immediate'],
    createdBy: 'system',
  },
  {
    name: 'Suspicious Command Execution',
    description: 'Detect potentially malicious command patterns',
    enabled: true,
    severity: 'high',
    type: 'pattern',
    conditions: [
      { field: 'message', operator: 'regex', value: '(wget|curl).*\\|.*sh|base64.*-d|nc.*-e|python.*-c.*import' }
    ],
    conditionLogic: 'or',
    actions: [],
    tags: ['command-injection', 'malware'],
    mitreMapping: ['T1059'],
    createdBy: 'system',
  },
  {
    name: 'Data Exfiltration Pattern',
    description: 'Large data transfers to external destinations',
    enabled: true,
    severity: 'critical',
    type: 'pattern',
    conditions: [
      { field: 'message', operator: 'regex', value: 'upload|export|transfer.*external|large.*file.*sent' }
    ],
    conditionLogic: 'or',
    actions: [],
    tags: ['data-exfiltration', 'dlp'],
    mitreMapping: ['T1041'],
    createdBy: 'system',
  },
  {
    name: 'Privilege Escalation Attempt',
    description: 'Detect sudo/admin privilege changes',
    enabled: true,
    severity: 'high',
    type: 'pattern',
    conditions: [
      { field: 'message', operator: 'regex', value: 'sudo|privilege.*escalat|became.*root|setuid|chmod.*[47]' }
    ],
    conditionLogic: 'or',
    actions: [],
    tags: ['privilege-escalation', 'access-control'],
    mitreMapping: ['T1068', 'T1548'],
    createdBy: 'system',
  },
  {
    name: 'Service Down',
    description: 'No logs from a service for 10+ minutes',
    enabled: true,
    severity: 'medium',
    type: 'anomaly',
    conditions: [],
    conditionLogic: 'and',
    aggregation: {
      function: 'count',
      groupBy: ['service'],
      threshold: 0,
      timeWindow: '15m',
    },
    actions: [],
    tags: ['availability', 'monitoring'],
    createdBy: 'system',
  },
  {
    name: 'SQL Injection Attempt',
    description: 'Detect SQL injection patterns in logs',
    enabled: true,
    severity: 'critical',
    type: 'pattern',
    conditions: [
      { field: 'message', operator: 'regex', value: "('|\")?\\s*(or|and)\\s+['\"]?\\d+['\"]?\\s*=\\s*['\"]?\\d+|union.*select|;\\s*drop\\s+table|;\\s*delete\\s+from" }
    ],
    conditionLogic: 'or',
    actions: [],
    tags: ['sql-injection', 'web-attack'],
    mitreMapping: ['T1190'],
    createdBy: 'system',
  },
];

// ============================================================
// ALERT RULES ENGINE CLASS
// ============================================================

class AlertRulesEngine {
  private rules: Map<string, AlertRule> = new Map();
  private ruleMatches: Map<string, { timestamp: Date; logId: string; groupKey?: string }[]> = new Map();

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    DEFAULT_RULES.forEach((rule, index) => {
      const fullRule: AlertRule = {
        ...rule,
        id: `rule_${index + 1}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        triggerCount: 0,
      };
      this.rules.set(fullRule.id, fullRule);
    });
  }

  // ============================================================
  // RULE EVALUATION
  // ============================================================

  async evaluateLog(log: {
    id: string;
    level: string;
    service: string;
    message: string;
    timestamp: Date;
    meta?: Record<string, unknown>;
  }): Promise<{ ruleId: string; rule: AlertRule }[]> {
    const triggeredRules: { ruleId: string; rule: AlertRule }[] = [];

    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;

      const matches = this.evaluateConditions(log, rule.conditions, rule.conditionLogic);
      
      if (matches) {
        // Track the match for threshold/aggregation rules
        if (rule.aggregation) {
          const groupKey = rule.aggregation.groupBy
            ?.map(field => this.extractField(log, field))
            .join('_') || 'default';
          
          this.trackMatch(ruleId, log.id, groupKey);
          
          // Check if threshold is exceeded
          if (this.checkThreshold(ruleId, rule, groupKey)) {
            triggeredRules.push({ ruleId, rule });
            rule.triggerCount++;
            rule.lastTriggered = new Date();
          }
        } else {
          // Pattern rules trigger immediately
          triggeredRules.push({ ruleId, rule });
          rule.triggerCount++;
          rule.lastTriggered = new Date();
        }
      }
    }

    return triggeredRules;
  }

  private evaluateConditions(
    log: Record<string, unknown>,
    conditions: RuleCondition[],
    logic: 'and' | 'or'
  ): boolean {
    if (conditions.length === 0) return true;

    const results = conditions.map(condition => this.evaluateCondition(log, condition));
    
    return logic === 'and' 
      ? results.every(r => r)
      : results.some(r => r);
  }

  private evaluateCondition(log: Record<string, unknown>, condition: RuleCondition): boolean {
    const value = this.extractField(log, condition.field);
    
    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'neq':
        return value !== condition.value;
      case 'gt':
        return typeof value === 'number' && value > (condition.value as number);
      case 'lt':
        return typeof value === 'number' && value < (condition.value as number);
      case 'gte':
        return typeof value === 'number' && value >= (condition.value as number);
      case 'lte':
        return typeof value === 'number' && value <= (condition.value as number);
      case 'contains':
        return typeof value === 'string' && value.toLowerCase().includes((condition.value as string).toLowerCase());
      case 'regex':
        try {
          const regex = new RegExp(condition.value as string, 'i');
          return typeof value === 'string' && regex.test(value);
        } catch {
          return false;
        }
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(String(value));
      case 'not_in':
        return Array.isArray(condition.value) && !condition.value.includes(String(value));
      default:
        return false;
    }
  }

  private extractField(log: Record<string, unknown>, field: string): unknown {
    const parts = field.split('.');
    let value: unknown = log;
    
    for (const part of parts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  private trackMatch(ruleId: string, logId: string, groupKey: string): void {
    const key = `${ruleId}_${groupKey}`;
    if (!this.ruleMatches.has(key)) {
      this.ruleMatches.set(key, []);
    }
    
    const matches = this.ruleMatches.get(key)!;
    matches.push({ timestamp: new Date(), logId, groupKey });
    
    // Keep only recent matches based on longest time window
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours
    const filtered = matches.filter(m => m.timestamp >= cutoff);
    this.ruleMatches.set(key, filtered);
  }

  private checkThreshold(ruleId: string, rule: AlertRule, groupKey: string): boolean {
    if (!rule.aggregation) return false;
    
    const key = `${ruleId}_${groupKey}`;
    const matches = this.ruleMatches.get(key) || [];
    
    const windowMs = this.timeWindowToMs(rule.aggregation.timeWindow);
    const cutoff = new Date(Date.now() - windowMs);
    
    const recentMatches = matches.filter(m => m.timestamp >= cutoff);
    
    switch (rule.aggregation.function) {
      case 'count':
        return recentMatches.length >= rule.aggregation.threshold;
      case 'distinct_count':
        const distinctValues = new Set(recentMatches.map(m => m.logId));
        return distinctValues.size >= rule.aggregation.threshold;
      default:
        return recentMatches.length >= rule.aggregation.threshold;
    }
  }

  private timeWindowToMs(window: RuleTimeWindow): number {
    const units: Record<string, number> = {
      'm': 60 * 1000,
      'h': 60 * 60 * 1000,
    };
    
    const match = window.match(/(\d+)([mh])/);
    if (match) {
      return parseInt(match[1]) * units[match[2]];
    }
    return 5 * 60 * 1000; // Default 5 minutes
  }

  // ============================================================
  // RULE MANAGEMENT
  // ============================================================

  async getRules(): Promise<AlertRule[]> {
    return Array.from(this.rules.values());
  }

  async getRule(id: string): Promise<AlertRule | null> {
    return this.rules.get(id) || null;
  }

  async createRule(rule: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt' | 'triggerCount'>): Promise<AlertRule> {
    const newRule: AlertRule = {
      ...rule,
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      triggerCount: 0,
    };
    
    this.rules.set(newRule.id, newRule);
    return newRule;
  }

  async updateRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule | null> {
    const rule = this.rules.get(id);
    if (!rule) return null;
    
    const updated: AlertRule = {
      ...rule,
      ...updates,
      id: rule.id,
      createdAt: rule.createdAt,
      updatedAt: new Date(),
    };
    
    this.rules.set(id, updated);
    return updated;
  }

  async deleteRule(id: string): Promise<boolean> {
    return this.rules.delete(id);
  }

  async toggleRule(id: string, enabled: boolean): Promise<AlertRule | null> {
    return this.updateRule(id, { enabled });
  }

  // ============================================================
  // RULE TESTING
  // ============================================================

  async testRule(ruleId: string, testLogs?: { level: string; service: string; message: string }[]): Promise<{
    matches: number;
    samples: { log: unknown; matched: boolean }[];
  }> {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Rule ${ruleId} not found`);
    }

    let logs: { level: string; service: string; message: string }[] | undefined = testLogs;
    
    if (!logs) {
      // Get recent logs to test against
      const dbLogs = await prisma.log.findMany({
        take: 100,
        orderBy: { timestamp: 'desc' },
      });
      
      logs = dbLogs.map((l: { level: string; service: string; message: string }) => ({
        level: l.level,
        service: l.service,
        message: l.message,
      }));
    }

    let matches = 0;
    const samples: { log: unknown; matched: boolean }[] = [];

    for (const log of logs ?? []) {
      const matched = this.evaluateConditions(
        log as Record<string, unknown>,
        rule.conditions,
        rule.conditionLogic
      );
      
      if (matched) matches++;
      
      if (samples.length < 5) {
        samples.push({ log, matched });
      }
    }

    return { matches, samples };
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  getStats(): {
    totalRules: number;
    enabledRules: number;
    rulesBySeverity: Record<ThreatSeverity, number>;
    topTriggeredRules: { id: string; name: string; count: number }[];
  } {
    const rules = Array.from(this.rules.values());
    
    const rulesBySeverity: Record<ThreatSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    
    rules.forEach(rule => {
      rulesBySeverity[rule.severity]++;
    });

    const topTriggeredRules = rules
      .filter(r => r.triggerCount > 0)
      .sort((a, b) => b.triggerCount - a.triggerCount)
      .slice(0, 10)
      .map(r => ({ id: r.id, name: r.name, count: r.triggerCount }));

    return {
      totalRules: rules.length,
      enabledRules: rules.filter(r => r.enabled).length,
      rulesBySeverity,
      topTriggeredRules,
    };
  }
}

// Export singleton instance
export const alertRulesEngine = new AlertRulesEngine();
