import { describe, expect, it } from 'vitest';
import { HERO_ANIM, initialHeroAnim, nextHeroAnim, type HeroAnim, type HeroAnimInput } from './heroAnim';

const DT = 1 / 60;
const RUN_CLIP_SPEED = 3.5;
const UP = { x: 0, y: -1 }; // facing up the screen

const input = (over: Partial<HeroAnimInput> = {}): HeroAnimInput => ({
  lost: false,
  hurt: false,
  vel: { x: 0, y: 0 },
  aim: UP,
  runClipSpeed: RUN_CLIP_SPEED,
  ...over,
});

/** Run several frames with the same input and return the last result. */
const frames = (n: number, inp: HeroAnimInput, from: HeroAnim = initialHeroAnim()) => {
  let a = from;
  for (let i = 0; i < n; i++) a = nextHeroAnim(a, inp, DT);
  return a;
};

describe('hero animation: idle and run', () => {
  it('idles when standing still', () => {
    const a = frames(3, input());
    expect(a.clip).toBe('idle');
    expect(a.rate).toBe(1);
  });

  it('runs when moving, at a rate matched to the speed so feet do not slide', () => {
    const a = frames(1, input({ vel: { x: 0, y: -RUN_CLIP_SPEED } }));
    expect(a.clip).toBe('run');
    expect(a.rate).toBeCloseTo(1);
    expect(frames(1, input({ vel: { x: 0, y: -2 * RUN_CLIP_SPEED } })).rate).toBeCloseTo(2);
  });

  it('keeps the run rate within its limits', () => {
    expect(frames(1, input({ vel: { x: 0, y: -100 } })).rate).toBe(HERO_ANIM.maxRunRate);
    expect(frames(1, input({ vel: { x: 0, y: -0.5 } })).rate).toBe(HERO_ANIM.minRunRate);
  });

  it('does not flicker between idle and run around the threshold', () => {
    const between = { x: 0, y: -(HERO_ANIM.runStart + HERO_ANIM.runStop) / 2 };
    expect(frames(1, input({ vel: between })).clip).toBe('idle'); // not yet running
    const running = frames(1, input({ vel: { x: 0, y: -5 } }));
    expect(frames(1, input({ vel: between }), running).clip).toBe('run'); // keeps running
    expect(frames(1, input({ vel: { x: 0, y: -0.1 } }), running).clip).toBe('idle');
  });

  it('runs backwards (negative rate) when moving against the facing, without strafe clips', () => {
    expect(frames(1, input({ vel: { x: 0, y: 7 } })).rate).toBeLessThan(0);
    expect(frames(1, input({ vel: { x: 7, y: 0 } })).rate).toBeGreaterThan(0); // sideways: forward run
  });

  it('keeps running backwards until clearly moving forward again', () => {
    const back = frames(1, input({ vel: { x: 0, y: 7 } }));
    // Nearly sideways but slightly backwards: stays reversed.
    expect(frames(1, input({ vel: { x: 7, y: 0.5 } }), back).rate).toBeLessThan(0);
    expect(frames(1, input({ vel: { x: 0, y: -7 } }), back).rate).toBeGreaterThan(0);
  });
});

describe('hero animation: running fast', () => {
  it('plays the run clip faster as speed grows, up to the playback limit', () => {
    const walk = frames(1, input({ vel: { x: 0, y: -7 } }));
    const fast = frames(1, input({ vel: { x: 0, y: -11.2 } }));
    expect(fast.clip).toBe('run');
    expect(fast.rate).toBeGreaterThan(walk.rate);
    expect(fast.rate).toBeCloseTo(Math.min(HERO_ANIM.maxRunRate, 11.2 / RUN_CLIP_SPEED));
    expect(frames(1, input({ vel: { x: 0, y: -40 } })).rate).toBe(HERO_ANIM.maxRunRate);
  });

  it('plays the run backwards for fast movement against the facing', () => {
    expect(frames(1, input({ vel: { x: 0, y: 11.2 } })).rate).toBeLessThan(0);
  });
});

describe('hero animation: hit and death', () => {
  it('plays the hit reaction from its first frame for hitTime, then returns to locomotion', () => {
    const moving = input({ vel: { x: 0, y: -7 } });
    const hit = frames(1, { ...moving, hurt: true });
    expect(hit.clip).toBe('hit');
    expect(hit.restart).toBe(true);
    const during = frames(Math.floor(HERO_ANIM.hitTime / DT) - 1, moving, hit);
    expect(during.clip).toBe('hit');
    expect(during.restart).toBe(false);
    expect(frames(2, moving, during).clip).toBe('run');
  });

  it('plays death once when lost, holds it, and overrides everything else', () => {
    const first = frames(1, input({ lost: true, hurt: true, vel: { x: 0, y: -11.2 } }));
    expect(first.clip).toBe('death');
    expect(first.restart).toBe(true);
    const later = frames(30, input({ lost: true }), first);
    expect(later.clip).toBe('death');
    expect(later.restart).toBe(false);
  });

  it('returns to idle when a new run starts after death', () => {
    const dead = frames(5, input({ lost: true }));
    expect(frames(1, input(), dead).clip).toBe('idle');
  });
});
