import type { Room } from '../content/testRoom';
import type { Tuning } from '../tuning/tuning';
import { MAX_SUBSTEP } from './collision';
import { ENEMY_RADIUS } from './enemies';
import { SIM_DT } from './fixedStep';
import type { SimState, TickInput } from './types';
import { copy } from './vec';

export const SHOT_RADIUS = 0.12;

/** Spawn a shot from the drone's nose while fire is held and the cooldown allows. */
export function fire(s: SimState, input: TickInput, t: Tuning, room: Room): void {
  const p = s.player;
  p.fireCooldown = Math.max(0, p.fireCooldown - SIM_DT);
  if (!input.fire || p.fireCooldown > 1e-9) return;
  p.fireCooldown += 1 / t.fireRate;
  const pos = { x: p.pos.x + p.aimDir.x * room.playerRadius, y: p.pos.y + p.aimDir.y * room.playerRadius };
  s.shots.push({ id: s.nextId++, pos, prevPos: copy(pos), dir: copy(p.aimDir) });
  s.events.push({ type: 'fire' });
}

function blocked(x: number, y: number, room: Room): boolean {
  if (x < room.minX || x > room.maxX || y < room.minY || y > room.maxY) return true;
  for (const b of room.obstacles) {
    if (Math.abs(x - b.x) < b.hw + SHOT_RADIUS && Math.abs(y - b.y) < b.hh + SHOT_RADIUS) return true;
  }
  return false;
}

/**
 * Move shots in sub-steps of at most MAX_SUBSTEP so fast shots cannot skip
 * past thin obstacles or enemies. A shot stops at the first thing it touches.
 */
export function stepShots(s: SimState, t: Tuning, room: Room): void {
  const dist = t.shotSpeed * SIM_DT;
  const steps = Math.max(1, Math.ceil(dist / MAX_SUBSTEP));
  const stepLen = dist / steps;
  const hitR = ENEMY_RADIUS + SHOT_RADIUS;

  s.shots = s.shots.filter((shot) => {
    shot.prevPos = copy(shot.pos);
    // Check the spawn point too: a shot fired into a wall dies at once.
    for (let i = 0; i <= steps; i++) {
      if (i > 0) {
        shot.pos.x += shot.dir.x * stepLen;
        shot.pos.y += shot.dir.y * stepLen;
      }
      if (blocked(shot.pos.x, shot.pos.y, room)) {
        s.events.push({ type: 'shotBlocked', pos: copy(shot.pos) });
        return false;
      }
      for (const e of s.enemies) {
        if (e.dead) continue;
        const dx = e.pos.x - shot.pos.x;
        const dy = e.pos.y - shot.pos.y;
        if (dx * dx + dy * dy >= hitR * hitR) continue;
        e.damage += t.shotDamage;
        e.flash = t.hitFlash;
        e.vel.x += shot.dir.x * t.enemyKnockback;
        e.vel.y += shot.dir.y * t.enemyKnockback;
        s.events.push({ type: 'enemyHit', pos: copy(e.pos) });
        if (e.damage >= t.enemyHp - 1e-9) {
          e.dead = true;
          s.events.push({ type: 'enemyKilled', pos: copy(e.pos) });
        }
        return false;
      }
    }
    return true;
  });
  s.enemies = s.enemies.filter((e) => !e.dead);
}
