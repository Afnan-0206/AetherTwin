/**
 * Double Pendulum (2-DOF) Non-Linear Chaotic Dynamics & Lyapunov Horizon Solver
 * Evaluates exponential trajectory divergence and mathematical limits of digital twins.
 */

export interface DoublePendulumState {
  t: number;
  theta1: number; // rad
  omega1: number; // rad/s
  alpha1: number; // rad/s^2
  theta2: number; // rad
  omega2: number; // rad/s
  alpha2: number; // rad/s^2
  energyTotal: number;
  divergenceRad?: number; // separation from perturbed twin
  lyapunovExponent?: number;
}

export interface DoublePendulumParams {
  l1: number; // meters
  l2: number;
  m1: number; // kg
  m2: number;
  gravity: number; // m/s^2
  damping1?: number; // joint 1 damping (s^-1)
  damping2?: number; // joint 2 damping (s^-1)
}

export interface ChaosHorizonResult {
  statesPrimary: DoublePendulumState[];
  statesPerturbed: DoublePendulumState[];
  lyapunovHorizonSeconds: number; // Time when divergence exceeds 5.0 deg (0.087 rad)
  maxLyapunovExponent: number;
  isChaotic: boolean;
}

/**
 * Evaluates coupled angular accelerations (alpha1, alpha2) for a double pendulum
 */
export function doublePendulumDerivatives(
  theta1: number,
  omega1: number,
  theta2: number,
  omega2: number,
  params: DoublePendulumParams
): { dTheta1: number; dOmega1: number; dTheta2: number; dOmega2: number } {
  const { l1, l2, m1, m2, gravity } = params;
  const g = gravity;
  const dTheta = theta1 - theta2;
  const c1 = params.damping1 ?? 0.02;
  const c2 = params.damping2 ?? 0.02;

  const denom1 = l1 * (2 * m1 + m2 - m2 * Math.cos(2 * theta1 - 2 * theta2));
  const num1 =
    -g * (2 * m1 + m2) * Math.sin(theta1) -
    m2 * g * Math.sin(theta1 - 2 * theta2) -
    2 * Math.sin(dTheta) * m2 * (omega2 * omega2 * l2 + omega1 * omega1 * l1 * Math.cos(dTheta));

  const denom2 = l2 * (2 * m1 + m2 - m2 * Math.cos(2 * theta1 - 2 * theta2));
  const num2 =
    2 *
    Math.sin(dTheta) *
    (omega1 * omega1 * l1 * (m1 + m2) +
      g * (m1 + m2) * Math.cos(theta1) +
      omega2 * omega2 * l2 * m2 * Math.cos(dTheta));

  const alpha1 = num1 / denom1 - c1 * omega1;
  const alpha2 = num2 / denom2 - c2 * omega2;

  return {
    dTheta1: omega1,
    dOmega1: alpha1,
    dTheta2: omega2,
    dOmega2: alpha2
  };
}

/**
 * Calculates mechanical energy for a double pendulum
 */
export function calculateDoublePendulumEnergy(
  theta1: number,
  omega1: number,
  theta2: number,
  omega2: number,
  params: DoublePendulumParams
): number {
  const { l1, l2, m1, m2, gravity: g } = params;
  const dTheta = theta1 - theta2;

  // Kinetic energy
  const t1 = 0.5 * m1 * Math.pow(l1 * omega1, 2);
  const t2 =
    0.5 *
    m2 *
    (Math.pow(l1 * omega1, 2) +
      Math.pow(l2 * omega2, 2) +
      2 * l1 * l2 * omega1 * omega2 * Math.cos(dTheta));
  const kinetic = t1 + t2;

  // Potential energy (relative to lowest point)
  const v1 = -m1 * g * l1 * Math.cos(theta1);
  const v2 = -m2 * g * (l1 * Math.cos(theta1) + l2 * Math.cos(theta2));
  const potential = v1 + v2 + (m1 + m2) * g * l1 + m2 * g * l2;

  return kinetic + potential;
}

/**
 * RK4 Single Step for Double Pendulum (4D state)
 */
