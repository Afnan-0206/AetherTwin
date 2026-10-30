import { describe, it, expect } from 'vitest';
import { rk4Step, simulateTrajectory } from '../lib/physics/rk4';
import { pendulumDerivatives, calculateEnergy } from '../lib/physics/dampedPendulum';

describe('Damped Pendulum RK4 Integrator', () => {
  it('conserves total mechanical energy when damping is zero (small angle regime)', () => {
    const params = {
      omega0Sq: 9.81 / 1.0, // L = 1.0m, g = 9.81
      damping: 0.0,
      initialAngle: 0.1, // 0.1 rad (~5.7 deg)
      initialVelocity: 0.0,
      length: 1.0,
      gravity: 9.81
    };

    const timestamps = Array.from({ length: 100 }, (_, i) => i * 0.02); // 2 seconds
    const trajectory = simulateTrajectory(timestamps, params, 0.001);

    expect(trajectory).toHaveLength(100);

    const initialEnergy = trajectory[0].energyTotal!;
    for (let i = 1; i < trajectory.length; i++) {
      const currentEnergy = trajectory[i].energyTotal!;
      // RK4 energy drift should be less than 0.05% over 2 seconds
      const relativeDrift = Math.abs(currentEnergy - initialEnergy) / initialEnergy;
      expect(relativeDrift).toBeLessThan(0.0005);
    }
  });

  it('monotonically dissipates mechanical energy when damping is positive', () => {
    const params = {
      omega0Sq: 19.62,
      damping: 0.5,
      initialAngle: 0.5,
      initialVelocity: 0.0,
      length: 0.5,
      gravity: 9.81
    };

    const timestamps = Array.from({ length: 60 }, (_, i) => i * 0.05); // 3 seconds
    const trajectory = simulateTrajectory(timestamps, params, 0.001);

    expect(trajectory[trajectory.length - 1].energyTotal!).toBeLessThan(
      trajectory[0].energyTotal!
    );
    // Amplitude should decay
    expect(Math.abs(trajectory[trajectory.length - 1].theta)).toBeLessThan(
      Math.abs(trajectory[0].theta)
    );
  });

  it('evaluates derivatives accurately', () => {
    const deriv = pendulumDerivatives(0, 2.0, { omega0Sq: 10, damping: 0.5 });
    expect(deriv.dTheta).toBe(2.0);
    // at theta = 0, sin(0) = 0, so dOmega = -c * omega = -0.5 * 2.0 = -1.0
    expect(deriv.dOmega).toBe(-1.0);
  });
});
