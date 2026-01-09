/**
 * SIEM API Routes
 * REST endpoints for Security Information and Event Management
 */

import { Router, Request, Response } from 'express';
import { authenticate, adminOnly, staffOrAdmin } from '../middleware/auth.js';
import {
  siemOrchestrator,
  threatEngine,
  alertRulesEngine,
  correlationEngine,
  incidentManager,
  investigationAssistant,
} from '../services/siem/index.js';
import { ThreatSeverity, IncidentStatus, IncidentPriority } from '../services/siem/types.js';

const router = Router();

// ============================================================
// DASHBOARD & HEALTH
// ============================================================

/**
 * GET /api/siem/dashboard
 * Get SIEM dashboard statistics
 */
router.get('/dashboard', authenticate, async (_req: Request, res: Response) => {
  try {
    const stats = await siemOrchestrator.getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to get dashboard stats' });
  }
});

/**
 * GET /api/siem/health
 * Get SIEM system health status
 */
router.get('/health', async (_req: Request, res: Response) => {
  try {
    const health = await siemOrchestrator.getHealthStatus();
    res.json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'unhealthy',
      error: String(error),
    });
  }
});

// ============================================================
// LOG PROCESSING
// ============================================================

/**
 * POST /api/siem/process
 * Process a single log through SIEM pipeline
 */
router.post('/process', authenticate, async (req: Request, res: Response) => {
  try {
    const log = req.body;
    
    if (!log.id || !log.message) {
      return res.status(400).json({ error: 'Log must have id and message' });
    }
    
    const result = await siemOrchestrator.processLog({
      id: log.id,
      level: log.level || 'info',
      service: log.service || 'unknown',
      message: log.message,
      timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
      meta: log.meta,
    });
    
    res.json(result);
  } catch (error) {
    console.error('Process log error:', error);
    res.status(500).json({ error: 'Failed to process log' });
  }
});

/**
 * POST /api/siem/process/batch
 * Process multiple logs
 */
router.post('/process/batch', authenticate, async (req: Request, res: Response) => {
  try {
    const { logs } = req.body;
    
    if (!Array.isArray(logs)) {
      return res.status(400).json({ error: 'logs must be an array' });
    }
    
    const result = await siemOrchestrator.processBatch(
      logs.map(log => ({
        id: log.id,
        level: log.level || 'info',
        service: log.service || 'unknown',
        message: log.message,
        timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
        meta: log.meta,
      }))
    );
    
    res.json(result);
  } catch (error) {
    console.error('Batch process error:', error);
    res.status(500).json({ error: 'Failed to process batch' });
  }
});

// ============================================================
// THREAT DETECTION
// ============================================================

/**
 * GET /api/siem/threats
 * Get all detected threats
 */
router.get('/threats', authenticate, async (req: Request, res: Response) => {
  try {
    const { severity, status, limit = '50' } = req.query;
    
    const threats = await threatEngine.getThreats({
      severity: severity as ThreatSeverity | undefined,
      status: status as string | undefined,
      limit: parseInt(limit as string),
    });
    
    res.json(threats);
  } catch (error) {
    console.error('Get threats error:', error);
    res.status(500).json({ error: 'Failed to get threats' });
  }
});

/**
 * GET /api/siem/threats/:id
 * Get specific threat details
 */
router.get('/threats/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const threat = await threatEngine.getThreatById(req.params.id);
    
    if (!threat) {
      return res.status(404).json({ error: 'Threat not found' });
    }
    
    res.json(threat);
  } catch (error) {
    console.error('Get threat error:', error);
    res.status(500).json({ error: 'Failed to get threat' });
  }
});

/**
 * PATCH /api/siem/threats/:id/status
 * Update threat status
 */
router.patch('/threats/:id/status', authenticate, staffOrAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const threat = await threatEngine.updateThreatStatus(req.params.id, status);
    
    if (!threat) {
      return res.status(404).json({ error: 'Threat not found' });
    }
    
    res.json(threat);
  } catch (error) {
    console.error('Update threat status error:', error);
    res.status(500).json({ error: 'Failed to update threat status' });
  }
});

