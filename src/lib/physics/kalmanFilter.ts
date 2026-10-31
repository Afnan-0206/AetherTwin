/**
 * Extended Kalman Filter (EKF) / Continuous-Discrete State Observer for Physical Digital Twins
 * Fuses noisy optical camera measurements (SAM 3.1 centroid tracking at 30-60 Hz)
 * with deterministic non-linear equations of motion to provide optimal real-time state estimation
 * and rejection of optical measurement noise.
 *
 * State vector: x = [position_x, velocity_v, angle_theta, angular_velocity_omega]^T
 * Measurement vector: z = [measured_x, measured_theta]^T
 */

export interface KalmanFilterConfig {
  /** Process noise variance for acceleration disturbances (m/s^2)^2 */
  qAccel: number;
  /** Process noise variance for angular acceleration disturbances (rad/s^2)^2 */
  qAlpha: number;
  /** Sensor noise variance for optical position tracking (meters)^2 */
  rPos: number;
  /** Sensor noise variance for optical angle extraction (radians)^2 */
  rAngle: number;
}

export interface KalmanState {
  /** State estimate [x, v, theta, omega] */
  xHat: [number, number, number, number];
  /** 4x4 Estimation error covariance matrix P */
  P: number[][];
  /** Innovation residual [z_x - xHat_x, z_th - xHat_th] */
  residual: [number, number];
  /** Kalman gain K (4x2 matrix) */
  K: number[][];
}

export const DEFAULT_KALMAN_CONFIG: KalmanFilterConfig = {
  qAccel: 0.05,
  qAlpha: 0.08,
  rPos: 0.0004, // ~2cm standard deviation in optical tracking
  rAngle: 0.0009 // ~1.7 degree standard deviation in optical angle
};

/**
 * Creates an initial Kalman filter state with zero or specified initial mean and initial covariance.
 */
export function createKalmanState(
  initialX: [number, number, number, number] = [0, 0, 0, 0],
  initialVariance: number = 0.1
): KalmanState {
  return {
    xHat: [...initialX],
    P: [
      [initialVariance, 0, 0, 0],
      [0, initialVariance, 0, 0],
      [0, 0, initialVariance, 0],
      [0, 0, 0, initialVariance]
    ],
    residual: [0, 0],
    K: [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0]
    ]
  };
}

/**
 * Predict step: Propagates state estimate and covariance forward using linearized Jacobian F.
 * For linear / linearized dynamics: xDot = A*x + B*u
 * Discrete transition: F = I + A*dt
 */
export function kalmanPredict(
  current: KalmanState,
  A: number[][],
  B: number[],
  u: number,
  dt: number,
  config: KalmanFilterConfig = DEFAULT_KALMAN_CONFIG
): KalmanState {
  const [x, v, th, om] = current.xHat;

  // 1. Numerical state propagation xDot = A*x + B*u
  const xDot = A[0][0] * x + A[0][1] * v + A[0][2] * th + A[0][3] * om + B[0] * u;
  const vDot = A[1][0] * x + A[1][1] * v + A[1][2] * th + A[1][3] * om + B[1] * u;
  const thDot = A[2][0] * x + A[2][1] * v + A[2][2] * th + A[2][3] * om + B[2] * u;
  const omDot = A[3][0] * x + A[3][1] * v + A[3][2] * th + A[3][3] * om + B[3] * u;

  const xHatMinus: [number, number, number, number] = [
    x + xDot * dt,
    v + vDot * dt,
    th + thDot * dt,
    om + omDot * dt
  ];

  // 2. Discrete state transition matrix F = I + A*dt
  const F: number[][] = [
    [1 + A[0][0] * dt, A[0][1] * dt, A[0][2] * dt, A[0][3] * dt],
    [A[1][0] * dt, 1 + A[1][1] * dt, A[1][2] * dt, A[1][3] * dt],
    [A[2][0] * dt, A[2][1] * dt, 1 + A[2][2] * dt, A[2][3] * dt],
    [A[3][0] * dt, A[3][1] * dt, A[3][2] * dt, 1 + A[3][3] * dt]
  ];

  // 3. Process noise covariance Q (continuous to discrete approximation)
  // Gamma = [0 0; dt 0; 0 0; 0 dt]
  const Q: number[][] = [
    [0.25 * Math.pow(dt, 4) * config.qAccel, 0.5 * Math.pow(dt, 3) * config.qAccel, 0, 0],
    [0.5 * Math.pow(dt, 3) * config.qAccel, Math.pow(dt, 2) * config.qAccel, 0, 0],
    [0, 0, 0.25 * Math.pow(dt, 4) * config.qAlpha, 0.5 * Math.pow(dt, 3) * config.qAlpha],
    [0, 0, 0.5 * Math.pow(dt, 3) * config.qAlpha, Math.pow(dt, 2) * config.qAlpha]
  ];

  // 4. Covariance propagation P_minus = F * P * F^T + Q
  // FP = F * P
  const FP: number[][] = Array(4).fill(0).map(() => Array(4).fill(0));
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += F[i][k] * current.P[k][j];
      }
      FP[i][j] = sum;
    }
  }

  // PMinus = FP * F^T + Q
  const PMinus: number[][] = Array(4).fill(0).map(() => Array(4).fill(0));
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += FP[i][k] * F[j][k]; // F^T[k][j] = F[j][k]
      }
      PMinus[i][j] = sum + Q[i][j];
    }
  }

  return {
    xHat: xHatMinus,
    P: PMinus,
    residual: current.residual,
    K: current.K
  };
}