export function rk4StepDoublePendulum(
  th1: number,
  om1: number,
  th2: number,
  om2: number,
  dt: number,
  params: DoublePendulumParams
): { theta1: number; omega1: number; theta2: number; omega2: number } {
  // k1
  const k1 = doublePendulumDerivatives(th1, om1, th2, om2, params);

  // k2
  const th1K2 = th1 + 0.5 * dt * k1.dTheta1;
  const om1K2 = om1 + 0.5 * dt * k1.dOmega1;
  const th2K2 = th2 + 0.5 * dt * k1.dTheta2;
  const om2K2 = om2 + 0.5 * dt * k1.dOmega2;
  const k2 = doublePendulumDerivatives(th1K2, om1K2, th2K2, om2K2, params);

  // k3
  const th1K3 = th1 + 0.5 * dt * k2.dTheta1;
  const om1K3 = om1 + 0.5 * dt * k2.dOmega1;
  const th2K3 = th2 + 0.5 * dt * k2.dTheta2;
  const om2K3 = om2 + 0.5 * dt * k2.dOmega2;
  const k3 = doublePendulumDerivatives(th1K3, om1K3, th2K3, om2K3, params);

  // k4
  const th1K4 = th1 + dt * k3.dTheta1;
  const om1K4 = om1 + dt * k3.dOmega1;
  const th2K4 = th2 + dt * k3.dTheta2;
  const om2K4 = om2 + dt * k3.dOmega2;
  const k4 = doublePendulumDerivatives(th1K4, om1K4, th2K4, om2K4, params);

  const nextTh1 = th1 + (dt / 6) * (k1.dTheta1 + 2 * k2.dTheta1 + 2 * k3.dTheta1 + k4.dTheta1);
  const nextOm1 = om1 + (dt / 6) * (k1.dOmega1 + 2 * k2.dOmega1 + 2 * k3.dOmega1 + k4.dOmega1);
  const nextTh2 = th2 + (dt / 6) * (k1.dTheta2 + 2 * k2.dTheta2 + 2 * k3.dTheta2 + k4.dTheta2);
  const nextOm2 = om2 + (dt / 6) * (k1.dOmega2 + 2 * k2.dOmega2 + 2 * k3.dOmega2 + k4.dOmega2);

  return { theta1: nextTh1, omega1: nextOm1, theta2: nextTh2, omega2: nextOm2 };
}

/**
 * Simulates a double pendulum and compares against an infinitesimal perturbation (delta0 = 1e-5 rad)
 * to evaluate the exact Lyapunov Prediction Horizon.
 */
export function simulateDoublePendulumChaos(
  initialTheta1: number,
  initialTheta2: number,
  params: DoublePendulumParams,
  durationSec: number = 6.0,
  fps: number = 60
): ChaosHorizonResult {
  const dt = 1 / fps;
  const subDt = 0.001; // Fine numerical integration step
  const totalFrames = Math.floor(durationSec * fps);

  const delta0 = 1e-5; // 0.00001 rad perturbation

  let th1A = initialTheta1;
  let om1A = 0;
  let th2A = initialTheta2;
  let om2A = 0;

  let th1B = initialTheta1 + delta0;
  let om1B = 0;
  let th2B = initialTheta2;
  let om2B = 0;

  const statesPrimary: DoublePendulumState[] = [];
  const statesPerturbed: DoublePendulumState[] = [];

  const divergenceThreshold = 0.087; // 5.0 degrees
  let lyapunovHorizonSeconds = durationSec;
  let horizonDetected = false;
  let maxLyapunov = 0;

  for (let f = 0; f < totalFrames; f++) {
    const t = f * dt;

    const eA = calculateDoublePendulumEnergy(th1A, om1A, th2A, om2A, params);
    const d1 = doublePendulumDerivatives(th1A, om1A, th2A, om2A, params);

    // Euclidean separation in phase space
    const d = Math.sqrt(Math.pow(th1A - th1B, 2) + Math.pow(th2A - th2B, 2));
    const lyapunov = t > 0.05 ? Math.max(0, Math.log(Math.max(1e-12, d / delta0)) / t) : 0;
    maxLyapunov = Math.max(maxLyapunov, lyapunov);

    if (!horizonDetected && d >= divergenceThreshold) {
      lyapunovHorizonSeconds = Number(t.toFixed(2));
      horizonDetected = true;
    }

    statesPrimary.push({
      t: Number(t.toFixed(3)),
      theta1: th1A,
      omega1: om1A,
      alpha1: d1.dOmega1,
      theta2: th2A,
      omega2: om2A,
      alpha2: d1.dOmega2,
      energyTotal: Number(eA.toFixed(3)),
      divergenceRad: Number(d.toFixed(5)),
      lyapunovExponent: Number(lyapunov.toFixed(3))
    });

    statesPerturbed.push({
      t: Number(t.toFixed(3)),
      theta1: th1B,
      omega1: om1B,
      alpha1: 0,
      theta2: th2B,
      omega2: om2B,
      alpha2: 0,
      energyTotal: 0
    });

    // Sub-stepped integration
    const subSteps = Math.ceil(dt / subDt);
    const h = dt / subSteps;
    for (let s = 0; s < subSteps; s++) {
      const nextA = rk4StepDoublePendulum(th1A, om1A, th2A, om2A, h, params);
      th1A = nextA.theta1;
      om1A = nextA.omega1;
      th2A = nextA.theta2;
      om2A = nextA.omega2;

      const nextB = rk4StepDoublePendulum(th1B, om1B, th2B, om2B, h, params);
      th1B = nextB.theta1;
      om1B = nextB.omega1;
      th2B = nextB.theta2;
      om2B = nextB.omega2;
    }
  }

  return {
    statesPrimary,
    statesPerturbed,
    lyapunovHorizonSeconds,
    maxLyapunovExponent: Number(maxLyapunov.toFixed(2)),
    isChaotic: maxLyapunov > 0.5
  };
}