/**
 * GET /api/siem/threats/stats
 * Get threat statistics
 */
router.get('/threats/stats', authenticate, async (_req: Request, res: Response) => {
  try {
    const stats = threatEngine.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Get threat stats error:', error);
    res.status(500).json({ error: 'Failed to get threat stats' });
  }
});

// ============================================================
// ALERT RULES
// ============================================================

/**
 * GET /api/siem/rules
 * Get all alert rules
 */
router.get('/rules', authenticate, async (_req: Request, res: Response) => {
  try {
    const rules = await alertRulesEngine.getRules();
    res.json(rules);
  } catch (error) {
    console.error('Get rules error:', error);
    res.status(500).json({ error: 'Failed to get rules' });
  }
});

/**
 * GET /api/siem/rules/:id
 * Get specific rule
 */
router.get('/rules/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const rule = await alertRulesEngine.getRule(req.params.id);
    
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    res.json(rule);
  } catch (error) {
    console.error('Get rule error:', error);
    res.status(500).json({ error: 'Failed to get rule' });
  }
});

/**
 * POST /api/siem/rules
 * Create new alert rule
 */
router.post('/rules', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const ruleData = req.body;
    const rule = await alertRulesEngine.createRule(ruleData);
    res.status(201).json(rule);
  } catch (error) {
    console.error('Create rule error:', error);
    res.status(500).json({ error: 'Failed to create rule' });
  }
});

/**
 * PUT /api/siem/rules/:id
 * Update alert rule
 */
router.put('/rules/:id', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const rule = await alertRulesEngine.updateRule(req.params.id, req.body);
    
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    res.json(rule);
  } catch (error) {
    console.error('Update rule error:', error);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

/**
 * DELETE /api/siem/rules/:id
 * Delete alert rule
 */
router.delete('/rules/:id', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const deleted = await alertRulesEngine.deleteRule(req.params.id);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    console.error('Delete rule error:', error);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

/**
 * PATCH /api/siem/rules/:id/toggle
 * Enable/disable rule
 */
router.patch('/rules/:id/toggle', authenticate, staffOrAdmin, async (req: Request, res: Response) => {
  try {
    const { enabled } = req.body;
    const rule = await alertRulesEngine.toggleRule(req.params.id, enabled);
    
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    res.json(rule);
  } catch (error) {
    console.error('Toggle rule error:', error);
    res.status(500).json({ error: 'Failed to toggle rule' });
  }
});

/**
 * POST /api/siem/rules/:id/test
 * Test rule against sample logs
 */
router.post('/rules/:id/test', authenticate, async (req: Request, res: Response) => {
  try {
    const { testLogs } = req.body;
    const results = await alertRulesEngine.testRule(req.params.id, testLogs);
    res.json(results);
  } catch (error) {
    console.error('Test rule error:', error);
    res.status(500).json({ error: 'Failed to test rule' });
  }
});

// ============================================================
// CORRELATION
// ============================================================

/**
 * GET /api/siem/correlations
 * Get correlation rules
 */
router.get('/correlations', authenticate, async (_req: Request, res: Response) => {
  try {
    const rules = await correlationEngine.getRules();
    res.json(rules);
  } catch (error) {
    console.error('Get correlations error:', error);
    res.status(500).json({ error: 'Failed to get correlation rules' });
  }
});

/**
 * GET /api/siem/correlations/events
 * Get correlated events
 */
router.get('/correlations/events', authenticate, async (req: Request, res: Response) => {
  try {
    const { limit = '100' } = req.query;
    const allEvents = correlationEngine.getCorrelatedEvents();
    const events = allEvents.slice(0, parseInt(limit as string));
    res.json(events);
  } catch (error) {
    console.error('Get correlated events error:', error);
    res.status(500).json({ error: 'Failed to get correlated events' });
  }
});

/**
 * GET /api/siem/correlations/stats
 * Get correlation statistics
 */
router.get('/correlations/stats', authenticate, async (_req: Request, res: Response) => {
  try {
    const rules = correlationEngine.getRules();
    const events = correlationEngine.getCorrelatedEvents();
    const stats = {
      totalRules: rules.length,
      activeRules: rules.filter((r: { enabled: boolean }) => r.enabled).length,
      totalCorrelations: events.length,
    };
    res.json(stats);
  } catch (error) {
    console.error('Get correlation stats error:', error);
    res.status(500).json({ error: 'Failed to get correlation stats' });
  }
});

// ============================================================
// INCIDENTS
// ============================================================

/**
 * GET /api/siem/incidents
 * Get all incidents
 */
router.get('/incidents', authenticate, async (req: Request, res: Response) => {
  try {
    const { status, priority, severity } = req.query;
    
    const incidents = await incidentManager.getIncidents({
      status: status as IncidentStatus | undefined,
      priority: priority as IncidentPriority | undefined,
      severity: severity as ThreatSeverity | undefined,
    });
    
    res.json(incidents);
  } catch (error) {
    console.error('Get incidents error:', error);
    res.status(500).json({ error: 'Failed to get incidents' });
  }
});

/**
 * GET /api/siem/incidents/:id
 * Get specific incident
 */
router.get('/incidents/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const incident = await incidentManager.getIncident(req.params.id);
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    res.json(incident);
  } catch (error) {
    console.error('Get incident error:', error);
    res.status(500).json({ error: 'Failed to get incident' });
  }
});

