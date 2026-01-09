/**
 * SIEM AI-Powered Investigation Assistant
 * Intelligent log analysis and investigation workflow
 */

import { randomUUID } from 'crypto';
import { ThreatSeverity } from './types.js';

// ============================================================
// TYPES
// ============================================================

export interface InvestigationQuery {
  id: string;
  query: string;
  type: 'threat' | 'anomaly' | 'timeline' | 'entity' | 'general';
  timestamp: Date;
}

export interface InvestigationFinding {
  id: string;
  type: 'threat' | 'anomaly' | 'suspicious' | 'info';
  title: string;
  description: string;
  severity: ThreatSeverity;
  evidence: string[];
  recommendations: string[];
  timestamp: Date;
}

export interface Investigation {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  queries: InvestigationQuery[];
  findings: InvestigationFinding[];
  relatedLogs: string[];
  summary?: string;
}

export interface AIAnalysisResult {
  summary: string;
  threatLevel: ThreatSeverity;
  indicators: string[];
  attackVector?: string;
  recommendations: string[];
  mitreAttackIds?: string[];
  confidence: number;
}

// ============================================================
// INVESTIGATION ASSISTANT CLASS
// ============================================================

class AIInvestigationAssistant {
  private investigations: Map<string, Investigation> = new Map();

  // Create new investigation
  createInvestigation(params: {
    title: string;
    description: string;
    createdBy: string;
  }): Investigation {
    const investigation: Investigation = {
      id: `INV-${Date.now()}-${randomUUID().substring(0, 8)}`,
      title: params.title,
      description: params.description,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: params.createdBy,
      queries: [],
      findings: [],
      relatedLogs: [],
    };

    this.investigations.set(investigation.id, investigation);
    return investigation;
  }

  // Get investigation by ID
  getInvestigation(id: string): Investigation | undefined {
    return this.investigations.get(id);
  }

  // Get all investigations
  getInvestigations(): Investigation[] {
    return Array.from(this.investigations.values());
  }

  // Add query to investigation
  addQuery(investigationId: string, query: string, type: InvestigationQuery['type']): Investigation | null {
    const investigation = this.investigations.get(investigationId);
    if (!investigation) return null;

    investigation.queries.push({
      id: randomUUID(),
      query,
      type,
      timestamp: new Date(),
    });

    investigation.updatedAt = new Date();
    return investigation;
  }

  // Add finding to investigation
  addFinding(investigationId: string, finding: Omit<InvestigationFinding, 'id' | 'timestamp'>): Investigation | null {
    const investigation = this.investigations.get(investigationId);
    if (!investigation) return null;

    investigation.findings.push({
      ...finding,
      id: randomUUID(),
      timestamp: new Date(),
    });

    investigation.updatedAt = new Date();
    return investigation;
  }

  // AI-powered log analysis
  async analyzeLogsWithAI(logs: Array<{
    id: string;
    timestamp: Date;
    level: string;
    message: string;
    service: string;
    sourceIp?: string;
    userId?: string;
    [key: string]: unknown;
  }>): Promise<AIAnalysisResult> {
    // Pattern detection
    const patterns = this.detectPatterns(logs);
    
    // Threat indicators extraction
    const indicators = this.extractIndicators(logs);
    
    // Attack vector identification
    const attackVector = this.identifyAttackVector(patterns);
    
    // MITRE ATT&CK mapping
    const mitreIds = this.mapToMitre(patterns, attackVector);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(patterns, attackVector);
    
    // Calculate confidence and severity
    const { confidence, severity } = this.assessThreat(patterns, indicators);

    return {
      summary: this.generateSummary(patterns, indicators, attackVector),
      threatLevel: severity,
      indicators,
      attackVector,
      recommendations,
      mitreAttackIds: mitreIds,
      confidence,
    };
  }

