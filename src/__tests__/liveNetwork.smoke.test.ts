import { describe, it, expect } from 'vitest';
import { generateMuseSparkDiagnosis, MuseSparkDiagnosisInput } from '../lib/meta/museSparkClient';
import { trackBobWithSam3, VideoSegmentationRequest } from '../lib/meta/samClient';
import { POST as segmentRoute } from '../app/api/segment/route';
import { POST as diagnoseRoute } from '../app/api/diagnose/route';
import { NextRequest } from 'next/server';

describe('LIVE NETWORK INTEGRATION SMOKE TESTS (No Mocks)', () => {
  const sampleInput: MuseSparkDiagnosisInput = {
    parameters: {
      omega0Sq: 19.61,
      damping: 0.15,
      initialAngle: 0.55,
      initialVelocity: 0.0,
      length: 0.5,
      gravity: 9.81
    },
    metrics: {
      trainMaeRad: 0.005,
      trainMseRad: 0.00003,
      trainRmseRad: 0.0055,
      trainMaeDeg: 0.28,
      trainRmseDeg: 0.31,
      holdoutMaeRad: 0.008,
      holdoutMseRad: 0.00008,
      holdoutRmseRad: 0.0089,
      holdoutMaeDeg: 0.45,
      holdoutRmseDeg: 0.51,
      baselineHoldoutMaeRad: 0.35,
      baselineHoldoutRmseRad: 0.4,
      baselineHoldoutMaeDeg: 20.0,
      baselineHoldoutRmseDeg: 22.9,
      errorReductionPercent: 97.8
    },
    trainCount: 84,
    holdoutCount: 36,
    warnings: [],
    isSyntheticSample: true,
    calibratedLengthMeters: 0.5
  };

  const sampleVideoReq: VideoSegmentationRequest = {
    width: 640,
    height: 480,
    fps: 30,
    initialBobPoint: { x: 350, y: 300 },
    initialBobBox: { x: 330, y: 280, width: 40, height: 40 },
    pivot: { x: 320, y: 80 },
    videoBase64: 'data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQ=='
  };

  // --- 1. MISSING CREDENTIALS TESTS ---
  it('1. Muse Spark with missing credentials returns deterministic fallback without calling API', async () => {
    const result = await generateMuseSparkDiagnosis(sampleInput, undefined);

    expect(result.isLiveModel).toBe(false);
    expect(result.modelUsed).toContain('No API Key');
    expect(result.diagnostic.summary).toContain('Verified Damped Pendulum Twin');
    expect(result.diagnostic.dampingRegime).toBe('underdamped');
  });

  it('2. Route /api/segment with missing credentials transparently enters Demo Mode (no faked API output)', async () => {
    delete process.env.MODEL_API_KEY;
    const req = new NextRequest('http://localhost:3000/api/segment', {
      method: 'POST',
      body: JSON.stringify(sampleVideoReq)
    });

    const res = await segmentRoute(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.demoMode).toBe(true);
    expect(data.success).toBe(false);
    expect(data.message).toContain('MODEL_API_KEY');
  });

  // --- 2. LIVE NETWORK REQUESTS TO META API (UNAUTHENTICATED / REJECTED) ---
  it(
    '3. Real network request to Meta Chat Completions (api.meta.ai) receives live HTTP 401 and falls back safely',
    async () => {
      // Real call over internet to https://api.meta.ai/v1/chat/completions
      const result = await generateMuseSparkDiagnosis(sampleInput, 'unauthenticated_smoke_test_key');

      // Live endpoint returns 401 Unauthorized
      expect(result.isLiveModel).toBe(false);
      expect(result.modelUsed).toContain('API error: 401');
      expect(result.diagnostic).toBeDefined();
      expect(result.diagnostic.summary).toContain('Verified Damped Pendulum Twin');
    },
    15000
  );

  it(
    '4. Real network request to Meta Responses API (api.meta.ai) receives live HTTP 401 and throws exact status',
    async () => {
      // Real call over internet to https://api.meta.ai/v1/responses
      await expect(
        trackBobWithSam3(sampleVideoReq, 'unauthenticated_smoke_test_key')
      ).rejects.toThrow(/Meta SAM 3.1 API error \(401 Unauthorized\)/);
    },
    15000
  );

  it(
    '5. Route /api/segment handles live 401 network failure with 500 error and sanitized diagnostics',
    async () => {
      process.env.MODEL_API_KEY = 'unauthenticated_smoke_test_key';
      const req = new NextRequest('http://localhost:3000/api/segment', {
        method: 'POST',
        body: JSON.stringify(sampleVideoReq)
      });

      const res = await segmentRoute(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain('Meta SAM 3.1 API error (401 Unauthorized)');
      // Crucial: Ensure the actual key string is NEVER included in error response
      expect(JSON.stringify(data)).not.toContain('unauthenticated_smoke_test_key');
    },
    15000
  );
});
