import { PendulumParameters, SimulationState } from '../types';

/**
 * Evaluates the angular acceleration theta'' for a damped simple pendulum:
 *   theta'' = -omega0Sq * sin(theta) - damping * theta' - dampingQuadratic * |theta'| * theta'
 *
 * where:
 *   omega0Sq = g / L (s^-2)
 *   damping  = linear viscous damping c_1 (s^-1)
 *   dampingQuadratic = quadratic aerodynamic drag c_2 (rad^-1)
 */
export function pendulumDerivatives(
  theta: number,
  omega: number,
  params: Pick<PendulumParameters, 'omega0Sq' | 'damping'> & { dampingQuadratic?: number }
): { dTheta: number; dOmega: number } {
  const dTheta = omega;
  const quadraticTerm = params.dampingQuadratic
    ? params.dampingQuadratic * Math.abs(omega) * omega
    : 0;
  const dOmega = -params.omega0Sq * Math.sin(theta) - params.damping * omega - quadraticTerm;
  return { dTheta, dOmega };
}

/**
 * Calculates mechanical energy of the pendulum (per unit mass, or with known mass).
 * Potential: V(theta) = g * L * (1 - cos(theta)) = omega0Sq * L^2 * (1 - cos(theta))
 * Kinetic:   T(omega) = 0.5 * (L * omega)^2
 */
export function calculateEnergy(
  theta: number,
  omega: number,
  params: PendulumParameters,
  massKg: number = 1.0
): { kinetic: number; potential: number; total: number } {
  const length = params.length ?? 1.0;
  // If gravity is calibrated, use it, else omega0Sq * length
  const g = params.gravity ?? params.omega0Sq * length;

  const potential = massKg * g * length * (1 - Math.cos(theta));
  const kinetic = 0.5 * massKg * Math.pow(length * omega, 2);
  const total = potential + kinetic;

  return { kinetic, potential, total };
}

/**
 * Calculates instantaneous mechanical energy dissipation rate dE/dt (Watts).
 * dE/dt = -mass * L^2 * omega^2 * (c_1 + c_2 * |omega|)
 */
export function calculateDissipationRate(
  omega: number,
  params: PendulumParameters,
  massKg: number = 1.0
): number {
  const length = params.length ?? 1.0;
  const c1 = params.damping;
  const c2 = params.dampingQuadratic ?? 0;
  return -massKg * Math.pow(length * omega, 2) * (c1 + c2 * Math.abs(omega));
}

/**
 * Normalizes an angle to [-PI, PI]
 */
export function normalizeAngle(rad: number): number {
  let angle = rad % (2 * Math.PI);
  if (angle > Math.PI) angle -= 2 * Math.PI;
  if (angle < -Math.PI) angle += 2 * Math.PI;
  return angle;
}

/**
 * Convert radians to degrees
 */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/**
 * Convert degrees to radians
 */
export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
