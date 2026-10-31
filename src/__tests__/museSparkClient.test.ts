import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateMuseSparkDiagnosis,
  validateMuseSparkOutput,
  generateLocalRuleBasedDiagnostic,
  answerCopilotPhysicalQuery,
  MuseSparkDiagnosisInput
} from '../lib/meta/museSparkClient';

describe('Muse Spark 1.3 Client & Output Validation', () => {
  const baseInput: MuseSparkDiagnosisInput = {
    parameters: {
      omega0Sq: 19.61,
      damping: 0.15,
      initialAngle: 0.55,
      initialVelocity: 0.0,
      length: 0.5,
      gravity: 9.81
    },
    metrics: {
      trainMaeRad: 0.005,
      trainMseRad: 0.00003,
      trainRmseRad: 0.0055,
      trainMaeDeg: 0.28,
      trainRmseDeg: 0.31,
      holdoutMaeRad: 0.008,
      holdoutMseRad: 0.00008,
      holdoutRmseRad: 0.0089,
      holdoutMaeDeg: 0.45,
      holdoutRmseDeg: 0.51,
      baselineHoldoutMaeRad: 0.35,
      baselineHoldoutRmseRad: 0.4,
      baselineHoldoutMaeDeg: 20.0,
      baselineHoldoutRmseDeg: 22.9,
      errorReductionPercent: 97.8
    },
    trainCount: 84,
    holdoutCount: 36,
    warnings: [],
    isSyntheticSample: true,
    calibratedLengthMeters: 0.5
  };

  it('uses documented model ID muse-spark-1.3 and falls back gracefully when apiKey is missing', async () => {
    const result = await generateMuseSparkDiagnosis(baseInput);

    expect(result.isLiveModel).toBe(false);
    expect(result.modelUsed).toContain('No API Key');
    expect(result.diagnostic.summary).toContain('Verified Damped Pendulum Twin');
    expect(result.diagnostic.dampingRegime).toBe('underdamped');
    expect(result.diagnostic.qualityAssessment).toBe('high_fidelity');
  });

  it('strictly validates and normalizes well-formed Muse Spark JSON output', () => {
    const rawOutput = {
      summary: 'High accuracy planar oscillation verified against holdout frames.',
      dampingRegime: 'underdamped',
      qualityAssessment: 'high_fidelity',
      observedPhenomena: ['Exponential amplitude decay matching Stokes friction.'],
      physicalExplanations: ['1-DOF Lagrangian dynamics with linear dissipation.'],
      limitations: ['Assumes zero spherical wobble.'],
      suggestedAdjustments: {
        suggestedDamping: 0.15,
        suggestedGravity: 9.81,
        confidence: 0.95,
        reasoning: 'Parameters well-centered.'
      }
    };

    const validated = validateMuseSparkOutput(rawOutput, baseInput);

    expect(validated.summary).toBe(rawOutput.summary);
    expect(validated.dampingRegime).toBe('underdamped');
    expect(validated.qualityAssessment).toBe('high_fidelity');
    expect(validated.observedPhenomena).toEqual(rawOutput.observedPhenomena);
    expect(validated.physicalExplanations).toEqual(rawOutput.physicalExplanations);
    expect(validated.limitations).toEqual(rawOutput.limitations);
    expect(validated.suggestedAdjustments?.confidence).toBe(0.95);
  });

  it('sanitizes and repairs malformed output with missing arrays or invalid enums', () => {
    const malformedRaw = {
      summary: '',
      dampingRegime: 'invalid_regime_value',
      qualityAssessment: 12345,
      observedPhenomena: null,
      physicalExplanations: 'not an array',
      limitations: []
    };

    const validated = validateMuseSparkOutput(malformedRaw, baseInput);

    // Should fall back to safe defaults without throwing
    expect(validated.summary.length).toBeGreaterThan(0);
    expect(validated.dampingRegime).toBe('underdamped');
    expect(validated.qualityAssessment).toBe('high_fidelity');
    expect(Array.isArray(validated.observedPhenomena)).toBe(true);
    expect(validated.observedPhenomena.length).toBeGreaterThan(0);
    expect(Array.isArray(validated.physicalExplanations)).toBe(true);
    expect(Array.isArray(validated.limitations)).toBe(true);
  });

  it('handles API HTTP failures and falls back without pretending live output', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized: Invalid API Key'
    } as any);

    try {
      const result = await generateMuseSparkDiagnosis(baseInput, 'invalid_key');
      expect(result.isLiveModel).toBe(false);
      expect(result.modelUsed).toContain('API error: 401');
      expect(result.diagnostic.summary).toContain('Verified Damped Pendulum Twin');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles network exceptions and falls back gracefully', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockRejectedValue(new Error('Network connection refused'));

    try {
      const result = await generateMuseSparkDiagnosis(baseInput, 'dummy_key');
      expect(result.isLiveModel).toBe(false);
      expect(result.modelUsed).toContain('Network connection refused');
      expect(result.diagnostic).toBeDefined();
    } finally {
      global.fetch = originalFetch;
    }
  });

  describe('Interactive Physical Copilot Q&A', () => {
    const mockContext = {
      parameters: baseInput.parameters,
      metrics: baseInput.metrics,
      lqrModel: {
        K: [-10.0, -16.0, -70.32, -18.41],
        isStable: true
      },
      spectral: {
        fundamentalFrequencyHz: 0.707,
        harmonicRatio: 0.034,
        dominantHarmonicHz: 2.12
      },
      chaosHorizon: {
        lyapunovHorizonSeconds: 1.45,
        isChaotic: true
      }
    };

    it('answers LQR control & wind turbulence rejection queries with gains', () => {
      const ans = answerCopilotPhysicalQuery('Evaluate LQR control authority under high winds', mockContext);
      expect(ans).toContain('[LQR Control & Disturbance Rejection Analysis]');
      expect(ans).toContain('-70.32');
      expect(ans).toContain('Hurwitz Stability');
    });

    it('answers damping and energy dissipation queries', () => {
      const ans = answerCopilotPhysicalQuery('Explain damping and Stokes dissipation rate', mockContext);
      expect(ans).toContain('[Dissipation Dynamics & Damping Regime Analysis]');
      expect(ans).toContain('Underdamped');
      expect(ans).toContain('monotonically non-increasing');
    });

    it('answers Fourier harmonics and THD non-linearity queries', () => {
      const ans = answerCopilotPhysicalQuery('What causes the 3rd harmonic spectral distortion?', mockContext);
      expect(ans).toContain('[Fourier Spectral & Harmonic Distortion Analysis]');
      expect(ans).toContain('0.707 Hz');
      expect(ans).toContain('Duffing');
    });

    it('explains Taipei 101 TMD structural damper physics', () => {
      const ans = answerCopilotPhysicalQuery('How does the Taipei 101 TMD damper absorb wind vibrations?', mockContext);
      expect(ans).toContain('[Taipei 101 Tuned Mass Damper (TMD) Mechanics]');
      expect(ans).toContain('660-tonne');
    });

    it('explains holdout generalization vs overfitting', () => {
      const ans = answerCopilotPhysicalQuery('Is the model overfitting on the 70/30 holdout split?', mockContext);
      expect(ans).toContain('[Generalization Rigor & Holdout Validation Analysis]');
      expect(ans).toContain('RMSE');
      expect(ans).toContain('ODE invariants');
    });
  });
});
