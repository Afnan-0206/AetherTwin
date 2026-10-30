/**
 * AetherTwin Core Domain Types
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FrameMeasurement {
  frameIndex: number;
  timestamp: number; // in seconds
  bobCentroid: Point2D; // in video pixels
  pivot: Point2D; // in video pixels
  angleRad: number; // angle from vertical downward (radians)
  angleDeg: number;
  bobBox?: BoundingBox;
  maskSvgPath?: string;
  maskBounds?: { left: number; top: number; right: number; bottom: number };
  confidence?: number;
}

export interface PendulumParameters {
  omega0Sq: number; // natural frequency squared g/L (s^-2)
  damping: number; // linear damping coefficient c_1 (s^-1)
  dampingQuadratic?: number; // quadratic aerodynamic drag coefficient c_2 (rad^-1)
  dragModel?: 'viscous_linear' | 'aerodynamic_quadratic' | 'combined';
  omega0SqUncertainty?: number; // +/- 1-sigma uncertainty
  dampingUncertainty?: number; // +/- 1-sigma uncertainty
  initialAngle: number; // theta_0 (rad)
  initialVelocity: number; // omega_0 (rad/s)
  length?: number; // L in meters if calibrated
  gravity?: number; // g in m/s^2 if length is calibrated (g = omega0Sq * L)
}

export interface SimulationState {
  t: number;
  theta: number; // rad
  omega: number; // rad/s
  alpha: number; // rad/s^2
  energyKinetic?: number; // J or relative units
  energyPotential?: number; // J or relative units
  energyTotal?: number;
}

export interface ValidationMetrics {
  trainMaeRad: number;
  trainMseRad: number;
  trainRmseRad: number;
  trainMaeDeg: number;
  trainRmseDeg: number;

  holdoutMaeRad: number;
  holdoutMseRad: number;
  holdoutRmseRad: number;
  holdoutMaeDeg: number;
  holdoutRmseDeg: number;

  // Baseline comparison (persistence / linear baseline)
  baselineHoldoutMaeRad: number;
  baselineHoldoutRmseRad: number;
  baselineHoldoutMaeDeg: number;
  baselineHoldoutRmseDeg: number;
  errorReductionPercent: number; // improvement over baseline
}

export interface TrajectoryComparisonPoint {
  timestamp: number;
  frameIndex: number;
  isTrain: boolean; // true if in 70% fit set, false if in 30% holdout
  measuredAngleDeg: number;
  predictedAngleDeg: number;
  baselineAngleDeg: number;
  residualDeg: number; // predicted - measured
  measuredOmegaDeg?: number;
  predictedOmegaDeg?: number;
  energyKinetic?: number;
  energyPotential?: number;
  energyTotal?: number;
}

export type ProvenanceKind = 'OBSERVED' | 'CALCULATED' | 'MODEL_GENERATED';

export interface ProvenanceLogEntry {
  id: string;
  timestamp: string;
  kind: ProvenanceKind;
  category: string;
  summary: string;
  details?: Record<string, any>;
}

export interface MuseSparkDiagnostic {
  summary: string;
  dampingRegime: 'underdamped' | 'critically_damped' | 'overdamped';
  qualityAssessment: 'high_fidelity' | 'moderate_drift' | 'noisy_measurements' | 'unsupported_geometry';
  observedPhenomena: string[];
  physicalExplanations: string[];
  limitations: string[];
  suggestedAdjustments?: {
    suggestedDamping?: number;
    suggestedGravity?: number;
    confidence: number;
    reasoning: string;
  };
}

export interface CalibrationConfig {
  pivot: Point2D;
  knownLengthMeters: number | null; // null if relative/unknown
  scalePixelsPerMeter: number | null;
  videoFps: number;
  autoDetectedPivot?: Point2D;
  arcRadiusPixels?: number;
  arcFitRmse?: number;
}

export type BenchmarkPresetId =
  | 'standard'
  | 'nonlinear_large_amp'
  | 'overdamped'
  | 'lunar_gravity'
  | 'aerodynamic_drag';

export interface BenchmarkPresetInfo {
  id: BenchmarkPresetId;
  name: string;
  tagline: string;
  description: string;
  initialAngleDeg: number;
  lengthMeters: number;
  damping: number;
  dampingQuadratic?: number;
  gravity: number;
}

export type PipelineStage = 
  | 'idle'
  | 'video_loaded'
  | 'segmenting'
  | 'measuring'
  | 'fitting'
  | 'validating'
  | 'diagnosing'
  | 'completed'
  | 'error';
