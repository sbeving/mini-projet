/**
 * SIEM Incident Response Manager
 * Incident lifecycle management with automated playbooks
 */

import crypto from 'crypto';
import {
  Incident,
  IncidentStatus,
  IncidentPriority,
  IncidentTimelineEntry,
  Playbook,
  PlaybookStep,
  PlaybookTrigger,
  ThreatSeverity,
  Threat,
} from './types.js';

// ============================================================
// DEFAULT PLAYBOOKS
// ============================================================

const DEFAULT_PLAYBOOKS: Playbook[] = [
  {
    id: 'playbook_brute_force',
    name: 'Brute Force Response',
    description: 'Automated response to brute force attacks',
    enabled: true,
    triggerConditions: [
      { field: 'threatType', operator: 'eq', value: 'brute_force' },
    ],
    steps: [
      {
        id: 'step_1',
        name: 'Block Source IP',
        description: 'Temporarily block the attacking IP',
        type: 'automated',
        action: 'block_ip',
        automated: true,
        parameters: { duration: '24h' },
        config: { duration: '24h' },
        order: 1,
        timeout: 30,
      },
      {
        id: 'step_2',
        name: 'Review Account Status',
        description: 'Check if target accounts are compromised',
        type: 'manual',
        action: 'manual_review',
        automated: false,
        parameters: {},
        config: {},
        order: 2,
        timeout: 3600,
      },
      {
        id: 'step_3',
        name: 'Notify Security Team',
        description: 'Send alert to security team',
        type: 'automated',
        action: 'notify',
        automated: true,
        parameters: { channel: 'security', priority: 'high' },
        config: { channel: 'security', priority: 'high' },
        order: 3,
        timeout: 60,
      },
      {
        id: 'step_4',
        name: 'Generate Report',
        description: 'Create incident report',
        type: 'automated',
        action: 'generate_report',
        automated: true,
        parameters: { template: 'brute_force' },
        config: { template: 'brute_force' },
        order: 4,
        timeout: 120,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    executionCount: 0,
  },
  {
    id: 'playbook_malware',
    name: 'Malware Containment',
    description: 'Contain and remediate malware infections',
    enabled: true,
    triggerConditions: [
      { field: 'threatType', operator: 'eq', value: 'malware' },
    ],
    steps: [
      {
        id: 'step_1',
        name: 'Isolate Host',
        description: 'Network isolation of infected host',
        type: 'automated',
        action: 'isolate_host',
        automated: true,
        parameters: { method: 'network' },
        config: { method: 'network' },
        order: 1,
        timeout: 60,
      },
      {
        id: 'step_2',
        name: 'Collect Forensics',
        description: 'Capture memory and disk artifacts',
        type: 'automated',
        action: 'collect_forensics',
        automated: true,
        parameters: {},
        config: {},
        order: 2,
        timeout: 1800,
      },
      {
        id: 'step_3',
        name: 'Scan Related Hosts',
        description: 'Check for lateral movement',
        type: 'automated',
        action: 'scan_network',
        automated: true,
        parameters: { scanType: 'ioc' },
        config: { scanType: 'ioc' },
        order: 3,
        timeout: 600,
      },
      {
        id: 'step_4',
        name: 'Remediate',
        description: 'Remove malware and restore system',
        type: 'automated',
        action: 'remediate',
        automated: true,
        parameters: {},
        config: {},
        order: 4,
        timeout: 3600,
      },
      {
        id: 'step_5',
        name: 'Escalate to IR Team',
        description: 'Notify incident response team',
        type: 'automated',
        action: 'escalate',
        automated: true,
        parameters: { team: 'ir', severity: 'critical' },
        config: { team: 'ir', severity: 'critical' },
        order: 5,
        timeout: 60,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    executionCount: 0,
  },
  {
    id: 'playbook_data_exfiltration',
    name: 'Data Exfiltration Response',
    description: 'Respond to potential data theft',
    enabled: true,
    triggerConditions: [
      { field: 'threatType', operator: 'eq', value: 'data_exfiltration' },
    ],
    steps: [
      {
        id: 'step_1',
        name: 'Block External Transfer',
        description: 'Stop data transfer immediately',
        type: 'automated',
        action: 'block_transfer',
        automated: true,
        parameters: {},
        config: {},
        order: 1,
        timeout: 30,
      },
      {
        id: 'step_2',
        name: 'Identify Data Scope',
        description: 'Determine what data was accessed',
        type: 'manual',
        action: 'data_assessment',
        automated: false,
        parameters: {},
        config: {},
        order: 2,
        timeout: 7200,
      },
      {
        id: 'step_3',
        name: 'Preserve Evidence',
        description: 'Capture logs and forensic data',
        type: 'automated',
        action: 'preserve_evidence',
        automated: true,
        parameters: {},
        config: {},
        order: 3,
        timeout: 600,
      },
      {
        id: 'step_4',
        name: 'Notify Legal/Compliance',
        description: 'Alert legal and compliance teams',
        type: 'automated',
        action: 'notify_legal',
        automated: true,
        parameters: {},
        config: {},
        order: 4,
        timeout: 60,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    executionCount: 0,
  },
  {
    id: 'playbook_unauthorized_access',
    name: 'Unauthorized Access Response',
    description: 'Respond to unauthorized system access',
    enabled: true,
    triggerConditions: [
      { field: 'threatType', operator: 'eq', value: 'unauthorized_access' },
    ],
    steps: [
      {
        id: 'step_1',
        name: 'Revoke Access',
        description: 'Immediately revoke suspicious credentials',
        type: 'automated',
        action: 'revoke_credentials',
        automated: true,
        parameters: {},
        config: {},
        order: 1,
        timeout: 30,
      },
      {
        id: 'step_2',
        name: 'Session Termination',
        description: 'Kill all active sessions for user',
        type: 'automated',
        action: 'terminate_sessions',
        automated: true,
        parameters: {},
        config: {},
        order: 2,
        timeout: 30,
      },
      {
        id: 'step_3',
        name: 'Audit Access History',
        description: 'Review all actions taken by the account',
        type: 'automated',
        action: 'audit_access',
        automated: true,
        parameters: { lookback: '7d' },
        config: { lookback: '7d' },
        order: 3,
        timeout: 300,
      },
      {
        id: 'step_4',
        name: 'User Verification',
        description: 'Verify legitimate user identity',
        type: 'manual',
        action: 'verify_user',
        automated: false,
        parameters: {},
        config: {},
        order: 4,
        timeout: 7200,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    executionCount: 0,
  },
  {
    id: 'playbook_ddos',
    name: 'DDoS Mitigation',
    description: 'Respond to denial of service attacks',
    enabled: true,
    triggerConditions: [
      { field: 'threatType', operator: 'eq', value: 'ddos' },
    ],
    steps: [
      {
        id: 'step_1',
        name: 'Enable DDoS Protection',
        description: 'Activate upstream DDoS mitigation',
        type: 'automated',
        action: 'enable_ddos_protection',
        automated: true,
        parameters: { provider: 'cloudflare' },
        config: { provider: 'cloudflare' },
        order: 1,
        timeout: 60,
      },
      {
        id: 'step_2',
        name: 'Rate Limiting',
        description: 'Apply aggressive rate limits',
        type: 'automated',
        action: 'apply_rate_limits',
        automated: true,
        parameters: { threshold: 100, window: '1m' },
        config: { threshold: 100, window: '1m' },
        order: 2,
        timeout: 30,
      },
      {
        id: 'step_3',
        name: 'Traffic Analysis',
        description: 'Analyze attack patterns',
        type: 'manual',
        action: 'analyze_traffic',
        automated: false,
        parameters: {},
        config: {},
        order: 3,
        timeout: 1800,
      },
      {
        id: 'step_4',
        name: 'Scale Resources',
        description: 'Auto-scale infrastructure if needed',
        type: 'automated',
        action: 'auto_scale',
        automated: true,
        parameters: { multiplier: 2 },
        config: { multiplier: 2 },
        order: 4,
        timeout: 300,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
    executionCount: 0,
  },
];

// ============================================================
// INCIDENT MANAGER CLASS
// ============================================================

class IncidentManager {
  private incidents: Map<string, Incident> = new Map();
  private playbooks: Map<string, Playbook> = new Map();

  constructor() {
    // Initialize default playbooks
    DEFAULT_PLAYBOOKS.forEach(playbook => {
      this.playbooks.set(playbook.id, playbook);
    });
  }

  // ============================================================
  // INCIDENT MANAGEMENT
  // ============================================================

  async createIncident(data: {
    title: string;
    description: string;
    severity: ThreatSeverity;
    priority?: IncidentPriority;
    threats?: string[];
    affectedAssets?: string[];
  }): Promise<Incident> {
    const id = `INC-${Date.now()}-${crypto.randomUUID().split('-')[0]}`;
    
    const incident: Incident = {
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      title: data.title,
      description: data.description,
      status: 'open',
      priority: data.priority || this.severityToPriority(data.severity),
      severity: data.severity,
      threats: data.threats || [],
      affectedAssets: data.affectedAssets || [],
      iocs: [],
      timeline: [{
        timestamp: new Date(),
        type: 'created',
        actor: 'system',
        description: 'Incident created',
        action: 'create',
        details: `Incident "${data.title}" was created`,
      }],
    };

    this.incidents.set(id, incident);
    
    // Check for matching playbook
    await this.checkPlaybookTriggers(incident);
    
    return incident;
  }

  async createFromThreat(threat: Threat): Promise<Incident> {
    return this.createIncident({
      title: `Incident: ${threat.title}`,
      description: threat.description,
      severity: threat.severity,
      threats: [threat.id],
      affectedAssets: threat.affectedAssets,
    });
  }

  private severityToPriority(severity: ThreatSeverity): IncidentPriority {
    const mapping: Record<ThreatSeverity, IncidentPriority> = {
      critical: 'p1',
      high: 'p2',
      medium: 'p3',
      low: 'p4',
      info: 'p4',
    };
    return mapping[severity];
  }

  async getIncident(id: string): Promise<Incident | null> {
    return this.incidents.get(id) || null;
  }

  async getIncidents(filters?: {
    status?: IncidentStatus;
    priority?: IncidentPriority;
    severity?: ThreatSeverity;
  }): Promise<Incident[]> {
    let incidents = Array.from(this.incidents.values());
    
    if (filters?.status) {
      incidents = incidents.filter(i => i.status === filters.status);
    }
    if (filters?.priority) {
      incidents = incidents.filter(i => i.priority === filters.priority);
    }
    if (filters?.severity) {
      incidents = incidents.filter(i => i.severity === filters.severity);
    }
    
    return incidents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateIncidentStatus(
    id: string,
    status: IncidentStatus,
    actor: string = 'system'
  ): Promise<Incident | null> {
    const incident = this.incidents.get(id);
    if (!incident) return null;

    const oldStatus = incident.status;
    incident.status = status;
    incident.updatedAt = new Date();

    if (status === 'resolved') {
      incident.resolvedAt = new Date();
      if (incident.createdAt) {
        incident.timeToResolve = Math.floor(
          (incident.resolvedAt.getTime() - incident.createdAt.getTime()) / 1000
        );
      }
    } else if (status === 'closed') {
      incident.closedAt = new Date();
    }

    this.addTimelineEntry(incident, {
      type: 'status_change',
      actor,
      description: `Status changed from ${oldStatus} to ${status}`,
      action: 'status_change',
      details: `Previous: ${oldStatus}, New: ${status}`,
    });

    return incident;
  }

  async assignIncident(
    id: string,
    assignee: string,
    actor: string = 'system'
  ): Promise<Incident | null> {
    const incident = this.incidents.get(id);
    if (!incident) return null;

    incident.assignedTo = assignee;
    incident.updatedAt = new Date();

    this.addTimelineEntry(incident, {
      type: 'updated',
      actor,
      description: `Incident assigned to ${assignee}`,
      action: 'assign',
      details: `Assigned to: ${assignee}`,
    });

    return incident;
  }

  async addRelatedThreats(
    id: string,
    threatIds: string[],
    actor: string = 'system'
  ): Promise<Incident | null> {
    const incident = this.incidents.get(id);
    if (!incident) return null;

    const newThreats = threatIds.filter(t => !incident.threats.includes(t));
    incident.threats = [...incident.threats, ...newThreats];
    incident.updatedAt = new Date();

    this.addTimelineEntry(incident, {
      type: 'evidence',
      actor,
      description: `Added ${newThreats.length} related threats`,
      action: 'add_threats',
      details: `Threat IDs: ${newThreats.join(', ')}`,
    });

    return incident;
  }

  async attachPlaybook(
    id: string,
    playbookId: string,
    actor: string = 'system'
  ): Promise<Incident | null> {
    const incident = this.incidents.get(id);
    if (!incident) return null;

    const playbook = this.playbooks.get(playbookId);
    if (!playbook) return null;

    incident.playbook = playbookId;
    incident.updatedAt = new Date();

    this.addTimelineEntry(incident, {
      type: 'action',
      actor,
      description: `Attached playbook: ${playbook.name}`,
      action: 'attach_playbook',
      details: `Playbook ID: ${playbookId}`,
    });

    return incident;
  }

  private addTimelineEntry(
    incident: Incident,
    entry: Omit<IncidentTimelineEntry, 'timestamp'>
  ): void {
    incident.timeline.push({
      ...entry,
      timestamp: new Date(),
    });
  }

  // ============================================================
  // PLAYBOOK MANAGEMENT
  // ============================================================

  async getPlaybooks(): Promise<Playbook[]> {
    return Array.from(this.playbooks.values());
  }

  async getPlaybook(id: string): Promise<Playbook | null> {
    return this.playbooks.get(id) || null;
  }

  async createPlaybook(playbook: Omit<Playbook, 'id' | 'createdAt' | 'updatedAt' | 'executionCount'>): Promise<Playbook> {
    const newPlaybook: Playbook = {
      ...playbook,
      id: `playbook_${crypto.randomUUID().split('-')[0]}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      executionCount: 0,
    };
    
    this.playbooks.set(newPlaybook.id, newPlaybook);
    return newPlaybook;
  }

  private async checkPlaybookTriggers(incident: Incident): Promise<void> {
    for (const [, playbook] of this.playbooks) {
      if (!playbook.enabled) continue;
      
      const matches = playbook.triggerConditions.every((trigger: PlaybookTrigger) => {
        const incidentData = incident as unknown as Record<string, unknown>;
        const value = incidentData[trigger.field];
        
        switch (trigger.operator) {
          case 'eq':
            return String(value) === trigger.value;
          case 'contains':
            return String(value).includes(trigger.value);
          default:
            return false;
        }
      });

      if (matches) {
        await this.attachPlaybook(incident.id, playbook.id, 'auto-trigger');
        break;
      }
    }
  }

  async executePlaybook(
    incidentId: string,
    playbookId: string,
    actor: string = 'system'
  ): Promise<{ success: boolean; results: { stepId: string; success: boolean; message: string }[] }> {
    const incident = this.incidents.get(incidentId);
    const playbook = this.playbooks.get(playbookId);
    
    if (!incident || !playbook) {
      return { success: false, results: [] };
    }

    const results: { stepId: string; success: boolean; message: string }[] = [];

    this.addTimelineEntry(incident, {
      type: 'action',
      actor,
      description: `Started playbook execution: ${playbook.name}`,
      action: 'playbook_start',
      details: `Playbook: ${playbook.name}`,
    });

    for (const step of playbook.steps.sort((a: PlaybookStep, b: PlaybookStep) => a.order - b.order)) {
      try {
        // Simulate step execution
        const stepResult = await this.executePlaybookStep(step, incident);
        results.push({
          stepId: step.id,
          success: stepResult.success,
          message: stepResult.message,
        });

        this.addTimelineEntry(incident, {
          type: 'action',
          actor: 'playbook',
          description: `Step "${step.name}": ${stepResult.success ? 'completed' : 'failed'}`,
          action: step.action,
          details: stepResult.message,
        });
      } catch (error) {
        results.push({
          stepId: step.id,
          success: false,
          message: String(error),
        });

        this.addTimelineEntry(incident, {
          type: 'action',
          actor: 'playbook',
          description: `Step "${step.name}" failed with error`,
          action: step.action,
          details: String(error),
        });
      }
    }

    playbook.executionCount++;
    
    const allSuccessful = results.every(r => r.success);

    this.addTimelineEntry(incident, {
      type: 'action',
      actor,
      description: `Playbook execution ${allSuccessful ? 'completed' : 'completed with errors'}`,
      action: 'playbook_complete',
      details: `${results.filter(r => r.success).length}/${results.length} steps successful`,
    });

    return { success: allSuccessful, results };
  }

  private async executePlaybookStep(
    step: PlaybookStep,
    _incident: Incident
  ): Promise<{ success: boolean; message: string }> {
    // Simulate step execution based on action type
    // In production, this would integrate with actual systems
    
    if (step.automated) {
      // Simulate automated action
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return {
        success: true,
        message: `Automated action "${step.action}" executed successfully`,
      };
    } else {
      // Manual steps are marked as pending
      return {
        success: true,
        message: `Manual step "${step.name}" queued for review`,
      };
    }
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  getStats(): Record<IncidentStatus, number> {
    const stats: Record<IncidentStatus, number> = {
      open: 0,
      in_progress: 0,
      pending: 0,
      resolved: 0,
      closed: 0,
    };

    for (const incident of this.incidents.values()) {
      stats[incident.status]++;
    }

    return stats;
  }

  async addComment(
    id: string,
    comment: string,
    actor: string
  ): Promise<Incident | null> {
    const incident = this.incidents.get(id);
    if (!incident) return null;

    this.addTimelineEntry(incident, {
      type: 'comment',
      actor,
      description: comment,
      action: 'comment',
      details: comment,
    });

    incident.updatedAt = new Date();
    return incident;
  }

  async resolveIncident(
    id: string,
    resolution: string,
    rootCause: string,
    actor: string = 'system'
  ): Promise<Incident | null> {
    const incident = this.incidents.get(id);
    if (!incident) return null;

    incident.status = 'resolved';
    incident.resolution = resolution;
    incident.rootCause = rootCause;
    incident.resolvedAt = new Date();
    incident.updatedAt = new Date();

    if (incident.createdAt) {
      incident.timeToResolve = Math.floor(
        (incident.resolvedAt.getTime() - incident.createdAt.getTime()) / 1000
      );
    }

    this.addTimelineEntry(incident, {
      type: 'status_change',
      actor,
      description: `Incident resolved: ${resolution}`,
      action: 'resolve',
      details: `Root cause: ${rootCause}`,
    });

    return incident;
  }
}

// Export singleton instance
export const incidentManager = new IncidentManager();
