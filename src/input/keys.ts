// Physical key tracking by KeyboardEvent.code. Pure logic so it can be unit tested.
// Using code (not key) means Shift, Caps Lock or the keyboard layout can never turn
// a keyup into a different key than its keydown, so keys cannot get stuck.

import type { Vec2 } from '../sim/types';

/** Hold to run. Space is the only run key; Shift is not used. */
export const RUN_CODE = 'Space';
/** Pseudo key code for the left mouse button, so it shares the stuck-key protection. */
export const FIRE_CODE = 'Mouse0';

/** Keys the game owns: the browser must not scroll, activate a focused button or otherwise react to them. */
export function shouldPreventDefault(code: string): boolean {
  return code === RUN_CODE || ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code);
}

export class KeyTracker {
  private readonly down = new Set<string>();
  private fireLatched = false;

  keyDown(code: string): void {
    this.down.add(code);
    if (code === FIRE_CODE) this.fireLatched = true;
  }

  keyUp(code: string): void {
    this.down.delete(code);
  }

  /** Window lost focus or tab hidden: forget everything held. */
  releaseAll(): void {
    this.down.clear();
    this.fireLatched = false;
  }

  isDown(code: string): boolean {
    return this.down.has(code);
  }

  heldCount(): number {
    return this.down.size;
  }

  /** WASD as a unit-length (or zero) direction. W is away from the camera (-y). */
  move(): Vec2 {
    const x = (this.isDown('KeyD') ? 1 : 0) - (this.isDown('KeyA') ? 1 : 0);
    const y = (this.isDown('KeyS') ? 1 : 0) - (this.isDown('KeyW') ? 1 : 0);
    const l = Math.hypot(x, y);
    return l > 0 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
  }

  /** True while Space is held. */
  isRunning(): boolean {
    return this.isDown(RUN_CODE);
  }

  /** True while the fire button is held, and once for a click shorter than a tick. */
  takeFire(): boolean {
    const f = this.fireLatched || this.isDown(FIRE_CODE);
    this.fireLatched = false;
    return f;
  }
}
