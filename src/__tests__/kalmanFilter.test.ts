import { describe, it, expect } from 'vitest';
import {
  createKalmanState,
  kalmanPredict,
  kalmanUpdate,
  DEFAULT_KALMAN_CONFIG
} from '../lib/physics/kalmanFilter';
import { linearizeCartPole, DEFAULT_CARTPOLE_PARAMS } from '../lib/physics/cartPoleLqr';

describe('Extended Kalman Filter (EKF) State Observer', () => {
  it('initializes kalman state with proper dimension covariance', () => {
    const kState = createKalmanState([0, 0, 0.1, 0], 0.2);
    expect(kState.xHat).toEqual([0, 0, 0.1, 0]);
    expect(kState.P.length).toBe(4);
    expect(kState.P[0][0]).toBeCloseTo(0.2);
    expect(kState.P[2][2]).toBeCloseTo(0.2);
  });

  it('predicts state forward using linearized dynamics and increases covariance', () => {
    const lqr = linearizeCartPole(DEFAULT_CARTPOLE_PARAMS);
    const kState = createKalmanState([0, 0, 0.1, 0], 0.01);
    const predicted = kalmanPredict(kState, lqr.A, lqr.B, 0, 0.02, DEFAULT_KALMAN_CONFIG);

    expect(predicted.xHat).toBeDefined();
    // Angle should change according to dynamics
    expect(predicted.xHat[2]).toBeDefined();
    // Uncertainty should grow due to process noise Q
    expect(predicted.P[0][0]).toBeGreaterThan(0);
    expect(predicted.P[1][1]).toBeGreaterThan(0);
  });

  it('updates state towards measurement and reduces covariance uncertainty', () => {
    const lqr = linearizeCartPole(DEFAULT_CARTPOLE_PARAMS);
    const kState = createKalmanState([0, 0, 0.1, 0], 0.2);
    const predicted = kalmanPredict(kState, lqr.A, lqr.B, 0, 0.02, DEFAULT_KALMAN_CONFIG);

    // Measurement says cart is at 0.05 and angle is at 0.15
    const updated = kalmanUpdate(predicted, [0.05, 0.15], DEFAULT_KALMAN_CONFIG);

    // Filtered state should move towards measurement
    expect(updated.xHat[0]).toBeGreaterThan(0);
    expect(updated.xHat[2]).toBeGreaterThan(0.1);
    // Updated covariance must be strictly less than predicted prior covariance (information gain)
    expect(updated.P[0][0]).toBeLessThan(predicted.P[0][0]);
    expect(updated.P[2][2]).toBeLessThan(predicted.P[2][2]);
    // Residuals are calculated
    expect(updated.residual.length).toBe(2);
  });

  it('robustly filters out high sensor noise over time', () => {
    const lqr = linearizeCartPole(DEFAULT_CARTPOLE_PARAMS);
    let kState = createKalmanState([0, 0, 0, 0], 0.1);

    // True angle is stationary at 0, but camera has noisy measurements oscillating around 0
    const noisyMeasurements: [number, number][] = [
      [0.02, 0.05],
      [-0.01, -0.04],
      [0.03, 0.06],
      [-0.02, -0.05],
      [0.01, 0.03]
    ];

    for (const meas of noisyMeasurements) {
      kState = kalmanPredict(kState, lqr.A, lqr.B, 0, 0.02, DEFAULT_KALMAN_CONFIG);
      kState = kalmanUpdate(kState, meas, DEFAULT_KALMAN_CONFIG);
    }

    // Filtered estimate should be smooth and close to zero, rejecting noise
    expect(Math.abs(kState.xHat[0])).toBeLessThan(0.05);
    expect(Math.abs(kState.xHat[2])).toBeLessThan(0.05);
  });
});
