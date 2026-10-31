import { describe, it, expect } from 'vitest';
import {
  BENCHMARK_PRESETS,
  generateSyntheticPendulumSample
} from '../lib/sample/syntheticPendulum';
import { fitDampedPendulum } from '../lib/physics/parameterFitter';
import { rk4Step } from '../lib/physics/rk4';

describe('Benchmark Presets & Quadratic Drag Integration', () => {
  it('defines 8 unique multi-domain benchmark scenarios with valid physical parameters', () => {
    expect(BENCHMARK_PRESETS.length).toBe(8);
    const ids = BENCHMARK_PRESETS.map((p) => p.id);
    expect(ids).toContain('standard');
    expect(ids).toContain('nonlinear_large_amp');
    expect(ids).toContain('overdamped');
    expect(ids).toContain('lunar_gravity');
    expect(ids).toContain('aerodynamic_drag');
    expect(ids).toContain('taipei_101_tmd');
    expect(ids).toContain('rocket_landing_tvc');
    expect(ids).toContain('polymer_rheometer');
  });

  it('generates and fits the Large-Amplitude Non-Linear sample (theta_0 = 75 deg)', () => {
    const sample = generateSyntheticPendulumSample('nonlinear_large_amp');
    expect(sample.measurements.length).toBe(120);

    const fit = fitDampedPendulum(sample.measurements, sample.calibration);
    expect(fit.parameters.omega0Sq).toBeGreaterThan(15.0);
    expect(fit.parameters.omega0Sq).toBeLessThan(25.0);
    expect(fit.metrics.holdoutRmseDeg).toBeLessThan(2.0);
    expect(fit.metrics.errorReductionPercent).toBeGreaterThan(85.0);
  });

  it('generates and fits the Lunar Gravity sample (g = 1.62 m/s^2)', () => {
    const sample = generateSyntheticPendulumSample('lunar_gravity');
    expect(sample.calibration.knownLengthMeters).toBe(0.65);

    const fit = fitDampedPendulum(sample.measurements, sample.calibration);
    // omega0Sq = 1.62 / 0.65 ~= 2.49
    expect(fit.parameters.omega0Sq).toBeGreaterThan(1.5);
    expect(fit.parameters.omega0Sq).toBeLessThan(4.5);
    expect(fit.metrics.errorReductionPercent).toBeGreaterThan(80.0);
  });

  it('correctly integrates quadratic drag in rk4Step', () => {
    const paramsLinear = { omega0Sq: 20.0, damping: 0.1 };
    const paramsQuadratic = { omega0Sq: 20.0, damping: 0.1, dampingQuadratic: 0.2 };

    const initialTheta = 0.5;
    const initialOmega = 3.0;
    const dt = 0.01;

    const stepLinear = rk4Step(initialTheta, initialOmega, dt, paramsLinear);
    const stepQuad = rk4Step(initialTheta, initialOmega, dt, paramsQuadratic);

    // Quadratic drag opposes motion with c2 * |omega| * omega, so next omega should be smaller
    expect(stepQuad.omega).toBeLessThan(stepLinear.omega);
  });
});

