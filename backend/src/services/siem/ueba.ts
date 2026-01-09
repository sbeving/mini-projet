/**
 * User and Entity Behavior Analytics (UEBA)
 * ML-powered behavioral analysis for anomaly detection
 * 
 * Features:
 * - User activity baseline profiling
 * - Entity risk scoring
 * - Behavioral anomaly detection
 * - Peer group analysis
 * - Session analytics
 */

import { ThreatSeverity } from './types.js';

// ============================================================
// UEBA TYPES
// ============================================================

export type EntityType = 'user' | 'endpoint' | 'service' | 'network_segment' | 'application';

export interface BehaviorPattern {
  metric: string;
  value: number;
  stdDev: number;
  min: number;
  max: number;
  samples: number;
  lastUpdated: Date;
}

export interface EntityProfile {
  id: string;
  entityType: EntityType;
  entityId: string;
  name: string;
  
  // Baseline behaviors
  baseline: {
    loginTimes: BehaviorPattern;       // Typical login hours
    sessionDuration: BehaviorPattern;  // Average session length
    activityVolume: BehaviorPattern;   // Actions per hour
    dataAccess: BehaviorPattern;       // Data access patterns
    networkTraffic: BehaviorPattern;   // Network usage
    geoLocations: string[];            // Known locations
    userAgents: string[];              // Known devices/browsers
    accessedResources: string[];       // Frequently accessed resources
    peerGroup?: string;                // Peer group for comparison
  };
  
  // Current risk assessment
  riskScore: number;          // 0-100
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  riskFactors: RiskFactor[];
  
  // Metadata
  firstSeen: Date;
  lastSeen: Date;
  lastActivity: Date;
  alertCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RiskFactor {
  id: string;
  category: 'authentication' | 'access' | 'data' | 'network' | 'behavior' | 'temporal';
  severity: ThreatSeverity;
  title: string;
  description: string;
  score: number;
  timestamp: Date;
  indicators: string[];
}

export interface BehaviorAnomaly {
  id: string;
  entityId: string;
  entityType: EntityType;
  category: string;
  severity: ThreatSeverity;
  title: string;
  description: string;
  
  // Anomaly details
  metric: string;
  expectedValue: number;
  actualValue: number;
  deviation: number;        // Standard deviations from mean
  confidence: number;       // 0-100
  
  // Context
  relatedEvents: string[];
  timestamp: Date;
  
  // ML analysis
  mlModel?: string;
  mlScore?: number;
  features?: Record<string, number>;
}

export interface ActivityEvent {
  id: string;
  entityId: string;
  entityType: EntityType;
  eventType: string;
  timestamp: Date;
  sourceIp?: string;
  destinationIp?: string;
  resource?: string;
  action?: string;
  status?: 'success' | 'failure';
  metadata?: Record<string, unknown>;
}

export interface PeerGroup {
  id: string;
  name: string;
  description: string;
  members: string[];
  baseline: {
    avgRiskScore: number;
    avgActivityVolume: number;
    avgSessionDuration: number;
    commonResources: string[];
    commonLocations: string[];
    workingHours: { start: number; end: number };
  };
}

// ============================================================
// UEBA ENGINE
// ============================================================

class UEBAEngine {
  private profiles: Map<string, EntityProfile> = new Map();
  private anomalies: Map<string, BehaviorAnomaly> = new Map();
  private peerGroups: Map<string, PeerGroup> = new Map();
  private activityBuffer: ActivityEvent[] = [];
  
  // Configuration
  private readonly ANOMALY_THRESHOLD = 2.5; // Standard deviations
  private readonly MIN_SAMPLES = 10;
  private readonly RISK_DECAY_HOURS = 24;
  private readonly BUFFER_SIZE = 10000;

