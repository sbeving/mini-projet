/**
 * SIEM Threat Detection Engine
 * AI-powered threat detection with anomaly detection, pattern matching, and correlation
 */

import { prisma } from '../../index.js';
import { aiManager } from '../ai/index.js';
import {
  Threat,
  ThreatSeverity,
  AlertType,
  AIThreatAnalysis,
  AnomalyDetection,
  AnomalyBaseline,
  IOC,
  MitreAttackTechnique,
} from './types.js';

// ============================================================
// THREAT PATTERNS DATABASE (In-memory for now)
// ============================================================

const THREAT_PATTERNS = {
  bruteForce: {
    name: 'Brute Force Attack',
    description: 'Multiple failed login attempts from same source',
    severity: 'high' as ThreatSeverity,
    mitre: [{ id: 'T1110', name: 'Brute Force', tactic: 'credential_access' as const }],
    indicators: ['failed login', 'authentication failure', 'invalid password', 'access denied'],
    threshold: { count: 5, timeWindow: 300 }, // 5 failures in 5 minutes
  },
  privilegeEscalation: {
    name: 'Privilege Escalation Attempt',
    description: 'Unauthorized attempt to gain elevated privileges',
    severity: 'critical' as ThreatSeverity,
    mitre: [{ id: 'T1068', name: 'Exploitation for Privilege Escalation', tactic: 'privilege_escalation' as const }],
    indicators: ['sudo', 'root', 'admin', 'privilege', 'escalation', 'setuid'],
  },
  dataExfiltration: {
    name: 'Potential Data Exfiltration',
    description: 'Unusual data transfer patterns detected',
    severity: 'critical' as ThreatSeverity,
    mitre: [{ id: 'T1041', name: 'Exfiltration Over C2 Channel', tactic: 'exfiltration' as const }],
    indicators: ['upload', 'transfer', 'export', 'copy', 'large file', 'external'],
  },
  malwareActivity: {
    name: 'Malware Indicator Detected',
    description: 'Known malware signatures or behaviors detected',
    severity: 'critical' as ThreatSeverity,
    mitre: [{ id: 'T1059', name: 'Command and Scripting Interpreter', tactic: 'execution' as const }],
    indicators: ['malware', 'virus', 'trojan', 'ransomware', 'cryptominer', 'backdoor', 'c2', 'beacon'],
  },
  suspiciousCommand: {
    name: 'Suspicious Command Execution',
    description: 'Potentially malicious command detected',
    severity: 'high' as ThreatSeverity,
    mitre: [{ id: 'T1059.004', name: 'Unix Shell', tactic: 'execution' as const }],
    indicators: ['wget', 'curl.*sh', 'base64', 'eval', 'nc -e', 'bash -i', 'python -c', 'powershell -enc'],
  },
  lateralMovement: {
    name: 'Lateral Movement Detected',
    description: 'Attempt to move across network systems',
    severity: 'high' as ThreatSeverity,
    mitre: [{ id: 'T1021', name: 'Remote Services', tactic: 'lateral_movement' as const }],
    indicators: ['ssh', 'rdp', 'psexec', 'wmi', 'smb', 'winrm', 'remote'],
  },
  reconnaissance: {
    name: 'Reconnaissance Activity',
    description: 'Network or system scanning detected',
    severity: 'medium' as ThreatSeverity,
    mitre: [{ id: 'T1046', name: 'Network Service Discovery', tactic: 'discovery' as const }],
    indicators: ['nmap', 'scan', 'enum', 'discovery', 'fingerprint', 'probe'],
  },
  persistence: {
    name: 'Persistence Mechanism',
    description: 'Attempt to establish persistence',
    severity: 'high' as ThreatSeverity,
    mitre: [{ id: 'T1053', name: 'Scheduled Task/Job', tactic: 'persistence' as const }],
    indicators: ['crontab', 'scheduled task', 'startup', 'autorun', 'service install', 'systemd'],
  },
};

// Known malicious IPs (sample - in production, use threat intel feeds)
const KNOWN_MALICIOUS_IPS = new Set([
  '45.33.32.156', // Example
  '185.220.101.1',
  '193.142.146.35',
]);

// ============================================================
// THREAT DETECTION ENGINE CLASS
// ============================================================

class ThreatDetectionEngine {
  private baselines: Map<string, AnomalyBaseline> = new Map();
  private recentEvents: Map<string, { timestamp: Date; data: Record<string, unknown> }[]> = new Map();
  private detectedThreats: Map<string, Threat> = new Map();

