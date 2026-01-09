/**
 * Threat Intelligence Service
 * Manages threat intelligence feeds, IOC enrichment, and reputation scoring
 * 
 * Features:
 * - IOC management and correlation
 * - Threat feed integration
 * - IP/Domain reputation lookup
 * - Automatic IOC extraction from logs
 * - Contextual threat enrichment
 */

import { IOC, IOCType, ThreatSeverity } from './types.js';

// ============================================================
// THREAT INTELLIGENCE DATABASE (In-Memory for Demo)
// ============================================================

interface ThreatFeed {
  id: string;
  name: string;
  type: 'ip' | 'domain' | 'hash' | 'url' | 'mixed';
  source: string;
  lastUpdated: Date;
  enabled: boolean;
  confidence: number;
  indicators: Map<string, IOC>;
}

interface ReputationScore {
  score: number; // 0-100 (0 = malicious, 100 = benign)
  category: 'malicious' | 'suspicious' | 'neutral' | 'benign' | 'unknown';
  sources: string[];
  firstSeen?: Date;
  lastSeen?: Date;
  tags: string[];
  context: string[];
}

interface EnrichmentResult {
  indicator: string;
  type: IOCType;
  reputation: ReputationScore;
  relatedIOCs: IOC[];
  threatActors?: string[];
  campaigns?: string[];
  malwareFamilies?: string[];
  geoLocation?: {
    country: string;
    city?: string;
    asn?: string;
    org?: string;
  };
}

// ============================================================
// KNOWN MALICIOUS INDICATORS (Demo Data)
// ============================================================

const KNOWN_MALICIOUS_IPS = new Set([
  '185.220.101.1', '185.220.101.2', // Tor exit nodes
  '45.33.32.156', // Shodan scanner
  '91.92.66.0', '91.92.66.1', // Known C2
  '192.42.116.0', '192.42.116.1', // Malware hosting
  '23.129.64.0', // Known bad actor
  '5.188.206.0', // Botnet C2
]);

const KNOWN_MALICIOUS_DOMAINS = new Set([
  'evil-domain.com',
  'malware-download.net',
  'c2-server.org',
  'phishing-site.com',
  'crypto-miner.xyz',
  'exploit-kit.ru',
  'ransomware-payment.onion',
  'data-exfil.net',
]);

const KNOWN_MALICIOUS_HASHES = new Set([
  'd41d8cd98f00b204e9800998ecf8427e', // Empty file MD5 (suspicious in context)
  'a94a8fe5ccb19ba61c4c0873d391e987982fbbd3', // Common test file
  'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', // Empty SHA256
]);

const SUSPICIOUS_USER_AGENTS = [
  'sqlmap',
  'nikto',
  'nmap',
  'masscan',
  'gobuster',
  'dirbuster',
  'nuclei',
  'zgrab',
  'python-requests',
  'curl',
  'wget',
];

// ============================================================
// THREAT INTELLIGENCE CLASS
// ============================================================

class ThreatIntelligenceService {
  private feeds: Map<string, ThreatFeed> = new Map();
  private iocCache: Map<string, IOC> = new Map();
  private reputationCache: Map<string, ReputationScore> = new Map();
  private iocExtractionPatterns: Map<IOCType, RegExp>;

  constructor() {
    // Initialize IOC extraction patterns
    this.iocExtractionPatterns = new Map([
      ['ip', /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g],
      ['domain', /\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/g],
      ['url', /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi],
      ['email', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g],
      ['hash_md5', /\b[a-fA-F0-9]{32}\b/g],
      ['hash_sha1', /\b[a-fA-F0-9]{40}\b/g],
      ['hash_sha256', /\b[a-fA-F0-9]{64}\b/g],
      ['file_path', /(?:\/[\w.-]+)+|(?:[A-Za-z]:\\[\w\s.-]+(?:\\[\w\s.-]+)*)/g],
      ['user_agent', /User-Agent:\s*([^\r\n]+)/gi],
    ]);

    // Initialize with demo threat feeds
    this.initializeDemoFeeds();
  }

