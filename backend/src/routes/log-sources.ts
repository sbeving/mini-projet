import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// Generate API key
function generateApiKey(): string {
  return `ls_${crypto.randomBytes(32).toString('hex')}`;
}

// Hash API key for storage
function hashApiKey(apiKey: string): string {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

// Validate IP address format
function isValidIP(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$/;
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
  return ipv4Regex.test(ip) || ipv6Regex.test(ip) || cidrRegex.test(ip);
}

// Create audit log
async function createAuditLog(
  userId: string,
  action: string,
  resource: string,
  resourceId: string | null,
  details: any,
  req: any
) {
  await prisma.auditLog.create({
    data: {
      userId,
      action,
      resource,
      resourceId,
      details,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || null,
    },
  });
}

// GET /api/log-sources - List all log sources
router.get('/', requireAdmin, async (req, res) => {
  try {
    const sources = await prisma.logSource.findMany({
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: { usageStats: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Don't expose full API keys (already hashed) or secrets
    const sanitized = sources.map((s) => {
      // Calculate agent status based on lastSeenAt
      const lastSeen = s.lastSeenAt ? new Date(s.lastSeenAt) : null;
      const now = new Date();
      const minutesSinceLastSeen = lastSeen 
        ? (now.getTime() - lastSeen.getTime()) / (1000 * 60) 
        : null;
      
      let agentStatus: 'online' | 'offline' | 'stale' | 'never_connected' = 'never_connected';
      if (minutesSinceLastSeen !== null) {
        if (minutesSinceLastSeen < 2) agentStatus = 'online';
        else if (minutesSinceLastSeen < 10) agentStatus = 'stale';
        else agentStatus = 'offline';
      }

      return {
        ...s,
        apiKey: `${s.apiKey.substring(0, 10)}...`,
        webhookSecret: s.webhookSecret ? '***' : null,
        agentStatus,
      };
    });

    res.json({ sources: sanitized });
  } catch (error: any) {
    console.error('[LogSources] Error fetching sources:', error);
    res.status(500).json({ error: 'Failed to fetch log sources' });
  }
});

// GET /api/log-sources/:id - Get single log source
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const source = await prisma.logSource.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        usageStats: {
          orderBy: { timestamp: 'desc' },
          take: 100,
        },
      },
    });

    if (!source) {
      return res.status(404).json({ error: 'Log source not found' });
    }

    // Sanitize sensitive data
    const sanitized = {
      ...source,
      apiKey: `${source.apiKey.substring(0, 10)}...`,
      webhookSecret: source.webhookSecret ? '***' : null,
    };

    res.json({ source: sanitized });
  } catch (error: any) {
    console.error('[LogSources] Error fetching source:', error);
    res.status(500).json({ error: 'Failed to fetch log source' });
  }
});

// POST /api/log-sources - Create new log source
router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      environment,
      allowedIps,
      allowedDomains,
      allowedHostnames,
      webhookUrl,
      rateLimit,
      rateLimitWindow,
      metadata,
    } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (allowedIps && !Array.isArray(allowedIps)) {
      return res.status(400).json({ error: 'allowedIps must be an array' });
    }

    if (allowedIps && allowedIps.some((ip: string) => !isValidIP(ip))) {
      return res.status(400).json({ error: 'Invalid IP address format' });
    }

    // Generate API key and secret
    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);
    const webhookSecret = webhookUrl ? crypto.randomBytes(32).toString('hex') : null;

    const source = await prisma.logSource.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        type: type || 'API',
        environment: environment || null,
        apiKey,
        apiKeyHash,
        allowedIps: allowedIps || [],
        allowedDomains: allowedDomains || [],
        allowedHostnames: allowedHostnames || [],
        webhookUrl: webhookUrl || null,
        webhookSecret,
        rateLimit: rateLimit || 1000,
        rateLimitWindow: rateLimitWindow || 60,
        metadata: metadata || null,
        createdById: (req as any).user.userId,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Audit log
    await createAuditLog(
      (req as any).user.userId,
      'CREATE',
      'log_source',
      source.id,
      { name, type },
      req
    );

    // Return with full API key (only time it's visible)
    res.status(201).json({
      source,
      apiKey, // Full key shown ONCE
      webhookSecret, // Full secret shown ONCE
      warning: 'Save the API key and webhook secret securely. They cannot be recovered.',
    });
  } catch (error: any) {
    console.error('[LogSources] Error creating source:', error);
    res.status(500).json({ error: 'Failed to create log source' });
  }
});

