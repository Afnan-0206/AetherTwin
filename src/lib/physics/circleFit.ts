import { Point2D } from '../types';

export interface CircleFitResult {
  center: Point2D;
  radius: number;
  rmse: number;
  sampleCount: number;
  isValid: boolean;
  eccentricityWarning?: string;
}

/**
 * Algebraic Circle Fit (Kåsa method)
 * Fits a circle (x - xc)^2 + (y - yc)^2 = R^2 to a series of 2D trajectory points.
 * Ideal for automatically estimating the pendulum pivot (xc, yc) and visual arm radius R.
 */
export function fitCircleToPoints(points: Point2D[]): CircleFitResult {
  if (points.length < 5) {
    return {
      center: { x: 0, y: 0 },
      radius: 0,
      rmse: 0,
      sampleCount: points.length,
      isValid: false,
      eccentricityWarning: 'At least 5 points required for circle fit.'
    };
  }

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  let sumXY = 0;
  let sumZ = 0; // z = x^2 + y^2
  let sumXZ = 0;
  let sumYZ = 0;

  for (let i = 0; i < n; i++) {
    const x = points[i].x;
    const y = points[i].y;
    const z = x * x + y * y;

    sumX += x;
    sumY += y;
    sumX2 += x * x;
    sumY2 += y * y;
    sumXY += x * y;
    sumZ += z;
    sumXZ += x * z;
    sumYZ += y * z;
  }

  // Linear system: M * [A, B, C]^T = V
  // where xc = A/2, yc = B/2, R = sqrt(C + xc^2 + yc^2)
  // [sumX2 sumXY sumX] [A]   [sumXZ]
  // [sumXY sumY2 sumY] [B] = [sumYZ]
  // [sumX  sumY  n   ] [C]   [sumZ ]

  // Solve using Cramer's rule / 3x3 determinant
  const m00 = sumX2, m01 = sumXY, m02 = sumX, v0 = sumXZ;
  const m10 = sumXY, m11 = sumY2, m12 = sumY, v1 = sumYZ;
  const m20 = sumX,  m21 = sumY,  m22 = n,    v2 = sumZ;

  const detM =
    m00 * (m11 * m22 - m12 * m21) -
    m01 * (m10 * m22 - m12 * m20) +
    m02 * (m10 * m21 - m11 * m20);

  if (Math.abs(detM) < 1e-12) {
    return {
      center: { x: 0, y: 0 },
      radius: 0,
      rmse: 0,
      sampleCount: n,
      isValid: false,
      eccentricityWarning: 'Degenerate collinear or static points; cannot fit circle.'
    };
  }

  const detA =
    v0 * (m11 * m22 - m12 * m21) -
    m01 * (v1 * m22 - m12 * v2) +
    m02 * (v1 * m21 - m11 * v2);

  const detB =
    m00 * (v1 * m22 - m12 * v2) -
    v0 * (m10 * m22 - m12 * m20) +
    m02 * (m10 * v2 - v1 * m20);

  const detC =
    m00 * (m11 * v2 - v1 * m21) -
    m01 * (m10 * v2 - v1 * m20) +
    v0 * (m10 * m21 - m11 * m20);

  const A = detA / detM;
  const B = detB / detM;
  const C = detC / detM;

  const xc = A / 2;
  const yc = B / 2;
  const rSquared = C + xc * xc + yc * yc;

  if (rSquared <= 0) {
    return {
      center: { x: xc, y: yc },
      radius: 0,
      rmse: 0,
      sampleCount: n,
      isValid: false,
      eccentricityWarning: 'Non-positive radius computed.'
    };
  }

  const radius = Math.sqrt(rSquared);

  // Compute residual RMSE: sqrt(1/N sum ((dist - R)^2))
  let sumSqErr = 0;
  for (let i = 0; i < n; i++) {
    const dx = points[i].x - xc;
    const dy = points[i].y - yc;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const err = dist - radius;
    sumSqErr += err * err;
  }
  const rmse = Math.sqrt(sumSqErr / n);

  let eccentricityWarning: string | undefined = undefined;
  if (rmse > radius * 0.1) {
    eccentricityWarning = 'Significant radial deviation (RMSE > 10% of radius). Pendulum may exhibit out-of-plane wobble or rod elasticity.';
  }

  return {
    center: { x: Number(xc.toFixed(1)), y: Number(yc.toFixed(1)) },
    radius: Number(radius.toFixed(1)),
    rmse: Number(rmse.toFixed(2)),
    sampleCount: n,
    isValid: true,
    eccentricityWarning
  };
}

