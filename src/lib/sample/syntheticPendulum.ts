import {
  BoundingBox,
  FrameMeasurement,
  PendulumParameters,
  Point2D,
  CalibrationConfig,
  BenchmarkPresetId,
  BenchmarkPresetInfo
} from '../types';
import { simulateTrajectory } from '../physics/rk4';
import { radToDeg, degToRad } from '../physics/dampedPendulum';

export interface SyntheticSampleData {
  name: string;
  description: string;
  provenance: string;
  presetId: BenchmarkPresetId;
  groundTruthParameters: PendulumParameters & { lengthMeters: number; gravityActual: number };
  calibration: CalibrationConfig;
  videoMetadata: {
    width: number;
    height: number;
    fps: number;
    durationSec: number;
    frameCount: number;
  };
  measurements: FrameMeasurement[];
}

export const BENCHMARK_PRESETS: BenchmarkPresetInfo[] = [
  {
    id: 'standard',
    name: 'Standard Earth Lab Pendulum',
    tagline: 'L = 0.50m • Earth g = 9.81 m/s² • Linear Viscous Drag',
    description: 'Underdamped harmonic oscillation with known ground truth and sub-pixel camera jitter.',
    initialAngleDeg: 31.5,
    lengthMeters: 0.50,
    damping: 0.15,
    gravity: 9.80665
  },
  {
    id: 'nonlinear_large_amp',
    name: 'Large-Amplitude Non-Linear Swing',
    tagline: 'θ₀ = 75° • Non-linear Period Dilation [sin(θ) ≠ θ]',
    description: 'Tests RK4 integration under extreme initial angle where small-angle linear approximations break down.',
    initialAngleDeg: 75.0,
    lengthMeters: 0.50,
    damping: 0.12,
    gravity: 9.80665
  },
  {
    id: 'overdamped',
    name: 'High-Viscosity Viscous Damping',
    tagline: 'High Damping c = 7.5 s⁻¹ • Monotonic Exponential Decay',
    description: 'Near-critically damped regime demonstrating rapid kinetic energy dissipation without zero crossings.',
    initialAngleDeg: 35.0,
    lengthMeters: 0.50,
    damping: 7.5,
    gravity: 9.80665
  },
  {
    id: 'lunar_gravity',
    name: 'Lunar Digital Twin (Moon Gravity)',
    tagline: 'Moon g = 1.62 m/s² • L = 0.65m • Low Resistance',
    description: 'Simulates low-gravity counterfactual dynamics with elongated natural period (T ≈ 4.0 seconds).',
    initialAngleDeg: 28.0,
    lengthMeters: 0.65,
    damping: 0.04,
    gravity: 1.62
  },
  {
    id: 'aerodynamic_drag',
    name: 'Quadratic Aerodynamic Drag',
    tagline: 'v² Air Drag c₂ = 0.08 • Non-linear Dissipation',
    description: 'Realistic macroscopic pendulum in air where velocity-squared drag dominates high-speed swing phases.',
    initialAngleDeg: 60.0,
    lengthMeters: 0.50,
    damping: 0.06,
    dampingQuadratic: 0.08,
    gravity: 9.80665
  }
];

/**
 * Deterministic pseudo-random number generator (Mulberry32) for reproducible sensor jitter.
 */
function seededRandom(seed: number): () => number {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates the built-in deterministic synthetic pendulum reference dataset.
 * Supports multiple physical presets (Standard, Non-Linear, Overdamped, Lunar, Aerodynamic Drag).
 */
export function generateSyntheticPendulumSample(
  presetId: BenchmarkPresetId = 'standard'
): SyntheticSampleData {
  const preset = BENCHMARK_PRESETS.find((p) => p.id === presetId) || BENCHMARK_PRESETS[0];

  const width = 640;
  const height = 480;
  const fps = 30;
  const frameCount = 120; // 4.0 seconds
  const pivot: Point2D = { x: 320, y: 70 };
  const rodLengthPx = 250;
  const knownLengthMeters = preset.lengthMeters;
  const scalePixelsPerMeter = rodLengthPx / knownLengthMeters;

  // Ground truth physics from preset
  const g = preset.gravity;
  const omega0Sq = g / knownLengthMeters;
  const damping = preset.damping;
  const dampingQuadratic = preset.dampingQuadratic ?? 0;
  const initialAngle = degToRad(preset.initialAngleDeg);
  const initialVelocity = 0.0;

  const groundTruthParameters = {
    omega0Sq,
    damping,
    dampingQuadratic: dampingQuadratic > 0 ? dampingQuadratic : undefined,
    initialAngle,
    initialVelocity,
    length: knownLengthMeters,
    gravity: g,
    lengthMeters: knownLengthMeters,
    gravityActual: g
  };

  const timestamps = Array.from({ length: frameCount }, (_, i) => i / fps);

  // High-precision RK4 simulation
  const states = simulateTrajectory(timestamps, groundTruthParameters, 0.0005);

  const rand = seededRandom(42 + preset.id.length * 7);
  const measurements: FrameMeasurement[] = [];

  for (let i = 0; i < frameCount; i++) {
    const t = timestamps[i];
    const trueAngle = states[i].theta;

    // Sub-pixel sensor noise: +/- 0.003 rad (~0.17 deg)
    const noiseRad = (rand() - 0.5) * 0.006;
    const measuredAngleRad = trueAngle + noiseRad;
    const measuredAngleDeg = radToDeg(measuredAngleRad);

    // Calculate bob position in video coordinates
    const bobX = pivot.x + rodLengthPx * Math.sin(measuredAngleRad);
    const bobY = pivot.y + rodLengthPx * Math.cos(measuredAngleRad);

    const bobRadius = 18;
    const bobBox: BoundingBox = {
      x: Math.round(bobX - bobRadius),
      y: Math.round(bobY - bobRadius),
      width: bobRadius * 2,
      height: bobRadius * 2
    };

    // SVG path for a circular bob mask
    const maskSvgPath = `M ${bobX} ${bobY - bobRadius} A ${bobRadius} ${bobRadius} 0 1 1 ${bobX - 0.001} ${bobY - bobRadius} Z`;

    measurements.push({
      frameIndex: i,
      timestamp: Number(t.toFixed(4)),
      bobCentroid: { x: Number(bobX.toFixed(2)), y: Number(bobY.toFixed(2)) },
      pivot,
      angleRad: Number(measuredAngleRad.toFixed(5)),
      angleDeg: Number(measuredAngleDeg.toFixed(2)),
      bobBox,
      maskSvgPath,
      confidence: 0.985 - rand() * 0.02
    });
  }

  return {
    name: preset.name,
    description: preset.description,
    provenance: `Built-in sample [${preset.id}] — synthetic reference data (not real camera evidence)`,
    presetId: preset.id,
    groundTruthParameters,
    calibration: {
      pivot,
      knownLengthMeters,
      scalePixelsPerMeter,
      videoFps: fps
    },
    videoMetadata: {
      width,
      height,
      fps,
      durationSec: frameCount / fps,
      frameCount
    },
    measurements
  };
}
