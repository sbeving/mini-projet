/**
 * Threat Detection Service
 * Real-time pattern matching for security threats
 */

import { Log, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { broadcastAlert } from '../routes/stream.js';

// Threat Categories
export enum ThreatType {
  SQL_INJECTION = 'SQL_INJECTION',
  XSS = 'XSS',
  BRUTE_FORCE = 'BRUTE_FORCE',
  SENSITIVE_DATA = 'SENSITIVE_DATA_EXPOSURE',
  SYSTEM_ANOMALY = 'SYSTEM_ANOMALY',
  SUSPICIOUS_ACCESS = 'SUSPICIOUS_ACCESS'
}

export enum ThreatSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW'
}

interface ThreatPattern {
  type: ThreatType;
  pattern: RegExp;
  severity: ThreatSeverity;
  description: string;
}

// Security Patterns
const PATTERNS: ThreatPattern[] = [
  // SQL Injection
  {
    type: ThreatType.SQL_INJECTION,
    pattern: /(\b(union|select|insert|update|delete|drop|alter)\b\s+.*\b(from|into|table|database)\b)|(--)|(\b(or|and)\b\s+['"]?1['"]?\s*=\s*['"]?1)|(exec\s+(\@|xp_))/i,
    severity: ThreatSeverity.CRITICAL,
    description: "Potential SQL Injection attempt detected"
  },
  // XSS
  {
    type: ThreatType.XSS,
    pattern: /(<script\b[^>]*>)|(javascript:)|(onerror=)|(onload=)|(alert\s*\()|(document\.cookie)/i,
    severity: ThreatSeverity.HIGH,
    description: "Potential Cross-Site Scripting (XSS) detected"
  },
  // Brute Force / Auth Failures
  {
    type: ThreatType.BRUTE_FORCE,
    pattern: /(failed login|invalid credentials|authentication failure|password check failed|bad password|incorrect password|too many attempts)/i,
    severity: ThreatSeverity.MEDIUM,
    description: "Authentication failure or potential brute force"
  },
  // Sensitive Data Leak
  {
    type: ThreatType.SENSITIVE_DATA,
    pattern: /\b(api[_-]?key|access[_-]?token|secret[_-]?key|aws[_-]?access|bearer\s+eyJ)/i,
    severity: ThreatSeverity.HIGH,
    description: "Possible exposure of sensitive API keys or tokens"
  },
  // Suspicious Access
  {
    type: ThreatType.SUSPICIOUS_ACCESS,
    pattern: /(\/etc\/passwd|\/etc\/shadow|\btraversal\b|\.\.\/|\.\.\\)/i,
    severity: ThreatSeverity.HIGH,
    description: "Directory traversal or system file access attempt"
  },
  // Shell Injection
  {
    type: ThreatType.SYSTEM_ANOMALY,
    pattern: /(\b(rm|cp|mv|chmod|chown)\b\s+-\w+)|(\/bin\/sh|\/bin\/bash)|(cmd\.exe)|(powershell)/i,
    severity: ThreatSeverity.CRITICAL,
    description: "Potential shell command injection"
  }
];

/**
 * Scan a log entry for threats
 */
export async function detectThreats(log: Log) {
  const findings: ThreatPattern[] = [];

  // Check common patterns
  for (const p of PATTERNS) {
    if (p.pattern.test(log.message) || p.pattern.test(log.raw)) {
      findings.push(p);
    }
  }

  // If threats found, create alerts
  if (findings.length > 0) {
    console.log(`[ThreatDetection] Found ${findings.length} threats in log ${log.id}`);
    
    for (const finding of findings) {
      await createAlert(log, finding);
    }
  }
}

/**
 * Create an alert in the database and broadcast it
 */
async function createAlert(log: Log, finding: ThreatPattern) {
  try {
    // Check if we have a default "System" alert rule, if not create one placeholder
    // In a real system, we'd match against defined AlertRules. 
    // Here we'll create a system-level alert.
    
    // Find or create a default "Security Rule"
    let rule = await prisma.alertRule.findFirst({
        where: { name: 'System Security Rules' }
    });

    if (!rule) {
        // Fallback: This requires a user ID, which we might not have in this context.
        // We will skip rule linking or try to find a system admin.
        const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
        if (admin) {
             rule = await prisma.alertRule.create({
                data: {
                    name: 'System Security Rules',
                    condition: 'Pattern Match',
                    createdById: admin.id,
                    isActive: true,
                    type: 'SYSTEM',
                    severity: 'HIGH',
                    config: {}
                }
             });
        }
    }

    if (rule) {
        const alert = await prisma.alert.create({
            data: {
                ruleId: rule.id,
                logId: log.id,
                severity: finding.severity,
                message: `${finding.description}: ${finding.type}`,
                details: {
                    pattern: finding.type,
                    matched_text: log.message.substring(0, 50)
                }
            },
            include: {
              rule: true // Include rule for broadcast info if needed
            }
        });

        // Broadcast to Dashboard via SSE
        broadcastAlert(alert);
    } else {
        console.warn("[ThreatDetection] No AlertRule found/created. Skipping database alert.");
    }

  } catch (error) {
    console.error("[ThreatDetection] Failed to create alert:", error);
  }
}
