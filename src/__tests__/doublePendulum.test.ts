import { describe, it, expect } from 'vitest';
import {
  rk4StepDoublePendulum,
  calculateDoublePendulumEnergy,
  simulateDoublePendulumChaos,
  DoublePendulumParams
} from '../lib/physics/doublePendulum';

describe('Double Pendulum (2-DOF) Chaos & Lyapunov Dynamics', () => {
  const baseParams: DoublePendulumParams = {
    l1: 0.5,
    l2: 0.5,
    m1: 0.2,
    m2: 0.2,
    gravity: 9.81,
    damping1: 0.0,
    damping2: 0.0
  };

  it('computes valid finite RK4 integration step without NaN or Inf', () => {
    const next = rk4StepDoublePendulum(0.5, 0.0, 0.5, 0.0, 0.01, baseParams);
    expect(Number.isFinite(next.theta1)).toBe(true);
    expect(Number.isFinite(next.omega1)).toBe(true);
    expect(Number.isFinite(next.theta2)).toBe(true);
    expect(Number.isFinite(next.omega2)).toBe(true);
  });

  it('conserves total mechanical energy in undamped regime over 2 seconds', () => {
    let th1 = 0.4;
    let om1 = 0.0;
    let th2 = 0.4;
    let om2 = 0.0;
    const dt = 0.001; // fine step
    const steps = 2000;

    const initialEnergy = calculateDoublePendulumEnergy(th1, om1, th2, om2, baseParams);

    for (let i = 0; i < steps; i++) {
      const next = rk4StepDoublePendulum(th1, om1, th2, om2, dt, baseParams);
      th1 = next.theta1;
      om1 = next.omega1;
      th2 = next.theta2;
      om2 = next.omega2;
    }

    const finalEnergy = calculateDoublePendulumEnergy(th1, om1, th2, om2, baseParams);
    const relativeDrift = Math.abs(finalEnergy - initialEnergy) / Math.abs(initialEnergy);

    // Energy drift for RK4 with dt=0.001 over 2s should be less than 0.05%
    expect(relativeDrift).toBeLessThan(0.0005);
  });

  it('monotonically dissipates energy when joint damping is applied', () => {
    const dampedParams: DoublePendulumParams = {
      ...baseParams,
      damping1: 0.2,
      damping2: 0.2
    };

    let th1 = 1.0;
    let om1 = 0.0;
    let th2 = 1.0;
    let om2 = 0.0;
    const dt = 0.001;
    const steps = 3000;

    const initialEnergy = calculateDoublePendulumEnergy(th1, om1, th2, om2, dampedParams);

    for (let i = 0; i < steps; i++) {
      const next = rk4StepDoublePendulum(th1, om1, th2, om2, dt, dampedParams);
      th1 = next.theta1;
      om1 = next.omega1;
      th2 = next.theta2;
      om2 = next.omega2;
    }

    const finalEnergy = calculateDoublePendulumEnergy(th1, om1, th2, om2, dampedParams);
    expect(finalEnergy).toBeLessThan(initialEnergy);
  });

  it('demonstrates chaos and finite Lyapunov prediction horizon under high amplitude', () => {
    // High initial angles lead to strong non-linear chaotic behavior and flips
    const result = simulateDoublePendulumChaos(
      Math.PI * 0.8,
      Math.PI * 0.8,
      { ...baseParams, damping1: 0.01, damping2: 0.01 },
      6.0,
      60
    );

    expect(result.statesPrimary.length).toBe(360);
    expect(result.statesPerturbed.length).toBe(360);
    // Perturbation of 1e-5 rad exponentially diverges in chaotic regime
    expect(result.maxLyapunovExponent).toBeGreaterThan(0.5);
    expect(result.isChaotic).toBe(true);
    expect(result.horizonReached).toBe(true);
    // Lyapunov horizon should be reached before end of 6-second simulation
    expect(result.lyapunovHorizonSeconds).toBeLessThan(6.0);
  });

  it('identifies non-chaotic small amplitude regime where horizon is not reached within duration', () => {
    const result = simulateDoublePendulumChaos(
      0.05,
      0.05,
      { ...baseParams, damping1: 0.02, damping2: 0.02 },
      6.0,
      60
    );

    expect(result.horizonReached).toBe(false);
    expect(result.isChaotic).toBe(false);
  });
});
