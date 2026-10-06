import { describe, expect, it } from 'vitest';
import { FrameStats } from './frameStats';

describe('FrameStats', () => {
  it('averages fps over the last second', () => {
    const f = new FrameStats();
    for (let i = 1; i <= 120; i++) f.push(i * 16.667, 16.667);
    expect(f.fps(120 * 16.667)).toBeCloseTo(60, 0);
  });

  it('reports the worst frame of the last 5 seconds and forgets older ones', () => {
    const f = new FrameStats();
    f.push(100, 80);
    for (let t = 116; t < 4000; t += 16) f.push(t, 16);
    expect(f.worstMs(4000)).toBe(80);
    for (let t = 4000; t < 5200; t += 16) f.push(t, 16);
    expect(f.worstMs(5200)).toBe(16);
  });
});
