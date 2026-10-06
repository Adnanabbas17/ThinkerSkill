export interface Vec2 {
  x: number;
  y: number;
}

/** One input state per sim tick. */
export interface TickInput {
  /** Move direction, each axis -1..1, length <= 1. */
  move: Vec2;
  /** Cursor point projected onto the floor plane. */
  aim: Vec2;
  /** Dash was pressed since the previous tick. */
  dash: boolean;
}

export interface PlayerState {
  pos: Vec2;
  prevPos: Vec2;
  vel: Vec2;
  /** Unit vector towards the aim point. */
  aimDir: Vec2;
  dashTime: number;
  dashCooldown: number;
  dashDir: Vec2;
  /** Seconds of invulnerability left (dash or hurt). */
  invulnTime: number;
}

export type SimEvent = { type: 'dash' };

export interface SimState {
  tick: number;
  player: PlayerState;
  /** Events emitted during the last tick only. */
  events: SimEvent[];
}