  constructor() {
    this.initializeDefaultPeerGroups();
    this.initializeDemoProfiles();
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  private initializeDefaultPeerGroups(): void {
    const groups: PeerGroup[] = [
      {
        id: 'pg-developers',
        name: 'Software Developers',
        description: 'Engineering team members',
        members: [],
        baseline: {
          avgRiskScore: 25,
          avgActivityVolume: 150,
          avgSessionDuration: 480,
          commonResources: ['git', 'jenkins', 'jira', 'confluence'],
          commonLocations: ['US', 'EU'],
          workingHours: { start: 9, end: 18 },
        },
      },
      {
        id: 'pg-admins',
        name: 'System Administrators',
        description: 'IT operations team',
        members: [],
        baseline: {
          avgRiskScore: 35,
          avgActivityVolume: 200,
          avgSessionDuration: 600,
          commonResources: ['ssh', 'aws-console', 'kubernetes', 'monitoring'],
          commonLocations: ['US'],
          workingHours: { start: 0, end: 24 }, // 24/7
        },
      },
      {
        id: 'pg-finance',
        name: 'Finance Team',
        description: 'Finance and accounting',
        members: [],
        baseline: {
          avgRiskScore: 30,
          avgActivityVolume: 80,
          avgSessionDuration: 420,
          commonResources: ['erp', 'banking', 'reports'],
          commonLocations: ['US'],
          workingHours: { start: 8, end: 17 },
        },
      },
      {
        id: 'pg-executives',
        name: 'Executives',
        description: 'C-level and VP',
        members: [],
        baseline: {
          avgRiskScore: 40,
          avgActivityVolume: 50,
          avgSessionDuration: 300,
          commonResources: ['email', 'reports', 'dashboards'],
          commonLocations: ['US', 'EU', 'APAC'],
          workingHours: { start: 6, end: 22 },
        },
      },
    ];

    for (const group of groups) {
      this.peerGroups.set(group.id, group);
    }
  }

  private initializeDemoProfiles(): void {
    // Create some demo user profiles with realistic baselines
    const demoUsers = [
      { id: 'user-001', name: 'John Developer', peerGroup: 'pg-developers', riskScore: 15 },
      { id: 'user-002', name: 'Jane Admin', peerGroup: 'pg-admins', riskScore: 25 },
      { id: 'user-003', name: 'Bob Finance', peerGroup: 'pg-finance', riskScore: 10 },
      { id: 'user-004', name: 'Alice Executive', peerGroup: 'pg-executives', riskScore: 20 },
      { id: 'user-005', name: 'Charlie Support', peerGroup: 'pg-developers', riskScore: 45 }, // Higher risk
    ];

    for (const user of demoUsers) {
      const profile = this.createDefaultProfile(user.id, 'user', user.name);
      profile.baseline.peerGroup = user.peerGroup;
      profile.riskScore = user.riskScore;
      profile.riskLevel = this.calculateRiskLevel(user.riskScore);
      
      // Add peer group member
      const group = this.peerGroups.get(user.peerGroup);
      if (group) {
        group.members.push(user.id);
      }
      
      this.profiles.set(`user:${user.id}`, profile);
    }

    // Create demo endpoint profiles
    const demoEndpoints = [
      { id: 'endpoint-001', name: 'workstation-dev-01' },
      { id: 'endpoint-002', name: 'server-prod-01' },
      { id: 'endpoint-003', name: 'server-db-01' },
    ];

    for (const endpoint of demoEndpoints) {
      const profile = this.createDefaultProfile(endpoint.id, 'endpoint', endpoint.name);
      this.profiles.set(`endpoint:${endpoint.id}`, profile);
    }
  }

  private createDefaultProfile(entityId: string, entityType: EntityType, name: string): EntityProfile {
    const now = new Date();
    
    return {
      id: `profile-${entityId}`,
      entityType,
      entityId,
      name,
      baseline: {
        loginTimes: this.createDefaultPattern('login_hour', 10, 3), // 10 AM avg
        sessionDuration: this.createDefaultPattern('session_minutes', 240, 60),
        activityVolume: this.createDefaultPattern('actions_per_hour', 50, 20),
        dataAccess: this.createDefaultPattern('mb_accessed', 100, 50),
        networkTraffic: this.createDefaultPattern('mb_transferred', 50, 25),
        geoLocations: ['US'],
        userAgents: [],
        accessedResources: [],
      },
      riskScore: 20,
      riskLevel: 'low',
      riskFactors: [],
      firstSeen: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
      lastSeen: now,
      lastActivity: now,
      alertCount: 0,
      createdAt: now,
      updatedAt: now,
    };
  }

  private createDefaultPattern(metric: string, mean: number, stdDev: number): BehaviorPattern {
    return {
      metric,
      value: mean,
      stdDev,
      min: Math.max(0, mean - 3 * stdDev),
      max: mean + 3 * stdDev,
      samples: 100,
      lastUpdated: new Date(),
    };
  }

  // ============================================================
  // BEHAVIOR ANALYSIS
  // ============================================================

  /**
   * Analyze an activity event for anomalies
   */
  async analyzeActivity(event: ActivityEvent): Promise<BehaviorAnomaly[]> {
    const anomalies: BehaviorAnomaly[] = [];
    const profileKey = `${event.entityType}:${event.entityId}`;
    
    // Get or create profile
    let profile = this.profiles.get(profileKey);
    if (!profile) {
      profile = this.createDefaultProfile(event.entityId, event.entityType, event.entityId);
      this.profiles.set(profileKey, profile);
    }

    // Update last activity
    profile.lastActivity = event.timestamp;
    profile.lastSeen = event.timestamp;

    // Buffer the event
    this.activityBuffer.push(event);
    if (this.activityBuffer.length > this.BUFFER_SIZE) {
      this.activityBuffer.shift();
    }

    // Run anomaly checks
    const checks: Promise<BehaviorAnomaly | null>[] = [
      this.checkTemporalAnomaly(event, profile),
      this.checkLocationAnomaly(event, profile),
      this.checkVolumeAnomaly(event, profile),
      this.checkResourceAnomaly(event, profile),
      this.checkSessionAnomaly(event, profile),
    ];

    const results = await Promise.all(checks);
    for (const result of results) {
      if (result) {
        this.anomalies.set(result.id, result);
        anomalies.push(result);
        
        // Update risk score
        this.updateRiskScore(profile, result);
      }
    }

    // Update profile baseline
    this.updateBaseline(profile, event);

    return anomalies;
  }

  /**
   * Check for temporal anomalies (unusual access times)
   */
  private async checkTemporalAnomaly(
    event: ActivityEvent,
    profile: EntityProfile
  ): Promise<BehaviorAnomaly | null> {
    const eventHour = event.timestamp.getHours();
    const baseline = profile.baseline.loginTimes;
    
    // Check if outside normal hours
    const deviation = Math.abs(eventHour - baseline.value) / (baseline.stdDev || 1);
    
    if (deviation > this.ANOMALY_THRESHOLD && baseline.samples >= this.MIN_SAMPLES) {
      return {
        id: `anomaly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        entityId: event.entityId,
        entityType: event.entityType,
        category: 'temporal',
        severity: deviation > 4 ? 'high' : 'medium',
        title: 'Unusual Activity Time',
        description: `Activity detected at ${eventHour}:00, outside normal hours (typically ${Math.round(baseline.value)}:00)`,
        metric: 'activity_hour',
        expectedValue: baseline.value,
        actualValue: eventHour,
        deviation,
        confidence: Math.min(95, 50 + baseline.samples),
        relatedEvents: [event.id],
        timestamp: event.timestamp,
        mlModel: 'temporal_baseline',
        mlScore: 100 - (deviation * 10),
      };
    }

    return null;
  }

  /**
   * Check for location anomalies
   */
  private async checkLocationAnomaly(
    event: ActivityEvent,
    profile: EntityProfile
  ): Promise<BehaviorAnomaly | null> {
    if (!event.sourceIp) return null;

    // Simulate geo-lookup (in production, use real GeoIP)
    const location = this.getLocationFromIP(event.sourceIp);
    
    if (!profile.baseline.geoLocations.includes(location)) {
      // Check for impossible travel
      const lastEvent = this.getLastEvent(event.entityId);
      let severity: ThreatSeverity = 'medium';
      let description = `Activity from new location: ${location}`;
      
      if (lastEvent && lastEvent.sourceIp) {
        const lastLocation = this.getLocationFromIP(lastEvent.sourceIp);
        const timeDiff = event.timestamp.getTime() - lastEvent.timestamp.getTime();
        const hoursDiff = timeDiff / (1000 * 60 * 60);
        
        // Impossible travel detection
        if (lastLocation !== location && hoursDiff < 4) {
          severity = 'critical';
          description = `Impossible travel detected: ${lastLocation} → ${location} in ${hoursDiff.toFixed(1)} hours`;
        }
      }

      return {
        id: `anomaly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        entityId: event.entityId,
        entityType: event.entityType,
        category: 'geolocation',
        severity,
        title: severity === 'critical' ? 'Impossible Travel Detected' : 'New Location Detected',
        description,
        metric: 'geo_location',
        expectedValue: 0,
        actualValue: 1,
        deviation: 3,
        confidence: 85,
        relatedEvents: [event.id],
        timestamp: event.timestamp,
        mlModel: 'geo_baseline',
        mlScore: severity === 'critical' ? 15 : 50,
      };
    }

    return null;
  }

  /**
   * Check for activity volume anomalies
   */
  private async checkVolumeAnomaly(
    event: ActivityEvent,
    profile: EntityProfile
  ): Promise<BehaviorAnomaly | null> {
    // Count recent events for this entity
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentEvents = this.activityBuffer.filter(
      e => e.entityId === event.entityId && e.timestamp >= hourAgo
    );

    const volumeBaseline = profile.baseline.activityVolume;
    const currentVolume = recentEvents.length;
    const deviation = (currentVolume - volumeBaseline.value) / (volumeBaseline.stdDev || 1);

    if (deviation > this.ANOMALY_THRESHOLD && volumeBaseline.samples >= this.MIN_SAMPLES) {
      return {
        id: `anomaly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        entityId: event.entityId,
        entityType: event.entityType,
        category: 'volume',
        severity: deviation > 5 ? 'high' : 'medium',
        title: 'Unusual Activity Volume',
        description: `${currentVolume} actions in the last hour (typically ${Math.round(volumeBaseline.value)})`,
        metric: 'actions_per_hour',
        expectedValue: volumeBaseline.value,
        actualValue: currentVolume,
        deviation,
        confidence: Math.min(95, 50 + volumeBaseline.samples),
        relatedEvents: recentEvents.map(e => e.id),
        timestamp: event.timestamp,
        mlModel: 'volume_baseline',
        mlScore: 100 - (deviation * 10),
      };
    }

    return null;
  }

  /**
   * Check for unusual resource access
   */
  private async checkResourceAnomaly(
    event: ActivityEvent,
    profile: EntityProfile
  ): Promise<BehaviorAnomaly | null> {
    if (!event.resource) return null;

    // Check if this is a new/unusual resource
    const isKnownResource = profile.baseline.accessedResources.includes(event.resource);
    
    // Check against peer group
    const peerGroup = profile.baseline.peerGroup 
      ? this.peerGroups.get(profile.baseline.peerGroup)
      : null;
    const isPeerResource = peerGroup?.baseline.commonResources.includes(event.resource);

    if (!isKnownResource && !isPeerResource) {
      // Check sensitivity of resource
      const sensitiveResources = ['database', 'admin', 'credentials', 'secrets', 'keys', 'backup'];
      const isSensitive = sensitiveResources.some(s => 
        event.resource!.toLowerCase().includes(s)
      );

      return {
        id: `anomaly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        entityId: event.entityId,
        entityType: event.entityType,
        category: 'resource_access',
        severity: isSensitive ? 'high' : 'low',
        title: isSensitive ? 'Sensitive Resource Access' : 'Unusual Resource Access',
        description: `First-time access to ${event.resource}${isSensitive ? ' (sensitive resource)' : ''}`,
        metric: 'new_resource_access',
        expectedValue: 0,
        actualValue: 1,
        deviation: 2,
        confidence: 70,
        relatedEvents: [event.id],
        timestamp: event.timestamp,
        mlModel: 'resource_baseline',
        mlScore: isSensitive ? 30 : 70,
      };
    }

    return null;
  }

  /**
   * Check for session anomalies
   */
  private async checkSessionAnomaly(
    event: ActivityEvent,
    profile: EntityProfile
  ): Promise<BehaviorAnomaly | null> {
    // Check for failed logins
    if (event.eventType === 'login' && event.status === 'failure') {
      const recentFailures = this.activityBuffer.filter(
        e => e.entityId === event.entityId &&
             e.eventType === 'login' &&
             e.status === 'failure' &&
             e.timestamp >= new Date(Date.now() - 15 * 60 * 1000)
      );

      if (recentFailures.length >= 3) {
        return {
          id: `anomaly-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          entityId: event.entityId,
          entityType: event.entityType,
          category: 'authentication',
          severity: recentFailures.length >= 5 ? 'high' : 'medium',
          title: 'Multiple Failed Login Attempts',
          description: `${recentFailures.length} failed login attempts in the last 15 minutes`,
          metric: 'failed_logins',
          expectedValue: 0,
          actualValue: recentFailures.length,
          deviation: recentFailures.length,
          confidence: 95,
          relatedEvents: recentFailures.map(e => e.id),
          timestamp: event.timestamp,
          mlModel: 'auth_monitor',
          mlScore: 100 - (recentFailures.length * 15),
        };
      }
    }

    return null;
  }

  // ============================================================
  // HELPER METHODS
  // ============================================================

  private getLocationFromIP(ip: string): string {
    // Simulated geo-location based on IP
    const firstOctet = parseInt(ip.split('.')[0]);
    if (firstOctet >= 1 && firstOctet <= 126) return 'US';
    if (firstOctet >= 128 && firstOctet <= 150) return 'EU';
    if (firstOctet >= 151 && firstOctet <= 191) return 'APAC';
    return 'Unknown';
  }

  private getLastEvent(entityId: string): ActivityEvent | null {
    for (let i = this.activityBuffer.length - 1; i >= 0; i--) {
      if (this.activityBuffer[i].entityId === entityId) {
        return this.activityBuffer[i];
      }
    }
    return null;
  }

  private updateRiskScore(profile: EntityProfile, anomaly: BehaviorAnomaly): void {
    // Calculate risk contribution based on severity
    const severityWeights = {
      critical: 30,
      high: 20,
      medium: 10,
      low: 5,
      info: 2,
    };

    const contribution = severityWeights[anomaly.severity] || 5;
    
    // Add to risk score (with decay factor for existing score)
    const decayFactor = 0.95;
    profile.riskScore = Math.min(100, profile.riskScore * decayFactor + contribution);
    profile.riskLevel = this.calculateRiskLevel(profile.riskScore);
    
    // Add risk factor
    profile.riskFactors.push({
      id: anomaly.id,
      category: anomaly.category as RiskFactor['category'],
      severity: anomaly.severity,
      title: anomaly.title,
      description: anomaly.description,
      score: contribution,
      timestamp: anomaly.timestamp,
      indicators: [],
    });

    // Keep only recent risk factors
    if (profile.riskFactors.length > 20) {
      profile.riskFactors = profile.riskFactors.slice(-20);
    }

    profile.alertCount++;
    profile.updatedAt = new Date();
  }

  private calculateRiskLevel(score: number): EntityProfile['riskLevel'] {
    if (score >= 80) return 'critical';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'minimal';
  }

  private updateBaseline(profile: EntityProfile, event: ActivityEvent): void {
    // Update accessed resources
    if (event.resource && !profile.baseline.accessedResources.includes(event.resource)) {
      profile.baseline.accessedResources.push(event.resource);
      if (profile.baseline.accessedResources.length > 100) {
        profile.baseline.accessedResources.shift();
      }
    }

    // Update geo-locations (after successful activities)
    if (event.sourceIp && event.status !== 'failure') {
      const location = this.getLocationFromIP(event.sourceIp);
      if (!profile.baseline.geoLocations.includes(location)) {
        // Only add after multiple successful accesses
        const locationCount = this.activityBuffer.filter(
          e => e.entityId === event.entityId && this.getLocationFromIP(e.sourceIp || '') === location
        ).length;
        
        if (locationCount >= 5) {
          profile.baseline.geoLocations.push(location);
        }
      }
    }

    // Update behavioral patterns using exponential moving average
    this.updatePattern(profile.baseline.loginTimes, event.timestamp.getHours());
    this.updatePattern(profile.baseline.activityVolume, 1); // Each event is 1 action
  }

  private updatePattern(pattern: BehaviorPattern, newValue: number): void {
    const alpha = 0.1; // Smoothing factor
    const oldMean = pattern.value;
    
    // Update mean
    pattern.value = alpha * newValue + (1 - alpha) * oldMean;
    
    // Update standard deviation
    const variance = alpha * Math.pow(newValue - pattern.value, 2) + 
                     (1 - alpha) * Math.pow(pattern.stdDev, 2);
    pattern.stdDev = Math.sqrt(variance);
    
    // Update bounds
    pattern.min = Math.min(pattern.min, newValue);
    pattern.max = Math.max(pattern.max, newValue);
    pattern.samples++;
    pattern.lastUpdated = new Date();
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  /**
   * Get all entity profiles
   */
  getProfiles(filters?: {
    entityType?: EntityType;
    riskLevel?: EntityProfile['riskLevel'];
    peerGroup?: string;
  }): EntityProfile[] {
    let profiles = Array.from(this.profiles.values());

    if (filters) {
      if (filters.entityType) {
        profiles = profiles.filter(p => p.entityType === filters.entityType);
      }
      if (filters.riskLevel) {
        profiles = profiles.filter(p => p.riskLevel === filters.riskLevel);
      }
      if (filters.peerGroup) {
        profiles = profiles.filter(p => p.baseline.peerGroup === filters.peerGroup);
      }
    }

    return profiles.sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Get profile by entity
   */
  getProfile(entityType: EntityType, entityId: string): EntityProfile | null {
    return this.profiles.get(`${entityType}:${entityId}`) || null;
  }

  /**
   * Get recent anomalies
   */
  getAnomalies(limit: number = 100): BehaviorAnomaly[] {
    return Array.from(this.anomalies.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get peer groups
   */
  getPeerGroups(): PeerGroup[] {
    return Array.from(this.peerGroups.values());
  }

  /**
   * Get high-risk entities
   */
  getHighRiskEntities(minRiskScore: number = 60): EntityProfile[] {
    return Array.from(this.profiles.values())
      .filter(p => p.riskScore >= minRiskScore)
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalProfiles: number;
    byEntityType: Record<string, number>;
    byRiskLevel: Record<string, number>;
    totalAnomalies: number;
    recentAnomalies: number;
    averageRiskScore: number;
  } {
    const profiles = Array.from(this.profiles.values());
    const anomalies = Array.from(this.anomalies.values());
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const byEntityType: Record<string, number> = {};
    const byRiskLevel: Record<string, number> = {};
    let totalRisk = 0;

    for (const profile of profiles) {
      byEntityType[profile.entityType] = (byEntityType[profile.entityType] || 0) + 1;
      byRiskLevel[profile.riskLevel] = (byRiskLevel[profile.riskLevel] || 0) + 1;
      totalRisk += profile.riskScore;
    }

    return {
      totalProfiles: profiles.length,
      byEntityType,
      byRiskLevel,
      totalAnomalies: anomalies.length,
      recentAnomalies: anomalies.filter(a => a.timestamp >= hourAgo).length,
      averageRiskScore: profiles.length > 0 ? Math.round(totalRisk / profiles.length) : 0,
    };
  }

  /**
   * Reset entity risk score
   */
  resetRiskScore(entityType: EntityType, entityId: string): boolean {
    const profile = this.profiles.get(`${entityType}:${entityId}`);
    if (profile) {
      profile.riskScore = 0;
      profile.riskLevel = 'minimal';
      profile.riskFactors = [];
      profile.updatedAt = new Date();
      return true;
    }
    return false;
  }
}

// Export singleton instance
export const uebaEngine = new UEBAEngine();
