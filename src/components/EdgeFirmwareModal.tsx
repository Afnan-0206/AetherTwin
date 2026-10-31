'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Cpu,
  Terminal,
  Play,
  Pause,
  Download,
  Copy,
  Check,
  Usb,
  RotateCcw,
  Zap,
  Activity,
  Code
} from 'lucide-react';
import { StateSpaceModel } from '@/lib/physics/cartPoleLqr';
import { PendulumParameters } from '@/lib/types';
import { generateArduinoCppFirmware, generateRos2NodeScript, downloadTextFile } from '@/lib/export/exportUtils';

interface EdgeFirmwareModalProps {
  isOpen: boolean;
  onClose: () => void;
  parameters: PendulumParameters | null;
  lqrModel: StateSpaceModel;
}

export const EdgeFirmwareModal: React.FC<EdgeFirmwareModalProps> = ({
  isOpen,
  onClose,
  parameters,
  lqrModel
}) => {
  const [activeTab, setActiveTab] = useState<'terminal' | 'arduino' | 'ros2'>('terminal');
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [baudRate, setBaudRate] = useState<number>(115200);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isSerialConnected, setIsSerialConnected] = useState<boolean>(false);
  const [serialError, setSerialError] = useState<string | null>(null);

  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const streamTimerRef = useRef<NodeJS.Timeout | null>(null);
  const simTimeRef = useRef<number>(0);

  // Initialize terminal stream
  useEffect(() => {
    if (!isOpen) {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
      return;
    }

    // Initial boot sequence
    const bootLines = [
      `[BOOT] AetherTwin Edge Core v2.0 Initializing...`,
      `[INFO] Target: 32-bit Microcontroller (ESP32 / ARM Cortex-M4) @ 160MHz`,
      `[INFO] Inferred Natural Frequency ω₀² = ${(parameters?.omega0Sq ?? 19.61).toFixed(4)} s⁻²`,
      `[INFO] Optimal CARE LQR Feedback Gain K: [${lqrModel.K.map((k) => k.toFixed(3)).join(', ')}]`,
      `[INFO] Closed-Loop Poles: [${lqrModel.closedLoopPoles.map((p) => `${p.real.toFixed(2)}${p.imag >= 0 ? '+' : ''}${p.imag.toFixed(2)}i`).join(', ')}]`,
      `[READY] Commencing 100Hz Hardware Telemetry Loop (baud: 115200)...`,
      `--------------------------------------------------------------------------------`
    ];
    setTerminalLines(bootLines);
    simTimeRef.current = 0;

    let x = 0.02;
    let v = -0.01;
    let th = 0.08;
    let om = -0.05;

    streamTimerRef.current = setInterval(() => {
      if (!isStreaming) return;
      simTimeRef.current += 0.01;
      const t = simTimeRef.current;

      // Compute LQR control force u = -K * x
      const u = -(lqrModel.K[0] * x + lqrModel.K[1] * v + lqrModel.K[2] * th + lqrModel.K[3] * om);

      // Simple discrete simulation update
      const dt = 0.01;
      const xDot = v;
      const vDot = 0.2 * u - 0.1 * v;
      const thDot = om;
      const omDot = -0.4 * u + 9.81 * th - 0.05 * om;

      x += xDot * dt;
      v += vDot * dt;
      th += thDot * dt;
      om += omDot * dt;

      // Checksum simulation
      const raw = `$TELEM,t=${t.toFixed(3)},x=${x.toFixed(3)},v=${v.toFixed(3)},th=${th.toFixed(3)},om=${om.toFixed(3)},u=${u.toFixed(2)}`;
      const checksum = (Math.abs(Math.round((x + th + u) * 100)) % 255).toString(16).toUpperCase().padStart(2, '0');
      const packet = `${raw}*${checksum}`;

      setTerminalLines((prev) => [...prev.slice(-120), packet]);
    }, 40); // 25 updates per second for smooth rendering

    return () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current);
    };
  }, [isOpen, isStreaming, lqrModel, parameters]);

  useEffect(() => {
    if (activeTab === 'terminal') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLines, activeTab]);

  if (!isOpen) return null;

  const handleCopyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleConnectWebSerial = async () => {
    setSerialError(null);
    if (!('serial' in navigator)) {
      setSerialError('WebSerial API is not supported in this browser. Please use Chrome, Edge, or Opera.');
      return;
    }

    try {
      const navAny = navigator as any;
      const port = await navAny.serial.requestPort();
      await port.open({ baudRate });
      setIsSerialConnected(true);
      setTerminalLines((prev) => [
        ...prev,
        `[USB] Physical Serial Port Connected at ${baudRate} baud. Streaming edge telemetry to hardware...`
      ]);
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        setSerialError(err.message || 'Failed to connect to serial port.');
      }
    }
  };

  const defaultParams: PendulumParameters = parameters || {
    omega0Sq: 19.6133,
    damping: 0.15,
    initialAngle: 0.5,
    initialVelocity: 0,
    length: 0.5,
    gravity: 9.81
  };

  const arduinoCode = generateArduinoCppFirmware(defaultParams, lqrModel);
  const ros2Code = generateRos2NodeScript(defaultParams, lqrModel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-[#0b0f19] border border-graphite-750 rounded-xl max-w-4xl w-full p-6 shadow-2xl my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-graphite-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center">
              <Cpu className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono text-sm font-bold text-slate-100 uppercase tracking-wider">
                  Edge Firmware Simulator & Hardware Deployment
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  100Hz Hardware Loop
                </span>
              </div>
              <p className="text-[11px] font-mono text-graphite-400 mt-0.5">
                Simulated microcontroller execution of continuous-time CARE Riccati optimal feedback law u = -K·x
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-graphite-400 hover:text-graphite-200 hover:bg-graphite-850 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-graphite-800 pb-2 mt-4 text-xs font-mono">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('terminal')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'terminal'
                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                  : 'text-graphite-400 hover:text-slate-200 hover:bg-graphite-850'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Live Serial Monitor</span>
            </button>
            <button
              onClick={() => setActiveTab('arduino')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'arduino'
                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                  : 'text-graphite-400 hover:text-slate-200 hover:bg-graphite-850'
              }`}
            >
              <Code className="w-3.5 h-3.5 text-cyan-400" />
              <span>Arduino C++ Firmware</span>
            </button>
            <button
              onClick={() => setActiveTab('ros2')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                activeTab === 'ros2'
                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                  : 'text-graphite-400 hover:text-slate-200 hover:bg-graphite-850'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span>ROS 2 Humble Node</span>
            </button>
          </div>

          {activeTab === 'terminal' && (
            <div className="flex items-center gap-2">
              <select
                value={baudRate}
                onChange={(e) => setBaudRate(Number(e.target.value))}
                className="bg-graphite-900 border border-graphite-750 rounded px-2 py-1 text-[11px] text-graphite-200"
              >
                <option value={9600}>9600 baud</option>
                <option value={57600}>57600 baud</option>
                <option value={115200}>115200 baud</option>
                <option value={230400}>230400 baud</option>
              </select>

              <button
                onClick={() => setIsStreaming(!isStreaming)}
                className={`px-2.5 py-1 rounded transition flex items-center gap-1 ${
                  isStreaming
                    ? 'bg-amber-950/40 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {isStreaming ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                <span>{isStreaming ? 'Pause' : 'Resume'}</span>
              </button>

              <button
                onClick={() => setTerminalLines([])}
                className="p-1 rounded bg-graphite-850 text-graphite-400 hover:text-graphite-200"
                title="Clear buffer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto py-3 font-mono text-xs">
          {serialError && (
            <div className="mb-2 p-2 rounded bg-rose-950/40 border border-rose-500/40 text-rose-300 text-[11px]">
              {serialError}
            </div>
          )}

          {/* TAB 1: TERMINAL */}
          {activeTab === 'terminal' && (
            <div className="flex flex-col h-full bg-[#05070c] rounded-lg border border-graphite-800 p-3 shadow-inner overflow-hidden">
              <div className="flex-1 overflow-y-auto font-mono text-[11px] space-y-1 text-slate-300 leading-tight pr-1">
                {terminalLines.map((line, idx) => (
                  <div
                    key={idx}
                    className={
                      line.startsWith('[BOOT]')
                        ? 'text-blue-400 font-bold'
                        : line.startsWith('[INFO]')
                        ? 'text-emerald-400'
                        : line.startsWith('[READY]')
                        ? 'text-cyan-400 font-semibold'
                        : line.startsWith('[USB]')
                        ? 'text-amber-400 font-bold'
                        : 'text-graphite-300'
                    }
                  >
                    {line}
                  </div>
                ))}
                <div ref={terminalEndRef} />
              </div>

              {/* Physical Serial USB Connect Button */}
              <div className="mt-2 pt-2 border-t border-graphite-850 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] text-graphite-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Virtual 100Hz Telemetry Clock Running</span>
                </div>
                <button
                  onClick={handleConnectWebSerial}
                  className="px-3 py-1 rounded-md bg-graphite-800 hover:bg-graphite-750 border border-graphite-700 text-graphite-200 text-[11px] flex items-center gap-1.5 transition"
                >
                  <Usb className="w-3.5 h-3.5 text-blue-400" />
                  <span>{isSerialConnected ? 'Port Connected' : 'Connect WebSerial USB'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ARDUINO C++ */}
          {activeTab === 'arduino' && (
            <div className="relative h-full">
              <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
                <button
                  onClick={() => handleCopyCode(arduinoCode)}
                  className="px-2.5 py-1 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 border border-graphite-700 text-[11px] flex items-center gap-1.5 shadow"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy C++'}</span>
                </button>
                <button
                  onClick={() => downloadTextFile(arduinoCode, 'aethertwin_lqr_firmware.ino', 'text/plain')}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] flex items-center gap-1.5 shadow"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .ino</span>
                </button>
              </div>
              <pre className="h-full max-h-[460px] p-4 rounded-lg bg-[#05070c] border border-graphite-800 text-emerald-400/90 text-[11px] overflow-y-auto leading-relaxed">
                {arduinoCode}
              </pre>
            </div>
          )}

          {/* TAB 3: ROS 2 PYTHON NODE */}
          {activeTab === 'ros2' && (
            <div className="relative h-full">
              <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
                <button
                  onClick={() => handleCopyCode(ros2Code)}
                  className="px-2.5 py-1 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 border border-graphite-700 text-[11px] flex items-center gap-1.5 shadow"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : 'Copy Python'}</span>
                </button>
                <button
                  onClick={() => downloadTextFile(ros2Code, 'aethertwin_lqr_node.py', 'text/x-python')}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[11px] flex items-center gap-1.5 shadow"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .py</span>
                </button>
              </div>
              <pre className="h-full max-h-[460px] p-4 rounded-lg bg-[#05070c] border border-graphite-800 text-blue-300 text-[11px] overflow-y-auto leading-relaxed">
                {ros2Code}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-graphite-800 flex items-center justify-between font-mono text-[10px] text-graphite-500">
          <div>Direct execution rate: 100Hz (dt = 10ms) • State vector: x = [x, v, θ, ω]</div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-graphite-800 hover:bg-graphite-750 text-graphite-200 text-xs transition"
          >
            Close Emulator
          </button>
        </div>
      </div>
    </div>
  );
};
