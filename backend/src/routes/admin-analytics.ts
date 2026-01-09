/**
 * Admin Analytics API Routes
 * Provides comprehensive platform analytics for administrators
 */

import { Router, Request, Response } from "express";
import { adminOnly, staffOrAdmin, authenticate } from "../middleware/auth.js";
import * as activityService from "../services/activity.js";
import * as chatService from "../services/chat.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

/**
 * POST /api/admin/analytics/track
 * Track user activity (called from frontend)
 */
router.post("/track", authenticate, async (req: Request, res: Response) => {
  try {
    const { type, path, duration, meta } = req.body;
    const userId = req.user?.userId;

    if (!userId || !type) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Get user agent and IP from request
    const userAgent = req.get("User-Agent") || "";
    const ipAddress = req.ip || req.socket.remoteAddress || "";

    await activityService.trackActivity({
      userId,
      type,
      path,
      duration,
      meta,
      ipAddress,
      userAgent,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Error tracking activity:", error);
    res.status(500).json({ error: "Failed to track activity" });
  }
});

/**
 * GET /api/admin/analytics/overview
 * Get platform overview analytics
 */
router.get("/overview", staffOrAdmin, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const analytics = await activityService.getPlatformAnalytics(days);

    res.json(analytics);
  } catch (error) {
    console.error("Error fetching platform analytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

/**
 * GET /api/admin/analytics/users
 * Get user analytics
 */
router.get("/users", staffOrAdmin, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // User growth
    const userGrowth = await prisma.$queryRaw<
      Array<{ date: Date; count: bigint; cumulative: bigint }>
    >`
      WITH daily_users AS (
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM users
        WHERE created_at >= ${startDate}
        GROUP BY DATE(created_at)
      )
      SELECT 
        date,
        count,
        SUM(count) OVER (ORDER BY date) as cumulative
      FROM daily_users
      ORDER BY date
    `;

    // Users by role
    const usersByRole = await prisma.user.groupBy({
      by: ["role"],
      _count: { role: true },
    });

    // Active vs inactive users (active = activity in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeUserIds = await prisma.userActivity.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: sevenDaysAgo } },
    });

    const totalUsers = await prisma.user.count();

    // Average session duration
    const avgDuration = await prisma.userActivity.aggregate({
      where: {
        duration: { not: null },
        createdAt: { gte: startDate },
      },
      _avg: { duration: true },
    });

    // Top active users
    const topActiveUsers = await prisma.userActivity.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: startDate } },
      _count: { userId: true },
      orderBy: { _count: { userId: "desc" } },
      take: 10,
    });

    const topUserDetails = await prisma.user.findMany({
      where: { id: { in: topActiveUsers.map((u) => u.userId) } },
      select: { id: true, name: true, email: true, role: true, lastLogin: true },
    });

    res.json({
      userGrowth: userGrowth.map((u) => ({
        date: u.date,
        count: Number(u.count),
        cumulative: Number(u.cumulative),
      })),
      usersByRole: usersByRole.map((r) => ({
        role: r.role,
        count: r._count.role,
      })),
      activeUsers: activeUserIds.length,
      inactiveUsers: totalUsers - activeUserIds.length,
      totalUsers,
      avgSessionDuration: Math.round(avgDuration._avg.duration || 0),
      topActiveUsers: topActiveUsers.map((u) => ({
        ...topUserDetails.find((ud) => ud.id === u.userId),
        activityCount: u._count.userId,
      })),
    });
  } catch (error) {
    console.error("Error fetching user analytics:", error);
    res.status(500).json({ error: "Failed to fetch user analytics" });
  }
});

/**
 * GET /api/admin/analytics/activity
 * Get activity analytics
 */
router.get("/activity", staffOrAdmin, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Activity by type
    const activityByType = await prisma.userActivity.groupBy({
      by: ["type"],
      where: { createdAt: { gte: startDate } },
      _count: { type: true },
    });

    // Activity by hour (for heatmap)
    const activityByHour = await prisma.$queryRaw<
      Array<{ hour: number; count: bigint }>
    >`
      SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
      FROM user_activities
      WHERE created_at >= ${startDate}
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `;

    // Activity by day of week
    const activityByDayOfWeek = await prisma.$queryRaw<
      Array<{ dow: number; count: bigint }>
    >`
      SELECT EXTRACT(DOW FROM created_at) as dow, COUNT(*) as count
      FROM user_activities
      WHERE created_at >= ${startDate}
      GROUP BY EXTRACT(DOW FROM created_at)
      ORDER BY dow
    `;

    // Daily activity trend
    const dailyActivity = await prisma.$queryRaw<
      Array<{ date: Date; count: bigint }>
    >`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM user_activities
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date
    `;

    // Recent activities
    const recentActivities = await prisma.userActivity.findMany({
      where: { createdAt: { gte: startDate } },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json({
      activityByType: activityByType.map((a) => ({
        type: a.type,
        count: a._count.type,
      })),
      activityByHour: activityByHour.map((h) => ({
        hour: Number(h.hour),
        count: Number(h.count),
      })),
      activityByDayOfWeek: activityByDayOfWeek.map((d) => ({
        dayOfWeek: Number(d.dow),
        count: Number(d.count),
      })),
      dailyActivity: dailyActivity.map((d) => ({
        date: d.date,
        count: Number(d.count),
      })),
      recentActivities,
    });
  } catch (error) {
    console.error("Error fetching activity analytics:", error);
    res.status(500).json({ error: "Failed to fetch activity analytics" });
  }
});

