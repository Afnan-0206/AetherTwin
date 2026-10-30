import { describe, it, expect } from 'vitest';
import { computeMAE, computeMSE, computeRMSE, computeValidationMetrics } from '../lib/physics/metrics';

describe('Physics Validation Metrics', () => {
  it('correctly calculates MAE, MSE, and RMSE', () => {
    const measured = [1.0, 2.0, 3.0, 4.0];
    const predicted = [1.1, 1.9, 3.2, 3.8];

    // errors: 0.1, -0.1, 0.2, -0.2
    // abs errors: 0.1, 0.1, 0.2, 0.2 => sum = 0.6 => MAE = 0.15
    // sq errors: 0.01, 0.01, 0.04, 0.04 => sum = 0.1 => MSE = 0.025
    // RMSE = sqrt(0.025) ~= 0.15811
    const mae = computeMAE(measured, predicted);
    const mse = computeMSE(measured, predicted);
    const rmse = computeRMSE(measured, predicted);

    expect(mae).toBeCloseTo(0.15, 4);
    expect(mse).toBeCloseTo(0.025, 4);
    expect(rmse).toBeCloseTo(Math.sqrt(0.025), 4);
  });

  it('computes holdout and baseline reduction accurately', () => {
    const trainMeas = [0.1, 0.2];
    const trainPred = [0.1, 0.2];

    const holdMeas = [0.3, 0.4];
    const holdPred = [0.31, 0.39]; // RMSE ~= 0.01
    const holdBase = [0.0, 0.0]; // RMSE ~= sqrt((0.09+0.16)/2) = sqrt(0.125) ~= 0.3535

    const metrics = computeValidationMetrics(
      trainMeas,
      trainPred,
      holdMeas,
      holdPred,
      holdBase
    );

    expect(metrics.holdoutRmseRad).toBeLessThan(metrics.baselineHoldoutRmseRad);
    expect(metrics.errorReductionPercent).toBeGreaterThan(90);
  });
});
