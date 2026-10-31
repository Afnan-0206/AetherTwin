'use client';

import React, { useState } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Camera,
  Compass,
  Activity,
  ShieldCheck,
  Cpu,
  Play
} from 'lucide-react';
import { BenchmarkPresetId } from '@/lib/types';

interface GuidedTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunBenchmark: (presetId: BenchmarkPresetId) => void;
}

export const GuidedTourModal: React.FC<GuidedTourModalProps> = ({
  isOpen,
  onClose,
  onRunBenchmark
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);

  if (!isOpen) return null;

  const steps = [
    {
      stepNumber: 1,
      tagline: 'Step 1 of 5 • Optical Motion Capture',
      title: 'From Real Video to Physical Twin',
      description:
        'AetherTwin captures physical movement from everyday video clips (MP4/MOV) or live webcam feeds. Meta SAM 3.1 and local optical flow algorithms track the swinging mass with sub-pixel precision across every frame.',
      mathFormula: 'y(t) = [x_{bob}(t), y_{bob}(t)]^T \\in \\mathbb{R}^2, \\quad f_s = 30\\,\\text{Hz}',
      highlightColor: 'from-blue-600/20 to-blue-800/10',
      borderColor: 'border-blue-500/30',
      icon: <Camera className="w-6 h-6 text-blue-400" />,
      actionText: 'Try Standard Lab Benchmark',
      presetId: 'standard' as BenchmarkPresetId
    },
    {
      stepNumber: 2,
      tagline: 'Step 2 of 5 • Geometry Identification',
      title: 'Algebraic Circle-Fit Calibration',
      description:
        'Instead of guessing where the physical suspension pivot is located, AetherTwin runs a least-squares circular arc fit across the observed trajectory to calculate the exact pivot coordinate (x₀, y₀) and metric scale.',
      mathFormula: '\\min_{x_0, y_0, R} \\sum_{i=1}^N \\left( (x_i - x_0)^2 + (y_i - y_0)^2 - R^2 \\right)^2',
      highlightColor: 'from-cyan-600/20 to-cyan-800/10',
      borderColor: 'border-cyan-500/30',
      icon: <Compass className="w-6 h-6 text-cyan-400" />,
      actionText: 'Try Taipei 101 Damper',
      presetId: 'taipei_101_tmd' as BenchmarkPresetId
    },
    {
      stepNumber: 3,
      tagline: 'Step 3 of 5 • Parameter Identification',
      title: 'Non-Linear ODE Parameter Fitting (70% Train)',
      description:
        'The first 70% of frames are isolated for training. A Nelder-Mead simplex optimizer numerically integrates the non-linear damped pendulum equations using a Runge-Kutta 4th-order (RK4) solver to determine natural frequency and damping coefficients.',
      mathFormula: '\\ddot{\\theta}(t) + c_1 \\dot{\\theta}(t) + c_2 |\\dot{\\theta}(t)|\\dot{\\theta}(t) + \\omega_0^2 \\sin\\theta(t) = 0',
      highlightColor: 'from-emerald-600/20 to-emerald-800/10',
      borderColor: 'border-emerald-500/30',
      icon: <Activity className="w-6 h-6 text-emerald-400" />,
      actionText: 'Try 75° Non-Linear Swing',
      presetId: 'nonlinear_large_amp' as BenchmarkPresetId
    },
    {
      stepNumber: 4,
      tagline: 'Step 4 of 5 • Scientific Verification',
      title: 'The Strict 30% Unseen Holdout Frontier',
      description:
        'Unlike models that overfit on entire datasets, AetherTwin holds out the final 30% of frames. The identified ODE parameters are integrated forward across unseen time to calculate empirical Holdout RMSE and prove true predictive fidelity.',
      mathFormula: '\\text{Error Reduction} = \\left(1 - \\frac{\\text{RMSE}_{\\text{twin}}}{\\text{RMSE}_{\\text{baseline}}}\\right) \\times 100\\%',
      highlightColor: 'from-amber-600/20 to-amber-800/10',
      borderColor: 'border-amber-500/30',
      icon: <ShieldCheck className="w-6 h-6 text-amber-400" />,
      actionText: 'Try Lunar Gravity Test',
      presetId: 'lunar_gravity' as BenchmarkPresetId
    },
    {
      stepNumber: 5,
      tagline: 'Step 5 of 5 • Optimal Control & Hardware Edge',
      title: 'Continuous Algebraic Riccati LQR & Firmware',
      description:
        'Beyond passive observation, AetherTwin synthesizes active optimal control. It solves the 8×8 Hamiltonian Matrix Sign Function to derive the Continuous Algebraic Riccati Equation (CARE) gain vector K and outputs production C++ / Rust edge firmware.',
      mathFormula: 'u(t) = -\\mathbf{K} \\mathbf{x}(t), \\quad \\mathbf{A}^T \\mathbf{P} + \\mathbf{P}\\mathbf{A} - \\mathbf{P}\\mathbf{B}\\mathbf{R}^{-1}\\mathbf{B}^T\\mathbf{P} + \\mathbf{Q} = 0',
      highlightColor: 'from-purple-600/20 to-purple-800/10',
      borderColor: 'border-purple-500/30',
      icon: <Cpu className="w-6 h-6 text-purple-400" />,
      actionText: 'Simulate Rocket Landing TVC',
      presetId: 'rocket_landing_tvc' as BenchmarkPresetId
    }
  ];

  const current = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fadeIn">
      <div className="relative w-full max-w-2xl rounded-2xl bg-[#0b0f19] border border-graphite-800 shadow-2xl overflow-hidden panel-enter font-sans">
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-graphite-800/80 bg-graphite-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Sparkles className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-100 font-mono tracking-tight m-0">
                AetherTwin Architecture & Guided Tour
              </h2>
              <span className="text-[11px] font-mono text-graphite-400">{current.tagline}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-graphite-400 hover:text-slate-200 hover:bg-graphite-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Step Icon & Title Banner */}
          <div className={`p-4 rounded-xl bg-gradient-to-br ${current.highlightColor} border ${current.borderColor} flex items-start gap-4`}>
            <div className="p-2.5 rounded-xl bg-graphite-900/90 border border-graphite-750 shrink-0">
              {current.icon}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-100 mb-1 tracking-tight">
                {current.title}
              </h3>
              <p className="text-xs text-graphite-300 leading-relaxed m-0">
                {current.description}
              </p>
            </div>
          </div>

          {/* Mathematical Grounding Callout */}
          <div className="p-3.5 rounded-xl bg-graphite-900/70 border border-graphite-800/90 font-mono">
            <div className="text-[10px] text-graphite-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Governing Physics / Mathematical Invariant</span>
            </div>
            <div className="text-xs text-emerald-300 font-semibold overflow-x-auto py-1">
              <code>{current.mathFormula}</code>
            </div>
          </div>

          {/* Preset Shortcut Banner */}
          <div className="p-3 rounded-xl bg-graphite-950/60 border border-graphite-800 flex items-center justify-between gap-3">
            <span className="text-xs font-mono text-graphite-400">
              Want to see this principle demonstrated live?
            </span>
            <button
              onClick={() => {
                onClose();
                onRunBenchmark(current.presetId);
              }}
              className="focus-ring px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-medium flex items-center gap-1.5 shadow-sm transition"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{current.actionText}</span>
            </button>
          </div>
        </div>

        {/* Bottom Navigation Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-graphite-800/80 bg-graphite-950/60">
          {/* Step Dots */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentStep(i)}
                className={`w-2 h-2 rounded-full transition-all ${
                  i === currentStep
                    ? 'w-6 bg-blue-400'
                    : 'bg-graphite-700 hover:bg-graphite-500'
                }`}
                title={`Jump to step ${i + 1}`}
              />
            ))}
          </div>

          {/* Prev / Next buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="px-3 py-1.5 rounded-lg bg-graphite-850 hover:bg-graphite-800 disabled:opacity-30 text-graphite-300 font-mono text-xs transition flex items-center gap-1 border border-graphite-750/60"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <button
              onClick={handleNext}
              className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-medium transition flex items-center gap-1 shadow-md shadow-blue-900/30"
            >
              <span>{currentStep === steps.length - 1 ? 'Finish Tour' : 'Next Step'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
