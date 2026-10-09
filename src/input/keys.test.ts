import { describe, expect, it } from 'vitest';
import { FIRE_CODE, KeyTracker, RUN_CODE, shouldPreventDefault } from './keys';

describe('KeyTracker', () => {
  it('maps WASD to a normalized direction (W is -y)', () => {
    const k = new KeyTracker();
    k.keyDown('KeyW');
    expect(k.move()).toEqual({ x: 0, y: -1 });
    k.keyDown('KeyD');
    expect(k.move().x).toBeCloseTo(Math.SQRT1_2);
    expect(k.move().y).toBeCloseTo(-Math.SQRT1_2);
  });

  it('opposite keys cancel', () => {
    const k = new KeyTracker();
    k.keyDown('KeyA');
    k.keyDown('KeyD');
    expect(k.move()).toEqual({ x: 0, y: 0 });
  });

  it('never leaves a key stuck when Space is held while pressing and releasing WASD, in any order', () => {
    const wasd = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
    for (const spaceUpFirst of [true, false]) {
      const k = new KeyTracker();
      k.keyDown(RUN_CODE);
      for (const c of wasd) k.keyDown(c);
      for (const c of wasd) k.keyDown(c); // auto-repeat while Space is held
      expect(k.isRunning()).toBe(true);
      if (spaceUpFirst) k.keyUp(RUN_CODE);
      for (const c of [...wasd].reverse()) k.keyUp(c);
      if (!spaceUpFirst) k.keyUp(RUN_CODE);
      expect(k.heldCount()).toBe(0);
      expect(k.move()).toEqual({ x: 0, y: 0 });
      expect(k.isRunning()).toBe(false);
    }
  });

  it('run is held, not latched: on while Space is down (also through auto-repeat), off on release', () => {
    const k = new KeyTracker();
    expect(k.isRunning()).toBe(false);
    k.keyDown(RUN_CODE);
    k.keyDown(RUN_CODE); // auto-repeat
    expect(k.isRunning()).toBe(true);
    expect(k.isRunning()).toBe(true); // reading it does not consume it
    k.keyUp(RUN_CODE);
    expect(k.isRunning()).toBe(false);
  });

  it('Shift does nothing: it never runs, and never moves', () => {
    const k = new KeyTracker();
    k.keyDown('ShiftLeft');
    k.keyDown('ShiftRight');
    expect(k.isRunning()).toBe(false);
    expect(k.move()).toEqual({ x: 0, y: 0 });
    expect(shouldPreventDefault('ShiftLeft')).toBe(false);
  });

  it('Space with the fire button and a move key: all three are independent', () => {
    const k = new KeyTracker();
    k.keyDown(RUN_CODE);
    k.keyDown('KeyW');
    k.keyDown(FIRE_CODE);
    expect(k.isRunning()).toBe(true);
    expect(k.move()).toEqual({ x: 0, y: -1 });
    expect(k.takeFire()).toBe(true);
    k.keyUp(FIRE_CODE);
    expect(k.isRunning()).toBe(true);
    expect(k.takeFire()).toBe(false);
  });

  it('releaseAll clears Space and every held key (window blur or hidden tab)', () => {
    const k = new KeyTracker();
    k.keyDown('KeyW');
    k.keyDown(RUN_CODE);
    k.keyDown(FIRE_CODE);
    k.releaseAll();
    expect(k.heldCount()).toBe(0);
    expect(k.isRunning()).toBe(false);
    expect(k.takeFire()).toBe(false);
  });

  it('the browser default is blocked for Space and WASD only (no page scroll, no button activation)', () => {
    for (const c of [RUN_CODE, 'KeyW', 'KeyA', 'KeyS', 'KeyD']) expect(shouldPreventDefault(c), c).toBe(true);
    for (const c of ['ShiftLeft', 'KeyR', 'KeyM', 'Backquote', 'Tab', 'Enter']) expect(shouldPreventDefault(c), c).toBe(false);
  });

  it('fires every tick while the button is held, and stops on release', () => {
    const k = new KeyTracker();
    k.keyDown(FIRE_CODE);
    expect(k.takeFire()).toBe(true);
    expect(k.takeFire()).toBe(true);
    k.keyUp(FIRE_CODE);
    expect(k.takeFire()).toBe(false);
  });

  it('a click released before the next tick still fires once', () => {
    const k = new KeyTracker();
    k.keyDown(FIRE_CODE);
    k.keyUp(FIRE_CODE);
    expect(k.takeFire()).toBe(true);
    expect(k.takeFire()).toBe(false);
  });
});
