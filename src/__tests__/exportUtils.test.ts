import { describe, it, expect } from 'vitest';
import {
  generateTelemetryCSV,
  generatePythonReproductionScript,
  generateVerificationCertificateMarkdown,
  generateRos2NodeScript,
  generateArduinoCppFirmware,
  generateMatlabSimulinkScript
} from '../lib/export/exportUtils';
import { linearizeCartPole, DEFAULT_CARTPOLE_PARAMS } from '../lib/physics/cartPoleLqr';
import { TrajectoryComparisonPoint, PendulumParameters, ValidationMetrics, ProvenanceLogEntry } from '../lib/types';

describe('Export & Verification Utilities', () => {
  const mockPoints: TrajectoryComparisonPoint[] = [
    {
      timestamp: 0.0,
      frameIndex: 0,
      isTrain: true,
      measuredAngleDeg: 30.0,
      predictedAngleDeg: 29.8,
      baselineAngleDeg: 30.0,
      residualDeg: -0.2,
      measuredOmegaDeg: 0.0,
      predictedOmegaDeg: 0.0,
      energyTotal: 0.45
    },
    {
      timestamp: 1.0,
      frameIndex: 30,
      isTrain: false,
      measuredAngleDeg: -20.5,
      predictedAngleDeg: -20.3,
      baselineAngleDeg: 15.0,
      residualDeg: 0.2,
      measuredOmegaDeg: 12.0,
      predictedOmegaDeg: 11.8,
      energyTotal: 0.41
    }
  ];

  const mockParams: PendulumParameters = {
    omega0Sq: 19.6133,
    damping: 0.15,
    dampingQuadratic: 0.02,
    initialAngle: 0.5236,
    initialVelocity: 0.0,
    length: 0.50,
    gravity: 9.807
  };

  const mockMetrics: ValidationMetrics = {
    trainMaeRad: 0.005,
    trainMseRad: 0.00003,
    trainRmseRad: 0.0055,
    trainMaeDeg: 0.28,
    trainRmseDeg: 0.32,
    holdoutMaeRad: 0.008,
    holdoutMseRad: 0.00008,
    holdoutRmseRad: 0.009,
    holdoutMaeDeg: 0.45,
    holdoutRmseDeg: 0.52,
    baselineHoldoutMaeRad: 0.3,
    baselineHoldoutRmseRad: 0.35,
    baselineHoldoutMaeDeg: 17.2,
    baselineHoldoutRmseDeg: 20.1,
    errorReductionPercent: 97.4
  };

  const mockProvenance: ProvenanceLogEntry[] = [
    {
      id: 'p1',
      timestamp: '22:00:00',
      kind: 'OBSERVED',
      category: 'Video Ingest',
      summary: 'Loaded 120 frames'
    },
    {
      id: 'p2',
      timestamp: '22:00:01',
      kind: 'CALCULATED',
      category: 'RK4 Fitting',
      summary: 'Fit omega0Sq = 19.61'
    }
  ];

  it('generates valid CSV with expected columns and rows', () => {
    const csv = generateTelemetryCSV(mockPoints);
    expect(csv).toContain('timestamp_sec,frame_index,dataset_split');
    expect(csv).toContain('TRAIN_70');
    expect(csv).toContain('HOLDOUT_30');
    expect(csv).toContain('0.4500');
  });

  it('generates reproducible Python script with scipy ODE solver', () => {
    const py = generatePythonReproductionScript(mockParams, mockMetrics);
    expect(py).toContain('solve_ivp');
    expect(py).toContain('omega0_sq = 19.6133');
    expect(py).toContain('c1 = 0.15');
    expect(py).toContain('c2 = 0.02');
    expect(py).toContain('plt.show()');
  });

  it('generates structured Markdown Verification Certificate with metrics and audit trail', () => {
    const cert = generateVerificationCertificateMarkdown(mockParams, mockMetrics, mockProvenance);
    expect(cert).toContain('Verification Certificate');
    expect(cert).toContain('97.4%');
    expect(cert).toContain('Video Ingest');
    expect(cert).toContain('RK4 Fitting');
  });

  it('generates production-ready ROS 2 Humble Python control node with LQR gains', () => {
    const lqrModel = linearizeCartPole(DEFAULT_CARTPOLE_PARAMS);
    const ros2 = generateRos2NodeScript(mockParams, lqrModel);
    expect(ros2).toContain('rclpy');
    expect(ros2).toContain('AetherTwinLqrNode');
    expect(ros2).toContain('/cmd_force');
    expect(ros2).toContain('/joint_states');
  });

  it('generates embedded Arduino / C++ firmware for microcontroller deployment', () => {
    const lqrModel = linearizeCartPole(DEFAULT_CARTPOLE_PARAMS);
    const ino = generateArduinoCppFirmware(mockParams, lqrModel);
    expect(ino).toContain('#include <Arduino.h>');
    expect(ino).toContain('TARGET_POSITION');
    expect(ino).toContain('analogWrite');
  });

  it('generates MATLAB / Simulink state-space LQR script', () => {
    const lqrModel = linearizeCartPole(DEFAULT_CARTPOLE_PARAMS);
    const m = generateMatlabSimulinkScript(mockParams, lqrModel);
    expect(m).toContain('sys_ol = ss(A, B, C, D)');
    expect(m).toContain('lqr(A, B, Q, R)');
    expect(m).toContain('sys_cl = ss(A - B*K, B, C, D)');
  });
});

