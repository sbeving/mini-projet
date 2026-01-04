/**
 * Chat Sessions Service
 * Manages persistent chat sessions and messages for users
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../index.js";

interface CreateSessionParams {
  userId: string;
  title?: string;
}

interface AddMessageParams {
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  responseTime?: number;
  tokensUsed?: number;
}

/**
 * Create a new chat session
 */
export async function createChatSession(params: CreateSessionParams) {
  const session = await prisma.chatSession.create({
    data: {
      userId: params.userId,
      title: params.title || "New Chat",
    },
    include: {
      messages: true,
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return session;
}

/**
 * Get a chat session by ID
 */
export async function getChatSession(sessionId: string, userId?: string) {
  const where: Prisma.ChatSessionWhereInput = { id: sessionId };
  if (userId) where.userId = userId;

  const session = await prisma.chatSession.findFirst({
    where,
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
      user: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return session;
}

/**
 * Get all chat sessions for a user
 */
export async function getUserChatSessions(params: {
  userId: string;
  includeArchived?: boolean;
  limit?: number;
  offset?: number;
}) {
  const where: Prisma.ChatSessionWhereInput = {
    userId: params.userId,
  };

  if (!params.includeArchived) {
    where.archived = false;
  }

  const [sessions, total] = await Promise.all([
    prisma.chatSession.findMany({
      where,
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: params.limit || 50,
      skip: params.offset || 0,
    }),
    prisma.chatSession.count({ where }),
  ]);

  return {
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      archived: s.archived,
      messageCount: s._count.messages,
      lastMessage: s.messages[0]?.content?.slice(0, 100),
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
    total,
  };
}

/**
 * Add a message to a chat session
 */
export async function addMessage(params: AddMessageParams) {
  const message = await prisma.chatMessage.create({
    data: {
      sessionId: params.sessionId,
      role: params.role,
      content: params.content,
      responseTime: params.responseTime,
      tokensUsed: params.tokensUsed,
    },
  });

  // Update session's messageCount and updatedAt
  await prisma.chatSession.update({
    where: { id: params.sessionId },
    data: {
      messageCount: { increment: 1 },
      updatedAt: new Date(),
    },
  });

  return message;
}

/**
 * Update chat session title
 */
export async function updateSessionTitle(sessionId: string, title: string) {
  return prisma.chatSession.update({
    where: { id: sessionId },
    data: { title },
  });
}

/**
 * Archive a chat session
 */
export async function archiveSession(sessionId: string, userId?: string) {
  const where: Prisma.ChatSessionWhereUniqueInput = { id: sessionId };
  
  // Verify ownership if userId provided
  if (userId) {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new Error("Session not found or access denied");
  }

  return prisma.chatSession.update({
    where,
    data: { archived: true },
  });
}

/**
 * Delete a chat session
 */
export async function deleteSession(sessionId: string, userId?: string) {
  // Verify ownership if userId provided
  if (userId) {
    const session = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) throw new Error("Session not found or access denied");
  }

  // Delete messages first (cascade)
  await prisma.chatMessage.deleteMany({
    where: { sessionId },
  });

  return prisma.chatSession.delete({
    where: { id: sessionId },
  });
}

/**
 * Get all chat sessions (admin view)
 */
export async function getAllChatSessions(params: {
  userId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}) {
  const where: Prisma.ChatSessionWhereInput = {};

  if (params.userId) {
    where.userId = params.userId;
  }

  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: "insensitive" } },
      { user: { name: { contains: params.search, mode: "insensitive" } } },
      { user: { email: { contains: params.search, mode: "insensitive" } } },
    ];
  }

  const [sessions, total] = await Promise.all([
    prisma.chatSession.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true, role: true },
        },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: params.limit || 50,
      skip: params.offset || 0,
    }),
    prisma.chatSession.count({ where }),
  ]);

  return {
    sessions: sessions.map((s) => ({
      id: s.id,
      title: s.title,
      archived: s.archived,
      messageCount: s._count.messages,
      user: s.user,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    })),
    total,
  };
}

/**
 * Generate a title from first message
 */
export function generateSessionTitle(firstMessage: string): string {
  // Take first 50 chars of message as title
  const truncated = firstMessage.slice(0, 50);
  return truncated.length < firstMessage.length ? `${truncated}...` : truncated;
}

/**
 * Get chat statistics
 */
export async function getChatStats(days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const [totalSessions, totalMessages, avgMessagesPerSession, recentSessions] =
    await Promise.all([
      prisma.chatSession.count(),
      prisma.chatMessage.count(),
      prisma.chatSession.aggregate({
        _avg: { messageCount: true },
      }),
      prisma.chatSession.count({
        where: { createdAt: { gte: startDate } },
      }),
    ]);

  // Messages by role
  const messagesByRole = await prisma.chatMessage.groupBy({
    by: ["role"],
    _count: { role: true },
  });

  // Daily chat activity
  const dailyActivity = await prisma.$queryRaw<
    Array<{ date: Date; sessions: bigint; messages: bigint }>
  >`
    SELECT 
      DATE(cs.created_at) as date,
      COUNT(DISTINCT cs.id) as sessions,
      COUNT(cm.id) as messages
    FROM chat_sessions cs
    LEFT JOIN chat_messages cm ON cm.session_id = cs.id
    WHERE cs.created_at >= ${startDate}
    GROUP BY DATE(cs.created_at)
    ORDER BY date DESC
    LIMIT 30
  `;

  return {
    totalSessions,
    totalMessages,
    avgMessagesPerSession: avgMessagesPerSession._avg.messageCount || 0,
    recentSessions,
    messagesByRole: messagesByRole.map((m) => ({
      role: m.role,
      count: m._count.role,
    })),
    dailyActivity: dailyActivity.map((d) => ({
      date: d.date,
      sessions: Number(d.sessions),
      messages: Number(d.messages),
    })),
  };
}
