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
import { TwinArchetypeId, TWIN_ARCHETYPES } from '@/lib/physics/archetypes';
import {
  createKalmanState,
  kalmanPredict,
  kalmanUpdate,
  DEFAULT_KALMAN_CONFIG,
  KalmanState
} from '@/lib/physics/kalmanFilter';
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
  Target,
  Rocket,
  Building2,
  Binary,
  Radio,
  Orbit,
  Zap
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
  const [archetype, setArchetype] = useState<TwinArchetypeId>('single_pendulum');

  // Extended Kalman Filter (EKF) State Observer & Real-Time Noise State
  const [isKalmanActive, setIsKalmanActive] = useState<boolean>(false);
  const [isNoiseActive, setIsNoiseActive] = useState<boolean>(false);
  const [showPhasePortrait, setShowPhasePortrait] = useState<boolean>(false);
  const [kalmanState, setKalmanState] = useState<KalmanState>(() => createKalmanState([0, 0, 0.06, 0], 0.05));
  const [phaseHistory, setPhaseHistory] = useState<{ theta: number; omega: number }[]>([]);

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

  const handleSelectArchetype = (arcId: TwinArchetypeId) => {
    setArchetype(arcId);
    if (arcId === 'single_pendulum') {
      setMechanism('single');
    } else if (arcId === 'double_pendulum') {
      setMechanism('double');
      setIsSimRunning(true);
    } else {
      setMechanism('lqr');
      setIsSimRunning(true);
    }
  };

  const handleInjectDisturbance = () => {
    if (mechanism === 'single') {
      setSimState((prev) => ({
        ...prev,
        omega: prev.omega + 2.5
      }));
    } else if (mechanism === 'double') {
      setDoubleState((prev) => ({
        ...prev,
        om2: prev.om2 + 4.0
      }));
    } else {
      const mag = TWIN_ARCHETYPES[archetype]?.disturbanceMagnitude ?? 15.0;
      setLqrWindImpulse((prev) => (Math.abs(prev) > 0.1 ? -prev : mag));
    }
  };

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

  // Interactive direct manipulation dragging state
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    target: 'single_bob' | 'double_bob1' | 'double_bob2' | 'lqr_cart' | 'lqr_pole' | null;
    history: { x: number; y: number; t: number }[];
  }>({
    isDragging: false,
    target: null,
    history: []
  });
  const [hoverTarget, setHoverTarget] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState<boolean>(false);

  // Coordinate helper
  const getCanvasCoords = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }, []);

  // Pointer Down: Start Dragging
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const coords = getCanvasCoords(e);
    const pivotX = canvas.width / 2;
    const pivotY = DOUBLE_PENDULUM_PIVOT_Y;

    if (mechanism === 'single') {
      const armPx = Math.max(110, Math.min(220, 130 + lengthMeters * 50));
      const bobX = pivotX + armPx * Math.sin(activeTheta);
      const bobY = pivotY + armPx * Math.cos(activeTheta);
      const dist = Math.hypot(coords.x - bobX, coords.y - bobY);

      if (dist <= 36) {
        setHasInteracted(true);
        try {
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        } catch {}
        setDragState({
          isDragging: true,
          target: 'single_bob',
          history: [{ x: coords.x, y: coords.y, t: performance.now() }]
        });
        if (isSyncedWithVideo) {
          onToggleSync();
        }
      }
    } else if (mechanism === 'double') {
      const b1X = pivotX + DOUBLE_PENDULUM_ARM1_PX * Math.sin(doubleState.th1);
      const b1Y = pivotY + DOUBLE_PENDULUM_ARM1_PX * Math.cos(doubleState.th1);
      const b2X = b1X + DOUBLE_PENDULUM_ARM2_PX * Math.sin(doubleState.th2);
      const b2Y = b1Y + DOUBLE_PENDULUM_ARM2_PX * Math.cos(doubleState.th2);

      if (Math.hypot(coords.x - b2X, coords.y - b2Y) <= 30) {
        setHasInteracted(true);
        try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
        setDragState({
          isDragging: true,
          target: 'double_bob2',
          history: [{ x: coords.x, y: coords.y, t: performance.now() }]
        });
      } else if (Math.hypot(coords.x - b1X, coords.y - b1Y) <= 30) {
        setHasInteracted(true);
        try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
        setDragState({
          isDragging: true,
          target: 'double_bob1',
          history: [{ x: coords.x, y: coords.y, t: performance.now() }]
        });
      }
    } else if (mechanism === 'lqr') {
      const cartX = pivotX + cartPoleState.x * 120;
      const groundY = 250;
      const polePx = 110;
      const tipX = cartX + polePx * Math.sin(cartPoleState.theta);
      const tipY = groundY - polePx * Math.cos(cartPoleState.theta);

      if (Math.hypot(coords.x - tipX, coords.y - tipY) <= 32) {
        setHasInteracted(true);
        try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
        setDragState({
          isDragging: true,
          target: 'lqr_pole',
          history: [{ x: coords.x, y: coords.y, t: performance.now() }]
        });
      } else if (Math.abs(coords.x - cartX) <= 40 && Math.abs(coords.y - groundY) <= 25) {
        setHasInteracted(true);
        try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch {}
        setDragState({
          isDragging: true,
          target: 'lqr_cart',
          history: [{ x: coords.x, y: coords.y, t: performance.now() }]
        });
      }
    }
  };

  // Pointer Move: Drag or Hover
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const coords = getCanvasCoords(e);
    const pivotX = canvas.width / 2;
    const pivotY = DOUBLE_PENDULUM_PIVOT_Y;

    if (dragState.isDragging) {
      if (dragState.target === 'single_bob') {
        const newTheta = Math.atan2(coords.x - pivotX, coords.y - pivotY);
        setSimState((prev) => ({ ...prev, theta: newTheta, omega: 0 }));
        setInitialAngleDeg(radToDeg(newTheta));
        setDragState((prev) => ({
          ...prev,
          history: [...prev.history.slice(-4), { x: coords.x, y: coords.y, t: performance.now() }]
        }));
      } else if (dragState.target === 'double_bob2') {
        const b1X = pivotX + DOUBLE_PENDULUM_ARM1_PX * Math.sin(doubleState.th1);
        const b1Y = pivotY + DOUBLE_PENDULUM_ARM1_PX * Math.cos(doubleState.th1);
        const th2 = Math.atan2(coords.x - b1X, coords.y - b1Y);
        setDoubleState((prev) => ({ ...prev, th2, om2: 0 }));
      } else if (dragState.target === 'double_bob1') {
        const th1 = Math.atan2(coords.x - pivotX, coords.y - pivotY);
        setDoubleState((prev) => ({ ...prev, th1, om1: 0 }));
      } else if (dragState.target === 'lqr_pole') {
        const cartX = pivotX + cartPoleState.x * 120;
        const groundY = 250;
        const th = Math.atan2(coords.x - cartX, groundY - coords.y);
        setCartPoleState((prev) => ({ ...prev, theta: Math.max(-0.6, Math.min(0.6, th)), omega: 0 }));
      } else if (dragState.target === 'lqr_cart') {
        const newX = (coords.x - pivotX) / 120;
        setCartPoleState((prev) => ({ ...prev, x: Math.max(-1.8, Math.min(1.8, newX)), v: 0 }));
      }
    } else {
      // Hover detection
      if (mechanism === 'single') {
        const armPx = Math.max(110, Math.min(220, 130 + lengthMeters * 50));
        const bobX = pivotX + armPx * Math.sin(activeTheta);
        const bobY = pivotY + armPx * Math.cos(activeTheta);
        if (Math.hypot(coords.x - bobX, coords.y - bobY) <= 30) {
          setHoverTarget('single_bob');
          canvas.style.cursor = 'grab';
        } else {
          setHoverTarget(null);
          canvas.style.cursor = 'default';
        }
      } else if (mechanism === 'double') {
        const b1X = pivotX + DOUBLE_PENDULUM_ARM1_PX * Math.sin(doubleState.th1);
        const b1Y = pivotY + DOUBLE_PENDULUM_ARM1_PX * Math.cos(doubleState.th1);
        const b2X = b1X + DOUBLE_PENDULUM_ARM2_PX * Math.sin(doubleState.th2);
        const b2Y = b1Y + DOUBLE_PENDULUM_ARM2_PX * Math.cos(doubleState.th2);
        if (Math.hypot(coords.x - b2X, coords.y - b2Y) <= 28 || Math.hypot(coords.x - b1X, coords.y - b1Y) <= 28) {
          canvas.style.cursor = 'grab';
        } else {
          canvas.style.cursor = 'default';
        }
      } else if (mechanism === 'lqr') {
        const cartX = pivotX + cartPoleState.x * 120;
        const groundY = 250;
        const polePx = 110;
        const tipX = cartX + polePx * Math.sin(cartPoleState.theta);
        const tipY = groundY - polePx * Math.cos(cartPoleState.theta);
        if (Math.hypot(coords.x - tipX, coords.y - tipY) <= 30 || (Math.abs(coords.x - cartX) <= 35 && Math.abs(coords.y - groundY) <= 25)) {
          canvas.style.cursor = 'grab';
        } else {
          canvas.style.cursor = 'default';
        }
      }
    }
  };

  // Pointer Up: Release with computed release velocity
  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragState.isDragging) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    if (dragState.target === 'single_bob') {
      const canvas = canvasRef.current;
      const pivotX = canvas ? canvas.width / 2 : 310;
      const pivotY = DOUBLE_PENDULUM_PIVOT_Y;
      const h = dragState.history;
      let releaseOmega = 0;
      if (h.length >= 2) {
        const p1 = h[h.length - 2];
        const p2 = h[h.length - 1];
        const dt = (p2.t - p1.t) / 1000;
        if (dt > 0.005) {
          const th1 = Math.atan2(p1.x - pivotX, p1.y - pivotY);
          const th2 = Math.atan2(p2.x - pivotX, p2.y - pivotY);
          releaseOmega = Math.max(-12, Math.min(12, (th2 - th1) / dt));
        }
      }

      setSimState((prev) => ({ ...prev, omega: releaseOmega }));
      physicsAudio.updatePhysicsAudio(releaseOmega, simState.theta, 0.4);
    }

    setDragState({
      isDragging: false,
      target: null,
      history: []
    });
    setIsSimRunning(true);
  };

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
  const applyPreset = (preset: 'fitted' | 'earth' | 'moon' | 'mars' | 'jupiter' | 'viscous' | 'inverted' | 'large_amp') => {
    if (preset === 'fitted') {
      handleResetToFitted();
    } else if (preset === 'earth') {
      setGravity(9.80665);
      setDamping(0.15);
      setSimState((prev) => ({ ...prev, omega: 0 }));
    } else if (preset === 'moon') {
      setGravity(1.62);
      setDamping(0.02);
      setSimState((prev) => ({ ...prev, omega: 0 }));
    } else if (preset === 'mars') {
      setGravity(3.71);
      setDamping(0.08);
      setSimState((prev) => ({ ...prev, omega: 0 }));
    } else if (preset === 'jupiter') {
      setGravity(24.79);
      setDamping(0.35);
      setSimState((prev) => ({ ...prev, omega: 0 }));
    } else if (preset === 'viscous') {
      setDamping(1.50);
      setSimState((prev) => ({ ...prev, omega: 0 }));
    } else if (preset === 'inverted') {
      setSimState((prev) => ({ ...prev, theta: Math.PI * 0.98, omega: 0.05 }));
      setInitialAngleDeg(176.4);
    } else if (preset === 'large_amp') {
      setSimState((prev) => ({ ...prev, theta: degToRad(75), omega: 0 }));
      setInitialAngleDeg(75);
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
    if ((isSyncedWithVideo && mechanism === 'single') || !isSimRunning || dragState.isDragging) return;

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
          setPhaseHistory((prev) => [...prev.slice(-80), { theta: th, omega: om }]);

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
          setPhaseHistory((prevP) => [...prevP.slice(-80), { theta: th1, omega: om1 }]);

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

          setPhaseHistory((prevP) => [...prevP.slice(-80), { theta: st.theta, omega: st.omega }]);

          if (isKalmanActive) {
            const measNoiseX = isNoiseActive ? (Math.random() - 0.5) * 0.04 : 0;
            const measNoiseTh = isNoiseActive ? (Math.random() - 0.5) * 0.06 : 0;
            const z: [number, number] = [st.x + measNoiseX, st.theta + measNoiseTh];

            setKalmanState((prevK) => {
              const pred = kalmanPredict(prevK, lqrModel.A, lqrModel.B, st.u, dt, DEFAULT_KALMAN_CONFIG);
              return kalmanUpdate(pred, z, DEFAULT_KALMAN_CONFIG);
            });
          }

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
    dragState.isDragging,
    gravity,
    lengthMeters,
    damping,
    mechanism,
    fittedParameters,
    lqrModel,
    lqrTargetX,
    lqrWindImpulse,
    isKalmanActive,
    isNoiseActive
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

      // Direct manipulation target halo and angle badge
      if (dragState.isDragging && dragState.target === 'single_bob') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(bobX, bobY, 26, 0, Math.PI * 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Angle Callout Badge
        const degStr = `${(activeTheta * 180 / Math.PI).toFixed(1)}°`;
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(bobX - 32, bobY - 44, 64, 22);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(bobX - 32, bobY - 44, 64, 22);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`θ: ${degStr}`, bobX, bobY - 33);
        ctx.restore();
      } else if (hoverTarget === 'single_bob') {
        ctx.save();
        ctx.beginPath();
        ctx.arc(bobX, bobY, 24, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.restore();
      }

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

      // 4. Inverted Pole / Rocket Booster / Gantry Crane / Robotic Joint
      const poleArmPx = Math.max(90, Math.min(180, lengthMeters * 120));
      const polePivotX = cartX;
      const polePivotY = archetype === 'gantry_crane' ? railY : cartY - cartH / 2;

      const tipX = polePivotX + poleArmPx * Math.sin(cartPoleState.theta);
      const tipY = archetype === 'gantry_crane'
        ? polePivotY + poleArmPx * Math.cos(cartPoleState.theta)
        : polePivotY - poleArmPx * Math.cos(cartPoleState.theta);

      if (archetype === 'gantry_crane') {
        // HARBOR CRANE CONTAINER RENDERING
        ctx.save();
        // Steel hoist dual cables
        ctx.beginPath();
        ctx.moveTo(cartX - 12, railY);
        ctx.lineTo(tipX - 18, tipY);
        ctx.moveTo(cartX + 12, railY);
        ctx.lineTo(tipX + 18, tipY);
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Suspended Intermodal Shipping Container
        ctx.save();
        ctx.translate(tipX, tipY);
        ctx.rotate(cartPoleState.theta);

        const cW = 54;
        const cH = 28;
        ctx.fillStyle = '#0369a1';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(-cW / 2, 0, cW, cH, 2);
        ctx.fill();
        ctx.stroke();

        // Hazard stripes on container edges
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(-cW / 2, 0, 6, cH);
        ctx.fillRect(cW / 2 - 6, 0, 6, cH);

        // Container label
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('AETHER-ISO', 0, cH / 2 + 3);
        ctx.restore();

        // Anti-Sway trolley acceleration indicator
        if (Math.abs(cartPoleState.u) > 0.5) {
          const arrowDir = cartPoleState.u > 0 ? 1 : -1;
          ctx.beginPath();
          ctx.moveTo(cartX, railY - 18);
          ctx.lineTo(cartX + arrowDir * 24, railY - 18);
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        ctx.restore();
      } else if (archetype === 'robotic_joint') {
        // BIOMECHANICAL PROSTHETIC JOINT RENDERING
        ctx.save();
        ctx.translate(polePivotX, polePivotY);

        // Stator motor housing
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();

        ctx.rotate(cartPoleState.theta);

        // Carbon fiber prosthetic shank / blade
        ctx.fillStyle = '#0f172a';
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-4, -poleArmPx, 8, poleArmPx, [2, 2, 6, 6]);
        ctx.fill();
        ctx.stroke();

        // Blade foot / sensor end effector
        ctx.beginPath();
        ctx.arc(0, -poleArmPx, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#a855f7';
        ctx.fill();

        // Torque vector indicator arc
        const torqueMag = Math.abs(cartPoleState.u);
        if (torqueMag > 0.5) {
          ctx.beginPath();
          ctx.arc(0, 0, 22, -Math.PI / 4, Math.PI / 4, cartPoleState.u < 0);
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        ctx.restore();
      } else {
        // ROCKET BOOSTER / CART-POLE FUSELAGE
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

      // 5. Extended Kalman Filter & Sensor Noise Visualizer
      if (isKalmanActive) {
        const kHudX = width - 204;
        const kHudY = 10;
        ctx.fillStyle = 'rgba(6, 78, 59, 0.7)';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(kHudX, kHudY, 194, 48, 4);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('EKF STATE OBSERVER ACTIVE', kHudX + 8, kHudY + 14);

        ctx.fillStyle = '#a7f3d0';
        ctx.font = '8px monospace';
        ctx.fillText(
          `x̂: ${kalmanState.xHat[0].toFixed(3)}m  θ̂: ${((kalmanState.xHat[2] * 180) / Math.PI).toFixed(2)}°`,
          kHudX + 8,
          kHudY + 28
        );
        ctx.fillText(
          `Cov Tr(P): ${(kalmanState.P[0][0] + kalmanState.P[2][2]).toFixed(5)} (Stable)`,
          kHudX + 8,
          kHudY + 40
        );

        // If noisy measurement simulated, show raw optical marker vs filtered estimate
        if (isNoiseActive) {
          const noiseAngle = cartPoleState.theta + (kalmanState.residual[1] || 0.04);
          const noiseTipX = polePivotX + poleArmPx * Math.sin(noiseAngle);
          const noiseTipY = polePivotY - poleArmPx * Math.cos(noiseAngle);

          // Raw noisy optical marker
          ctx.beginPath();
          ctx.arc(noiseTipX, noiseTipY, 4, 0, 2 * Math.PI);
          ctx.fillStyle = '#f43f5e';
          ctx.fill();

          // Filtered EKF marker
          const ekfTipX = polePivotX + poleArmPx * Math.sin(kalmanState.xHat[2]);
          const ekfTipY = polePivotY - poleArmPx * Math.cos(kalmanState.xHat[2]);
          ctx.beginPath();
          ctx.arc(ekfTipX, ekfTipY, 5, 0, 2 * Math.PI);
          ctx.strokeStyle = '#34d399';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }

      // 6. Real-Time Phase Space Orbit Portrait
      if (showPhasePortrait) {
        const hudW = 124;
        const hudH = 92;
        const hudX = width - hudW - 10;
        const hudY = height - hudH - 10;

        ctx.fillStyle = 'rgba(10, 15, 26, 0.9)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(hudX, hudY, hudW, hudH, 6);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#94a3b8';
        ctx.font = '8px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('PHASE ORBIT [θ vs ω]', hudX + 8, hudY + 12);

        const centerX = hudX + hudW / 2;
        const centerY = hudY + hudH / 2 + 4;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(hudX + 6, centerY);
        ctx.lineTo(hudX + hudW - 6, centerY);
        ctx.moveTo(centerX, hudY + 16);
        ctx.lineTo(centerX, hudY + hudH - 6);
        ctx.stroke();

        if (phaseHistory.length > 1) {
          ctx.beginPath();
          phaseHistory.forEach((pt, i) => {
            const px = centerX + Math.max(-48, Math.min(48, pt.theta * 32));
            const py = centerY - Math.max(-30, Math.min(30, pt.omega * 8));
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        // Current phase state dot
        if (phaseHistory.length > 0) {
          const lastPt = phaseHistory[phaseHistory.length - 1];
          const px = centerX + Math.max(-48, Math.min(48, lastPt.theta * 32));
          const py = centerY - Math.max(-30, Math.min(30, lastPt.omega * 8));
          ctx.beginPath();
          ctx.arc(px, py, 2.5, 0, 2 * Math.PI);
          ctx.fillStyle = '#34d399';
          ctx.fill();
        }
      }
    }
  }, [
    mechanism,
    archetype,
    activeTheta,
    lengthMeters,
    doubleState,
    cartPoleState,
    lqrTargetX,
    dragState.isDragging,
    dragState.target,
    hoverTarget,
    isKalmanActive,
    isNoiseActive,
    showPhasePortrait,
    kalmanState,
    phaseHistory
  ]);

  // Energy Bar Gauges
  const maxBarEnergy = Math.max(0.01, simState.total * 1.15 || 0.5);
  const potentialPercent = Math.min(100, (simState.potential / maxBarEnergy) * 100);
  const kineticPercent = Math.min(100, (simState.kinetic / maxBarEnergy) * 100);

  return (
    <div className="flex flex-col h-full bg-graphite-900 border border-graphite-800/60 rounded-xl overflow-hidden shadow-sm">
      {/* Titlebar with Mechanism Mode & Cyber-Physical Archetypes */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-3.5 py-2.5 bg-[#0c0e15] border-b border-graphite-800/60 gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-slate-100 tracking-tight">
            Cyber-Physical Sandbox
          </span>
          <ProvenanceBadge kind="CALCULATED" text="LQR CARE SOLVER" />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {/* Cyber-Physical Archetype Selector */}
          <select
            value={archetype}
            onChange={(e) => handleSelectArchetype(e.target.value as TwinArchetypeId)}
            className="bg-graphite-900 border border-graphite-750 text-slate-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 shadow-sm cursor-pointer"
            title="Select Cyber-Physical Industrial Archetype"
          >
            <option value="single_pendulum">🔬 Lab Single Twin (SAM 3.1)</option>
            <option value="booster_tvc">🚀 Orbital Booster TVC</option>
            <option value="gantry_crane">🏗️ Harbor Crane Anti-Sway</option>
            <option value="robotic_joint">🦾 Prosthetic Knee Joint</option>
            <option value="cart_pole">⚖️ Inverted Cart-Pole</option>
            <option value="double_pendulum">🌀 Coupled Chaos Arm</option>
          </select>

          {/* Quick Disturbance Impulse Button */}
          <button
            onClick={handleInjectDisturbance}
            className="px-2 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/20 text-xs flex items-center gap-1 transition"
            title="Inject physical disturbance impulse"
          >
            <Wind className="w-3 h-3 text-amber-400" />
            <span className="hidden sm:inline">Disturbance</span>
          </button>

          {/* EKF State Observer Toggle */}
          <button
            onClick={() => setIsKalmanActive(!isKalmanActive)}
            className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition border ${
              isKalmanActive
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-medium'
                : 'bg-graphite-850 text-graphite-400 border-graphite-750 hover:text-slate-200'
            }`}
            title="Toggle real-time Extended Kalman Filter state observer"
          >
            <Radio className="w-3 h-3 text-emerald-400" />
            <span>EKF</span>
          </button>

          {/* Simulated Sensor Noise Toggle */}
          <button
            onClick={() => setIsNoiseActive(!isNoiseActive)}
            className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition border ${
              isNoiseActive
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-medium'
                : 'bg-graphite-850 text-graphite-400 border-graphite-750 hover:text-slate-200'
            }`}
            title="Simulate optical camera noise / tracking jitter"
          >
            <Zap className="w-3 h-3 text-rose-400" />
            <span className="hidden sm:inline">Noise</span>
          </button>

          {/* Phase Plane Orbit Toggle */}
          <button
            onClick={() => setShowPhasePortrait(!showPhasePortrait)}
            className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition border ${
              showPhasePortrait
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30 font-medium'
                : 'bg-graphite-850 text-graphite-400 border-graphite-750 hover:text-slate-200'
            }`}
            title="Toggle real-time Phase Plane orbit display [θ vs ω]"
          >
            <Orbit className="w-3 h-3 text-cyan-400" />
            <span className="hidden sm:inline">Phase</span>
          </button>
        </div>
      </div>

      {/* 2D Canvas Viewport */}
      <div className="relative flex-1 min-h-[300px] flex items-center justify-center bg-[#07090e] p-2 overflow-hidden select-none">
        <canvas
          ref={canvasRef}
          width={620}
          height={320}
          className="max-h-full max-w-full aspect-[620/320] object-contain rounded-lg border border-graphite-800/80 cursor-grab active:cursor-grabbing touch-none select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />

        {/* Drag Hint Tooltip */}
        {!hasInteracted && !dragState.isDragging && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-graphite-900/90 border border-graphite-750 text-xs text-graphite-300 pointer-events-none flex items-center gap-1.5 shadow-lg backdrop-blur-sm animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>Click & drag bob to set angle</span>
          </div>
        )}
      </div>

      {/* Telemetry Status Ribbon */}
      <div className="px-3.5 py-2 bg-[#0b0e15] border-t border-graphite-800/60 flex items-center justify-between text-xs font-mono">
        {mechanism === 'single' ? (
          <>
            <div className="flex items-center gap-3">
              <span className="text-graphite-400">
                θ:{' '}
                <span className="text-blue-300 font-semibold tabular-nums">
                  {radToDeg(activeTheta).toFixed(2)}°
                </span>
              </span>
              <span className="text-graphite-400">
                ω:{' '}
                <span className="text-emerald-400 font-semibold tabular-nums">
                  {simState.omega.toFixed(2)} rad/s
                </span>
              </span>
              <span className="text-graphite-400">
                E:{' '}
                <span className="text-cyan-400 font-semibold tabular-nums">
                  {simState.total.toFixed(3)} J
                </span>
              </span>
            </div>
            <button
              onClick={onToggleSync}
              className={`px-2 py-0.5 rounded text-[11px] font-sans border transition flex items-center gap-1 ${
                isSyncedWithVideo
                  ? 'bg-blue-500/15 border-blue-500/30 text-blue-300 font-medium'
                  : 'bg-graphite-800 border-graphite-750 text-graphite-400'
              }`}
            >
              <RefreshCw className="w-3 h-3" />
              <span>{isSyncedWithVideo ? 'Synced to Video' : 'Free Sandbox'}</span>
            </button>
          </>
        ) : mechanism === 'double' ? (
          <>
            <div className="flex items-center gap-3">
              <span className="text-graphite-400">
                θ₁:{' '}
                <span className="text-blue-300 font-semibold tabular-nums">
                  {radToDeg(doubleState.th1).toFixed(1)}°
                </span>
              </span>
              <span className="text-graphite-400">
                θ₂:{' '}
                <span className="text-purple-300 font-semibold tabular-nums">
                  {radToDeg(doubleState.th2).toFixed(1)}°
                </span>
              </span>
              {doubleState.th1B !== undefined && (
                <span className="text-graphite-400">
                  Δ:{' '}
                  <span className="text-amber-400 font-bold tabular-nums">
                    {doubleState.divergenceDeg}°
                  </span>
                </span>
              )}
            </div>
            <button
              onClick={triggerChaosPerturbation}
              className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 transition flex items-center gap-1 text-[11px] font-sans font-medium"
              title="Add delta0 = 0.0001 rad perturbation to observe exponential divergence"
            >
              <Shuffle className="w-3 h-3 text-purple-400" />
              <span>Perturb +0.0001 rad</span>
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="text-graphite-400">
                x:{' '}
                <span className="text-emerald-400 font-semibold tabular-nums">
                  {cartPoleState.x.toFixed(3)}m
                </span>
              </span>
              <span className="text-graphite-400">
                θ:{' '}
                <span className="text-cyan-400 font-semibold tabular-nums">
                  {radToDeg(cartPoleState.theta).toFixed(2)}°
                </span>
              </span>
              <span className="text-graphite-400">
                u:{' '}
                <span className="text-amber-400 font-bold tabular-nums">
                  {cartPoleState.u > 0 ? '+' : ''}{cartPoleState.u.toFixed(2)}N
                </span>
              </span>
            </div>
            <button
              onClick={() => setLqrWindImpulse((w) => w + 14.0)}
              className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition flex items-center gap-1 text-[11px] font-sans font-medium"
              title="Apply lateral +14N wind disturbance blast"
            >
              <Wind className="w-3 h-3 text-amber-400" />
              <span>Wind Gust +14N</span>
            </button>
          </>
        )}
      </div>

      {/* Mechanical Energy Partition Bar (Single Pendulum) */}
      {mechanism === 'single' && (
        <div className="px-3.5 py-1.5 bg-[#0e111a] border-t border-graphite-800/40 flex flex-col gap-1 select-none">
          <div className="flex justify-between text-graphite-400 text-[10px]">
            <span className="font-sans font-medium">Mechanical Energy Partition</span>
            <span className="font-mono text-graphite-300 tabular-nums">
              {simState.total.toFixed(3)} J Total
            </span>
          </div>
          <div className="w-full h-1.5 bg-graphite-800 rounded-full overflow-hidden flex">
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
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              V: {simState.potential.toFixed(3)} J ({Math.round(potentialPercent)}%)
            </span>
            <span className="text-blue-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              T: {simState.kinetic.toFixed(3)} J ({Math.round(kineticPercent)}%)
            </span>
          </div>
        </div>
      )}

      {/* Counterfactual Parameter Controls Section */}
      <div className="p-3.5 bg-[#0c0e15] border-t border-graphite-800/60 flex flex-col gap-2.5 text-xs select-none">
        <div className="flex items-center justify-between">
          <span className="text-slate-200 font-medium flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-blue-400" />
            {mechanism === 'single'
              ? 'Counterfactual Physics'
              : mechanism === 'double'
              ? 'Double Pendulum Parameters'
              : 'LQR Optimal Control Parameters'}
          </span>
          <button
            onClick={handleResetToFitted}
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
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
            onClick={() => applyPreset('earth')}
            className="px-2 py-0.5 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 border border-graphite-700/80 transition flex items-center gap-1"
          >
            <Globe className="w-2.5 h-2.5 text-emerald-400" />
            Earth 1g
          </button>
          <button
            onClick={() => applyPreset('moon')}
            className="px-2 py-0.5 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 border border-graphite-700/80 transition flex items-center gap-1"
          >
            <Globe className="w-2.5 h-2.5 text-blue-300" />
            Moon 0.16g
          </button>
          <button
            onClick={() => applyPreset('mars')}
            className="px-2 py-0.5 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 border border-graphite-700/80 transition flex items-center gap-1"
          >
            <Globe className="w-2.5 h-2.5 text-amber-400" />
            Mars 0.38g
          </button>
          <button
            onClick={() => applyPreset('viscous')}
            className="px-2 py-0.5 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 border border-graphite-700/80 transition"
          >
            Fluid (c=1.50)
          </button>
          <button
            onClick={() => applyPreset('large_amp')}
            className="px-2 py-0.5 rounded bg-graphite-800 hover:bg-graphite-750 text-graphite-200 border border-graphite-700/80 transition"
          >
            75° Non-Linear
          </button>
          <button
            onClick={() => applyPreset('inverted')}
            className="px-2 py-0.5 rounded bg-amber-950/40 hover:bg-amber-900/40 text-amber-300 border border-amber-500/30 transition font-semibold"
          >
            Invert ±180°
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
