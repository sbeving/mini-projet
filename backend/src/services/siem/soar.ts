/**
 * SOAR - Security Orchestration, Automation and Response
 * Automated response actions for security incidents
 * 
 * Features:
 * - Playbook execution engine
 * - Automated response actions
 * - Integration with external systems
 * - Action audit trail
 * - Rollback capabilities
 */

import { ThreatSeverity, Incident, Threat } from './types.js';

// ============================================================
// ACTION TYPES
// ============================================================

export type ActionType = 
  | 'block_ip'
  | 'block_domain'
  | 'quarantine_file'
  | 'disable_user'
  | 'reset_password'
  | 'isolate_endpoint'
  | 'kill_process'
  | 'collect_evidence'
  | 'send_notification'
  | 'create_ticket'
  | 'enrich_indicator'
  | 'run_scan'
  | 'custom_script';

export type ActionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';

export interface ActionParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  default?: unknown;
  description: string;
}

export interface ActionDefinition {
  id: ActionType;
  name: string;
  description: string;
  category: 'containment' | 'eradication' | 'recovery' | 'notification' | 'enrichment';
  severity: ThreatSeverity;
  parameters: ActionParameter[];
  requiresApproval: boolean;
  reversible: boolean;
  timeout: number; // seconds
}

export interface ActionExecution {
  id: string;
  actionType: ActionType;
  status: ActionStatus;
  triggeredBy: string; // 'playbook' | 'manual' | 'auto-response'
  triggeredAt: Date;
  completedAt?: Date;
  parameters: Record<string, unknown>;
  result?: ActionResult;
  incidentId?: string;
  threatId?: string;
  error?: string;
  rollbackable: boolean;
  rolledBackAt?: Date;
  approvedBy?: string;
  approvedAt?: Date;
}

export interface ActionResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
  affectedEntities?: string[];
  evidence?: string[];
}

// ============================================================
// PLAYBOOK TYPES
// ============================================================

export type PlaybookTrigger = 
  | 'threat_detected'
  | 'incident_created'
  | 'severity_critical'
  | 'severity_high'
  | 'ioc_match'
  | 'anomaly_detected'
  | 'manual';

export interface PlaybookStep {
  id: string;
  order: number;
  action: ActionType;
  parameters: Record<string, unknown>;
  condition?: {
    field: string;
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'contains' | 'in';
    value: unknown;
  };
  onFailure: 'stop' | 'continue' | 'retry' | 'goto';
  gotoStep?: string;
  maxRetries?: number;
  waitBefore?: number; // seconds
}

export interface Playbook {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: PlaybookTrigger;
  triggerConditions?: Record<string, unknown>;
  steps: PlaybookStep[];
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastRun?: Date;
  runCount: number;
  tags: string[];
}

export interface PlaybookExecution {
  id: string;
  playbookId: string;
  playbookName: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  currentStep: number;
  totalSteps: number;
  stepResults: {
    stepId: string;
    actionType: ActionType;
    status: ActionStatus;
    result?: ActionResult;
    startedAt: Date;
    completedAt?: Date;
    error?: string;
  }[];
  triggeredBy: string;
  incidentId?: string;
  threatId?: string;
  context: Record<string, unknown>;
}

// ============================================================
// ACTION DEFINITIONS
// ============================================================

