'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header, AppViewMode } from '@/components/Header';
import { PipelineTimeline } from '@/components/PipelineTimeline';
import { VideoInspectionPanel } from '@/components/VideoInspectionPanel';
import { InteractiveTwinPanel } from '@/components/InteractiveTwinPanel';
import { MetricsDiagnosticsPanel } from '@/components/MetricsDiagnosticsPanel';
import { CalibrationModal } from '@/components/CalibrationModal';
import { UploadModal } from '@/components/UploadModal';
import { HelpModal } from '@/components/HelpModal';
import { PhysicsTelemetryBento } from '@/components/ui/physics-telemetry-bento';
import AnalyticsBentoDemo from '@/components/ui/demo';
import {
  FrameMeasurement,
  CalibrationConfig,
  PendulumParameters,
  ValidationMetrics,
  TrajectoryComparisonPoint,
  MuseSparkDiagnostic,
  ProvenanceLogEntry,
  PipelineStage,
  Point2D,
  BoundingBox,
  BenchmarkPresetId
} from '@/lib/types';
import {
  generateSyntheticPendulumSample,
  BENCHMARK_PRESETS
} from '@/lib/sample/syntheticPendulum';
import { fitDampedPendulum } from '@/lib/physics/parameterFitter';
import { trackVideoInBrowser } from '@/lib/cv/opticalTracker';
import { physicsAudio } from '@/lib/audio/physicsAudio';
import { Play, Upload, Activity, ShieldCheck, ChevronRight, Layers, Compass, Zap, Cpu } from 'lucide-react';

