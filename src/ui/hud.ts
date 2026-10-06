import './hud.css';

export interface Hud {
  setBackend(name: string): void;
  /** Call once per rendered frame; updates the fps text twice per second. */
  tick(nowMs: number): void;
}

export function createHud(doc: Document): Hud {
  const fpsEl = doc.getElementById('hud-fps')!;
  const backendEl = doc.getElementById('hud-backend')!;
  let frames = 0;
  let windowStart = -1;

  return {
    setBackend(name) {
      backendEl.textContent = name;
    },
    tick(nowMs) {
      if (windowStart < 0) windowStart = nowMs;
      frames++;
      const elapsed = nowMs - windowStart;
      if (elapsed >= 500) {
        fpsEl.textContent = String(Math.round((frames * 1000) / elapsed));
        frames = 0;
        windowStart = nowMs;
      }
    },
  };
}
