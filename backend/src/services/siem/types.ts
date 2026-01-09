/**
 * SIEM Types - Security Information and Event Management
 * Core type definitions for the AI-powered SIEM engine
 */

// ============================================================
// THREAT & ALERT TYPES
// ============================================================

export type ThreatSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ThreatStatus = 'new' | 'investigating' | 'confirmed' | 'false_positive' | 'resolved';
export type AlertType = 'anomaly' | 'pattern' | 'threshold' | 'correlation' | 'ioc' | 'ml_detection';

export interface Threat {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  type: AlertType;
  severity: ThreatSeverity;
  status: ThreatStatus;
  title: string;
  description: string;
  source: string;
  sourceIp?: string;
  destinationIp?: string;
  userId?: string;
  affectedAssets: string[];
  indicators: IOC[];
  mitreAttack?: MitreAttackTechnique[];
  rawEvents: string[]; // Log IDs
  aiAnalysis?: AIThreatAnalysis;
  assignedTo?: string;
  resolvedAt?: Date;
  resolution?: string;
}

export interface AIThreatAnalysis {
  riskScore: number; // 0-100
  confidence: number; // 0-100
  summary: string;
  attackVector?: string;
  potentialImpact: string;
  recommendedActions: string[];
  relatedThreats?: string[];
  falsePositiveLikelihood: number; // 0-100
  contextualFactors: string[];
}

// ============================================================
// INDICATOR OF COMPROMISE (IOC)
// ============================================================

export type IOCType = 'ip' | 'domain' | 'url' | 'hash_md5' | 'hash_sha1' | 'hash_sha256' | 'email' | 'file_path' | 'registry_key' | 'user_agent' | 'mutex' | 'certificate';

export interface IOC {
  id: string;
  type: IOCType;
  value: string;
  severity: ThreatSeverity;
  source: string; // Where this IOC was detected or imported from
  firstSeen: Date;
  lastSeen: Date;
  hitCount: number;
  tags: string[];
  threatIntelSource?: string;
  confidence: number; // 0-100
  active: boolean;
}

// ============================================================
// MITRE ATT&CK FRAMEWORK
// ============================================================

export type MitreTactic = 
  | 'reconnaissance'
  | 'resource_development'
  | 'initial_access'
  | 'execution'
  | 'persistence'
  | 'privilege_escalation'
  | 'defense_evasion'
  | 'credential_access'
  | 'discovery'
  | 'lateral_movement'
  | 'collection'
  | 'command_and_control'
  | 'exfiltration'
  | 'impact';

export interface MitreAttackTechnique {
  id: string; // e.g., T1059.001
  name: string;
  tactic: MitreTactic;
  description?: string;
  detection?: string;
  mitigation?: string;
}

// ============================================================
// ALERT RULES
// ============================================================

export type RuleConditionOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'regex' | 'in' | 'not_in';
export type RuleAggregation = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct_count';
export type RuleTimeWindow = '1m' | '5m' | '15m' | '30m' | '1h' | '6h' | '12h' | '24h';

export interface RuleCondition {
  field: string;
  operator: RuleConditionOperator;
  value: string | number | string[];
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: ThreatSeverity;
  type: AlertType;
  
  // Conditions
  conditions: RuleCondition[];
  conditionLogic: 'and' | 'or';
  
  // Aggregation (for threshold rules)
  aggregation?: {
    function: RuleAggregation;
    field?: string;
    groupBy?: string[];
    threshold: number;
    timeWindow: RuleTimeWindow;
  };
  
  // Correlation (for correlation rules)
  correlation?: {
    events: string[]; // Rule IDs that must fire together
    timeWindow: RuleTimeWindow;
    minEvents: number;
  };
  
  // Actions
  actions: AlertAction[];
  
  // Metadata
  tags: string[];
  mitreMapping?: string[]; // MITRE ATT&CK technique IDs
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastTriggered?: Date;
  triggerCount: number;
}

export type AlertActionType = 'email' | 'slack' | 'webhook' | 'ticket' | 'playbook' | 'block_ip' | 'isolate_host';

export interface AlertAction {
  type: AlertActionType;
  config: Record<string, unknown>;
  enabled: boolean;
}

// ============================================================
// INCIDENT RESPONSE
// ============================================================

export type IncidentStatus = 'open' | 'in_progress' | 'pending' | 'resolved' | 'closed';
export type IncidentPriority = 'p1' | 'p2' | 'p3' | 'p4';

export interface Incident {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  title: string;
  description: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  severity: ThreatSeverity;
  
  // Related items
  threats: string[]; // Threat IDs
  affectedAssets: string[];
  iocs: string[]; // IOC IDs
  
  // Timeline
  timeline: IncidentTimelineEntry[];
  
  // Response
  assignedTo?: string;
  playbook?: string;
  runbook?: string;
  
  // Resolution
  resolvedAt?: Date;
  closedAt?: Date;
  resolution?: string;
  rootCause?: string;
  lessonsLearned?: string;
  
  // Metrics
  timeToDetect?: number; // seconds
  timeToRespond?: number; // seconds
  timeToResolve?: number; // seconds
}

