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

/** One row per core: label, bar, value. */
function buildCoreRows(doc: Document, parent: HTMLElement, ids: string[]) {
  parent.replaceChildren();
  return ids.map((id) => {
    const row = doc.createElement('div');
    row.className = 'hud-core';
    const label = doc.createElement('span');
    label.className = 'hud-label';
    label.textContent = `Core ${id}`;
    const bar = doc.createElement('span');
    bar.className = 'hud-core-bar';
    const fill = doc.createElement('span');
    fill.className = 'hud-core-fill';
    fill.style.display = 'block';
    bar.append(fill);
    const value = doc.createElement('span');
    row.append(label, bar, value);
    parent.append(row);
    return { row, fill, value };
  });
}

export function createHud(doc: Document): Hud {
  const fpsEl = doc.getElementById('hud-fps')!;
  const worstEl = doc.getElementById('hud-worst')!;
  const backendEl = doc.getElementById('hud-backend')!;
  const hpEl = doc.getElementById('hud-hp')!;
  const waveEl = doc.getElementById('hud-wave')!;
  const waveLabelEl = doc.getElementById('hud-wave-label')!;
  const tryEl = doc.getElementById('hud-try')!;
  const bannerEl = doc.getElementById('hud-banner')!;
  const coresEl = doc.getElementById('hud-cores')!;
  let coreRows: { row: HTMLElement; fill: HTMLElement; value: HTMLElement }[] = [];
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
      const secs = Math.floor(state.tick / 60);
      const wave = state.endless
        ? `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`
        : state.status === 'won'
          ? 'cleared'
          : `${Math.max(1, state.wave.index + 1)} / ${total}`;
      const cores = state.cores.map((c) => Math.ceil(c.integrity - 1e-9));
      const key = `${hp}|${max}|${wave}|${tryNumber}|${state.status}|${cores.join(',')}`;
      if (key === lastGame) return; // touch the DOM only when something changed
      lastGame = key;
      if (coreRows.length !== state.cores.length) coreRows = buildCoreRows(doc, coresEl, state.cores.map((c) => c.id));
      coresEl.hidden = state.cores.length === 0;
      state.cores.forEach((c, i) => {
        const r = coreRows[i];
        r.fill.style.width = `${cores[i]}%`;
        r.value.textContent = c.lost ? 'LOST' : String(cores[i]);
        r.row.classList.toggle('low', !c.lost && cores[i] <= 30);
        r.row.classList.toggle('lost', c.lost);
      });
      hpEl.textContent = `${'■'.repeat(hp)}${'□'.repeat(Math.max(0, max - hp))} ${hp}/${max}`;
      hpEl.classList.toggle('low', hp <= 1);
      waveEl.textContent = wave;
      waveLabelEl.textContent = state.endless ? 'Time' : 'Wave';
      tryEl.textContent = String(tryNumber);
      bannerEl.hidden = state.status === 'playing';
      if (state.status === 'won') bannerEl.innerHTML = 'Room cleared<small>Press R to play again</small>';
      if (state.status === 'lost') {
        const what = state.lostReason === 'coresLost' ? 'All cores lost' : 'Destroyed';
        bannerEl.innerHTML = `${what}<small>Press R to retry</small>`;
      }
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
