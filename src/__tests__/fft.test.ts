import { describe, it, expect } from 'vitest';
import { computeSpectralAnalysis } from '../lib/physics/fft';

describe('FFT & Power Spectral Density Analysis', () => {
  it('handles short signals below threshold (<8 samples)', () => {
    const res = computeSpectralAnalysis([1, 2, 3], [1, 2, 3], 30);
    expect(res.spectrum).toHaveLength(0);
    expect(res.fundamentalFrequencyHz).toBe(0);
    expect(res.harmonicRatio).toBe(0);
  });

  it('correctly resolves fundamental resonance frequency for pure sinusoid', () => {
    const fps = 30;
    const durationSec = 4.0;
    const n = Math.floor(fps * durationSec); // 120 samples
    const targetFreqHz = 1.0; // 1 Hz pendulum swing

    const measured: number[] = [];
    const predicted: number[] = [];

    for (let i = 0; i < n; i++) {
      const t = i / fps;
      // 20 degree amplitude at 1.0 Hz
      const val = 20.0 * Math.sin(2 * Math.PI * targetFreqHz * t);
      measured.push(val);
      predicted.push(val * 0.98); // slightly lower amplitude
    }

    const res = computeSpectralAnalysis(measured, predicted, fps);

    expect(res.spectrum.length).toBeGreaterThan(0);
    expect(res.samplingRateFps).toBe(30);
    expect(res.nyquistHz).toBe(15);
    // Bin resolution is 30 / 120 = 0.25 Hz. Fundamental frequency should be within 0.25 Hz of 1.0 Hz.
    expect(Math.abs(res.fundamentalFrequencyHz - targetFreqHz)).toBeLessThanOrEqual(0.26);
    expect(res.totalMeasuredPower).toBeGreaterThan(0);
  });

  it('detects 3rd harmonic overtone and computes non-linear harmonic ratio', () => {
    const fps = 30;
    const n = 150; // 5 seconds
    const f0 = 0.8;
    const f3 = 2.4; // 3 * 0.8

    const measured: number[] = [];
    const predicted: number[] = [];

    for (let i = 0; i < n; i++) {
      const t = i / fps;
      // Fundamental + 30% 3rd harmonic overtone (characteristic of large angle non-linear swing)
      const val =
        25.0 * Math.sin(2 * Math.PI * f0 * t) + 7.5 * Math.sin(2 * Math.PI * f3 * t);
      measured.push(val);
      predicted.push(val);
    }

    const res = computeSpectralAnalysis(measured, predicted, fps);

    expect(res.dominantHarmonicHz).toBeDefined();
    // Dominant harmonic should be near 2.4 Hz
    expect(Math.abs(res.dominantHarmonicHz! - f3)).toBeLessThan(0.35);
    expect(res.harmonicRatio).toBeGreaterThan(0.1);
  });
});