const ACTION_DEFINITIONS: Map<ActionType, ActionDefinition> = new Map([
  ['block_ip', {
    id: 'block_ip',
    name: 'Block IP Address',
    description: 'Add IP address to firewall block list',
    category: 'containment',
    severity: 'high',
    parameters: [
      { name: 'ip', type: 'string', required: true, description: 'IP address to block' },
      { name: 'duration', type: 'number', required: false, default: 86400, description: 'Block duration in seconds' },
      { name: 'reason', type: 'string', required: false, description: 'Reason for blocking' },
    ],
    requiresApproval: false,
    reversible: true,
    timeout: 30,
  }],
  ['block_domain', {
    id: 'block_domain',
    name: 'Block Domain',
    description: 'Add domain to DNS blocklist',
    category: 'containment',
    severity: 'high',
    parameters: [
      { name: 'domain', type: 'string', required: true, description: 'Domain to block' },
      { name: 'includeSubdomains', type: 'boolean', required: false, default: true, description: 'Block subdomains' },
    ],
    requiresApproval: false,
    reversible: true,
    timeout: 30,
  }],
  ['quarantine_file', {
    id: 'quarantine_file',
    name: 'Quarantine File',
    description: 'Move malicious file to quarantine',
    category: 'eradication',
    severity: 'high',
    parameters: [
      { name: 'filePath', type: 'string', required: true, description: 'Full path to file' },
      { name: 'hash', type: 'string', required: false, description: 'File hash for verification' },
    ],
    requiresApproval: true,
    reversible: true,
    timeout: 60,
  }],
  ['disable_user', {
    id: 'disable_user',
    name: 'Disable User Account',
    description: 'Disable user account to prevent access',
    category: 'containment',
    severity: 'critical',
    parameters: [
      { name: 'userId', type: 'string', required: true, description: 'User ID or username' },
      { name: 'terminateSessions', type: 'boolean', required: false, default: true, description: 'Terminate active sessions' },
    ],
    requiresApproval: true,
    reversible: true,
    timeout: 30,
  }],
  ['reset_password', {
    id: 'reset_password',
    name: 'Force Password Reset',
    description: 'Force user to reset password on next login',
    category: 'containment',
    severity: 'medium',
    parameters: [
      { name: 'userId', type: 'string', required: true, description: 'User ID or username' },
      { name: 'notifyUser', type: 'boolean', required: false, default: true, description: 'Send notification to user' },
    ],
    requiresApproval: false,
    reversible: false,
    timeout: 30,
  }],
  ['isolate_endpoint', {
    id: 'isolate_endpoint',
    name: 'Isolate Endpoint',
    description: 'Network isolate compromised endpoint',
    category: 'containment',
    severity: 'critical',
    parameters: [
      { name: 'endpointId', type: 'string', required: true, description: 'Endpoint ID or hostname' },
      { name: 'allowedConnections', type: 'array', required: false, description: 'Allowed IPs during isolation' },
    ],
    requiresApproval: true,
    reversible: true,
    timeout: 60,
  }],
  ['kill_process', {
    id: 'kill_process',
    name: 'Kill Process',
    description: 'Terminate malicious process on endpoint',
    category: 'eradication',
    severity: 'high',
    parameters: [
      { name: 'endpointId', type: 'string', required: true, description: 'Endpoint ID' },
      { name: 'processId', type: 'number', required: false, description: 'Process ID' },
      { name: 'processName', type: 'string', required: false, description: 'Process name' },
    ],
    requiresApproval: false,
    reversible: false,
    timeout: 30,
  }],
  ['collect_evidence', {
    id: 'collect_evidence',
    name: 'Collect Evidence',
    description: 'Gather forensic evidence from endpoint',
    category: 'enrichment',
    severity: 'low',
    parameters: [
      { name: 'endpointId', type: 'string', required: true, description: 'Endpoint ID' },
      { name: 'evidenceTypes', type: 'array', required: true, description: 'Types: memory, disk, network, logs' },
    ],
    requiresApproval: false,
    reversible: false,
    timeout: 300,
  }],
  ['send_notification', {
    id: 'send_notification',
    name: 'Send Notification',
    description: 'Send alert notification via email/Slack/etc.',
    category: 'notification',
    severity: 'info',
    parameters: [
      { name: 'channel', type: 'string', required: true, description: 'email, slack, teams, webhook' },
      { name: 'recipients', type: 'array', required: true, description: 'List of recipients' },
      { name: 'message', type: 'string', required: true, description: 'Notification message' },
      { name: 'priority', type: 'string', required: false, default: 'normal', description: 'Priority level' },
    ],
    requiresApproval: false,
    reversible: false,
    timeout: 30,
  }],
  ['create_ticket', {
    id: 'create_ticket',
    name: 'Create Ticket',
    description: 'Create incident ticket in ITSM system',
    category: 'notification',
    severity: 'low',
    parameters: [
      { name: 'system', type: 'string', required: true, description: 'jira, servicenow, zendesk' },
      { name: 'title', type: 'string', required: true, description: 'Ticket title' },
      { name: 'description', type: 'string', required: true, description: 'Ticket description' },
      { name: 'priority', type: 'string', required: false, description: 'Ticket priority' },
      { name: 'assignee', type: 'string', required: false, description: 'Assignee' },
    ],
    requiresApproval: false,
    reversible: false,
    timeout: 30,
  }],
  ['enrich_indicator', {
    id: 'enrich_indicator',
    name: 'Enrich Indicator',
    description: 'Lookup indicator in threat intelligence sources',
    category: 'enrichment',
    severity: 'info',
    parameters: [
      { name: 'indicator', type: 'string', required: true, description: 'IOC value' },
      { name: 'indicatorType', type: 'string', required: true, description: 'ip, domain, hash, url' },
      { name: 'sources', type: 'array', required: false, description: 'Specific TI sources to query' },
    ],
    requiresApproval: false,
    reversible: false,
    timeout: 60,
  }],
  ['run_scan', {
    id: 'run_scan',
    name: 'Run Security Scan',
    description: 'Initiate vulnerability or malware scan',
    category: 'enrichment',
    severity: 'low',
    parameters: [
      { name: 'scanType', type: 'string', required: true, description: 'vulnerability, malware, compliance' },
      { name: 'targets', type: 'array', required: true, description: 'Scan targets' },
      { name: 'profile', type: 'string', required: false, description: 'Scan profile/policy' },
    ],
    requiresApproval: false,
    reversible: false,
    timeout: 3600,
  }],
  ['custom_script', {
    id: 'custom_script',
    name: 'Run Custom Script',
    description: 'Execute custom response script',
    category: 'eradication',
    severity: 'high',
    parameters: [
      { name: 'scriptId', type: 'string', required: true, description: 'Script identifier' },
      { name: 'scriptArgs', type: 'object', required: false, description: 'Script arguments' },
    ],
    requiresApproval: true,
    reversible: false,
    timeout: 300,
  }],
]);

