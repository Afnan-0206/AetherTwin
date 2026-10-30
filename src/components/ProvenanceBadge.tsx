import React from 'react';
import { ProvenanceKind } from '@/lib/types';

interface ProvenanceBadgeProps {
  kind: ProvenanceKind;
  text?: string;
  className?: string;
}

export const ProvenanceBadge: React.FC<ProvenanceBadgeProps> = ({ kind, text, className = '' }) => {
  switch (kind) {
    case 'OBSERVED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[3px] text-2xs font-mono font-medium tracking-tight bg-blue-950/50 text-blue-300 border border-blue-800/50 ${className}`}
          title="Direct optical measurement extracted from camera video"
        >
          <span className="w-1.5 h-1.5 rounded-sm bg-blue-400" />
          <span>{text || 'OBSERVED'}</span>
        </span>
      );
    case 'CALCULATED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[3px] text-2xs font-mono font-medium tracking-tight bg-emerald-950/50 text-emerald-300 border border-emerald-800/50 ${className}`}
          title="Deterministic Runge-Kutta 4th-order ODE numerical solution"
        >
          <span className="w-1.5 h-1.5 rounded-sm bg-emerald-400" />
          <span>{text || 'CALCULATED'}</span>
        </span>
      );
    case 'MODEL_GENERATED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-[3px] text-2xs font-mono font-medium tracking-tight bg-amber-950/50 text-amber-300 border border-amber-800/50 ${className}`}
          title="AI diagnostic hypothesis (Muse Spark) — separated from computed ground truth"
        >
          <span className="w-1.5 h-1.5 rounded-sm bg-amber-400" />
          <span>{text || 'AI_HYPOTHESIS'}</span>
        </span>
      );
    default:
      return null;
  }
};
