// Which clip the hero plays, how fast, and how far it leans: derived from sim state only.
// Pure logic (no Three.js) so it can be unit tested; src/render/hero.ts applies it to the model.

import type { Vec2 } from '../sim/types';

export type HeroClip = 'idle' | 'run' | 'hit' | 'death';

/** Render-only animation feel values. */
export const HERO_ANIM = {
  /** Speeds (m/s) that switch idle to run and back. The gap stops flicker. */
  runStart: 0.4,
  runStop: 0.2,
  /** Seconds the hit reaction plays (length of the HitReact clip). */
  hitTime: 0.42,
  /** Run playback rate limits, so very slow or very fast movement stays readable. */
  minRunRate: 0.4,
  maxRunRate: 3,
  /** A dash plays the run this many times faster than at full walking speed. */
  dashRate: 1.75,
  /** Lean towards the dash direction, radians. */
  dashLean: 0.35,
  /** How far movement must point against the facing to run backwards, and to stop. The gap stops flicker. */
  reverseEnter: -0.3,
  reverseExit: 0.1,
};

export interface HeroAnimInput {
  /** The run is lost: play the death clip and hold its last frame. */
  lost: boolean;
  dashing: boolean;
  /** A playerHurt event happened since the previous frame. */
  hurt: boolean;
  /** Sim velocity (m/s). */
  vel: Vec2;
  /** Unit facing (the aim). The whole body always faces it. */
  aim: Vec2;
  /** Ground speed (m/s) at which the run clip's planted feet do not slide. */
  runClipSpeed: number;
  /** Walking top speed (tuning), for the dash playback rate. */
  moveSpeed: number;
}

export interface HeroAnim {
  clip: HeroClip;
  /** Playback rate. Negative plays the clip backwards (running against the facing). */
  rate: number;
  /** True on the frame a one-shot clip (hit, death) must start from its first frame. */
  restart: boolean;
  /** Target lean, radians: pitch tips the head forward (+) or back; roll tips it to the body's right (+) or left. */
  pitch: number;
  roll: number;
  /** Carried between frames. */
  moving: boolean;
  reverse: boolean;
  hitLeft: number;
}

export function initialHeroAnim(): HeroAnim {
  return { clip: 'idle', rate: 1, restart: false, pitch: 0, roll: 0, moving: false, reverse: false, hitLeft: 0 };
}

const clampRate = (r: number) => Math.min(HERO_ANIM.maxRunRate, Math.max(HERO_ANIM.minRunRate, r));

/** Advance the hero animation by one rendered frame. Priority: death, dash, hit, run, idle. */
export function nextHeroAnim(prev: HeroAnim, input: HeroAnimInput, dt: number): HeroAnim {
  const still = { pitch: 0, roll: 0 };
  if (input.lost) {
    return { ...still, clip: 'death', rate: 1, restart: prev.clip !== 'death', moving: false, reverse: false, hitLeft: 0 };
  }

  const { vel, aim } = input;
  const speed = Math.hypot(vel.x, vel.y);
  const moving = speed > (prev.moving ? HERO_ANIM.runStop : HERO_ANIM.runStart);
  // Movement direction in the body's frame: along = 1 straight ahead, -1 straight back;
  // right = 1 towards the body's right (the facing turned clockwise on screen).
  const along = speed > 1e-6 ? (vel.x * aim.x + vel.y * aim.y) / speed : 0;
  const right = speed > 1e-6 ? (vel.x * -aim.y + vel.y * aim.x) / speed : 0;
  const reverse = moving && along < (prev.reverse ? HERO_ANIM.reverseExit : HERO_ANIM.reverseEnter);
  const dir = reverse ? -1 : 1;

  if (input.dashing) {
    // A dash cancels a hit reaction so it always shows at once.
    const rate = dir * clampRate(input.moveSpeed / input.runClipSpeed) * HERO_ANIM.dashRate;
    return {
      clip: 'run',
      rate,
      restart: false,
      pitch: along * HERO_ANIM.dashLean,
      roll: right * HERO_ANIM.dashLean,
      moving: true,
      reverse,
      hitLeft: 0,
    };
  }

  const hitLeft = input.hurt ? HERO_ANIM.hitTime : Math.max(0, prev.hitLeft - dt);
  if (hitLeft > 0) return { ...still, clip: 'hit', rate: 1, restart: input.hurt, moving, reverse, hitLeft };
  if (moving) return { ...still, clip: 'run', rate: dir * clampRate(speed / input.runClipSpeed), restart: false, moving, reverse, hitLeft: 0 };
  return { ...still, clip: 'idle', rate: 1, restart: false, moving, reverse: false, hitLeft: 0 };
}