  // Analyze specific entity (IP, user, host)
  async analyzeEntity(entity: {
    type: 'ip' | 'user' | 'host';
    value: string;
    logs: Array<{ id: string; timestamp: Date; message: string; level: string; [key: string]: unknown }>;
  }): Promise<{
    riskScore: number;
    behaviors: string[];
    timeline: { timestamp: Date; action: string }[];
    recommendations: string[];
  }> {
    const behaviors: string[] = [];
    const timeline: { timestamp: Date; action: string }[] = [];
    let riskScore = 0;

    for (const log of entity.logs) {
      const action = this.extractAction(log.message);
      timeline.push({ timestamp: log.timestamp, action });

      // Analyze behavior patterns
      if (this.isSuspiciousBehavior(log.message)) {
        behaviors.push(`Suspicious activity: ${action}`);
        riskScore += 15;
      }

      if (log.level === 'error' || log.level === 'warn') {
        riskScore += 5;
      }
    }

    // Check for anomalous patterns
    const anomalies = this.detectAnomalies(entity.logs);
    for (const anomaly of anomalies) {
      behaviors.push(anomaly);
      riskScore += 20;
    }

    const recommendations = this.generateEntityRecommendations(
      entity.type,
      riskScore,
      behaviors
    );

    return {
      riskScore: Math.min(100, riskScore),
      behaviors,
      timeline: timeline.slice(-20), // Last 20 events
      recommendations,
    };
  }

  // Generate natural language timeline
  generateTimelineNarrative(events: Array<{
    timestamp: Date;
    action: string;
    actor?: string;
    target?: string;
  }>): string {
    if (events.length === 0) return 'No events to analyze.';

    const sortedEvents = [...events].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    const narrativeParts: string[] = [];
    
    narrativeParts.push(`Timeline begins at ${sortedEvents[0].timestamp.toISOString()}.`);

    for (let i = 0; i < Math.min(sortedEvents.length, 10); i++) {
      const event = sortedEvents[i];
      const actor = event.actor || 'Unknown actor';
      const target = event.target ? ` targeting ${event.target}` : '';
      narrativeParts.push(
        `[${event.timestamp.toISOString()}] ${actor} performed ${event.action}${target}.`
      );
    }

    if (sortedEvents.length > 10) {
      narrativeParts.push(`... and ${sortedEvents.length - 10} more events.`);
    }

    return narrativeParts.join('\n');
  }

  // Ask investigation question (simulated AI response)
  async askQuestion(question: string, context: {
    logs?: Array<{ message: string; level: string; timestamp: Date }>;
    investigationId?: string;
  }): Promise<{
    answer: string;
    confidence: number;
    relatedFindings: string[];
    suggestedQueries: string[];
  }> {
    const questionLower = question.toLowerCase();
    const relatedFindings: string[] = [];
    const suggestedQueries: string[] = [];
    let answer = '';
    let confidence = 0.7;

    // Pattern-based question answering
    if (questionLower.includes('attack') || questionLower.includes('threat')) {
      answer = this.generateThreatAnswer(context.logs || []);
      suggestedQueries.push(
        'What IPs are associated with this attack?',
        'What is the attack timeline?',
        'What systems were affected?'
      );
    } else if (questionLower.includes('user') || questionLower.includes('account')) {
      answer = this.generateUserActivityAnswer(context.logs || []);
      suggestedQueries.push(
        'What actions did this user perform?',
        'Were there any failed login attempts?',
        'What resources did they access?'
      );
    } else if (questionLower.includes('ip') || questionLower.includes('source')) {
      answer = this.generateIPAnswer(context.logs || []);
      suggestedQueries.push(
        'Is this IP in any blocklist?',
        'What requests came from this IP?',
        'Is this IP geolocation suspicious?'
      );
    } else if (questionLower.includes('recommend') || questionLower.includes('what should')) {
      answer = this.generateRecommendationAnswer(context.logs || []);
      confidence = 0.85;
    } else {
      answer = this.generateGenericAnswer(question, context.logs || []);
      confidence = 0.6;
    }

    // Add related findings from investigation
    if (context.investigationId) {
      const investigation = this.investigations.get(context.investigationId);
      if (investigation) {
        for (const finding of investigation.findings.slice(-3)) {
          relatedFindings.push(finding.title);
        }
      }
    }

    return {
      answer,
      confidence,
      relatedFindings,
      suggestedQueries,
    };
  }

