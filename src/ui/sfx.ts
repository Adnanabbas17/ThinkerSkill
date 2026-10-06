// Placeholder sounds synthesized with Web Audio: no sound files, nothing to license.
// Replaced in the Milestone 3 sound pass.

import type { SimEvent } from '../sim/types';

const MUTE_KEY = 'thinkerskill.muted';

export interface Sfx {
  /** Play sounds for the sim events of one frame (each event type at most once). */
  play(events: readonly SimEvent[]): void;
}

type OscType = OscillatorType;

export function createSfx(): Sfx {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let muted = false;
  try {
    muted = localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    // storage blocked: default to sound on
  }

  // Browsers only allow audio after a user gesture.
  const unlock = () => {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.25;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') void ctx.resume();
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', (e) => {
    unlock();
    if (e.code !== 'KeyM' || e.repeat) return;
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.25;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // ignore
    }
  });

  const tone = (type: OscType, from: number, to: number, dur: number, vol: number, delay = 0) => {
    if (!ctx || !master) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  };

  const hiss = (freq: number, dur: number, vol: number) => {
    if (!ctx || !master || !noise) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(freq, t0);
    filter.frequency.exponentialRampToValueAtTime(freq * 0.3, t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(master);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  };

  const sounds: Partial<Record<SimEvent['type'], () => void>> = {
    fire: () => tone('square', 900, 600, 0.05, 0.08),
    dash: () => hiss(2400, 0.14, 0.5),
    enemySpawn: () => tone('sine', 420, 640, 0.15, 0.12),
    enemyHit: () => tone('triangle', 320, 170, 0.07, 0.35),
    enemyKilled: () => {
      hiss(1600, 0.2, 0.7);
      tone('square', 240, 70, 0.2, 0.15);
    },
    playerHurt: () => {
      tone('sawtooth', 170, 55, 0.28, 0.4);
      hiss(800, 0.2, 0.6);
    },
    playerDestroyed: () => {
      tone('sawtooth', 220, 35, 0.9, 0.4);
      hiss(600, 0.8, 0.8);
    },
    waveStart: () => {
      tone('sine', 440, 440, 0.12, 0.25);
      tone('sine', 660, 660, 0.16, 0.25, 0.14);
    },
    roomCleared: () => [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.22, 0.3, i * 0.11)),
  };

  return {
    play(events) {
      if (!ctx || muted || events.length === 0) return;
      const played = new Set<string>();
      for (const e of events) {
        if (played.has(e.type)) continue;
        played.add(e.type);
        sounds[e.type]?.();
      }
    },
  };
}
