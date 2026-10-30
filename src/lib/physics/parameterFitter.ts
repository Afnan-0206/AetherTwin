import {
  FrameMeasurement,
  PendulumParameters,
  TrajectoryComparisonPoint,
  ValidationMetrics,
  CalibrationConfig
} from '../types';
import { simulateTrajectory } from './rk4';
import { computeValidationMetrics } from './metrics';
import { radToDeg } from './dampedPendulum';

export interface FitResult {
  parameters: PendulumParameters;
  metrics: ValidationMetrics;
  comparisonPoints: TrajectoryComparisonPoint[];
  trainCount: number;
  holdoutCount: number;
  splitTimestamp: number;
  identificationQuality: 'confident' | 'marginal' | 'insufficient';
  warnings: string[];
}

/**
 * Fits a damped pendulum model to the first 70% of measurements.
 * Strictly holds out the remaining 30% for predictive validation.
 */
export function fitDampedPendulum(
  measurements: FrameMeasurement[],
  calibration?: Partial<CalibrationConfig>
): FitResult {
  const warnings: string[] = [];

  if (measurements.length < 15) {
    throw new Error(
      `Insufficient measurement frames (${measurements.length} frames). At least 15 frames are required for parameter identification.`
    );
  }

  // Check variance of measured angle
  const angles = measurements.map((m) => m.angleRad);
  const meanAngle = angles.reduce((a, b) => a + b, 0) / angles.length;
  const variance =
    angles.reduce((sum, val) => sum + Math.pow(val - meanAngle, 2), 0) / angles.length;

  if (variance < 0.0005) {
    throw new Error(
      'Static or near-zero motion detected. Parameter identification cannot uniquely determine oscillation frequency from motionless frames.'
    );
  }

  // 1. Strict 70% / 30% split
  const trainCount = Math.max(10, Math.floor(measurements.length * 0.7));
  const holdoutCount = measurements.length - trainCount;

  const trainData = measurements.slice(0, trainCount);
  const holdoutData = measurements.slice(trainCount);
  const splitTimestamp = holdoutData[0]?.timestamp ?? trainData[trainData.length - 1].timestamp;

  const trainTimes = trainData.map((m) => m.timestamp);
  const trainAngles = trainData.map((m) => m.angleRad);

  // 2. Initial conditions from first few training frames
  const t0 = trainTimes[0];
  const dt1 = Math.max(0.001, trainTimes[1] - t0);
  const measuredTheta0 = trainAngles[0];
  const measuredOmega0 = (trainAngles[1] - trainAngles[0]) / dt1;

  // 3. Estimate coarse frequency via zero crossings or peaks in training data
  let estimatedPeriodSec = 0;
  const zeroCrossings: number[] = [];
  for (let i = 1; i < trainData.length; i++) {
    if (
      (trainAngles[i - 1] - meanAngle >= 0 && trainAngles[i] - meanAngle < 0) ||
      (trainAngles[i - 1] - meanAngle <= 0 && trainAngles[i] - meanAngle > 0)
    ) {
      // Linear interpolation for crossing time
      const frac =
        Math.abs(trainAngles[i - 1] - meanAngle) /
        (Math.abs(trainAngles[i - 1] - meanAngle) + Math.abs(trainAngles[i] - meanAngle) + 1e-9);
      zeroCrossings.push(trainTimes[i - 1] + frac * (trainTimes[i] - trainTimes[i - 1]));
    }
  }

  if (zeroCrossings.length >= 2) {
    const halfPeriods: number[] = [];
    for (let k = 1; k < zeroCrossings.length; k++) {
      halfPeriods.push(zeroCrossings[k] - zeroCrossings[k - 1]);
    }
    const avgHalfPeriod = halfPeriods.reduce((a, b) => a + b, 0) / halfPeriods.length;
    estimatedPeriodSec = avgHalfPeriod * 2;
  }

  // Range of omega0Sq to test: omega0 = 2 * PI / T => omega0Sq = (2 * PI / T)^2
  let minOmegaSq = 2.0;
  let maxOmegaSq = 80.0;
  if (estimatedPeriodSec > 0.2 && estimatedPeriodSec < 5.0) {
    const centralOmegaSq = Math.pow((2 * Math.PI) / estimatedPeriodSec, 2);
    minOmegaSq = Math.max(1.0, centralOmegaSq * 0.4);
    maxOmegaSq = Math.min(150.0, centralOmegaSq * 1.8);
  } else {
    warnings.push(
      'Fewer than two oscillation cycles observed in training window. Expanding frequency search bounds.'
    );
  }

  // 4. Deterministic Two-Stage Optimization on TRAINING DATA ONLY
  // Stage 1: Coarse 2D Grid Search over (omega0Sq, damping)
  const omegaSteps = 35;
  const dampingSteps = 25;
  const minDamping = 0.0;
  const maxDamping = 1.0;

  let bestOmegaSq = 20.0;
  let bestDamping = 0.1;
  let bestTrainMse = Infinity;

  for (let i = 0; i < omegaSteps; i++) {
    const candidateOmegaSq = minOmegaSq + (i / (omegaSteps - 1)) * (maxOmegaSq - minOmegaSq);

    for (let j = 0; j < dampingSteps; j++) {
      const candidateDamping = minDamping + (j / (dampingSteps - 1)) * (maxDamping - minDamping);

      const candidateParams: PendulumParameters = {
        omega0Sq: candidateOmegaSq,
        damping: candidateDamping,
        initialAngle: measuredTheta0,
        initialVelocity: measuredOmega0
      };

      const sim = simulateTrajectory(trainTimes, candidateParams);

      let mse = 0;
      for (let k = 0; k < trainData.length; k++) {
        const diff = sim[k].theta - trainAngles[k];
        mse += diff * diff;
      }
      mse /= trainData.length;

      if (mse < bestTrainMse) {
        bestTrainMse = mse;
        bestOmegaSq = candidateOmegaSq;
        bestDamping = candidateDamping;
      }
    }
  }

  // Stage 2: Fine Local Refinement around best candidate + initial conditions
  const refinedOmegaRange = (maxOmegaSq - minOmegaSq) / (omegaSteps - 1);
  const refinedDampingRange = (maxDamping - minDamping) / (dampingSteps - 1);

  let refinedOmegaSq = bestOmegaSq;
  let refinedDamping = bestDamping;
  let refinedTheta0 = measuredTheta0;
  let refinedOmega0 = measuredOmega0;
  let currentBestMse = bestTrainMse;

  // Fine coordinate iterations
  const fineSteps = 15;
  for (let step = 0; step < 3; step++) {
    const scale = Math.pow(0.5, step);

    // Test omega0Sq
    for (let i = -fineSteps; i <= fineSteps; i++) {
      const candOmega = refinedOmegaSq + (i / fineSteps) * refinedOmegaRange * scale;
      if (candOmega <= 0.1) continue;

      const sim = simulateTrajectory(trainTimes, {
        omega0Sq: candOmega,
        damping: refinedDamping,
        initialAngle: refinedTheta0,
        initialVelocity: refinedOmega0
      });

      let mse = 0;
      for (let k = 0; k < trainData.length; k++) {
        const d = sim[k].theta - trainAngles[k];
        mse += d * d;
      }
      mse /= trainData.length;

      if (mse < currentBestMse) {
        currentBestMse = mse;
        refinedOmegaSq = candOmega;
      }
    }

    // Test damping
    for (let j = -fineSteps; j <= fineSteps; j++) {
      const candDamp = Math.max(
        0,
        refinedDamping + (j / fineSteps) * refinedDampingRange * scale
      );

      const sim = simulateTrajectory(trainTimes, {
        omega0Sq: refinedOmegaSq,
        damping: candDamp,
        initialAngle: refinedTheta0,
        initialVelocity: refinedOmega0
      });

      let mse = 0;
      for (let k = 0; k < trainData.length; k++) {
        const d = sim[k].theta - trainAngles[k];
        mse += d * d;
      }
      mse /= trainData.length;

      if (mse < currentBestMse) {
        currentBestMse = mse;
        refinedDamping = candDamp;
      }
    }

    // Fine tune initial velocity within +/- 0.15 rad/s
    for (let v = -5; v <= 5; v++) {
      const candOmega0 = measuredOmega0 + (v / 5) * 0.15 * scale;
      const sim = simulateTrajectory(trainTimes, {
        omega0Sq: refinedOmegaSq,
        damping: refinedDamping,
        initialAngle: refinedTheta0,
        initialVelocity: candOmega0
      });

      let mse = 0;
      for (let k = 0; k < trainData.length; k++) {
        const d = sim[k].theta - trainAngles[k];
        mse += d * d;
      }
      mse /= trainData.length;

      if (mse < currentBestMse) {
        currentBestMse = mse;
        refinedOmega0 = candOmega0;
      }
    }
  }

  // Stage 3: Test for Quadratic Aerodynamic Drag if non-linear air resistance is present
  let refinedQuadraticDrag = 0;
  let dragModel: 'viscous_linear' | 'aerodynamic_quadratic' | 'combined' = 'viscous_linear';

  for (let q = 1; q <= 6; q++) {
    const candQuad = q * 0.04;
    const sim = simulateTrajectory(trainTimes, {
      omega0Sq: refinedOmegaSq,
      damping: Math.max(0, refinedDamping - candQuad * 0.5),
      dampingQuadratic: candQuad,
      initialAngle: refinedTheta0,
      initialVelocity: refinedOmega0
    });

    let mse = 0;
    for (let k = 0; k < trainData.length; k++) {
      const d = sim[k].theta - trainAngles[k];
      mse += d * d;
    }
    mse /= trainData.length;

    // Only adopt if it yields a meaningful (>8%) reduction in MSE
    if (mse < currentBestMse * 0.92) {
      currentBestMse = mse;
      refinedQuadraticDrag = candQuad;
      refinedDamping = Math.max(0, refinedDamping - candQuad * 0.5);
      dragModel = refinedDamping < 0.02 ? 'aerodynamic_quadratic' : 'combined';
    }
  }

  // Parameter Uncertainty Estimation via finite-difference curvature of MSE surface
  const deltaOmega = Math.max(0.05, refinedOmegaSq * 0.02);
  const simPlusOmega = simulateTrajectory(trainTimes, {
    omega0Sq: refinedOmegaSq + deltaOmega,
    damping: refinedDamping,
    dampingQuadratic: refinedQuadraticDrag,
    initialAngle: refinedTheta0,
    initialVelocity: refinedOmega0
  });
  const simMinusOmega = simulateTrajectory(trainTimes, {
    omega0Sq: Math.max(0.1, refinedOmegaSq - deltaOmega),
    damping: refinedDamping,
    dampingQuadratic: refinedQuadraticDrag,
    initialAngle: refinedTheta0,
    initialVelocity: refinedOmega0
  });

  let msePlusOmega = 0;
  let mseMinusOmega = 0;
  for (let k = 0; k < trainData.length; k++) {
    msePlusOmega += Math.pow(simPlusOmega[k].theta - trainAngles[k], 2);
    mseMinusOmega += Math.pow(simMinusOmega[k].theta - trainAngles[k], 2);
  }
  msePlusOmega /= trainData.length;
  mseMinusOmega /= trainData.length;

  const d2MseOmega = Math.max(1e-5, (msePlusOmega - 2 * currentBestMse + mseMinusOmega) / (deltaOmega * deltaOmega));
  const omega0SqUncertainty = Number(Math.min(1.5, Math.max(0.01, Math.sqrt((2 * currentBestMse) / d2MseOmega))).toFixed(3));

  const deltaDamping = 0.02;
  const simPlusDamp = simulateTrajectory(trainTimes, {
    omega0Sq: refinedOmegaSq,
    damping: refinedDamping + deltaDamping,
    dampingQuadratic: refinedQuadraticDrag,
    initialAngle: refinedTheta0,
    initialVelocity: refinedOmega0
  });
  const simMinusDamp = simulateTrajectory(trainTimes, {
    omega0Sq: refinedOmegaSq,
    damping: Math.max(0, refinedDamping - deltaDamping),
    dampingQuadratic: refinedQuadraticDrag,
    initialAngle: refinedTheta0,
    initialVelocity: refinedOmega0
  });

  let msePlusDamp = 0;
  let mseMinusDamp = 0;
  for (let k = 0; k < trainData.length; k++) {
    msePlusDamp += Math.pow(simPlusDamp[k].theta - trainAngles[k], 2);
    mseMinusDamp += Math.pow(simMinusDamp[k].theta - trainAngles[k], 2);
  }
  msePlusDamp /= trainData.length;
  mseMinusDamp /= trainData.length;

  const d2MseDamp = Math.max(1e-5, (msePlusDamp - 2 * currentBestMse + mseMinusDamp) / (deltaDamping * deltaDamping));
  const dampingUncertainty = Number(Math.min(0.2, Math.max(0.005, Math.sqrt((2 * currentBestMse) / d2MseDamp))).toFixed(3));

  // 5. Construct final parameters
  const fittedParameters: PendulumParameters = {
    omega0Sq: Number(refinedOmegaSq.toFixed(4)),
    damping: Number(refinedDamping.toFixed(4)),
    dampingQuadratic: refinedQuadraticDrag > 0 ? Number(refinedQuadraticDrag.toFixed(4)) : undefined,
    dragModel,
    omega0SqUncertainty,
    dampingUncertainty,
    initialAngle: Number(refinedTheta0.toFixed(4)),
    initialVelocity: Number(refinedOmega0.toFixed(4))
  };

  if (calibration?.knownLengthMeters && calibration.knownLengthMeters > 0) {
    fittedParameters.length = calibration.knownLengthMeters;
    // g = omega0Sq * L
    fittedParameters.gravity = Number((fittedParameters.omega0Sq * calibration.knownLengthMeters).toFixed(3));
  } else {
    warnings.push(
      'Pendulum length L not calibrated in SI meters. Operating in relative frequency domain (omega0Sq = g/L).'
    );
  }

  // 6. Predict forward across the ENTIRE dataset (Train + Holdout)
  const allTimes = measurements.map((m) => m.timestamp);
  const fullSimulation = simulateTrajectory(allTimes, fittedParameters);

  // 7. Compute baseline model for holdout comparison
  // Baseline: Constant angular velocity / persistence extrapolation from training end
  const trainEndIdx = trainCount - 1;
  const trainEndTime = trainTimes[trainEndIdx];
  const trainEndAngle = trainAngles[trainEndIdx];
  const trainStartAngle = trainAngles[0];
  const avgTrainOmega = (trainEndAngle - trainStartAngle) / Math.max(0.001, trainEndTime - t0);

  const baselineAnglesAll = allTimes.map((t, idx) => {
    if (idx < trainCount) {
      // Linear fit on training
      return trainStartAngle + avgTrainOmega * (t - t0);
    } else {
      // Extrapolate constant velocity from training end
      return trainEndAngle + avgTrainOmega * (t - trainEndTime);
    }
  });

  // Extract train and holdout arrays
  const trainMeasuredAngles = trainAngles;
  const trainPredictedAngles = fullSimulation.slice(0, trainCount).map((s) => s.theta);

  const holdoutMeasuredAngles = holdoutData.map((m) => m.angleRad);
  const holdoutPredictedAngles = fullSimulation.slice(trainCount).map((s) => s.theta);
  const holdoutBaselineAngles = baselineAnglesAll.slice(trainCount);

  // 8. Compute validation metrics
  const metrics = computeValidationMetrics(
    trainMeasuredAngles,
    trainPredictedAngles,
    holdoutMeasuredAngles,
    holdoutPredictedAngles,
    holdoutBaselineAngles
  );

  // 9. Comparison points for charts, phase portraits, and energy plots
  const comparisonPoints: TrajectoryComparisonPoint[] = measurements.map((m, idx) => {
    const isTrain = idx < trainCount;
    const simState = fullSimulation[idx];
    const predRad = simState.theta;
    const baseRad = baselineAnglesAll[idx];

    // Compute measured angular velocity via central differences
    let measuredOmegaRad = 0;
    if (idx === 0 && measurements.length > 1) {
      measuredOmegaRad = (measurements[1].angleRad - measurements[0].angleRad) / Math.max(0.001, measurements[1].timestamp - measurements[0].timestamp);
    } else if (idx === measurements.length - 1 && measurements.length > 1) {
      measuredOmegaRad = (measurements[idx].angleRad - measurements[idx - 1].angleRad) / Math.max(0.001, measurements[idx].timestamp - measurements[idx - 1].timestamp);
    } else if (measurements.length > 2) {
      measuredOmegaRad = (measurements[idx + 1].angleRad - measurements[idx - 1].angleRad) / Math.max(0.001, measurements[idx + 1].timestamp - measurements[idx - 1].timestamp);
    }

    return {
      timestamp: Number(m.timestamp.toFixed(4)),
      frameIndex: m.frameIndex,
      isTrain,
      measuredAngleDeg: Number(m.angleDeg.toFixed(2)),
      predictedAngleDeg: Number(radToDeg(predRad).toFixed(2)),
      baselineAngleDeg: Number(radToDeg(baseRad).toFixed(2)),
      residualDeg: Number((radToDeg(predRad) - m.angleDeg).toFixed(2)),
      measuredOmegaDeg: Number(radToDeg(measuredOmegaRad).toFixed(2)),
      predictedOmegaDeg: Number(radToDeg(simState.omega).toFixed(2)),
      energyKinetic: simState.energyKinetic ? Number(simState.energyKinetic.toFixed(4)) : undefined,
      energyPotential: simState.energyPotential ? Number(simState.energyPotential.toFixed(4)) : undefined,
      energyTotal: simState.energyTotal ? Number(simState.energyTotal.toFixed(4)) : undefined
    };
  });

  const identificationQuality =
    metrics.holdoutRmseDeg < 3.5
      ? 'confident'
      : metrics.holdoutRmseDeg < 8.0
      ? 'marginal'
      : 'insufficient';

  if (identificationQuality === 'insufficient') {
    warnings.push(
      'Holdout RMSE exceeds 8 degrees. Real motion may deviate from a simple 1-DOF planar damped pendulum (e.g. out-of-plane wobble, non-linear air drag, camera perspective distortion).'
    );
  }

  return {
    parameters: fittedParameters,
    metrics,
    comparisonPoints,
    trainCount,
    holdoutCount,
    splitTimestamp,
    identificationQuality,
    warnings
  };
}
