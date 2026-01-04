/**
 * Chat Sessions API Routes
 * Manages user chat sessions and messages
 */

import { Router, Request, Response } from "express";
import { z } from "zod";
import { authenticate, adminOnly } from "../middleware/auth.js";
import { trackActivity } from "../services/activity.js";
import * as chatService from "../services/chat.js";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Validation schemas
const createSessionSchema = z.object({
  title: z.string().min(1).max(200).optional(),
});

const addMessageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string().min(1),
  responseTime: z.number().optional(),
  tokensUsed: z.number().optional(),
});

const updateTitleSchema = z.object({
  title: z.string().min(1).max(200),
});

/**
 * GET /api/chat-sessions
 * Get current user's chat sessions
 */
router.get("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const includeArchived = req.query.archived === "true";
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await chatService.getUserChatSessions({
      userId,
      includeArchived,
      limit,
      offset,
    });

    res.json(result);
  } catch (error) {
    console.error("Error fetching chat sessions:", error);
    res.status(500).json({ error: "Failed to fetch chat sessions" });
  }
});

/**
 * POST /api/chat-sessions
 * Create a new chat session
 */
router.post("/", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const data = createSessionSchema.parse(req.body);

    const session = await chatService.createChatSession({
      userId,
      title: data.title,
    });

    // Track activity
    await trackActivity({
      userId,
      type: "CHAT_SESSION_START",
      meta: { sessionId: session.id },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json(session);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: error.errors });
      return;
    }
    console.error("Error creating chat session:", error);
    res.status(500).json({ error: "Failed to create chat session" });
  }
});

/**
 * GET /api/chat-sessions/:id
 * Get a specific chat session with messages
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.id;

    // Admin can view any session
    const checkUserId = req.user!.role === "ADMIN" ? undefined : userId;
    const session = await chatService.getChatSession(sessionId, checkUserId);

    if (!session) {
      res.status(404).json({ error: "Chat session not found" });
      return;
    }

    res.json(session);
  } catch (error) {
    console.error("Error fetching chat session:", error);
    res.status(500).json({ error: "Failed to fetch chat session" });
  }
});

/**
 * POST /api/chat-sessions/:id/messages
 * Add a message to a chat session
 */
router.post("/:id/messages", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.id;
    const data = addMessageSchema.parse(req.body);

    // Verify session ownership (unless admin)
    const checkUserId = req.user!.role === "ADMIN" ? undefined : userId;
    const session = await chatService.getChatSession(sessionId, checkUserId);

    if (!session) {
      res.status(404).json({ error: "Chat session not found" });
      return;
    }

    const message = await chatService.addMessage({
      sessionId,
      role: data.role,
      content: data.content,
      responseTime: data.responseTime,
      tokensUsed: data.tokensUsed,
    });

    // Track chat message activity
    await trackActivity({
      userId,
      type: "CHAT_MESSAGE",
      meta: { sessionId, messageId: message.id, role: data.role },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    // Auto-generate title from first user message
    if (session.messageCount === 0 && data.role === "user") {
      const title = chatService.generateSessionTitle(data.content);
      await chatService.updateSessionTitle(sessionId, title);
    }

    res.status(201).json(message);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: error.errors });
      return;
    }
    console.error("Error adding message:", error);
    res.status(500).json({ error: "Failed to add message" });
  }
});

/**
 * PATCH /api/chat-sessions/:id
 * Update chat session title
 */
router.patch("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.id;
    const data = updateTitleSchema.parse(req.body);

    // Verify session ownership (unless admin)
    const checkUserId = req.user!.role === "ADMIN" ? undefined : userId;
    const session = await chatService.getChatSession(sessionId, checkUserId);

    if (!session) {
      res.status(404).json({ error: "Chat session not found" });
      return;
    }

    const updated = await chatService.updateSessionTitle(sessionId, data.title);
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid input", details: error.errors });
      return;
    }
    console.error("Error updating chat session:", error);
    res.status(500).json({ error: "Failed to update chat session" });
  }
});

/**
 * POST /api/chat-sessions/:id/archive
 * Archive a chat session
 */
router.post("/:id/archive", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.id;

    const checkUserId = req.user!.role === "ADMIN" ? undefined : userId;
    const session = await chatService.archiveSession(sessionId, checkUserId);

    res.json(session);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("not found")) {
      res.status(404).json({ error: "Chat session not found" });
      return;
    }
    console.error("Error archiving chat session:", error);
    res.status(500).json({ error: "Failed to archive chat session" });
  }
});

/**
 * DELETE /api/chat-sessions/:id
 * Delete a chat session
 */
router.delete("/:id", async (req: Request, res: Response) => {
  try {
    const userId = req.user!.userId;
    const sessionId = req.params.id;

    const checkUserId = req.user!.role === "ADMIN" ? undefined : userId;
    await chatService.deleteSession(sessionId, checkUserId);

    // Track session end
    await trackActivity({
      userId,
      type: "CHAT_SESSION_END",
      meta: { sessionId, deleted: true },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(204).send();
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("not found")) {
      res.status(404).json({ error: "Chat session not found" });
      return;
    }
    console.error("Error deleting chat session:", error);
    res.status(500).json({ error: "Failed to delete chat session" });
  }
});

// ========== Admin Routes ==========

/**
 * GET /api/chat-sessions/admin/all
 * Get all chat sessions (admin only)
 */
router.get("/admin/all", adminOnly, async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await chatService.getAllChatSessions({
      userId,
      search,
      limit,
      offset,
    });

    res.json(result);
  } catch (error) {
    console.error("Error fetching all chat sessions:", error);
    res.status(500).json({ error: "Failed to fetch chat sessions" });
  }
});

/**
 * GET /api/chat-sessions/admin/stats
 * Get chat statistics (admin only)
 */
router.get("/admin/stats", adminOnly, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const stats = await chatService.getChatStats(days);
    res.json(stats);
  } catch (error) {
    console.error("Error fetching chat stats:", error);
    res.status(500).json({ error: "Failed to fetch chat statistics" });
  }
});

export default router;
