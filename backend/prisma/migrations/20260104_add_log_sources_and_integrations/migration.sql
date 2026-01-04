-- CreateEnum for log source types
CREATE TYPE "LogSourceType" AS ENUM ('API', 'WEBHOOK', 'SYSLOG', 'AGENT', 'CLOUD', 'DATABASE');

-- CreateEnum for integration status
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'FAILED', 'PENDING');

-- CreateTable: LogSource (API keys, webhook endpoints)
CREATE TABLE "LogSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "LogSourceType" NOT NULL DEFAULT 'API',
    "apiKey" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "allowedIps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rateLimit" INTEGER NOT NULL DEFAULT 1000,
    "rateLimitWindow" INTEGER NOT NULL DEFAULT 60,
    "metadata" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),

    CONSTRAINT "LogSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Integration (external service connections)
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "config" JSONB NOT NULL,
    "credentials" JSONB,
    "allowedIps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "webhookUrl" TEXT,
    "webhookSecret" TEXT,
    "retryPolicy" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastErrorMessage" TEXT,
    "syncCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable: LogSourceUsage (track API usage per source)
CREATE TABLE "LogSourceUsage" (
    "id" TEXT NOT NULL,
    "logSourceId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "logsReceived" INTEGER NOT NULL DEFAULT 0,
    "bytesReceived" INTEGER NOT NULL DEFAULT 0,
    "requestsCount" INTEGER NOT NULL DEFAULT 0,
    "errorsCount" INTEGER NOT NULL DEFAULT 0,
    "sourceIp" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "LogSourceUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AuditLog (CISO requirement - track all admin actions)
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "details" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable: AlertRule (SIEM feature - automated alerting)
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "condition" JSONB NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'INFO',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notificationChannels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 5,
    "lastTriggeredAt" TIMESTAMP(3),
    "triggerCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Alert (triggered alerts)
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "logId" TEXT,
    "severity" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "isAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgedById" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LogSource_apiKey_key" ON "LogSource"("apiKey");
CREATE INDEX "LogSource_createdById_idx" ON "LogSource"("createdById");
CREATE INDEX "LogSource_isActive_idx" ON "LogSource"("isActive");
CREATE INDEX "LogSource_type_idx" ON "LogSource"("type");

CREATE INDEX "Integration_createdById_idx" ON "Integration"("createdById");
CREATE INDEX "Integration_status_idx" ON "Integration"("status");
CREATE INDEX "Integration_type_idx" ON "Integration"("type");

CREATE INDEX "LogSourceUsage_logSourceId_timestamp_idx" ON "LogSourceUsage"("logSourceId", "timestamp");
CREATE INDEX "LogSourceUsage_timestamp_idx" ON "LogSourceUsage"("timestamp");

CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_resource_idx" ON "AuditLog"("resource");

CREATE INDEX "AlertRule_createdById_idx" ON "AlertRule"("createdById");
CREATE INDEX "AlertRule_isActive_idx" ON "AlertRule"("isActive");

CREATE INDEX "Alert_ruleId_idx" ON "Alert"("ruleId");
CREATE INDEX "Alert_logId_idx" ON "Alert"("logId");
CREATE INDEX "Alert_isAcknowledged_idx" ON "Alert"("isAcknowledged");
CREATE INDEX "Alert_createdAt_idx" ON "Alert"("createdAt");

-- AddForeignKey
ALTER TABLE "LogSource" ADD CONSTRAINT "LogSource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Integration" ADD CONSTRAINT "Integration_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LogSourceUsage" ADD CONSTRAINT "LogSourceUsage_logSourceId_fkey" FOREIGN KEY ("logSourceId") REFERENCES "LogSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Alert" ADD CONSTRAINT "Alert_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Alert" ADD CONSTRAINT "Alert_logId_fkey" FOREIGN KEY ("logId") REFERENCES "logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Alert" ADD CONSTRAINT "Alert_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