  // Complete investigation
  completeInvestigation(investigationId: string, summary: string): Investigation | null {
    const investigation = this.investigations.get(investigationId);
    if (!investigation) return null;

    investigation.status = 'completed';
    investigation.summary = summary;
    investigation.updatedAt = new Date();

    return investigation;
  }

  // ============================================================
  // PRIVATE HELPER METHODS
  // ============================================================

  private detectPatterns(logs: Array<{ message: string; level: string; [key: string]: unknown }>): string[] {
    const patterns: string[] = [];
    const errorCount = logs.filter(l => l.level === 'error').length;
    const warnCount = logs.filter(l => l.level === 'warn').length;

    if (errorCount > logs.length * 0.3) {
      patterns.push('high_error_rate');
    }
    if (warnCount > logs.length * 0.5) {
      patterns.push('elevated_warnings');
    }

    // Check for brute force
    const loginFailures = logs.filter(l => 
      l.message.toLowerCase().includes('failed') && 
      l.message.toLowerCase().includes('login')
    );
    if (loginFailures.length >= 5) {
      patterns.push('brute_force_attempt');
    }

    // Check for scanning
    const scanIndicators = logs.filter(l =>
      /scan|probe|enum/i.test(l.message)
    );
    if (scanIndicators.length >= 3) {
      patterns.push('reconnaissance_activity');
    }

    // Check for privilege escalation
    const privEsc = logs.filter(l =>
      /sudo|admin|root|privilege|escalat/i.test(l.message)
    );
    if (privEsc.length >= 2) {
      patterns.push('privilege_escalation_attempt');
    }

    return patterns;
  }

  private extractIndicators(logs: Array<{ message: string; sourceIp?: string; [key: string]: unknown }>): string[] {
    const indicators: string[] = [];
    const ips = new Set<string>();
    const suspiciousStrings = new Set<string>();

    for (const log of logs) {
      if (log.sourceIp) {
        ips.add(log.sourceIp);
      }

      // Extract IPs from message
      const ipMatches = log.message.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g);
      if (ipMatches) {
        ipMatches.forEach(ip => ips.add(ip));
      }

      // Extract suspicious strings
      const suspicious = log.message.match(/(?:eval|exec|system|cmd|shell|base64|\\x[0-9a-f]{2})/gi);
      if (suspicious) {
        suspicious.forEach(s => suspiciousStrings.add(s.toLowerCase()));
      }
    }

    indicators.push(...Array.from(ips).map(ip => `IP: ${ip}`));
    indicators.push(...Array.from(suspiciousStrings).map(s => `Suspicious string: ${s}`));

