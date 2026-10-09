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
      // Safety limiter: overlapping sounds can never clip.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.1;
      master.connect(limiter).connect(ctx.destination);
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

  /**
   * Filtered white-noise burst: 2 ms attack, exponential decay to -40 dB at `dur`, then a 10 ms
   * fade to silence. The cutoff sweeps from `from` to `to`.
   */
  const noiseBurst = (type: BiquadFilterType, from: number, to: number, dur: number, vol: number) => {
    if (!ctx || !master || !noise) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + 0.002);
    gain.gain.exponentialRampToValueAtTime(vol * 0.01, t0 + dur);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + 0.01);
    src.connect(filter).connect(gain).connect(master);
    // Random start in the noise buffer so no two shots share the same grain.
    src.start(t0, Math.random() * 0.3);
    src.stop(t0 + dur + 0.02);
  };

  /** Gunshot: high-passed crack, falling low thump, low-passed tail; pitch and level vary a few % per shot. */
  const gunshot = () => {
    const pitch = 1 + (Math.random() * 2 - 1) * 0.05;
    const level = 1 + (Math.random() * 2 - 1) * 0.06;
    noiseBurst('highpass', 2500 * pitch, 1800 * pitch, 0.03, 0.55 * level);
    tone('sine', 150 * pitch, 48 * pitch, 0.08, 0.6 * level);
    noiseBurst('lowpass', 1400 * pitch, 350 * pitch, 0.15, 0.32 * level);
  };

  const sounds: Partial<Record<SimEvent['type'], () => void>> = {
    fire: gunshot,
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
    alarm: () => {
      tone('square', 880, 880, 0.09, 0.2);
      tone('square', 660, 660, 0.09, 0.2, 0.13);
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