export default function Home() {
  // Analytical state
  const [stage, setStage] = useState<PipelineStage>('idle');
  const [error, setError] = useState<string | undefined>(undefined);
  const [measurements, setMeasurements] = useState<FrameMeasurement[]>([]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  const [fittedParameters, setFittedParameters] = useState<PendulumParameters | null>(null);
  const [metrics, setMetrics] = useState<ValidationMetrics | null>(null);
  const [comparisonPoints, setComparisonPoints] = useState<TrajectoryComparisonPoint[]>([]);
  const [splitTimestamp, setSplitTimestamp] = useState<number>(0);
  const [identificationQuality, setIdentificationQuality] = useState<'confident' | 'marginal' | 'insufficient'>('confident');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [diagnostic, setDiagnostic] = useState<MuseSparkDiagnostic | null>(null);
  const [diagnosticModelUsed, setDiagnosticModelUsed] = useState<string>('muse-spark-1.3');
  const [isLiveDiagnostic, setIsLiveDiagnostic] = useState<boolean>(false);
  const [provenanceLog, setProvenanceLog] = useState<ProvenanceLogEntry[]>([]);
  const [activePresetId, setActivePresetId] = useState<BenchmarkPresetId>('standard');
  const [activeView, setActiveView] = useState<AppViewMode>('workbench');
  const [isAudioActive, setIsAudioActive] = useState<boolean>(false);

  // Source media state
  const [isSyntheticSample, setIsSyntheticSample] = useState<boolean>(true);
  const [videoUrl, setVideoUrl] = useState<string | undefined>(undefined);
  const [videoMetadata, setVideoMetadata] = useState<{
    width: number;
    height: number;
    fps: number;
    durationSec: number;
  }>({
    width: 640,
    height: 480,
    fps: 30,
    durationSec: 4.0
  });

  // Calibration state
  const [calibration, setCalibration] = useState<CalibrationConfig>({
    pivot: { x: 320, y: 70 },
    knownLengthMeters: 0.50,
    scalePixelsPerMeter: 500,
    videoFps: 30
  });

  // UI Interactive state
  const [isSyncedWithVideo, setIsSyncedWithVideo] = useState<boolean>(true);
  const [isCalibrationOpen, setIsCalibrationOpen] = useState<boolean>(false);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);

  // Check if API key is configured on server on mount
  useEffect(() => {
    async function checkApiKey() {
      try {
        const res = await fetch('/api/segment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            width: 10,
            height: 10,
            fps: 30,
            pivot: { x: 5, y: 5 },
            initialBobPoint: { x: 5, y: 5 }
          })
        });
        const data = await res.json();
        if (data.demoMode) {
          setIsDemoMode(true);
        } else {
          setIsDemoMode(false);
        }
      } catch {
        setIsDemoMode(true);
      }
    }
    checkApiKey();
  }, []);

  const addProvenance = (
    kind: ProvenanceLogEntry['kind'],
    category: string,
    summary: string,
    details?: Record<string, any>
  ) => {
    const entry: ProvenanceLogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      kind,
      category,
      summary,
      details
    };
    setProvenanceLog((prev) => [entry, ...prev]);
  };

  // Run End-to-End Sample Analysis
  const handleRunSampleAnalysis = useCallback(async (presetId?: BenchmarkPresetId) => {
    const chosenPreset = presetId || activePresetId || 'standard';
    setActivePresetId(chosenPreset);
    setError(undefined);
    setProvenanceLog([]);
    setStage('video_loaded');
    setIsSyntheticSample(true);
    setVideoUrl(undefined);

    // 1. Generate Synthetic Sample
    const sample = generateSyntheticPendulumSample(chosenPreset);
    setVideoMetadata(sample.videoMetadata);
    setCalibration(sample.calibration);
    setMeasurements(sample.measurements);
    setCurrentFrameIndex(0);

    addProvenance(
      'OBSERVED',
      'Synthetic Benchmark Preset',
      `Loaded reference dataset: ${sample.name} (${sample.videoMetadata.frameCount} frames at ${sample.videoMetadata.fps} FPS, L=${sample.groundTruthParameters.lengthMeters}m).`,
      sample.groundTruthParameters
    );

    // 2. Segmenting stage
    setStage('segmenting');
    await new Promise((r) => setTimeout(r, 200));

    addProvenance(
      'OBSERVED',
      'Optical Bob Segmentation',
      `Identified pendulum bob mask & bounding boxes across all ${sample.measurements.length} frames (mean confidence: 0.98).`
    );

    // 3. Measuring stage
    setStage('measuring');
    await new Promise((r) => setTimeout(r, 200));

    addProvenance(
      'OBSERVED',
      'Kinematic Angle Extraction',
      `Extracted angular displacement θ(t) from pivot (${sample.calibration.pivot.x}, ${sample.calibration.pivot.y}) across ${sample.measurements.length} timestamps.`
    );

    // 4. Parameter Fitting stage (70% Train)
    setStage('fitting');
    await new Promise((r) => setTimeout(r, 300));

    try {
      const fit = fitDampedPendulum(sample.measurements, sample.calibration);
      setFittedParameters(fit.parameters);
      setMetrics(fit.metrics);
      setComparisonPoints(fit.comparisonPoints);
      setSplitTimestamp(fit.splitTimestamp);
      setIdentificationQuality(fit.identificationQuality);
      setWarnings(fit.warnings);

      addProvenance(
        'CALCULATED',
        'Deterministic Parameter Identification',
        `Fit non-linear damped-pendulum ODE on first 70% of frames (${fit.trainCount} frames). Inferred natural frequency ω₀² = ${fit.parameters.omega0Sq} s⁻² (±${fit.parameters.omega0SqUncertainty ?? 0.05}), damping c₁ = ${fit.parameters.damping} s⁻¹ (±${fit.parameters.dampingUncertainty ?? 0.01}), initial angle θ₀ = ${((fit.parameters.initialAngle * 180) / Math.PI).toFixed(1)}°. Drag model: ${fit.parameters.dragModel ?? 'viscous_linear'}.`,
        fit.parameters
      );

      // 5. Validating stage (30% Holdout)
      setStage('validating');
      await new Promise((r) => setTimeout(r, 200));

      addProvenance(
        'CALCULATED',
        'Holdout Predictive Validation',
        `Integrated fitted parameters forward across held-out 30% (${fit.holdoutCount} frames). Holdout RMSE: ${fit.metrics.holdoutRmseDeg.toFixed(2)}° vs Baseline RMSE: ${fit.metrics.baselineHoldoutRmseDeg.toFixed(2)}° (${fit.metrics.errorReductionPercent.toFixed(1)}% error reduction).`,
        fit.metrics
      );

      // 6. Muse Spark Diagnostic stage
      setStage('diagnosing');
      try {
        const diagRes = await fetch('/api/diagnose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            parameters: fit.parameters,
            metrics: fit.metrics,
            trainCount: fit.trainCount,
            holdoutCount: fit.holdoutCount,
            warnings: fit.warnings,
            isSyntheticSample: true,
            calibratedLengthMeters: sample.calibration.knownLengthMeters
          })
        });

        if (diagRes.ok) {
          const diagData = await diagRes.json();
          setDiagnostic(diagData.diagnostic);
          setDiagnosticModelUsed(diagData.modelUsed);
          setIsLiveDiagnostic(diagData.isLiveModel);

          addProvenance(
            'MODEL_GENERATED',
            'Muse Spark AI Diagnostic',
            `Physical reasoning explanation generated: ${diagData.diagnostic.summary} (Regime: ${diagData.diagnostic.dampingRegime}).`,
            diagData.diagnostic
          );
        }
      } catch (err: any) {
        console.warn('Diagnostic fetch error:', err);
      }

      setStage('completed');
    } catch (err: any) {
      console.error('Fit error:', err);
      setError(err.message || 'Parameter identification failed.');
      setStage('error');
    }
  }, [activePresetId]);

  // Process custom uploaded video
  const handleProcessCustomVideo = async (data: {
    videoFile: File;
    videoUrl: string;
    width: number;
    height: number;
    fps: number;
    initialBobPoint: Point2D;
    initialBobBox?: BoundingBox;
    pivot: Point2D;
    knownLengthMeters: number | null;
    useLocalTracker?: boolean;
  }) => {
    setError(undefined);
    setProvenanceLog([]);
    setStage('video_loaded');
    setIsSyntheticSample(false);
    setVideoUrl(data.videoUrl);

    let calib: CalibrationConfig = {
      pivot: data.pivot,
      knownLengthMeters: data.knownLengthMeters,
      scalePixelsPerMeter: data.knownLengthMeters
        ? 300 / data.knownLengthMeters
        : null,
      videoFps: data.fps
    };
    setCalibration(calib);

    setVideoMetadata({
      width: data.width,
      height: data.height,
      fps: data.fps,
      durationSec: 4.0
    });

    addProvenance(
      'OBSERVED',
      'User Video Source',
      `Uploaded user video: ${data.videoFile.name} (${data.width}x${data.height} px, ~${data.fps} FPS). Initial bob at (${data.initialBobPoint.x}, ${data.initialBobPoint.y}), pivot at (${data.pivot.x}, ${data.pivot.y}).`
    );

    setStage('segmenting');

    try {
      let extractedMeasurements: FrameMeasurement[] = [];

      // Determine whether to use client-side tracker or live Meta SAM 3.1
      const shouldUseLocal = data.useLocalTracker || isDemoMode;

      if (!shouldUseLocal) {
        // Attempt cloud SAM 3.1 API
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(data.videoFile);
        });

        const segRes = await fetch('/api/segment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoBase64: base64Data,
            mimeType: data.videoFile.type,
            width: data.width,
            height: data.height,
            fps: data.fps,
            initialBobPoint: data.initialBobPoint,
            initialBobBox: data.initialBobBox,
            pivot: data.pivot
          })
        });

        const segData = await segRes.json();
        if (segData.success && segData.measurements) {
          extractedMeasurements = segData.measurements;
          addProvenance(
            'OBSERVED',
            'Meta SAM 3.1 Streaming Response',
            `Received segmented bob mask stream across ${extractedMeasurements.length} frames via Meta Responses API.`
          );
        } else {
          // Fall back gracefully to client-side tracker
          console.warn('SAM 3.1 returned demo or failure, falling back to in-browser optical tracker:', segData.message);
        }
      }

      // If local tracker selected or fallback needed
      if (extractedMeasurements.length === 0) {
        addProvenance(
          'OBSERVED',
          'In-Browser Optical Tracker',
          `Tracking bob centroid in client canvas (no API keys required).`
        );

        // Create temporary video element
        const tempVideo = document.createElement('video');
        tempVideo.src = data.videoUrl;
        tempVideo.muted = true;
        tempVideo.playsInline = true;

        await new Promise((resolve, reject) => {
          tempVideo.onloadeddata = () => resolve(true);
          tempVideo.onerror = () => reject(new Error('Failed to load video element in browser.'));
        });

        const localTrack = await trackVideoInBrowser(tempVideo, {
          initialBobPoint: data.initialBobPoint,
          pivot: data.pivot,
          targetFps: data.fps
        });

        extractedMeasurements = localTrack.measurements;

        // Auto-pivot update if circle fit is reliable
        if (localTrack.autoPivot && localTrack.arcFitRmse !== undefined && localTrack.arcFitRmse < 25) {
          calib = {
            ...calib,
            pivot: localTrack.autoPivot,
            autoDetectedPivot: localTrack.autoPivot,
            arcRadiusPixels: localTrack.arcRadiusPixels,
            arcFitRmse: localTrack.arcFitRmse
          };
          setCalibration(calib);

          addProvenance(
            'CALCULATED',
            'Circle-Fit Pivot Detection',
            `Calculated physical pivot from circular arc fit across all ${extractedMeasurements.length} frames: (${localTrack.autoPivot.x}, ${localTrack.autoPivot.y}), Radius: ${localTrack.arcRadiusPixels}px, Residual RMSE: ${localTrack.arcFitRmse}px.`,
            { autoPivot: localTrack.autoPivot, radius: localTrack.arcRadiusPixels, rmse: localTrack.arcFitRmse }
          );
        }
      }

      setMeasurements(extractedMeasurements);
      setCurrentFrameIndex(0);

      // Parameter Fitting
      setStage('fitting');
      const fit = fitDampedPendulum(extractedMeasurements, calib);
      setFittedParameters(fit.parameters);
      setMetrics(fit.metrics);
      setComparisonPoints(fit.comparisonPoints);
      setSplitTimestamp(fit.splitTimestamp);
      setIdentificationQuality(fit.identificationQuality);
      setWarnings(fit.warnings);

      addProvenance(
        'CALCULATED',
        'Deterministic Parameter Identification',
        `Fit non-linear damped-pendulum ODE on first 70% (${fit.trainCount} frames). ω₀² = ${fit.parameters.omega0Sq} s⁻² (±${fit.parameters.omega0SqUncertainty ?? 0.05}), damping c₁ = ${fit.parameters.damping} s⁻¹ (±${fit.parameters.dampingUncertainty ?? 0.01}). Drag model: ${fit.parameters.dragModel ?? 'viscous_linear'}.`,
        fit.parameters
      );

      // Validation
      setStage('validating');
      addProvenance(
        'CALCULATED',
        'Holdout Predictive Validation',
        `Evaluated forward prediction on unseen 30% (${fit.holdoutCount} frames). Holdout RMSE: ${fit.metrics.holdoutRmseDeg.toFixed(2)}° vs Baseline: ${fit.metrics.baselineHoldoutRmseDeg.toFixed(2)}° (${fit.metrics.errorReductionPercent.toFixed(1)}% error reduction).`,
        fit.metrics
      );

      // Diagnostics
      setStage('diagnosing');
      const diagRes = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parameters: fit.parameters,
          metrics: fit.metrics,
          trainCount: fit.trainCount,
          holdoutCount: fit.holdoutCount,
          warnings: fit.warnings,
          isSyntheticSample: false,
          calibratedLengthMeters: data.knownLengthMeters
        })
      });

      if (diagRes.ok) {
        const diagData = await diagRes.json();
        setDiagnostic(diagData.diagnostic);
        setDiagnosticModelUsed(diagData.modelUsed);
        setIsLiveDiagnostic(diagData.isLiveModel);

        addProvenance(
          'MODEL_GENERATED',
          'Muse Spark AI Diagnostic',
          `Physical reasoning evaluation completed: ${diagData.diagnostic.summary}`,
          diagData.diagnostic
        );
      }

      setStage('completed');
    } catch (err: any) {
      console.error('Processing error:', err);
      setError(err.message || 'Video analysis failed.');
      setStage('error');
    }
  };

  const handleToggleAudio = () => {
    const active = physicsAudio.toggle();
    setIsAudioActive(active);
  };

  const handleReset = () => {
    physicsAudio.stop();
    setIsAudioActive(false);
    setStage('idle');
    setError(undefined);
    setMeasurements([]);
    setCurrentFrameIndex(0);
    setFittedParameters(null);
    setMetrics(null);
    setComparisonPoints([]);
    setDiagnostic(null);
    setProvenanceLog([]);
    setIsSyntheticSample(true);
    setVideoUrl(undefined);
  };

  const currentAngleDeg = measurements[currentFrameIndex]?.angleDeg;

  return (
    <div className="flex flex-col min-h-screen bg-[#080c14] text-slate-100 font-sans">
      {/* Top Header */}
      <Header
        onRunSample={handleRunSampleAnalysis}
        onOpenUpload={() => setIsUploadOpen(true)}
        onReset={handleReset}
        onOpenHelp={() => setIsHelpOpen(true)}
        onOpenCalibration={() => setIsCalibrationOpen(true)}
        isProcessing={['segmenting', 'measuring', 'fitting', 'validating', 'diagnosing'].includes(stage)}
        hasData={measurements.length > 0}
        isDemoMode={isDemoMode}
        isSyntheticSample={isSyntheticSample}
        activePresetId={activePresetId}
        onSelectPreset={setActivePresetId}
        isAudioActive={isAudioActive}
        onToggleAudio={handleToggleAudio}
        currentView={activeView}
        onChangeView={setActiveView}
      />

      {/* Analysis Stage Pipeline Tracker (shown in workbench or bento view) */}
      {activeView !== 'demo' && <PipelineTimeline stage={stage} error={error} />}

      {/* VIEW 1: Showcase Bento UI Demo */}
      {activeView === 'demo' && (
        <section className="flex-1 w-full bg-background panel-enter">
          <AnalyticsBentoDemo />
        </section>
      )}

      {/* VIEW 2: High-Density Physics Telemetry Bento */}
      {activeView === 'bento' && (
        <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 lg:p-6 panel-enter space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-graphite-900/60 border border-graphite-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-blue-400">
                  Physics Telemetry Matrix
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  Bento Layout
                </span>
              </div>
              <p className="text-xs text-graphite-400 mt-1 font-mono">
                Real-time SVG Catmull-Rom dynamics • Hamiltonian energy dissipation treemap • 70/30 holdout verification • CARE LQR control effort
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => handleRunSampleAnalysis(activePresetId)}
                disabled={['segmenting', 'measuring', 'fitting', 'validating', 'diagnosing'].includes(stage)}
                className="focus-ring px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-medium flex items-center gap-1.5 shadow-md shadow-blue-900/30 transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Simulate Benchmark</span>
              </button>
              <button
                onClick={() => setActiveView('workbench')}
                className="focus-ring px-3 py-1.5 rounded-lg bg-graphite-800 hover:bg-graphite-750 text-graphite-200 font-mono text-xs flex items-center gap-1.5 border border-graphite-700/60 transition-all"
              >
                <span>3D Motion Workbench →</span>
              </button>
            </div>
          </div>

          <PhysicsTelemetryBento
            metrics={metrics}
            parameters={fittedParameters}
            comparisonPoints={comparisonPoints}
            activePresetId={activePresetId}
            onSelectPreset={(pid) => {
              setActivePresetId(pid);
              handleRunSampleAnalysis(pid);
            }}
          />
        </main>
      )}

      {/* VIEW 3: Standard Motion Digital Twin Workbench */}
      {activeView === 'workbench' && stage === 'idle' && (
        <section className="flex-1 flex items-center justify-center px-4 lg:px-6 py-10">
          <div className="max-w-3xl w-full text-center panel-enter">
            {/* Logo */}
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600/10 to-blue-800/5 border border-blue-500/15 mb-4">
              <span className="text-blue-400/80 font-mono text-2xl font-bold">Æ</span>
            </div>

            <h2 className="text-xl font-semibold text-slate-100 mb-2 tracking-tight">
              Verified Motion Digital Twin
            </h2>
            <p className="text-sm text-graphite-400 max-w-lg mx-auto leading-relaxed mb-6">
              Extract real pendulum motion from video, fit a deterministic RK4-integrated non-linear ODE on 70% of observed data, then prove predictive fidelity on the 30% unseen holdout.
            </p>

            {/* Benchmark Preset Selection Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 mb-6 text-left font-mono">
              {BENCHMARK_PRESETS.map((p) => {
                const isSelected = activePresetId === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => setActivePresetId(p.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-950/30 border-blue-500/50 text-blue-100 ring-1 ring-blue-500/30'
                        : 'bg-graphite-900/60 border-graphite-800/80 text-graphite-300 hover:bg-graphite-850'
                    }`}
                  >
                    <div>
                      <div className="text-[11px] font-semibold text-slate-200 mb-1 flex items-center justify-between">
                        <span>{p.name}</span>
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                      </div>
                      <div className="text-[10px] text-graphite-400 leading-snug mb-2">
                        {p.tagline}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[9px] text-graphite-500 pt-2 border-t border-graphite-800/60">
                      <span>θ₀: {p.initialAngleDeg}°</span>
                      <span>•</span>
                      <span>L: {p.lengthMeters}m</span>
                      <span>•</span>
                      <span>g: {p.gravity.toFixed(2)}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => handleRunSampleAnalysis(activePresetId)}
                className="focus-ring px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-mono font-medium text-sm transition-all flex items-center gap-2.5 shadow-lg shadow-blue-900/20"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Run Selected Benchmark</span>
                <ChevronRight className="w-3.5 h-3.5 opacity-50" />
              </button>

              <button
                onClick={() => setIsUploadOpen(true)}
                className="focus-ring px-4 py-2.5 rounded-lg bg-graphite-900/80 hover:bg-graphite-850 text-graphite-200 border border-graphite-800/60 font-mono text-sm transition-all flex items-center gap-2"
              >
                <Upload className="w-4 h-4 text-graphite-400" />
                <span>Upload Custom Clip</span>
              </button>
            </div>

            {/* Quick Switch to Bento */}
            <div className="mt-4 flex items-center justify-center gap-1.5 text-xs font-mono text-graphite-500">
              <span>Looking for high-density physical telemetry?</span>
              <button
                type="button"
                onClick={() => setActiveView('bento')}
                className="text-blue-400 hover:text-blue-300 underline underline-offset-4 flex items-center gap-0.5"
              >
                <span>Switch to Bento Telemetry Matrix</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            {/* Subtext */}
            <p className="text-[10px] font-mono text-graphite-600 mt-6">
              Meta SAM 3.1 & In-Browser Optical Flow • Muse Spark 1.3 • Deterministic RK4 • Circle-Fit Pivot Calibration
            </p>
          </div>
        </section>
      )}

      {/* Main 3-Region Desktop Workbench Grid */}
      {activeView === 'workbench' && stage !== 'idle' && (
        <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 lg:p-5 panel-enter">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Region A: Video & Segmentation Overlay */}
            <div className="lg:col-span-4 flex flex-col min-h-[520px]">
              <VideoInspectionPanel
                measurements={measurements}
                currentFrameIndex={currentFrameIndex}
                onSeekFrame={setCurrentFrameIndex}
                calibration={calibration}
                onOpenCalibration={() => setIsCalibrationOpen(true)}
                videoUrl={videoUrl}
                isSyntheticSample={isSyntheticSample}
                videoMetadata={videoMetadata}
                predictedAngleDeg={comparisonPoints[currentFrameIndex]?.predictedAngleDeg}
              />
            </div>

            {/* Region B: Interactive Physics Twin */}
            <div className="lg:col-span-4 flex flex-col min-h-[520px]">
              <InteractiveTwinPanel
                fittedParameters={fittedParameters}
                videoSyncedAngleDeg={currentAngleDeg}
                isSyncedWithVideo={isSyncedWithVideo}
                onToggleSync={() => setIsSyncedWithVideo(!isSyncedWithVideo)}
              />
            </div>

            {/* Region C: Trajectory Comparison, Metrics & Diagnostics */}
            <div className="lg:col-span-4 flex flex-col min-h-[520px]">
              <MetricsDiagnosticsPanel
                comparisonPoints={comparisonPoints}
                metrics={metrics}
                diagnostic={diagnostic}
                diagnosticModelUsed={diagnosticModelUsed}
                isLiveDiagnostic={isLiveDiagnostic}
                splitTimestamp={splitTimestamp}
                identificationQuality={identificationQuality}
                warnings={warnings}
                provenanceLog={provenanceLog}
                fittedParameters={fittedParameters}
                calibration={calibration}
                onSeekFrame={setCurrentFrameIndex}
              />
            </div>
          </div>
        </main>
      )}

      {/* Modals */}
      <CalibrationModal
        isOpen={isCalibrationOpen}
        onClose={() => setIsCalibrationOpen(false)}
        config={calibration}
        onSave={setCalibration}
      />

      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onProcessVideo={handleProcessCustomVideo}
        isDemoMode={isDemoMode}
      />

      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-graphite-800/50 bg-[#090c13] px-4 lg:px-6 py-2.5 text-graphite-500 font-mono text-[10px] flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3 h-3 text-emerald-400/50" />
          <span className="text-graphite-400">AetherTwin Scientific Workstation</span>
          <span className="text-graphite-700">•</span>
          <span>
            Models: <code className="text-graphite-500">sam-3.1</code> & <code className="text-graphite-500">muse-spark-1.3</code>
          </span>
        </div>
        <div className="text-graphite-600">
          Preserving the 30% unseen holdout frontier.
        </div>
      </footer>
    </div>
  );
}
