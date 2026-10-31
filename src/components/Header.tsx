'use client';

import React from 'react';
import { Play, Upload, RotateCcw, HelpCircle, Ruler, Activity, Layers, Volume2, VolumeX, LayoutDashboard, Grid3X3 } from 'lucide-react';
import { BenchmarkPresetId } from '@/lib/types';
import { BENCHMARK_PRESETS } from '@/lib/sample/syntheticPendulum';

export type AppViewMode = 'workbench' | 'bento' | 'demo';

interface HeaderProps {
  onRunSample: (presetId?: BenchmarkPresetId) => void;
  onOpenUpload: () => void;
  onReset: () => void;
  onOpenHelp: () => void;
  onOpenCalibration?: () => void;
  isProcessing: boolean;
  hasData: boolean;
  isDemoMode: boolean;
  isSyntheticSample: boolean;
  activePresetId?: BenchmarkPresetId;
  onSelectPreset?: (presetId: BenchmarkPresetId) => void;
  isAudioActive?: boolean;
  onToggleAudio?: () => void;
  currentView?: AppViewMode;
  onChangeView?: (view: AppViewMode) => void;
}

export const Header: React.FC<HeaderProps> = ({
  onRunSample,
  onOpenUpload,
  onReset,
  onOpenHelp,
  onOpenCalibration,
  isProcessing,
  hasData,
  isDemoMode,
  isSyntheticSample,
  activePresetId = 'standard',
  onSelectPreset,
  isAudioActive = false,
  onToggleAudio,
  currentView = 'workbench',
  onChangeView
}) => {
  return (
    <header className="border-b border-graphite-800/80 bg-[#0a0d14] sticky top-0 z-40 select-none">
      <div className="max-w-[1720px] mx-auto px-4 lg:px-6 h-12 flex items-center justify-between gap-3">
        {/* Left: Branding & Mode */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            {/* Logo mark */}
            <div className="relative w-7 h-7 rounded bg-gradient-to-br from-blue-600/20 to-blue-800/10 border border-blue-500/20 flex items-center justify-center">
              <span className="text-blue-400 font-mono text-sm font-bold leading-none">Æ</span>
              <div className="absolute -bottom-px -right-px w-1.5 h-1.5 rounded-full bg-blue-400/60" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px] font-semibold tracking-wide text-slate-100">
                  AetherTwin
                </span>
                <span className="text-[10px] font-mono px-1.5 py-px rounded bg-graphite-800/80 text-graphite-400 border border-graphite-750/60">
                  v2.0
                </span>
                <span className="hidden sm:inline-block text-[10px] font-mono text-graphite-500 tracking-tight">
                  / Verified Motion Twin
                </span>
              </div>
              <span className="text-[10px] font-mono text-graphite-500 tracking-tight leading-none mt-0.5 hidden md:block">
                Deterministic RK4 Solver • Strict 70/30 Holdout
              </span>
            </div>
          </div>

          {/* Mode Indicator */}
          <div className="hidden sm:flex items-center ml-2 pl-3 border-l border-graphite-800/60">
            {isDemoMode ? (
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/5 border border-amber-500/15 text-amber-300/80 text-[10px] font-mono"
                title="Running with local deterministic reference physics (no API key)"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/70 animate-heartbeat" />
                <span>DEMO</span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded bg-blue-500/5 border border-blue-500/15 text-blue-300/80 text-[10px] font-mono"
                title="Connected to Meta Model API"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-heartbeat" />
                <span>LIVE API</span>
              </div>
            )}
          </div>
        </div>

        {/* Center: View Switcher (Workbench / Telemetry Bento / UI Demo) */}
        {onChangeView && (
          <div className="flex items-center p-0.5 rounded-lg bg-graphite-900/90 border border-graphite-800/80 text-[11px] font-mono shadow-inner">
            <button
              type="button"
              onClick={() => onChangeView('workbench')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                currentView === 'workbench'
                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                  : 'text-graphite-400 hover:text-slate-200 hover:bg-graphite-850/50'
              }`}
              title="Standard 3-region mechanical inspection & simulation workbench"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Workbench</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeView('bento')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                currentView === 'bento'
                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                  : 'text-graphite-400 hover:text-slate-200 hover:bg-graphite-850/50'
              }`}
              title="Modern Bento Telemetry dashboard with LQR control, holdout respiration & energy treemap"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Bento Telemetry</span>
              {hasData && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onChangeView('demo')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                currentView === 'demo'
                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                  : 'text-graphite-400 hover:text-slate-200 hover:bg-graphite-850/50'
              }`}
              title="Showcase raw Bento UI component demo"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">Bento Demo</span>
            </button>
          </div>
        )}

        {/* Right: Toolbar & Benchmark Selector */}
        <div className="flex items-center gap-1.5">
          {/* Benchmark Preset Selector */}
          <div className="hidden md:flex items-center gap-1.5 mr-1">
            <Layers className="w-3.5 h-3.5 text-graphite-500" />
            <select
              value={activePresetId}
              onChange={(e) => {
                const pid = e.target.value as BenchmarkPresetId;
                onSelectPreset?.(pid);
                onRunSample(pid);
              }}
              disabled={isProcessing}
              className="bg-graphite-900 border border-graphite-750 text-graphite-200 rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
              title="Select a benchmark scenario"
            >
              {BENCHMARK_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Audio Sonification Toggle */}
          {onToggleAudio && (
            <button
              onClick={onToggleAudio}
              className={`focus-ring px-2.5 py-1.5 rounded text-[11px] font-mono transition-colors flex items-center gap-1.5 ${
                isAudioActive
                  ? 'bg-amber-950/40 text-amber-300 border border-amber-500/30 font-semibold'
                  : 'bg-transparent hover:bg-graphite-850 text-graphite-400 hover:text-graphite-200'
              }`}
              title={isAudioActive ? 'Mute physics sonification' : 'Hear physics sonification (Web Audio)'}
            >
              {isAudioActive ? (
                <Volume2 className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-graphite-500" />
              )}
              <span className="hidden xl:inline">Sonification</span>
            </button>
          )}

          {onOpenCalibration && (
            <button
              onClick={onOpenCalibration}
              className="focus-ring px-2.5 py-1.5 rounded bg-transparent hover:bg-graphite-850 text-graphite-400 hover:text-graphite-200 text-[11px] font-mono transition-colors flex items-center gap-1.5"
              title="Calibrate pivot coordinates and metric scale"
            >
              <Ruler className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Calibration</span>
            </button>
          )}

          <button
            onClick={onOpenHelp}
            className="focus-ring px-2.5 py-1.5 rounded bg-transparent hover:bg-graphite-850 text-graphite-400 hover:text-graphite-200 text-[11px] font-mono transition-colors flex items-center gap-1.5"
            title="Physical equations, protocol, and limitations"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Specs</span>
          </button>

          <div className="w-px h-5 bg-graphite-800/60 mx-0.5 hidden sm:block" />

          <button
            onClick={onOpenUpload}
            disabled={isProcessing}
            className="focus-ring px-2.5 py-1.5 rounded bg-transparent hover:bg-graphite-850 disabled:opacity-40 text-graphite-300 hover:text-graphite-100 text-[11px] font-mono transition-colors flex items-center gap-1.5"
            title="Upload custom MP4/MOV clip or record webcam"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400/70" />
            <span className="hidden sm:inline">Upload / Cam</span>
          </button>

          <button
            onClick={() => onRunSample(activePresetId)}
            disabled={isProcessing}
            className="focus-ring px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 text-white font-mono font-medium text-[11px] transition-all flex items-center gap-1.5 shadow-sm shadow-blue-900/30"
            title="Execute sample analysis pipeline"
          >
            {isProcessing ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 fill-current" />
                <span>Run Analysis</span>
              </>
            )}
          </button>

          {hasData && (
            <button
              onClick={onReset}
              className="focus-ring p-1.5 rounded bg-transparent hover:bg-graphite-850 text-graphite-500 hover:text-rose-400 transition-colors"
              title="Reset analysis workspace"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
