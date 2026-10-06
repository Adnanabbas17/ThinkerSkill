import type { Room } from '../content/testRoom';
import type { Tuning } from '../tuning/tuning';
import { moveCircle, slide } from './collision';
import { SIM_DT } from './fixedStep';
import type { PlayerState, SimEvent, TickInput } from './types';
import { copy, len, normalize, vec } from './vec';

export function createPlayer(room: Room): PlayerState {
  return {
    pos: copy(room.playerStart),
    prevPos: copy(room.playerStart),
    vel: vec(),
    aimDir: vec(0, -1),
    dashTime: 0,
    dashCooldown: 0,
    dashDir: vec(0, -1),
    invulnTime: 0,
    damage: 0,
    fireCooldown: 0,
  };
}

export function stepPlayer(p: PlayerState, input: TickInput, t: Tuning, room: Room, events: SimEvent[]): void {
  const dt = SIM_DT;
  p.prevPos = copy(p.pos);
  p.dashCooldown = Math.max(0, p.dashCooldown - dt);
  p.invulnTime = Math.max(0, p.invulnTime - dt);

  const aim = normalize({ x: input.aim.x - p.pos.x, y: input.aim.y - p.pos.y });
  if (aim) p.aimDir = aim;

  const moveDir = normalize(input.move);
  const moveAmount = Math.min(1, len(input.move));

  if (input.dash && p.dashTime <= 0 && p.dashCooldown <= 0) {
    p.dashDir = moveDir ?? copy(p.aimDir);
    p.dashTime = t.dashDuration;
    p.dashCooldown = t.dashCooldown;
    p.invulnTime = Math.max(p.invulnTime, t.dashInvuln);
    events.push({ type: 'dash' });
  }

  if (p.dashTime > 0) {
    p.vel = { x: p.dashDir.x * t.dashSpeed, y: p.dashDir.y * t.dashSpeed };
    p.dashTime -= dt;
    if (p.dashTime <= 1e-9) {
      p.dashTime = 0;
      // Leave the dash at walking speed so normal accel/decel takes over.
      const exit = Math.min(t.moveSpeed, t.dashSpeed);
      p.vel = { x: p.dashDir.x * exit, y: p.dashDir.y * exit };
    }
  } else {
    const target = moveDir
      ? { x: moveDir.x * t.moveSpeed * moveAmount, y: moveDir.y * t.moveSpeed * moveAmount }
      : vec();
    const rate = moveDir ? t.moveAccel : t.moveDecel;
    const dx = target.x - p.vel.x;
    const dy = target.y - p.vel.y;
    const gap = Math.hypot(dx, dy);
    const maxChange = rate * dt;
    if (gap <= maxChange) p.vel = target;
    else p.vel = { x: p.vel.x + (dx / gap) * maxChange, y: p.vel.y + (dy / gap) * maxChange };
  }

  const hits = moveCircle(p.pos, { x: p.vel.x * dt, y: p.vel.y * dt }, room.playerRadius, room);
  slide(p.vel, hits);
}
