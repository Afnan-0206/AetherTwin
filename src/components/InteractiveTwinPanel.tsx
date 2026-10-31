'use client';

import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { PendulumParameters, SimulationState } from '@/lib/types';
import { rk4Step } from '@/lib/physics/rk4';
import { calculateEnergy, radToDeg, degToRad } from '@/lib/physics/dampedPendulum';
import { rk4StepDoublePendulum, calculateDoublePendulumEnergy } from '@/lib/physics/doublePendulum';
import {
  CartPoleState,
  DEFAULT_CARTPOLE_PARAMS,
  linearizeCartPole,
  rk4StepCartPole,
  computeLqrControlForce
} from '@/lib/physics/cartPoleLqr';
import { physicsAudio } from '@/lib/audio/physicsAudio';
import {
  RotateCcw,
  Sliders,
  Activity,
  RefreshCw,
  Globe,
  Gauge,
  Flame,
  Shuffle,
  Navigation,
  Wind,
  Target
} from 'lucide-react';
import { ProvenanceBadge } from './ProvenanceBadge';

interface InteractiveTwinPanelProps {
  fittedParameters: PendulumParameters | null;
  videoSyncedAngleDeg?: number;
  isSyncedWithVideo: boolean;
  onToggleSync: () => void;
}

// Shared geometry constants for 2-DOF Double Pendulum simulation and rendering
const DOUBLE_PENDULUM_PIVOT_Y = 52;
const DOUBLE_PENDULUM_ARM1_PX = 95;
const DOUBLE_PENDULUM_ARM2_PX = 80;

