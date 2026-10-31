/**
 * Discrete Fourier Transform (FFT / Power Spectral Density)
 * Analyzes kinematic oscillation frequencies, fundamental resonance, and harmonic overtones.
 */

export interface SpectralPoint {
  frequencyHz: number;
  measuredMagnitude: number;
  predictedMagnitude: number;
}

export interface SpectralAnalysisResult {
  spectrum: SpectralPoint[];
  fundamentalFrequencyHz: number;
  dominantHarmonicHz?: number;
  samplingRateFps: number;
  nyquistHz: number;
  totalMeasuredPower: number;
  totalPredictedPower: number;
  harmonicRatio: number; // Ratio of harmonic power to fundamental (measures non-linearity)
}

/**
 * Computes Discrete Fourier Transform of angular time series using Hanning windowing.
 */
export function computeSpectralAnalysis(
  measuredAnglesDeg: number[],
  predictedAnglesDeg: number[],
  fps: number = 30
): SpectralAnalysisResult {
  const n = measuredAnglesDeg.length;
  if (n < 8) {
    return {
      spectrum: [],
      fundamentalFrequencyHz: 0,
      samplingRateFps: fps,
      nyquistHz: fps / 2,
      totalMeasuredPower: 0,
      totalPredictedPower: 0,
      harmonicRatio: 0
    };
  }

  // 1. Remove DC offset (mean)
  const meanMeas = measuredAnglesDeg.reduce((a, b) => a + b, 0) / n;
  const meanPred = predictedAnglesDeg.reduce((a, b) => a + b, 0) / n;

  const zeroMeanMeas = measuredAnglesDeg.map((y) => y - meanMeas);
  const zeroMeanPred = predictedAnglesDeg.map((y) => y - meanPred);

  // 2. Apply Hanning window to reduce spectral leakage
  const windowedMeas = zeroMeanMeas.map(
    (y, i) => y * (0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1))))
  );
  const windowedPred = zeroMeanPred.map(
    (y, i) => y * (0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1))))
  );

  // 3. Compute DFT up to Nyquist frequency (N / 2 bins)
  const numBins = Math.floor(n / 2);
  const spectrum: SpectralPoint[] = [];

  let maxMeasMag = 0;
  let fundamentalFreq = 0;
  let totalMeasPower = 0;
  let totalPredPower = 0;

  for (let k = 1; k < numBins; k++) {
    const freq = (k * fps) / n;

    // DFT for measured
    let realMeas = 0;
    let imagMeas = 0;
    // DFT for predicted
    let realPred = 0;
    let imagPred = 0;

    for (let t = 0; t < n; t++) {
      const angle = (2 * Math.PI * k * t) / n;
      const cosVal = Math.cos(angle);
      const sinVal = Math.sin(angle);

      realMeas += windowedMeas[t] * cosVal;
      imagMeas -= windowedMeas[t] * sinVal;

      realPred += windowedPred[t] * cosVal;
      imagPred -= windowedPred[t] * sinVal;
    }

    const magMeas = (2 * Math.sqrt(realMeas * realMeas + imagMeas * imagMeas)) / n;
    const magPred = (2 * Math.sqrt(realPred * realPred + imagPred * imagPred)) / n;

    totalMeasPower += magMeas * magMeas;
    totalPredPower += magPred * magPred;

    if (magMeas > maxMeasMag) {
      maxMeasMag = magMeas;
      fundamentalFreq = freq;
    }

    spectrum.push({
      frequencyHz: Number(freq.toFixed(3)),
      measuredMagnitude: Number(magMeas.toFixed(3)),
      predictedMagnitude: Number(magPred.toFixed(3))
    });
  }

  // 4. Check for harmonic peak (around 3 * fundamental)
  let dominantHarmonicHz: number | undefined = undefined;
  const harmonicExpected = fundamentalFreq * 3;
  let maxHarmonicMag = 0;

  for (const pt of spectrum) {
    if (Math.abs(pt.frequencyHz - harmonicExpected) < 0.35 && pt.measuredMagnitude > maxHarmonicMag) {
      maxHarmonicMag = pt.measuredMagnitude;
      dominantHarmonicHz = pt.frequencyHz;
    }
  }

  const harmonicRatio = maxMeasMag > 0 ? Number((maxHarmonicMag / maxMeasMag).toFixed(3)) : 0;

  return {
    spectrum,
    fundamentalFrequencyHz: Number(fundamentalFreq.toFixed(3)),
    dominantHarmonicHz: dominantHarmonicHz ? Number(dominantHarmonicHz.toFixed(3)) : undefined,
    samplingRateFps: fps,
    nyquistHz: fps / 2,
    totalMeasuredPower: Number(totalMeasPower.toFixed(3)),
    totalPredictedPower: Number(totalPredPower.toFixed(3)),
    harmonicRatio
  };
}
