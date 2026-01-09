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
      activeRules: rules.filter(r => r.enabled).length,
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
      tactics: techniques.map(t => t.tactic),
    };
    res.json(mapping);
  } catch (error) {
    console.error('Get MITRE mapping error:', error);
    res.status(500).json({ error: 'Failed to get MITRE mapping' });
  }
});

export default router;
