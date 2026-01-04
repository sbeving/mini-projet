/**
 * Authentication Middleware
 * Protect routes with JWT authentication and role-based access
 */

import { NextFunction, Request, Response } from 'express';
import { TokenPayload, validateSession } from '../services/auth.js';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * Extract token from Authorization header
 */
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}

/**
 * Authentication middleware
 * Validates JWT token and adds user info to request
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  validateSession(token)
    .then((payload) => {
      if (!payload) {
        res.status(401).json({ success: false, error: 'Invalid or expired token' });
        return;
      }

      req.user = payload;
      next();
    })
    .catch((error) => {
      console.error('Auth middleware error:', error);
      res.status(500).json({ success: false, error: 'Authentication error' });
    });
}

/**
 * Optional authentication middleware
 * Adds user info if token present, but doesn't require it
 */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (!token) {
    next();
    return;
  }

  validateSession(token)
    .then((payload) => {
      if (payload) {
        req.user = payload;
      }
      next();
    })
    .catch(() => {
      next();
    });
}

/**
 * Role-based authorization middleware
 * Requires authentication first, then checks role
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Admin-only middleware shorthand
 * Combines authentication + authorization for admin role
 */
export function adminOnly(req: Request, res: Response, next: NextFunction) {
  // First authenticate
  authenticate(req, res, () => {
    // Then authorize
    return authorize('ADMIN')(req, res, next);
  });
}

/**
 * Staff or Admin middleware shorthand
 * Combines authentication + authorization for staff/admin roles
 */
export function staffOrAdmin(req: Request, res: Response, next: NextFunction) {
  // First authenticate
  authenticate(req, res, () => {
    // Then authorize
    return authorize('ADMIN', 'STAFF')(req, res, next);
  });
}

/**
 * Require admin role (simpler version for direct use)
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);

  if (!token) {
    res.status(401).json({ success: false, error: 'Authentication required' });
    return;
  }

  validateSession(token)
    .then((payload) => {
      if (!payload) {
        res.status(401).json({ success: false, error: 'Invalid or expired token' });
        return;
      }

      if (payload.role !== 'ADMIN') {
        res.status(403).json({ success: false, error: 'Admin access required' });
        return;
      }

      req.user = payload;
      next();
    })
    .catch((error) => {
      console.error('Auth middleware error:', error);
      res.status(500).json({ success: false, error: 'Authentication error' });
    });
}
