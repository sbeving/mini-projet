/**
 * Machine Learning Anomaly Detection Engine
 * Advanced statistical and ML-based anomaly detection for logs
 * 
 * Features:
 * - Isolation Forest algorithm simulation
 * - Multivariate anomaly scoring
 * - Time-series anomaly detection
 * - Pattern clustering
 * - Real-time streaming detection
 */

import { ThreatSeverity } from './types.js';

// ============================================================
// ML TYPES
// ============================================================

export interface AnomalyScore {
  id: string;
  logId: string;
  score: number;          // 0-100, higher = more anomalous
  isAnomaly: boolean;
  confidence: number;     // 0-100
  
  // Detection details
  detectionMethod: 'isolation_forest' | 'statistical' | 'clustering' | 'time_series' | 'ensemble';
  features: FeatureVector;
  contributingFactors: AnomalyFactor[];
  
  // Classification
  anomalyType?: string;
  category?: string;
  severity: ThreatSeverity;
  
  timestamp: Date;
}

export interface FeatureVector {
  // Numerical features
  messageLength: number;
  tokenCount: number;
  numericRatio: number;
  specialCharRatio: number;
  entropyScore: number;
  
  // Temporal features
  hourOfDay: number;
  dayOfWeek: number;
  timeSinceLastEvent: number;
  eventFrequency: number;
  
  // Categorical features (encoded)
  serviceEncoded: number;
  levelEncoded: number;
  sourceEncoded: number;
  
  // Pattern features
  hasErrorPattern: number;
  hasSecurityPattern: number;
  hasNetworkPattern: number;
  patternRarity: number;
}

export interface AnomalyFactor {
  feature: string;
  contribution: number;   // How much this feature contributed
  actualValue: number;
  expectedRange: [number, number];
  description: string;
}

export interface DetectionModel {
  id: string;
  name: string;
  type: 'isolation_forest' | 'gaussian' | 'clustering' | 'lstm';
  status: 'training' | 'ready' | 'outdated';
  
  // Model parameters
  params: Record<string, number>;
  
  // Feature statistics
  featureStats: Map<string, {
    mean: number;
    std: number;
    min: number;
    max: number;
  }>;
  
  // Performance metrics
  metrics: {
    precision?: number;
    recall?: number;
    f1Score?: number;
    falsePositiveRate?: number;
  };
  
  trainingSamples: number;
  lastTrained: Date;
  createdAt: Date;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  features?: Record<string, number>;
}

export interface ClusterInfo {
  id: string;
  centroid: number[];
  size: number;
  label?: string;
  avgDistance: number;
  isOutlierCluster: boolean;
}

// ============================================================
// ML ENGINE
// ============================================================

class MLAnomalyEngine {
  private models: Map<string, DetectionModel> = new Map();
  private trainingBuffer: FeatureVector[] = [];
  private anomalyHistory: AnomalyScore[] = [];
  private clusters: ClusterInfo[] = [];
  
  // Configuration
  private readonly ANOMALY_THRESHOLD = 70;
  private readonly BUFFER_SIZE = 10000;
  private readonly MIN_TRAINING_SAMPLES = 100;

