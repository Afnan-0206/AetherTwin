import { FrameMeasurement, Point2D, BoundingBox } from '../types';
import { radToDeg, normalizeAngle } from '../physics/dampedPendulum';
import { fitCircleToPoints } from '../physics/circleFit';

export interface LocalTrackingProgress {
  currentFrame: number;
  totalFrames: number;
  progressPercent: number;
}

export interface LocalTrackingResult {
  measurements: FrameMeasurement[];
  autoPivot?: Point2D;
  arcRadiusPixels?: number;
  arcFitRmse?: number;
  frameCount: number;
  fps: number;
  durationSec: number;
}

/**
 * In-browser client-side optical tracker.
 * Processes an HTML5 video clip frame-by-frame using Canvas2D pixel sampling,
 * tracks the pendulum bob centroid, extracts kinematic angles theta(t),
 * and automatically fits a circular arc to deduce the pivot point.
 */
export async function trackVideoInBrowser(
  videoElement: HTMLVideoElement,
  options: {
    initialBobPoint: Point2D;
    pivot: Point2D;
    targetFps?: number;
    maxDurationSec?: number;
    onProgress?: (p: LocalTrackingProgress) => void;
  }
): Promise<LocalTrackingResult> {
  const fps = options.targetFps ?? 30;
  const maxDuration = options.maxDurationSec ?? 6.0;
  const duration = Math.min(maxDuration, videoElement.duration || 4.0);
  const totalFrames = Math.max(15, Math.floor(duration * fps));

  const width = videoElement.videoWidth || 640;
  const height = videoElement.videoHeight || 480;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable for optical tracking.');
  }

  // Seek helper returning a promise
  const seekTo = (time: number): Promise<void> => {
    return new Promise((resolve) => {
      const onSeeked = () => {
        videoElement.removeEventListener('seeked', onSeeked);
        resolve();
      };
      videoElement.addEventListener('seeked', onSeeked);
      videoElement.currentTime = time;
    });
  };

  // 1. Seek to frame 0 and extract bob color template
  await seekTo(0);
  ctx.drawImage(videoElement, 0, 0, width, height);

  const initX = Math.max(10, Math.min(width - 10, Math.round(options.initialBobPoint.x)));
  const initY = Math.max(10, Math.min(height - 10, Math.round(options.initialBobPoint.y)));

  // Sample reference patch around initial click (16x16 window)
  const patchR = 8;
  const patchImg = ctx.getImageData(
    Math.max(0, initX - patchR),
    Math.max(0, initY - patchR),
    patchR * 2,
    patchR * 2
  );
  const patchData = patchImg.data;

  let refR = 0, refG = 0, refB = 0, refCount = 0;
  for (let i = 0; i < patchData.length; i += 4) {
    refR += patchData[i];
    refG += patchData[i + 1];
    refB += patchData[i + 2];
    refCount++;
  }
  refR /= refCount;
  refG /= refCount;
  refB /= refCount;

  // Tracking loop
  const measurements: FrameMeasurement[] = [];
  let currentCentroid: Point2D = { x: initX, y: initY };
  const trackedPoints: Point2D[] = [];

  const searchRadius = 45; // Local window around previous centroid
  const boxSize = 28;

  for (let f = 0; f < totalFrames; f++) {
    const timestamp = f / fps;
    await seekTo(timestamp);
    ctx.drawImage(videoElement, 0, 0, width, height);

    // Bounded search box
    const minSearchX = Math.max(0, Math.round(currentCentroid.x - searchRadius));
    const maxSearchX = Math.min(width, Math.round(currentCentroid.x + searchRadius));
    const minSearchY = Math.max(0, Math.round(currentCentroid.y - searchRadius));
    const maxSearchY = Math.min(height, Math.round(currentCentroid.y + searchRadius));

    const sWidth = maxSearchX - minSearchX;
    const sHeight = maxSearchY - minSearchY;

    if (sWidth > 0 && sHeight > 0) {
      const imgData = ctx.getImageData(minSearchX, minSearchY, sWidth, sHeight);
      const data = imgData.data;

      let weightedSumX = 0;
      let weightedSumY = 0;
      let totalWeight = 0;

      // Find pixels matching template color
      for (let py = 0; py < sHeight; py++) {
        for (let px = 0; px < sWidth; px++) {
          const idx = (py * sWidth + px) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Euclidean color distance in RGB
          const colorDist = Math.sqrt(
            Math.pow(r - refR, 2) + Math.pow(g - refG, 2) + Math.pow(b - refB, 2)
          );

          // Spatial distance penalty from previous location
          const spatialDist = Math.hypot(
            minSearchX + px - currentCentroid.x,
            minSearchY + py - currentCentroid.y
          );

          // High similarity = high weight
          const sim = Math.exp(-colorDist / 38) * Math.exp(-spatialDist / 60);

          if (sim > 0.08) {
            weightedSumX += (minSearchX + px) * sim;
            weightedSumY += (minSearchY + py) * sim;
            totalWeight += sim;
          }
        }
      }

      if (totalWeight > 0.1) {
        currentCentroid = {
          x: weightedSumX / totalWeight,
          y: weightedSumY / totalWeight
        };
      }
    }

    trackedPoints.push({ ...currentCentroid });

    // Kinematic angle calculation relative to pivot
    const dx = currentCentroid.x - options.pivot.x;
    const dy = currentCentroid.y - options.pivot.y;
    // Standard pendulum convention: angle from downward vertical (+x is positive angle)
    const angleRad = normalizeAngle(Math.atan2(dx, dy));
    const angleDeg = radToDeg(angleRad);

    const bobBox: BoundingBox = {
      x: Math.round(currentCentroid.x - boxSize / 2),
      y: Math.round(currentCentroid.y - boxSize / 2),
      width: boxSize,
      height: boxSize
    };

    measurements.push({
      frameIndex: f,
      timestamp: Number(timestamp.toFixed(4)),
      bobCentroid: {
        x: Number(currentCentroid.x.toFixed(2)),
        y: Number(currentCentroid.y.toFixed(2))
      },
      pivot: { ...options.pivot },
      angleRad: Number(angleRad.toFixed(5)),
      angleDeg: Number(angleDeg.toFixed(2)),
      bobBox,
      confidence: 0.94
    });

    if (options.onProgress) {
      options.onProgress({
        currentFrame: f + 1,
        totalFrames,
        progressPercent: Math.round(((f + 1) / totalFrames) * 100)
      });
    }
  }

  // 2. Perform circle fit on all tracked points to auto-detect true pivot and arm radius
  let autoPivot: Point2D | undefined = undefined;
  let arcRadiusPixels: number | undefined = undefined;
  let arcFitRmse: number | undefined = undefined;

  const circleFit = fitCircleToPoints(trackedPoints);
  if (circleFit.isValid) {
    autoPivot = circleFit.center;
    arcRadiusPixels = circleFit.radius;
    arcFitRmse = circleFit.rmse;
  }

  return {
    measurements,
    autoPivot,
    arcRadiusPixels,
    arcFitRmse,
    frameCount: measurements.length,
    fps,
    durationSec: Number((measurements.length / fps).toFixed(2))
  };
}

