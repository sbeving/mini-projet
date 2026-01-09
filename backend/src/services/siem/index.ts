/**
 * SIEM Orchestrator
 * Unified orchestration layer for all SIEM components
 * 
 * This module provides:
 * - Unified log processing pipeline
 * - Dashboard statistics aggregation
 * - Health monitoring
 * - AI-powered investigation integration
 */

import { threatEngine } from './threat-detection.js';
import { alertRulesEngine } from './alert-rules.js';
import { correlationEngine } from './correlation.js';
import { incidentManager } from './incidents.js';
import { investigationAssistant, Investigation } from './investigation.js';
import {
  SIEMProcessResult,
  SIEMHealthStatus,
  SIEMDashboardStats,
  AlertResult,
  Threat,
  AnomalyDetection,
} from './types.js';

// ============================================================
// SIEM ORCHESTRATOR CLASS
// ============================================================

class SIEMOrchestrator {
  // ============================================================
  // LOG PROCESSING PIPELINE
  // ============================================================

  /**
   * Process a single log through the entire SIEM pipeline
   * 1. Threat detection
   * 2. Alert rule evaluation
   * 3. Log correlation
   * 4. Auto-incident creation for critical threats
   */
  async processLog(log: {
    id: string;
    level: string;
    service: string;
    message: string;
    timestamp: Date;
    meta?: Record<string, unknown>;
  }): Promise<SIEMProcessResult> {
    const startTime = Date.now();
    
    const result: SIEMProcessResult = {
      logId: log.id,
      threats: [],
      alerts: [],
      correlations: [],
      anomalies: [],
      processingTime: 0,
    };

    try {
      // 1. Run threat detection - returns a single Threat or null
      const threat = await threatEngine.analyzeLog(log);
      if (threat) {
        result.threats.push(threat);
      }

      // 2. Evaluate alert rules
      const triggeredRules = await alertRulesEngine.evaluateLog(log);
      result.alerts = triggeredRules.map(({ ruleId, rule }): AlertResult => ({
        ruleId,
        ruleName: rule.name,
        triggered: true,
        severity: rule.severity,
        matchedConditions: rule.conditions.length,
        totalConditions: rule.conditions.length,
        details: `Rule "${rule.name}" triggered`,
        timestamp: new Date(),
      }));

      // 3. Run correlation using correlateLog method
      const correlatedEvents = correlationEngine.correlateLog({
        id: log.id,
        timestamp: log.timestamp,
        message: log.message,
        level: log.level,
        service: log.service,
        ...(log.meta || {}),
      });
      result.correlations = correlatedEvents;

      // 4. Create incidents for critical/high threats
      for (const t of result.threats) {
        if (t.severity === 'critical' || t.severity === 'high') {
          await incidentManager.createFromThreat(t);
        }
      }

      result.processingTime = Date.now() - startTime;

    } catch (error) {
      console.error('[SIEMOrchestrator] Processing error:', error);
      result.processingTime = Date.now() - startTime;
    }

    return result;
  }

  /**
   * Process multiple logs in batch
   */
  async processBatch(logs: {
    id: string;
    level: string;
    service: string;
    message: string;
    timestamp: Date;
    meta?: Record<string, unknown>;
  }[]): Promise<{ processed: number; threats: number; alerts: number; errors: number }> {
    let threatCount = 0;
    let alertCount = 0;
    let errorCount = 0;

    for (const log of logs) {
      try {
        const result = await this.processLog(log);
        threatCount += result.threats.length;
        alertCount += result.alerts.length;
      } catch {
        errorCount++;
      }
    }

    return {
      processed: logs.length,
      threats: threatCount,
      alerts: alertCount,
      errors: errorCount,
    };
  }

  // ============================================================
  // DASHBOARD & STATISTICS
  // ============================================================

  /**
   * Get aggregated dashboard statistics from all SIEM components
   */
  async getDashboardStats(): Promise<SIEMDashboardStats> {
    // Get stats from threat engine (async)
    const threatStats = await threatEngine.getStats();
    
    // Get incident stats (sync)
    const incidentStats = incidentManager.getStats();
    
    // Get alert rules stats (sync)
    const alertStats = alertRulesEngine.getStats();
    
    // Get all rules
    const rules = await alertRulesEngine.getRules();
    
    // Get correlated events count
    const correlatedEvents = correlationEngine.getCorrelatedEvents();

    return {
      threats: {
        total: threatStats.total,
        bySeverity: threatStats.bySeverity,
        byStatus: threatStats.byStatus,
        recentTrend: threatStats.recentTrend,
      },
      incidents: {
        total: Object.values(incidentStats).reduce((a, b) => a + b, 0),
        open: incidentStats.open || 0,
        inProgress: incidentStats.in_progress || 0,
        resolved: incidentStats.resolved || 0,
        avgResolutionTime: 0, // Would be calculated from actual data
      },
      alerts: {
        total: rules.reduce((sum, r) => sum + r.triggerCount, 0),
        triggeredToday: alertStats.topTriggeredRules.reduce((sum, r) => sum + r.count, 0),
        topRules: alertStats.topTriggeredRules.map(r => ({
          ruleId: r.id,
          name: r.name,
          count: r.count,
        })),
      },
      correlations: {
        total: correlatedEvents.length,
        activePatterns: correlationEngine.getRules().filter(r => r.enabled).length,
      },
    };
  }