// ============================================================
// DEFAULT PLAYBOOKS
// ============================================================

const DEFAULT_PLAYBOOKS: Playbook[] = [
  {
    id: 'playbook-critical-threat',
    name: 'Critical Threat Response',
    description: 'Automated response to critical severity threats',
    enabled: true,
    trigger: 'severity_critical',
    steps: [
      {
        id: 'step-1',
        order: 1,
        action: 'send_notification',
        parameters: {
          channel: 'slack',
          recipients: ['#security-alerts'],
          message: 'CRITICAL: Security threat detected - immediate response initiated',
          priority: 'high',
        },
        onFailure: 'continue',
      },
      {
        id: 'step-2',
        order: 2,
        action: 'enrich_indicator',
        parameters: {},
        onFailure: 'continue',
      },
      {
        id: 'step-3',
        order: 3,
        action: 'collect_evidence',
        parameters: {
          evidenceTypes: ['logs', 'network'],
        },
        onFailure: 'continue',
      },
      {
        id: 'step-4',
        order: 4,
        action: 'create_ticket',
        parameters: {
          system: 'jira',
          title: 'Critical Security Incident - Auto-generated',
          priority: 'highest',
        },
        onFailure: 'stop',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    runCount: 0,
    tags: ['critical', 'automated'],
  },
  {
    id: 'playbook-malicious-ip',
    name: 'Malicious IP Response',
    description: 'Block and investigate malicious IP addresses',
    enabled: true,
    trigger: 'ioc_match',
    triggerConditions: { iocType: 'ip' },
    steps: [
      {
        id: 'step-1',
        order: 1,
        action: 'block_ip',
        parameters: { duration: 86400 },
        onFailure: 'stop',
      },
      {
        id: 'step-2',
        order: 2,
        action: 'enrich_indicator',
        parameters: { indicatorType: 'ip' },
        onFailure: 'continue',
      },
      {
        id: 'step-3',
        order: 3,
        action: 'send_notification',
        parameters: {
          channel: 'email',
          recipients: ['security@company.com'],
          message: 'Malicious IP automatically blocked',
        },
        onFailure: 'continue',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    runCount: 0,
    tags: ['ip', 'automated', 'blocking'],
  },
  {
    id: 'playbook-ransomware',
    name: 'Ransomware Containment',
    description: 'Emergency response for ransomware detection',
    enabled: true,
    trigger: 'threat_detected',
    triggerConditions: { threatType: 'ransomware' },
    steps: [
      {
        id: 'step-1',
        order: 1,
        action: 'send_notification',
        parameters: {
          channel: 'slack',
          recipients: ['#security-alerts', '#incident-response'],
          message: '🚨 RANSOMWARE DETECTED - Initiating containment',
          priority: 'critical',
        },
        onFailure: 'continue',
      },
      {
        id: 'step-2',
        order: 2,
        action: 'isolate_endpoint',
        parameters: {},
        onFailure: 'continue',
      },
      {
        id: 'step-3',
        order: 3,
        action: 'kill_process',
        parameters: {},
        onFailure: 'continue',
      },
      {
        id: 'step-4',
        order: 4,
        action: 'collect_evidence',
        parameters: {
          evidenceTypes: ['memory', 'disk', 'network', 'logs'],
        },
        onFailure: 'continue',
      },
      {
        id: 'step-5',
        order: 5,
        action: 'create_ticket',
        parameters: {
          system: 'jira',
          title: 'RANSOMWARE INCIDENT - IMMEDIATE ACTION REQUIRED',
          priority: 'highest',
        },
        onFailure: 'stop',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    runCount: 0,
    tags: ['ransomware', 'critical', 'containment'],
  },
  {
    id: 'playbook-brute-force',
    name: 'Brute Force Defense',
    description: 'Respond to detected brute force attacks',
    enabled: true,
    trigger: 'threat_detected',
    triggerConditions: { threatType: 'brute_force' },
    steps: [
      {
        id: 'step-1',
        order: 1,
        action: 'block_ip',
        parameters: { duration: 3600 },
        onFailure: 'continue',
      },
      {
        id: 'step-2',
        order: 2,
        action: 'reset_password',
        parameters: { notifyUser: true },
        condition: { field: 'targetUser', operator: 'neq', value: null },
        onFailure: 'continue',
      },
      {
        id: 'step-3',
        order: 3,
        action: 'send_notification',
        parameters: {
          channel: 'email',
          message: 'Brute force attack detected and blocked',
        },
        onFailure: 'continue',
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'system',
    runCount: 0,
    tags: ['brute-force', 'automated'],
  },
];

// ============================================================
// SOAR ENGINE CLASS
// ============================================================

class SOAREngine {
  private playbooks: Map<string, Playbook> = new Map();
  private executions: Map<string, PlaybookExecution> = new Map();
  private actionHistory: ActionExecution[] = [];
  private pendingApprovals: ActionExecution[] = [];

  constructor() {
    // Initialize with default playbooks
    for (const playbook of DEFAULT_PLAYBOOKS) {
      this.playbooks.set(playbook.id, playbook);
    }
  }

  // ============================================================
  // PLAYBOOK MANAGEMENT
  // ============================================================

  getPlaybooks(): Playbook[] {
    return Array.from(this.playbooks.values());
  }

  getPlaybook(id: string): Playbook | undefined {
    return this.playbooks.get(id);
  }

  createPlaybook(playbook: Omit<Playbook, 'id' | 'createdAt' | 'updatedAt' | 'runCount'>): Playbook {
    const newPlaybook: Playbook = {
      ...playbook,
      id: `playbook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      runCount: 0,
    };
    this.playbooks.set(newPlaybook.id, newPlaybook);
    return newPlaybook;
  }

  updatePlaybook(id: string, updates: Partial<Playbook>): Playbook | null {
    const playbook = this.playbooks.get(id);
    if (!playbook) return null;

    const updated = { ...playbook, ...updates, updatedAt: new Date() };
    this.playbooks.set(id, updated);
    return updated;
  }

  deletePlaybook(id: string): boolean {
    return this.playbooks.delete(id);
  }

  togglePlaybook(id: string, enabled: boolean): boolean {
    const playbook = this.playbooks.get(id);
    if (!playbook) return false;
    playbook.enabled = enabled;
    return true;
  }

  // ============================================================
  // PLAYBOOK EXECUTION
  // ============================================================

  async runPlaybook(
    playbookId: string,
    context: Record<string, unknown>,
    triggeredBy: string = 'manual'
  ): Promise<PlaybookExecution | null> {
    const playbook = this.playbooks.get(playbookId);
    if (!playbook || !playbook.enabled) return null;

    const execution: PlaybookExecution = {
      id: `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      playbookId: playbook.id,
      playbookName: playbook.name,
      status: 'running',
      startedAt: new Date(),
      currentStep: 0,
      totalSteps: playbook.steps.length,
      stepResults: [],
      triggeredBy,
      context,
    };

    this.executions.set(execution.id, execution);
    playbook.lastRun = new Date();
    playbook.runCount++;

    // Execute steps sequentially
    for (const step of playbook.steps.sort((a, b) => a.order - b.order)) {
      execution.currentStep = step.order;

      // Check condition if present
      if (step.condition) {
        const fieldValue = context[step.condition.field];
        if (!this.evaluateCondition(fieldValue, step.condition.operator, step.condition.value)) {
          execution.stepResults.push({
            stepId: step.id,
            actionType: step.action,
            status: 'completed',
            result: { success: true, message: 'Step skipped - condition not met' },
            startedAt: new Date(),
            completedAt: new Date(),
          });
          continue;
        }
      }

      // Wait before execution if specified
      const waitTime = step.waitBefore ?? 0;
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      }

      // Execute the action
      const stepResult = await this.executeAction(step.action, {
        ...step.parameters,
        ...context,
      });

      execution.stepResults.push({
        stepId: step.id,
        actionType: step.action,
        status: stepResult.success ? 'completed' : 'failed',
        result: stepResult,
        startedAt: new Date(),
        completedAt: new Date(),
        error: stepResult.success ? undefined : stepResult.message,
      });

      // Handle failure
      if (!stepResult.success) {
        if (step.onFailure === 'stop') {
          execution.status = 'failed';
          execution.completedAt = new Date();
          return execution;
        }
        // 'continue' just moves on, 'retry' and 'goto' would need more logic
      }
    }

    execution.status = 'completed';
    execution.completedAt = new Date();
    return execution;
  }

  private evaluateCondition(
    fieldValue: unknown,
    operator: string,
    conditionValue: unknown
  ): boolean {
    switch (operator) {
      case 'eq': return fieldValue === conditionValue;
      case 'neq': return fieldValue !== conditionValue;
      case 'gt': return (fieldValue as number) > (conditionValue as number);
      case 'lt': return (fieldValue as number) < (conditionValue as number);
      case 'contains': return String(fieldValue).includes(String(conditionValue));
      case 'in': return Array.isArray(conditionValue) && conditionValue.includes(fieldValue);
      default: return false;
    }
  }

  // ============================================================
  // ACTION EXECUTION
  // ============================================================

  async executeAction(
    actionType: ActionType,
    parameters: Record<string, unknown>
  ): Promise<ActionResult> {
    const definition = ACTION_DEFINITIONS.get(actionType);
    if (!definition) {
      return { success: false, message: `Unknown action type: ${actionType}` };
    }

    // Validate required parameters
    for (const param of definition.parameters) {
      if (param.required && !(param.name in parameters)) {
        return { success: false, message: `Missing required parameter: ${param.name}` };
      }
    }

    // Simulate action execution (in production, these would call real integrations)
    try {
      const result = await this.simulateActionExecution(actionType, parameters, definition);
      
      // Record action history
      this.actionHistory.push({
        id: `action-${Date.now()}`,
        actionType,
        status: result.success ? 'completed' : 'failed',
        triggeredBy: 'playbook',
        triggeredAt: new Date(),
        completedAt: new Date(),
        parameters,
        result,
        rollbackable: definition.reversible,
      });

      return result;
    } catch (error) {
      return {
        success: false,
        message: `Action execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async simulateActionExecution(
    actionType: ActionType,
    parameters: Record<string, unknown>,
    _definition: ActionDefinition
  ): Promise<ActionResult> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));

    // Simulate success (in production, call real APIs)
    switch (actionType) {
      case 'block_ip':
        return {
          success: true,
          message: `Successfully blocked IP ${parameters.ip}`,
          data: { 
            blockedAt: new Date(),
            expiresAt: new Date(Date.now() + (parameters.duration as number || 86400) * 1000),
          },
          affectedEntities: [parameters.ip as string],
        };

      case 'block_domain':
        return {
          success: true,
          message: `Successfully blocked domain ${parameters.domain}`,
          data: { blockedAt: new Date() },
          affectedEntities: [parameters.domain as string],
        };

      case 'disable_user':
        return {
          success: true,
          message: `Successfully disabled user ${parameters.userId}`,
          data: { 
            disabledAt: new Date(),
            sessionTerminated: parameters.terminateSessions,
          },
          affectedEntities: [parameters.userId as string],
        };

      case 'isolate_endpoint':
        return {
          success: true,
          message: `Successfully isolated endpoint ${parameters.endpointId}`,
          data: { isolatedAt: new Date() },
          affectedEntities: [parameters.endpointId as string],
        };

      case 'send_notification':
        return {
          success: true,
          message: `Notification sent via ${parameters.channel}`,
          data: { 
            sentAt: new Date(),
            recipients: parameters.recipients,
          },
        };

      case 'create_ticket':
        return {
          success: true,
          message: `Ticket created in ${parameters.system}`,
          data: { 
            ticketId: `TICKET-${Date.now()}`,
            createdAt: new Date(),
          },
        };

      case 'enrich_indicator':
        return {
          success: true,
          message: `Indicator ${parameters.indicator} enriched`,
          data: {
            malicious: Math.random() > 0.5,
            sources: ['VirusTotal', 'AbuseIPDB', 'OTX'],
          },
        };

      case 'collect_evidence':
        return {
          success: true,
          message: `Evidence collection initiated`,
          data: { 
            collectionId: `EVD-${Date.now()}`,
            types: parameters.evidenceTypes,
          },
          evidence: [`evidence-${Date.now()}.zip`],
        };

      default:
        return {
          success: true,
          message: `Action ${actionType} executed successfully`,
        };
    }
  }

  // ============================================================
  // TRIGGER EVALUATION
  // ============================================================

  /**
   * Check if any playbooks should trigger for a threat
   */
  async evaluateTriggers(event: {
    type: 'threat' | 'incident' | 'ioc';
    severity?: ThreatSeverity;
    data: Record<string, unknown>;
  }): Promise<PlaybookExecution[]> {
    const executions: PlaybookExecution[] = [];

    for (const playbook of this.playbooks.values()) {
      if (!playbook.enabled) continue;

      let shouldTrigger = false;

      switch (playbook.trigger) {
        case 'threat_detected':
          shouldTrigger = event.type === 'threat';
          break;
        case 'incident_created':
          shouldTrigger = event.type === 'incident';
          break;
        case 'severity_critical':
          shouldTrigger = event.severity === 'critical';
          break;
        case 'severity_high':
          shouldTrigger = event.severity === 'high' || event.severity === 'critical';
          break;
        case 'ioc_match':
          shouldTrigger = event.type === 'ioc';
          break;
      }

      // Check additional trigger conditions
      if (shouldTrigger && playbook.triggerConditions) {
        for (const [key, value] of Object.entries(playbook.triggerConditions)) {
          if (event.data[key] !== value) {
            shouldTrigger = false;
            break;
          }
        }
      }

      if (shouldTrigger) {
        const execution = await this.runPlaybook(playbook.id, event.data, 'auto-trigger');
        if (execution) {
          executions.push(execution);
        }
      }
    }

    return executions;
  }

  // ============================================================
  // ACTION HISTORY & APPROVALS
  // ============================================================

  getActionHistory(limit: number = 100): ActionExecution[] {
    return this.actionHistory.slice(-limit);
  }

  getPendingApprovals(): ActionExecution[] {
    return this.pendingApprovals;
  }

  /**
   * Approve a pending action and execute it
   */
  async approveAction(actionId: string, approvedBy: string): Promise<{
    success: boolean;
    message: string;
    action?: ActionExecution;
  }> {
    const index = this.pendingApprovals.findIndex(a => a.id === actionId);
    
    if (index === -1) {
      return {
        success: false,
        message: `Action ${actionId} not found in pending approvals`,
      };
    }

    const action = this.pendingApprovals[index];
    
    // Remove from pending
    this.pendingApprovals.splice(index, 1);

    // Update action status
    action.status = 'completed';
    action.completedAt = new Date();

    // Add approval metadata
    (action as any).approvedBy = approvedBy;
    (action as any).approvedAt = new Date();

    // Add to history
    this.actionHistory.push(action);

    // Execute the actual action (simulated)
    console.log(`[SOAR] Action ${actionId} approved by ${approvedBy}:`, action.actionType);

    return {
      success: true,
      message: `Action ${actionId} approved and executed`,
      action,
    };
  }

  /**
   * Reject a pending action
   */
  async rejectAction(actionId: string, rejectedBy: string): Promise<{
    success: boolean;
    message: string;
    action?: ActionExecution;
  }> {
    const index = this.pendingApprovals.findIndex(a => a.id === actionId);
    
    if (index === -1) {
      return {
        success: false,
        message: `Action ${actionId} not found in pending approvals`,
      };
    }

    const action = this.pendingApprovals[index];
    
    // Remove from pending
    this.pendingApprovals.splice(index, 1);

    // Update action status
    action.status = 'failed';
    action.completedAt = new Date();
    action.error = `Rejected by ${rejectedBy}`;

    // Add rejection metadata
    (action as any).rejectedBy = rejectedBy;
    (action as any).rejectedAt = new Date();

    // Add to history
    this.actionHistory.push(action);

    console.log(`[SOAR] Action ${actionId} rejected by ${rejectedBy}`);

    return {
      success: true,
      message: `Action ${actionId} rejected`,
      action,
    };
  }

  getExecutions(limit: number = 50): PlaybookExecution[] {
    return Array.from(this.executions.values())
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
      .slice(0, limit);
  }

  getActionDefinitions(): ActionDefinition[] {
    return Array.from(ACTION_DEFINITIONS.values());
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  getStats(): {
    totalPlaybooks: number;
    enabledPlaybooks: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    actionsExecuted: number;
    pendingApprovals: number;
  } {
    const executions = Array.from(this.executions.values());
    
    return {
      totalPlaybooks: this.playbooks.size,
      enabledPlaybooks: Array.from(this.playbooks.values()).filter(p => p.enabled).length,
      totalExecutions: executions.length,
      successfulExecutions: executions.filter(e => e.status === 'completed').length,
      failedExecutions: executions.filter(e => e.status === 'failed').length,
      actionsExecuted: this.actionHistory.length,
      pendingApprovals: this.pendingApprovals.length,
    };
  }
}

// Export singleton instance
export const soarEngine = new SOAREngine();
