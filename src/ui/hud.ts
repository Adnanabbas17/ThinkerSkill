import './hud.css';
import { FrameStats } from './frameStats';

export interface Hud {
  setBackend(name: string): void;
  /** Call once per rendered frame. */
  frame(nowMs: number, dtMs: number): void;
}

export function createHud(doc: Document): Hud {
  const fpsEl = doc.getElementById('hud-fps')!;
  const worstEl = doc.getElementById('hud-worst')!;
  const backendEl = doc.getElementById('hud-backend')!;
  const stats = new FrameStats();
  let lastText = -1;

  return {
    setBackend(name) {
      backendEl.textContent = name;
    },
    frame(nowMs, dtMs) {
      if (dtMs > 0) stats.push(nowMs, dtMs);
      if (nowMs - lastText >= 250) {
        lastText = nowMs;
        fpsEl.textContent = String(Math.round(stats.fps(nowMs)));
        worstEl.textContent = `${stats.worstMs(nowMs).toFixed(1)} ms`;
      }
    },
  };
}
