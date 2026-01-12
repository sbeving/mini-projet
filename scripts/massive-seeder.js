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
  // Databases
  'pgvector-primary', 'pgvector-replica-01', 'pgvector-replica-02',
  'mongo-shard-01', 'mongo-shard-02', 'mongo-config',
  'redis-cache-main', 'redis-session-store',
  'cassandra-node-01', 'cassandra-node-02',
  
  // Cloud & Infra
  'aws-ec2-scaler', 'k8s-controller-manager', 'k8s-scheduler',
  'nginx-ingress-01', 'nginx-ingress-02',
  'docker-daemon-prod', 'containerd-worker',
  
  // File & Storage
  's3-bucket-monitor', 'nfs-server-01', 'glusterfs-node',
  'backup-coodinator', 'datasync-servicce',

  // Mail & Messaging
  'smtp-relay-01', 'smtp-relay-02', 'postfix-main',
  'rabbitmq-cluster', 'kafka-broker-01', 'kafka-broker-02',
  
  // Security & Auth
  'bastion-host-01', 'bastion-host-02',
  'auth-service', 'keycloak-identity',
  'vpn-gateway-east', 'vpn-gateway-west',
  
  // Application Services
  'payment-processor', 'inventory-api', 'order-service',
  'notification-worker', 'analytics-engine', 'search-indexer',
  'user-profile-svc', 'billing-job', 'audit-logger',
  'feature-flag-svc', 'report-generator', 'image-resizer',
  'email-sender', 'sms-gateway', 'push-notifier'
];

const SCENARIOS = {
  database: [
    "Slow query detected: SELECT * FROM vector_embeddings WHERE distance < 0.5 (2400ms)",
    "Connection pool exhaustion: active=500, idle=0, waiting=150",
    "Deadlock detected in transaction 0x445522 awaiting lock on relation 1234",
    "Checkpoint complete: wrote 409 buffers (2.4%)",
    "Autovacuum: VACUUM public.users (to prevent wraparound)",
    "PGVector: Index build started for ivfflat index on 'embedding'",
    "Replication lag exceeded threshold: 250ms behind primary"
  ],
  security: [
    "Failed password for invalid user admin from 192.168.1.142 port 4422 ssh2",
    "Accepted publickey for ubuntu from 10.0.0.5 port 54322 ssh2: RSA SHA256:...",
    "Disconnecting: Too many authentication failures for root [preauth]",
    "Received disconnect from 203.0.113.55 port 22: 11: Bye Bye [preauth]",
    "Bruteforce attempt detected: 50 failed logins in 1 minute from 45.33.22.11",
    "Sudo command execution: rm -rf /tmp/cache by user devops",
    "Certificate validation failed: self signed certificate in certificate chain",
    "API Key validation failed: expired token detected"
  ],
  network: [
    "Interface eth0: link down",
    "SNMP Trap: High Packet Loss (15%) on switch-core-01",
    "DNS resolution failed for service.internal: NXDOMAIN",
    "Connection timed out connecting to payment-gateway:443",
    "Rate limit exceeded: 429 Too Many Requests (Token Bucket empty)",
    "Load Balancer: 502 Bad Gateway from upstream 10.0.2.55",
    "Firewall: DROP input packet from 1.2.3.4 on port 22"
  ],
  mail: [
    "postfix/smtpd: connect from mail-bad-actor.com[1.2.3.4]",
    "postfix/cleanup: message-id=<20250112.XYZ@mail.com>",
    "spf-check: fail (IP 1.2.3.4 is not designated to send for domain.com)",
    "dkim-filter: OpenDKIM Filter: milter-reject: 4.7.0 authentication failed",
    "Queue high: 5000 messages pending delivery",
    "Bounce: 550 5.1.1 User unknown"
  ],
  system: [
    "Out of memory: Kill process 1234 (node) score 950 or sacrifice child",
    "Disk usage warning: /var/log is 85% full",
    "High CPU load average: 15.54, 12.33, 8.44",
    "Kernel panic - not syncing: VFS: Unable to mount root fs",
    "Systemd: Failed to start Docker Application Container Engine.",
    "Cron job 'backup-daily' failed with exit code 1"
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
  
  // Categorize service to pick appropriate scenario
  let category = 'system';
  if (service.includes('db') || service.includes('mongo') || service.includes('redis') || service.includes('sql') || service.includes('vector')) category = 'database';
  else if (service.includes('bastion') || service.includes('auth') || service.includes('vpn') || service.includes('keycloak')) category = 'security';
  else if (service.includes('smtp') || service.includes('mail') || service.includes('postfix')) category = 'mail';
  else if (service.includes('ingress') || service.includes('net') || service.includes('gateway')) category = 'network';
  
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