// PATCH /api/log-sources/:id - Update log source
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      isActive,
      allowedIps,
      allowedDomains,
      allowedHostnames,
      webhookUrl,
      rateLimit,
      rateLimitWindow,
      metadata,
    } = req.body;

    // Check existence
    const existing = await prisma.logSource.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Log source not found' });
    }

    // Validation
    if (allowedIps && !Array.isArray(allowedIps)) {
      return res.status(400).json({ error: 'allowedIps must be an array' });
    }

    if (allowedIps && allowedIps.some((ip: string) => !isValidIP(ip))) {
      return res.status(400).json({ error: 'Invalid IP address format' });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (allowedIps !== undefined) updateData.allowedIps = allowedIps;
    if (allowedDomains !== undefined) updateData.allowedDomains = allowedDomains;
    if (allowedHostnames !== undefined) updateData.allowedHostnames = allowedHostnames;
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl;
    if (rateLimit !== undefined) updateData.rateLimit = rateLimit;
    if (rateLimitWindow !== undefined) updateData.rateLimitWindow = rateLimitWindow;
    if (metadata !== undefined) updateData.metadata = metadata;

    const source = await prisma.logSource.update({
      where: { id },
      data: updateData,
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Audit log
    await createAuditLog(
      (req as any).user.userId,
      'UPDATE',
      'log_source',
      id,
      { changes: Object.keys(updateData) },
      req
    );

    // Sanitize
    const sanitized = {
      ...source,
      apiKey: `${source.apiKey.substring(0, 10)}...`,
      webhookSecret: source.webhookSecret ? '***' : null,
    };

    res.json({ source: sanitized });
  } catch (error: any) {
    console.error('[LogSources] Error updating source:', error);
    res.status(500).json({ error: 'Failed to update log source' });
  }
});

// POST /api/log-sources/:id/regenerate-key - Regenerate API key
router.post('/:id/regenerate-key', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.logSource.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Log source not found' });
    }

    const newApiKey = generateApiKey();
    const newApiKeyHash = hashApiKey(newApiKey);

    const source = await prisma.logSource.update({
      where: { id },
      data: {
        apiKey: newApiKey,
        apiKeyHash: newApiKeyHash,
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Audit log
    await createAuditLog(
      (req as any).user.userId,
      'REGENERATE_KEY',
      'log_source',
      id,
      { name: source.name },
      req
    );

    res.json({
      source: {
        ...source,
        apiKey: newApiKey, // Full key shown ONCE
        webhookSecret: source.webhookSecret ? '***' : null,
      },
      apiKey: newApiKey,
      warning: 'Save the new API key securely. The old key is now invalid.',
    });
  } catch (error: any) {
    console.error('[LogSources] Error regenerating key:', error);
    res.status(500).json({ error: 'Failed to regenerate API key' });
  }
});

// DELETE /api/log-sources/:id - Delete log source
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.logSource.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Log source not found' });
    }

    await prisma.logSource.delete({ where: { id } });

    // Audit log
    await createAuditLog(
      (req as any).user.userId,
      'DELETE',
      'log_source',
      id,
      { name: existing.name },
      req
    );

    res.json({ success: true, message: 'Log source deleted' });
  } catch (error: any) {
    console.error('[LogSources] Error deleting source:', error);
    res.status(500).json({ error: 'Failed to delete log source' });
  }
});

// GET /api/log-sources/:id/usage - Get usage stats for source
router.get('/:id/usage', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 7 } = req.query;

    const since = new Date();
    since.setDate(since.getDate() - Number(days));

    const usage = await prisma.logSourceUsage.findMany({
      where: {
        logSourceId: id,
        timestamp: { gte: since },
      },
      orderBy: { timestamp: 'desc' },
    });

    const totals = usage.reduce(
      (acc, u) => ({
        logs: acc.logs + u.logsReceived,
        bytes: acc.bytes + u.bytesReceived,
        requests: acc.requests + u.requestsCount,
        errors: acc.errors + u.errorsCount,
      }),
      { logs: 0, bytes: 0, requests: 0, errors: 0 }
    );

    res.json({ usage, totals });
  } catch (error: any) {
    console.error('[LogSources] Error fetching usage:', error);
    res.status(500).json({ error: 'Failed to fetch usage stats' });
  }
});

export default router;
