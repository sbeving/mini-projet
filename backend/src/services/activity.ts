/**
 * User Activity Tracking Service
 * Tracks user interactions with the platform for analytics
 */

import { ActivityType, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

interface TrackActivityParams {
  userId: string;
  type: ActivityType;
  path?: string;
  duration?: number;
  meta?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Track a user activity
 */
export async function trackActivity(params: TrackActivityParams) {
  try {
    return await prisma.userActivity.create({
      data: {
        userId: params.userId,
        type: params.type,
        path: params.path,
        duration: params.duration,
        meta: params.meta as Prisma.JsonObject,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    console.error("Failed to track activity:", error);
    // Don't throw - activity tracking should never break the app
    return null;
  }
}

/**
 * Get user activities with pagination
 */
export async function getUserActivities(params: {
  userId?: string;
  type?: ActivityType;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}) {
  const where: Prisma.UserActivityWhereInput = {};
  
  if (params.userId) where.userId = params.userId;
  if (params.type) where.type = params.type;
  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) where.createdAt.gte = params.startDate;
    if (params.endDate) where.createdAt.lte = params.endDate;
  }

  const [activities, total] = await Promise.all([
    prisma.userActivity.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: params.limit || 50,
      skip: params.offset || 0,
    }),
    prisma.userActivity.count({ where }),
  ]);

  return { activities, total };
}

/**
 * Get activity summary for a user
 */
export async function getUserActivitySummary(userId: string, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const activities = await prisma.userActivity.groupBy({
    by: ["type"],
    where: {
      userId,
      createdAt: { gte: startDate },
    },
    _count: { type: true },
  });

  // Get total time spent (sum of durations)
  const timeSpent = await prisma.userActivity.aggregate({
    where: {
      userId,
      createdAt: { gte: startDate },
      duration: { not: null },
    },
    _sum: { duration: true },
  });

  // Get session count
  const sessions = await prisma.userActivity.count({
    where: {
      userId,
      type: "LOGIN",
      createdAt: { gte: startDate },
    },
  });

  // Get chat messages count
  const chatMessages = await prisma.chatMessage.count({
    where: {
      session: { userId },
      createdAt: { gte: startDate },
    },
  });

  return {
    activityBreakdown: activities.map((a) => ({
      type: a.type,
      count: a._count.type,
    })),
    totalTimeSpent: timeSpent._sum.duration || 0,
    sessionCount: sessions,
    chatMessageCount: chatMessages,
  };
}

/**
 * Get platform-wide analytics for admin dashboard
 */
export async function getPlatformAnalytics(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Active users (users with any activity)
  const activeUsers = await prisma.userActivity.groupBy({
    by: ["userId"],
    where: { createdAt: { gte: startDate } },
  });

  // New users
  const newUsers = await prisma.user.count({
    where: { createdAt: { gte: startDate } },
  });

  // Total users
  const totalUsers = await prisma.user.count();

  // Chat sessions
  const chatSessions = await prisma.chatSession.count({
    where: { createdAt: { gte: startDate } },
  });

  // Chat messages
  const chatMessages = await prisma.chatMessage.count({
    where: { createdAt: { gte: startDate } },
  });

  // Logs ingested
  const logsIngested = await prisma.log.count({
    where: { createdAt: { gte: startDate } },
  });

  // Activity by type
  const activityByType = await prisma.userActivity.groupBy({
    by: ["type"],
    where: { createdAt: { gte: startDate } },
    _count: { type: true },
  });

  // Daily active users trend
  const dailyStats = await prisma.$queryRaw<
    Array<{ date: Date; users: bigint; activities: bigint }>
  >`
    SELECT 
      DATE(created_at) as date,
      COUNT(DISTINCT user_id) as users,
      COUNT(*) as activities
    FROM user_activities
    WHERE created_at >= ${startDate}
    GROUP BY DATE(created_at)
    ORDER BY date DESC
    LIMIT 30
  `;

  // Top users by activity
  const topUsers = await prisma.userActivity.groupBy({
    by: ["userId"],
    where: { createdAt: { gte: startDate } },
    _count: { userId: true },
    orderBy: { _count: { userId: "desc" } },
    take: 10,
  });

  // Get user details for top users
  const topUserDetails = await prisma.user.findMany({
    where: { id: { in: topUsers.map((u) => u.userId) } },
    select: { id: true, name: true, email: true, role: true, lastLogin: true },
  });

  const topUsersWithDetails = topUsers.map((u) => ({
    ...topUserDetails.find((ud) => ud.id === u.userId),
    activityCount: u._count.userId,
  }));

  return {
    summary: {
      activeUsers: activeUsers.length,
      newUsers,
      totalUsers,
      chatSessions,
      chatMessages,
      logsIngested,
    },
    activityByType: activityByType.map((a) => ({
      type: a.type,
      count: a._count.type,
    })),
    dailyStats: dailyStats.map((d) => ({
      date: d.date,
      users: Number(d.users),
      activities: Number(d.activities),
    })),
    topUsers: topUsersWithDetails,
  };
}

/**
 * Get user engagement metrics
 */
export async function getUserEngagement(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      chatSessions: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          _count: { select: { messages: true } },
        },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      _count: {
        select: {
          chatSessions: true,
          activities: true,
        },
      },
    },
  });

  if (!user) return null;

  // Calculate average session duration
  const sessionDurations = await prisma.userActivity.aggregate({
    where: {
      userId,
      type: { in: ["LOGIN", "LOGOUT"] },
    },
    _avg: { duration: true },
  });

  // Get first activity date
  const firstActivity = await prisma.userActivity.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  // Days since registration
  const daysSinceRegistration = Math.floor(
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    },
    stats: {
      totalChatSessions: user._count.chatSessions,
      totalActivities: user._count.activities,
      daysSinceRegistration,
      avgSessionDuration: sessionDurations._avg.duration || 0,
      firstActivityDate: firstActivity?.createdAt,
    },
    recentChatSessions: user.chatSessions.map((s) => ({
      id: s.id,
      title: s.title,
      messageCount: s._count.messages,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
    recentActivities: user.activities,
  };
}

/**
 * Update daily usage stats (call periodically)
 */
export async function updateDailyStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Calculate today's stats
  const [activeUsers, newUsers, chatSessions, chatMessages, logsIngested, apiCalls] =
    await Promise.all([
      prisma.userActivity.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: today, lt: tomorrow } },
      }),
      prisma.user.count({
        where: { createdAt: { gte: today, lt: tomorrow } },
      }),
      prisma.chatSession.count({
        where: { createdAt: { gte: today, lt: tomorrow } },
      }),
      prisma.chatMessage.count({
        where: { createdAt: { gte: today, lt: tomorrow } },
      }),
      prisma.log.count({
        where: { createdAt: { gte: today, lt: tomorrow } },
      }),
      prisma.userActivity.count({
        where: { createdAt: { gte: today, lt: tomorrow } },
      }),
    ]);

  // Upsert the stats
  await prisma.usageStats.upsert({
    where: { date: today },
    create: {
      date: today,
      activeUsers: activeUsers.length,
      newUsers,
      chatSessions,
      chatMessages,
      logsIngested,
      apiCalls,
    },
    update: {
      activeUsers: activeUsers.length,
      newUsers,
      chatSessions,
      chatMessages,
      logsIngested,
      apiCalls,
    },
  });
}