  // ============================================================
  // FEED MANAGEMENT
  // ============================================================

  private initializeDemoFeeds(): void {
    // Simulated Threat Intelligence Feeds
    const demoFeeds: Omit<ThreatFeed, 'indicators'>[] = [
      {
        id: 'feed-emergingthreats',
        name: 'Emerging Threats',
        type: 'mixed',
        source: 'https://rules.emergingthreats.net',
        lastUpdated: new Date(),
        enabled: true,
        confidence: 90,
      },
      {
        id: 'feed-abuse-ch',
        name: 'Abuse.ch URLhaus',
        type: 'url',
        source: 'https://urlhaus.abuse.ch',
        lastUpdated: new Date(),
        enabled: true,
        confidence: 95,
      },
      {
        id: 'feed-alienvault',
        name: 'AlienVault OTX',
        type: 'mixed',
        source: 'https://otx.alienvault.com',
        lastUpdated: new Date(),
        enabled: true,
        confidence: 85,
      },
      {
        id: 'feed-tor-exits',
        name: 'Tor Exit Nodes',
        type: 'ip',
        source: 'https://check.torproject.org/exit-addresses',
        lastUpdated: new Date(),
        enabled: true,
        confidence: 100,
      },
      {
        id: 'feed-malware-bazaar',
        name: 'Malware Bazaar',
        type: 'hash',
        source: 'https://bazaar.abuse.ch',
        lastUpdated: new Date(),
        enabled: true,
        confidence: 95,
      },
    ];

    for (const feed of demoFeeds) {
      this.feeds.set(feed.id, {
        ...feed,
        indicators: new Map(),
      });
    }

    // Populate with known malicious indicators
    this.populateDemoIndicators();
  }

  private populateDemoIndicators(): void {
    const now = new Date();

    // Add known malicious IPs
    for (const ip of KNOWN_MALICIOUS_IPS) {
      const ioc: IOC = {
        id: `ioc-ip-${ip}`,
        type: 'ip',
        value: ip,
        severity: 'high',
        source: 'threat-intel-feed',
        firstSeen: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        lastSeen: now,
        hitCount: Math.floor(Math.random() * 100),
        tags: ['malicious', 'c2', 'scanner'],
        confidence: 90,
        active: true,
      };
      this.iocCache.set(ip, ioc);
    }

    // Add known malicious domains
    for (const domain of KNOWN_MALICIOUS_DOMAINS) {
      const ioc: IOC = {
        id: `ioc-domain-${domain}`,
        type: 'domain',
        value: domain,
        severity: 'critical',
        source: 'threat-intel-feed',
        firstSeen: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000),
        lastSeen: now,
        hitCount: Math.floor(Math.random() * 50),
        tags: ['malware', 'phishing', 'c2'],
        confidence: 95,
        active: true,
      };
      this.iocCache.set(domain, ioc);
    }

