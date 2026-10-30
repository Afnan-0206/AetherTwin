import { ValidationMetrics } from '../types';
import { radToDeg } from './dampedPendulum';

/**
 * Compute Mean Absolute Error (MAE) between two equal-length arrays
 */
export function computeMAE(measured: number[], predicted: number[]): number {
  if (measured.length === 0 || measured.length !== predicted.length) return 0;
  let sum = 0;
  for (let i = 0; i < measured.length; i++) {
    sum += Math.abs(measured[i] - predicted[i]);
  }
  return sum / measured.length;
}

/**
 * Compute Mean Squared Error (MSE)
 */
export function computeMSE(measured: number[], predicted: number[]): number {
  if (measured.length === 0 || measured.length !== predicted.length) return 0;
  let sum = 0;
  for (let i = 0; i < measured.length; i++) {
    const diff = measured[i] - predicted[i];
    sum += diff * diff;
  }
  return sum / measured.length;
}

/**
 * Compute Root Mean Squared Error (RMSE)
 */
export function computeRMSE(measured: number[], predicted: number[]): number {
  return Math.sqrt(computeMSE(measured, predicted));
}

/**
 * Computes complete validation metrics for training set, holdout test set, and baseline comparison.
 */
export function computeValidationMetrics(
  trainMeasured: number[],
  trainPredicted: number[],
  holdoutMeasured: number[],
  holdoutPredicted: number[],
  holdoutBaseline: number[]
): ValidationMetrics {
  const trainMaeRad = computeMAE(trainMeasured, trainPredicted);
  const trainMseRad = computeMSE(trainMeasured, trainPredicted);
  const trainRmseRad = Math.sqrt(trainMseRad);

  const holdoutMaeRad = computeMAE(holdoutMeasured, holdoutPredicted);
  const holdoutMseRad = computeMSE(holdoutMeasured, holdoutPredicted);
  const holdoutRmseRad = Math.sqrt(holdoutMseRad);

  const baselineHoldoutMaeRad = computeMAE(holdoutMeasured, holdoutBaseline);
  const baselineHoldoutMseRad = computeMSE(holdoutMeasured, holdoutBaseline);
  const baselineHoldoutRmseRad = Math.sqrt(baselineHoldoutMseRad);

  const errorReductionPercent =
    baselineHoldoutRmseRad > 0
      ? Math.max(0, Math.min(100, ((baselineHoldoutRmseRad - holdoutRmseRad) / baselineHoldoutRmseRad) * 100))
      : 0;

  return {
    trainMaeRad,
    trainMseRad,
    trainRmseRad,
    trainMaeDeg: radToDeg(trainMaeRad),
    trainRmseDeg: radToDeg(trainRmseRad),

    holdoutMaeRad,
    holdoutMseRad,
    holdoutRmseRad,
    holdoutMaeDeg: radToDeg(holdoutMaeRad),
    holdoutRmseDeg: radToDeg(holdoutRmseRad),

    baselineHoldoutMaeRad,
    baselineHoldoutRmseRad,
    baselineHoldoutMaeDeg: radToDeg(baselineHoldoutMaeRad),
    baselineHoldoutRmseDeg: radToDeg(baselineHoldoutRmseRad),
    errorReductionPercent
  };
}
