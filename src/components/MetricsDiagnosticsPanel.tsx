'use client';

import React, { useState, useMemo } from 'react';
import {
  TrajectoryComparisonPoint,
  ValidationMetrics,
  MuseSparkDiagnostic,
  ProvenanceLogEntry,
  PendulumParameters,
  CalibrationConfig
} from '@/lib/types';
import {
  LineChart,
  Activity,
  AlertTriangle,
  Sparkles,
  Clock,
  Layers,
  TrendingUp,
  ShieldAlert,
  Compass,
  Zap,
  Download,
  FileCode,
  FileText,
  CheckCircle,
  Copy,
  Radio,
  Flame,
  Waves
} from 'lucide-react';
import { ProvenanceBadge } from './ProvenanceBadge';
import {
  generateTelemetryCSV,
  generatePythonReproductionScript,
  generateVerificationCertificateMarkdown,
  downloadTextFile
} from '@/lib/export/exportUtils';
import { computeSpectralAnalysis } from '@/lib/physics/fft';
import { simulateDoublePendulumChaos } from '@/lib/physics/doublePendulum';

interface MetricsDiagnosticsPanelProps {
  comparisonPoints: TrajectoryComparisonPoint[];
  metrics: ValidationMetrics | null;
  diagnostic: MuseSparkDiagnostic | null;
  diagnosticModelUsed?: string;
  isLiveDiagnostic?: boolean;
  splitTimestamp: number;
  identificationQuality?: 'confident' | 'marginal' | 'insufficient';
  warnings: string[];
  provenanceLog: ProvenanceLogEntry[];
  fittedParameters?: PendulumParameters | null;
  calibration?: Partial<CalibrationConfig>;
  onSeekFrame?: (frameIndex: number) => void;
}