/**
 * POST /api/siem/incidents
 * Create new incident
 */
router.post('/incidents', authenticate, async (req: Request, res: Response) => {
  try {
    const incident = await incidentManager.createIncident(req.body);
    res.status(201).json(incident);
  } catch (error) {
    console.error('Create incident error:', error);
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

/**
 * PATCH /api/siem/incidents/:id/status
 * Update incident status
 */
router.patch('/incidents/:id/status', authenticate, staffOrAdmin, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const user = (req as any).user;
    
    const incident = await incidentManager.updateIncidentStatus(
      req.params.id,
      status,
      user?.email || 'system'
    );
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    res.json(incident);
  } catch (error) {
    console.error('Update incident status error:', error);
    res.status(500).json({ error: 'Failed to update incident status' });
  }
});

/**
 * PATCH /api/siem/incidents/:id/assign
 * Assign incident to user
 */
router.patch('/incidents/:id/assign', authenticate, staffOrAdmin, async (req: Request, res: Response) => {
  try {
    const { assignee } = req.body;
    const user = (req as any).user;
    
    const incident = await incidentManager.assignIncident(
      req.params.id,
      assignee,
      user?.email || 'system'
    );
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    res.json(incident);
  } catch (error) {
    console.error('Assign incident error:', error);
    res.status(500).json({ error: 'Failed to assign incident' });
  }
});

/**
 * POST /api/siem/incidents/:id/comments
 * Add comment to incident
 */
router.post('/incidents/:id/comments', authenticate, async (req: Request, res: Response) => {
  try {
    const { comment } = req.body;
    const user = (req as any).user;
    
    const incident = await incidentManager.addComment(
      req.params.id,
      comment,
      user?.email || 'anonymous'
    );
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    res.json(incident);
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

/**
 * POST /api/siem/incidents/:id/resolve
 * Resolve incident with details
 */
router.post('/incidents/:id/resolve', authenticate, staffOrAdmin, async (req: Request, res: Response) => {
  try {
    const { resolution, rootCause } = req.body;
    const user = (req as any).user;
    
    const incident = await incidentManager.resolveIncident(
      req.params.id,
      resolution,
      rootCause,
      user?.email || 'system'
    );
    
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }
    
    res.json(incident);
  } catch (error) {
    console.error('Resolve incident error:', error);
    res.status(500).json({ error: 'Failed to resolve incident' });
  }
});

// ============================================================
// PLAYBOOKS
// ============================================================

/**
 * GET /api/siem/playbooks
 * Get all playbooks
 */
router.get('/playbooks', authenticate, async (_req: Request, res: Response) => {
  try {
    const playbooks = await incidentManager.getPlaybooks();
    res.json(playbooks);
  } catch (error) {
    console.error('Get playbooks error:', error);
    res.status(500).json({ error: 'Failed to get playbooks' });
  }
});

/**
 * GET /api/siem/playbooks/:id
 * Get specific playbook
 */
router.get('/playbooks/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const playbook = await incidentManager.getPlaybook(req.params.id);
    
    if (!playbook) {
      return res.status(404).json({ error: 'Playbook not found' });
    }
    
    res.json(playbook);
  } catch (error) {
    console.error('Get playbook error:', error);
    res.status(500).json({ error: 'Failed to get playbook' });
  }
});

/**
 * POST /api/siem/playbooks
 * Create new playbook
 */
router.post('/playbooks', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const playbook = await incidentManager.createPlaybook(req.body);
    res.status(201).json(playbook);
  } catch (error) {
    console.error('Create playbook error:', error);
    res.status(500).json({ error: 'Failed to create playbook' });
  }
});

