// Physical key tracking by KeyboardEvent.code. Pure logic so it can be unit tested.
// Using code (not key) means Shift, Caps Lock or the keyboard layout can never turn
// a keyup into a different key than its keydown, so keys cannot get stuck.

import type { Vec2 } from '../sim/types';

export const DASH_CODES = ['ShiftLeft', 'ShiftRight'];
/** Pseudo key code for the left mouse button, so it shares the stuck-key protection. */
export const FIRE_CODE = 'Mouse0';

export class KeyTracker {
  private readonly down = new Set<string>();
  private dashLatched = false;
  private fireLatched = false;

  keyDown(code: string, repeat: boolean): void {
    this.down.add(code);
    if (!repeat && DASH_CODES.includes(code)) this.dashLatched = true;
    if (code === FIRE_CODE) this.fireLatched = true;
  }

  keyUp(code: string): void {
    this.down.delete(code);
  }

  /** Window lost focus or tab hidden: forget everything held. */
  releaseAll(): void {
    this.down.clear();
    this.dashLatched = false;
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

  /** True while Shift is held (dash repeats as soon as allowed), and once for a tap shorter than a tick. */
  takeDash(): boolean {
    const d = this.dashLatched || DASH_CODES.some((c) => this.isDown(c));
    this.dashLatched = false;
    return d;
  }

  /** True while the fire button is held, and once for a click shorter than a tick. */
  takeFire(): boolean {
    const f = this.fireLatched || this.isDown(FIRE_CODE);
    this.fireLatched = false;
    return f;
  }
}
