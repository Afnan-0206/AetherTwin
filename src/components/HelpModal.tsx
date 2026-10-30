'use client';

import React from 'react';
import { X, BookOpen, ShieldCheck, Cpu, Code2, AlertTriangle } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-graphite-900 border border-graphite-750 rounded-lg max-w-2xl w-full p-5 shadow-2xl my-8 font-mono text-xs">
        <div className="flex items-center justify-between pb-3 border-b border-graphite-800">
          <div className="flex items-center gap-2 text-graphite-100 font-semibold text-sm">
            <BookOpen className="w-4 h-4 text-blue-400" />
            <span>PHYSICS & ARCHITECTURE SPECIFICATION</span>
          </div>
          <button
            onClick={onClose}
            className="text-graphite-400 hover:text-graphite-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-3.5 space-y-3.5 text-graphite-300 overflow-y-auto max-h-[70vh] pr-2">
          {/* Section 1 */}
          <div className="p-3 rounded bg-graphite-850 border border-graphite-800">
            <h4 className="text-xs font-semibold text-blue-300 mb-1 flex items-center gap-1.5">
              <Code2 className="w-3.5 h-3.5" />
              1. Governing Differential Equation
            </h4>
            <p className="leading-relaxed text-graphite-300 text-[11px]">
              AetherTwin models the planar pendulum using the non-linear damped equation of motion:
            </p>
            <div className="p-2 my-2 rounded bg-graphite-950 text-blue-300 font-semibold text-center border border-graphite-800 text-xs">
              θ&apos;&apos;(t) = -(g / L) · sin(θ(t)) - c · θ&apos;(t)
            </div>
            <p className="text-[10px] text-graphite-400 leading-relaxed">
              Where <strong className="text-graphite-200">θ</strong> is the angular displacement from downward vertical,{' '}
              <strong className="text-graphite-200">g / L = ω₀²</strong> is the natural frequency parameter in s⁻², and{' '}
              <strong className="text-graphite-200">c</strong> is the viscous damping coefficient in s⁻¹.
            </p>
          </div>

          {/* Section 2 */}
          <div className="p-3 rounded bg-graphite-850 border border-graphite-800">
            <h4 className="text-xs font-semibold text-emerald-400 mb-1 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              2. Strict 70% Train / 30% Holdout Split
            </h4>
            <p className="leading-relaxed text-graphite-300 text-[11px]">
              The first 70% of timestamped angle observations are used by a deterministic numerical optimizer to identify{' '}
              <code className="text-emerald-300">(ω₀², c, θ₀, ω₀)</code>. The remaining 30% of frames are{' '}
              <strong className="text-amber-300">strictly held out</strong> and never used during optimization.
            </p>
            <p className="text-[10px] text-graphite-400 mt-1 leading-relaxed">
              Fitted parameters are integrated forward across the holdout window using 4th-order Runge-Kutta (RK4) to evaluate authentic predictive fidelity (MAE, RMSE) and compared against a constant velocity baseline.
            </p>
          </div>

          {/* Section 3 */}
          <div className="p-3 rounded bg-graphite-850 border border-graphite-800">
            <h4 className="text-xs font-semibold text-purple-400 mb-1 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" />
              3. Meta SAM 3.1 & Muse Spark Stack
            </h4>
            <p className="leading-relaxed text-graphite-300 text-[11px]">
              Uses the official Meta Model API (<code className="text-purple-300">https://api.meta.ai/v1</code>):
            </p>
            <ul className="list-disc list-inside space-y-1 mt-1 text-[10px] text-graphite-400">
              <li>
                <strong className="text-graphite-200">SAM 3.1</strong> (<code className="text-purple-300">sam-3.1</code>): Decodes object-prompt stream with official <code className="text-purple-300">@meta-sam/parser</code> to track bob centroids and generate SVG masks.
              </li>
              <li>
                <strong className="text-slate-200">Muse Spark 1.3</strong> (<code className="text-amber-300">muse-spark-1.3</code>): Generates structured physical diagnostic hypotheses, clearly bounded and distinguished from numerical calculations.
              </li>
              <li>
                <strong className="text-slate-200">Demo Mode</strong>: Local offline mode with transparent synthetic reference data when no API key is provided.
              </li>
            </ul>
          </div>

          {/* Section 4 */}
          <div className="p-3 rounded bg-graphite-850 border border-graphite-800">
            <h4 className="text-xs font-semibold text-amber-400 mb-1 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              4. Honest Physical Limitations
            </h4>
            <ul className="list-disc list-inside space-y-1 text-[10px] text-graphite-400 leading-relaxed">
              <li>
                <strong className="text-graphite-200">Single Mechanism:</strong> AetherTwin models a 1-DOF planar pendulum. It does not pretend to solve arbitrary multi-body dynamics.
              </li>
              <li>
                <strong className="text-graphite-200">Scale Calibration:</strong> If length L is unknown, the solver works in relative frequency space (ω₀²). It will never fabricate metric SI gravity.
              </li>
              <li>
                <strong className="text-graphite-200">Out-of-Plane Motion:</strong> Real pendulums can exhibit 3D spherical precession and aerodynamic flutter that deviate from pure planar motion.
              </li>
            </ul>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t border-graphite-800">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 font-semibold text-xs font-mono transition"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
