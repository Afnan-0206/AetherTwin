import { describe, it, expect, vi } from 'vitest';
import { trackBobWithSam3, VideoSegmentationRequest } from '../lib/meta/samClient';
import { buildObjectPrompt, decodeMaskToSVGPath } from '@meta-sam/parser';

describe('Meta SAM 3.1 Integration & Streaming Parser', () => {
  const sampleRequest: VideoSegmentationRequest = {
    width: 640,
    height: 480,
    fps: 30,
    initialBobPoint: { x: 350, y: 300 },
    initialBobBox: { x: 330, y: 280, width: 40, height: 40 },
    pivot: { x: 320, y: 80 },
    videoBase64: 'data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAG1wNDJpc29tYXZjMQ=='
  };

  it('builds valid official object prompt text using @meta-sam/parser', () => {
    const promptBox = {
      left: 330,
      top: 280,
      right: 370,
      bottom: 320
    };

    const promptText = buildObjectPrompt({
      size: { width: 640, height: 480 },
      objects: [
        {
          id: 1,
          prompts: [
            {
              frame: 0,
              box: promptBox,
              points: [{ x: 350, y: 300, label: 'positive' }]
            }
          ]
        }
      ]
    });

    expect(promptText).toContain('<0f>1<|box;x1=330;y1=280;x2=369;y2=319;w=640;h=480|>');
    expect(promptText).toContain('<|point;x=350;y=300;w=640;h=480|>');
  });

  it('throws error when neither videoUrl nor videoBase64 is provided', async () => {
    const invalidReq: VideoSegmentationRequest = {
      width: 640,
      height: 480,
      fps: 30,
      initialBobPoint: { x: 350, y: 300 },
      pivot: { x: 320, y: 80 }
    };

    await expect(trackBobWithSam3(invalidReq, 'test_key')).rejects.toThrow(
      /No video URL or video data provided/
    );
  });

  it('correctly parses SSE Responses stream and translates mask coordinates to frame space', async () => {
    // Canonical SAM 3.1 output: 27x60 mask matching box (x1=211, y1=228, x2=270, y2=254)
    const streamText =
      '<0f>1<|box;x1=211;y1=228;x2=270;y2=254;w=640;h=480;c=0.98|>' +
      "<|mask;x=0;y=0;c=0.98;data=27,60,~!!!!M!0c[0o91w?q1!pIH4pPRVp2B3'7`e.ioeAf6-k/#Xd8%dX9x(|>\n" +
      '<1f>1<|box;x1=211;y1=228;x2=270;y2=254;w=640;h=480;c=0.97|>' +
      "<|mask;x=0;y=0;c=0.97;data=27,60,~!!!!M!0c[0o91w?q1!pIH4pPRVp2B3'7`e.ioeAf6-k/#Xd8%dX9x(|>\n";

    const sseChunks = [
      `data: ${JSON.stringify({
        type: 'response.output_text.delta',
        item_id: 'msg-1',
        output_index: 0,
        content_index: 0,
        delta: streamText
      })}\n\n`,
      `data: ${JSON.stringify({
        type: 'response.output_text.done',
        item_id: 'msg-1',
        output_index: 0,
        content_index: 0,
        text: streamText
      })}\n\n`,
      `data: ${JSON.stringify({ type: 'response.completed' })}\n\n`,
      'data: [DONE]\n\n'
    ];

    // Mock response body readable stream
    let chunkIndex = 0;
    const mockStream = new ReadableStream({
      pull(controller) {
        if (chunkIndex < sseChunks.length) {
          controller.enqueue(new TextEncoder().encode(sseChunks[chunkIndex++]));
        } else {
          controller.close();
        }
      }
    });

    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: mockStream
    } as any);

    try {
      const result = await trackBobWithSam3(sampleRequest, 'test_key');

      expect(result.success).toBe(true);
      expect(result.totalFrames).toBe(2);
      expect(result.measurements).toHaveLength(2);

      const f0 = result.measurements[0];
      expect(f0.frameIndex).toBe(0);
      expect(f0.bobCentroid.x).toBeCloseTo(241, 0); // (211 + 271) / 2 = 241
      expect(f0.bobCentroid.y).toBeCloseTo(241.5, 1); // (228 + 255) / 2 = 241.5
      expect(f0.bobBox).toBeDefined();
      expect(f0.bobBox?.x).toBe(211);
      expect(f0.bobBox?.y).toBe(228);
      expect(f0.maskBounds).toBeDefined();
      expect(f0.maskBounds?.left).toBe(211);
      expect(f0.maskBounds?.top).toBe(228);

      // Verify that maskSvgPath coordinates are translated to frame coordinates (around 200+) rather than 0
      expect(f0.maskSvgPath).toBeDefined();
      if (f0.maskSvgPath) {
        // SVG commands should contain coordinates >= 211
        expect(f0.maskSvgPath).toMatch(/[ML]\s*2\d\d/);
      }
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('handles provider HTTP errors cleanly', async () => {
    const originalFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      statusText: 'Too Many Requests',
      text: async () => 'Rate limit exceeded'
    } as any);

    try {
      await expect(trackBobWithSam3(sampleRequest, 'test_key')).rejects.toThrow(
        /Meta SAM 3.1 API error \(429 Too Many Requests\)/
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
