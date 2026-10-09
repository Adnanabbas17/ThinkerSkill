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
  /** How far movement must point against the facing to run backwards, and to stop. The gap stops flicker. */
  reverseEnter: -0.3,
  reverseExit: 0.1,
};

export interface HeroAnimInput {
  /** The run is lost: play the death clip and hold its last frame. */
  lost: boolean;
  /** A playerHurt event happened since the previous frame. */
  hurt: boolean;
  /** Sim velocity (m/s). */
  vel: Vec2;
  /** Unit facing (the aim). The whole body always faces it. */
  aim: Vec2;
  /** Ground speed (m/s) at which the run clip's planted feet do not slide. */
  runClipSpeed: number;
}

export interface HeroAnim {
  clip: HeroClip;
  /** Playback rate. Negative plays the clip backwards (running against the facing). */
  rate: number;
  /** True on the frame a one-shot clip (hit, death) must start from its first frame. */
  restart: boolean;
  /** Carried between frames. */
  moving: boolean;
  reverse: boolean;
  hitLeft: number;
}

export function initialHeroAnim(): HeroAnim {
  return { clip: 'idle', rate: 1, restart: false, moving: false, reverse: false, hitLeft: 0 };
}

const clampRate = (r: number) => Math.min(HERO_ANIM.maxRunRate, Math.max(HERO_ANIM.minRunRate, r));

/** Advance the hero animation by one rendered frame. Priority: death, hit, run, idle. */
export function nextHeroAnim(prev: HeroAnim, input: HeroAnimInput, dt: number): HeroAnim {
  if (input.lost) {
    return { clip: 'death', rate: 1, restart: prev.clip !== 'death', moving: false, reverse: false, hitLeft: 0 };
  }

  const { vel, aim } = input;
  const speed = Math.hypot(vel.x, vel.y);
  const moving = speed > (prev.moving ? HERO_ANIM.runStop : HERO_ANIM.runStart);
  // Movement direction in the body's frame: along = 1 straight ahead, -1 straight back.
  const along = speed > 1e-6 ? (vel.x * aim.x + vel.y * aim.y) / speed : 0;
  const reverse = moving && along < (prev.reverse ? HERO_ANIM.reverseExit : HERO_ANIM.reverseEnter);
  const dir = reverse ? -1 : 1;

  const hitLeft = input.hurt ? HERO_ANIM.hitTime : Math.max(0, prev.hitLeft - dt);
  if (hitLeft > 0) return { clip: 'hit', rate: 1, restart: input.hurt, moving, reverse, hitLeft };
  if (moving) return { clip: 'run', rate: dir * clampRate(speed / input.runClipSpeed), restart: false, moving, reverse, hitLeft: 0 };
  return { clip: 'idle', rate: 1, restart: false, moving, reverse: false, hitLeft: 0 };
}
