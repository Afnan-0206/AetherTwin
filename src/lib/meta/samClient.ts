import {
  buildObjectPrompt,
  parseVideoStream,
  recordsOfKind,
  frameIndexOf,
  decodeMaskToSVGPath,
  SegmentationBoxRecord,
  SegmentationMaskRecord
} from '@meta-sam/parser';
import { BoundingBox, FrameMeasurement, Point2D } from '../types';
import { radToDeg } from '../physics/dampedPendulum';

export interface VideoSegmentationRequest {
  videoUrl?: string; // publicly accessible URL or pre-signed storage URL
  videoBase64?: string; // base64 encoded video
  mimeType?: string;
  width: number;
  height: number;
  fps: number;
  initialBobPoint: Point2D;
  initialBobBox?: BoundingBox;
  pivot: Point2D;
}

export interface VideoSegmentationResponse {
  success: boolean;
  demoMode: boolean;
  measurements: FrameMeasurement[];
  totalFrames: number;
  annotatedCount: number;
  modelUsed: string;
  diagnostics?: string[];
  error?: string;
}

/**
 * Server-side helper to call Meta SAM 3.1 for video segmentation and bob tracking.
 * Uses official base URL https://api.meta.ai/v1 and model ID 'sam-3.1'.
 */
export async function trackBobWithSam3(
  req: VideoSegmentationRequest,
  apiKey: string
): Promise<VideoSegmentationResponse> {
  const modelId = 'sam-3.1';
  const baseUrl = 'https://api.meta.ai/v1';

  // 1. Build official object prompt with @meta-sam/parser
  const promptBox = req.initialBobBox
    ? {
        left: Math.round(req.initialBobBox.x),
        top: Math.round(req.initialBobBox.y),
        right: Math.round(req.initialBobBox.x + req.initialBobBox.width),
        bottom: Math.round(req.initialBobBox.y + req.initialBobBox.height)
      }
    : undefined;

  const objectPromptText = buildObjectPrompt({
    size: {
      width: Math.round(req.width),
      height: Math.round(req.height)
    },
    objects: [
      {
        id: 1,
        prompts: [
          {
            frame: 0,
            box: promptBox,
            points: [
              {
                x: Math.round(req.initialBobPoint.x),
                y: Math.round(req.initialBobPoint.y),
                label: 'positive'
              }
            ]
          }
        ]
      }
    ]
  });

  // 2. Prepare payload for Meta SAM 3.1 Responses API
  const videoInput = req.videoUrl
    ? { type: 'video_url', video_url: { url: req.videoUrl } }
    : req.videoBase64
    ? {
        type: 'input_video',
        input_video: {
          data: req.videoBase64.replace(/^data:video\/[a-z0-9]+;base64,/, '').trim(),
          format:
            req.mimeType?.includes('mov') || req.mimeType?.includes('quicktime')
              ? 'mov'
              : 'mp4'
        }
      }
    : null;

  if (!videoInput) {
    throw new Error('No video URL or video data provided for SAM 3.1 segmentation.');
  }

  const payload = {
    model: modelId,
    stream: true,
    metadata: {
      include_confidence: 'true',
      propagation_direction: 'forward'
    },
    input: [
      videoInput,
      {
        type: 'text',
        text: objectPromptText
      }
    ]
  };

  const response = await fetch(`${baseUrl}/responses`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      Accept: 'text/event-stream'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Meta SAM 3.1 API error (${response.status} ${response.statusText}): ${errorBody}`
    );
  }

  if (!response.body) {
    throw new Error('Meta SAM 3.1 response has no readable stream body.');
  }

  // 3. Read SSE stream and parse with @meta-sam/parser
  async function* sseEventGenerator() {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (buffer.trim().startsWith('data: ')) {
            const dataStr = buffer.trim().slice(6);
            if (dataStr !== '[DONE]') {
              try {
                yield JSON.parse(dataStr);
              } catch {
                // Ignore parse errors on trailing fragment
              }
            }
          }
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const dataStr = trimmed.slice(6);
            if (dataStr === '[DONE]') return;
            try {
              const event = JSON.parse(dataStr);
              yield event;
            } catch {
              // Ignore non-json heartbeats
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  const parsedStream = parseVideoStream(sseEventGenerator());
  const finalResult = await parsedStream.finalResult;

  // 4. Extract boxes and masks from parsed records
  const boxRecords = recordsOfKind(finalResult.records, 'box');
  const maskRecords = recordsOfKind(finalResult.records, 'mask');

  const frameMap = new Map<
    number,
    {
      box?: SegmentationBoxRecord;
      mask?: SegmentationMaskRecord;
    }
  >();

  for (const box of boxRecords) {
    const frame = frameIndexOf(box) ?? 0;
    const existing = frameMap.get(frame) || {};
    existing.box = box;
    frameMap.set(frame, existing);
  }

  for (const mask of maskRecords) {
    const frame = frameIndexOf(mask) ?? 0;
    const existing = frameMap.get(frame) || {};
    existing.mask = mask;
    frameMap.set(frame, existing);
  }

  // 5. Build timestamped measurements
  const sortedFrames = Array.from(frameMap.keys()).sort((a, b) => a - b);
  const measurements: FrameMeasurement[] = [];

  for (const frameIdx of sortedFrames) {
    const item = frameMap.get(frameIdx)!;
    const timestamp = frameIdx / req.fps;

    let centroidX = req.initialBobPoint.x;
    let centroidY = req.initialBobPoint.y;
    let bobBox: BoundingBox | undefined;
    let maskSvg: string | undefined;
    let maskBounds: { left: number; top: number; right: number; bottom: number } | undefined;
    let confidence = 0.95;

    if (item.box) {
      centroidX = (item.box.left + item.box.right) / 2;
      centroidY = (item.box.top + item.box.bottom) / 2;
      bobBox = {
        x: item.box.left,
        y: item.box.top,
        width: item.box.right - item.box.left,
        height: item.box.bottom - item.box.top
      };
      if (item.box.confidence !== undefined) {
        confidence = item.box.confidence;
      }
    } else if (item.mask) {
      centroidX = (item.mask.bounds.left + item.mask.bounds.right) / 2;
      centroidY = (item.mask.bounds.top + item.mask.bounds.bottom) / 2;
      bobBox = {
        x: item.mask.bounds.left,
        y: item.mask.bounds.top,
        width: item.mask.bounds.right - item.mask.bounds.left,
        height: item.mask.bounds.bottom - item.mask.bounds.top
      };
      if (item.mask.confidence !== undefined) {
        confidence = item.mask.confidence;
      }
    }

    if (item.mask) {
      maskBounds = {
        left: item.mask.bounds.left,
        top: item.mask.bounds.top,
        right: item.mask.bounds.right,
        bottom: item.mask.bounds.bottom
      };
      try {
        const localSvg = decodeMaskToSVGPath(item.mask.mask);
        // Translate local raster box coordinates (0..W, 0..H) to video frame coordinates
        const left = item.mask.bounds.left;
        const top = item.mask.bounds.top;
        maskSvg = localSvg.replace(
          /([ML])\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g,
          (_, cmd, x, y) =>
            `${cmd} ${(parseFloat(x) + left).toFixed(2)} ${(parseFloat(y) + top).toFixed(2)}`
        );
      } catch (err) {
        console.warn(`[SAM 3.1] SVG mask decoding failed for frame ${frameIdx}:`, err);
      }
    }

    // Calculate angle from pivot: dx = x - xp, dy = y - yp
    const dx = centroidX - req.pivot.x;
    const dy = centroidY - req.pivot.y;
    const angleRad = Math.atan2(dx, dy); // 0 is straight down, positive clockwise
    const angleDeg = radToDeg(angleRad);

    measurements.push({
      frameIndex: frameIdx,
      timestamp: Number(timestamp.toFixed(4)),
      bobCentroid: {
        x: Number(centroidX.toFixed(2)),
        y: Number(centroidY.toFixed(2))
      },
      pivot: req.pivot,
      angleRad: Number(angleRad.toFixed(5)),
      angleDeg: Number(angleDeg.toFixed(2)),
      bobBox,
      maskSvgPath: maskSvg,
      maskBounds,
      confidence
    });
  }

  const diagnostics = finalResult.diagnostics.map((d) => `[${d.severity}] ${d.message}`);
  if (finalResult.outcome.status !== 'completed') {
    diagnostics.push(
      `[warning] SAM 3.1 stream terminated with status '${finalResult.outcome.status}' (reason: ${finalResult.outcome.reason || 'none'})`
    );
  }

  return {
    success: true,
    demoMode: false,
    measurements,
    totalFrames: sortedFrames.length,
    annotatedCount: measurements.length,
    modelUsed: modelId,
    diagnostics
  };
}
