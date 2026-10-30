import { describe, it, expect } from 'vitest';
import { fitDampedPendulum } from '../lib/physics/parameterFitter';
import { generateSyntheticPendulumSample } from '../lib/sample/syntheticPendulum';

describe('Deterministic Parameter Fitter & Holdout Validation', () => {
  it('strictly isolates the first 70% for training and leaves 30% for holdout test', () => {
    const sample = generateSyntheticPendulumSample();
    const fitResult = fitDampedPendulum(sample.measurements, sample.calibration);

    expect(fitResult.trainCount).toBe(84); // 70% of 120
    expect(fitResult.holdoutCount).toBe(36); // 30% of 120
    expect(fitResult.trainCount + fitResult.holdoutCount).toBe(120);

    // Verify comparison points flag
    const trainPoints = fitResult.comparisonPoints.filter((p) => p.isTrain);
    const holdoutPoints = fitResult.comparisonPoints.filter((p) => !p.isTrain);

    expect(trainPoints).toHaveLength(84);
    expect(holdoutPoints).toHaveLength(36);
  });

  it('accurately recovers ground truth physical parameters from synthetic sample', () => {
    const sample = generateSyntheticPendulumSample();
    const groundTruth = sample.groundTruthParameters;

    const fitResult = fitDampedPendulum(sample.measurements, sample.calibration);

    // Omega0Sq true is ~19.61
    expect(fitResult.parameters.omega0Sq).toBeGreaterThan(18.0);
    expect(fitResult.parameters.omega0Sq).toBeLessThan(21.0);

    // Damping true is 0.15
    expect(fitResult.parameters.damping).toBeGreaterThan(0.08);
    expect(fitResult.parameters.damping).toBeLessThan(0.25);

    // Initial angle true is 0.55 rad (~31.5 deg)
    expect(fitResult.parameters.initialAngle).toBeCloseTo(groundTruth.initialAngle, 1);

    // Holdout RMSE should be low (< 2.0 degrees) and beat baseline by > 75%
    expect(fitResult.metrics.holdoutRmseDeg).toBeLessThan(2.0);
    expect(fitResult.metrics.errorReductionPercent).toBeGreaterThan(75);
    expect(fitResult.identificationQuality).toBe('confident');
  });

  it('throws helpful error when measurements are insufficient (< 15 frames)', () => {
    const sample = generateSyntheticPendulumSample();
    const tiny = sample.measurements.slice(0, 10);

    expect(() => fitDampedPendulum(tiny)).toThrow(/Insufficient measurement frames/);
  });

  it('rejects static zero-motion series with clear physical limitation explanation', () => {
    const staticSeries = Array.from({ length: 30 }, (_, i) => ({
      frameIndex: i,
      timestamp: i * 0.033,
      bobCentroid: { x: 320, y: 320 },
      pivot: { x: 320, y: 70 },
      angleRad: 0.0001,
      angleDeg: 0.005
    }));

    expect(() => fitDampedPendulum(staticSeries)).toThrow(/Static or near-zero motion/);
  });
});
