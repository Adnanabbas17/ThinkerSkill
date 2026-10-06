import type { TickInput, Vec2 } from '../sim/types';
import { KeyTracker } from './keys';

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
    keys.keyDown(e.code, e.repeat);
    if (e.code.startsWith('Shift') || ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.keyUp(e.code));
  window.addEventListener('blur', () => keys.releaseAll());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) keys.releaseAll();
  });
  window.addEventListener('pointermove', (e) => {
    cursor = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    sample(toFloor) {
      const aim = toFloor(cursor.x, cursor.y);
      if (aim) lastAim = aim;
      return { move: keys.move(), aim: { ...lastAim }, dash: keys.takeDash() };
    },
    releaseAll: () => keys.releaseAll(),
  };
}