  // ============================================================
  // HEALTH CHECK
  // ============================================================

  /**
   * Get health status of all SIEM components
   */
  async getHealthStatus(): Promise<SIEMHealthStatus> {
    const components: Record<string, { status: string; message?: string }> = {};

    // Check Threat Detection
    try {
      await threatEngine.getStats();
      components.threatDetection = { status: 'healthy' };
    } catch (error) {
      components.threatDetection = { 
        status: 'unhealthy', 
        message: String(error) 
      };
    }

    // Check Alert Rules
    try {
      await alertRulesEngine.getRules();
      components.alertRules = { status: 'healthy' };
    } catch (error) {
      components.alertRules = { 
        status: 'unhealthy', 
        message: String(error) 
      };
    }

    // Check Correlation Engine
    try {
      correlationEngine.getRules();
      components.correlation = { status: 'healthy' };
    } catch (error) {
      components.correlation = { 
        status: 'unhealthy', 
        message: String(error) 
      };
    }

    // Check Incident Manager
    try {
      incidentManager.getStats();
      components.incidents = { status: 'healthy' };
    } catch (error) {
      components.incidents = { 
        status: 'unhealthy', 
        message: String(error) 
      };
    }

    // Check Investigation Assistant
    try {
      investigationAssistant.getInvestigations();
      components.investigation = { status: 'healthy' };
    } catch (error) {
      components.investigation = { 
        status: 'unhealthy', 
        message: String(error) 
      };
    }

    const allHealthy = Object.values(components).every(c => c.status === 'healthy');
    const anyUnhealthy = Object.values(components).some(c => c.status === 'unhealthy');

    return {
      status: allHealthy ? 'healthy' : anyUnhealthy ? 'unhealthy' : 'degraded',
      components,
    };
  }

  // ============================================================
  // AI INVESTIGATION
  // ============================================================

  /**
   * Investigate a threat using AI analysis
   */
  async investigateThreat(threatId: string): Promise<{
    threat: Threat | null;
    aiAnalysis: {
      summary: string;
      threatLevel: string;
      indicators: string[];
      recommendations: string[];
    } | null;
    suggestedActions: string[];
  }> {
    // Get the threat
    const threat = await threatEngine.getThreatById(threatId);
    if (!threat) {
      return {
        threat: null,
        aiAnalysis: null,
        suggestedActions: [],
      };
    }

    // Use investigation assistant to analyze logs related to this threat
    const relatedLogs = [{
      id: threatId,
      timestamp: threat.createdAt,
      level: threat.severity,
      message: threat.description,
      service: threat.source,
    }];

    const aiAnalysis = await investigationAssistant.analyzeLogsWithAI(relatedLogs);

    return {
      threat,
      aiAnalysis: {
        summary: aiAnalysis.summary,
        threatLevel: aiAnalysis.threatLevel,
        indicators: aiAnalysis.indicators,
        recommendations: aiAnalysis.recommendations,
      },
      suggestedActions: aiAnalysis.recommendations,
    };
  }

  /**
   * Ask a question to the AI investigation assistant
   */
  async askQuestion(question: string, context?: {
    logs?: Array<{ message: string; level: string; timestamp: Date }>;
    investigationId?: string;
  }): Promise<{
    answer: string;
    confidence: number;
    relatedFindings: string[];
    suggestedQueries: string[];
  }> {
    return investigationAssistant.askQuestion(question, context || {});
  }

  /**
   * Create a new investigation
   */
  createInvestigation(params: {
    title: string;
    description: string;
    createdBy: string;
  }): Investigation {
    return investigationAssistant.createInvestigation(params);
  }

  /**
   * Get all investigations
   */
  getInvestigations(): Investigation[] {
    return investigationAssistant.getInvestigations();
  }

  /**
   * Get a specific investigation
   */
  getInvestigation(id: string): Investigation | undefined {
    return investigationAssistant.getInvestigation(id);
  }
}

// Export singleton instance
export const siemOrchestrator = new SIEMOrchestrator();

// Re-export all components for direct access
export { threatEngine } from './threat-detection.js';
export { alertRulesEngine } from './alert-rules.js';
export { correlationEngine } from './correlation.js';
export { incidentManager } from './incidents.js';
export { investigationAssistant } from './investigation.js';
export * from './types.js';
export { Investigation } from './investigation.js';
