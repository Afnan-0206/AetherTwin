'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PendulumParameters, SimulationState } from '@/lib/types';
import { rk4Step } from '@/lib/physics/rk4';
import { calculateEnergy, radToDeg, degToRad } from '@/lib/physics/dampedPendulum';
import {
  RotateCcw,
  Sliders,
  Activity,
  RefreshCw,
  Globe,
  Gauge
} from 'lucide-react';
import { ProvenanceBadge } from './ProvenanceBadge';

interface InteractiveTwinPanelProps {
  fittedParameters: PendulumParameters | null;
  videoSyncedAngleDeg?: number;
  isSyncedWithVideo: boolean;
  onToggleSync: () => void;
}

export const InteractiveTwinPanel: React.FC<InteractiveTwinPanelProps> = ({
  fittedParameters,
  videoSyncedAngleDeg,
  isSyncedWithVideo,
  onToggleSync
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Counterfactual parameter state
  const defaultGravity = fittedParameters?.gravity ?? 9.81;
  const defaultLength = fittedParameters?.length ?? 0.50;
  const defaultDamping = fittedParameters?.damping ?? 0.15;
  const defaultTheta0 = fittedParameters ? radToDeg(fittedParameters.initialAngle) : 31.5;

  const [gravity, setGravity] = useState<number>(defaultGravity);
  const [lengthMeters, setLengthMeters] = useState<number>(defaultLength);
  const [damping, setDamping] = useState<number>(defaultDamping);
  const [initialAngleDeg, setInitialAngleDeg] = useState<number>(defaultTheta0);

  // Live simulation state for free-running twin
  const [simState, setSimState] = useState<{
    theta: number;
    omega: number;
    alpha: number;
    kinetic: number;
    potential: number;
    total: number;
  }>({
    theta: degToRad(defaultTheta0),
    omega: 0.0,
    alpha: 0.0,
    kinetic: 0.0,
    potential: 0.0,
    total: 0.0
  });

  const [isSimRunning, setIsSimRunning] = useState<boolean>(!isSyncedWithVideo);

  // Reset to fitted parameters
  const handleResetToFitted = useCallback(() => {
    if (!fittedParameters) return;
    const g = fittedParameters.gravity ?? 9.81;
    const L = fittedParameters.length ?? 0.50;
    const c = fittedParameters.damping;
    const th0 = radToDeg(fittedParameters.initialAngle);

    setGravity(g);
    setLengthMeters(L);
    setDamping(c);
    setInitialAngleDeg(th0);

    setSimState({
      theta: degToRad(th0),
      omega: fittedParameters.initialVelocity,
      alpha: 0,
      kinetic: 0,
      potential: 0,
      total: 0
    });
  }, [fittedParameters]);

  // Sync state if fitted parameters change
  useEffect(() => {
    if (fittedParameters) {
      handleResetToFitted();
    }
  }, [fittedParameters, handleResetToFitted]);

  // Presets
  const applyPreset = (preset: 'fitted' | 'moon' | 'jupiter' | 'viscous') => {
    if (preset === 'fitted') {
      handleResetToFitted();
    } else if (preset === 'moon') {
      setGravity(1.62);
      setDamping(0.0);
      setSimState((prev) => ({ ...prev, omega: 0 }));
    } else if (preset === 'jupiter') {
      setGravity(24.79);
      setDamping(0.35);
      setSimState((prev) => ({ ...prev, omega: 0 }));
    } else if (preset === 'viscous') {
      setDamping(1.2);
      setSimState((prev) => ({ ...prev, omega: 0 }));
    }
  };

  // Real-time animation loop for free-running simulation
  useEffect(() => {
    if (isSyncedWithVideo || !isSimRunning) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const elapsedSec = Math.min(0.05, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      setSimState((current) => {
        const omega0Sq = gravity / Math.max(0.05, lengthMeters);
        const params = {
          omega0Sq,
          damping,
          length: lengthMeters,
          gravity
        };

        // Fine sub-stepping for smooth, stable RK4
        const substepDt = 0.002;
        const numSubsteps = Math.max(1, Math.ceil(elapsedSec / substepDt));
        const dt = elapsedSec / numSubsteps;

        let th = current.theta;
        let om = current.omega;

        for (let i = 0; i < numSubsteps; i++) {
          const next = rk4Step(th, om, dt, params);
          th = next.theta;
          om = next.omega;
        }

        const alpha = -omega0Sq * Math.sin(th) - damping * om;
        const energy = calculateEnergy(th, om, {
          omega0Sq,
          damping,
          initialAngle: 0,
          initialVelocity: 0,
          length: lengthMeters,
          gravity
        });

        return {
          theta: th,
          omega: om,
          alpha,
          kinetic: energy.kinetic,
          potential: energy.potential,
          total: energy.total
        };
      });

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isSyncedWithVideo, isSimRunning, gravity, lengthMeters, damping]);

  // Determine current display angle
  const activeTheta = isSyncedWithVideo
    ? degToRad(videoSyncedAngleDeg ?? defaultTheta0)
    : simState.theta;

  // Render 2D Twin Canvas with Protractor Graduations
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Dark backdrop
    ctx.fillStyle = '#07090e';
    ctx.fillRect(0, 0, width, height);

    const pivotX = width / 2;
    const pivotY = 48;
    // Scale visual arm length based on lengthMeters (0.2m -> 110px, 2.0m -> 210px)
    const armPx = Math.max(110, Math.min(220, 130 + lengthMeters * 50));

    const bobX = pivotX + armPx * Math.sin(activeTheta);
    const bobY = pivotY + armPx * Math.cos(activeTheta);

    // 1. Draw protractor graduation marks along swing arc
    const protractorR = armPx + 15;
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, protractorR, Math.PI * 0.25, Math.PI * 0.75);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Graduation ticks
    const graduations = [-60, -45, -30, -15, 0, 15, 30, 45, 60];
    graduations.forEach((deg) => {
      const rad = Math.PI / 2 - degToRad(deg);
      const isMajor = deg % 30 === 0;
      const rInner = protractorR - (isMajor ? 8 : 4);
      const rOuter = protractorR + 2;

      const x1 = pivotX + rInner * Math.cos(rad);
      const y1 = pivotY + rInner * Math.sin(rad);
      const x2 = pivotX + rOuter * Math.cos(rad);
      const y2 = pivotY + rOuter * Math.sin(rad);

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = isMajor ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.2)';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (isMajor) {
        const xText = pivotX + (protractorR + 14) * Math.cos(rad);
        const yText = pivotY + (protractorR + 14) * Math.sin(rad);
        ctx.fillStyle = '#64748b';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${deg > 0 ? '+' : ''}${deg}°`, xText, yText);
      }
    });

    // 2. Vertical zero plumb line
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(pivotX, pivotY + armPx + 25);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Current displacement arc
    const arcR = 38;
    const startAngle = Math.PI / 2;
    const endAngle = Math.PI / 2 - activeTheta;
    ctx.beginPath();
    ctx.arc(
      pivotX,
      pivotY,
      arcR,
      Math.min(startAngle, endAngle),
      Math.max(startAngle, endAngle)
    );
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 4. Digital Twin Rod
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Thin inner core highlight
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 5. Digital Twin Bob
    const bobRadius = 16;
    const grad = ctx.createRadialGradient(
      bobX - 4,
      bobY - 4,
      2,
      bobX,
      bobY,
      bobRadius
    );
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(0.25, '#93c5fd');
    grad.addColorStop(0.7, '#2563eb');
    grad.addColorStop(1, '#1e3a8a');

    ctx.beginPath();
    ctx.arc(bobX, bobY, bobRadius, 0, 2 * Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 6. Pivot Mount & Bearing
    ctx.fillStyle = '#1e2433';
    ctx.fillRect(pivotX - 22, pivotY - 10, 44, 10);
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1;
    ctx.strokeRect(pivotX - 22, pivotY - 10, 44, 10);

    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }, [activeTheta, lengthMeters]);

  // Total energy max estimate for gauge
  const maxEnergy = Math.max(
    0.05,
    simState.total > 0 ? simState.total * 1.2 : 4.0
  );
  const potentialPercent = Math.min(100, Math.max(0, (simState.potential / maxEnergy) * 100));
  const kineticPercent = Math.min(100, Math.max(0, (simState.kinetic / maxEnergy) * 100));

  return (
    <div className="flex flex-col h-full bg-graphite-900 border border-graphite-800/60 rounded-lg overflow-hidden">
      {/* Titlebar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#0f1219] border-b border-graphite-800/60">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-mono text-xs font-semibold text-graphite-100 tracking-tight">
            NUMERICAL SIMULATOR
          </span>
          <ProvenanceBadge kind="CALCULATED" text="RK4 SOLVER" />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggleSync}
            className={`px-2 py-0.5 rounded text-[11px] font-mono transition flex items-center gap-1.5 border ${
              isSyncedWithVideo
                ? 'bg-blue-500/10 text-blue-300 border-blue-500/30'
                : 'bg-graphite-800 text-graphite-300 border-graphite-700'
            }`}
            title="Toggle between real-time video sync and free counterfactual simulation"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncedWithVideo ? 'text-blue-400' : 'text-graphite-400'}`} />
            <span>{isSyncedWithVideo ? 'VIDEO SYNCED' : 'FREE RUNTIME'}</span>
          </button>
        </div>
      </div>

      {/* 2D Twin Visualization Viewport */}
      <div className="relative flex-1 min-h-[220px] flex items-center justify-center bg-[#070910] p-2 overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          width={400}
          height={290}
          className="max-h-full max-w-full aspect-[4/3] object-contain rounded border border-graphite-800/80"
        />

        {/* 4-Cell Digital Telemetry Grid (Top-Left) */}
        <div className="absolute top-3 left-3 p-2 rounded bg-graphite-950/90 backdrop-blur-sm border border-graphite-800 font-mono text-[10px] space-y-1 pointer-events-none">
          <div className="flex items-center justify-between gap-3 text-graphite-400">
            <span>ANGLE θ</span>
            <span className="text-blue-300 font-semibold tabular-nums">
              {radToDeg(activeTheta).toFixed(2)}° ({activeTheta.toFixed(3)} rad)
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-graphite-400">
            <span>VELOCITY ω</span>
            <span className="text-graphite-200 tabular-nums">
              {simState.omega.toFixed(2)} rad/s
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-graphite-400">
            <span>ACCEL α</span>
            <span className="text-graphite-300 tabular-nums">
              {simState.alpha.toFixed(2)} rad/s²
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 text-graphite-400">
            <span>TOTAL ENERGY</span>
            <span className="text-emerald-400 font-semibold tabular-nums">
              {simState.total.toFixed(3)} J
            </span>
          </div>
        </div>

        {/* Energy breakdown gauge (Bottom) */}
        <div className="absolute bottom-3 left-3 right-3 p-2 rounded bg-graphite-950/90 backdrop-blur-sm border border-graphite-800 font-mono text-[10px] space-y-1">
          <div className="flex justify-between text-graphite-400">
            <span className="tracking-wider text-[9px] uppercase">MECHANICAL ENERGY SPECTRUM</span>
            <span className="text-graphite-300 tabular-nums">
              E: {simState.total.toFixed(3)} J
            </span>
          </div>
          <div className="w-full h-1.5 rounded bg-graphite-850 overflow-hidden flex">
            <div
              style={{ width: `${potentialPercent}%` }}
              className="bg-emerald-500 transition-all duration-75"
              title={`Potential: ${simState.potential.toFixed(3)} J`}
            />
            <div
              style={{ width: `${kineticPercent}%` }}
              className="bg-blue-500 transition-all duration-75"
              title={`Kinetic: ${simState.kinetic.toFixed(3)} J`}
            />
          </div>
          <div className="flex justify-between text-[9px]">
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Potential V: {simState.potential.toFixed(3)} J
            </span>
            <span className="text-blue-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              Kinetic T: {simState.kinetic.toFixed(3)} J
            </span>
          </div>
        </div>
      </div>

      {/* Counterfactual Parameter Controls Section */}
      <div className="p-3.5 bg-[#0f1219] border-t border-graphite-800/60 flex flex-col gap-2.5 font-mono text-xs select-none">
        <div className="flex items-center justify-between">
          <span className="text-graphite-200 font-semibold flex items-center gap-1.5 text-[11px]">
            <Sliders className="w-3 h-3 text-blue-400" />
            COUNTERFACTUAL CONTROLS
          </span>
          <button
            onClick={handleResetToFitted}
            className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
            title="Reset parameters to empirical fitted values"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to Fitted</span>
          </button>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-1 text-[10px]">
          <button
            onClick={() => applyPreset('fitted')}
            className="px-2 py-0.5 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 border border-graphite-700/80 transition"
          >
            Fitted Twin
          </button>
          <button
            onClick={() => applyPreset('moon')}
            className="px-2 py-0.5 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 border border-graphite-700/80 transition flex items-center gap-1"
          >
            <Globe className="w-2.5 h-2.5 text-blue-300" />
            Moon (1.62 m/s²)
          </button>
          <button
            onClick={() => applyPreset('jupiter')}
            className="px-2 py-0.5 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 border border-graphite-700/80 transition"
          >
            Jupiter (24.8 m/s²)
          </button>
          <button
            onClick={() => applyPreset('viscous')}
            className="px-2 py-0.5 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 border border-graphite-700/80 transition"
          >
            Viscous (c=1.20)
          </button>
        </div>

        {/* Parameter Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
          {/* Gravity */}
          <div>
            <div className="flex justify-between text-graphite-400 text-[11px] mb-1">
              <span>Gravity g</span>
              <span className="text-blue-300 font-semibold tabular-nums">{gravity.toFixed(2)} m/s²</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={30.0}
              step={0.1}
              value={gravity}
              onChange={(e) => setGravity(Number(e.target.value))}
              className="w-full h-1 bg-graphite-800 rounded appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Damping */}
          <div>
            <div className="flex justify-between text-graphite-400 text-[11px] mb-1">
              <span>Damping c</span>
              <span className="text-blue-300 font-semibold tabular-nums">{damping.toFixed(3)} s⁻¹</span>
            </div>
            <input
              type="range"
              min={0.0}
              max={1.5}
              step={0.01}
              value={damping}
              onChange={(e) => setDamping(Number(e.target.value))}
              className="w-full h-1 bg-graphite-800 rounded appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Rod Length */}
          <div>
            <div className="flex justify-between text-graphite-400 text-[11px] mb-1">
              <span>Length L</span>
              <span className="text-blue-300 font-semibold tabular-nums">{lengthMeters.toFixed(2)} m</span>
            </div>
            <input
              type="range"
              min={0.15}
              max={2.0}
              step={0.05}
              value={lengthMeters}
              onChange={(e) => setLengthMeters(Number(e.target.value))}
              className="w-full h-1 bg-graphite-800 rounded appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          {/* Release Angle */}
          <div>
            <div className="flex justify-between text-graphite-400 text-[11px] mb-1">
              <span>Angle θ₀</span>
              <span className="text-blue-300 font-semibold tabular-nums">{initialAngleDeg.toFixed(1)}°</span>
            </div>
            <input
              type="range"
              min={-80}
              max={80}
              step={1}
              value={initialAngleDeg}
              onChange={(e) => {
                const deg = Number(e.target.value);
                setInitialAngleDeg(deg);
                setSimState((prev) => ({
                  ...prev,
                  theta: degToRad(deg),
                  omega: 0
                }));
              }}
              className="w-full h-1 bg-graphite-800 rounded appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