export const MetricsDiagnosticsPanel: React.FC<MetricsDiagnosticsPanelProps> = ({
  comparisonPoints,
  metrics,
  diagnostic,
  diagnosticModelUsed,
  isLiveDiagnostic,
  splitTimestamp,
  identificationQuality = 'confident',
  warnings,
  provenanceLog,
  fittedParameters,
  calibration,
  onSeekFrame
}) => {
  const [activeTab, setActiveTab] = useState<
    'charts' | 'phase' | 'energy' | 'spectrum' | 'chaos' | 'diagnostics' | 'export' | 'provenance'
  >('charts');
  const [hoveredPoint, setHoveredPoint] = useState<TrajectoryComparisonPoint | null>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  // Compute Fast Fourier Transform / Spectral Analysis
  const spectralResult = useMemo(() => {
    if (comparisonPoints.length < 8) return null;
    const meas = comparisonPoints.map((p) => p.measuredAngleDeg);
    const pred = comparisonPoints.map((p) => p.predictedAngleDeg);
    return computeSpectralAnalysis(meas, pred, 30);
  }, [comparisonPoints]);

  // Compute Double Pendulum Chaos & Lyapunov Horizon
  const chaosResult = useMemo(() => {
    const l = fittedParameters?.length ?? 0.5;
    const g = fittedParameters?.gravity ?? (fittedParameters ? fittedParameters.omega0Sq * l : 9.81);
    const th0 = fittedParameters?.initialAngle ?? 0.65;
    return simulateDoublePendulumChaos(
      th0,
      th0 * 0.85,
      {
        l1: l / 2,
        l2: l / 2,
        m1: 0.5,
        m2: 0.5,
        gravity: g,
        damping1: (fittedParameters?.damping ?? 0.1) * 0.35,
        damping2: (fittedParameters?.damping ?? 0.1) * 0.35
      },
      6.0,
      30
    );
  }, [fittedParameters]);

  if (comparisonPoints.length === 0 || !metrics) {
    return (
      <div className="flex flex-col h-full bg-graphite-900 border border-graphite-800/60 rounded-lg p-6 items-center justify-center text-center font-mono">
        <Activity className="w-8 h-8 text-graphite-600 mb-2.5 animate-pulse" />
        <h3 className="text-xs font-semibold text-graphite-300 uppercase tracking-wider">
          STANDBY // PENDING KINEMATIC INTEGRATION
        </h3>
        <p className="text-[11px] text-graphite-500 max-w-xs mt-1 leading-relaxed">
          Run sample analysis or upload a video clip to fit the 70% parameter window and evaluate 30% holdout residuals.
        </p>
      </div>
    );
  }

  // Calculate SVG bounds for Trajectory Chart
  const svgWidth = 620;
  const svgHeight = 220;
  const padLeft = 42;
  const padRight = 16;
  const padTop = 24;
  const padBottom = 26;

  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const minTime = comparisonPoints[0].timestamp;
  const maxTime = comparisonPoints[comparisonPoints.length - 1].timestamp;
  const timeRange = Math.max(0.001, maxTime - minTime);

  // Auto-scaling angles
  let minAngle = Infinity;
  let maxAngle = -Infinity;
  for (const p of comparisonPoints) {
    minAngle = Math.min(minAngle, p.measuredAngleDeg, p.predictedAngleDeg);
    maxAngle = Math.max(maxAngle, p.measuredAngleDeg, p.predictedAngleDeg);
  }
  const anglePad = Math.max(5, (maxAngle - minAngle) * 0.15);
  minAngle -= anglePad;
  maxAngle += anglePad;
  const angleRange = Math.max(1, maxAngle - minAngle);

  const getX = (t: number) => padLeft + ((t - minTime) / timeRange) * plotW;
  const getY = (deg: number) => padTop + plotH - ((deg - minAngle) / angleRange) * plotH;

  const splitX = getX(splitTimestamp);

  // Build SVG path strings for trajectory
  let measuredPath = '';
  let predictedPath = '';
  let baselinePath = '';

  comparisonPoints.forEach((p, idx) => {
    const x = getX(p.timestamp);
    const yMeas = getY(p.measuredAngleDeg);
    const yPred = getY(p.predictedAngleDeg);
    const yBase = getY(p.baselineAngleDeg);

    if (idx === 0) {
      measuredPath += `M ${x} ${yMeas}`;
      predictedPath += `M ${x} ${yPred}`;
      baselinePath += `M ${x} ${yBase}`;
    } else {
      measuredPath += ` L ${x} ${yMeas}`;
      predictedPath += ` L ${x} ${yPred}`;
      baselinePath += ` L ${x} ${yBase}`;
    }
  });

  // Residuals plot bounds
  const resSvgHeight = 105;
  const resPlotH = resSvgHeight - padTop - padBottom;
  let maxAbsRes = 0.5;
  for (const p of comparisonPoints) {
    maxAbsRes = Math.max(maxAbsRes, Math.abs(p.residualDeg));
  }
  maxAbsRes = Math.min(25, Math.ceil(maxAbsRes * 1.25));

  const getResY = (res: number) =>
    padTop + resPlotH / 2 - (res / maxAbsRes) * (resPlotH / 2);

  let residualPath = '';
  comparisonPoints.forEach((p, idx) => {
    const x = getX(p.timestamp);
    const y = getResY(p.residualDeg);
    if (idx === 0) residualPath += `M ${x} ${y}`;
    else residualPath += ` L ${x} ${y}`;
  });

  // Phase Space Bounds (Theta vs Omega)
  let minOmega = Infinity;
  let maxOmega = -Infinity;
  for (const p of comparisonPoints) {
    const omMeas = p.measuredOmegaDeg ?? 0;
    const omPred = p.predictedOmegaDeg ?? 0;
    minOmega = Math.min(minOmega, omMeas, omPred);
    maxOmega = Math.max(maxOmega, omMeas, omPred);
  }
  const omegaPad = Math.max(10, (maxOmega - minOmega) * 0.15);
  minOmega -= omegaPad;
  maxOmega += omegaPad;
  const omegaRange = Math.max(1, maxOmega - minOmega);

  const getPhaseX = (thDeg: number) => padLeft + ((thDeg - minAngle) / angleRange) * plotW;
  const getPhaseY = (omDeg: number) => padTop + plotH - ((omDeg - minOmega) / omegaRange) * plotH;

  let phaseMeasuredPath = '';
  let phasePredictedPath = '';
  comparisonPoints.forEach((p, idx) => {
    const xMeas = getPhaseX(p.measuredAngleDeg);
    const yMeas = getPhaseY(p.measuredOmegaDeg ?? 0);
    const xPred = getPhaseX(p.predictedAngleDeg);
    const yPred = getPhaseY(p.predictedOmegaDeg ?? 0);

    if (idx === 0) {
      phaseMeasuredPath += `M ${xMeas} ${yMeas}`;
      phasePredictedPath += `M ${xPred} ${yPred}`;
    } else {
      phaseMeasuredPath += ` L ${xMeas} ${yMeas}`;
      phasePredictedPath += ` L ${xPred} ${yPred}`;
    }
  });

  // Energy plot bounds
  let maxEnergy = 0.1;
  for (const p of comparisonPoints) {
    if (p.energyTotal) maxEnergy = Math.max(maxEnergy, p.energyTotal);
  }
  maxEnergy *= 1.2;

  const getEnergyY = (e: number) => padTop + plotH - (e / maxEnergy) * plotH;

  let energyTotalPath = '';
  let energyKineticPath = '';
  let energyPotentialPath = '';

  comparisonPoints.forEach((p, idx) => {
    const x = getX(p.timestamp);
    const yTot = getEnergyY(p.energyTotal ?? 0);
    const yKin = getEnergyY(p.energyKinetic ?? 0);
    const yPot = getEnergyY(p.energyPotential ?? 0);

    if (idx === 0) {
      energyTotalPath += `M ${x} ${yTot}`;
      energyKineticPath += `M ${x} ${yKin}`;
      energyPotentialPath += `M ${x} ${yPot}`;
    } else {
      energyTotalPath += ` L ${x} ${yTot}`;
      energyKineticPath += ` L ${x} ${yKin}`;
      energyPotentialPath += ` L ${x} ${yPot}`;
    }
  });

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-graphite-900 border border-graphite-800/60 rounded-lg overflow-hidden">
      {/* Titlebar & Segmented Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between px-3 py-2 bg-[#0f1219] border-b border-graphite-800/60 gap-1.5">
        <div className="flex items-center gap-1.5 shrink-0">
          <LineChart className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-mono text-xs font-semibold text-graphite-100 tracking-tight whitespace-nowrap">
            VALIDATION & RESIDUALS
          </span>
          {fittedParameters?.dragModel && (
            <span className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-blue-950/40 text-blue-300 border border-blue-500/20 text-[9px] font-mono">
              {fittedParameters.dragModel.replace('_', ' ').toUpperCase()}
            </span>
          )}
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 font-mono text-[10px] shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab('charts')}
            className={`px-2 py-0.5 rounded transition ${
              activeTab === 'charts'
                ? 'bg-graphite-750 text-graphite-100 border border-graphite-700 font-semibold'
                : 'text-graphite-400 hover:text-graphite-200'
            }`}
          >
            TRAJECTORY
          </button>
          <button
            onClick={() => setActiveTab('phase')}
            className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
              activeTab === 'phase'
                ? 'bg-indigo-950/40 text-indigo-300 border border-indigo-500/30 font-semibold'
                : 'text-graphite-400 hover:text-graphite-200'
            }`}
          >
            <Compass className="w-2.5 h-2.5 text-indigo-400" />
            <span>PHASE</span>
          </button>
          <button
            onClick={() => setActiveTab('energy')}
            className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
              activeTab === 'energy'
                ? 'bg-cyan-950/40 text-cyan-300 border border-cyan-500/30 font-semibold'
                : 'text-graphite-400 hover:text-graphite-200'
            }`}
          >
            <Zap className="w-2.5 h-2.5 text-cyan-400" />
            <span>ENERGY</span>
          </button>
          <button
            onClick={() => setActiveTab('spectrum')}
            className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
              activeTab === 'spectrum'
                ? 'bg-teal-950/40 text-teal-300 border border-teal-500/30 font-semibold'
                : 'text-graphite-400 hover:text-graphite-200'
            }`}
          >
            <Waves className="w-2.5 h-2.5 text-teal-400" />
            <span>FFT</span>
          </button>
          <button
            onClick={() => setActiveTab('chaos')}
            className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
              activeTab === 'chaos'
                ? 'bg-purple-950/40 text-purple-300 border border-purple-500/30 font-semibold'
                : 'text-graphite-400 hover:text-graphite-200'
            }`}
          >
            <Flame className="w-2.5 h-2.5 text-amber-400" />
            <span>CHAOS</span>
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
              activeTab === 'diagnostics'
                ? 'bg-amber-950/40 text-amber-300 border border-amber-500/30 font-semibold'
                : 'text-graphite-400 hover:text-graphite-200'
            }`}
          >
            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
            <span>MUSE SPARK</span>
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
              activeTab === 'export'
                ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30 font-semibold'
                : 'text-graphite-400 hover:text-graphite-200'
            }`}
          >
            <Download className="w-2.5 h-2.5 text-emerald-400" />
            <span>EXPORT</span>
          </button>
          <button
            onClick={() => setActiveTab('provenance')}
            className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
              activeTab === 'provenance'
                ? 'bg-graphite-750 text-graphite-100 border border-graphite-700 font-semibold'
                : 'text-graphite-400 hover:text-graphite-200'
            }`}
          >
            <Layers className="w-2.5 h-2.5 text-graphite-400" />
            <span>AUDIT ({provenanceLog.length})</span>
          </button>
        </div>
      </div>

      {/* Main Content View */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        {/* KPI Metric Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
          <div className="p-2 rounded bg-graphite-850 border border-graphite-800">
            <div className="text-[9px] text-graphite-400 flex items-center justify-between">
              <span>HOLDOUT RMSE</span>
              <span className="text-amber-400 font-semibold">30% UNSEEN</span>
            </div>
            <div className="text-sm font-bold text-amber-300 mt-0.5 tabular-nums">
              {metrics.holdoutRmseDeg.toFixed(2)}°
            </div>
            <div className="text-[9px] text-graphite-500 mt-0.5 tabular-nums">
              MAE: {metrics.holdoutMaeDeg.toFixed(2)}°
            </div>
          </div>

          <div className="p-2 rounded bg-graphite-850 border border-graphite-800">
            <div className="text-[9px] text-graphite-400 flex items-center justify-between">
              <span>TRAIN FIT RMSE</span>
              <span className="text-emerald-400 font-semibold">70% FITTED</span>
            </div>
            <div className="text-sm font-bold text-emerald-400 mt-0.5 tabular-nums">
              {metrics.trainRmseDeg.toFixed(2)}°
            </div>
            <div className="text-[9px] text-graphite-500 mt-0.5 tabular-nums">
              MAE: {metrics.trainMaeDeg.toFixed(2)}°
            </div>
          </div>

          <div className="p-2 rounded bg-graphite-850 border border-graphite-800">
            <div className="text-[9px] text-graphite-400 flex items-center justify-between">
              <span>BASELINE RMSE</span>
              <span className="text-graphite-500">PERSISTENCE</span>
            </div>
            <div className="text-sm font-bold text-graphite-300 mt-0.5 tabular-nums">
              {metrics.baselineHoldoutRmseDeg.toFixed(2)}°
            </div>
            <div className="text-[9px] text-graphite-500 mt-0.5">
              Constant Velocity
            </div>
          </div>

          <div className="p-2 rounded bg-blue-950/20 border border-blue-500/20">
            <div className="text-[9px] text-blue-400 flex items-center justify-between">
              <span>ERROR REDUCTION</span>
              <TrendingUp className="w-2.5 h-2.5 text-blue-400" />
            </div>
            <div className="text-sm font-bold text-blue-300 mt-0.5 tabular-nums">
              -{metrics.errorReductionPercent.toFixed(1)}%
            </div>
            <div className="text-[9px] text-blue-400/70 mt-0.5">
              vs naive persistence
            </div>
          </div>
        </div>

        {/* Confidence Interval Strip */}
        {fittedParameters && (
          <div className="flex flex-wrap items-center gap-2 p-2 rounded bg-graphite-850/80 border border-graphite-800 text-[10px] font-mono text-graphite-300">
            <span className="text-graphite-500 uppercase tracking-wider text-[9px]">PARAMETERS (±1σ):</span>
            <span className="px-1.5 py-0.5 rounded bg-graphite-800 border border-graphite-750">
              ω₀² = {fittedParameters.omega0Sq} {fittedParameters.omega0SqUncertainty ? `± ${fittedParameters.omega0SqUncertainty}` : ''} s⁻²
            </span>
            <span className="px-1.5 py-0.5 rounded bg-graphite-800 border border-graphite-750">
              c₁ = {fittedParameters.damping} {fittedParameters.dampingUncertainty ? `± ${fittedParameters.dampingUncertainty}` : ''} s⁻¹
            </span>
            {fittedParameters.dampingQuadratic && (
              <span className="px-1.5 py-0.5 rounded bg-indigo-950/40 text-indigo-300 border border-indigo-500/20">
                c₂ = {fittedParameters.dampingQuadratic} rad⁻¹
              </span>
            )}
            {calibration?.arcFitRmse !== undefined && (
              <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-500/20">
                Circle Fit RMSE = {calibration.arcFitRmse}px
              </span>
            )}
          </div>
        )}

        {/* Quality Warning banner */}
        {warnings.length > 0 && (
          <div className="p-2 rounded bg-amber-950/30 border border-amber-500/20 text-amber-300 text-[10px] font-mono flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <div className="leading-tight">
              {warnings.map((w, i) => (
                <div key={i}>{w}</div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 1: TRAJECTORY & RESIDUALS */}
        {activeTab === 'charts' && (
          <>
            <div className="rounded bg-graphite-850 border border-graphite-800 p-2.5">
              <div className="flex items-center justify-between mb-1.5 font-mono text-[10px]">
                <div className="flex items-center gap-3">
                  <span className="text-graphite-300 font-semibold">
                    MEASURED vs DIGITAL TWIN TRAJECTORY
                  </span>
                  <div className="flex items-center gap-2 text-[9px]">
                    <span className="flex items-center gap-1 text-blue-400">
                      <span className="w-2 h-0.5 bg-blue-400 inline-block" /> Measured θ
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="w-2 h-0.5 bg-emerald-400 inline-block" /> RK4 Twin
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      <span className="w-2 h-0.5 bg-slate-500 inline-block border-t border-dashed" /> Baseline
                    </span>
                  </div>
                </div>
              </div>

              <div className="relative w-full aspect-[620/220] max-h-[260px]">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-full select-none"
                >
                  <rect
                    x={padLeft}
                    y={padTop}
                    width={splitX - padLeft}
                    height={plotH}
                    fill="rgba(16, 185, 129, 0.04)"
                  />
                  <rect
                    x={splitX}
                    y={padTop}
                    width={padLeft + plotW - splitX}
                    height={plotH}
                    fill="rgba(245, 158, 11, 0.05)"
                  />

                  {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
                    const y = padTop + plotH * frac;
                    const val = maxAngle - frac * angleRange;
                    return (
                      <g key={frac}>
                        <line
                          x1={padLeft}
                          y1={y}
                          x2={padLeft + plotW}
                          y2={y}
                          stroke="rgba(148, 163, 184, 0.12)"
                          strokeWidth="1"
                        />
                        <text
                          x={padLeft - 6}
                          y={y + 3}
                          fill="#64748b"
                          fontSize="8"
                          fontFamily="monospace"
                          textAnchor="end"
                        >
                          {val.toFixed(0)}°
                        </text>
                      </g>
                    );
                  })}

                  {minAngle < 0 && maxAngle > 0 && (
                    <line
                      x1={padLeft}
                      y1={getY(0)}
                      x2={padLeft + plotW}
                      y2={getY(0)}
                      stroke="rgba(148, 163, 184, 0.3)"
                      strokeWidth="1"
                      strokeDasharray="2,2"
                    />
                  )}

                  <line
                    x1={splitX}
                    y1={padTop}
                    x2={splitX}
                    y2={padTop + plotH}
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="3,3"
                  />
                  <text
                    x={splitX - 6}
                    y={padTop + 12}
                    fill="#10b981"
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="end"
                    fontWeight="bold"
                  >
                    TRAIN 70%
                  </text>
                  <text
                    x={splitX + 6}
                    y={padTop + 12}
                    fill="#f59e0b"
                    fontSize="8"
                    fontFamily="monospace"
                    textAnchor="start"
                    fontWeight="bold"
                  >
                    HOLDOUT 30%
                  </text>

                  <path
                    d={baselinePath}
                    fill="none"
                    stroke="#64748b"
                    strokeWidth="1"
                    strokeDasharray="3,3"
                    opacity="0.7"
                  />
                  <path
                    d={measuredPath}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    opacity="0.85"
                  />
                  <path
                    d={predictedPath}
                    fill="none"
                    stroke="#34d399"
                    strokeWidth="2"
                  />

                  {comparisonPoints.map((p, i) => {
                    const x = getX(p.timestamp);
                    const y = getY(p.measuredAngleDeg);
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r={hoveredPoint?.frameIndex === p.frameIndex ? 4 : 2}
                        fill={p.isTrain ? '#38bdf8' : '#f59e0b'}
                        className="cursor-pointer transition-all hover:scale-150"
                        onMouseEnter={() => {
                          setHoveredPoint(p);
                          onSeekFrame?.(p.frameIndex);
                        }}
                      />
                    );
                  })}
                </svg>
              </div>
            </div>

            <div className="rounded bg-graphite-850 border border-graphite-800 p-2.5">
              <div className="flex items-center justify-between mb-1.5 font-mono text-[10px]">
                <span className="text-graphite-300 font-semibold">
                  INSTANTANEOUS RESIDUAL CORRIDOR (Δθ = θ_pred - θ_meas)
                </span>
                <span className="text-graphite-400">Max Error: ±{maxAbsRes}°</span>
              </div>
              <div className="relative w-full aspect-[620/105]">
                <svg
                  viewBox={`0 0 ${svgWidth} ${resSvgHeight}`}
                  className="w-full h-full select-none"
                >
                  <rect
                    x={padLeft}
                    y={getResY(2)}
                    width={plotW}
                    height={Math.abs(getResY(-2) - getResY(2))}
                    fill="rgba(16, 185, 129, 0.08)"
                  />
                  <line
                    x1={padLeft}
                    y1={getResY(0)}
                    x2={padLeft + plotW}
                    y2={getResY(0)}
                    stroke="rgba(148, 163, 184, 0.3)"
                    strokeWidth="1"
                  />
                  <line
                    x1={splitX}
                    y1={padTop}
                    x2={splitX}
                    y2={padTop + resPlotH}
                    stroke="#f59e0b"
                    strokeWidth="1.5"
                    strokeDasharray="3,3"
                  />
                  <path
                    d={residualPath}
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="1.5"
                  />
                </svg>
              </div>
            </div>
          </>
        )}

        {/* TAB 2: PHASE SPACE PORTRAIT */}
        {activeTab === 'phase' && (
          <div className="rounded bg-graphite-850 border border-graphite-800 p-3 space-y-2">
            <div className="flex items-center justify-between font-mono text-[10px]">
              <div className="flex items-center gap-2">
                <Compass className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-graphite-200 font-semibold">
                  PHASE SPACE PORTRAIT [θ(t) vs ω(t)]
                </span>
              </div>
              <span className="text-indigo-300/80">Spiral Attractor Convergence to (0, 0)</span>
            </div>

            <div className="relative w-full aspect-[620/220] max-h-[260px]">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full select-none">
                <line
                  x1={getPhaseX(0)}
                  y1={padTop}
                  x2={getPhaseX(0)}
                  y2={padTop + plotH}
                  stroke="rgba(148, 163, 184, 0.25)"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
                <line
                  x1={padLeft}
                  y1={getPhaseY(0)}
                  x2={padLeft + plotW}
                  y2={getPhaseY(0)}
                  stroke="rgba(148, 163, 184, 0.25)"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
                <text
                  x={padLeft + plotW - 10}
                  y={getPhaseY(0) - 5}
                  fill="#94a3b8"
                  fontSize="8"
                  fontFamily="monospace"
                  textAnchor="end"
                >
                  +θ (deg)
                </text>
                <text
                  x={getPhaseX(0) + 5}
                  y={padTop + 12}
                  fill="#94a3b8"
                  fontSize="8"
                  fontFamily="monospace"
                >
                  +ω (deg/s)
                </text>

                <path
                  d={phaseMeasuredPath}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1.2"
                  opacity="0.6"
                />
                <path
                  d={phasePredictedPath}
                  fill="none"
                  stroke="#818cf8"
                  strokeWidth="2"
                />
                <circle
                  cx={getPhaseX(0)}
                  cy={getPhaseY(0)}
                  r="3.5"
                  fill="#ef4444"
                />
              </svg>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-graphite-400 pt-1 border-t border-graphite-800">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-sky-400" /> Measured Orbit
                <span className="w-2.5 h-0.5 bg-indigo-400 ml-2" /> RK4 Predicted Spiral
              </span>
              <span>Fixed-point attractor at origin: θ = 0, ω = 0</span>
            </div>
          </div>
        )}

        {/* TAB 3: ENERGY DISSIPATION */}
        {activeTab === 'energy' && (
          <div className="rounded bg-graphite-850 border border-graphite-800 p-3 space-y-2">
            <div className="flex items-center justify-between font-mono text-[10px]">
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-graphite-200 font-semibold">
                  MECHANICAL ENERGY DISSIPATION [E = T + V]
                </span>
              </div>
              <span className="text-cyan-300/80">dE/dt = -c₁L²ω² - c₂L²|ω|³</span>
            </div>

            <div className="relative w-full aspect-[620/220] max-h-[260px]">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full select-none">
                {[0, 0.5, 1.0].map((frac) => (
                  <line
                    key={frac}
                    x1={padLeft}
                    y1={padTop + plotH * frac}
                    x2={padLeft + plotW}
                    y2={padTop + plotH * frac}
                    stroke="rgba(148, 163, 184, 0.12)"
                    strokeWidth="1"
                  />
                ))}

                <line
                  x1={splitX}
                  y1={padTop}
                  x2={splitX}
                  y2={padTop + plotH}
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                />

                <path
                  d={energyKineticPath}
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                  opacity="0.6"
                />
                <path
                  d={energyPotentialPath}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                  opacity="0.6"
                />
                <path
                  d={energyTotalPath}
                  fill="none"
                  stroke="#06b6d4"
                  strokeWidth="2.5"
                />
              </svg>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-graphite-400 pt-1 border-t border-graphite-800">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-cyan-400 font-semibold">
                  <span className="w-2.5 h-1 bg-cyan-400 inline-block" /> Total E(t)
                </span>
                <span className="flex items-center gap-1 text-amber-400/80">
                  <span className="w-2.5 h-0.5 bg-amber-400 inline-block" /> Kinetic T
                </span>
                <span className="flex items-center gap-1 text-blue-400/80">
                  <span className="w-2.5 h-0.5 bg-blue-400 inline-block" /> Potential V
                </span>
              </div>
              <span>Monotonic decay under Stokes drag</span>
            </div>
          </div>
        )}

        {/* TAB 4: FAST FOURIER TRANSFORM (FFT SPECTRUM) */}
        {activeTab === 'spectrum' && (
          <div className="rounded bg-graphite-850 border border-graphite-800 p-3 space-y-2.5">
            <div className="flex items-center justify-between font-mono text-[10px]">
              <div className="flex items-center gap-2">
                <Waves className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-graphite-200 font-semibold">
                  FAST FOURIER TRANSFORM // SPECTRAL POWER DENSITY
                </span>
              </div>
              {spectralResult && (
                <span className="text-teal-300 font-semibold">
                  Resonant Peak: f₀ = {spectralResult.fundamentalFrequencyHz} Hz
                </span>
              )}
            </div>

            {spectralResult && (
              <>
                <div className="relative w-full aspect-[620/200] max-h-[230px]">
                  <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full select-none">
                    {/* Frequency spectrum bars / curve */}
                    {(() => {
                      const maxFreq = Math.min(6.0, spectralResult.nyquistHz);
                      let maxMag = 0.1;
                      spectralResult.spectrum.forEach((s) => {
                        if (s.frequencyHz <= maxFreq) {
                          maxMag = Math.max(maxMag, s.measuredMagnitude, s.predictedMagnitude);
                        }
                      });
                      maxMag *= 1.25;

                      const getFx = (f: number) => padLeft + (f / maxFreq) * plotW;
                      const getFy = (m: number) => padTop + plotH - (m / maxMag) * plotH;

                      let measSpecPath = '';
                      let predSpecPath = '';

                      spectralResult.spectrum.forEach((pt, i) => {
                        if (pt.frequencyHz > maxFreq) return;
                        const x = getFx(pt.frequencyHz);
                        const yM = getFy(pt.measuredMagnitude);
                        const yP = getFy(pt.predictedMagnitude);

                        if (i === 0) {
                          measSpecPath += `M ${x} ${yM}`;
                          predSpecPath += `M ${x} ${yP}`;
                        } else {
                          measSpecPath += ` L ${x} ${yM}`;
                          predSpecPath += ` L ${x} ${yP}`;
                        }
                      });

                      return (
                        <>
                          {/* Grid */}
                          {[1, 2, 3, 4, 5].map((hz) => (
                            <g key={hz}>
                              <line
                                x1={getFx(hz)}
                                y1={padTop}
                                x2={getFx(hz)}
                                y2={padTop + plotH}
                                stroke="rgba(148, 163, 184, 0.12)"
                                strokeWidth="1"
                              />
                              <text
                                x={getFx(hz)}
                                y={padTop + plotH + 12}
                                fill="#64748b"
                                fontSize="8"
                                fontFamily="monospace"
                                textAnchor="middle"
                              >
                                {hz} Hz
                              </text>
                            </g>
                          ))}

                          {/* Spectral Curves */}
                          <path
                            d={measSpecPath}
                            fill="none"
                            stroke="#38bdf8"
                            strokeWidth="1.5"
                            opacity="0.8"
                          />
                          <path
                            d={predSpecPath}
                            fill="none"
                            stroke="#14b8a6"
                            strokeWidth="2.5"
                          />

                          {/* Fundamental Peak Indicator */}
                          <line
                            x1={getFx(spectralResult.fundamentalFrequencyHz)}
                            y1={padTop}
                            x2={getFx(spectralResult.fundamentalFrequencyHz)}
                            y2={padTop + plotH}
                            stroke="#14b8a6"
                            strokeWidth="1.5"
                            strokeDasharray="2,2"
                          />
                        </>
                      );
                    })()}
                  </svg>
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono text-[10px] pt-1 border-t border-graphite-800">
                  <div className="p-2 rounded bg-graphite-800">
                    <span className="text-graphite-400 block text-[9px]">FUNDAMENTAL f₀</span>
                    <span className="text-teal-300 font-bold text-xs">
                      {spectralResult.fundamentalFrequencyHz} Hz
                    </span>
                    <span className="text-graphite-500 block text-[9px]">
                      Period T = {(1 / spectralResult.fundamentalFrequencyHz).toFixed(2)}s
                    </span>
                  </div>
                  <div className="p-2 rounded bg-graphite-800">
                    <span className="text-graphite-400 block text-[9px]">NON-LINEAR HARMONIC</span>
                    <span className="text-cyan-300 font-bold text-xs">
                      {spectralResult.dominantHarmonicHz ? `${spectralResult.dominantHarmonicHz} Hz` : 'Sub-threshold'}
                    </span>
                    <span className="text-graphite-500 block text-[9px]">
                      Odd overtone 3f₀
                    </span>
                  </div>
                  <div className="p-2 rounded bg-graphite-800">
                    <span className="text-graphite-400 block text-[9px]">HARMONIC RATIO</span>
                    <span className="text-amber-300 font-bold text-xs">
                      {(spectralResult.harmonicRatio * 100).toFixed(1)}%
                    </span>
                    <span className="text-graphite-500 block text-[9px]">
                      sin(θ) non-linearity
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 5: DOUBLE PENDULUM CHAOS & LYAPUNOV HORIZON */}
        {activeTab === 'chaos' && (
          <div className="rounded bg-graphite-850 border border-graphite-800 p-3 space-y-2.5 font-mono">
            <div className="flex items-center justify-between text-[10px]">
              <div className="flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-graphite-200 font-semibold">
                  2-DOF DOUBLE PENDULUM CHAOS // LYAPUNOV HORIZON
                </span>
              </div>
              <span className="text-purple-300 font-semibold">
                Horizon: {chaosResult.lyapunovHorizonSeconds}s
              </span>
            </div>

            <div className="relative w-full aspect-[620/190] max-h-[220px]">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full select-none">
                {(() => {
                  const maxT = 6.0;
                  const maxDiv = 1.6; // ~90 degrees
                  const getCx = (t: number) => padLeft + (t / maxT) * plotW;
                  const getCy = (div: number) => padTop + plotH - (Math.min(maxDiv, div) / maxDiv) * plotH;

                  const horizonX = getCx(chaosResult.lyapunovHorizonSeconds);

                  let divPath = '';
                  chaosResult.statesPrimary.forEach((st, i) => {
                    const x = getCx(st.t);
                    const y = getCy(st.divergenceRad ?? 0);
                    if (i === 0) divPath += `M ${x} ${y}`;
                    else divPath += ` L ${x} ${y}`;
                  });

                  return (
                    <>
                      {/* Chaos Zone Shading */}
                      <rect
                        x={horizonX}
                        y={padTop}
                        width={padLeft + plotW - horizonX}
                        height={plotH}
                        fill="rgba(168, 85, 247, 0.08)"
                      />

                      {/* 5-degree divergence threshold line */}
                      <line
                        x1={padLeft}
                        y1={getCy(0.087)}
                        x2={padLeft + plotW}
                        y2={getCy(0.087)}
                        stroke="rgba(244, 63, 94, 0.5)"
                        strokeWidth="1"
                        strokeDasharray="3,3"
                      />
                      <text
                        x={padLeft + 6}
                        y={getCy(0.087) - 4}
                        fill="#f43f5e"
                        fontSize="8"
                        fontFamily="monospace"
                      >
                        5.0° Divergence Threshold
                      </text>

                      {/* Lyapunov Horizon Marker */}
                      <line
                        x1={horizonX}
                        y1={padTop}
                        x2={horizonX}
                        y2={padTop + plotH}
                        stroke="#a855f7"
                        strokeWidth="1.8"
                        strokeDasharray="2,2"
                      />
                      <text
                        x={horizonX + 4}
                        y={padTop + 14}
                        fill="#c084fc"
                        fontSize="8"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        LYAPUNOV HORIZON ({chaosResult.lyapunovHorizonSeconds}s)
                      </text>

                      {/* Divergence Curve */}
                      <path
                        d={divPath}
                        fill="none"
                        stroke="#e879f9"
                        strokeWidth="2"
                      />
                    </>
                  );
                })()}
              </svg>
            </div>

            <div className="p-2.5 rounded bg-purple-950/20 border border-purple-500/20 text-[10px] text-purple-200/90 leading-relaxed">
              <strong>The Mathematical Horizon of Digital Twins:</strong> With a microscopic perturbation (&delta;₀ = 10⁻⁵ rad), the deterministic twin stays faithful until <span className="text-amber-300 font-bold">{chaosResult.lyapunovHorizonSeconds}s</span>, after which sensitive dependence on initial conditions produces exponential divergence (|&Delta;&theta;| ~ e^({chaosResult.maxLyapunovExponent}·t)).
            </div>
          </div>
        )}

        {/* TAB 6: MUSE SPARK AI DIAGNOSTICS */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-3 font-mono text-xs">
            <div className="p-2.5 rounded bg-amber-950/20 border border-amber-500/30 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-amber-200 text-[11px]">
                    Meta Muse Spark Physical Reasoning
                  </span>
                  <ProvenanceBadge kind="MODEL_GENERATED" />
                </div>
                <p className="text-[10px] text-amber-300/70 mt-0.5 leading-relaxed">
                  Model: <code className="text-amber-200">{diagnosticModelUsed || 'muse-spark-1.3'}</code>{' '}
                  {isLiveDiagnostic ? '(Live API)' : '(Deterministic Verified Fallback)'}.
                  Generative physical hypotheses bounded by fitted numerical physics. Distinguished strictly from empirical measurements and calculated numerical truth.
                </p>
              </div>
            </div>

            {diagnostic ? (
              <div className="space-y-2.5">
                <div className="p-3 rounded bg-graphite-850 border border-graphite-800">
                  <div className="text-[9px] text-graphite-400 uppercase tracking-wider mb-1 font-semibold">
                    FIDELITY ASSESSMENT
                  </div>
                  <div className="text-xs font-semibold text-graphite-100 leading-snug">
                    {diagnostic.summary}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="px-1.5 py-0.5 rounded bg-graphite-800 text-graphite-300 border border-graphite-700 text-[9px]">
                      REGIME: {diagnostic.dampingRegime.toUpperCase()}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-500/20 text-[9px]">
                      FIDELITY: {diagnostic.qualityAssessment.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded bg-graphite-850 border border-graphite-800">
                  <div className="text-[9px] text-graphite-400 uppercase tracking-wider mb-1.5 font-semibold">
                    KINEMATIC OBSERVATIONS
                  </div>
                  <ul className="space-y-1 list-disc list-inside text-graphite-300 text-[11px]">
                    {diagnostic.observedPhenomena.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 rounded bg-graphite-850 border border-graphite-800">
                  <div className="text-[9px] text-graphite-400 uppercase tracking-wider mb-1.5 font-semibold">
                    THEORETICAL DYNAMICS & MECHANICS
                  </div>
                  <ul className="space-y-1 list-disc list-inside text-graphite-300 text-[11px]">
                    {diagnostic.physicalExplanations.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 rounded bg-graphite-850 border border-graphite-800">
                  <div className="text-[9px] text-amber-400 uppercase tracking-wider mb-1.5 font-semibold flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" />
                    PHYSICAL LIMITATIONS & DIVERGENCE
                  </div>
                  <ul className="space-y-1 list-disc list-inside text-graphite-400 text-[10px]">
                    {diagnostic.limitations.map((item, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-graphite-500 text-xs">
                Generating Muse Spark physical diagnosis...
              </div>
            )}
          </div>
        )}

        {/* TAB 7: EXPORT & CERTIFICATE */}
        {activeTab === 'export' && (
          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 rounded bg-graphite-850 border border-graphite-800">
              <h4 className="text-xs font-semibold text-graphite-100 flex items-center gap-2 mb-2">
                <Download className="w-4 h-4 text-emerald-400" />
                Export Telemetry & Reproducibility Package
              </h4>
              <p className="text-[11px] text-graphite-400 leading-relaxed mb-3">
                Download raw empirical angles, fitted trajectory coordinates, baseline benchmark points, standalone Python simulation scripts, or a formal Verification Certificate.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    const csv = generateTelemetryCSV(comparisonPoints);
                    downloadTextFile('aethertwin_telemetry.csv', csv, 'text/csv');
                  }}
                  className="px-3 py-2 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 border border-graphite-700 flex items-center justify-center gap-1.5 transition text-[11px]"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>Download CSV</span>
                </button>

                <button
                  onClick={() => {
                    if (!fittedParameters) return;
                    const py = generatePythonReproductionScript(fittedParameters, metrics, calibration);
                    downloadTextFile('simulate_aethertwin.py', py, 'text/x-python');
                  }}
                  className="px-3 py-2 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 border border-graphite-700 flex items-center justify-center gap-1.5 transition text-[11px]"
                >
                  <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Python Script</span>
                </button>

                <button
                  onClick={() => {
                    if (!fittedParameters) return;
                    const cert = generateVerificationCertificateMarkdown(
                      fittedParameters,
                      metrics,
                      provenanceLog,
                      calibration
                    );
                    downloadTextFile('Verification_Certificate.md', cert, 'text/markdown');
                  }}
                  className="px-3 py-2 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 border border-graphite-700 flex items-center justify-center gap-1.5 transition text-[11px]"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Certificate (.md)</span>
                </button>
              </div>
            </div>

            {fittedParameters && (
              <div className="p-3 rounded bg-graphite-850 border border-graphite-800 space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-graphite-400 font-semibold">REPRODUCIBLE PYTHON SNIPPET</span>
                  <button
                    onClick={() => {
                      const py = generatePythonReproductionScript(fittedParameters, metrics, calibration);
                      handleCopy(py, 'python');
                    }}
                    className="flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                  >
                    {copiedType === 'python' ? (
                      <>
                        <CheckCircle className="w-3 h-3" /> Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" /> Copy Script
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-2.5 rounded bg-[#090c12] text-[10px] text-graphite-300 overflow-x-auto max-h-36 font-mono leading-relaxed border border-graphite-800">
                  {generatePythonReproductionScript(fittedParameters, metrics, calibration).substring(0, 480)}...
                </pre>
              </div>
            )}
          </div>
        )}

        {/* TAB 8: PROVENANCE LOG */}
        {activeTab === 'provenance' && (
          <div className="space-y-2 font-mono text-xs">
            <div className="text-[10px] text-graphite-400 pb-1.5 border-b border-graphite-800">
              Audit log categorizing data into Observed Evidence (blue), Calculated Truth (emerald), and Model Hypotheses (amber).
            </div>
            {provenanceLog.map((entry) => (
              <div
                key={entry.id}
                className="p-2 rounded bg-graphite-850 border border-graphite-800 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <ProvenanceBadge kind={entry.kind} />
                    <span className="font-semibold text-graphite-200 text-[11px]">
                      {entry.category}
                    </span>
                  </div>
                  <span className="text-[9px] text-graphite-500 flex items-center gap-1 tabular-nums">
                    <Clock className="w-2.5 h-2.5" />
                    {entry.timestamp}
                  </span>
                </div>
                <div className="text-graphite-300 text-[11px] leading-relaxed">
                  {entry.summary}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
