// Physical key tracking by KeyboardEvent.code. Pure logic so it can be unit tested.
// Using code (not key) means Shift, Caps Lock or the keyboard layout can never turn
// a keyup into a different key than its keydown, so keys cannot get stuck.

import type { Vec2 } from '../sim/types';

export const DASH_CODES = ['ShiftLeft', 'ShiftRight'];

export class KeyTracker {
  private readonly down = new Set<string>();
  private dashLatched = false;

  keyDown(code: string, repeat: boolean): void {
    this.down.add(code);
    if (!repeat && DASH_CODES.includes(code)) this.dashLatched = true;
  }

  keyUp(code: string): void {
    this.down.delete(code);
  }

  /** Window lost focus or tab hidden: forget everything held. */
  releaseAll(): void {
    this.down.clear();
    this.dashLatched = false;
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

  /** True once per Shift press; consumed by the first sim tick that reads it. */
  takeDash(): boolean {
    const d = this.dashLatched;
    this.dashLatched = false;
    return d;
  }
}