  constructor() {
    // Initialize baselines
    this.initializeBaselines();
  }

  private async initializeBaselines(): Promise<void> {
    // Load historical data to establish baselines
    try {
      const hourlyLogCounts = await prisma.$queryRaw<{ hour: number; count: bigint }[]>`
        SELECT EXTRACT(HOUR FROM timestamp) as hour, COUNT(*) as count
        FROM logs
        WHERE timestamp > NOW() - INTERVAL '7 days'
        GROUP BY EXTRACT(HOUR FROM timestamp)
      `;

      if (hourlyLogCounts.length > 0) {
        const counts = hourlyLogCounts.map(h => Number(h.count));
        const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
        const stdDev = Math.sqrt(counts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / counts.length);

        this.baselines.set('hourly_log_volume', {
          id: 'hourly_log_volume',
          metric: 'log_count',
          source: 'all',
          mean,
          stdDev,
          min: Math.min(...counts),
          max: Math.max(...counts),
          p50: this.percentile(counts, 50),
          p95: this.percentile(counts, 95),
          p99: this.percentile(counts, 99),
          sampleCount: counts.length,
          lastUpdated: new Date(),
          timeWindow: '1h',
        });
      }
    } catch (error) {
      console.error('[ThreatEngine] Failed to initialize baselines:', error);
    }
  }

  private percentile(arr: number[], p: number): number {
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  }

  // ============================================================
  // REAL-TIME LOG ANALYSIS
  // ============================================================

  async analyzeLog(log: {
    id: string;
    level: string;
    service: string;
    message: string;
    timestamp: Date;
    meta?: Record<string, unknown>;
  }): Promise<Threat | null> {
    const detectedPatterns: string[] = [];
    let maxSeverity: ThreatSeverity = 'info';
    const mitreMapping: MitreAttackTechnique[] = [];

    // Pattern matching
    for (const [patternKey, pattern] of Object.entries(THREAT_PATTERNS)) {
      for (const indicator of pattern.indicators) {
        const regex = new RegExp(indicator, 'i');
        if (regex.test(log.message)) {
          detectedPatterns.push(patternKey);
          mitreMapping.push(...pattern.mitre);
          if (this.compareSeverity(pattern.severity, maxSeverity) > 0) {
            maxSeverity = pattern.severity;
          }
          break;
        }
      }
    }

    // Check for known malicious IPs
    const ipMatch = log.message.match(/\b(\d{1,3}\.){3}\d{1,3}\b/g);
    if (ipMatch) {
      for (const ip of ipMatch) {
        if (KNOWN_MALICIOUS_IPS.has(ip)) {
          detectedPatterns.push('knownMaliciousIP');
          maxSeverity = 'critical';
        }
      }
    }

    // Check log level for errors/critical
    if (log.level === 'error' || log.level === 'critical') {
      // Track for anomaly detection
      this.trackEvent(log.service, {
        type: 'error',
        timestamp: log.timestamp,
        level: log.level,
      });
    }

    // If patterns detected, create threat
    if (detectedPatterns.length > 0) {
      const threat = await this.createThreat({
        type: 'pattern',
        severity: maxSeverity,
        title: `${THREAT_PATTERNS[detectedPatterns[0] as keyof typeof THREAT_PATTERNS]?.name || 'Suspicious Activity'} Detected`,
        description: `Detected patterns: ${detectedPatterns.join(', ')}`,
        source: log.service,
        rawEvents: [log.id],
        mitreAttack: mitreMapping,
        sourceIp: ipMatch?.[0],
      });

      return threat;
    }

    return null;
  }

  // ============================================================
  // ANOMALY DETECTION
  // ============================================================

