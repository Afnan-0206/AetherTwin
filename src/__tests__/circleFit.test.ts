import { describe, it, expect } from 'vitest';
import { fitCircleToPoints } from '../lib/physics/circleFit';
import { Point2D } from '../lib/types';

describe('Circle Fit (Kåsa Method) & Pivot Identification', () => {
  it('accurately recovers the true circle center and radius from circular arc points', () => {
    const trueXc = 320;
    const trueYc = 70;
    const trueRadius = 250;

    // Generate points along an arc from -45 deg to +45 deg
    const points: Point2D[] = [];
    for (let deg = -45; deg <= 45; deg += 5) {
      const rad = (deg * Math.PI) / 180;
      const x = trueXc + trueRadius * Math.sin(rad);
      const y = trueYc + trueRadius * Math.cos(rad);
      points.push({ x, y });
    }

    const fit = fitCircleToPoints(points);

    expect(fit.isValid).toBe(true);
    expect(fit.center.x).toBeCloseTo(trueXc, 0);
    expect(fit.center.y).toBeCloseTo(trueYc, 0);
    expect(fit.radius).toBeCloseTo(trueRadius, 0);
    expect(fit.rmse).toBeLessThan(0.01);
  });

  it('handles sensor noise and computes accurate RMSE', () => {
    const trueXc = 200;
    const trueYc = 100;
    const trueRadius = 150;

    const points: Point2D[] = [];
    for (let i = 0; i < 20; i++) {
      const angle = (i / 19) * Math.PI * 0.6 + 0.2; // arc
      // add small noise
      const noise = ((i % 3) - 1) * 0.5;
      const r = trueRadius + noise;
      points.push({
        x: trueXc + r * Math.sin(angle),
        y: trueYc + r * Math.cos(angle)
      });
    }

    const fit = fitCircleToPoints(points);

    expect(fit.isValid).toBe(true);
    expect(Math.abs(fit.center.x - trueXc)).toBeLessThan(2.0);
    expect(Math.abs(fit.center.y - trueYc)).toBeLessThan(2.0);
    expect(Math.abs(fit.radius - trueRadius)).toBeLessThan(2.0);
    expect(fit.rmse).toBeGreaterThan(0);
  });

  it('rejects insufficient points (<5)', () => {
    const points: Point2D[] = [
      { x: 10, y: 10 },
      { x: 20, y: 20 }
    ];
    const fit = fitCircleToPoints(points);
    expect(fit.isValid).toBe(false);
  });
});

