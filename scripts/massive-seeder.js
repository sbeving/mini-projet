/**
 * Massive Log Seeder for LogChat
 * 
 * Generates high-volume realistic traffic for 50+ services including:
 * - DBs (Postgres, PGVector, NoSQL)
 * - Infrastructure (Cloud, File, Mail Servers)
 * - Security (SSH, Auth, Bruteforce)
 * 
 * Usage: logchat-agent mechanism simulation
 * Key: ls_5462e3b66cd403859176aab2b5303f0b9f4705f6125b1d25ed4353fe1ef3d6f7
 */

const http = require('http');

// Configuration
const CONFIG = {
  apiUrl: process.env.API_URL || 'http://localhost:3001/api/logs',
  apiKey: 'ls_5462e3b66cd403859176aab2b5303f0b9f4705f6125b1d25ed4353fe1ef3d6f7',
  batchSize: 50,         // Logs per batch
  intervalMs: 1000,       // Interval between batches
  servicesCount: 50      // Total simulated services
};

// ------------------------------------------------------------------
// DATA GENERATORS
// ------------------------------------------------------------------

const LOG_LEVELS = ['INFO', 'INFO', 'INFO', 'INFO', 'WARN', 'WARN', 'ERROR', 'FATAL'];

const SERVICES = [
  // Databases (10)
  'pgvector-primary', 'pgvector-replica-01', 'pgvector-replica-02',
  'postgres-main', 'postgres-analytics',
  'mongo-shard-01', 'mongo-shard-02', 'mongo-config',
  'redis-cache-main', 'redis-session-store',
  'cassandra-node-01', 'cassandra-node-02',
  'elasticsearch-master', 'elasticsearch-data-01',
  
  // Cloud & Infra (12)
  'aws-ec2-scaler', 'aws-lambda-invoker', 'aws-cloudwatch-agent',
  'k8s-controller-manager', 'k8s-scheduler', 'k8s-api-server',
  'nginx-ingress-01', 'nginx-ingress-02', 'haproxy-lb',
  'docker-daemon-prod', 'containerd-worker', 'podman-host',
  
  // File & Storage (6)
  's3-bucket-monitor', 'nfs-server-01', 'nfs-server-02',
  'glusterfs-node', 'minio-gateway', 'ceph-osd-01',
  'backup-coordinator', 'datasync-service',

  // Mail & Messaging (8)
  'smtp-relay-01', 'smtp-relay-02', 'postfix-main',
  'dovecot-imap', 'sendgrid-webhook',
  'rabbitmq-cluster', 'kafka-broker-01', 'kafka-broker-02',
  
  // Security & Auth (10) - SSH, VPN, Auth
  'sshd-bastion-01', 'sshd-bastion-02', 'sshd-jumpbox',
  'auth-service', 'keycloak-identity', 'oauth2-proxy',
  'vpn-gateway-east', 'vpn-gateway-west',
  'firewall-edge-01', 'waf-cloudflare',
  
  // Network & Monitoring (8)
  'snmp-collector', 'snmp-trap-receiver', 
  'prometheus-server', 'grafana-alertmanager',
  'zabbix-agent', 'nagios-core',
  'dns-resolver-01', 'dhcp-server',
  
  // Application Services (12)
  'payment-processor', 'inventory-api', 'order-service',
  'notification-worker', 'analytics-engine', 'search-indexer',
  'user-profile-svc', 'billing-job', 'audit-logger',
  'feature-flag-svc', 'report-generator', 'image-resizer',
  'email-sender', 'sms-gateway', 'push-notifier'
];

// Threat patterns that will trigger the detection engine
const THREAT_PATTERNS = [
  // SQL Injection attempts
  "SQL Error: SELECT * FROM users WHERE id=1 UNION SELECT password,email FROM admin_users",
  "Query failed: ' OR '1'='1' -- detected in input validation",
  "Database error: DROP TABLE sessions; -- attempted SQL injection blocked",
  "Suspicious query: SELECT * FROM users WHERE username='' OR 1=1--'",
  
  // XSS attempts
  "Input sanitization failed: <script>alert('XSS')</script> detected in form field",
  "Blocked XSS payload: javascript:document.cookie in URL parameter",
  "Malicious input blocked: <img src=x onerror=alert('hacked')>",
  
  // Brute Force SSH
  "Failed password for root from 185.220.101.45 port 44221 ssh2",
  "Failed password for invalid user admin from 192.168.1.142 port 4422 ssh2",
  "Disconnecting: Too many authentication failures for root [preauth]",
  "PAM: Authentication failure for illegal user test from 45.33.22.11",
  "Maximum authentication attempts exceeded for user ubuntu from 203.0.113.55",
  
  // Sensitive Data Exposure
  "Warning: API_KEY=sk-proj-abc123 found in application logs",
  "Credential leak detected: aws_access_key_id exposed in stack trace",
  "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 token logged in plaintext",
  
  // Path Traversal
  "Blocked request: GET /../../etc/passwd attempted directory traversal",
  "Security violation: Path traversal attempt ../../../etc/shadow blocked"
];

