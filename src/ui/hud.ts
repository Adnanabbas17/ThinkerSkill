import './hud.css';
import type { SimState } from '../sim/types';
import type { Tuning } from '../tuning/tuning';
import { FrameStats } from './frameStats';

export interface Hud {
  setBackend(name: string): void;
  /** Show run state: hp, wave, try number, and the end banner. */
  game(state: SimState, tuning: Tuning, tryNumber: number): void;
  /** Call once per rendered frame. */
  frame(nowMs: number, dtMs: number): void;
}

export function createHud(doc: Document): Hud {
  const fpsEl = doc.getElementById('hud-fps')!;
  const worstEl = doc.getElementById('hud-worst')!;
  const backendEl = doc.getElementById('hud-backend')!;
  const hpEl = doc.getElementById('hud-hp')!;
  const waveEl = doc.getElementById('hud-wave')!;
  const tryEl = doc.getElementById('hud-try')!;
  const bannerEl = doc.getElementById('hud-banner')!;
  const stats = new FrameStats();
  let lastText = -1;
  let lastGame = '';

  return {
    setBackend(name) {
      backendEl.textContent = name;
    },
    game(state, tuning, tryNumber) {
      const max = Math.ceil(tuning.playerHp);
      const hp = Math.max(0, Math.ceil(tuning.playerHp - state.player.damage - 1e-9));
      const total = state.waves.length;
      const wave = state.status === 'won' ? 'cleared' : `${Math.max(1, state.wave.index + 1)} / ${total}`;
      const key = `${hp}|${max}|${wave}|${tryNumber}|${state.status}`;
      if (key === lastGame) return; // touch the DOM only when something changed
      lastGame = key;
      hpEl.textContent = `${'■'.repeat(hp)}${'□'.repeat(Math.max(0, max - hp))} ${hp}/${max}`;
      hpEl.classList.toggle('low', hp <= 1);
      waveEl.textContent = wave;
      tryEl.textContent = String(tryNumber);
      bannerEl.hidden = state.status === 'playing';
      if (state.status === 'won') bannerEl.innerHTML = 'Room cleared<small>Press R to play again</small>';
      if (state.status === 'lost') bannerEl.innerHTML = 'Destroyed<small>Press R to retry</small>';
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