/**
 * POST /api/siem/incidents/:id/execute-playbook
 * Execute playbook on incident
 */
router.post('/incidents/:id/execute-playbook', authenticate, staffOrAdmin, async (req: Request, res: Response) => {
  try {
    const { playbookId } = req.body;
    const user = (req as any).user;
    
    const result = await incidentManager.executePlaybook(
      req.params.id,
      playbookId,
      user?.email || 'system'
    );
    
    res.json(result);
  } catch (error) {
    console.error('Execute playbook error:', error);
    res.status(500).json({ error: 'Failed to execute playbook' });
  }
});

// ============================================================
// INVESTIGATIONS
// ============================================================

/**
 * POST /api/siem/investigate/:threatId
 * Start AI-powered investigation
 */
router.post('/investigate/:threatId', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await siemOrchestrator.investigateThreat(req.params.threatId);
    res.json(result);
  } catch (error) {
    console.error('Investigation error:', error);
    res.status(500).json({ error: 'Failed to investigate threat' });
  }
});

/**
 * POST /api/siem/investigate/ask
 * Ask AI a question about threats/security
 */
router.post('/investigate/ask', authenticate, async (req: Request, res: Response) => {
  try {
    const { question, context } = req.body;
    
    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    const answer = await siemOrchestrator.askQuestion(question, context);
    res.json({ question, answer });
  } catch (error) {
    console.error('AI question error:', error);
    res.status(500).json({ error: 'Failed to get AI response' });
  }
});

/**
 * GET /api/siem/investigate/:threatId/context
 * Get investigation context for a threat
 */
router.get('/investigate/:threatId/context', authenticate, async (req: Request, res: Response) => {
  try {
    // Get threat and build context manually
    const threat = await threatEngine.getThreatById(req.params.threatId);
    if (!threat) {
      return res.status(404).json({ error: 'Threat not found' });
    }
    
    const context = {
      threat,
      relatedLogs: [],
      timeline: [
        { timestamp: threat.createdAt, event: 'Threat detected', description: threat.description }
      ],
    };
    res.json(context);
  } catch (error) {
    console.error('Get context error:', error);
    res.status(500).json({ error: 'Failed to get investigation context' });
  }
});

/**
 * POST /api/siem/investigate/:threatId/entities
 * Analyze entities related to threat
 */