const SCENARIOS = {
  database: [
    "Slow query detected: SELECT * FROM vector_embeddings WHERE distance < 0.5 (2400ms)",
    "Connection pool exhaustion: active=500, idle=0, waiting=150",
    "Deadlock detected in transaction 0x445522 awaiting lock on relation 1234",
    "Checkpoint complete: wrote 409 buffers (2.4%)",
    "Autovacuum: VACUUM public.users (to prevent wraparound)",
    "PGVector: Index build started for ivfflat index on 'embedding'",
    "Replication lag exceeded threshold: 250ms behind primary",
    "Query execution plan changed: sequential scan on large table",
    "Index corruption detected, initiating automatic repair",
    "MongoDB: Shard rebalancing in progress, 15% complete"
  ],
  security: [
    // SSH Logon/Logoff
    "Accepted publickey for ubuntu from 10.0.0.5 port 54322 ssh2: RSA SHA256:abc123",
    "session opened for user devops by (uid=0)",
    "session closed for user devops",
    "Accepted password for admin from 192.168.1.10 port 22 ssh2",
    "Received disconnect from 10.0.0.5 port 54322:11: disconnected by user",
    // Brute Force
    "Failed password for root from 185.220.101.45 port 44221 ssh2",
    "Failed password for invalid user admin from 192.168.1.142 port 4422 ssh2",
    "Disconnecting: Too many authentication failures for root [preauth]",
    "Bruteforce attempt detected: 50 failed logins in 1 minute from 45.33.22.11",
    "PAM: Authentication failure for illegal user test from 185.220.101.45",
    // Auth
    "Sudo command execution: rm -rf /tmp/cache by user devops",
    "Certificate validation failed: self signed certificate in certificate chain",
    "API Key validation failed: expired token detected",
    "OAuth2 token refresh succeeded for client_id=web-app",
    "JWT token expired for user user@example.com, forcing re-authentication"
  ],
  network: [
    "Interface eth0: link down",
    "Interface eth0: link up, 10Gbps full duplex",
    "SNMP Trap: High Packet Loss (15%) on switch-core-01",
    "SNMP GET: sysUpTime.0 = 45 days 3:22:15.00",
    "SNMP Trap: Port Gi0/24 operational status changed to DOWN",
    "SNMP Walk completed: 1542 OIDs retrieved from router-edge-01",
    "DNS resolution failed for service.internal: NXDOMAIN",
    "Connection timed out connecting to payment-gateway:443",
    "Rate limit exceeded: 429 Too Many Requests (Token Bucket empty)",
    "Load Balancer: 502 Bad Gateway from upstream 10.0.2.55",
    "Firewall: DROP input packet from 185.220.101.45 on port 22",
    "BGP peer 192.168.100.1 state changed from Established to Idle"
  ],
  mail: [
    "postfix/smtpd: connect from mail-server.example.com[10.0.0.50]",
    "postfix/smtpd: disconnect from mail-server.example.com[10.0.0.50]",
    "postfix/cleanup: message-id=<20260114.XYZ@logchat.io>",
    "postfix/qmgr: message accepted: from=<noreply@logchat.io>, size=4521",
    "postfix/smtp: delivered to <user@example.com>, relay=mail.example.com[93.184.216.34]:25",
    "spf-check: pass (IP 10.0.0.50 is designated sender for logchat.io)",
    "spf-check: fail (IP 185.220.101.45 is not designated to send for domain.com)",
    "dkim-filter: DKIM-Signature verification successful",
    "Queue high: 5000 messages pending delivery",
    "Bounce: 550 5.1.1 User unknown <invalid@example.com>"
  ],
  system: [
    "Out of memory: Kill process 1234 (node) score 950 or sacrifice child",
    "Disk usage warning: /var/log is 85% full",
    "Disk usage critical: /data is 95% full, immediate action required",
    "High CPU load average: 15.54, 12.33, 8.44",
    "CPU temperature warning: Core 0 at 85°C",
    "Systemd: Started Docker Application Container Engine.",
    "Systemd: Failed to start Docker Application Container Engine.",
    "Cron job 'backup-daily' completed successfully",
    "Cron job 'log-rotate' failed with exit code 1",
    "Container health check passed: logchat-backend (healthy)",
    "Container restart: logchat-worker exceeded restart limit"
  ],
  snmp: [
    "SNMP Trap received: linkDown on interface Gi0/1 from 10.0.1.1",
    "SNMP Trap received: linkUp on interface Gi0/1 from 10.0.1.1",
    "SNMP Trap: authenticationFailure from 192.168.1.100",
    "SNMP Trap: coldStart from switch-access-01 (10.0.2.50)",
    "SNMP Poll: CPU utilization 78% on router-core-01",
    "SNMP Poll: Memory usage 4.2GB/8GB on firewall-edge-01",
    "SNMP Set: sysContact.0 updated on 10.0.1.1",
    "SNMP Trap: High temperature (65°C) on switch-dc-01"
  ]
};

