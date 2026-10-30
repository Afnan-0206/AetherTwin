import { PendulumParameters, SimulationState } from '../types';
import { pendulumDerivatives, calculateEnergy } from './dampedPendulum';

/**
 * Perform a single Runge-Kutta 4th order (RK4) integration step.
 *
 * State: [theta, omega]
 * Step size: dt (seconds)
 */
export function rk4Step(
  theta: number,
  omega: number,
  dt: number,
  params: Pick<PendulumParameters, 'omega0Sq' | 'damping'> & { dampingQuadratic?: number }
): { theta: number; omega: number } {
  // k1 = f(t, y)
  const k1 = pendulumDerivatives(theta, omega, params);

  // k2 = f(t + dt/2, y + dt/2 * k1)
  const thetaK2 = theta + 0.5 * dt * k1.dTheta;
  const omegaK2 = omega + 0.5 * dt * k1.dOmega;
  const k2 = pendulumDerivatives(thetaK2, omegaK2, params);

  // k3 = f(t + dt/2, y + dt/2 * k2)
  const thetaK3 = theta + 0.5 * dt * k2.dTheta;
  const omegaK3 = omega + 0.5 * dt * k2.dOmega;
  const k3 = pendulumDerivatives(thetaK3, omegaK3, params);

  // k4 = f(t + dt, y + dt * k3)
  const thetaK4 = theta + dt * k3.dTheta;
  const omegaK4 = omega + dt * k3.dOmega;
  const k4 = pendulumDerivatives(thetaK4, omegaK4, params);

  const nextTheta = theta + (dt / 6) * (k1.dTheta + 2 * k2.dTheta + 2 * k3.dTheta + k4.dTheta);
  const nextOmega = omega + (dt / 6) * (k1.dOmega + 2 * k2.dOmega + 2 * k3.dOmega + k4.dOmega);

  return { theta: nextTheta, omega: nextOmega };
}

/**
 * Simulates the pendulum state across a series of target timestamps.
 * Uses sub-stepping (maximum substep h <= maxDt) to ensure high numerical stability.
 */
export function simulateTrajectory(
  timestamps: number[],
  params: PendulumParameters,
  maxDt: number = 0.002
): SimulationState[] {
  if (timestamps.length === 0) return [];

  const results: SimulationState[] = [];
  let currentTheta = params.initialAngle;
  let currentOmega = params.initialVelocity;
  let currentTime = timestamps[0];

  const firstEnergy = calculateEnergy(currentTheta, currentOmega, params);
  const firstDeriv = pendulumDerivatives(currentTheta, currentOmega, params);

  results.push({
    t: currentTime,
    theta: currentTheta,
    omega: currentOmega,
    alpha: firstDeriv.dOmega,
    energyKinetic: firstEnergy.kinetic,
    energyPotential: firstEnergy.potential,
    energyTotal: firstEnergy.total
  });

  for (let i = 1; i < timestamps.length; i++) {
    const targetTime = timestamps[i];
    const totalStep = targetTime - currentTime;

    if (totalStep > 0) {
      // Divide totalStep into sub-steps of size <= maxDt
      const numSubsteps = Math.max(1, Math.ceil(totalStep / maxDt));
      const dt = totalStep / numSubsteps;

      for (let s = 0; s < numSubsteps; s++) {
        const next = rk4Step(currentTheta, currentOmega, dt, params);
        currentTheta = next.theta;
        currentOmega = next.omega;
      }
      currentTime = targetTime;
    }

    const energy = calculateEnergy(currentTheta, currentOmega, params);
    const deriv = pendulumDerivatives(currentTheta, currentOmega, params);

    results.push({
      t: currentTime,
      theta: currentTheta,
      omega: currentOmega,
      alpha: deriv.dOmega,
      energyKinetic: energy.kinetic,
      energyPotential: energy.potential,
      energyTotal: energy.total
    });
  }

  return results;
}