  async detectAnomalies(): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];

    // Check log volume anomaly
    const volumeBaseline = this.baselines.get('hourly_log_volume');
    if (volumeBaseline) {
      const recentCount = await prisma.log.count({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
          },
        },
      });

      const deviation = (recentCount - volumeBaseline.mean) / (volumeBaseline.stdDev || 1);

      if (Math.abs(deviation) > 2) {
        const severity: ThreatSeverity = 
          Math.abs(deviation) > 4 ? 'critical' :
          Math.abs(deviation) > 3 ? 'high' :
          'medium';

        anomalies.push({
          id: `anomaly_${Date.now()}`,
          timestamp: new Date(),
          metric: 'log_volume',
          source: 'all',
          expectedValue: volumeBaseline.mean,
          actualValue: recentCount,
          deviation,
          severity,
          description: deviation > 0 
            ? `Unusually high log volume: ${recentCount} logs (${deviation.toFixed(1)} std devs above normal)`
            : `Unusually low log volume: ${recentCount} logs (${Math.abs(deviation).toFixed(1)} std devs below normal)`,
          relatedLogs: [],
        });
      }
    }

    // Check error rate anomaly
    const errorCount = await prisma.log.count({
      where: {
        timestamp: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        level: { in: ['error', 'critical'] },
      },
    });

    const totalCount = await prisma.log.count({
      where: {
        timestamp: { gte: new Date(Date.now() - 60 * 60 * 1000) },
      },
    });

    if (totalCount > 0) {
      const errorRate = errorCount / totalCount;
      if (errorRate > 0.1) { // More than 10% errors
        anomalies.push({
          id: `anomaly_error_${Date.now()}`,
          timestamp: new Date(),
          metric: 'error_rate',
          source: 'all',
          expectedValue: 0.05,
          actualValue: errorRate,
          deviation: (errorRate - 0.05) / 0.02,
          severity: errorRate > 0.3 ? 'critical' : errorRate > 0.2 ? 'high' : 'medium',
          description: `High error rate detected: ${(errorRate * 100).toFixed(1)}% of logs are errors`,
          relatedLogs: [],
        });
      }
    }

    return anomalies;
  }

  // ============================================================
  // AI-POWERED THREAT ANALYSIS
  // ============================================================

  async analyzeWithAI(threat: Threat): Promise<AIThreatAnalysis> {
    const prompt = `You are a cybersecurity analyst. Analyze this security threat and provide assessment:

THREAT DETAILS:
- Title: ${threat.title}
- Type: ${threat.type}
- Severity: ${threat.severity}
- Description: ${threat.description}
- Source: ${threat.source}
${threat.sourceIp ? `- Source IP: ${threat.sourceIp}` : ''}
${threat.mitreAttack?.length ? `- MITRE ATT&CK: ${threat.mitreAttack.map(m => m.id).join(', ')}` : ''}

Provide your analysis in the following JSON format:
{
  "riskScore": <0-100>,
  "confidence": <0-100>,
  "summary": "<brief 2-3 sentence summary>",
  "attackVector": "<identified attack vector>",
  "potentialImpact": "<impact assessment>",
  "recommendedActions": ["<action1>", "<action2>", "<action3>"],
  "falsePositiveLikelihood": <0-100>,
  "contextualFactors": ["<factor1>", "<factor2>"]
}`;

    try {
      const response = await aiManager.chat({
        messages: [
          { role: 'system', content: 'You are an expert cybersecurity threat analyst. Respond only with valid JSON.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
      });

      // Parse JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]) as AIThreatAnalysis;
        return analysis;
      }
    } catch (error) {
      console.error('[ThreatEngine] AI analysis failed:', error);
    }

    // Fallback analysis
    return {
      riskScore: this.calculateRiskScore(threat),
      confidence: 70,
      summary: `${threat.title} detected from ${threat.source}. Immediate investigation recommended.`,
      potentialImpact: 'Potential security breach or system compromise',
      recommendedActions: [
        'Review related logs and events',
        'Check affected systems for signs of compromise',
        'Consider blocking source if malicious',
      ],
      falsePositiveLikelihood: 30,
      contextualFactors: ['Pattern-based detection', `Severity: ${threat.severity}`],
    };
  }

  private calculateRiskScore(threat: Threat): number {
    const severityScores: Record<ThreatSeverity, number> = {
      critical: 90,
      high: 70,
      medium: 50,
      low: 30,
      info: 10,
    };
    
    let score = severityScores[threat.severity];
    
    // Adjust based on factors
    if (threat.mitreAttack?.length) score += 5;
    if (threat.indicators?.length) score += threat.indicators.length * 2;
    
    return Math.min(100, score);
  }

  // ============================================================
  // THREAT MANAGEMENT
  // ============================================================

  private async createThreat(params: {
    type: AlertType;
    severity: ThreatSeverity;
    title: string;
    description: string;
    source: string;
    rawEvents: string[];
    mitreAttack?: MitreAttackTechnique[];
    sourceIp?: string;
    destinationIp?: string;
  }): Promise<Threat> {
    const threat: Threat = {
      id: `threat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      type: params.type,
      severity: params.severity,
      status: 'new',
      title: params.title,
      description: params.description,
      source: params.source,
      sourceIp: params.sourceIp,
      destinationIp: params.destinationIp,
      affectedAssets: [params.source],
      indicators: [],
      mitreAttack: params.mitreAttack,
      rawEvents: params.rawEvents,
    };

    // Get AI analysis
    threat.aiAnalysis = await this.analyzeWithAI(threat);

    // Store threat
    this.detectedThreats.set(threat.id, threat);

    return threat;
  }

  async getThreats(filters?: {
    severity?: ThreatSeverity;
    status?: string;
    type?: AlertType;
    since?: Date;
    limit?: number;
  }): Promise<Threat[]> {
    let threats = Array.from(this.detectedThreats.values());

    if (filters?.severity) {
      threats = threats.filter(t => t.severity === filters.severity);
    }
    if (filters?.status) {
      threats = threats.filter(t => t.status === filters.status);
    }
    if (filters?.type) {
      threats = threats.filter(t => t.type === filters.type);
    }
    if (filters?.since) {
      threats = threats.filter(t => t.createdAt >= filters.since!);
    }

    // Sort by created date descending
    threats.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    if (filters?.limit) {
      threats = threats.slice(0, filters.limit);
    }

    return threats;
  }

  async getThreatById(id: string): Promise<Threat | null> {
    return this.detectedThreats.get(id) || null;
  }

  async updateThreatStatus(id: string, status: string, resolution?: string): Promise<Threat | null> {
    const threat = this.detectedThreats.get(id);
    if (!threat) return null;

    threat.status = status as Threat['status'];
    threat.updatedAt = new Date();
    if (resolution) {
      threat.resolution = resolution;
      threat.resolvedAt = new Date();
    }

    return threat;
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private trackEvent(key: string, event: Record<string, unknown>): void {
    if (!this.recentEvents.has(key)) {
      this.recentEvents.set(key, []);
    }
    const events = this.recentEvents.get(key)!;
    events.push({ timestamp: new Date(), data: event });
    
    // Keep only last 1000 events per key
    if (events.length > 1000) {
      events.shift();
    }
  }

  private compareSeverity(a: ThreatSeverity, b: ThreatSeverity): number {
    const order: Record<ThreatSeverity, number> = {
      critical: 5,
      high: 4,
      medium: 3,
      low: 2,
      info: 1,
    };
    return order[a] - order[b];
  }

  // ============================================================
  // BATCH ANALYSIS
  // ============================================================

  async analyzeRecentLogs(minutes: number = 60): Promise<{
    threatsDetected: number;
    anomalies: AnomalyDetection[];
    summary: string;
  }> {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    
    const logs = await prisma.log.findMany({
      where: { timestamp: { gte: since } },
      orderBy: { timestamp: 'desc' },
      take: 1000,
    });

    let threatsDetected = 0;
    
    for (const log of logs) {
      const threat = await this.analyzeLog({
        id: log.id,
        level: log.level,
        service: log.service,
        message: log.message,
        timestamp: log.timestamp,
        meta: log.meta as Record<string, unknown> | undefined,
      });
      
      if (threat) {
        threatsDetected++;
      }
    }

    const anomalies = await this.detectAnomalies();

    return {
      threatsDetected,
      anomalies,
      summary: `Analyzed ${logs.length} logs from the last ${minutes} minutes. Detected ${threatsDetected} threats and ${anomalies.length} anomalies.`,
    };
  }

  // Get threat statistics
  async getStats(): Promise<{
    total: number;
    bySeverity: Record<ThreatSeverity, number>;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    recentTrend: { date: string; count: number }[];
  }> {
    const threats = Array.from(this.detectedThreats.values());
    
    const bySeverity: Record<ThreatSeverity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byDate: Record<string, number> = {};

    for (const threat of threats) {
      bySeverity[threat.severity]++;
      byStatus[threat.status] = (byStatus[threat.status] || 0) + 1;
      byType[threat.type] = (byType[threat.type] || 0) + 1;
      
      const dateKey = threat.createdAt.toISOString().split('T')[0];
      byDate[dateKey] = (byDate[dateKey] || 0) + 1;
    }

    const recentTrend = Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30)
      .map(([date, count]) => ({ date, count }));

    return {
      total: threats.length,
      bySeverity,
      byStatus,
      byType,
      recentTrend,
    };
  }
}

// Export singleton instance
export const threatEngine = new ThreatDetectionEngine();
