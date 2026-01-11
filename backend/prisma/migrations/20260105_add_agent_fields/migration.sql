-- Add agent management fields to LogSource
ALTER TABLE "LogSource" ADD COLUMN IF NOT EXISTS "environment" TEXT;
ALTER TABLE "LogSource" ADD COLUMN IF NOT EXISTS "config" JSONB;
ALTER TABLE "LogSource" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);
