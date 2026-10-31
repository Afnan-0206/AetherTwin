'use client';

import React from 'react';
import { Check, Loader2, AlertCircle, Video, Target, Compass, Sliders, ShieldCheck, Sparkles } from 'lucide-react';
import { PipelineStage } from '@/lib/types';

interface PipelineTimelineProps {
  stage: PipelineStage;
  error?: string;
}

interface StepConfig {
  id: PipelineStage;
  num: number;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepConfig[] = [
  {
    id: 'video_loaded',
    num: 1,
    label: 'Media Ingest',
    sublabel: 'Video & Calibration',
    icon: Video
  },
  {
    id: 'segmenting',
    num: 2,
    label: 'SAM 3.1 Tracking',
    sublabel: 'Mask Stream',
    icon: Target
  },
  {
    id: 'measuring',
    num: 3,
    label: 'Angle Extraction',
    sublabel: 'Kinematic θ(t)',
    icon: Compass
  },
  {
    id: 'fitting',
    num: 4,
    label: 'RK4 Fitting (70%)',
    sublabel: 'Parameter Ident.',
    icon: Sliders
  },
  {
    id: 'validating',
    num: 5,
    label: 'Holdout Test (30%)',
    sublabel: 'Predictive Check',
    icon: ShieldCheck
  },
  {
    id: 'diagnosing',
    num: 6,
    label: 'Meta AI Reasoning',
    sublabel: 'Physical Copilot',
    icon: Sparkles
  }
];

const STAGE_ORDER: Record<PipelineStage, number> = {
  idle: 0,
  video_loaded: 1,
  segmenting: 2,
  measuring: 3,
  fitting: 4,
  validating: 5,
  diagnosing: 6,
  completed: 7,
  error: -1
};

export const PipelineTimeline: React.FC<PipelineTimelineProps> = ({ stage, error }) => {
  const currentLevel = STAGE_ORDER[stage] ?? 0;

  // Don't render when idle
  if (stage === 'idle') return null;

  return (
    <div className="w-full bg-[#0c0e15] border-b border-graphite-800/60 px-4 lg:px-6 py-2 select-none">
      <div className="max-w-[1760px] mx-auto flex items-center justify-between gap-2 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-1.5 flex-1 min-w-[700px]">
          {STEPS.map((step, idx) => {
            const stepLevel = idx + 1;
            const isDone = currentLevel > stepLevel || stage === 'completed';
            const isActive = currentLevel === stepLevel;
            const isFailed = stage === 'error' && currentLevel === stepLevel;

            return (
              <React.Fragment key={step.id}>
                <div
                  className={`flex items-center gap-2 px-2.5 py-1 rounded-lg transition-all duration-200 shrink-0 ${
                    isActive
                      ? 'bg-blue-500/10 border border-blue-500/30 text-blue-200'
                      : isDone
                      ? 'text-slate-300'
                      : 'text-graphite-500'
                  }`}
                >
                  {/* Step status pip */}
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-mono font-semibold ${
                      isFailed
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                        : isActive
                        ? 'bg-blue-500 text-white shadow-sm shadow-blue-500/50'
                        : isDone
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-graphite-800 text-graphite-500 border border-graphite-700/50'
                    }`}
                  >
                    {isFailed ? (
                      <AlertCircle className="w-2.5 h-2.5" />
                    ) : isActive ? (
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    ) : isDone ? (
                      <Check className="w-2.5 h-2.5 stroke-[2.5]" />
                    ) : (
                      step.num
                    )}
                  </div>

                  {/* Step label */}
                  <div className="flex items-baseline gap-1.5 leading-none">
                    <span
                      className={`text-xs font-medium ${
                        isActive
                          ? 'text-blue-200'
                          : isDone
                          ? 'text-slate-200'
                          : 'text-graphite-400'
                      }`}
                    >
                      {step.label}
                    </span>
                    <span className="text-[10px] text-graphite-500 hidden xl:inline">
                      {step.sublabel}
                    </span>
                  </div>
                </div>

                {/* Connector line */}
                {idx < STEPS.length - 1 && (
                  <div className="flex-1 h-px bg-graphite-800/80 min-w-[12px] max-w-[40px]" />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Global Pipeline Status Badge */}
        {stage === 'completed' && (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Strict 70/30 Separation Validated</span>
          </div>
        )}

        {stage === 'error' && error && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium shrink-0">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate max-w-xs">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};
