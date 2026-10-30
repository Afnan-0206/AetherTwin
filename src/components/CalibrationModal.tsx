'use client';

import React, { useState } from 'react';
import { CalibrationConfig } from '@/lib/types';
import { Ruler, Check, X, AlertTriangle } from 'lucide-react';

interface CalibrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: CalibrationConfig;
  onSave: (newConfig: CalibrationConfig) => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave
}) => {
  const [pivotX, setPivotX] = useState<number>(config.pivot.x);
  const [pivotY, setPivotY] = useState<number>(config.pivot.y);
  const [knownLength, setKnownLength] = useState<string>(
    config.knownLengthMeters ? config.knownLengthMeters.toString() : ''
  );
  const [fps, setFps] = useState<number>(config.videoFps || 30);

  if (!isOpen) return null;

  const handleSave = () => {
    const parsedLength = parseFloat(knownLength);
    const newConfig: CalibrationConfig = {
      ...config,
      pivot: { x: Number(pivotX), y: Number(pivotY) },
      knownLengthMeters: !isNaN(parsedLength) && parsedLength > 0 ? parsedLength : null,
      videoFps: fps > 0 ? fps : 30
    };
    onSave(newConfig);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-graphite-900 border border-graphite-750 rounded-lg max-w-md w-full p-5 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-graphite-800">
          <div className="flex items-center gap-2 text-graphite-100 font-mono font-semibold text-sm">
            <Ruler className="w-4 h-4 text-blue-400" />
            <span>GEOMETRIC CALIBRATION</span>
          </div>
          <button
            onClick={onClose}
            className="text-graphite-400 hover:text-graphite-200 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="py-3.5 space-y-3.5 font-mono text-xs">
          <div>
            <label className="block text-graphite-300 mb-1 text-[11px]">
              Pivot Reference Coordinate (Pixels)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-[10px] text-graphite-500">X Coordinate</span>
                <input
                  type="number"
                  value={pivotX}
                  onChange={(e) => setPivotX(Number(e.target.value))}
                  className="w-full bg-graphite-950 border border-graphite-750 rounded px-2.5 py-1.5 text-graphite-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs tabular-nums"
                />
              </div>
              <div>
                <span className="text-[10px] text-graphite-500">Y Coordinate</span>
                <input
                  type="number"
                  value={pivotY}
                  onChange={(e) => setPivotY(Number(e.target.value))}
                  className="w-full bg-graphite-950 border border-graphite-750 rounded px-2.5 py-1.5 text-graphite-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs tabular-nums"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-graphite-300 mb-1 text-[11px]">
              Known Rod Length L (Meters)
            </label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 0.50 (leave empty for relative frequency space)"
              value={knownLength}
              onChange={(e) => setKnownLength(e.target.value)}
              className="w-full bg-graphite-950 border border-graphite-750 rounded px-2.5 py-1.5 text-graphite-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs"
            />
            <p className="text-[10px] text-graphite-500 mt-1">
              If unknown, the twin operates in relative frequency space (ω₀² = g/L) rather than fabricating synthetic metric precision.
            </p>
          </div>

          <div>
            <label className="block text-graphite-300 mb-1 text-[11px]">
              Video Capture Frame Rate (FPS)
            </label>
            <input
              type="number"
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
              className="w-full bg-graphite-950 border border-graphite-750 rounded px-2.5 py-1.5 text-graphite-100 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono text-xs tabular-nums"
            />
          </div>

          <div className="p-2.5 rounded bg-amber-950/20 border border-amber-500/20 text-amber-300 text-[10px] flex gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>
              Accurate calibration ensures faithful acceleration recovery. Changing pivot shifts the angular zero reference.
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-graphite-800">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-graphite-800 text-graphite-300 hover:bg-graphite-750 text-xs font-mono transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs font-mono transition flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            Apply Calibration
          </button>
        </div>
      </div>
    </div>
  );
};
