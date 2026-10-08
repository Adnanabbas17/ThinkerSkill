import type { CoreId, Room } from '../content/testRoom';
import type { Tuning } from '../tuning/tuning';
import { spawnEnemy } from './enemies';
import { SIM_DT } from './fixedStep';
import { mulberry32 } from './rng';
import type { SimState } from './types';

/** Spawn points closer than this to the player are skipped (unless all are). */
export const SPAWN_MIN_DIST = 6;
const SPAWN_JITTER = 0.3;

function random(s: SimState): number {
  const r = mulberry32(s.rngState);
  s.rngState = r.state;
  return r.value;
}

/** Run the wave schedule: spawn, advance when a wave is cleared, win after the last. */
export function stepWaves(s: SimState, t: Tuning, room: Room): void {
  if (s.waves.length === 0 || s.status !== 'playing') return;
  const w = s.wave;

  if (w.toSpawn > 0) {
    w.timer -= SIM_DT;
    if (w.timer <= 1e-9) {
      const pos = pickSpawn(s, room);
      spawnEnemy(s, pos, t, pickTarget(s, t, room));
      w.toSpawn--;
      w.timer += s.waves[w.index].interval;
    }
    return;
  }
  if (s.enemies.length > 0) return;

  w.index++;
  if (w.index >= s.waves.length) {
    s.status = 'won';
    s.events.push({ type: 'roomCleared' });
    return;
  }
  w.toSpawn = s.waves[w.index].count;
  w.timer = s.waves[w.index].delay;
  s.events.push({ type: 'waveStart', wave: w.index });
}

/**
 * A new enemy chases the hero with chance chasePlayerShare; otherwise it picks an online core by
 * its target weight. Rooms without cores use no random numbers here, so their runs are unchanged.
 */
export function pickTarget(s: SimState, t: Tuning, room: Room): CoreId | null {
  if (room.cores.length === 0) return null;
  const chase = random(s) < t.chasePlayerShare;
  const roll = random(s);
  if (chase) return null;
  const online = room.cores.filter((_, i) => !s.cores[i].lost);
  const total = online.reduce((sum, c) => sum + c.targetWeight, 0);
  if (total <= 0) return null;
  let x = roll * total;
  for (const c of online) {
    x -= c.targetWeight;
    if (x < 0) return c.id;
  }
  return online[online.length - 1].id;
}

function pickSpawn(s: SimState, room: Room): { x: number; y: number } {
  const p = s.player.pos;
  const dist = (q: { x: number; y: number }) => Math.hypot(q.x - p.x, q.y - p.y);
  let options = room.spawnPoints.filter((q) => dist(q) >= SPAWN_MIN_DIST);
  if (options.length === 0) {
    const far = Math.max(...room.spawnPoints.map(dist));
    options = room.spawnPoints.filter((q) => dist(q) === far);
  }
  const base = options[Math.floor(random(s) * options.length)];
  return {
    x: base.x + (random(s) * 2 - 1) * SPAWN_JITTER,
    y: base.y + (random(s) * 2 - 1) * SPAWN_JITTER,
  };
}
