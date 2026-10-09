import type { TickInput, Vec2 } from '../sim/types';
import { FIRE_CODE, KeyTracker, RUN_CODE, shouldPreventDefault } from './keys';

export interface Input {
  /**
   * Build the input for one sim tick. `toFloor` projects the last cursor
   * screen position through the current camera, so aim stays correct when
   * the camera moves but the mouse does not.
   */
  sample(toFloor: (clientX: number, clientY: number) => Vec2 | null): TickInput;
  releaseAll(): void;
}

export function createInput(canvas: HTMLCanvasElement): Input {
  const keys = new KeyTracker();
  let cursor = { x: window.innerWidth / 2, y: window.innerHeight / 3 };
  let lastAim: Vec2 = { x: 0, y: -1 };

  window.addEventListener('keydown', (e) => {
    keys.keyDown(e.code);
    if (shouldPreventDefault(e.code)) e.preventDefault(); // Space must never scroll the page
  });
  window.addEventListener('keyup', (e) => {
    keys.keyUp(e.code);
    // A focused button (tuning panel) is activated by Space on keyup: stop that too.
    if (e.code === RUN_CODE) e.preventDefault();
  });
  window.addEventListener('blur', () => keys.releaseAll());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) keys.releaseAll();
  });
  window.addEventListener('pointermove', (e) => {
    cursor = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 0) keys.keyDown(FIRE_CODE);
  });
  window.addEventListener('pointerup', (e) => {
    if (e.button === 0) keys.keyUp(FIRE_CODE);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    sample(toFloor) {
      const aim = toFloor(cursor.x, cursor.y);
      if (aim) lastAim = aim;
      return { move: keys.move(), aim: { ...lastAim }, run: keys.isRunning(), fire: keys.takeFire() };
    },
    releaseAll: () => keys.releaseAll(),
  };
}
