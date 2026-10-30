import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST as segmentRoute } from '../app/api/segment/route';
import { POST as diagnoseRoute } from '../app/api/diagnose/route';
import { NextRequest } from 'next/server';

describe('Server API Routes (/api/segment & /api/diagnose)', () => {
  const originalEnv = process.env.MODEL_API_KEY;

  beforeEach(() => {
    delete process.env.MODEL_API_KEY;
  });

  afterEach(() => {
    process.env.MODEL_API_KEY = originalEnv;
  });

  it('/api/segment returns 400 for invalid/empty request payload', async () => {
    const req = new NextRequest('http://localhost:3000/api/segment', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const res = await segmentRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('required');
  });

  it('/api/segment returns 200 with demoMode: true when MODEL_API_KEY is omitted', async () => {
    const req = new NextRequest('http://localhost:3000/api/segment', {
      method: 'POST',
      body: JSON.stringify({
        width: 640,
        height: 480,
        fps: 30,
        pivot: { x: 320, y: 80 },
        initialBobPoint: { x: 350, y: 300 }
      })
    });

    const res = await segmentRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.demoMode).toBe(true);
    expect(data.success).toBe(false);
    expect(data.message).toContain('Demo Mode');
  });

  it('/api/diagnose returns 400 for empty or missing parameters/metrics', async () => {
    const req = new NextRequest('http://localhost:3000/api/diagnose', {
      method: 'POST',
      body: JSON.stringify({})
    });

    const res = await diagnoseRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('parameters and metrics are required');
  });

  it('/api/diagnose returns 400 for NaN or invalid numeric parameters', async () => {
    const req = new NextRequest('http://localhost:3000/api/diagnose', {
      method: 'POST',
      body: JSON.stringify({
        parameters: { omega0Sq: 'not-a-number', damping: null },
        metrics: { holdoutRmseDeg: 0.5 }
      })
    });

    const res = await diagnoseRoute(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('valid numeric');
  });

  it('/api/diagnose returns 200 with local fallback diagnostic when MODEL_API_KEY is omitted', async () => {
    const req = new NextRequest('http://localhost:3000/api/diagnose', {
      method: 'POST',
      body: JSON.stringify({
        parameters: {
          omega0Sq: 19.61,
          damping: 0.15,
          initialAngle: 0.55,
          initialVelocity: 0.0
        },
        metrics: {
          holdoutRmseDeg: 0.52,
          baselineHoldoutRmseDeg: 24.1,
          errorReductionPercent: 97.8
        },
        trainCount: 84,
        holdoutCount: 36,
        warnings: [],
        isSyntheticSample: true,
        calibratedLengthMeters: 0.5
      })
    });

    const res = await diagnoseRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isLiveModel).toBe(false);
    expect(data.modelUsed).toContain('No API Key');
    expect(data.diagnostic).toBeDefined();
    expect(data.diagnostic.summary).toContain('Verified Damped Pendulum Twin');
  });
});