/**
 * GET /api/admin/analytics/chats
 * Get chat analytics
 */
router.get("/chats", staffOrAdmin, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const stats = await chatService.getChatStats(days);

    // Additional metrics
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Average response time
    const avgResponseTime = await prisma.chatMessage.aggregate({
      where: {
        role: "assistant",
        responseTime: { not: null },
        createdAt: { gte: startDate },
      },
      _avg: { responseTime: true },
    });

    // Total tokens used
    const totalTokens = await prisma.chatMessage.aggregate({
      where: {
        tokensUsed: { not: null },
        createdAt: { gte: startDate },
      },
      _sum: { tokensUsed: true },
    });

    // Top chatters
    const topChatters = await prisma.chatSession.groupBy({
      by: ["userId"],
      where: { createdAt: { gte: startDate } },
      _count: { userId: true },
      _sum: { messageCount: true },
      orderBy: { _count: { userId: "desc" } },
      take: 10,
    });

    const topChatterDetails = await prisma.user.findMany({
      where: { id: { in: topChatters.map((c) => c.userId) } },
      select: { id: true, name: true, email: true },
    });

    res.json({
      ...stats,
      avgResponseTime: Math.round(avgResponseTime._avg.responseTime || 0),
      totalTokensUsed: totalTokens._sum.tokensUsed || 0,
      topChatters: topChatters.map((c) => ({
        ...topChatterDetails.find((u) => u.id === c.userId),
        sessionCount: c._count.userId,
        totalMessages: c._sum.messageCount || 0,
      })),
    });
  } catch (error) {
    console.error("Error fetching chat analytics:", error);
    res.status(500).json({ error: "Failed to fetch chat analytics" });
  }
});

/**
 * GET /api/admin/analytics/user/:userId
 * Get detailed analytics for a specific user
 */
router.get("/user/:userId", adminOnly, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const engagement = await activityService.getUserEngagement(userId);

    if (!engagement) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Additional user-specific metrics
    const days = parseInt(req.query.days as string) || 30;
    const summary = await activityService.getUserActivitySummary(userId, days);

    res.json({
      ...engagement,
      activitySummary: summary,
    });
  } catch (error) {
    console.error("Error fetching user analytics:", error);
    res.status(500).json({ error: "Failed to fetch user analytics" });
  }
});

/**
 * GET /api/admin/analytics/logs
 * Get log ingestion analytics
 */
router.get("/logs", staffOrAdmin, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Logs by level
    const logsByLevel = await prisma.log.groupBy({
      by: ["level"],
      _count: { level: true },
    });

    // Logs by service
    const logsByService = await prisma.log.groupBy({
      by: ["service"],
      _count: { service: true },
      orderBy: { _count: { service: "desc" } },
      take: 10,
    });

    // Daily log ingestion
    const dailyLogs = await prisma.$queryRaw<
      Array<{ date: Date; count: bigint }>
    >`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM logs
      WHERE created_at >= ${startDate}
      GROUP BY DATE(created_at)
      ORDER BY date
    `;

    // Total logs
    const totalLogs = await prisma.log.count();

    // Recent error rate
    const recentErrors = await prisma.log.count({
      where: {
        level: "error",
        createdAt: { gte: startDate },
      },
    });

    const recentTotal = await prisma.log.count({
      where: { createdAt: { gte: startDate } },
    });

    res.json({
      totalLogs,
      logsByLevel: logsByLevel.map((l) => ({
        level: l.level,
        count: l._count.level,
      })),
      logsByService: logsByService.map((s) => ({
        service: s.service,
        count: s._count.service,
      })),
      dailyLogs: dailyLogs.map((d) => ({
        date: d.date,
        count: Number(d.count),
      })),
      errorRate: recentTotal > 0 ? ((recentErrors / recentTotal) * 100).toFixed(2) : 0,
    });
  } catch (error) {
    console.error("Error fetching log analytics:", error);
    res.status(500).json({ error: "Failed to fetch log analytics" });
  }
});

/**
 * POST /api/admin/analytics/export
 * Export analytics data
 */
router.post("/export", adminOnly, async (req: Request, res: Response) => {
  try {
    const { type, days = 30 } = req.body;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let data: unknown;

    switch (type) {
      case "users":
        data = await prisma.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
            lastLogin: true,
            _count: { select: { chatSessions: true, activities: true } },
          },
        });
        break;

      case "activities":
        data = await prisma.userActivity.findMany({
          where: { createdAt: { gte: startDate } },
          include: {
            user: { select: { name: true, email: true } },
          },
        });
        break;

      case "chats":
        data = await prisma.chatSession.findMany({
          where: { createdAt: { gte: startDate } },
          include: {
            user: { select: { name: true, email: true } },
            _count: { select: { messages: true } },
          },
        });
        break;

      default:
        res.status(400).json({ error: "Invalid export type" });
        return;
    }

    res.json({
      type,
      exportedAt: new Date(),
      recordCount: Array.isArray(data) ? data.length : 0,
      data,
    });
  } catch (error) {
    console.error("Error exporting analytics:", error);
    res.status(500).json({ error: "Failed to export data" });
  }
});

export default router;