router.post('/investigate/:threatId/entities', authenticate, async (req: Request, res: Response) => {
  try {
    const { entity } = req.body;
    if (!entity || !entity.type || !entity.value) {
      return res.status(400).json({ error: 'Entity type and value are required' });
    }
    
    // Get threat for context
    const threat = await threatEngine.getThreatById(req.params.threatId);
    const logs = threat ? [{
      id: threat.id,
      timestamp: threat.createdAt,
      message: threat.description,
      level: threat.severity,
    }] : [];
    
    const analysis = await investigationAssistant.analyzeEntity({
      type: entity.type,
      value: entity.value,
      logs,
    });
    res.json(analysis);
  } catch (error) {
    console.error('Analyze entities error:', error);
    res.status(500).json({ error: 'Failed to analyze entities' });
  }
});

/**
 * GET /api/siem/investigate/:threatId/mitre
 * Get MITRE ATT&CK mapping
 */
router.get('/investigate/:threatId/mitre', authenticate, async (req: Request, res: Response) => {
  try {
    const threat = await threatEngine.getThreatById(req.params.threatId);
    if (!threat) {
      return res.status(404).json({ error: 'Threat not found' });
    }
    
    // Return MITRE techniques from the threat
    const techniques = threat.mitreAttack || [];
    const mapping = {
      threatId: threat.id,
      techniques,
      tactics: techniques.map((t: { tactic: string }) => t.tactic),
    };
    res.json(mapping);
  } catch (error) {
    console.error('Get MITRE mapping error:', error);
    res.status(500).json({ error: 'Failed to get MITRE mapping' });
  }
});

// ============================================================
// THREAT INTELLIGENCE
// ============================================================

import { threatIntelService } from '../services/siem/threat-intel.js';

/**
 * GET /api/siem/threat-intel/stats
 * Get threat intelligence statistics
 */
router.get('/threat-intel/stats', authenticate, async (_req: Request, res: Response) => {
  try {
    const stats = threatIntelService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Threat intel stats error:', error);
    res.status(500).json({ error: 'Failed to get threat intel stats' });
  }
});

/**
 * POST /api/siem/threat-intel/extract
 * Extract IOCs from text
 */
router.post('/threat-intel/extract', authenticate, async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    const iocs = threatIntelService.extractIOCs(text);
    res.json({ iocs, count: iocs.length });
  } catch (error) {
    console.error('Extract IOCs error:', error);
    res.status(500).json({ error: 'Failed to extract IOCs' });
  }
});

/**
 * POST /api/siem/threat-intel/enrich
 * Enrich an indicator
 */
router.post('/threat-intel/enrich', authenticate, async (req: Request, res: Response) => {
  try {
    const { indicator, type } = req.body;
    if (!indicator || !type) {
      return res.status(400).json({ error: 'Indicator and type are required' });
    }
    
    const enrichment = await threatIntelService.enrichIndicator(indicator, type);
    res.json(enrichment);
  } catch (error) {
    console.error('Enrich indicator error:', error);
    res.status(500).json({ error: 'Failed to enrich indicator' });
  }
});

/**
 * GET /api/siem/threat-intel/feeds
 * Get configured threat feeds
 */
router.get('/threat-intel/feeds', authenticate, async (_req: Request, res: Response) => {
  try {
    const feeds = threatIntelService.getFeeds();
    res.json(feeds);
  } catch (error) {
    console.error('Get feeds error:', error);
    res.status(500).json({ error: 'Failed to get feeds' });
  }
});

/**
 * POST /api/siem/threat-intel/lookup
 * Lookup indicator reputation
 */
router.post('/threat-intel/lookup', authenticate, async (req: Request, res: Response) => {
  try {
    const { indicator } = req.body;
    if (!indicator) {
      return res.status(400).json({ error: 'Indicator is required' });
    }
    
    const reputation = threatIntelService.lookupReputation(indicator);
    res.json(reputation);
  } catch (error) {
    console.error('Lookup reputation error:', error);
    res.status(500).json({ error: 'Failed to lookup reputation' });
  }
});

// ============================================================
// SOAR (Security Orchestration, Automation and Response)
// ============================================================