export const InteractiveTwinPanel: React.FC<InteractiveTwinPanelProps> = ({
  fittedParameters,
  videoSyncedAngleDeg,
  isSyncedWithVideo,
  onToggleSync
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mechanism Mode: 1-DOF Planar vs 2-DOF Chaotic Double vs 2-DOF Inverted Cart-Pole / TVC
  const [mechanism, setMechanism] = useState<'single' | 'double' | 'lqr'>('single');

  // LQR Cart-Pole / Rocket Landing TVC state
  const [cartPoleState, setCartPoleState] = useState<CartPoleState>({
    x: 0.0,
    v: 0.0,
    theta: 0.06, // small initial tilt ~3.4 deg
    omega: 0.0,
    u: 0.0
  });
  const [lqrTargetX, setLqrTargetX] = useState<number>(0.0);
  const [lqrWindImpulse, setLqrWindImpulse] = useState<number>(0.0);

  // Single Pendulum Parameters
  const defaultGravity = fittedParameters?.gravity ?? 9.81;
  const defaultLength = fittedParameters?.length ?? 0.50;
  const defaultDamping = fittedParameters?.damping ?? 0.15;
  const defaultTheta0 = fittedParameters ? radToDeg(fittedParameters.initialAngle) : 31.5;

  const [gravity, setGravity] = useState<number>(defaultGravity);
  const [lengthMeters, setLengthMeters] = useState<number>(defaultLength);
  const [damping, setDamping] = useState<number>(defaultDamping);
  const [initialAngleDeg, setInitialAngleDeg] = useState<number>(defaultTheta0);

  // Compute analytical LQR model and optimal feedback gains
  const lqrModel = useMemo(() => {
    return linearizeCartPole({
      ...DEFAULT_CARTPOLE_PARAMS,
      poleLength: lengthMeters,
      gravity: gravity
    });
  }, [lengthMeters, gravity]);

  // Live simulation state for single twin
  const [simState, setSimState] = useState<{
    theta: number;
    omega: number;
    alpha: number;
    kinetic: number;
    potential: number;
    total: number;
  }>({
    theta: degToRad(defaultTheta0),
    omega: 0.0,
    alpha: 0.0,
    kinetic: 0.0,
    potential: 0.0,
    total: 0.0
  });

  // Double Pendulum Simulation State
  const [doubleState, setDoubleState] = useState<{
    th1: number;
    om1: number;
    th2: number;
    om2: number;
    // Perturbed shadow twin for visual chaos demonstration
    th1B?: number;
    om1B?: number;
    th2B?: number;
    om2B?: number;
    divergenceDeg: number;
    trail: { x: number; y: number }[];
  }>({
    th1: 1.3,
    om1: 0,
    th2: 1.1,
    om2: 0,
    divergenceDeg: 0,
    trail: []
  });

  const [isSimRunning, setIsSimRunning] = useState<boolean>(!isSyncedWithVideo);

  // Reset to fitted parameters
  const handleResetToFitted = useCallback(() => {
    if (!fittedParameters) return;
    const g = fittedParameters.gravity ?? 9.81;
    const L = fittedParameters.length ?? 0.50;
    const c = fittedParameters.damping;
    const th0 = radToDeg(fittedParameters.initialAngle);

    setGravity(g);
    setLengthMeters(L);
    setDamping(c);
    setInitialAngleDeg(th0);

    setSimState({
      theta: degToRad(th0),
      omega: fittedParameters.initialVelocity,
      alpha: 0,
      kinetic: 0,
      potential: 0,
      total: 0
    });
  }, [fittedParameters]);

  // Sync state if fitted parameters change
  useEffect(() => {
    if (fittedParameters) {
      handleResetToFitted();
    }
  }, [fittedParameters, handleResetToFitted]);

  // Presets
  const applyPreset = (preset: 'fitted' | 'moon' | 'jupiter' | 'viscous') => {
    if (preset === 'fitted') {
      handleResetToFitted();
    } else if (preset === 'moon') {
      setGravity(1.62);
      setDamping(0.0);
      setSimState((prev) => ({ ...prev, omega: 0 }));
    } else if (preset === 'jupiter') {
      setGravity(24.79);
      setDamping(0.35);
      setSimState((prev) => ({ ...prev, omega: 0 }));
    } else if (preset === 'viscous') {
      setDamping(1.2);
      setSimState((prev) => ({ ...prev, omega: 0 }));
    }
  };

  // Perturb double pendulum
  const triggerChaosPerturbation = () => {
    setDoubleState((prev) => ({
      ...prev,
      th1B: prev.th1 + 0.0001, // 0.0057 degrees perturbation
      om1B: prev.om1,
      th2B: prev.th2,
      om2B: prev.om2,
      divergenceDeg: 0.0057
    }));
  };

  // Real-time animation loop for free-running simulation
  useEffect(() => {
    if ((isSyncedWithVideo && mechanism === 'single') || !isSimRunning) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const elapsedSec = Math.min(0.05, (currentTime - lastTime) / 1000);
      lastTime = currentTime;

      if (mechanism === 'single') {
        setSimState((current) => {
          const omega0Sq = gravity / Math.max(0.05, lengthMeters);
          const params = {
            omega0Sq,
            damping,
            dampingQuadratic: fittedParameters?.dampingQuadratic,
            length: lengthMeters,
            gravity
          };

          const substepDt = 0.002;
          const numSubsteps = Math.max(1, Math.ceil(elapsedSec / substepDt));
          const dt = elapsedSec / numSubsteps;

          let th = current.theta;
          let om = current.omega;

          for (let i = 0; i < numSubsteps; i++) {
            const next = rk4Step(th, om, dt, params);
            th = next.theta;
            om = next.omega;
          }

          const alpha = -omega0Sq * Math.sin(th) - damping * om;
          const energy = calculateEnergy(th, om, {
            omega0Sq,
            damping,
            initialAngle: 0,
            initialVelocity: 0,
            length: lengthMeters,
            gravity
          });

          // Web Audio Sonification sync
          physicsAudio.updatePhysicsAudio(om, th, energy.total / 0.5);

          return {
            theta: th,
            omega: om,
            alpha,
            kinetic: energy.kinetic,
            potential: energy.potential,
            total: energy.total
          };
        });
      } else if (mechanism === 'double') {
        // Double pendulum simulation loop
        setDoubleState((prev) => {
          const dParams = {
            l1: 0.28,
            l2: 0.24,
            m1: 0.5,
            m2: 0.5,
            gravity,
            damping1: damping * 0.4,
            damping2: damping * 0.4
          };

          const substepDt = 0.001;
          const numSubsteps = Math.max(1, Math.ceil(elapsedSec / substepDt));
          const dt = elapsedSec / numSubsteps;

          let th1 = prev.th1;
          let om1 = prev.om1;
          let th2 = prev.th2;
          let om2 = prev.om2;

          let th1B = prev.th1B ?? th1;
          let om1B = prev.om1B ?? om1;
          let th2B = prev.th2B ?? th2;
          let om2B = prev.om2B ?? om2;

          for (let i = 0; i < numSubsteps; i++) {
            const nextA = rk4StepDoublePendulum(th1, om1, th2, om2, dt, dParams);
            th1 = nextA.theta1;
            om1 = nextA.omega1;
            th2 = nextA.theta2;
            om2 = nextA.omega2;

            if (prev.th1B !== undefined) {
              const nextB = rk4StepDoublePendulum(th1B, om1B, th2B, om2B, dt, dParams);
              th1B = nextB.theta1;
              om1B = nextB.omega1;
              th2B = nextB.theta2;
              om2B = nextB.omega2;
            }
          }

          const divRad = Math.hypot(th1 - th1B, th2 - th2B);

          // Update trail of tip bob using shared pivot and arm geometry
          const canvasWidth = canvasRef.current?.width ?? 620;
          const pivX = canvasWidth / 2;
          const pivY = DOUBLE_PENDULUM_PIVOT_Y;
          const arm1Px = DOUBLE_PENDULUM_ARM1_PX;
          const arm2Px = DOUBLE_PENDULUM_ARM2_PX;
          const tipX = pivX + arm1Px * Math.sin(th1) + arm2Px * Math.sin(th2);
          const tipY = pivY + arm1Px * Math.cos(th1) + arm2Px * Math.cos(th2);

          const nextTrail = [...prev.trail.slice(-90), { x: tipX, y: tipY }];

          // Web Audio Sonification
          physicsAudio.updatePhysicsAudio(om2, th2, 0.7);

          return {
            th1,
            om1,
            th2,
            om2,
            th1B: prev.th1B !== undefined ? th1B : undefined,
            om1B: prev.om1B !== undefined ? om1B : undefined,
            th2B: prev.th2B !== undefined ? th2B : undefined,
            om2B: prev.om2B !== undefined ? om2B : undefined,
            divergenceDeg: Number(radToDeg(divRad).toFixed(2)),
            trail: nextTrail
          };
        });
      } else if (mechanism === 'lqr') {
        setCartPoleState((prev) => {
          let st = { ...prev };
          const dt = 1 / 60;
          const subSteps = 4;
          const subDt = dt / subSteps;
          const cpParams = {
            ...DEFAULT_CARTPOLE_PARAMS,
            poleLength: lengthMeters,
            gravity: gravity
          };

          for (let s = 0; s < subSteps; s++) {
            const u =
              computeLqrControlForce(st, lqrModel.K, lqrTargetX, DEFAULT_CARTPOLE_PARAMS.maxForce) +
              lqrWindImpulse;
            st = rk4StepCartPole(st, u, subDt, cpParams);
          }

          if (Math.abs(lqrWindImpulse) > 0.05) {
            setLqrWindImpulse((w) => w * 0.88);
          }

          physicsAudio.updatePhysicsAudio(
            st.omega,
            st.theta,
            Math.min(1.0, Math.abs(st.u) / DEFAULT_CARTPOLE_PARAMS.maxForce)
          );

          return st;
        });
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(animationFrameId);
      physicsAudio.mute();
    };
  }, [
    isSyncedWithVideo,
    isSimRunning,
    gravity,
    lengthMeters,
    damping,
    mechanism,
    fittedParameters,
    lqrModel,
    lqrTargetX,
    lqrWindImpulse
  ]);

  // Determine current display angle for single pendulum
  const activeTheta = isSyncedWithVideo
    ? degToRad(videoSyncedAngleDeg ?? defaultTheta0)
    : simState.theta;

  // Render 2D Canvas (Single or Double Pendulum)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = '#07090e';
    ctx.fillRect(0, 0, width, height);

    const pivotX = width / 2;
    const pivotY = DOUBLE_PENDULUM_PIVOT_Y;

    if (mechanism === 'single') {
      const armPx = Math.max(110, Math.min(220, 130 + lengthMeters * 50));
      const bobX = pivotX + armPx * Math.sin(activeTheta);
      const bobY = pivotY + armPx * Math.cos(activeTheta);

      // Protractor graduation arc
      const protractorR = armPx + 15;
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, protractorR, Math.PI * 0.25, Math.PI * 0.75);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();

      const graduations = [-60, -45, -30, -15, 0, 15, 30, 45, 60];
      graduations.forEach((deg) => {
        const rad = Math.PI / 2 - degToRad(deg);
        const isMajor = deg % 30 === 0;
        const rInner = protractorR - (isMajor ? 8 : 4);
        const rOuter = protractorR + 2;

        const x1 = pivotX + rInner * Math.cos(rad);
        const y1 = pivotY + rInner * Math.sin(rad);
        const x2 = pivotX + rOuter * Math.cos(rad);
        const y2 = pivotY + rOuter * Math.sin(rad);

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = isMajor ? 'rgba(148, 163, 184, 0.4)' : 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();

        if (isMajor) {
          const xText = pivotX + (protractorR + 14) * Math.cos(rad);
          const yText = pivotY + (protractorR + 14) * Math.sin(rad);
          ctx.fillStyle = '#64748b';
          ctx.font = '8px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${deg > 0 ? '+' : ''}${deg}°`, xText, yText);
        }
      });

      // Vertical zero plumb line
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(pivotX, pivotY + armPx + 25);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Pendulum Rod
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(bobX, bobY);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Bob Shadow/Glow
      const bobGrad = ctx.createRadialGradient(
        bobX - 4,
        bobY - 4,
        2,
        bobX,
        bobY,
        18
      );
      bobGrad.addColorStop(0, '#bae6fd');
      bobGrad.addColorStop(0.4, '#38bdf8');
      bobGrad.addColorStop(1, '#0284c7');

      ctx.beginPath();
      ctx.arc(bobX, bobY, 16, 0, 2 * Math.PI);
      ctx.fillStyle = bobGrad;
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Pivot Mount
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 6, 0, 2 * Math.PI);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (mechanism === 'double') {
      // DOUBLE PENDULUM RENDERING
      const arm1Px = DOUBLE_PENDULUM_ARM1_PX;
      const arm2Px = DOUBLE_PENDULUM_ARM2_PX;

      const j1X = pivotX + arm1Px * Math.sin(doubleState.th1);
      const j1Y = pivotY + arm1Px * Math.cos(doubleState.th1);

      const j2X = j1X + arm2Px * Math.sin(doubleState.th2);
      const j2Y = j1Y + arm2Px * Math.cos(doubleState.th2);

      // Chaotic ribbon trail
      if (doubleState.trail.length > 2) {
        ctx.beginPath();
        ctx.moveTo(doubleState.trail[0].x, doubleState.trail[0].y);
        for (let i = 1; i < doubleState.trail.length; i++) {
          ctx.lineTo(doubleState.trail[i].x, doubleState.trail[i].y);
        }
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      // Perturbed Shadow Twin (Amber)
      if (doubleState.th1B !== undefined && doubleState.th2B !== undefined) {
        const j1BX = pivotX + arm1Px * Math.sin(doubleState.th1B);
        const j1BY = pivotY + arm1Px * Math.cos(doubleState.th1B);
        const j2BX = j1BX + arm2Px * Math.sin(doubleState.th2B);
        const j2BY = j1BY + arm2Px * Math.cos(doubleState.th2B);

        ctx.beginPath();
        ctx.moveTo(pivotX, pivotY);
        ctx.lineTo(j1BX, j1BY);
        ctx.lineTo(j2BX, j2BY);
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(j2BX, j2BY, 8, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(245, 158, 11, 0.4)';
        ctx.fill();
        ctx.strokeStyle = '#f59e0b';
        ctx.stroke();
      }

      // Arm 1
      ctx.beginPath();
      ctx.moveTo(pivotX, pivotY);
      ctx.lineTo(j1X, j1Y);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Bob 1
      ctx.beginPath();
      ctx.arc(j1X, j1Y, 11, 0, 2 * Math.PI);
      ctx.fillStyle = '#0284c7';
      ctx.fill();
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Arm 2
      ctx.beginPath();
      ctx.moveTo(j1X, j1Y);
      ctx.lineTo(j2X, j2Y);
      ctx.strokeStyle = '#a855f7';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Bob 2 (Chaotic Tip)
      ctx.beginPath();
      ctx.arc(j2X, j2Y, 13, 0, 2 * Math.PI);
      ctx.fillStyle = '#c084fc';
      ctx.fill();
      ctx.strokeStyle = '#f3e8ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Pivot
      ctx.beginPath();
      ctx.arc(pivotX, pivotY, 6, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (mechanism === 'lqr') {
      // ROCKET LANDING / CART-POLE LQR RENDERING
      const railY = 225;
      const trackLeft = 40;
      const trackRight = width - 40;
      const pxPerMeter = 140;

      // 1. Ground Track Rail
      ctx.beginPath();
      ctx.moveTo(trackLeft, railY);
      ctx.lineTo(trackRight, railY);
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Rail Distance Ticks (-1.5m to +1.5m)
      for (let m = -1.5; m <= 1.5; m += 0.5) {
        const tx = width / 2 + m * pxPerMeter;
        if (tx >= trackLeft && tx <= trackRight) {
          ctx.beginPath();
          ctx.moveTo(tx, railY - 4);
          ctx.lineTo(tx, railY + 6);
          ctx.strokeStyle = m === 0 ? '#38bdf8' : '#475569';
          ctx.lineWidth = m === 0 ? 2 : 1;
          ctx.stroke();

          ctx.fillStyle = m === 0 ? '#38bdf8' : '#64748b';
          ctx.font = '8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`${m > 0 ? '+' : ''}${m}m`, tx, railY + 16);
        }
      }

      // 2. Target Position Diamond Marker
      const targetPx = width / 2 + lqrTargetX * pxPerMeter;
      ctx.beginPath();
      ctx.moveTo(targetPx, railY - 10);
      ctx.lineTo(targetPx + 6, railY - 4);
      ctx.lineTo(targetPx, railY + 2);
      ctx.lineTo(targetPx - 6, railY - 4);
      ctx.closePath();
      ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // 3. Cart / Landing Platform Chassis
      const cartX = Math.max(trackLeft + 32, Math.min(trackRight - 32, width / 2 + cartPoleState.x * pxPerMeter));
      const cartY = railY - 14;
      const cartW = 64;
      const cartH = 22;

      // Chassis body
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(cartX - cartW / 2, cartY - cartH / 2, cartW, cartH, 4);
      ctx.fill();
      ctx.stroke();

      // Wheels
      const wheelR = 6;
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      [-18, 18].forEach((offset) => {
        ctx.beginPath();
        ctx.arc(cartX + offset, railY - wheelR, wheelR, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
      });

      // 4. Inverted Pole / Rocket Booster Body
      const poleArmPx = Math.max(90, Math.min(180, lengthMeters * 120));
      const polePivotX = cartX;
      const polePivotY = cartY - cartH / 2;

      const tipX = polePivotX + poleArmPx * Math.sin(cartPoleState.theta);
      const tipY = polePivotY - poleArmPx * Math.cos(cartPoleState.theta);

      // Rocket Booster Fuselage
      ctx.save();
      ctx.translate(polePivotX, polePivotY);
      ctx.rotate(cartPoleState.theta);

      // Main rocket body cylinder
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-5, -poleArmPx, 10, poleArmPx, [4, 4, 1, 1]);
      ctx.fill();
      ctx.stroke();

      // Grid fins near top
      ctx.fillStyle = '#475569';
      ctx.fillRect(-11, -poleArmPx + 8, 22, 3);

      // Thruster Nozzle at base
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.lineTo(6, 0);
      ctx.lineTo(4, 8);
      ctx.lineTo(-4, 8);
      ctx.closePath();
      ctx.fill();

      // Active Gimbal Thruster Flame Plume (when |u| > 0.5N)
      const forceMag = Math.abs(cartPoleState.u);
      if (forceMag > 0.5) {
        const flameLen = Math.min(35, 8 + forceMag * 1.2);
        const flameGimbal = Math.max(-0.4, Math.min(0.4, -cartPoleState.u * 0.02));

        ctx.save();
        ctx.translate(0, 8);
        ctx.rotate(flameGimbal);

        // Core flame (white/cyan)
        ctx.beginPath();
        ctx.moveTo(-3, 0);
        ctx.lineTo(3, 0);
        ctx.lineTo(0, flameLen);
        ctx.closePath();
        ctx.fillStyle = '#38bdf8';
        ctx.fill();

        // Outer glow (amber/orange)
        ctx.beginPath();
        ctx.moveTo(-5, 0);
        ctx.lineTo(5, 0);
        ctx.lineTo(0, flameLen * 1.3);
        ctx.closePath();
        ctx.fillStyle = 'rgba(249, 115, 22, 0.7)';
        ctx.fill();

        ctx.restore();
      }

      ctx.restore();

      // Gimbal Base Joint
      ctx.beginPath();
      ctx.arc(polePivotX, polePivotY, 4, 0, 2 * Math.PI);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();

      // Tip Payload Sensor
      ctx.beginPath();
      ctx.arc(tipX, tipY, 6, 0, 2 * Math.PI);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [mechanism, activeTheta, lengthMeters, doubleState, cartPoleState, lqrTargetX]);

  // Energy Bar Gauges
  const maxBarEnergy = Math.max(0.01, simState.total * 1.15 || 0.5);
  const potentialPercent = Math.min(100, (simState.potential / maxBarEnergy) * 100);
  const kineticPercent = Math.min(100, (simState.kinetic / maxBarEnergy) * 100);

  return (
    <div className="flex flex-col h-full bg-graphite-900 border border-graphite-800/60 rounded-lg overflow-hidden">
      {/* Titlebar with Mechanism Mode Toggle */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#0f1219] border-b border-graphite-800/60">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-blue-400" />
          <span className="font-mono text-xs font-semibold text-graphite-100 tracking-tight">
            DIGITAL TWIN SANDBOX
          </span>
          <ProvenanceBadge kind="CALCULATED" text="RK4 INTEGRATOR" />
        </div>

        <div className="flex items-center gap-1 font-mono text-[10px]">
          <button
            onClick={() => setMechanism('single')}
            className={`px-2 py-0.5 rounded transition ${
              mechanism === 'single'
                ? 'bg-blue-600 text-white font-semibold'
                : 'text-graphite-400 hover:text-graphite-200 bg-graphite-800'
            }`}
          >
            1-DOF Planar
          </button>
          <button
            onClick={() => {
              setMechanism('double');
              setIsSimRunning(true);
            }}
            className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
              mechanism === 'double'
                ? 'bg-purple-600 text-white font-semibold'
                : 'text-graphite-400 hover:text-graphite-200 bg-graphite-800'
            }`}
          >
            <Flame className="w-2.5 h-2.5 text-amber-300" />
            <span>2-DOF Chaos</span>
          </button>
          <button
            onClick={() => {
              setMechanism('lqr');
              setIsSimRunning(true);
            }}
            className={`px-2 py-0.5 rounded transition flex items-center gap-1 ${
              mechanism === 'lqr'
                ? 'bg-emerald-600 text-white font-semibold'
                : 'text-graphite-400 hover:text-graphite-200 bg-graphite-800'
            }`}
          >
            <Navigation className="w-2.5 h-2.5 text-emerald-300" />
            <span>Rocket LQR</span>
          </button>
        </div>
      </div>

      {/* 2D Canvas Viewport */}
      <div className="relative flex-1 min-h-[300px] flex items-center justify-center bg-[#07090e] p-2 overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          width={620}
          height={320}
          className="max-h-full max-w-full aspect-[620/320] object-contain rounded border border-graphite-800/80"
        />

        {/* Telemetry Strip Overlay */}
        {mechanism === 'single' ? (
          <div className="absolute top-3 left-3 p-2 rounded bg-graphite-950/90 backdrop-blur-sm border border-graphite-800 font-mono text-[11px] space-y-1 shadow-sm pointer-events-none">
            <div className="flex items-center justify-between gap-4 text-graphite-400 text-[10px]">
              <span>TWIN ANGLE θ</span>
              <span className="text-blue-300 font-semibold tabular-nums">
                {radToDeg(activeTheta).toFixed(2)}°
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-graphite-400 text-[10px]">
              <span>ANGULAR VELOCITY ω</span>
              <span className="text-emerald-400 font-semibold tabular-nums">
                {simState.omega.toFixed(2)} rad/s
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-graphite-400 text-[10px]">
              <span>TOTAL ENERGY</span>
              <span className="text-cyan-400 font-semibold tabular-nums">
                {simState.total.toFixed(3)} J
              </span>
            </div>
          </div>
        ) : mechanism === 'double' ? (
          <div className="absolute top-3 left-3 p-2 rounded bg-graphite-950/90 backdrop-blur-sm border border-graphite-800 font-mono text-[11px] space-y-1 shadow-sm pointer-events-none">
            <div className="flex items-center justify-between gap-4 text-graphite-400 text-[10px]">
              <span>ARM 1 θ₁</span>
              <span className="text-blue-300 font-semibold tabular-nums">
                {radToDeg(doubleState.th1).toFixed(1)}°
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-graphite-400 text-[10px]">
              <span>ARM 2 θ₂</span>
              <span className="text-purple-300 font-semibold tabular-nums">
                {radToDeg(doubleState.th2).toFixed(1)}°
              </span>
            </div>
            {doubleState.th1B !== undefined && (
              <div className="flex items-center justify-between gap-4 text-amber-400 text-[10px]">
                <span>CHAOS DIVERGENCE</span>
                <span className="font-bold tabular-nums">
                  {doubleState.divergenceDeg}°
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="absolute top-3 left-3 p-2 rounded bg-graphite-950/90 backdrop-blur-sm border border-emerald-500/30 font-mono text-[11px] space-y-1 shadow-sm pointer-events-none">
            <div className="flex items-center justify-between gap-4 text-graphite-400 text-[10px]">
              <span>CART POSITION x</span>
              <span className="text-emerald-400 font-semibold tabular-nums">
                {cartPoleState.x.toFixed(3)} m
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-graphite-400 text-[10px]">
              <span>BOOSTER TILT θ</span>
              <span className="text-cyan-400 font-semibold tabular-nums">
                {radToDeg(cartPoleState.theta).toFixed(2)}°
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-graphite-400 text-[10px]">
              <span>LQR FORCE u</span>
              <span className="text-amber-400 font-bold tabular-nums">
                {cartPoleState.u > 0 ? '+' : ''}{cartPoleState.u.toFixed(2)} N
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-graphite-400 text-[10px]">
              <span>LQR GAIN K</span>
              <span className="text-graphite-300 tabular-nums text-[9px]">
                [{lqrModel.K.map((k) => Math.round(k)).join(', ')}]
              </span>
            </div>
          </div>
        )}

        {/* Live / Video Sync Controls */}
        <div className="absolute top-3 right-3 flex items-center gap-1.5 font-mono text-[10px]">
          {mechanism === 'single' ? (
            <button
              onClick={onToggleSync}
              className={`px-2 py-1 rounded border transition flex items-center gap-1 ${
                isSyncedWithVideo
                  ? 'bg-blue-950/60 border-blue-500/40 text-blue-300'
                  : 'bg-graphite-850 border-graphite-750 text-graphite-400'
              }`}
            >
              <RefreshCw className="w-2.5 h-2.5" />
              <span>{isSyncedWithVideo ? 'SYNCED TO VIDEO' : 'FREE SANDBOX'}</span>
            </button>
          ) : mechanism === 'double' ? (
            <button
              onClick={triggerChaosPerturbation}
              className="px-2 py-1 rounded bg-purple-950/60 border border-purple-500/40 text-purple-300 hover:bg-purple-900/60 transition flex items-center gap-1 font-semibold"
              title="Add delta0 = 0.0001 rad perturbation to observe exponential divergence"
            >
              <Shuffle className="w-2.5 h-2.5 text-purple-400" />
              <span>Perturb +0.0001 rad</span>
            </button>
          ) : (
            <button
              onClick={() => setLqrWindImpulse((w) => w + 14.0)}
              className="px-2 py-1 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300 hover:bg-amber-900/60 transition flex items-center gap-1 font-semibold"
              title="Apply lateral +14N wind disturbance blast"
            >
              <Wind className="w-2.5 h-2.5 text-amber-400" />
              <span>Wind Gust +14N</span>
            </button>
          )}
        </div>

        {/* Energy Bar Gauges (Single Pendulum) */}
        {mechanism === 'single' && (
          <div className="absolute bottom-3 left-3 right-3 p-2 rounded bg-graphite-950/85 backdrop-blur-sm border border-graphite-800/80 font-mono text-[10px] space-y-1">
            <div className="flex justify-between text-graphite-400 text-[9px]">
              <span>MECHANICAL ENERGY PARTITION</span>
              <span className="text-graphite-300 tabular-nums">{simState.total.toFixed(3)} J Total</span>
            </div>
            <div className="w-full h-1.5 bg-graphite-800 rounded overflow-hidden flex">
              <div
                style={{ width: `${potentialPercent}%` }}
                className="bg-emerald-500 transition-all duration-75"
                title={`Potential: ${simState.potential.toFixed(3)} J`}
              />
              <div
                style={{ width: `${kineticPercent}%` }}
                className="bg-blue-500 transition-all duration-75"
                title={`Kinetic: ${simState.kinetic.toFixed(3)} J`}
              />
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                V: {simState.potential.toFixed(3)} J
              </span>
              <span className="text-blue-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                T: {simState.kinetic.toFixed(3)} J
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Counterfactual Parameter Controls Section */}
      <div className="p-3.5 bg-[#0f1219] border-t border-graphite-800/60 flex flex-col gap-2.5 font-mono text-xs select-none">
        <div className="flex items-center justify-between">
          <span className="text-graphite-200 font-semibold flex items-center gap-1.5 text-[11px]">
            <Sliders className="w-3 h-3 text-blue-400" />
            {mechanism === 'single'
              ? 'COUNTERFACTUAL CONTROLS'
              : mechanism === 'double'
              ? 'DOUBLE PENDULUM PARAMETERS'
              : 'ROCKET LANDING LQR PARAMETERS'}
          </span>
          <button
            onClick={handleResetToFitted}
            className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset to Fitted</span>
          </button>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap gap-1 text-[10px]">
          <button
            onClick={() => applyPreset('fitted')}
            className="px-2 py-0.5 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 border border-graphite-700/80 transition"
          >
            Fitted Twin
          </button>
          <button
            onClick={() => applyPreset('moon')}
            className="px-2 py-0.5 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 border border-graphite-700/80 transition flex items-center gap-1"
          >
            <Globe className="w-2.5 h-2.5 text-blue-300" />
            Moon (1.62 m/s²)
          </button>
          <button
            onClick={() => applyPreset('jupiter')}
            className="px-2 py-0.5 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 border border-graphite-700/80 transition"
          >
            Jupiter (24.8 m/s²)
          </button>
          <button
            onClick={() => applyPreset('viscous')}
            className="px-2 py-0.5 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 border border-graphite-700/80 transition"
          >
            Viscous (c=1.20)
          </button>
        </div>

        {/* Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
          <div>
            <div className="flex justify-between text-graphite-400 text-[11px] mb-1">
              <span>Gravity g</span>
              <span className="text-blue-300 font-semibold tabular-nums">{gravity.toFixed(2)} m/s²</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={30.0}
              step={0.1}
              value={gravity}
              onChange={(e) => setGravity(Number(e.target.value))}
              className="w-full h-1 bg-graphite-800 rounded appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-graphite-400 text-[11px] mb-1">
              <span>Damping c</span>
              <span className="text-blue-300 font-semibold tabular-nums">{damping.toFixed(3)} s⁻¹</span>
            </div>
            <input
              type="range"
              min={0.0}
              max={1.5}
              step={0.01}
              value={damping}
              onChange={(e) => setDamping(Number(e.target.value))}
              className="w-full h-1 bg-graphite-800 rounded appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-graphite-400 text-[11px] mb-1">
              <span>Length L</span>
              <span className="text-blue-300 font-semibold tabular-nums">{lengthMeters.toFixed(2)} m</span>
            </div>
            <input
              type="range"
              min={0.15}
              max={2.0}
              step={0.05}
              value={lengthMeters}
              onChange={(e) => setLengthMeters(Number(e.target.value))}
              className="w-full h-1 bg-graphite-800 rounded appearance-none cursor-pointer accent-blue-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-graphite-400 text-[11px] mb-1">
              <span>Angle θ₀</span>
              <span className="text-blue-300 font-semibold tabular-nums">{initialAngleDeg.toFixed(1)}°</span>
            </div>
            <input
              type="range"
              min={-80}
              max={80}
              step={1}
              value={initialAngleDeg}
              onChange={(e) => {
                const deg = Number(e.target.value);
                setInitialAngleDeg(deg);
                setSimState((prev) => ({
                  ...prev,
                  theta: degToRad(deg),
                  omega: 0
                }));
              }}
              className="w-full h-1 bg-graphite-800 rounded appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        </div>

        {/* LQR Specific Target Position Setpoint */}
        {mechanism === 'lqr' && (
          <div className="pt-2 border-t border-graphite-800/60">
            <div className="flex justify-between text-graphite-400 text-[11px] mb-1">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <Target className="w-3 h-3" />
                Cart Position Setpoint (x*)
              </span>
              <span className="text-emerald-300 font-semibold tabular-nums">
                {lqrTargetX > 0 ? '+' : ''}{lqrTargetX.toFixed(2)} m
              </span>
            </div>
            <input
              type="range"
              min={-1.0}
              max={1.0}
              step={0.05}
              value={lqrTargetX}
              onChange={(e) => setLqrTargetX(Number(e.target.value))}
              className="w-full h-1 bg-graphite-800 rounded appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        )}
      </div>
    </div>
  );
};
