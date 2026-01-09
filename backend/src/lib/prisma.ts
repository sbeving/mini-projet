/**
 * Prisma Client Singleton
 * Exported from a separate module to avoid circular dependencies
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
});