import { soarEngine } from '../services/siem/soar.js';

/**
 * GET /api/siem/soar/playbooks
 * Get all playbooks
 */
router.get('/soar/playbooks', authenticate, async (_req: Request, res: Response) => {
  try {
    const playbooks = soarEngine.getPlaybooks();
    res.json(playbooks);
  } catch (error) {
    console.error('Get playbooks error:', error);
    res.status(500).json({ error: 'Failed to get playbooks' });
  }
});

/**
 * GET /api/siem/soar/playbooks/:id
 * Get playbook by ID
 */
router.get('/soar/playbooks/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const playbook = soarEngine.getPlaybook(req.params.id);
    if (!playbook) {
      return res.status(404).json({ error: 'Playbook not found' });
    }
    res.json(playbook);
  } catch (error) {
    console.error('Get playbook error:', error);
    res.status(500).json({ error: 'Failed to get playbook' });
  }
});

/**
 * POST /api/siem/soar/playbooks/:id/execute
 * Execute a playbook
 */
router.post('/soar/playbooks/:id/execute', authenticate, staffOrAdmin, async (req: Request, res: Response) => {
  try {
    const { context } = req.body;
    const user = (req as any).user;
    
    const result = await soarEngine.runPlaybook(
      req.params.id,
      context || {},
      user.id
    );
    res.json(result);
  } catch (error) {
    console.error('Execute playbook error:', error);
    res.status(500).json({ error: 'Failed to execute playbook' });
  }
});

/**
 * GET /api/siem/soar/actions
 * Get available action types
 */
router.get('/soar/actions', authenticate, async (_req: Request, res: Response) => {
  try {
    const actions = soarEngine.getActionDefinitions();
    res.json(actions);
  } catch (error) {
    console.error('Get actions error:', error);
    res.status(500).json({ error: 'Failed to get actions' });
  }
});

/**
 * GET /api/siem/soar/history
 * Get action execution history
 */
router.get('/soar/history', authenticate, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const history = soarEngine.getActionHistory(limit);
    res.json(history);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get action history' });
  }
});

/**
 * GET /api/siem/soar/pending
 * Get pending approvals
 */
router.get('/soar/pending', authenticate, staffOrAdmin, async (_req: Request, res: Response) => {
  try {
    const pending = soarEngine.getPendingApprovals();
    res.json(pending);
  } catch (error) {
    console.error('Get pending error:', error);
    res.status(500).json({ error: 'Failed to get pending approvals' });
  }
});

/**
 * POST /api/siem/soar/pending/:id/approve
 * Approve a pending action
 */
router.post('/soar/pending/:id/approve', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const result = await soarEngine.approveAction(req.params.id, user.id);
    res.json(result);
  } catch (error) {
    console.error('Approve action error:', error);
    res.status(500).json({ error: 'Failed to approve action' });
  }
});

/**
 * POST /api/siem/soar/pending/:id/reject
 * Reject a pending action
 */
router.post('/soar/pending/:id/reject', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const result = await soarEngine.rejectAction(req.params.id, user.id);
    res.json(result);
  } catch (error) {
    console.error('Reject action error:', error);
    res.status(500).json({ error: 'Failed to reject action' });
  }
});

/**
 * GET /api/siem/soar/stats
 * Get SOAR statistics
 */
router.get('/soar/stats', authenticate, async (_req: Request, res: Response) => {
  try {
    const stats = soarEngine.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Get SOAR stats error:', error);
    res.status(500).json({ error: 'Failed to get SOAR stats' });
  }
});

// ============================================================
// UEBA (User and Entity Behavior Analytics)
// ============================================================

import { uebaEngine } from '../services/siem/ueba.js';

/**
 * GET /api/siem/ueba/profiles
 * Get entity profiles
 */
