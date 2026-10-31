'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  FrameMeasurement,
  CalibrationConfig,
  BoundingBox,
  Point2D
} from '@/lib/types';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Crosshair,
  Sliders,
  Eye,
  Video,
  Target,
  Maximize2,
  Ghost,
  Sparkles
} from 'lucide-react';
import { ProvenanceBadge } from './ProvenanceBadge';

interface VideoInspectionPanelProps {
  measurements: FrameMeasurement[];
  currentFrameIndex: number;
  onSeekFrame: (index: number) => void;
  calibration: CalibrationConfig;
  onOpenCalibration: () => void;
  videoUrl?: string;
  isSyntheticSample: boolean;
  videoMetadata?: {
    width: number;
    height: number;
    fps: number;
    durationSec: number;
  };
  predictedAngleDeg?: number;
}

export const VideoInspectionPanel: React.FC<VideoInspectionPanelProps> = ({
  measurements,
  currentFrameIndex,
  onSeekFrame,
  calibration,
  onOpenCalibration,
  videoUrl,
  isSyntheticSample,
  videoMetadata,
  predictedAngleDeg
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [showMask, setShowMask] = useState<boolean>(true);
  const [showTrail, setShowTrail] = useState<boolean>(true);
  const [showBoundingBox, setShowBoundingBox] = useState<boolean>(true);
  const [showGhostTwin, setShowGhostTwin] = useState<boolean>(true);

  const totalFrames = measurements.length;
  const currentMeasurement = measurements[currentFrameIndex] || measurements[0];
  const width = videoMetadata?.width || 640;
  const height = videoMetadata?.height || 480;
  const fps = videoMetadata?.fps || 30;

  // Animation frame loop when playing
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    const intervalMs = 1000 / fps;

    const playLoop = (time: number) => {
      if (!isPlaying) return;
      if (time - lastTime >= intervalMs) {
        lastTime = time;
        onSeekFrame((currentFrameIndex + 1) % Math.max(1, totalFrames));
      }
      animationFrameId = requestAnimationFrame(playLoop);
    };

    if (isPlaying) {
      animationFrameId = requestAnimationFrame(playLoop);
    }

    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, currentFrameIndex, totalFrames, onSeekFrame, fps]);

  // Render canvas overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // 1. Technical backdrop
    if (isSyntheticSample || !videoUrl) {
      // Dark graphite viewport
      ctx.fillStyle = '#0b0d13';
      ctx.fillRect(0, 0, width, height);

      // Fine metrology grid (40px)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Corner reticle brackets
      const bracketLen = 14;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1;

      // Top-Left
      ctx.beginPath();
      ctx.moveTo(10, 10 + bracketLen);
      ctx.lineTo(10, 10);
      ctx.lineTo(10 + bracketLen, 10);
      ctx.stroke();

      // Top-Right
      ctx.beginPath();
      ctx.moveTo(width - 10 - bracketLen, 10);
      ctx.lineTo(width - 10, 10);
      ctx.lineTo(width - 10, 10 + bracketLen);
      ctx.stroke();

      // Bottom-Left
      ctx.beginPath();
      ctx.moveTo(10, height - 10 - bracketLen);
      ctx.lineTo(10, height - 10);
      ctx.lineTo(10 + bracketLen, height - 10);
      ctx.stroke();

      // Bottom-Right
      ctx.beginPath();
      ctx.moveTo(width - 10 - bracketLen, height - 10);
      ctx.lineTo(width - 10, height - 10);
      ctx.lineTo(width - 10, height - 10 - bracketLen);
      ctx.stroke();

      // Rigid ceiling mount fixture
      const pivX = calibration.pivot.x;
      const pivY = calibration.pivot.y;
      ctx.fillStyle = '#181b24';
      ctx.fillRect(pivX - 28, pivY - 10, 56, 10);
      ctx.strokeStyle = '#2d3345';
      ctx.lineWidth = 1;
      ctx.strokeRect(pivX - 28, pivY - 10, 56, 10);
    }

    // Standby view if no measurements
    if (!currentMeasurement) {
      const piv = calibration.pivot;
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(piv.x - 20, piv.y);
      ctx.lineTo(piv.x + 20, piv.y);
      ctx.moveTo(piv.x, piv.y - 20);
      ctx.lineTo(piv.x, piv.y + 20);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('OPTICAL TRACKING STANDBY', width / 2, height / 2);
      ctx.fillStyle = '#475569';
      ctx.font = '10px monospace';
      ctx.fillText('Reference pivot registered at (' + piv.x + ', ' + piv.y + ' px)', width / 2, height / 2 + 18);
      return;
    }

    const pivot = currentMeasurement.pivot || calibration.pivot;
    const bob = currentMeasurement.bobCentroid;
    const armLenPx = calibration.arcRadiusPixels || Math.hypot(bob.x - pivot.x, bob.y - pivot.y) || 250;

    // 2. Historical kinematic motion trail
    if (showTrail && measurements.length > 0) {
      const trailWindow = 28;
      const startIdx = Math.max(0, currentFrameIndex - trailWindow);

      ctx.beginPath();
      for (let i = startIdx; i <= currentFrameIndex; i++) {
        const pt = measurements[i].bobCentroid;
        if (i === startIdx) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let i = startIdx; i <= currentFrameIndex; i++) {
        const pt = measurements[i].bobCentroid;
        const alpha = (i - startIdx) / trailWindow;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 2, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(16, 185, 129, ${0.1 + 0.5 * alpha})`;
        ctx.fill();
      }
    }

    // 3. Physical rod (Observed)
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(bob.x, bob.y);
    ctx.strokeStyle = isSyntheticSample ? '#64748b' : 'rgba(59, 130, 246, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 4. Vertical plumb line from pivot (reference zero)
    ctx.beginPath();
    ctx.moveTo(pivot.x, pivot.y);
    ctx.lineTo(pivot.x, pivot.y + 190);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. Angular arc
    const arcRadius = 45;
    const startAngle = Math.PI / 2;
    const endAngle = Math.PI / 2 - currentMeasurement.angleRad;
    ctx.beginPath();
    ctx.arc(
      pivot.x,
      pivot.y,
      arcRadius,
      Math.min(startAngle, endAngle),
      Math.max(startAngle, endAngle)
    );
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 6. SAM 3.1 segmentation mask
    if (showMask && currentMeasurement.maskSvgPath) {
      ctx.save();
      const path2D = new Path2D(currentMeasurement.maskSvgPath);
      ctx.fillStyle = 'rgba(139, 92, 246, 0.25)';
      ctx.strokeStyle = 'rgba(139, 92, 246, 0.7)';
      ctx.lineWidth = 1.5;
      ctx.fill(path2D);
      ctx.stroke(path2D);
      ctx.restore();
    }

    // 7. Bob bounding box
    if (showBoundingBox && currentMeasurement.bobBox) {
      const box = currentMeasurement.bobBox;
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 1;
      ctx.strokeRect(box.x, box.y, box.width, box.height);

      ctx.fillStyle = 'rgba(11, 13, 19, 0.9)';
      ctx.fillRect(box.x, box.y - 15, 84, 14);
      ctx.strokeStyle = '#10b981';
      ctx.strokeRect(box.x, box.y - 15, 84, 14);
      ctx.fillStyle = '#10b981';
      ctx.font = '9px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(
        `BOB [${(currentMeasurement.confidence || 0.98).toFixed(2)}]`,
        box.x + 4,
        box.y - 4
      );
    }

    // 8. Bob Centroid (Observed)
    if (isSyntheticSample) {
      const grad = ctx.createRadialGradient(
        bob.x - 4,
        bob.y - 4,
        2,
        bob.x,
        bob.y,
        16
      );
      grad.addColorStop(0, '#f8fafc');
      grad.addColorStop(0.3, '#94a3b8');
      grad.addColorStop(0.8, '#334155');
      grad.addColorStop(1, '#0f172a');

      ctx.beginPath();
      ctx.arc(bob.x, bob.y, 16, 0, 2 * Math.PI);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(bob.x, bob.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = '#10b981';
      ctx.fill();
    }

    // 9. "GHOST TWIN" SPATIAL VIDEO OVERLAY (Simulated vs Real)
    if (showGhostTwin && predictedAngleDeg !== undefined) {
      const ghostRad = (predictedAngleDeg * Math.PI) / 180;
      const ghostX = pivot.x + armLenPx * Math.sin(ghostRad);
      const ghostY = pivot.y + armLenPx * Math.cos(ghostRad);

      // Ghost rod (dashed cyan)
      ctx.beginPath();
      ctx.moveTo(pivot.x, pivot.y);
      ctx.lineTo(ghostX, ghostY);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.75)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Ghost bob (glowing cyan outline & core)
      ctx.beginPath();
      ctx.arc(ghostX, ghostY, 14, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
      ctx.fill();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Ghost center pip
      ctx.beginPath();
      ctx.arc(ghostX, ghostY, 3, 0, 2 * Math.PI);
      ctx.fillStyle = '#22d3ee';
      ctx.fill();

      // Spatial residual line connecting observed bob to ghost twin
      const dxSpatial = ghostX - bob.x;
      const dySpatial = ghostY - bob.y;
      const distPx = Math.hypot(dxSpatial, dySpatial);

      if (distPx > 2.0) {
        ctx.beginPath();
        ctx.moveTo(bob.x, bob.y);
        ctx.lineTo(ghostX, ghostY);
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.7)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label spatial difference
        ctx.fillStyle = '#fb7185';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(
          `Δr: ${distPx.toFixed(1)}px`,
          (bob.x + ghostX) / 2,
          (bob.y + ghostY) / 2 - 4
        );
      }

      // Ghost twin tag
      ctx.fillStyle = 'rgba(8, 51, 68, 0.9)';
      ctx.fillRect(ghostX - 28, ghostY + 16, 56, 13);
      ctx.strokeStyle = '#06b6d4';
      ctx.strokeRect(ghostX - 28, ghostY + 16, 56, 13);
      ctx.fillStyle = '#22d3ee';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('TWIN [RK4]', ghostX, ghostY + 25);
    }

    // 10. Pivot bearing
    ctx.beginPath();
    ctx.arc(pivot.x, pivot.y, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pivot crosshair
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pivot.x - 10, pivot.y);
    ctx.lineTo(pivot.x + 10, pivot.y);
    ctx.moveTo(pivot.x, pivot.y - 10);
    ctx.lineTo(pivot.x, pivot.y + 10);
    ctx.stroke();
  }, [
    currentMeasurement,
    calibration.pivot,
    calibration.arcRadiusPixels,
    currentFrameIndex,
    isSyntheticSample,
    measurements,
    showBoundingBox,
    showMask,
    showTrail,
    showGhostTwin,
    predictedAngleDeg,
    width,
    height,
    videoUrl
  ]);

  return (
    <div className="flex flex-col h-full bg-graphite-900 border border-graphite-800/60 rounded-xl overflow-hidden shadow-sm">
      {/* Panel Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#0c0e15] border-b border-graphite-800/60">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-slate-100 tracking-tight">
            Optical Segmentation
          </span>
          <ProvenanceBadge kind="OBSERVED" text="RAW EVIDENCE" />
        </div>

        {/* Toolbar & Layer Toggles */}
        <div className="flex items-center gap-1.5">
          {/* Layer Visibility Toggles */}
          <div className="flex items-center p-0.5 rounded-lg bg-graphite-950/80 border border-graphite-800/80">
            <button
              onClick={() => setShowGhostTwin(!showGhostTwin)}
              className={`p-1 rounded-md transition text-xs flex items-center gap-1 ${
                showGhostTwin
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-graphite-500 hover:text-graphite-300'
              }`}
              title="Toggle Ghost RK4 Digital Twin overlay"
            >
              <Ghost className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline font-mono">Ghost</span>
            </button>
            <button
              onClick={() => setShowMask(!showMask)}
              className={`p-1 rounded-md transition text-xs flex items-center gap-1 ${
                showMask
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                  : 'text-graphite-500 hover:text-graphite-300'
              }`}
              title="Toggle SAM 3.1 Segmentation Mask"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline font-mono">Mask</span>
            </button>
            <button
              onClick={() => setShowBoundingBox(!showBoundingBox)}
              className={`p-1 rounded-md transition text-xs flex items-center gap-1 ${
                showBoundingBox
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-graphite-500 hover:text-graphite-300'
              }`}
              title="Toggle Bounding Box"
            >
              <Target className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline font-mono">Box</span>
            </button>
            <button
              onClick={() => setShowTrail(!showTrail)}
              className={`p-1 rounded-md transition text-xs flex items-center gap-1 ${
                showTrail
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  : 'text-graphite-500 hover:text-graphite-300'
              }`}
              title="Toggle Motion Trail"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="text-[10px] hidden sm:inline font-mono">Trail</span>
            </button>
          </div>

          <button
            onClick={onOpenCalibration}
            className="px-2 py-1 rounded-lg bg-graphite-850 hover:bg-graphite-800 text-graphite-300 hover:text-slate-100 border border-graphite-750 text-xs font-mono transition flex items-center gap-1.5"
            title="Configure pivot coordinate and physical scale"
          >
            <Crosshair className="w-3 h-3 text-blue-400" />
            <span>
              {calibration.knownLengthMeters
                ? `L: ${calibration.knownLengthMeters.toFixed(2)}m`
                : 'Scale: Rel'}
            </span>
          </button>
        </div>
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 min-h-[300px] flex items-center justify-center bg-[#070910] p-2 overflow-hidden select-none">
        {videoUrl && !isSyntheticSample && (
          <video
            ref={videoRef}
            src={videoUrl}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            muted
            playsInline
          />
        )}

        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="max-h-full max-w-full aspect-[4/3] object-contain rounded-lg border border-graphite-800/80"
        />
      </div>

      {/* Frame Telemetry Status Ribbon */}
      {currentMeasurement && (
        <div className="px-3.5 py-1.5 bg-[#0b0e15] border-t border-graphite-800/60 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-3">
            <span className="text-graphite-400">
              t:{' '}
              <span className="text-blue-300 font-semibold tabular-nums">
                {currentMeasurement.timestamp.toFixed(3)}s
              </span>
            </span>
            <span className="text-graphite-400">
              θ_obs:{' '}
              <span className="text-emerald-400 font-semibold tabular-nums">
                {currentMeasurement.angleDeg.toFixed(2)}°
              </span>
            </span>
            {predictedAngleDeg !== undefined && (
              <span className="text-graphite-400">
                θ_twin:{' '}
                <span className="text-cyan-400 font-semibold tabular-nums">
                  {predictedAngleDeg.toFixed(2)}°
                </span>
              </span>
            )}
            {predictedAngleDeg !== undefined && (
              <span className="text-graphite-400 hidden sm:inline">
                Δ:{' '}
                <span className="text-amber-300 font-medium tabular-nums">
                  {Math.abs(currentMeasurement.angleDeg - predictedAngleDeg).toFixed(2)}°
                </span>
              </span>
            )}
          </div>
          <div className="text-graphite-500 text-[11px] tabular-nums hidden sm:block">
            Centroid: ({Math.round(currentMeasurement.bobCentroid.x)},{' '}
            {Math.round(currentMeasurement.bobCentroid.y)}) px
          </div>
        </div>
      )}

      {/* Scrubbing & Transport Control Strip */}
      <div className="px-3.5 py-2 bg-[#0c0e15] border-t border-graphite-800/60 flex flex-col gap-2 select-none">
        <div className="flex items-center justify-between text-xs text-graphite-400">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition cursor-pointer shadow-sm shadow-blue-900/30"
              title={isPlaying ? 'Pause playback' : 'Play trajectory'}
            >
              {isPlaying ? (
                <Pause className="w-3.5 h-3.5 fill-current" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
            </button>
            <button
              onClick={() => onSeekFrame(Math.max(0, currentFrameIndex - 1))}
              className="p-1.5 rounded-lg bg-graphite-800 hover:bg-graphite-750 text-graphite-300 transition"
              title="Step backward 1 frame"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() =>
                onSeekFrame(Math.min(totalFrames - 1, currentFrameIndex + 1))
              }
              className="p-1.5 rounded-lg bg-graphite-800 hover:bg-graphite-750 text-graphite-300 transition"
              title="Step forward 1 frame"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>

            <span className="text-slate-300 text-xs ml-2 font-mono tabular-nums">
              Frame{' '}
              <strong className="text-slate-100 font-semibold">
                {String(currentFrameIndex + 1).padStart(3, '0')}
              </strong>{' '}
              / {String(Math.max(1, totalFrames)).padStart(3, '0')}
            </span>
          </div>

          <div className="text-graphite-400 text-xs font-mono tabular-nums">
            {fps} FPS • {((totalFrames / fps) || 0).toFixed(2)}s
          </div>
        </div>

        {/* Timeline Range Slider */}
        <div className="relative w-full flex items-center">
          <input
            type="range"
            min={0}
            max={Math.max(0, totalFrames - 1)}
            value={currentFrameIndex}
            onChange={(e) => {
              setIsPlaying(false);
              onSeekFrame(Number(e.target.value));
            }}
            className="w-full h-1.5 bg-graphite-800 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
};
