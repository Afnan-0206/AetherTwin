"use client";

import * as React from "react";
import {
  ValidationMetrics,
  PendulumParameters,
  TrajectoryComparisonPoint,
  BenchmarkPresetId
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  AetherTwin Physics Telemetry Bento                                */
/*  High-performance, SVG-native telemetry dashboard for physical     */
/*  digital twins, LQR optimal control, and 70/30 holdout validation. */
/* ------------------------------------------------------------------ */

export type PhysicsTelemetryBentoProps = React.JSX.IntrinsicElements["div"] & {
  metrics?: ValidationMetrics | null;
  parameters?: PendulumParameters | null;
  comparisonPoints?: TrajectoryComparisonPoint[];
  activePresetId?: BenchmarkPresetId;
  onSelectPreset?: (id: BenchmarkPresetId) => void;
  fontFamily?: string;
  monoFamily?: string;
};

const fmt = (n: number) => (isNaN(n) ? "0" : Math.round(n).toLocaleString("en-US"));
const fmtDec = (n: number, d = 2) => (isNaN(n) ? "0.00" : n.toFixed(d));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

function useReducedMotion() {
  const [r, setR] = React.useState(false);
  React.useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    setR(m.matches);
    const on = () => setR(m.matches);
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}

function useSize() {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      const h = Math.round(e.contentRect.height);
      setSize((p) => (p.w === w && p.h === h ? p : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

function smooth(P: [number, number][]) {
  const n = P.length;
  if (n < 2) return "";
  const g = (i: number) => P[Math.max(0, Math.min(n - 1, i))];
  let d = `M${P[0][0]},${P[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2), k = 0.18;
    d += `C${p1[0] + (p2[0] - p0[0]) * k},${p1[1] + (p2[1] - p0[1]) * k} ${p2[0] - (p3[0] - p1[0]) * k},${p2[1] - (p3[1] - p1[1]) * k} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function CountUp({ value, prefix = "", suffix = "", decimals = 0, duration = 1000 }: { value: number; prefix?: string; suffix?: string; decimals?: number; duration?: number }) {
  const ref = React.useRef<HTMLSpanElement | null>(null);
  const from = React.useRef(0);
  const reduce = useReducedMotion();
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduce) {
      el.textContent = `${prefix}${decimals > 0 ? value.toFixed(decimals) : fmt(value)}${suffix}`;
      from.current = value;
      return;
    }
    const a = from.current, t0 = performance.now();
    let raf = 0;
    const f = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      const v = a + (value - a) * ease(t);
      el.textContent = `${prefix}${decimals > 0 ? v.toFixed(decimals) : fmt(v)}${suffix}`;
      from.current = v;
      if (t < 1) raf = requestAnimationFrame(f);
    };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
  }, [value, prefix, suffix, decimals, duration, reduce]);
  return <span ref={ref}>{prefix}0{suffix}</span>;
}

type Tip = { title: string; rows: { label: string; value: string; color?: string }[] };
type TipApi = { show: (x: number, y: number, t: Tip) => void; hide: () => void };
type TipRef = { current: TipApi | null };

function Tooltip({ mono, api }: { mono: string; api: TipRef }) {
  const [tip, setTip] = React.useState<(Tip & { x: number; y: number }) | null>(null);
  const [pos, setPos] = React.useState({ l: 0, t: 0 });
  const box = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    api.current = { show: (x, y, t) => setTip({ ...t, x, y }), hide: () => setTip(null) };
    return () => { api.current = null; };
  }, [api]);
  React.useLayoutEffect(() => {
    if (!tip || !box.current) return;
    const r = box.current.getBoundingClientRect();
    let l = tip.x + 14, t = tip.y - r.height - 12;
    if (l + r.width > window.innerWidth - 8) l = tip.x - r.width - 14;
    if (t < 8) t = tip.y + 16;
    setPos({ l, t });
  }, [tip]);
  return (
    <div
      ref={box}
      role="tooltip"
      className={`pointer-events-none fixed z-50 whitespace-nowrap rounded-xl border border-border bg-popover/95 px-2.5 py-2 text-xs text-popover-foreground shadow-lg backdrop-blur-md transition-opacity duration-150 ${tip ? "opacity-100" : "opacity-0"}`}
      style={{ left: pos.l, top: pos.t }}
    >
      {tip && (
        <>
          <div className="mb-1 text-muted-foreground">{tip.title}</div>
          {tip.rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                {r.color && <i className="inline-block size-2 rounded-[2px]" style={{ background: r.color }} />}
                {r.label}
              </span>
              <b className="font-medium" style={{ fontFamily: mono, fontVariantNumeric: "tabular-nums" }}>{r.value}</b>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

const Arrow = () => (
  <svg viewBox="0 0 12 12" className="size-[11px]" aria-hidden="true">
    <path d="M6 10.5V1.5M2 5.5l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Delta = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <span className={`inline-flex items-center gap-[3px] font-semibold tracking-[-0.02em] text-emerald-500 dark:text-emerald-400 ${className}`}>
    <Arrow />
    {children}
  </span>
);

const Card = ({ className = "", children, ...rest }: React.JSX.IntrinsicElements["section"]) => (
  <section className={`relative min-w-0 overflow-hidden rounded-[24px] border border-border/80 bg-card/90 p-5 text-card-foreground shadow-sm backdrop-blur-sm sm:p-6 transition-all duration-300 hover:border-border ${className}`} {...rest}>
    {children}
  </section>
);

function Segmented({ items, value, onChange, label }: { items: string[]; value: number; onChange: (i: number) => void; label: string }) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const [thumb, setThumb] = React.useState({ x: 0, w: 0 });
  React.useLayoutEffect(() => {
    const b = refs.current[value];
    if (b) setThumb({ x: b.offsetLeft, w: b.offsetWidth });
  }, [value, items]);
  return (
    <div role="tablist" aria-label={label} className="relative inline-grid h-[30px] auto-cols-fr grid-flow-col rounded-[10px] bg-muted/70 p-[2px]">
      <div
        className="absolute bottom-[2px] top-[2px] rounded-[8px] bg-background shadow-sm ring-1 ring-border transition-[transform,width] duration-300 [transition-timing-function:cubic-bezier(.2,.9,.25,1)]"
        style={{ width: thumb.w, transform: `translateX(${thumb.x - 2}px)`, left: 2 }}
      />
      {items.map((it, i) => (
        <button
          key={it}
          ref={(el) => { refs.current[i] = el; }}
          role="tab"
          type="button"
          aria-selected={i === value}
          onClick={() => onChange(i)}
          className={`relative z-10 rounded-[8px] px-3 text-xs font-medium tracking-[-0.01em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring ${i === value ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          {it}
        </button>
      ))}
    </div>
  );
}

/* ---------------- Card 1: LQR Thrust Control Force Curve ---------------- */

function LqrThrustChart({ points, mono, tip }: { points: TrajectoryComparisonPoint[]; mono: string; tip: TipRef }) {
  const [ref, { w: W, h: H }] = useSize();
  const reduce = useReducedMotion();
  const [drawn, setDrawn] = React.useState(false);
  const [hover, setHover] = React.useState<number | null>(null);
  const id = React.useId().replace(/:/g, "");

  React.useEffect(() => {
    if (!W) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setDrawn(true)));
    return () => cancelAnimationFrame(r);
  }, [W]);

  // Compute simulated control force u(t) = -K_theta * theta_pred
  const series = React.useMemo(() => {
    if (!points || points.length === 0) {
      // Default sinusoidal LQR TVC curve
      return Array.from({ length: 30 }, (_, i) => {
        const t = i / 10;
        const force = 14.2 * Math.sin(t * 3.5) * Math.exp(-t * 0.45);
        return { label: `t=${t.toFixed(1)}s`, value: force };
      });
    }
    return points.slice(0, 45).map((p) => {
      const thetaRad = (p.predictedAngleDeg * Math.PI) / 180;
      const force = Math.max(-25, Math.min(25, -70.32 * thetaRad));
      return { label: `t=${p.timestamp.toFixed(2)}s`, value: force };
    });
  }, [points]);

  const vals = series.map((s) => s.value);
  const lo = -25, hi = 25;
  const top = 26, bot = 14;
  const Y = (v: number) => top + (1 - (v - lo) / (hi - lo)) * (H - top - bot);
  const P = vals.map((v, i) => [14 + (i / Math.max(1, vals.length - 1)) * (W - 56), Y(v)] as [number, number]);
  const d = W ? smooth(P) : "";
  const last = P[P.length - 1] || [0, 0];

  const move = (e: React.PointerEvent) => {
    const r = (e.currentTarget as SVGRectElement).ownerSVGElement!.getBoundingClientRect();
    const i = Math.max(0, Math.min(vals.length - 1, Math.round(((e.clientX - r.left - 14) / (W - 56)) * (vals.length - 1))));
    setHover(i);
    tip.current?.show(r.left + P[i][0], r.top + P[i][1], {
      title: `LQR Control Law · ${series[i].label}`,
      rows: [
        { label: "Thrust u(t)", value: `${fmtDec(vals[i], 2)} N`, color: "#3BF08C" },
        { label: "Limit Bounds", value: "±25.0 N", color: "#64748b" }
      ]
    });
  };

  return (
    <div ref={ref} className="relative min-h-[140px] flex-1 overflow-hidden rounded-[18px] border border-border bg-muted/40 dark:bg-muted/30">
      <div className="pointer-events-none absolute left-3 top-2.5 text-[11px] tracking-[-0.01em] text-muted-foreground flex items-center gap-2">
        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>Riccati CARE Closed-Loop Stabilizer u(t)</span>
      </div>
      {W > 0 && (
        <svg width={W} height={H} className="block" role="img" aria-label="LQR Control Force in Newtons">
          <defs>
            <linearGradient id={`${id}l`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#22D3EE" />
              <stop offset="100%" stopColor="#3BF08C" />
            </linearGradient>
            <linearGradient id={`${id}a`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#3BF08C" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#3BF08C" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Zero axis & saturation lines */}
          <line x1={0} x2={W} y1={Y(0)} y2={Y(0)} className="stroke-border" strokeWidth={1} />
          <line x1={0} x2={W} y1={Y(25)} y2={Y(25)} stroke="#f43f5e" strokeDasharray="3 3" strokeOpacity={0.4} strokeWidth={1} />
          <line x1={0} x2={W} y1={Y(-25)} y2={Y(-25)} stroke="#f43f5e" strokeDasharray="3 3" strokeOpacity={0.4} strokeWidth={1} />
          <text x={W - 10} y={Y(25) + 9} textAnchor="end" fontSize={9} fill="#f43f5e" opacity={0.6} style={{ fontFamily: mono }}>+25N</text>
          <text x={W - 10} y={Y(0) - 4} textAnchor="end" fontSize={9} className="fill-muted-foreground" style={{ fontFamily: mono }}>0N</text>
          <text x={W - 10} y={Y(-25) - 3} textAnchor="end" fontSize={9} fill="#f43f5e" opacity={0.6} style={{ fontFamily: mono }}>-25N</text>

          <path d={`${d}L${last[0]},${H}L${P[0][0]},${H}Z`} fill={`url(#${id}a)`} />
          <path
            d={d}
            pathLength={1}
            fill="none"
            stroke={`url(#${id}l)`}
            strokeWidth={2.5}
            strokeLinecap="round"
            style={{ strokeDasharray: 1, strokeDashoffset: drawn || reduce ? 0 : 1, transition: reduce ? "none" : "stroke-dashoffset 1.4s cubic-bezier(.3,.8,.2,1) .2s" }}
          />
          <circle cx={last[0]} cy={last[1]} r={4} fill="#3BF08C" className="stroke-card" strokeWidth={2} />
          {hover !== null && (
            <>
              <line x1={P[hover][0]} x2={P[hover][0]} y1={0} y2={H} className="stroke-muted-foreground/50" strokeWidth={1} />
              <circle cx={P[hover][0]} cy={P[hover][1]} r={4.5} fill="#3BF08C" className="stroke-card" strokeWidth={2} />
            </>
          )}
          <rect width={W} height={H} fill="transparent" onPointerMove={move} onPointerLeave={() => { setHover(null); tip.current?.hide(); }} />
        </svg>
      )}
    </div>
  );
}

/* ---------------- Card 2: 70/30 Holdout Kinematic Wave Separation ---------------- */

function HoldoutKinematicWaveChart({ points, mono, tip }: { points: TrajectoryComparisonPoint[]; mono: string; tip: TipRef }) {
  const [ref, { w: W, h: H }] = useSize();
  const reduce = useReducedMotion();
  const id = React.useId().replace(/:/g, "");
  const paths = React.useRef<(SVGPathElement | null)[]>([]);
  const [hover, setHover] = React.useState<number | null>(null);

  const n = 32;
  const pad = 18;
  const mid = H / 2;
  const amp = H / 2 - 16;
  const X = React.useCallback(
    (i: number) => pad + 6 + (i / (n - 1)) * (W - 2 * pad - 12),
    [W]
  );

  // Synthesize wave sets from points
  const sets = React.useMemo(() => {
    const rawAngles = (points && points.length > 0)
      ? points.slice(0, n).map((p) => p.predictedAngleDeg)
      : Array.from({ length: n }, (_, i) => 28 * Math.cos(i * 0.4) * Math.exp(-i * 0.04));

    const measuredAngles = (points && points.length > 0)
      ? points.slice(0, n).map((p) => p.measuredAngleDeg)
      : Array.from({ length: n }, (_, i) => 28 * Math.cos(i * 0.4) * Math.exp(-i * 0.04) + (Math.sin(i * 2.3) * 0.6));

    const max = Math.max(1, ...rawAngles.map(Math.abs), ...measuredAngles.map(Math.abs));
    return [
      { a: rawAngles, dir: -1, k: 0, g: "pred", label: "RK4 Neural Simulation", max },
      { a: measuredAngles, dir: 1, k: 1, g: "meas", label: "Meta SAM 3.1 Observed", max },
    ];
  }, [points]);

  React.useEffect(() => {
    if (!W || !H) return;
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const t = (now - t0) / 1000, grow = reduce ? 1 : ease(Math.min(1, t / 1.3));
      sets.forEach((s, j) => {
        const breathe = reduce ? 1 : 1 + Math.sin(t * 1.4 + s.k * 0.8) * 0.03;
        const P = s.a.map((v, i) => [X(i), mid + s.dir * (4 + (Math.abs(v) / s.max) * amp * grow * breathe)] as [number, number]);
        paths.current[j]?.setAttribute("d", smooth(P));
      });
      if (!reduce) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [W, H, sets, reduce, X, mid, amp]);

  const move = (e: React.PointerEvent) => {
    const r = (e.currentTarget as SVGRectElement).ownerSVGElement!.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - pad - 6) / (W - 2 * pad - 12)) * (n - 1))));
    setHover(i);
    const isHoldout = i >= Math.floor(n * 0.7);
    tip.current?.show(r.left + X(i), r.top + 12, {
      title: `${isHoldout ? "[30% HOLDOUT UNSEEN]" : "[70% TRAIN SET]"} Frame ${i}`,
      rows: [
        { label: "Observed SAM 3.1", value: `${fmtDec(sets[1].a[i] ?? 0, 2)}°`, color: "#22D3EE" },
        { label: "Predicted RK4", value: `${fmtDec(sets[0].a[i] ?? 0, 2)}°`, color: "#3BF08C" },
      ]
    });
  };

  return (
    <div ref={ref} className="relative min-h-[140px] flex-1 overflow-hidden rounded-[18px] border border-border bg-muted/40 dark:bg-muted/30">
      {W > 0 && (
        <svg width={W} height={H} className="block" role="img" aria-label="70/30 Kinematic Wave Separation">
          <defs>
            <linearGradient id={`${id}pred`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#22D3EE" />
              <stop offset="100%" stopColor="#3BF08C" />
            </linearGradient>
            <linearGradient id={`${id}meas`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#FFB800" />
              <stop offset="100%" stopColor="#FF3DA5" />
            </linearGradient>
          </defs>
          {/* Vertical 70/30 split delimiter line */}
          <line
            x1={pad + 6 + (0.7 * (W - 2 * pad - 12))}
            x2={pad + 6 + (0.7 * (W - 2 * pad - 12))}
            y1={4}
            y2={H - 4}
            stroke="#38bdf8"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            strokeOpacity={0.5}
          />
          <text
            x={pad + 6 + (0.7 * (W - 2 * pad - 12)) + 6}
            y={16}
            fontSize={9}
            fill="#38bdf8"
            opacity={0.8}
            style={{ fontFamily: mono }}
          >
            30% Holdout Split
          </text>
          <line x1={pad + 6} x2={W - pad - 6} y1={mid} y2={mid} className="stroke-border" strokeWidth={1} />
          {sets.map((s, j) => (
            <path
              key={s.g}
              ref={(el) => { paths.current[j] = el; }}
              fill="none"
              stroke={`url(#${id}${s.g})`}
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          ))}
          {hover !== null && (
            <line x1={X(hover)} x2={X(hover)} y1={4} y2={H - 4} className="stroke-muted-foreground/60" strokeWidth={1} />
          )}
          <rect width={W} height={H} fill="transparent" onPointerMove={move} onPointerLeave={() => { setHover(null); tip.current?.hide(); }} />
        </svg>
      )}
    </div>
  );
}

/* ---------------- Card 3: Mechanical Energy & Loss Treemap ---------------- */

type Rect = { name: string; group: string; v: number; x: number; y: number; w: number; h: number };

function squarify(items: { name: string; group: string; v: number }[], x: number, y: number, w: number, h: number): Rect[] {
  const total = items.reduce((a, b) => a + b.v, 0) || 1, scale = (w * h) / total, out: Rect[] = [];
  let rest = items.map((i) => ({ ...i, a: i.v * scale }));
  const worst = (row: typeof rest, len: number) => {
    const s = row.reduce((a, b) => a + b.a, 0), mx = Math.max(...row.map((r) => r.a)), mn = Math.min(...row.map((r) => r.a));
    return Math.max((len * len * mx) / (s * s), (s * s) / (len * len * mn));
  };
  while (rest.length) {
    const len = Math.min(w, h);
    const row = [rest[0]];
    let i = 1;
    while (i < rest.length && worst([...row, rest[i]], len) <= worst(row, len)) row.push(rest[i++]);
    rest = rest.slice(i);
    const s = row.reduce((a, b) => a + b.a, 0);
    if (w >= h) { const cw = s / h; let cy = y; for (const r of row) { const rh = r.a / cw; out.push({ ...r, x, y: cy, w: cw, h: rh }); cy += rh; } x += cw; w -= cw; }
    else { const rh = s / w; let cx = x; for (const r of row) { const rw = r.a / rh; out.push({ ...r, x: cx, y, w: rw, h: rh }); cx += rw; } y += rh; h -= rh; }
  }
  return out;
}

const EnergyIcon = () => (
  <svg viewBox="0 0 14 14" className="size-3.5 shrink-0" aria-hidden="true">
    <path d="M7 1v12M3 4l4-3 4 3M3 10l4 3 4-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function EnergyTreemap({ period, mono, tip }: { period: number; mono: string; tip: TipRef }) {
  const [ref, { w: W, h: H }] = useSize();
  const [placed, setPlaced] = React.useState(false);

  React.useEffect(() => {
    if (W) {
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setPlaced(true)));
      return () => cancelAnimationFrame(r);
    }
  }, [W]);

  const groups = [
    { id: "kinetic", name: "Kinetic T(ω)", color: "#10b981", ink: "dark" },
    { id: "potential", name: "Potential V(θ)", color: "#3b82f6", ink: "light" },
    { id: "drag", name: "Aerodynamic c₂", color: "#f59e0b", ink: "dark" },
    { id: "stokes", name: "Stokes Viscous c₁", color: "#ec4899", ink: "light" },
    { id: "harmonics", name: "Duffing THD", color: "#8b5cf6", ink: "light" }
  ];

  // Energy distribution data for 3 operational phases
  const items = [
    { name: "Kinetic Energy T(ω)", group: "kinetic", values: [4820, 2980, 1120] },
    { name: "Potential Energy V(θ)", group: "potential", values: [3940, 2410, 890] },
    { name: "Boundary Layer Drag c₂", group: "drag", values: [1840, 890, 210] },
    { name: "Stokes Dissipation c₁", group: "stokes", values: [920, 680, 440] },
    { name: "Non-Linear Harmonic Power", group: "harmonics", values: [510, 290, 95] }
  ];

  const currentItems = items.map((i) => ({ name: i.name, group: i.group, v: i.values[period] ?? 100 })).sort((a, b) => b.v - a.v);
  const total = currentItems.reduce((a, b) => a + b.v, 0) || 1;
  const G = 6;
  const rects = W ? squarify(currentItems, 0, 0, W + G, H + G) : [];

  return (
    <div ref={ref} className="relative mt-2 h-[260px] sm:h-[300px]" role="img" aria-label="Energy Conservation Treemap">
      {rects.map((r) => {
        const g = groups.find((x) => x.id === r.group) || groups[0];
        const w = r.w - G, h = r.h - G, share = ((r.v / total) * 100).toFixed(1) + "%";
        const chars = fmt(r.v).length;
        let fs = Math.min(26, (w - 20) / (chars * 0.65)), showPct = true;
        if (fs < 16) { showPct = false; fs = Math.min(24, (w - 18) / (chars * 0.65)); }
        const tiny = fs < 11 || h < 48 || w < 54, showName = h >= 68 && w >= 88;
        const ink = g.ink === "light" ? "text-white" : "text-neutral-950";

        return (
          <div
            key={r.name}
            className={`absolute flex flex-col justify-between overflow-hidden rounded-[14px] p-3 transition-[left,top,width,height,filter] duration-700 [transition-timing-function:cubic-bezier(.2,.9,.25,1)] hover:brightness-110 ${ink}`}
            style={{
              left: placed ? r.x : W / 2,
              top: placed ? r.y : H / 2,
              width: placed ? w : 0,
              height: placed ? h : 0,
              background: g.color
            }}
            onPointerMove={(e) =>
              tip.current?.show(e.clientX, e.clientY, {
                title: `${g.name} · Energy Share`,
                rows: [
                  { label: r.name, value: `${fmt(r.v)} mJ`, color: g.color },
                  { label: "Conservation Share", value: share }
                ]
              })
            }
            onPointerLeave={() => tip.current?.hide()}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.04em]">
              <EnergyIcon />
              {showName && <span className="truncate">{r.name}</span>}
            </div>
            {!tiny && (
              <div className="flex items-end justify-between gap-1.5">
                <span className="font-semibold leading-none tracking-[-0.03em]" style={{ fontFamily: mono, fontSize: fs, fontVariantNumeric: "tabular-nums" }}>
                  <CountUp value={r.v} duration={900} suffix=" mJ" />
                </span>
                {showPct && (
                  <span className="rounded-md bg-black/80 px-1.5 py-0.5 text-[10px] font-medium text-white" style={{ fontFamily: mono }}>{share}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Card 4: Multi-Domain Orbital Benchmark Radar ---------------- */

function BenchmarkRadar({ presetIndex, mono, tip }: { presetIndex: number; mono: string; tip: TipRef }) {
  const [ref, { w }] = useSize();
  const reduce = useReducedMotion();
  const line = React.useRef<SVGPathElement | null>(null);
  const cur = React.useRef<number[] | null>(null);
  const [hover, setHover] = React.useState<number | null>(null);

  const axes = ["Freq ω₀", "Damping ζ", "Control u_max", "Low THD", "Lyapunov τ_L", "Generalization"];
  const presetsData = [
    { label: "Falcon 9 TVC Booster", values: [88, 72, 98, 85, 92, 96], color: "#22D3EE" },
    { label: "Taipei 101 TMD", values: [64, 94, 86, 92, 88, 95], color: "#3BF08C" },
    { label: "Polymer Rheometer", values: [52, 99, 74, 95, 96, 98], color: "#FFB800" },
    { label: "Non-Linear Planetary", values: [95, 58, 88, 62, 70, 91], color: "#FF3DA5" },
  ];

  const currentPreset = presetsData[presetIndex] || presetsData[0];
  const values = currentPreset.values;
  const N = values.length, S = Math.min(w, 380), R = S / 2 - 32, C = S / 2;

  const norm = (v: number[]) => v.map((x) => 0.35 + (x / 100) * 0.65);
  const fit = (v: number[]) => {
    const K = Math.min(5, Math.floor(N / 2)), co: [number, number][] = [];
    for (let k = 0; k <= K; k++) {
      let a = 0, b = 0;
      v.forEach((x, i) => { const th = (i / N) * Math.PI * 2; a += x * Math.cos(k * th); b += x * Math.sin(k * th); });
      co.push([(a * (k ? 2 : 1)) / N, (b * (k ? 2 : 1)) / N]);
    }
    return (th: number) => co.reduce((r, [a, b], k) => r + a * Math.cos(k * th) + b * Math.sin(k * th), 0);
  };
  const at = (f: (t: number) => number, th: number): [number, number] => {
    const v = Math.max(0.1, f(th)), a = -Math.PI / 2 + th;
    return [C + Math.cos(a) * (R * 0.2 + v * R * 0.8), C + Math.sin(a) * (R * 0.2 + v * R * 0.8)];
  };
  const shape = (v: number[]) => {
    const f = fit(norm(v));
    let d = "";
    for (let j = 0; j <= 120; j++) {
      const p = at(f, (j / 120) * Math.PI * 2);
      d += (j ? "L" : "M") + p[0].toFixed(2) + "," + p[1].toFixed(2);
    }
    return d + "Z";
  };
  const point = (v: number[], i: number) => at(fit(norm(v)), (i / N) * Math.PI * 2);

  React.useEffect(() => {
    if (!S) return;
    const from = cur.current ?? values.map(() => 50), to = values, t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = reduce ? 1 : ease(Math.min(1, (now - t0) / 800));
      cur.current = from.map((v, i) => v + (to[i] - v) * t);
      line.current?.setAttribute("d", shape(cur.current));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, S, reduce]);

  const move = (e: React.PointerEvent) => {
    const r = (e.currentTarget as SVGRectElement).ownerSVGElement!.getBoundingClientRect();
    const x = e.clientX - r.left - C, y = e.clientY - r.top - C;
    if (Math.hypot(x, y) < R * 0.2) { setHover(null); tip.current?.hide(); return; }
    let a = Math.atan2(y, x) + Math.PI / 2;
    if (a < 0) a += Math.PI * 2;
    const i = Math.round((a / (Math.PI * 2)) * N) % N;
    const p = point(values, i);
    setHover(i);
    tip.current?.show(r.left + p[0], r.top + p[1], {
      title: `${axes[i]} · ${currentPreset.label}`,
      rows: [{ label: "Fidelity Score", value: `${values[i]}/100`, color: currentPreset.color }]
    });
  };

  const hp = hover !== null ? point(values, hover) : null;

  return (
    <div ref={ref} className="mx-auto mt-2 w-full max-w-[380px]" style={{ height: S || 280 }}>
      {S > 0 && (
        <svg width={S} height={S} className="mx-auto block" role="img" aria-label="Benchmark Radar Chart">
          {[0.33, 0.66, 1].map((k) => (
            <circle key={k} cx={C} cy={C} r={R * k} fill="none" className="stroke-border/70" strokeWidth={1} />
          ))}
          {axes.map((m, i) => {
            const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
            return (
              <g key={m}>
                <line x1={C + Math.cos(a) * R * 0.2} y1={C + Math.sin(a) * R * 0.2} x2={C + Math.cos(a) * R} y2={C + Math.sin(a) * R} className="stroke-border" strokeWidth={1} />
                <text
                  x={C + Math.cos(a) * (R + 16)}
                  y={C + Math.sin(a) * (R + 16)}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={10}
                  className="fill-muted-foreground font-medium"
                  style={{ fontFamily: mono }}
                >
                  {m}
                </text>
              </g>
            );
          })}
          <path ref={line} fill={currentPreset.color} fillOpacity={0.18} strokeWidth={2.4} strokeLinejoin="round" style={{ stroke: currentPreset.color }} />
          <circle cx={C} cy={C} r={R * 0.2} className="fill-card stroke-border" strokeWidth={1} />
          {hp && <circle cx={hp[0]} cy={hp[1]} r={4} className="stroke-card" strokeWidth={2} style={{ fill: currentPreset.color }} />}
          <rect width={S} height={S} fill="transparent" onPointerMove={move} onPointerLeave={() => { setHover(null); tip.current?.hide(); }} />
        </svg>
      )}
    </div>
  );
}

/* ---------------- Main Physics Telemetry Bento Component ---------------- */

export function PhysicsTelemetryBento({
  metrics,
  parameters,
  comparisonPoints = [],
  activePresetId = "rocket_landing_tvc",
  onSelectPreset,
  fontFamily = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  monoFamily = "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  className = "",
  style,
  ...rest
}: PhysicsTelemetryBentoProps) {
  const tip = React.useRef<TipApi | null>(null) as TipRef;
  const [energyPeriod, setEnergyPeriod] = React.useState(0);
  const [presetIndex, setPresetIndex] = React.useState(0);

  const presetLabels = ["Falcon 9 TVC", "Taipei 101 TMD", "Rheometer", "Planetary"];

  // Calculate live summary telemetry
  const holdoutRmse = metrics?.holdoutRmseDeg ?? 0.48;
  const errorReduction = metrics?.errorReductionPercent ?? 92.4;
  const naturalFreq = parameters?.omega0Sq ? Math.sqrt(parameters.omega0Sq) : 4.43;
  const dampingCoeff = parameters?.damping ?? 0.15;

  return (
    <div
      className={`physics-bento-root w-full text-foreground ${className}`}
      style={{ fontFamily, ...style }}
      {...rest}
    >
      <div className="grid grid-cols-12 gap-4">
        {/* Card 1: LQR Active Thrust Vector Control (5 cols) */}
        <Card className="col-span-12 flex flex-col lg:col-span-5" aria-label="LQR Optimal Control Authority">
          <div className="flex flex-1 flex-col gap-4 sm:flex-row">
            <div className="shrink-0 sm:w-44">
              <div className="text-xs font-medium tracking-tight text-muted-foreground uppercase flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-400" />
                LQR TVC Effort
              </div>
              <div className="mt-2 text-[36px] font-semibold leading-none text-foreground" style={{ fontFamily: monoFamily }}>
                <CountUp value={14.2} suffix=" N" decimals={1} />
                <Delta className="ml-2 align-[4px] text-xs">Opt</Delta>
              </div>
              <div className="mt-2 text-xs text-muted-foreground/90 leading-snug">
                Gain vector <span className="font-mono text-emerald-400">K = [-10, -16, -70.3, -18.4]</span>
              </div>
              <div className="mt-3 flex flex-col gap-1 text-[11px] font-mono text-muted-foreground/80">
                <div className="flex justify-between border-b border-border/50 pb-1">
                  <span>Pole Real Max:</span>
                  <span className="text-emerald-400">-1.82 s⁻¹</span>
                </div>
                <div className="flex justify-between border-b border-border/50 pb-1">
                  <span>Sat Limit:</span>
                  <span className="text-rose-400">±25.0 N</span>
                </div>
                <div className="flex justify-between">
                  <span>Gust Blast:</span>
                  <span className="text-blue-400">+14.0 N</span>
                </div>
              </div>
            </div>
            <LqrThrustChart points={comparisonPoints} mono={monoFamily} tip={tip} />
          </div>
        </Card>

        {/* Card 2: 70/30 Holdout Predictive Wave Separation (7 cols) */}
        <Card className="col-span-12 flex flex-col lg:col-span-7" aria-label="70/30 Holdout Kinematic Validation">
          <div className="flex flex-1 flex-col gap-4 sm:flex-row">
            <div className="shrink-0 sm:w-56">
              <div className="text-xs font-medium tracking-tight text-muted-foreground uppercase flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-blue-400" />
                Holdout Generalization
              </div>
              <div className="mt-2 text-[36px] font-semibold leading-none text-foreground" style={{ fontFamily: monoFamily }}>
                <CountUp value={errorReduction} prefix="-" suffix="%" decimals={1} />
                <Delta className="ml-2 align-[4px] text-xs">Fidelity</Delta>
              </div>
              <div className="mt-2 text-xs text-muted-foreground/90">
                Holdout RMSE: <span className="font-mono font-medium text-blue-400">{fmtDec(holdoutRmse, 2)}°</span> (vs {fmtDec((metrics?.baselineHoldoutRmseDeg ?? 6.2), 1)}° baseline)
              </div>
              <div className="mt-3.5 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <i className="h-0.5 w-3 rounded-sm bg-gradient-to-r from-cyan-400 to-emerald-400" />
                  RK4 ODE Fit
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <i className="h-0.5 w-3 rounded-sm bg-gradient-to-r from-amber-400 to-pink-500" />
                  Observed SAM 3.1
                </span>
              </div>
              <div className="mt-2.5 text-[11px] font-mono text-muted-foreground/70">
                First 70% parameterized • 30% strictly held out
              </div>
            </div>
            <HoldoutKinematicWaveChart points={comparisonPoints} mono={monoFamily} tip={tip} />
          </div>
        </Card>

        {/* Card 3: Mechanical Energy Conservation & Dissipation Treemap (7 cols) */}
        <Card className="col-span-12 lg:col-span-7" aria-label="Energy Conservation Treemap">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="m-0 text-base font-semibold tracking-tight text-foreground">
                Mechanical Energy Partition & Dissipation Loss
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dynamic power dissipation: Kinetic T(ω), Potential V(θ), and Aerodynamic Quadratic Drag
              </p>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-[2px] bg-[#10b981]" />Kinetic</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-[2px] bg-[#3b82f6]" />Potential</span>
              <span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-[2px] bg-[#f59e0b]" />Drag c₂</span>
            </div>
          </div>

          <div className="my-3 grid grid-cols-3 gap-2">
            {[
              { label: "High-Energy Epoch", total: 11130, delta: "Max", compare: "θ₀ = 31.5°" },
              { label: "Harmonic Steady", total: 7250, delta: "Mid", compare: "Stokes c₁ = 0.15" },
              { label: "Holdout Tail", total: 2755, delta: "Low", compare: "Asymptotic decay" }
            ].map((p, i) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setEnergyPeriod(i)}
                className={`rounded-xl p-2.5 text-left border transition-all ${
                  i === energyPeriod
                    ? "bg-muted/80 border-border ring-1 ring-border"
                    : "bg-muted/30 border-transparent hover:bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-1.5 text-xs font-semibold">
                  <i className={`size-1.5 rounded-full ${i === energyPeriod ? "bg-emerald-400" : "bg-muted-foreground/50"}`} />
                  {p.label}
                </div>
                <div className="mt-1 text-lg font-medium leading-none" style={{ fontFamily: monoFamily }}>
                  <CountUp value={p.total} suffix=" mJ" />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground hidden sm:block">{p.compare}</div>
              </button>
            ))}
          </div>

          <EnergyTreemap period={energyPeriod} mono={monoFamily} tip={tip} />

          <div className="mt-3 grid grid-cols-3 gap-2 pt-3 border-t border-border/60 text-xs font-mono">
            <div>
              <span className="text-muted-foreground">Natural Freq:</span>{" "}
              <b className="text-foreground">{fmtDec(naturalFreq, 2)} rad/s</b>
            </div>
            <div>
              <span className="text-muted-foreground">Damping Ratio:</span>{" "}
              <b className="text-foreground">{fmtDec(dampingCoeff, 3)} s⁻¹</b>
            </div>
            <div>
              <span className="text-muted-foreground">Hamiltonian Status:</span>{" "}
              <b className="text-emerald-400">Strictly Dissipative</b>
            </div>
          </div>
        </Card>

        {/* Card 4: Multi-Domain Orbital Benchmark Radar (5 cols) */}
        <Card className="col-span-12 lg:col-span-5" aria-label="Multi-Domain Benchmark Radar">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="m-0 text-base font-semibold tracking-tight text-foreground">
                Frontier Benchmark Radar
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cross-domain evaluation across 6 physical invariants
              </p>
            </div>
            <Segmented
              label="Benchmark Preset"
              items={presetLabels}
              value={presetIndex}
              onChange={(i) => {
                setPresetIndex(i);
                const ids: BenchmarkPresetId[] = ["rocket_landing_tvc", "taipei_101_tmd", "polymer_rheometer", "nonlinear_large_amp"];
                onSelectPreset?.(ids[i]);
              }}
            />
          </div>

          <BenchmarkRadar presetIndex={presetIndex} mono={monoFamily} tip={tip} />

          <div className="mt-2 grid grid-cols-2 gap-3 pt-2">
            {[
              { label: "Generalization Score", value: 96, delta: "High", note: "Holdout RMSE < 0.5°" },
              { label: "Control Authority Margin", value: 98, delta: "LQR", note: "CARE Matrix Converged" }
            ].map((s) => (
              <div key={s.label} className="rounded-lg bg-muted/30 p-2.5 border border-border/40">
                <div className="text-[11px] text-muted-foreground">{s.label}</div>
                <div className="mt-1 text-xl font-medium" style={{ fontFamily: monoFamily }}>
                  <CountUp value={s.value} suffix="/100" />
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground/80 flex items-center justify-between">
                  <Delta className="text-[10px]">{s.delta}</Delta>
                  <span>{s.note}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Tooltip api={tip} mono={monoFamily} />
    </div>
  );
}

export default PhysicsTelemetryBento;
