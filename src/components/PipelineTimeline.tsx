'use client';

import React from 'react';
import { CheckCircle2, Loader2, AlertCircle, Video, Target, Compass, Sliders, ShieldCheck, Sparkles } from 'lucide-react';
import { PipelineStage } from '@/lib/types';

interface PipelineTimelineProps {
  stage: PipelineStage;
  error?: string;
}

interface StepConfig {
  id: PipelineStage;
  num: string;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: StepConfig[] = [
  {
    id: 'video_loaded',
    num: '01',
    label: 'Source Media',
    sublabel: 'Video / Calibration',
    icon: Video
  },
  {
    id: 'segmenting',
    num: '02',
    label: 'SAM 3.1 Tracking',
    sublabel: 'Mask & Centroid Stream',
    icon: Target
  },
  {
    id: 'measuring',
    num: '03',
    label: 'Angle Extraction',
    sublabel: 'Kinematic θ(t) Series',
    icon: Compass
  },
  {
    id: 'fitting',
    num: '04',
    label: 'RK4 Fit (70%)',
    sublabel: 'ODE Parameter Ident.',
    icon: Sliders
  },
  {
    id: 'validating',
    num: '05',
    label: 'Holdout Test (30%)',
    sublabel: 'Predictive Verification',
    icon: ShieldCheck
  },
  {
    id: 'diagnosing',
    num: '06',
    label: 'Muse Spark AI',
    sublabel: 'Physical Reasoning',
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
    <div className="w-full bg-[#0c0f17] border-b border-graphite-800/60 px-4 lg:px-6 py-2">
      <div className="max-w-[1720px] mx-auto flex items-center gap-0.5 overflow-x-auto scrollbar-none">
        {STEPS.map((step, idx) => {
          const stepLevel = idx + 1;
          const isDone = currentLevel > stepLevel || stage === 'completed';
          const isActive = currentLevel === stepLevel;
          const isFailed = stage === 'error' && currentLevel === stepLevel;

          return (
            <React.Fragment key={step.id}>
              <div
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md transition-all duration-300 select-none shrink-0 ${
                  isActive
                    ? 'bg-blue-500/8 ring-1 ring-blue-500/30 text-blue-200'
                    : isDone
                    ? 'text-graphite-300'
                    : 'text-graphite-600'
                }`}
              >
                {/* Status icon */}
                <div className="flex items-center justify-center w-4 h-4 shrink-0">
                  {isFailed ? (
                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                  ) : isActive ? (
                    <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                  ) : isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400/80" />
                  ) : (
                    <span className="font-mono text-[10px] text-graphite-600 font-medium">
                      {step.num}
                    </span>
                  )}
                </div>

                <div className="flex flex-col min-w-max">
                  <span
                    className={`text-[11px] font-mono font-medium leading-none ${
                      isActive
                        ? 'text-blue-200'
                        : isDone
                        ? 'text-graphite-300'
                        : 'text-graphite-500'
                    }`}
                  >
                    {step.label}
                  </span>
                  <span className={`text-[9px] font-mono leading-tight mt-0.5 ${
                    isActive ? 'text-blue-300/50' : 'text-graphite-600'
                  }`}>
                    {step.sublabel}
                  </span>
                </div>
              </div>

              {/* Connector line */}
              {idx < STEPS.length - 1 && (
                <div className="flex items-center px-0.5 shrink-0">
                  <div
                    className={`h-px w-4 transition-colors duration-500 ${
                      isDone ? 'bg-emerald-500/25' : 'bg-graphite-800/60'
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div className="max-w-[1720px] mx-auto mt-2 p-2 rounded bg-rose-950/30 border border-rose-500/20 text-rose-300 text-[11px] font-mono flex items-center gap-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
          <span>Pipeline Error: {error}</span>
        </div>
      )}
    </div>
  );
};