    return indicators;
  }

  private identifyAttackVector(patterns: string[]): string | undefined {
    if (patterns.includes('brute_force_attempt')) {
      return 'Credential Stuffing / Brute Force';
    }
    if (patterns.includes('reconnaissance_activity')) {
      return 'Active Reconnaissance';
    }
    if (patterns.includes('privilege_escalation_attempt')) {
      return 'Privilege Escalation';
    }
    return undefined;
  }

  private mapToMitre(patterns: string[], attackVector?: string): string[] {
    const mitreIds: string[] = [];

    if (patterns.includes('brute_force_attempt')) {
      mitreIds.push('T1110'); // Brute Force
    }
    if (patterns.includes('reconnaissance_activity')) {
      mitreIds.push('T1595'); // Active Scanning
    }
    if (patterns.includes('privilege_escalation_attempt')) {
      mitreIds.push('T1068'); // Exploitation for Privilege Escalation
    }
    if (attackVector?.includes('Credential')) {
      mitreIds.push('T1078'); // Valid Accounts
    }

    return mitreIds;
  }

  private generateRecommendations(patterns: string[], attackVector?: string): string[] {
    const recommendations: string[] = [];

    if (patterns.includes('brute_force_attempt')) {
      recommendations.push('Implement account lockout policy');
      recommendations.push('Enable multi-factor authentication');
      recommendations.push('Review and block suspicious source IPs');
    }
    if (patterns.includes('reconnaissance_activity')) {
      recommendations.push('Review firewall rules for exposed ports');
      recommendations.push('Implement intrusion detection rules');
      recommendations.push('Consider honeypot deployment');
    }
    if (patterns.includes('privilege_escalation_attempt')) {
      recommendations.push('Audit sudo/admin access permissions');
      recommendations.push('Review user privilege assignments');
      recommendations.push('Enable enhanced logging for sensitive operations');
    }
    if (patterns.includes('high_error_rate')) {
      recommendations.push('Investigate application errors for potential exploitation');
    }

    if (recommendations.length === 0) {
      recommendations.push('Continue monitoring for suspicious activity');
      recommendations.push('Ensure logging coverage is comprehensive');
    }

    return recommendations;
  }

  private assessThreat(patterns: string[], indicators: string[]): {
    confidence: number;
    severity: ThreatSeverity;
  } {
    let score = 0;

    score += patterns.length * 15;
    score += indicators.filter(i => i.startsWith('Suspicious')).length * 10;

    if (patterns.includes('privilege_escalation_attempt')) score += 30;
    if (patterns.includes('brute_force_attempt')) score += 20;

    let severity: ThreatSeverity = 'info';
    if (score >= 70) severity = 'critical';
    else if (score >= 50) severity = 'high';
    else if (score >= 30) severity = 'medium';
    else if (score >= 10) severity = 'low';

    return {
      confidence: Math.min(0.95, 0.5 + score / 200),
      severity,
    };
  }

  private generateSummary(patterns: string[], indicators: string[], attackVector?: string): string {
    const parts: string[] = [];

    if (patterns.length === 0) {
      return 'Analysis complete. No significant threat patterns detected. Normal operational activity observed.';
    }

    parts.push(`Analysis identified ${patterns.length} notable pattern(s).`);

    if (attackVector) {
      parts.push(`Primary attack vector: ${attackVector}.`);
    }

    if (indicators.length > 0) {
      parts.push(`Found ${indicators.length} indicator(s) of compromise.`);
    }

    parts.push('Recommend reviewing the detailed findings and implementing suggested mitigations.');

    return parts.join(' ');
  }

  private extractAction(message: string): string {
    const actionWords = ['login', 'logout', 'access', 'modify', 'delete', 'create', 'download', 'upload', 'execute'];
    for (const word of actionWords) {
      if (message.toLowerCase().includes(word)) {
        return word;
      }
    }
    return 'activity';
  }

  private isSuspiciousBehavior(message: string): boolean {
    const suspicious = /failed|denied|blocked|attack|malicious|suspicious|unauthorized/i;
    return suspicious.test(message);
  }

  private detectAnomalies(logs: Array<{ timestamp: Date; message: string; [key: string]: unknown }>): string[] {
    const anomalies: string[] = [];

    // Check for unusual timing
    const hours = logs.map(l => l.timestamp.getHours());
    const nightActivity = hours.filter(h => h >= 0 && h < 6).length;
    if (nightActivity > logs.length * 0.3) {
      anomalies.push('High activity during off-hours (midnight to 6 AM)');
    }

    // Check for burst activity
    if (logs.length > 50) {
      const timespan = logs[logs.length - 1].timestamp.getTime() - logs[0].timestamp.getTime();
      if (timespan < 60000) { // Less than 1 minute
        anomalies.push('Burst of activity detected (50+ events in under 1 minute)');
      }
    }

    return anomalies;
  }

  private generateEntityRecommendations(
    type: 'ip' | 'user' | 'host',
    riskScore: number,
    behaviors: string[]
  ): string[] {
    const recommendations: string[] = [];

    if (riskScore >= 70) {
      if (type === 'ip') {
        recommendations.push('Consider blocking this IP address');
        recommendations.push('Add to watchlist for continued monitoring');
      } else if (type === 'user') {
        recommendations.push('Consider temporary account suspension');
        recommendations.push('Force password reset');
        recommendations.push('Review all recent activities');
      } else {
        recommendations.push('Isolate host for investigation');
        recommendations.push('Run full security scan');
      }
    } else if (riskScore >= 40) {
      recommendations.push('Increase monitoring for this entity');
      recommendations.push('Review recent access patterns');
    } else {
      recommendations.push('No immediate action required');
      recommendations.push('Continue standard monitoring');
    }

    return recommendations;
  }

  private generateThreatAnswer(logs: Array<{ message: string; level: string; timestamp: Date }>): string {
    const errorLogs = logs.filter(l => l.level === 'error');
    const threatIndicators = logs.filter(l => 
      /attack|malicious|threat|exploit|injection/i.test(l.message)
    );

    if (threatIndicators.length > 0) {
      return `Detected ${threatIndicators.length} potential threat indicator(s) in the logs. ` +
        `Key patterns include: ${threatIndicators.slice(0, 3).map(l => l.message.substring(0, 50)).join('; ')}. ` +
        `Recommend immediate investigation and containment measures.`;
    }

    if (errorLogs.length > 0) {
      return `No direct threat indicators found, but ${errorLogs.length} error(s) detected that may warrant investigation.`;
    }

    return 'No clear threat indicators detected in the provided logs. Continue monitoring.';
  }

  private generateUserActivityAnswer(logs: Array<{ message: string; level: string; timestamp: Date }>): string {
    const loginEvents = logs.filter(l => /login|auth|session/i.test(l.message));
    const accessEvents = logs.filter(l => /access|request|view/i.test(l.message));

    return `User activity summary: ${loginEvents.length} authentication event(s), ` +
      `${accessEvents.length} resource access event(s). ` +
      `Review the timeline for detailed activity patterns.`;
  }

  private generateIPAnswer(logs: Array<{ message: string; level: string; timestamp: Date }>): string {
    const uniqueMessages = [...new Set(logs.map(l => l.message))];
    return `IP activity includes ${logs.length} event(s) with ${uniqueMessages.length} unique action type(s). ` +
      `Check geographic location and reputation databases for threat intelligence.`;
  }

  private generateRecommendationAnswer(logs: Array<{ message: string; level: string; timestamp: Date }>): string {
    const hasErrors = logs.some(l => l.level === 'error');
    const hasWarnings = logs.some(l => l.level === 'warn');

    const recommendations = ['Ensure comprehensive logging is enabled'];

    if (hasErrors) {
      recommendations.push('Investigate and resolve error conditions');
    }
    if (hasWarnings) {
      recommendations.push('Review and address warning indicators');
    }

    recommendations.push('Maintain regular security monitoring');
    recommendations.push('Keep security tools and signatures updated');

    return `Recommendations based on analysis:\n${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
  }

  private generateGenericAnswer(question: string, logs: Array<{ message: string; level: string; timestamp: Date }>): string {
    return `Based on ${logs.length} log entries analyzed: The data shows mixed activity patterns. ` +
      `For more specific insights, try asking about threats, users, IPs, or request specific recommendations. ` +
      `You can also ask about timeline analysis or entity behavior.`;
  }
}

// Export singleton
export const investigationAssistant = new AIInvestigationAssistant();
export { AIInvestigationAssistant };