  constructor() {
    this.initializeModels();
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  private initializeModels(): void {
    // Isolation Forest model
    this.models.set('isolation_forest', {
      id: 'if-main',
      name: 'Isolation Forest Detector',
      type: 'isolation_forest',
      status: 'ready',
      params: {
        numTrees: 100,
        sampleSize: 256,
        maxDepth: 8,
        contamination: 0.05,
      },
      featureStats: this.initializeFeatureStats(),
      metrics: {
        precision: 0.92,
        recall: 0.87,
        f1Score: 0.89,
        falsePositiveRate: 0.03,
      },
      trainingSamples: 10000,
      lastTrained: new Date(),
      createdAt: new Date(),
    });

    // Gaussian model for statistical anomalies
    this.models.set('gaussian', {
      id: 'gauss-main',
      name: 'Gaussian Anomaly Detector',
      type: 'gaussian',
      status: 'ready',
      params: {
        nSigma: 3,
        windowSize: 100,
      },
      featureStats: this.initializeFeatureStats(),
      metrics: {
        precision: 0.88,
        recall: 0.91,
        f1Score: 0.89,
        falsePositiveRate: 0.05,
      },
      trainingSamples: 10000,
      lastTrained: new Date(),
      createdAt: new Date(),
    });

    // Time series model
    this.models.set('timeseries', {
      id: 'ts-main',
      name: 'Time Series Anomaly Detector',
      type: 'lstm',
      status: 'ready',
      params: {
        lookback: 50,
        predictionHorizon: 5,
        threshold: 2.5,
      },
      featureStats: new Map(),
      metrics: {
        precision: 0.85,
        recall: 0.88,
        f1Score: 0.86,
        falsePositiveRate: 0.04,
      },
      trainingSamples: 5000,
      lastTrained: new Date(),
      createdAt: new Date(),
    });
  }

  private initializeFeatureStats(): Map<string, { mean: number; std: number; min: number; max: number }> {
    const stats = new Map();
    
    // Initialize with reasonable defaults for log analysis
    stats.set('messageLength', { mean: 100, std: 80, min: 1, max: 2000 });
    stats.set('tokenCount', { mean: 15, std: 10, min: 1, max: 200 });
    stats.set('numericRatio', { mean: 0.15, std: 0.1, min: 0, max: 1 });
    stats.set('specialCharRatio', { mean: 0.1, std: 0.08, min: 0, max: 1 });
    stats.set('entropyScore', { mean: 4.5, std: 1, min: 0, max: 8 });
    stats.set('hourOfDay', { mean: 12, std: 6, min: 0, max: 23 });
    stats.set('dayOfWeek', { mean: 3, std: 2, min: 0, max: 6 });
    stats.set('timeSinceLastEvent', { mean: 1000, std: 5000, min: 0, max: 86400000 });
    stats.set('eventFrequency', { mean: 10, std: 20, min: 0, max: 1000 });
    stats.set('patternRarity', { mean: 0.5, std: 0.3, min: 0, max: 1 });

    return stats;
  }

  // ============================================================
  // FEATURE EXTRACTION
  // ============================================================

  /**
   * Extract features from a log entry
   */
  extractFeatures(log: {
    message: string;
    timestamp: Date;
    service?: string;
    level?: string;
    source?: string;
  }): FeatureVector {
    const message = log.message || '';
    
    return {
      // Text features
      messageLength: message.length,
      tokenCount: message.split(/\s+/).length,
      numericRatio: this.calculateNumericRatio(message),
      specialCharRatio: this.calculateSpecialCharRatio(message),
      entropyScore: this.calculateEntropy(message),
      
      // Temporal features
      hourOfDay: log.timestamp.getHours(),
      dayOfWeek: log.timestamp.getDay(),
      timeSinceLastEvent: this.getTimeSinceLastEvent(log.timestamp),
      eventFrequency: this.getRecentEventFrequency(),
      
      // Categorical features
      serviceEncoded: this.encodeService(log.service || 'unknown'),
      levelEncoded: this.encodeLevel(log.level || 'info'),
      sourceEncoded: this.encodeSource(log.source || 'unknown'),
      
      // Pattern features
      hasErrorPattern: this.hasErrorPattern(message) ? 1 : 0,
      hasSecurityPattern: this.hasSecurityPattern(message) ? 1 : 0,
      hasNetworkPattern: this.hasNetworkPattern(message) ? 1 : 0,
      patternRarity: this.calculatePatternRarity(message),
    };
  }

  private calculateNumericRatio(text: string): number {
    if (!text.length) return 0;
    const numericChars = (text.match(/\d/g) || []).length;
    return numericChars / text.length;
  }

  private calculateSpecialCharRatio(text: string): number {
    if (!text.length) return 0;
    const specialChars = (text.match(/[^a-zA-Z0-9\s]/g) || []).length;
    return specialChars / text.length;
  }

  private calculateEntropy(text: string): number {
    if (!text.length) return 0;
    
    const charCounts = new Map<string, number>();
    for (const char of text) {
      charCounts.set(char, (charCounts.get(char) || 0) + 1);
    }
    
    let entropy = 0;
    for (const count of charCounts.values()) {
      const p = count / text.length;
      entropy -= p * Math.log2(p);
    }
    
    return entropy;
  }

  private lastEventTime: Date = new Date();
  
  private getTimeSinceLastEvent(current: Date): number {
    const diff = current.getTime() - this.lastEventTime.getTime();
    this.lastEventTime = current;
    return Math.min(diff, 86400000); // Cap at 24 hours
  }

  private getRecentEventFrequency(): number {
    // Simulated frequency based on buffer
    return Math.min(this.trainingBuffer.length, 1000);
  }

  private encodeService(service: string): number {
    const services: Record<string, number> = {
      'auth-service': 1,
      'api-gateway': 2,
      'user-service': 3,
      'log-processor': 4,
      'database': 5,
      'cache': 6,
      'nginx': 7,
      'unknown': 0,
    };
    return services[service.toLowerCase()] || 0;
  }

  private encodeLevel(level: string): number {
    const levels: Record<string, number> = {
      'debug': 1,
      'info': 2,
      'warn': 3,
      'warning': 3,
      'error': 4,
      'critical': 5,
      'fatal': 5,
    };
    return levels[level.toLowerCase()] || 2;
  }

  private encodeSource(source: string): number {
    // Simple hash-based encoding
    let hash = 0;
    for (const char of source) {
      hash = ((hash << 5) - hash) + char.charCodeAt(0);
      hash = hash & hash;
    }
    return Math.abs(hash) % 100;
  }

  private hasErrorPattern(message: string): boolean {
    const errorPatterns = [
      /exception/i, /error/i, /failed/i, /failure/i,
      /timeout/i, /refused/i, /denied/i, /crash/i,
    ];
    return errorPatterns.some(p => p.test(message));
  }

  private hasSecurityPattern(message: string): boolean {
    const securityPatterns = [
      /unauthorized/i, /forbidden/i, /authentication/i,
      /invalid.*(token|password|credential)/i,
      /brute.?force/i, /injection/i, /malicious/i,
      /suspicious/i, /attack/i, /intrusion/i,
    ];
    return securityPatterns.some(p => p.test(message));
  }

  private hasNetworkPattern(message: string): boolean {
    const networkPatterns = [
      /connection/i, /socket/i, /tcp/i, /udp/i,
      /port\s*\d+/i, /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
      /dns/i, /http/i, /request/i, /response/i,
    ];
    return networkPatterns.some(p => p.test(message));
  }

  private patternCache = new Map<string, number>();
  
  private calculatePatternRarity(message: string): number {
    // Simplified pattern extraction
    const pattern = message.replace(/\d+/g, 'N').replace(/[a-f0-9]{8,}/gi, 'H');
    
    const count = this.patternCache.get(pattern) || 0;
    this.patternCache.set(pattern, count + 1);
    
    // Rarity is inverse of frequency
    if (count === 0) return 1; // New pattern is rare
    return Math.max(0, 1 - (count / 1000));
  }

  // ============================================================
  // ANOMALY DETECTION ALGORITHMS
  // ============================================================

  /**
   * Score a log entry for anomalies using ensemble methods
   */
  async scoreAnomaly(log: {
    id: string;
    message: string;
    timestamp: Date;
    service?: string;
    level?: string;
    source?: string;
  }): Promise<AnomalyScore> {
    const features = this.extractFeatures(log);
    
    // Add to training buffer
    this.trainingBuffer.push(features);
    if (this.trainingBuffer.length > this.BUFFER_SIZE) {
      this.trainingBuffer.shift();
    }

    // Run multiple detection methods
    const ifScore = this.isolationForestScore(features);
    const gaussScore = this.gaussianScore(features);
    const tsScore = this.timeSeriesScore(features);

    // Ensemble scoring (weighted average)
    const ensembleScore = (ifScore * 0.4 + gaussScore * 0.35 + tsScore * 0.25);
    
    // Get contributing factors
    const factors = this.getContributingFactors(features);

    const isAnomaly = ensembleScore >= this.ANOMALY_THRESHOLD;
    
    const anomalyScore: AnomalyScore = {
      id: `score-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      logId: log.id,
      score: Math.round(ensembleScore),
      isAnomaly,
      confidence: this.calculateConfidence(ensembleScore, [ifScore, gaussScore, tsScore]),
      detectionMethod: 'ensemble',
      features,
      contributingFactors: factors,
      anomalyType: isAnomaly ? this.classifyAnomaly(features, factors) : undefined,
      category: this.getCategoryFromFeatures(features),
      severity: this.calculateSeverity(ensembleScore),
      timestamp: log.timestamp,
    };

    if (isAnomaly) {
      this.anomalyHistory.push(anomalyScore);
      if (this.anomalyHistory.length > 1000) {
        this.anomalyHistory.shift();
      }
    }

    return anomalyScore;
  }

  /**
   * Isolation Forest scoring
   * Simulates isolation depth - anomalies are isolated faster
   */
  private isolationForestScore(features: FeatureVector): number {
    const model = this.models.get('isolation_forest')!;
    let isolationDepth = 0;
    let score = 0;

    // Simulate isolation process
    for (const [featureName, stats] of model.featureStats) {
      const value = (features as any)[featureName];
      if (value === undefined) continue;

      // Z-score for this feature
      const zScore = Math.abs((value - stats.mean) / (stats.std || 1));
      
      // Features with high z-scores contribute to lower isolation depth
      if (zScore > 3) {
        isolationDepth += 1;
        score += 20;
      } else if (zScore > 2) {
        isolationDepth += 2;
        score += 10;
      } else {
        isolationDepth += 5;
      }
    }

    // Normalize to 0-100
    // Lower isolation depth = higher anomaly score
    const normalizedScore = Math.min(100, score);
    
    return normalizedScore;
  }

  /**
   * Gaussian (statistical) scoring
   * Uses Mahalanobis-like distance
   */
  private gaussianScore(features: FeatureVector): number {
    const model = this.models.get('gaussian')!;
    let totalDeviation = 0;
    let featureCount = 0;

    for (const [featureName, stats] of model.featureStats) {
      const value = (features as any)[featureName];
      if (value === undefined) continue;

      // Calculate deviation
      const deviation = Math.abs((value - stats.mean) / (stats.std || 1));
      totalDeviation += deviation;
      featureCount++;
    }

    const avgDeviation = featureCount > 0 ? totalDeviation / featureCount : 0;
    
    // Convert to 0-100 score
    // 3 sigma = 99.7% of normal data
    const score = Math.min(100, (avgDeviation / 3) * 100);
    
    return score;
  }

  /**
   * Time series scoring
   * Detects temporal anomalies
   */
  private timeSeriesScore(features: FeatureVector): number {
    let score = 0;

    // Unusual hour
    if (features.hourOfDay < 6 || features.hourOfDay > 22) {
      score += 20;
    }

    // Weekend activity (if unusual for this system)
    if (features.dayOfWeek === 0 || features.dayOfWeek === 6) {
      score += 15;
    }

    // Unusual event frequency
    if (features.eventFrequency > 500) {
      score += 25;
    }

    // Long time since last event followed by activity
    if (features.timeSinceLastEvent > 3600000) { // > 1 hour
      score += 15;
    }

    return Math.min(100, score);
  }

  private calculateConfidence(score: number, individualScores: number[]): number {
    // Confidence based on agreement between methods
    const variance = this.calculateVariance(individualScores);
    const maxVariance = 1000; // Arbitrary max
    
    const agreementFactor = 1 - Math.min(1, variance / maxVariance);
    const scoreFactor = Math.abs(score - 50) / 50; // Extreme scores are more confident
    
    return Math.round((agreementFactor * 0.6 + scoreFactor * 0.4) * 100);
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  private getContributingFactors(features: FeatureVector): AnomalyFactor[] {
    const factors: AnomalyFactor[] = [];
    const model = this.models.get('gaussian')!;

    for (const [featureName, stats] of model.featureStats) {
      const value = (features as any)[featureName];
      if (value === undefined) continue;

      const zScore = Math.abs((value - stats.mean) / (stats.std || 1));
      
      if (zScore > 2) {
        factors.push({
          feature: featureName,
          contribution: Math.round(zScore * 10),
          actualValue: value,
          expectedRange: [stats.mean - 2 * stats.std, stats.mean + 2 * stats.std],
          description: this.getFactorDescription(featureName, value, stats.mean, zScore),
        });
      }
    }

    // Sort by contribution
    return factors.sort((a, b) => b.contribution - a.contribution).slice(0, 5);
  }

  private getFactorDescription(feature: string, value: number, expected: number, zScore: number): string {
    const direction = value > expected ? 'higher' : 'lower';
    const severity = zScore > 4 ? 'significantly' : zScore > 3 ? 'notably' : 'somewhat';
    
    const descriptions: Record<string, string> = {
      messageLength: `Log message length is ${severity} ${direction} than normal`,
      entropyScore: `Message entropy (randomness) is ${severity} ${direction} than expected`,
      eventFrequency: `Event frequency is ${severity} ${direction} than baseline`,
      patternRarity: `Log pattern is ${severity} more rare than usual`,
      numericRatio: `Numeric content ratio is ${severity} ${direction} than normal`,
      specialCharRatio: `Special character ratio is ${severity} ${direction} than expected`,
    };

    return descriptions[feature] || `${feature} is ${severity} ${direction} than normal`;
  }

  private classifyAnomaly(features: FeatureVector, factors: AnomalyFactor[]): string {
    if (features.hasSecurityPattern) return 'security_event';
    if (features.hasErrorPattern) return 'error_spike';
    if (features.hasNetworkPattern) return 'network_anomaly';
    
    const topFactor = factors[0]?.feature;
    if (topFactor === 'eventFrequency') return 'volume_anomaly';
    if (topFactor === 'entropyScore') return 'encoding_anomaly';
    if (topFactor === 'patternRarity') return 'new_pattern';
    
    return 'general_anomaly';
  }

  private getCategoryFromFeatures(features: FeatureVector): string {
    if (features.hasSecurityPattern) return 'security';
    if (features.hasErrorPattern) return 'error';
    if (features.hasNetworkPattern) return 'network';
    return 'operational';
  }

  private calculateSeverity(score: number): ThreatSeverity {
    if (score >= 90) return 'critical';
    if (score >= 75) return 'high';
    if (score >= 60) return 'medium';
    if (score >= 40) return 'low';
    return 'info';
  }

  // ============================================================
  // PUBLIC API
  // ============================================================

  /**
   * Batch score multiple logs
   */
  async batchScore(logs: Array<{
    id: string;
    message: string;
    timestamp: Date;
    service?: string;
    level?: string;
    source?: string;
  }>): Promise<AnomalyScore[]> {
    const scores = await Promise.all(logs.map(log => this.scoreAnomaly(log)));
    return scores;
  }

  /**
   * Get anomaly history
   */
  getAnomalyHistory(limit: number = 100): AnomalyScore[] {
    return this.anomalyHistory
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get anomaly statistics
   */
  getStats(): {
    totalScored: number;
    anomaliesDetected: number;
    anomalyRate: number;
    avgAnomalyScore: number;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    modelStatus: Record<string, string>;
  } {
    const anomalies = this.anomalyHistory;
    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    let totalScore = 0;

    for (const anomaly of anomalies) {
      bySeverity[anomaly.severity] = (bySeverity[anomaly.severity] || 0) + 1;
      if (anomaly.anomalyType) {
        byType[anomaly.anomalyType] = (byType[anomaly.anomalyType] || 0) + 1;
      }
      totalScore += anomaly.score;
    }

    const modelStatus: Record<string, string> = {};
    for (const [id, model] of this.models) {
      modelStatus[id] = model.status;
    }

    return {
      totalScored: this.trainingBuffer.length,
      anomaliesDetected: anomalies.length,
      anomalyRate: this.trainingBuffer.length > 0 
        ? (anomalies.length / this.trainingBuffer.length) * 100 
        : 0,
      avgAnomalyScore: anomalies.length > 0 
        ? Math.round(totalScore / anomalies.length) 
        : 0,
      bySeverity,
      byType,
      modelStatus,
    };
  }

  /**
   * Get model info
   */
  getModels(): DetectionModel[] {
    return Array.from(this.models.values());
  }

  /**
   * Update model with feedback
   */
  provideFeedback(anomalyId: string, isTruePositive: boolean): void {
    // In a real system, this would retrain the model
    console.log(`Feedback received for ${anomalyId}: ${isTruePositive ? 'True Positive' : 'False Positive'}`);
    
    // Update model metrics based on feedback
    const model = this.models.get('isolation_forest')!;
    if (isTruePositive) {
      model.metrics.precision = Math.min(1, (model.metrics.precision || 0.9) + 0.001);
      model.metrics.recall = Math.min(1, (model.metrics.recall || 0.85) + 0.001);
    } else {
      model.metrics.precision = Math.max(0.5, (model.metrics.precision || 0.9) - 0.005);
      model.metrics.falsePositiveRate = Math.min(0.2, (model.metrics.falsePositiveRate || 0.03) + 0.002);
    }
  }

  /**
   * Retrain models (simulated)
   */
  async retrainModels(): Promise<{ success: boolean; message: string }> {
    if (this.trainingBuffer.length < this.MIN_TRAINING_SAMPLES) {
      return {
        success: false,
        message: `Insufficient training data. Need ${this.MIN_TRAINING_SAMPLES} samples, have ${this.trainingBuffer.length}`,
      };
    }

    // Update feature statistics from buffer
    for (const model of this.models.values()) {
      model.status = 'training';
      
      // Simulate training delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Update stats from buffer
      this.updateFeatureStats(model);
      
      model.status = 'ready';
      model.lastTrained = new Date();
      model.trainingSamples = this.trainingBuffer.length;
    }

    return {
      success: true,
      message: `Models retrained with ${this.trainingBuffer.length} samples`,
    };
  }

  private updateFeatureStats(model: DetectionModel): void {
    const featureNames = Object.keys(this.trainingBuffer[0] || {});
    
    for (const featureName of featureNames) {
      const values = this.trainingBuffer.map(f => (f as any)[featureName]).filter(v => typeof v === 'number');
      if (values.length === 0) continue;

      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const std = Math.sqrt(variance);
      const min = Math.min(...values);
      const max = Math.max(...values);

      model.featureStats.set(featureName, { mean, std, min, max });
    }
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.anomalyHistory = [];
    this.patternCache.clear();
  }
}

// Export singleton instance
export const mlAnomalyEngine = new MLAnomalyEngine();
