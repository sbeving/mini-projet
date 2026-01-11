-- Add allowed domains and hostnames to LogSource
ALTER TABLE "LogSource" ADD COLUMN IF NOT EXISTS "allowedDomains" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "LogSource" ADD COLUMN IF NOT EXISTS "allowedHostnames" TEXT[] DEFAULT ARRAY[]::TEXT[];