/**
 * Update step: Fuses noisy sensor observation z = [z_pos, z_angle] with predicted state.
 * Measurement matrix H = [[1, 0, 0, 0], [0, 0, 1, 0]]
 */
export function kalmanUpdate(
  predicted: KalmanState,
  measurement: [number, number], // [measured_x, measured_theta]
  config: KalmanFilterConfig = DEFAULT_KALMAN_CONFIG
): KalmanState {
  const [xPred, vPred, thPred, omPred] = predicted.xHat;
  const [zX, zTh] = measurement;

  // Innovation / residual y = z - H*xHat
  const resX = zX - xPred;
  const resTh = zTh - thPred;

  // Measurement matrix H is 2x4:
  // H = [1 0 0 0; 0 0 1 0]
  // Innovation covariance S = H * P * H^T + R
  // S[0][0] = P[0][0] + R_pos
  // S[0][1] = P[0][2]
  // S[1][0] = P[2][0]
  // S[1][1] = P[2][2] + R_angle
  const S00 = predicted.P[0][0] + config.rPos;
  const S01 = predicted.P[0][2];
  const S10 = predicted.P[2][0];
  const S11 = predicted.P[2][2] + config.rAngle;

  // Invert 2x2 matrix S: det = S00*S11 - S01*S10
  const detS = S00 * S11 - S01 * S10;
  const invDet = detS !== 0 ? 1 / detS : 1e6;
  const invS00 = S11 * invDet;
  const invS01 = -S01 * invDet;
  const invS10 = -S10 * invDet;
  const invS11 = S00 * invDet;

  // Kalman Gain K = P * H^T * inv(S)
  // P * H^T is 4x2 where col 0 is col 0 of P, col 1 is col 2 of P
  // PHt[i][0] = P[i][0], PHt[i][1] = P[i][2]
  const K: number[][] = Array(4).fill(0).map(() => [0, 0]);
  for (let i = 0; i < 4; i++) {
    const p0 = predicted.P[i][0];
    const p2 = predicted.P[i][2];
    K[i][0] = p0 * invS00 + p2 * invS10;
    K[i][1] = p0 * invS01 + p2 * invS11;
  }

  // Updated state: xHat = xHat_minus + K * y
  const xHatNew: [number, number, number, number] = [
    xPred + K[0][0] * resX + K[0][1] * resTh,
    vPred + K[1][0] * resX + K[1][1] * resTh,
    thPred + K[2][0] * resX + K[2][1] * resTh,
    omPred + K[3][0] * resX + K[3][1] * resTh
  ];

  // Joseph form or standard covariance update: P = (I - K*H) * P
  // KH is 4x4:
  // KH[i][0] = K[i][0], KH[i][1] = 0, KH[i][2] = K[i][1], KH[i][3] = 0
  const PNew: number[][] = Array(4).fill(0).map(() => Array(4).fill(0));
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      // (I - KH)[i][k]
      // For k=i: 1 - KH[i][i] (if i=0 KH[0][0], if i=2 KH[2][1])
      // For k!=i: -KH[i][k]
      let pSum = predicted.P[i][j];
      // subtract K[i][0] * P[0][j] + K[i][1] * P[2][j]
      pSum -= (K[i][0] * predicted.P[0][j] + K[i][1] * predicted.P[2][j]);
      PNew[i][j] = pSum;
    }
  }

  return {
    xHat: xHatNew,
    P: PNew,
    residual: [resX, resTh],
    K
  };
}

