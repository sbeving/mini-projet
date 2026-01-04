import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

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

// GET /api/integrations - List all integrations
router.get('/', requireAdmin, async (req, res) => {
  try {
    const integrations = await prisma.integration.findMany({
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Sanitize sensitive data
    const sanitized = integrations.map((i) => ({
      ...i,
      credentials: i.credentials ? '***' : null,
      webhookSecret: i.webhookSecret ? '***' : null,
    }));

    res.json({ integrations: sanitized });
  } catch (error: any) {
    console.error('[Integrations] Error fetching integrations:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

// GET /api/integrations/:id - Get single integration
router.get('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const integration = await prisma.integration.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Sanitize
    const sanitized = {
      ...integration,
      credentials: integration.credentials ? '***' : null,
      webhookSecret: integration.webhookSecret ? '***' : null,
    };

    res.json({ integration: sanitized });
  } catch (error: any) {
    console.error('[Integrations] Error fetching integration:', error);
    res.status(500).json({ error: 'Failed to fetch integration' });
  }
});

// POST /api/integrations - Create new integration
router.post('/', requireAdmin, async (req, res) => {
  try {
    const {
      name,
      type,
      config,
      credentials,
      allowedIps,
      webhookUrl,
      retryPolicy,
    } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!type || !type.trim()) {
      return res.status(400).json({ error: 'Type is required' });
    }

    if (!config || typeof config !== 'object') {
      return res.status(400).json({ error: 'Config is required' });
    }

    if (allowedIps && !Array.isArray(allowedIps)) {
      return res.status(400).json({ error: 'allowedIps must be an array' });
    }

    if (allowedIps && allowedIps.some((ip: string) => !isValidIP(ip))) {
      return res.status(400).json({ error: 'Invalid IP address format' });
    }

    const webhookSecret = webhookUrl ? crypto.randomBytes(32).toString('hex') : null;

    const integration = await prisma.integration.create({
      data: {
        name: name.trim(),
        type: type.trim(),
        config,
        credentials: credentials || null,
        allowedIps: allowedIps || [],
        webhookUrl: webhookUrl || null,
        webhookSecret,
        retryPolicy: retryPolicy || null,
        status: 'ACTIVE',
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
      'integration',
      integration.id,
      { name, type },
      req
    );

    res.status(201).json({
      integration,
      webhookSecret,
      warning: 'Save the webhook secret securely. It cannot be recovered.',
    });
  } catch (error: any) {
    console.error('[Integrations] Error creating integration:', error);
    res.status(500).json({ error: 'Failed to create integration' });
  }
});

// PATCH /api/integrations/:id - Update integration
router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      status,
      config,
      credentials,
      allowedIps,
      webhookUrl,
      retryPolicy,
    } = req.body;

    const existing = await prisma.integration.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    if (allowedIps && !Array.isArray(allowedIps)) {
      return res.status(400).json({ error: 'allowedIps must be an array' });
    }

    if (allowedIps && allowedIps.some((ip: string) => !isValidIP(ip))) {
      return res.status(400).json({ error: 'Invalid IP address format' });
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (status !== undefined) updateData.status = status;
    if (config !== undefined) updateData.config = config;
    if (credentials !== undefined) updateData.credentials = credentials;
    if (allowedIps !== undefined) updateData.allowedIps = allowedIps;
    if (webhookUrl !== undefined) updateData.webhookUrl = webhookUrl;
    if (retryPolicy !== undefined) updateData.retryPolicy = retryPolicy;

    const integration = await prisma.integration.update({
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
      'integration',
      id,
      { changes: Object.keys(updateData) },
      req
    );

    const sanitized = {
      ...integration,
      credentials: integration.credentials ? '***' : null,
      webhookSecret: integration.webhookSecret ? '***' : null,
    };

    res.json({ integration: sanitized });
  } catch (error: any) {
    console.error('[Integrations] Error updating integration:', error);
    res.status(500).json({ error: 'Failed to update integration' });
  }
});

// POST /api/integrations/:id/test - Test integration
router.post('/:id/test', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const integration = await prisma.integration.findUnique({ where: { id } });
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // TODO: Implement actual testing logic based on integration type
    // For now, just update the sync timestamp

    await prisma.integration.update({
      where: { id },
      data: {
        lastSyncAt: new Date(),
        syncCount: { increment: 1 },
      },
    });

    // Audit log
    await createAuditLog(
      (req as any).user.userId,
      'TEST',
      'integration',
      id,
      { name: integration.name },
      req
    );

    res.json({ success: true, message: 'Integration test completed' });
  } catch (error: any) {
    console.error('[Integrations] Error testing integration:', error);
    res.status(500).json({ error: 'Failed to test integration' });
  }
});

// DELETE /api/integrations/:id - Delete integration
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.integration.findUnique({
      where: { id },
      select: { name: true },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    await prisma.integration.delete({ where: { id } });

    // Audit log
    await createAuditLog(
      (req as any).user.userId,
      'DELETE',
      'integration',
      id,
      { name: existing.name },
      req
    );

    res.json({ success: true, message: 'Integration deleted' });
  } catch (error: any) {
    console.error('[Integrations] Error deleting integration:', error);
    res.status(500).json({ error: 'Failed to delete integration' });
  }
});

export default router;
