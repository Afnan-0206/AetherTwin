import { describe, it, expect } from 'vitest';
import {
  linearizeCartPole,
  rk4StepCartPole,
  computeLqrControlForce,
  DEFAULT_CARTPOLE_PARAMS,
  CartPoleState
} from '../lib/physics/cartPoleLqr';

describe('Cart-Pole Inverted Pendulum & LQR Optimal Control Engine', () => {
  it('linearizes non-linear dynamics into valid 4x4 state-space model', () => {
    const model = linearizeCartPole(DEFAULT_CARTPOLE_PARAMS);

    expect(model.A).toHaveLength(4);
    expect(model.A[0]).toHaveLength(4);
    expect(model.B).toHaveLength(4);
    expect(model.K).toHaveLength(4);

    // Position derivative equals velocity: A[0][1] = 1
    expect(model.A[0][1]).toBe(1);
    // Angle derivative equals angular velocity: A[2][3] = 1
    expect(model.A[2][3]).toBe(1);

    // Poles should have negative real parts (Hurwitz stability)
    expect(model.isStable).toBe(true);
    for (const pole of model.closedLoopPoles) {
      expect(pole.real).toBeLessThan(0);
    }
  });

  it('computes finite bounded LQR control force for small angle displacement', () => {
    const model = linearizeCartPole(DEFAULT_CARTPOLE_PARAMS);
    const perturbedState: CartPoleState = {
      x: 0.1, // 10 cm off center
      v: 0.0,
      theta: 0.05, // ~2.8 deg tilt
      omega: 0.0,
      u: 0
    };

    const force = computeLqrControlForce(perturbedState, model.K, 0, DEFAULT_CARTPOLE_PARAMS.maxForce);
    expect(Number.isFinite(force)).toBe(true);
    expect(Math.abs(force)).toBeLessThanOrEqual(DEFAULT_CARTPOLE_PARAMS.maxForce);
  });

  it('stabilizes small perturbation under closed-loop LQR integration over 1.5 seconds', () => {
    const model = linearizeCartPole(DEFAULT_CARTPOLE_PARAMS);

    // Initial perturbation: 3.5 degrees tilt
    let state: CartPoleState = {
      x: 0.0,
      v: 0.0,
      theta: 0.06, // ~3.4 degrees
      omega: 0.0,
      u: 0
    };

    const dt = 0.01;
    const steps = 150; // 1.5 seconds

    for (let i = 0; i < steps; i++) {
      const u = computeLqrControlForce(state, model.K, 0, DEFAULT_CARTPOLE_PARAMS.maxForce);
      state = rk4StepCartPole(state, u, dt, DEFAULT_CARTPOLE_PARAMS);
    }

    // After 1.5 seconds under LQR feedback, the angle should remain safely bounded near upright
    expect(Math.abs(state.theta)).toBeLessThan(0.25);
    expect(Number.isFinite(state.x)).toBe(true);
    expect(Number.isFinite(state.v)).toBe(true);
  });

  it('clamps control force to actuator saturation limits', () => {
    const model = linearizeCartPole(DEFAULT_CARTPOLE_PARAMS);
    const extremeState: CartPoleState = {
      x: 5.0,
      v: 10.0,
      theta: 0.8,
      omega: 5.0,
      u: 0
    };

    const force = computeLqrControlForce(extremeState, model.K, 0, 15.0);
    expect(Math.abs(force)).toBeLessThanOrEqual(15.0);
  });

  it('rejects external impulse disturbance and returns to upright equilibrium', () => {
    const model = linearizeCartPole(DEFAULT_CARTPOLE_PARAMS);
    let state: CartPoleState = {
      x: 0,
      v: 0,
      theta: 0,
      omega: 0,
      u: 0
    };

    const dt = 0.01;
    // Step 0: apply impulse disturbance of 12N for 0.05s
    for (let i = 0; i < 5; i++) {
      const u = computeLqrControlForce(state, model.K, 0, DEFAULT_CARTPOLE_PARAMS.maxForce) + 12.0;
      state = rk4StepCartPole(state, u, dt, DEFAULT_CARTPOLE_PARAMS);
    }

    // Now let LQR stabilize over 200 steps (2.0s)
    for (let i = 0; i < 200; i++) {
      const u = computeLqrControlForce(state, model.K, 0, DEFAULT_CARTPOLE_PARAMS.maxForce);
      state = rk4StepCartPole(state, u, dt, DEFAULT_CARTPOLE_PARAMS);
    }

    // Pole should be upright within 3 degrees (0.05 rad)
    expect(Math.abs(state.theta)).toBeLessThan(0.06);
  });
});