export interface IncidentTimelineEntry {
  timestamp: Date;
  type: 'created' | 'updated' | 'comment' | 'action' | 'evidence' | 'status_change';
  actor: string;
  description: string;
  action?: string;
  details?: string;
  data?: Record<string, unknown>;
}

// ============================================================
// PLAYBOOKS
// ============================================================

export type PlaybookStepType = 'manual' | 'automated' | 'conditional' | 'parallel' | 'approval';

export interface Playbook {
  id: string;
  name: string;
  description: string;
  triggerConditions: PlaybookTrigger[];
  steps: PlaybookStep[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  executionCount: number;
  avgExecutionTime?: number;
}

export interface PlaybookTrigger {
  field: string;
  operator: string;
  value: string;
}

export interface PlaybookStep {
  id: string;
  name: string;
  description: string;
  type: PlaybookStepType;
  order: number;
  action: string;
  automated: boolean;
  parameters?: Record<string, unknown>;
  config: Record<string, unknown>;
  onSuccess?: string; // Next step ID
  onFailure?: string; // Step ID on failure
  timeout?: number; // seconds
}

// ============================================================
// ANOMALY DETECTION
// ============================================================

export interface AnomalyBaseline {
  id: string;
  metric: string;
  source: string;
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  sampleCount: number;
  lastUpdated: Date;
  timeWindow: RuleTimeWindow;
}

export interface AnomalyDetection {
  id: string;
  timestamp: Date;
  metric: string;
  source: string;
  expectedValue: number;
  actualValue: number;
  deviation: number; // Standard deviations from mean
  severity: ThreatSeverity;
  description: string;
  relatedLogs: string[];
}

// ============================================================
// SECURITY ANALYTICS
// ============================================================

export interface SecurityMetrics {
  period: string;
  totalThreats: number;
  threatsBySeverity: Record<ThreatSeverity, number>;
  threatsByType: Record<AlertType, number>;
  topAttackVectors: { vector: string; count: number }[];
  topSourceIPs: { ip: string; count: number; country?: string }[];
  topTargetedAssets: { asset: string; count: number }[];
  mttr: number; // Mean time to respond (seconds)
  mttd: number; // Mean time to detect (seconds)
  falsePositiveRate: number;
  alertVolume: { timestamp: Date; count: number }[];
  incidentTrend: { date: string; open: number; resolved: number }[];
}

export interface ThreatIntelFeed {
  id: string;
  name: string;
  type: 'stix' | 'taxii' | 'csv' | 'json' | 'api';
  url: string;
  apiKey?: string;
  enabled: boolean;
  lastSync?: Date;
  iocCount: number;
  updateFrequency: string; // cron expression
}

// ============================================================
// LOG CORRELATION
// ============================================================

export interface CorrelationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  
  // Events to correlate
  eventPatterns: EventPattern[];
  conditions: RuleCondition[];
  threshold: number;
  minDistinctSources: number;
  
  // Correlation settings
  timeWindow: RuleTimeWindow;
  minMatchCount: number;
  groupBy?: string[]; // Fields to group by (e.g., source_ip, user)
  
  // Output
  severity: ThreatSeverity;
  threatType: AlertType;
  
  tags: string[];
}

export interface EventPattern {
  id: string;
  order: number;
  required: boolean;
  conditions: RuleCondition[];
}

// ============================================================
// INVESTIGATION CONTEXT
// ============================================================

export interface InvestigationContext {
  threatId: string;
  summary: string;
  timeline: {
    timestamp: Date;
    event: string;
    source: string;
    details: Record<string, unknown>;
  }[];
  relatedEntities: {
    type: 'ip' | 'user' | 'host' | 'domain' | 'file';
    value: string;
    reputation?: string;
    firstSeen: Date;
    eventCount: number;
  }[];
  aiInsights: string[];
  suggestedActions: string[];
  similarIncidents: string[];
}

// ============================================================
// ALERT RESULT
// ============================================================

export interface AlertResult {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  severity: ThreatSeverity;
  matchedConditions: number;
  totalConditions: number;
  details: string;
  timestamp: Date;
}

// ============================================================
// CORRELATED EVENT
// ============================================================

export interface CorrelatedEvent {
  id: string;
  correlationRuleId: string;
  ruleName: string;
  severity: ThreatSeverity;
  matchedEvents: string[];
  groupKey: string;
  firstEventTime: Date;
  lastEventTime: Date;
  eventCount: number;
  description: string;
  createdAt: Date;
}

// ============================================================
// SIEM ORCHESTRATOR
// ============================================================

export interface SIEMProcessResult {
  logId: string;
  threats: Threat[];
  alerts: AlertResult[];
  correlations: CorrelatedEvent[];
  anomalies: AnomalyDetection[];
  processingTime: number;
}

export interface SIEMHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: Record<string, { status: string; message?: string }>;
}

export interface SIEMDashboardStats {
  threats: {
    total: number;
    bySeverity: Record<ThreatSeverity, number>;
    byStatus: Record<string, number>;
    recentTrend: { date: string; count: number }[];
  };
  incidents: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    avgResolutionTime: number;
  };
  alerts: {
    total: number;
    triggeredToday: number;
    topRules: { ruleId: string; name: string; count: number }[];
  };
  correlations: {
    total: number;
    activePatterns: number;
  };
}
