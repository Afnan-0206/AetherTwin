'use client';

import React, { useState } from 'react';
import {
  X,
  Cpu,
  Eye,
  Brain,
  ShieldCheck,
  CheckCircle2,
  Terminal,
  Zap,
  Layers,
  ArrowRight,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface MetaArchitectureModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDemoMode: boolean;
}

export const MetaArchitectureModal: React.FC<MetaArchitectureModalProps> = ({
  isOpen,
  onClose,
  isDemoMode
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'sam' | 'llama' | 'prompts'>('overview');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-[#0b0f19] border border-graphite-750 rounded-xl max-w-4xl w-full p-6 shadow-2xl my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-graphite-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Meta Frontier AI Architecture // Dual-Model Pipeline
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  SAM 3.1 + Llama 3.3
                </span>
              </div>
              <p className="text-[11px] font-mono text-graphite-400 mt-0.5">
                Bridging Zero-Shot Computer Vision and Autonomous Scientific Reasoning for Physical Digital Twins
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-graphite-400 hover:text-graphite-200 hover:bg-graphite-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 mt-4 border-b border-graphite-800 pb-2 text-xs font-mono">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'overview'
                ? 'bg-blue-600 text-white font-medium shadow-sm'
                : 'text-graphite-400 hover:text-slate-200 hover:bg-graphite-850'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Dual-Model Topology</span>
          </button>
          <button
            onClick={() => setActiveTab('sam')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'sam'
                ? 'bg-blue-600 text-white font-medium shadow-sm'
                : 'text-graphite-400 hover:text-slate-200 hover:bg-graphite-850'
            }`}
          >
            <Eye className="w-3.5 h-3.5 text-cyan-400" />
            <span>Meta SAM 3.1 (Vision)</span>
          </button>
          <button
            onClick={() => setActiveTab('llama')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'llama'
                ? 'bg-blue-600 text-white font-medium shadow-sm'
                : 'text-graphite-400 hover:text-slate-200 hover:bg-graphite-850'
            }`}
          >
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span>Meta Llama 3.3 / Muse Spark</span>
          </button>
          <button
            onClick={() => setActiveTab('prompts')}
            className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
              activeTab === 'prompts'
                ? 'bg-blue-600 text-white font-medium shadow-sm'
                : 'text-graphite-400 hover:text-slate-200 hover:bg-graphite-850'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Live Prompts & Schemas</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 font-mono text-xs space-y-4 pr-1">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-graphite-900/60 border border-graphite-800 space-y-3">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                  The Cyber-Physical Dataflow
                </span>
                <p className="text-graphite-300 leading-relaxed text-[11px]">
                  Traditional digital twin systems fail because they rely on expensive marker-based optical setups or manually hand-tuned ODE parameters. AetherTwin solves both by coupling Meta’s vision foundation model with Meta’s scientific reasoning LLMs in a closed-loop verification pipeline:
                </p>

                {/* Flow Diagram */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-2 pt-2">
                  <div className="p-3 rounded bg-graphite-950 border border-graphite-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-cyan-400 font-bold mb-1">
                        <Eye className="w-3.5 h-3.5" />
                        <span>1. Optical Sensor</span>
                      </div>
                      <p className="text-[10px] text-graphite-400">
                        Ordinary consumer RGB video at 30-60 FPS without calibration markers.
                      </p>
                    </div>
                    <div className="text-[9px] text-graphite-500 mt-2 font-semibold">
                      Raw Frames [T, H, W, 3]
                    </div>
                  </div>

                  <div className="p-3 rounded bg-graphite-950 border border-blue-500/30 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-blue-400 font-bold mb-1">
                        <Zap className="w-3.5 h-3.5" />
                        <span>2. Meta SAM 3.1</span>
                      </div>
                      <p className="text-[10px] text-graphite-400">
                        Promptable zero-shot bob segmentation yielding sub-pixel centroids (x_t, y_t).
                      </p>
                    </div>
                    <div className="text-[9px] text-blue-400 mt-2 font-semibold">
                      Endpoint: api.meta.ai
                    </div>
                  </div>

                  <div className="p-3 rounded bg-graphite-950 border border-graphite-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-emerald-400 font-bold mb-1">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>3. RK4 + Pratt Fit</span>
                      </div>
                      <p className="text-[10px] text-graphite-400">
                        Strict 70% ODE parameter identification & 30% unseen holdout validation.
                      </p>
                    </div>
                    <div className="text-[9px] text-emerald-400 mt-2 font-semibold">
                      Deterministic Core
                    </div>
                  </div>

                  <div className="p-3 rounded bg-graphite-950 border border-purple-500/30 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 text-purple-400 font-bold mb-1">
                        <Brain className="w-3.5 h-3.5" />
                        <span>4. Llama 3.3 Spark</span>
                      </div>
                      <p className="text-[10px] text-graphite-400">
                        Autonomous fluid dynamics, Reynolds numbers, drag regimes & CARE LQR synthesis.
                      </p>
                    </div>
                    <div className="text-[9px] text-purple-400 mt-2 font-semibold">
                      C++ / ROS 2 Code Gen
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Banner */}
              <div className="p-3 rounded-lg bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300 font-semibold text-[11px]">
                    Autonomous Fallback Architecture Active
                  </span>
                </div>
                <span className="text-[10px] text-graphite-400">
                  {isDemoMode ? 'Local Deterministic Tracker (Demo Mode)' : 'Connected to Live Meta AI APIs'}
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: SAM 3.1 */}
          {activeTab === 'sam' && (
            <div className="space-y-3.5">
              <div className="p-4 rounded-lg bg-graphite-900/60 border border-graphite-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-400 uppercase">
                    Meta SAM 3.1 (Segment Anything Model 3.1)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                    Vision Foundation Model
                  </span>
                </div>
                <p className="text-graphite-300 text-[11px] leading-relaxed">
                  In AetherTwin, SAM 3.1 is invoked via the Meta Responses API to perform promptable video object segmentation. Instead of requiring human annotation or optical markers, SAM 3.1 accepts an initial point prompt or bounding box on frame 0 and propagates high-confidence binary masks across arbitrary lighting and background clutter.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                  <div className="p-2.5 rounded bg-graphite-950 border border-graphite-800">
                    <div className="text-slate-200 font-semibold text-[11px]">Prompt Encoder</div>
                    <div className="text-graphite-400 text-[10px] mt-1">
                      Translates user clicks / bounding boxes into sparse geometric positional embeddings.
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-graphite-950 border border-graphite-800">
                    <div className="text-slate-200 font-semibold text-[11px]">Mask Decoder</div>
                    <div className="text-graphite-400 text-[10px] mt-1">
                      Computes cross-attention between image feature embeddings and geometric prompt tokens.
                    </div>
                  </div>
                  <div className="p-2.5 rounded bg-graphite-950 border border-graphite-800">
                    <div className="text-slate-200 font-semibold text-[11px]">Centroid Extractor</div>
                    <div className="text-graphite-400 text-[10px] mt-1">
                      Calculates the center of mass (x_c = Σ x_i / N, y_c = Σ y_i / N) with sub-pixel resolution.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: LLAMA 3.3 */}
          {activeTab === 'llama' && (
            <div className="space-y-3.5">
              <div className="p-4 rounded-lg bg-graphite-900/60 border border-graphite-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-400 uppercase">
                    Meta Llama 3.3 / Muse Spark (Scientific Intelligence)
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-800">
                    Reasoning & Control Synthesis
                  </span>
                </div>
                <p className="text-graphite-300 text-[11px] leading-relaxed">
                  Rather than treating LLMs as creative chatbots, AetherTwin uses Llama 3.3 as an autonomous physics diagnostician with strict JSON schema constraints. The model ingests the fitted parameters and holdout verification metrics to analyze:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-graphite-300 text-[11px]">
                  <li>
                    <strong className="text-slate-100">Fluid Dynamic Regime:</strong> Computes Reynolds number Re = (ρ · v · D) / μ to verify if the drag regime is linear Stokes or quadratic aerodynamic bluff-body.
                  </li>
                  <li>
                    <strong className="text-slate-100">Lyapunov Stability:</strong> Evaluates closed-loop eigenvalue stability Re(λ_i) &lt; 0 for state-feedback gains.
                  </li>
                  <li>
                    <strong className="text-slate-100">Sim-to-Real Discrepancy:</strong> Identifies unmodeled bearing friction, cable elasticity, or camera perspective tilt.
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* TAB 4: LIVE PROMPTS */}
          {activeTab === 'prompts' && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-graphite-950 border border-graphite-800">
                <div className="text-blue-400 font-bold text-[11px] mb-1">
                  System Prompt (Llama 3.3 Scientific Workstation)
                </div>
                <pre className="p-2.5 rounded bg-[#070a10] border border-graphite-850 text-graphite-300 text-[10px] overflow-x-auto whitespace-pre-wrap">
{`You are an expert aerodynamicist, experimental physicist, and optimal control engineer.
You analyze identified ODE parameters from video-tracked physical motion twins.
You must output valid JSON conforming strictly to the MuseSparkDiagnostic schema:
{
  "summary": "Concise physical verdict",
  "physicalConsistency": "consistent" | "plausible" | "suspicious",
  "dampingRegime": "underdamped" | "critical" | "overdamped",
  "anomalyDetected": boolean,
  "confidenceScore": number (0-1),
  "detailedCritique": "Detailed engineering analysis including drag mechanisms, Reynolds number, and recommendations"
}`}
                </pre>
              </div>

              <div className="p-3 rounded-lg bg-graphite-950 border border-graphite-800">
                <div className="text-purple-400 font-bold text-[11px] mb-1">
                  Structured Payload Generation (Excerpt)
                </div>
                <pre className="p-2.5 rounded bg-[#070a10] border border-graphite-850 text-graphite-300 text-[10px] overflow-x-auto whitespace-pre-wrap">
{`POST https://api.meta.ai/v1/chat/completions
Authorization: Bearer <META_API_KEY>
Payload: {
  "model": "meta/llama-3.3-70b-instruct",
  "temperature": 0.1,
  "response_format": { "type": "json_object" },
  "messages": [...]
}`}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-graphite-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-graphite-500 font-mono text-[10px]">
            <span>Compliant with Meta Open Source Models license & guidelines.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-mono text-xs font-medium transition"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