router.get('/ueba/profiles', authenticate, async (req: Request, res: Response) => {
  try {
    const filters = {
      entityType: req.query.entityType as any,
      riskLevel: req.query.riskLevel as any,
      peerGroup: req.query.peerGroup as string,
    };
    const profiles = uebaEngine.getProfiles(filters);
    res.json(profiles);
  } catch (error) {
    console.error('Get profiles error:', error);
    res.status(500).json({ error: 'Failed to get profiles' });
  }
});

/**
 * GET /api/siem/ueba/profiles/:entityType/:entityId
 * Get specific entity profile
 */
router.get('/ueba/profiles/:entityType/:entityId', authenticate, async (req: Request, res: Response) => {
  try {
    const profile = uebaEngine.getProfile(
      req.params.entityType as any,
      req.params.entityId
    );
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json(profile);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

/**
 * POST /api/siem/ueba/analyze
 * Analyze an activity event
 */
router.post('/ueba/analyze', authenticate, async (req: Request, res: Response) => {
  try {
    const event = req.body;
    if (!event.entityId || !event.entityType || !event.eventType) {
      return res.status(400).json({ error: 'entityId, entityType, and eventType are required' });
    }
    
    const anomalies = await uebaEngine.analyzeActivity({
      id: event.id || `event-${Date.now()}`,
      entityId: event.entityId,
      entityType: event.entityType,
      eventType: event.eventType,
      timestamp: event.timestamp ? new Date(event.timestamp) : new Date(),
      sourceIp: event.sourceIp,
      destinationIp: event.destinationIp,
      resource: event.resource,
      action: event.action,
      status: event.status,
      metadata: event.metadata,
    });
    
    res.json({ anomalies, count: anomalies.length });
  } catch (error) {
    console.error('Analyze activity error:', error);
    res.status(500).json({ error: 'Failed to analyze activity' });
  }
});

/**
 * GET /api/siem/ueba/anomalies
 * Get recent anomalies
 */
router.get('/ueba/anomalies', authenticate, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const anomalies = uebaEngine.getAnomalies(limit);
    res.json(anomalies);
  } catch (error) {
    console.error('Get anomalies error:', error);
    res.status(500).json({ error: 'Failed to get anomalies' });
  }
});

/**
 * GET /api/siem/ueba/high-risk
 * Get high-risk entities
 */
router.get('/ueba/high-risk', authenticate, async (req: Request, res: Response) => {
  try {
    const minRiskScore = parseInt(req.query.minRiskScore as string) || 60;
    const entities = uebaEngine.getHighRiskEntities(minRiskScore);
    res.json(entities);
  } catch (error) {
    console.error('Get high-risk entities error:', error);
    res.status(500).json({ error: 'Failed to get high-risk entities' });
  }
});

/**
 * GET /api/siem/ueba/peer-groups
 * Get peer groups
 */
router.get('/ueba/peer-groups', authenticate, async (_req: Request, res: Response) => {
  try {
    const groups = uebaEngine.getPeerGroups();
    res.json(groups);
  } catch (error) {
    console.error('Get peer groups error:', error);
    res.status(500).json({ error: 'Failed to get peer groups' });
  }
});

/**
 * GET /api/siem/ueba/stats
 * Get UEBA statistics
 */
router.get('/ueba/stats', authenticate, async (_req: Request, res: Response) => {
  try {
    const stats = uebaEngine.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Get UEBA stats error:', error);
    res.status(500).json({ error: 'Failed to get UEBA stats' });
  }
});

/**
 * POST /api/siem/ueba/profiles/:entityType/:entityId/reset-risk
 * Reset entity risk score
 */
router.post('/ueba/profiles/:entityType/:entityId/reset-risk', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const success = uebaEngine.resetRiskScore(
      req.params.entityType as any,
      req.params.entityId
    );
    if (!success) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    res.json({ success: true, message: 'Risk score reset' });
  } catch (error) {
    console.error('Reset risk score error:', error);
    res.status(500).json({ error: 'Failed to reset risk score' });
  }
});

