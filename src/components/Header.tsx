'use client';

import React from 'react';
import {
  Play,
  Upload,
  RotateCcw,
  HelpCircle,
  Ruler,
  Activity,
  Volume2,
  VolumeX,
  LayoutDashboard,
  Grid3X3,
  Sparkles,
  Brain,
  Cpu
} from 'lucide-react';
import { BenchmarkPresetId } from '@/lib/types';
import { BENCHMARK_PRESETS } from '@/lib/sample/syntheticPendulum';

export type AppViewMode = 'workbench' | 'bento' | 'demo';

interface HeaderProps {
  onRunSample: (presetId?: BenchmarkPresetId) => void;
  onOpenUpload: () => void;
  onReset: () => void;
  onOpenHelp: () => void;
  onOpenCalibration?: () => void;
  onOpenTour?: () => void;
  onOpenMetaStack?: () => void;
  onOpenFirmware?: () => void;
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
  onOpenTour,
  onOpenMetaStack,
  onOpenFirmware,
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
    <header className="border-b border-graphite-800/80 bg-[#090b10]/95 backdrop-blur-md sticky top-0 z-40 select-none">
      <div className="max-w-[1760px] mx-auto px-3 sm:px-4 lg:px-6 h-13 sm:h-14 flex items-center justify-between gap-2 sm:gap-4 overflow-hidden">
        {/* Left: Branding & Status */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Logo Mark */}
          <div className="relative w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-blue-500/20 via-blue-600/10 to-transparent border border-blue-500/30 flex items-center justify-center shadow-sm shadow-blue-500/10">
            <span className="text-blue-400 font-mono text-sm font-bold leading-none">Æ</span>
            <div className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-400 ring-2 ring-[#090b10]" />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-slate-100">
              AetherTwin
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-graphite-800 text-graphite-300 border border-graphite-700/60 font-medium leading-none">
              v2.0
            </span>
          </div>

          {/* Mode Pill */}
          <div className="hidden sm:flex items-center pl-2 border-l border-graphite-800/80">
            {isDemoMode ? (
              <div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] font-medium whitespace-nowrap"
                title="Running local deterministic physics engine"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Demo Mode</span>
              </div>
            ) : (
              <div
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[11px] font-medium whitespace-nowrap"
                title="Connected to Meta SAM 3.1 & Llama 3.3 live API"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live Meta API</span>
              </div>
            )}
          </div>
        </div>

        {/* Center: View Switcher (Workbench / Bento Telemetry / Bento Demo) */}
        {onChangeView && (
          <div className="hidden md:flex items-center p-0.5 rounded-lg bg-graphite-900/90 border border-graphite-800 text-xs shrink-0 shadow-inner">
            <button
              type="button"
              onClick={() => onChangeView('workbench')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                currentView === 'workbench'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-graphite-400 hover:text-slate-200 hover:bg-graphite-800/50'
              }`}
              title="Standard 3-panel physics workbench"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Workbench</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeView('bento')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                currentView === 'bento'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-graphite-400 hover:text-slate-200 hover:bg-graphite-800/50'
              }`}
              title="Full telemetry & LQR bento grid"
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
              className={`hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                currentView === 'demo'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-graphite-400 hover:text-slate-200 hover:bg-graphite-800/50'
              }`}
              title="Analytics bento demo"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span>Demo</span>
            </button>
          </div>
        )}

        {/* Right: Actions, Scenario Selector & Secondary Tools */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Preset Selector */}
          <div className="flex items-center">
            <select
              value={activePresetId}
              onChange={(e) => {
                const pid = e.target.value as BenchmarkPresetId;
                onSelectPreset?.(pid);
                onRunSample(pid);
              }}
              disabled={isProcessing}
              className="bg-graphite-900 border border-graphite-750 text-slate-200 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 hover:border-graphite-650 transition cursor-pointer max-w-[150px] sm:max-w-[200px] truncate"
              title="Select physical benchmark scenario"
            >
              {BENCHMARK_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Secondary Tools Icon Group */}
          <div className="flex items-center gap-0.5 border-l border-graphite-800/80 pl-1.5">
            {onOpenMetaStack && (
              <button
                type="button"
                onClick={onOpenMetaStack}
                className="p-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 transition"
                title="Inspect Meta SAM 3.1 & Llama 3.3 Stack"
              >
                <Brain className="w-3.5 h-3.5 text-purple-400" />
              </button>
            )}

            {onOpenFirmware && (
              <button
                type="button"
                onClick={onOpenFirmware}
                className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 transition"
                title="Edge Firmware & C Synthesis"
              >
                <Cpu className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            )}

            {onOpenCalibration && (
              <button
                onClick={onOpenCalibration}
                className="p-1.5 rounded-lg text-graphite-400 hover:text-slate-200 hover:bg-graphite-850 transition-colors"
                title="Camera calibration & metric scale"
              >
                <Ruler className="w-3.5 h-3.5" />
              </button>
            )}

            {onToggleAudio && (
              <button
                onClick={onToggleAudio}
                className={`p-1.5 rounded-lg transition-colors ${
                  isAudioActive
                    ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                    : 'text-graphite-400 hover:text-slate-200 hover:bg-graphite-850'
                }`}
                title={isAudioActive ? 'Mute audio sonification' : 'Physics Web Audio Sonification'}
              >
                {isAudioActive ? (
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
              </button>
            )}

            {onOpenTour && (
              <button
                onClick={onOpenTour}
                className="p-1.5 rounded-lg text-graphite-400 hover:text-slate-200 hover:bg-graphite-850 transition-colors"
                title="Interactive Guided Architecture Tour"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              </button>
            )}

            <button
              onClick={onOpenHelp}
              className="p-1.5 rounded-lg text-graphite-400 hover:text-slate-200 hover:bg-graphite-850 transition-colors"
              title="Physics equations, verification bounds & specs"
            >
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Primary Action Buttons (Always Visible, Protected from Clipping) */}
          <div className="flex items-center gap-1.5 border-l border-graphite-800/80 pl-1.5 shrink-0">
            <button
              onClick={onOpenUpload}
              disabled={isProcessing}
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-graphite-850 hover:bg-graphite-800 text-slate-200 border border-graphite-750 text-xs font-medium transition disabled:opacity-40"
              title="Upload custom MP4/MOV clip or webcam stream"
            >
              <Upload className="w-3 h-3 text-slate-400" />
              <span>Upload</span>
            </button>

            <button
              onClick={() => onRunSample(activePresetId)}
              disabled={isProcessing}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 text-white font-medium text-xs shadow-sm shadow-blue-600/30 transition-all cursor-pointer shrink-0"
              title="Execute full end-to-end twin pipeline"
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
                className="p-1.5 rounded-lg text-graphite-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                title="Reset workspace"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
