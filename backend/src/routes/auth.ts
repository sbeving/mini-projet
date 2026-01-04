/**
 * Auth Routes
 * API endpoints for authentication and user management
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { adminOnly, authenticate, authorize } from '../middleware/auth.js';
import {
  deleteUser,
  getAllUsers,
  getUserById,
  loginUser,
  logoutUser,
  registerUser,
  updateUser,
} from '../services/auth.js';

const router = Router();

// Validation schemas
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(2),
  role: z.enum(['ADMIN', 'STAFF', 'USER']).optional(),
});

const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  role: z.enum(['ADMIN', 'STAFF', 'USER']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

const querySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
  role: z.string().optional(),
  search: z.string().optional(),
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    
    const result = await loginUser(
      email,
      password,
      req.headers['user-agent'],
      req.ip
    );

    if (!result.success) {
      res.status(401).json(result);
      return;
    }

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: error.errors,
      });
      return;
    }
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed' });
  }
});

/**
 * POST /api/auth/register
 * Register a new user (admin only, or public for first user)
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = registerSchema.parse(req.body);
    
    // Only admins can set roles other than USER
    // For now, allow registration with specified role (can be restricted later)
    const result = await registerUser(email, password, name, role);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: error.errors,
      });
      return;
    }
    console.error('Register error:', error);
    res.status(500).json({ success: false, error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/logout
 * Logout and invalidate session
 */
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    if (req.user) {
      await logoutUser(req.user.sessionId);
    }
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, error: 'Logout failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const user = await getUserById(req.user.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

/**
 * PUT /api/auth/me
 * Update current user (self)
 */
router.put('/me', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }

    const data = updateUserSchema.parse(req.body);
    
    // Users can't change their own role or active status
    delete data.role;
    delete data.active;

    const user = await updateUser(req.user.userId, data);
    res.json({ success: true, user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: error.errors,
      });
      return;
    }
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

// ==================== Admin Routes ====================

/**
 * GET /api/auth/users
 * Get all users (admin only)
 */
router.get('/users', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const query = querySchema.parse(req.query);
    const result = await getAllUsers(query);
    res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid query',
        details: error.errors,
      });
      return;
    }
    console.error('Get users error:', error);
    res.status(500).json({ success: false, error: 'Failed to get users' });
  }
});

/**
 * GET /api/auth/users/:id
 * Get user by ID (admin only)
 */
router.get('/users/:id', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, error: 'Failed to get user' });
  }
});

/**
 * PUT /api/auth/users/:id
 * Update user (admin only)
 */
router.put('/users/:id', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const data = updateUserSchema.parse(req.body);
    const user = await updateUser(req.params.id, data);
    res.json({ success: true, user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: error.errors,
      });
      return;
    }
    console.error('Update user error:', error);
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

/**
 * DELETE /api/auth/users/:id
 * Delete user (admin only)
 */
router.delete('/users/:id', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    // Prevent self-deletion
    if (req.user && req.params.id === req.user.userId) {
      res.status(400).json({ success: false, error: 'Cannot delete yourself' });
      return;
    }

    const success = await deleteUser(req.params.id);
    if (!success) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user' });
  }
});

/**
 * POST /api/auth/users
 * Create user (admin only)
 */
router.post('/users', authenticate, adminOnly, async (req: Request, res: Response) => {
  try {
    const { email, password, name, role } = registerSchema.parse(req.body);
    const result = await registerUser(email, password, name, role);

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid input',
        details: error.errors,
      });
      return;
    }
    console.error('Create user error:', error);
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

export default router;