    // Add known malicious hashes
    for (const hash of KNOWN_MALICIOUS_HASHES) {
      const hashType: IOCType = hash.length === 32 ? 'hash_md5' : hash.length === 40 ? 'hash_sha1' : 'hash_sha256';
      const ioc: IOC = {
        id: `ioc-hash-${hash.substring(0, 8)}`,
        type: hashType,
        value: hash,
        severity: 'critical',
        source: 'malware-bazaar',
        firstSeen: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        lastSeen: now,
        hitCount: Math.floor(Math.random() * 200),
        tags: ['malware', 'ransomware', 'trojan'],
        confidence: 98,
        active: true,
      };
      this.iocCache.set(hash, ioc);
    }
  }

  // ============================================================
  // IOC EXTRACTION FROM LOGS
  // ============================================================

  /**
   * Extract all IOCs from a log message
   */
  extractIOCs(message: string, meta?: Record<string, unknown>): { type: IOCType; value: string }[] {
    const extracted: { type: IOCType; value: string }[] = [];
    const seen = new Set<string>();

    // Extract from message
    for (const [type, pattern] of this.iocExtractionPatterns) {
      const matches = message.match(pattern);
      if (matches) {
        for (const match of matches) {
          const value = match.trim();
          const key = `${type}:${value}`;
          if (!seen.has(key) && this.isValidIOC(type, value)) {
            seen.add(key);
            extracted.push({ type, value });
          }
        }
      }
    }

    // Extract from metadata
    if (meta) {
      const metaStr = JSON.stringify(meta);
      for (const [type, pattern] of this.iocExtractionPatterns) {
        const matches = metaStr.match(pattern);
        if (matches) {
          for (const match of matches) {
            const value = match.trim();
            const key = `${type}:${value}`;
            if (!seen.has(key) && this.isValidIOC(type, value)) {
              seen.add(key);
              extracted.push({ type, value });
            }
          }
        }
      }
    }

    return extracted;
  }

  /**
   * Validate IOC value based on type
   */
  private isValidIOC(type: IOCType, value: string): boolean {
    switch (type) {
      case 'ip':
        // Filter out private/local IPs
        if (value.startsWith('10.') || 
            value.startsWith('192.168.') || 
            value.startsWith('172.16.') ||
            value.startsWith('127.') ||
            value.startsWith('0.')) {
          return false;
        }
        return true;
      
      case 'domain':
        // Filter out common benign domains
        const benignDomains = ['localhost', 'example.com', 'test.com', 'google.com', 'microsoft.com'];
        if (benignDomains.some(d => value.includes(d))) {
          return false;
        }
        return value.includes('.') && value.length > 3;
      
      case 'hash_md5':
        return value.length === 32;
      
      case 'hash_sha1':
        return value.length === 40;
      
      case 'hash_sha256':
        return value.length === 64;
      
      default:
        return true;
    }
  }

  // ============================================================
  // REPUTATION & ENRICHMENT
  // ============================================================

  /**
   * Look up reputation for an indicator
   */
  async lookupReputation(value: string, type?: IOCType): Promise<ReputationScore> {
    // Check cache first
    if (this.reputationCache.has(value)) {
      return this.reputationCache.get(value)!;
    }

    // Determine type if not provided
    if (!type) {
      type = this.detectIOCType(value);
    }

    let score: ReputationScore;

    // Check against known malicious indicators
    if (type === 'ip' && KNOWN_MALICIOUS_IPS.has(value)) {
      score = {
        score: 10,
        category: 'malicious',
        sources: ['tor-exit-nodes', 'abuse-db', 'threat-feeds'],
        firstSeen: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        lastSeen: new Date(),
        tags: ['tor', 'scanner', 'c2'],
        context: ['Known Tor exit node', 'Associated with scanning activity', 'Potential C2 communication'],
      };
    } else if (type === 'domain' && KNOWN_MALICIOUS_DOMAINS.has(value)) {
      score = {
        score: 5,
        category: 'malicious',
        sources: ['urlhaus', 'phishing-db', 'malware-feeds'],
        firstSeen: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        lastSeen: new Date(),
        tags: ['malware', 'phishing', 'c2'],
        context: ['Known malware distribution', 'Phishing domain', 'Command and control infrastructure'],
      };
    } else if ((type === 'hash_md5' || type === 'hash_sha1' || type === 'hash_sha256') && KNOWN_MALICIOUS_HASHES.has(value)) {
      score = {
        score: 0,
        category: 'malicious',
        sources: ['malware-bazaar', 'virustotal', 'hybrid-analysis'],
        firstSeen: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000),
        lastSeen: new Date(),
        tags: ['malware', 'ransomware', 'trojan'],
        context: ['Known malware hash', 'Multiple AV detections', 'Associated with ransomware campaigns'],
      };
    } else {
      // Unknown - generate a neutral score
      score = {
        score: 50,
        category: 'unknown',
        sources: [],
        tags: [],
        context: ['No threat intelligence data available'],
      };
    }

    // Cache the result
    this.reputationCache.set(value, score);
    return score;
  }

  /**
   * Enrich an indicator with full context
   */
  async enrichIndicator(value: string, type?: IOCType): Promise<EnrichmentResult> {
    if (!type) {
      type = this.detectIOCType(value);
    }

    const reputation = await this.lookupReputation(value, type);
    const relatedIOCs = this.findRelatedIOCs(value, type);

    const result: EnrichmentResult = {
      indicator: value,
      type,
      reputation,
      relatedIOCs,
    };

    // Add geo-location for IPs
    if (type === 'ip') {
      result.geoLocation = await this.lookupGeoLocation(value);
    }

    // Add threat actor associations
    if (reputation.category === 'malicious') {
      result.threatActors = this.getThreatActors(value);
      result.campaigns = this.getCampaigns(value);
      result.malwareFamilies = this.getMalwareFamilies(value);
    }

    return result;
  }

  /**
   * Detect IOC type from value
   */
  private detectIOCType(value: string): IOCType {
    // IP check
    if (/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(value)) {
      return 'ip';
    }
    // URL check
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return 'url';
    }
    // Hash checks
    if (/^[a-fA-F0-9]{64}$/.test(value)) return 'hash_sha256';
    if (/^[a-fA-F0-9]{40}$/.test(value)) return 'hash_sha1';
    if (/^[a-fA-F0-9]{32}$/.test(value)) return 'hash_md5';
    // Email check
    if (/@/.test(value) && /\./.test(value)) return 'email';
    // Default to domain
    return 'domain';
  }

  /**
   * Find related IOCs
   */
  private findRelatedIOCs(value: string, _type: IOCType): IOC[] {
    const related: IOC[] = [];
    
    for (const [_, ioc] of this.iocCache) {
      // Simple relation check - same source or similar tags
      if (ioc.value !== value && ioc.source === 'threat-intel-feed') {
        related.push(ioc);
        if (related.length >= 5) break;
      }
    }

    return related;
  }

  /**
   * Lookup geo-location for IP (simulated)
   */
  private async lookupGeoLocation(ip: string): Promise<{ country: string; city?: string; asn?: string; org?: string }> {
    // Simulated geo-location based on IP ranges
    const firstOctet = parseInt(ip.split('.')[0]);
    
    if (firstOctet >= 1 && firstOctet <= 126) {
      return { country: 'US', city: 'New York', asn: 'AS15169', org: 'Google LLC' };
    } else if (firstOctet >= 128 && firstOctet <= 191) {
      return { country: 'RU', city: 'Moscow', asn: 'AS12389', org: 'Rostelecom' };
    } else {
      return { country: 'CN', city: 'Beijing', asn: 'AS4134', org: 'China Telecom' };
    }
  }

  /**
   * Get associated threat actors (simulated)
   */
  private getThreatActors(value: string): string[] {
    const actors = ['APT28', 'APT29', 'Lazarus', 'FIN7', 'Cobalt Group', 'Evil Corp'];
    return [actors[Math.floor(Math.random() * actors.length)]];
  }

  /**
   * Get associated campaigns (simulated)
   */
  private getCampaigns(value: string): string[] {
    const campaigns = ['Operation ShadowHammer', 'SolarWinds', 'NotPetya', 'WannaCry', 'Operation Sharpshooter'];
    return [campaigns[Math.floor(Math.random() * campaigns.length)]];
  }

  /**
   * Get associated malware families (simulated)
   */
  private getMalwareFamilies(value: string): string[] {
    const families = ['Emotet', 'TrickBot', 'Cobalt Strike', 'Mimikatz', 'Ryuk', 'Conti', 'REvil'];
    return [families[Math.floor(Math.random() * families.length)]];
  }

  // ============================================================
  // IOC MANAGEMENT
  // ============================================================

  /**
   * Add a new IOC to the database
   */
  addIOC(ioc: Omit<IOC, 'id' | 'firstSeen' | 'lastSeen' | 'hitCount'>): IOC {
    const now = new Date();
    const fullIOC: IOC = {
      ...ioc,
      id: `ioc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      firstSeen: now,
      lastSeen: now,
      hitCount: 0,
    };

    this.iocCache.set(ioc.value, fullIOC);
    return fullIOC;
  }

  /**
   * Get all IOCs with optional filtering
   */
  getIOCs(filters?: {
    type?: IOCType;
    severity?: ThreatSeverity;
    active?: boolean;
    tags?: string[];
  }): IOC[] {
    let iocs = Array.from(this.iocCache.values());

    if (filters) {
      if (filters.type) {
        iocs = iocs.filter(ioc => ioc.type === filters.type);
      }
      if (filters.severity) {
        iocs = iocs.filter(ioc => ioc.severity === filters.severity);
      }
      if (filters.active !== undefined) {
        iocs = iocs.filter(ioc => ioc.active === filters.active);
      }
      if (filters.tags && filters.tags.length > 0) {
        iocs = iocs.filter(ioc => filters.tags!.some(tag => ioc.tags.includes(tag)));
      }
    }

    return iocs.sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
  }

  /**
   * Record an IOC hit
   */
  recordHit(value: string): void {
    const ioc = this.iocCache.get(value);
    if (ioc) {
      ioc.hitCount++;
      ioc.lastSeen = new Date();
    }
  }

  /**
   * Check if an indicator is malicious
   */
  async isMalicious(value: string): Promise<{ malicious: boolean; score: number; details: string[] }> {
    const reputation = await this.lookupReputation(value);
    
    return {
      malicious: reputation.category === 'malicious' || reputation.category === 'suspicious',
      score: reputation.score,
      details: reputation.context,
    };
  }

  /**
   * Check user agent for suspicious patterns
   */
  checkUserAgent(userAgent: string): { suspicious: boolean; reason?: string } {
    const lowerUA = userAgent.toLowerCase();
    
    for (const pattern of SUSPICIOUS_USER_AGENTS) {
      if (lowerUA.includes(pattern.toLowerCase())) {
        return {
          suspicious: true,
          reason: `User agent contains suspicious tool identifier: ${pattern}`,
        };
      }
    }

    // Check for empty or very short user agents
    if (!userAgent || userAgent.length < 10) {
      return {
        suspicious: true,
        reason: 'Empty or unusually short user agent',
      };
    }

    return { suspicious: false };
  }

  // ============================================================
  // FEED MANAGEMENT
  // ============================================================

  /**
   * Get all threat feeds
   */
  getFeeds(): ThreatFeed[] {
    return Array.from(this.feeds.values());
  }

  /**
   * Enable/disable a feed
   */
  toggleFeed(feedId: string, enabled: boolean): boolean {
    const feed = this.feeds.get(feedId);
    if (feed) {
      feed.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalIOCs: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    activeFeeds: number;
    totalFeeds: number;
  } {
    const iocs = Array.from(this.iocCache.values());
    
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const ioc of iocs) {
      byType[ioc.type] = (byType[ioc.type] || 0) + 1;
      bySeverity[ioc.severity] = (bySeverity[ioc.severity] || 0) + 1;
    }

    return {
      totalIOCs: iocs.length,
      byType,
      bySeverity,
      activeFeeds: Array.from(this.feeds.values()).filter(f => f.enabled).length,
      totalFeeds: this.feeds.size,
    };
  }
}

// Export singleton instance
export const threatIntelService = new ThreatIntelligenceService();
