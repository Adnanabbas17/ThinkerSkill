import type { Room } from '../content/testRoom';
import type { Tuning } from '../tuning/tuning';
import { moveCircle, slide } from './collision';
import { SIM_DT } from './fixedStep';
import type { SimState, Vec2 } from './types';
import { copy, normalize, vec } from './vec';

export const ENEMY_RADIUS = 0.45;
/** How long a blocked enemy slides sideways before chasing directly again. */
export const DETOUR_TIME = 0.5;

export function spawnEnemy(s: SimState, pos: Vec2, t: Tuning): void {
  s.enemies.push({
    id: s.nextId++,
    pos: copy(pos),
    prevPos: copy(pos),
    vel: vec(),
    damage: 0,
    spawnTime: t.enemySpawnTime,
    flash: 0,
    detourTime: 0,
    detourDir: vec(),
    dead: false,
  });
  s.events.push({ type: 'enemySpawn', pos: copy(pos) });
}

/** Chase the player, keep apart from each other, and hurt the player on contact. */
export function stepEnemies(s: SimState, t: Tuning, room: Room): void {
  const dt = SIM_DT;
  const p = s.player;

  for (const e of s.enemies) {
    e.prevPos = copy(e.pos);
    e.flash = Math.max(0, e.flash - dt);
    if (e.spawnTime > 0) {
      e.spawnTime = Math.max(0, e.spawnTime - dt);
      continue;
    }
    const toPlayer = normalize({ x: p.pos.x - e.pos.x, y: p.pos.y - e.pos.y });
    e.detourTime = Math.max(0, e.detourTime - dt);
    const dir = e.detourTime > 0 ? e.detourDir : toPlayer;
    const target = dir ? { x: dir.x * t.enemySpeed, y: dir.y * t.enemySpeed } : vec();
    const dx = target.x - e.vel.x;
    const dy = target.y - e.vel.y;
    const gap = Math.hypot(dx, dy);
    const maxChange = t.enemyAccel * dt;
    if (gap <= maxChange) e.vel = target;
    else e.vel = { x: e.vel.x + (dx / gap) * maxChange, y: e.vel.y + (dy / gap) * maxChange };

    const hits = moveCircle(e.pos, { x: e.vel.x * dt, y: e.vel.y * dt }, ENEMY_RADIUS, room);
    slide(e.vel, hits);
    // Pinned head-on against a box or wall: slide along its face for a moment.
    if (toPlayer && hits.length > 0 && e.detourTime <= 0 && Math.hypot(e.vel.x, e.vel.y) < t.enemySpeed * 0.25) {
      const n = hits[0];
      const side = n.x * toPlayer.y - n.y * toPlayer.x;
      const sign = Math.abs(side) > 0.05 ? Math.sign(side) : e.id % 2 === 0 ? 1 : -1;
      e.detourDir = { x: -n.y * sign, y: n.x * sign };
      e.detourTime = DETOUR_TIME;
    }
  }

  separate(s, room);

  // Contact: keep enemies outside the player and deal damage unless invulnerable.
  const reach = ENEMY_RADIUS + room.playerRadius;
  for (const e of s.enemies) {
    if (e.spawnTime > 0) continue;
    const dx = e.pos.x - p.pos.x;
    const dy = e.pos.y - p.pos.y;
    const d = Math.hypot(dx, dy);
    if (d >= reach) continue;
    const n = d > 1e-9 ? { x: dx / d, y: dy / d } : { x: 0, y: -1 };
    e.pos = { x: p.pos.x + n.x * reach, y: p.pos.y + n.y * reach };
    moveCircle(e.pos, vec(), ENEMY_RADIUS, room);
    e.vel = { x: n.x * t.enemyKnockback, y: n.y * t.enemyKnockback };
    if (p.invulnTime > 0 || s.status !== 'playing') continue;

    p.damage += t.contactDamage;
    p.invulnTime = t.hurtInvuln;
    p.vel.x -= n.x * t.hurtKnockback;
    p.vel.y -= n.y * t.hurtKnockback;
    s.events.push({ type: 'playerHurt' });
    if (p.damage >= t.playerHp - 1e-9) {
      s.status = 'lost';
      s.events.push({ type: 'playerDestroyed' });
    }
  }
}

/** Push overlapping enemies apart (half each), then back out of walls. */
function separate(s: SimState, room: Room): void {
  const min = ENEMY_RADIUS * 2;
  const list = s.enemies;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i].pos;
      const b = list[j].pos;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= min) continue;
      // Exact overlap: split along a fixed axis so the result stays deterministic.
      const n = d > 1e-9 ? { x: dx / d, y: dy / d } : { x: 1, y: 0 };
      const push = (min - d) / 2;
      a.x -= n.x * push;
      a.y -= n.y * push;
      b.x += n.x * push;
      b.y += n.y * push;
    }
  }
  for (const e of list) moveCircle(e.pos, vec(), ENEMY_RADIUS, room);
}
