import { describe, expect, it } from 'vitest';
import { FIRE_CODE, KeyTracker } from './keys';

describe('KeyTracker', () => {
  it('maps WASD to a normalized direction (W is -y)', () => {
    const k = new KeyTracker();
    k.keyDown('KeyW', false);
    expect(k.move()).toEqual({ x: 0, y: -1 });
    k.keyDown('KeyD', false);
    expect(k.move().x).toBeCloseTo(Math.SQRT1_2);
    expect(k.move().y).toBeCloseTo(-Math.SQRT1_2);
  });

  it('opposite keys cancel', () => {
    const k = new KeyTracker();
    k.keyDown('KeyA', false);
    k.keyDown('KeyD', false);
    expect(k.move()).toEqual({ x: 0, y: 0 });
  });

  it('never leaves a key stuck when Shift is held while pressing and releasing WASD, in any order', () => {
    const wasd = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
    for (const shift of ['ShiftLeft', 'ShiftRight']) {
      for (const shiftUpFirst of [true, false]) {
        const k = new KeyTracker();
        k.keyDown(shift, false);
        for (const c of wasd) k.keyDown(c, false);
        for (const c of wasd) k.keyDown(c, true); // auto-repeat while Shift is held
        if (shiftUpFirst) k.keyUp(shift);
        for (const c of [...wasd].reverse()) k.keyUp(c);
        if (!shiftUpFirst) k.keyUp(shift);
        expect(k.heldCount()).toBe(0);
        expect(k.move()).toEqual({ x: 0, y: 0 });
      }
    }
  });

  it('dashes every tick while Shift is held, and stops on release', () => {
    const k = new KeyTracker();
    k.keyDown('ShiftLeft', false);
    k.keyDown('ShiftLeft', true);
    expect(k.takeDash()).toBe(true);
    expect(k.takeDash()).toBe(true);
    k.keyUp('ShiftLeft');
    expect(k.takeDash()).toBe(false);
    k.keyDown('ShiftRight', false);
    expect(k.takeDash()).toBe(true);
  });

  it('a Shift tap released before the next tick still dashes once', () => {
    const k = new KeyTracker();
    k.keyDown('ShiftLeft', false);
    k.keyUp('ShiftLeft');
    expect(k.takeDash()).toBe(true);
    expect(k.takeDash()).toBe(false);
  });

  it('releaseAll clears held keys and a pending dash (window blur)', () => {
    const k = new KeyTracker();
    k.keyDown('KeyW', false);
    k.keyDown('ShiftLeft', false);
    k.keyDown(FIRE_CODE, false);
    k.releaseAll();
    expect(k.heldCount()).toBe(0);
    expect(k.takeDash()).toBe(false);
    expect(k.takeFire()).toBe(false);
  });

  it('fires every tick while the button is held, and stops on release', () => {
    const k = new KeyTracker();
    k.keyDown(FIRE_CODE, false);
    expect(k.takeFire()).toBe(true);
    expect(k.takeFire()).toBe(true);
    k.keyUp(FIRE_CODE);
    expect(k.takeFire()).toBe(false);
  });

  it('a click released before the next tick still fires once', () => {
    const k = new KeyTracker();
    k.keyDown(FIRE_CODE, false);
    k.keyUp(FIRE_CODE);
    expect(k.takeFire()).toBe(true);
    expect(k.takeFire()).toBe(false);
  });
});