// ------------------------------------------------------------------
// HELPER FUNCTIONS
// ------------------------------------------------------------------

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateLog() {
  const service = randomItem(SERVICES);
  const now = new Date();
  
  // 10% chance to inject a threat pattern for demo
  if (Math.random() < 0.10) {
    return {
      timestamp: now.toISOString(),
      level: randomItem(['ERROR', 'WARN', 'FATAL']),
      service: randomItem(['auth-service', 'sshd-bastion-01', 'waf-cloudflare', 'firewall-edge-01', 'payment-processor']),
      message: randomItem(THREAT_PATTERNS),
      meta: {
        pid: Math.floor(Math.random() * 65000),
        host: `ip-10-0-${Math.floor(Math.random() * 255)}-${Math.floor(Math.random() * 255)}`,
        source: 'massive-seeder-script',
        threat: true
      }
    };
  }
  
  // Categorize service to pick appropriate scenario
  let category = 'system';
  if (service.includes('pg') || service.includes('mongo') || service.includes('redis') || service.includes('sql') || service.includes('vector') || service.includes('cassandra') || service.includes('elastic')) category = 'database';
  else if (service.includes('ssh') || service.includes('auth') || service.includes('vpn') || service.includes('keycloak') || service.includes('bastion') || service.includes('firewall') || service.includes('waf') || service.includes('oauth')) category = 'security';
  else if (service.includes('smtp') || service.includes('mail') || service.includes('postfix') || service.includes('dovecot') || service.includes('sendgrid')) category = 'mail';
  else if (service.includes('ingress') || service.includes('haproxy') || service.includes('dns') || service.includes('dhcp')) category = 'network';
  else if (service.includes('snmp') || service.includes('zabbix') || service.includes('nagios') || service.includes('prometheus')) category = 'snmp';
  
  const messageTemplate = randomItem(SCENARIOS[category]);
  const level = randomItem(LOG_LEVELS);
  
  return {
    timestamp: now.toISOString(),
    level: level,
    service: service,
    message: messageTemplate,
    meta: {
      pid: Math.floor(Math.random() * 65000),
      host: `ip-10-0-${Math.floor(Math.random() * 255)}-${Math.floor(Math.random() * 255)}`,
      source: 'massive-seeder-script'
    }
  };
}

// ------------------------------------------------------------------
// API CLIENT
// ------------------------------------------------------------------

async function sendBatch(logs) {
  const data = JSON.stringify(logs);
  
  // Use native fetch (Node 18+) or fallback to http/https module if needed
  // Since environment is uncertain, using standard http request for max compatibility
  
  return new Promise((resolve, reject) => {
    const url = new URL(CONFIG.apiUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'X-API-Key': CONFIG.apiKey
      }
    };

    const req = http.request(options, (res) => {
        let responseBody = '';
        res.on('data', (chunk) => responseBody += chunk);
        res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve({ status: res.statusCode });
            } else {
                reject(new Error(`HTTP ${res.statusCode}: ${responseBody}`));
            }
        });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

// ------------------------------------------------------------------
// MAIN LOOP
// ------------------------------------------------------------------

async function main() {
  console.log(`🚀 Starting Massive Log Seeder`);
  console.log(`TARGET: ${CONFIG.apiUrl}`);
  console.log(`KEY: ${CONFIG.apiKey.substring(0, 10)}...`);
  console.log(`SERVICES: ${SERVICES.length}`);
  console.log(`-----------------------------------`);

  let totalSent = 0;
  let batches = 0;

  // Infinite loop
  while (true) {
    const batch = [];
    for (let i = 0; i < CONFIG.batchSize; i++) {
      batch.push(generateLog());
    }

    try {
      // If endpoint accepts batch, send batch. 
      // If standard endpoint only accepts single, we send first one (or adapt script).
      // Assuming /api/logs/batch exists based on standard patterns, or using simple loop.
      // Based on previous file read, /api/logs accepts single. /api/logs/batch accepts array.
      // Let's try /batch first, if 404, fallback to single?
      // Actually backend/src/logs.ts had POST / and POST /batch.
      
      const batchUrl = CONFIG.apiUrl.endsWith('/batch') ? CONFIG.apiUrl : `${CONFIG.apiUrl}/batch`;
      
      // Override URL for batch
      const url = new URL(batchUrl);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': CONFIG.apiKey
        }
      };
      
      const req = http.request(options, (res) => {
         // simple fire and forget logging
         if (res.statusCode === 201) {
             process.stdout.write('.');
         } else {
             process.stdout.write('!');
         }
      });
      req.write(JSON.stringify(batch));
      req.end();

      totalSent += CONFIG.batchSize;
      batches++;

      if (batches % 20 === 0) {
        console.log(`\n[${new Date().toLocaleTimeString()}] Sent ${totalSent} logs total...`);
      }

    } catch (e) {
      console.error(`Error: ${e.message}`);
    }

    // Wait for interval
    await new Promise(r => setTimeout(r, CONFIG.intervalMs));
  }
}

main().catch(console.error);
