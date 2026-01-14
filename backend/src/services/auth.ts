/**
 * Authentication Service
 * Handles user authentication, sessions, and authorization
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';

// JWT secret - in production, use a proper secret from environment
const JWT_SECRET = process.env.JWT_SECRET || 'logchat-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '7d';
const SESSION_EXPIRES_HOURS = 168; // 7 days

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
}

export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
  token?: string;
  error?: string;
}

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token
 */
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Verify JWT token
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Register a new user
 */
export async function registerUser(
  email: string,
  password: string,
  name: string,
  role: 'ADMIN' | 'STAFF' | 'USER' = 'USER'
): Promise<AuthResult> {
  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return { success: false, error: 'Email already registered' };
    }

    // Hash password and create user
    const hashedPassword = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
      },
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  } catch (error) {
    console.error('Registration error:', error);
    return { success: false, error: 'Registration failed' };
  }
}

/**
 * Login user and create session
 */
export async function loginUser(
  email: string,
  password: string,
  userAgent?: string,
  ipAddress?: string
): Promise<AuthResult> {
  try {
    // Find user
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Check if active
    if (!user.active) {
      return { success: false, error: 'Account is deactivated' };
    }

    // Verify password
    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Create session
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + SESSION_EXPIRES_HOURS);

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        token: `sess_${crypto.randomUUID()}`,
        expiresAt,
        userAgent,
        ipAddress,
      },
    });

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Generate JWT
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId: session.id,
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Login failed' };
  }
}

/**
 * Logout user (invalidate session)
 */
export async function logoutUser(sessionId: string): Promise<boolean> {
  try {
    await prisma.session.delete({ where: { id: sessionId } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate session from token
 */
export async function validateSession(token: string): Promise<TokenPayload | null> {
  const payload = verifyToken(token);
  if (!payload) return null;

  // Check session exists and not expired
  const session = await prisma.session.findUnique({
    where: { id: payload.sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt < new Date() || !session.user.active) {
    return null;
  }

  return payload;
}

/**
 * Get user by ID
 */
export async function getUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
      lastLogin: true,
    },
  });
}

/**
 * Get all users (admin only)
 */
export async function getAllUsers(options: {
  limit?: number;
  offset?: number;
  role?: string;
  search?: string;
}) {
  const { limit = 50, offset = 0, role, search } = options;

  const where: Record<string, unknown> = {};
  if (role) where.role = role;
  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { name: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        active: true,
        createdAt: true,
        lastLogin: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, total, limit, offset };
}

/**
 * Update user (admin or self)
 */
export async function updateUser(
  id: string,
  data: {
    name?: string;
    email?: string;
    role?: 'ADMIN' | 'STAFF' | 'USER';
    active?: boolean;
    password?: string;
  }
) {
  const updateData: Record<string, unknown> = {};
  if (data.name) updateData.name = data.name;
  if (data.email) updateData.email = data.email;
  if (data.role) updateData.role = data.role;
  if (typeof data.active === 'boolean') updateData.active = data.active;
  if (data.password) updateData.password = await hashPassword(data.password);

  return prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
      lastLogin: true,
    },
  });
}

/**
 * Delete user
 */
export async function deleteUser(id: string): Promise<boolean> {
  try {
    await prisma.user.delete({ where: { id } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Seed default users (for development)
 */
export async function seedDefaultUsers() {
  const defaultUsers = [
    { email: 'admin@logchat.com', password: 'admin123', name: 'Admin User', role: 'ADMIN' as const },
    { email: 'staff@logchat.com', password: 'staff123', name: 'Staff User', role: 'STAFF' as const },
    { email: 'test@logchat.com', password: 'test123', name: 'Test User', role: 'USER' as const },
  ];

  for (const userData of defaultUsers) {
    const exists = await prisma.user.findUnique({ where: { email: userData.email } });
    if (!exists) {
      await registerUser(userData.email, userData.password, userData.name, userData.role);
      console.log(`Created default user: ${userData.email} (${userData.role})`);
    }
  }

  // Ensure default Alert Rules exist for Threat Detection
  const admin = await prisma.user.findUnique({ where: { email: 'admin@logchat.com' } });
  if (admin) {
    const existingRule = await prisma.alertRule.findFirst({ where: { name: 'System Security Rules' } });
    if (!existingRule) {
      await prisma.alertRule.create({
        data: {
          name: 'System Security Rules',
          createdById: admin.id,
          condition: 'Pattern Match',
          type: 'SYSTEM',
          severity: 'HIGH',
          isActive: true,
          config: {
             description: 'Default rules for detecting SQLi, XSS, and Brute Force patterns'
          }
        }
      });
      console.log('Created default System Security Alert Rules');
    }
  }
}

/**
 * Cleanup expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await prisma.session.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