// ============================================================
// ML ANOMALY DETECTION
// ============================================================

import { mlAnomalyEngine } from '../services/siem/ml-anomaly.js';

/**
 * POST /api/siem/ml/score
 * Score a single log for anomalies
 */
router.post('/ml/score', authenticate, async (req: Request, res: Response) => {
  try {
    const log = req.body;
    if (!log.id || !log.message) {
      return res.status(400).json({ error: 'Log id and message are required' });
    }
    
    const score = await mlAnomalyEngine.scoreAnomaly({
      id: log.id,
      message: log.message,
      timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
      service: log.service,
      level: log.level,
      source: log.source,
    });
    
    res.json(score);
  } catch (error) {
    console.error('Score anomaly error:', error);
    res.status(500).json({ error: 'Failed to score anomaly' });
  }
});

/**
 * POST /api/siem/ml/score/batch
 * Score multiple logs for anomalies
 */
router.post('/ml/score/batch', authenticate, async (req: Request, res: Response) => {
  try {
    const { logs } = req.body;
    if (!Array.isArray(logs)) {
      return res.status(400).json({ error: 'logs must be an array' });
    }
    
    const scores = await mlAnomalyEngine.batchScore(
      logs.map(log => ({
        id: log.id,
        message: log.message,
        timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
        service: log.service,
        level: log.level,
        source: log.source,
      }))
    );
    
    const anomalies = scores.filter(s => s.isAnomaly);
    res.json({ 
      scores, 
      total: scores.length,
      anomalies: anomalies.length,
      anomalyRate: (anomalies.length / scores.length) * 100,
    });
  } catch (error) {
    console.error('Batch score error:', error);
    res.status(500).json({ error: 'Failed to batch score anomalies' });
  }
});

/**
 * GET /api/siem/ml/anomalies
 * Get anomaly history
 */
router.get('/ml/anomalies', authenticate, async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const history = mlAnomalyEngine.getAnomalyHistory(limit);
    res.json(history);
  } catch (error) {
    console.error('Get anomaly history error:', error);
    res.status(500).json({ error: 'Failed to get anomaly history' });
  }
});

/**
 * GET /api/siem/ml/models
 * Get ML model info
 */
router.get('/ml/models', authenticate, async (_req: Request, res: Response) => {
  try {
    const models = mlAnomalyEngine.getModels();
    res.json(models);
  } catch (error) {
    console.error('Get models error:', error);
    res.status(500).json({ error: 'Failed to get models' });
  }
});

/**
 * POST /api/siem/ml/feedback
 * Provide feedback on an anomaly detection
 */
router.post('/ml/feedback', authenticate, async (req: Request, res: Response) => {
  try {
    const { anomalyId, isTruePositive } = req.body;
    if (!anomalyId || isTruePositive === undefined) {
      return res.status(400).json({ error: 'anomalyId and isTruePositive are required' });
    }
    
    mlAnomalyEngine.provideFeedback(anomalyId, isTruePositive);
    res.json({ success: true, message: 'Feedback recorded' });
  } catch (error) {
    console.error('Provide feedback error:', error);
    res.status(500).json({ error: 'Failed to record feedback' });
  }
});

/**
 * POST /api/siem/ml/retrain
 * Retrain ML models
 */
router.post('/ml/retrain', authenticate, adminOnly, async (_req: Request, res: Response) => {
  try {
    const result = await mlAnomalyEngine.retrainModels();
    res.json(result);
  } catch (error) {
    console.error('Retrain error:', error);
    res.status(500).json({ error: 'Failed to retrain models' });
  }
});

/**
 * GET /api/siem/ml/stats
 * Get ML anomaly detection statistics
 */
router.get('/ml/stats', authenticate, async (_req: Request, res: Response) => {
  try {
    const stats = mlAnomalyEngine.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Get ML stats error:', error);
    res.status(500).json({ error: 'Failed to get ML stats' });
  }
});

export default router;
