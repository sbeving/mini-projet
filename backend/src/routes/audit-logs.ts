import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();
const prisma = new PrismaClient();

// GET /api/audit-logs - Get audit logs with filtering
router.get('/', requireAdmin, async (req, res) => {
  try {
    const {
      userId,
      action,
      resource,
      startDate,
      endDate,
      limit = 100,
      offset = 0,
    } = req.query;

    const where: any = {};

    if (userId) where.userId = userId as string;
    if (action) where.action = action as string;
    if (resource) where.resource = resource as string;

    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate as string);
      if (endDate) where.timestamp.lte = new Date(endDate as string);
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { timestamp: 'desc' },
        take: Number(limit),
        skip: Number(offset),
      }),
      prisma.auditLog.count({ where }),
    ]);

    res.json({
      logs,
      pagination: {
        total,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: Number(offset) + Number(limit) < total,
      },
    });
  } catch (error: any) {
    console.error('[AuditLogs] Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

// GET /api/audit-logs/stats - Get audit log statistics
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const since = new Date();
    since.setDate(since.getDate() - Number(days));

    const logs = await prisma.auditLog.findMany({
      where: { timestamp: { gte: since } },
      select: { action: true, resource: true, timestamp: true, userId: true },
    });

    const byAction = logs.reduce((acc: any, log) => {
      acc[log.action] = (acc[log.action] || 0) + 1;
      return acc;
    }, {});

    const byResource = logs.reduce((acc: any, log) => {
      acc[log.resource] = (acc[log.resource] || 0) + 1;
      return acc;
    }, {});

    const byUser = logs.reduce((acc: any, log) => {
      acc[log.userId] = (acc[log.userId] || 0) + 1;
      return acc;
    }, {});

    const topUsers = Object.entries(byUser)
      .sort(([, a]: any, [, b]: any) => b - a)
      .slice(0, 10);

    res.json({
      total: logs.length,
      byAction,
      byResource,
      topUsers,
    });
  } catch (error: any) {
    console.error('[AuditLogs] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch audit log stats' });
  }
});

export default router;
