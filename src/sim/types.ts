import type { CoreId } from '../content/testRoom';
import type { Wave } from '../content/testWaves';

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
  /** Fire is held, or was clicked since the previous tick. */
  fire: boolean;
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
  /** Damage taken. Stored instead of hp so live tuning of max hp applies at once. */
  damage: number;
  fireCooldown: number;
}

export interface EnemyState {
  id: number;
  pos: Vec2;
  prevPos: Vec2;
  vel: Vec2;
  damage: number;
  /** Seconds left of the spawn warning: cannot move or hurt yet. */
  spawnTime: number;
  /** Seconds left of the hit flash. */
  flash: number;
  /** Seconds left of sliding sideways along a box it got stuck on. */
  detourTime: number;
  detourDir: Vec2;
  dead: boolean;
  /** Core this enemy attacks; null = it chases the hero. */
  targetCoreId: CoreId | null;
}

export interface ShotState {
  id: number;
  pos: Vec2;
  prevPos: Vec2;
  /** Unit direction. */
  dir: Vec2;
  /** Distance flown since it was fired (m); the shot is removed at pulseRange. */
  travelled: number;
}

export interface CoreState {
  id: CoreId;
  /** 0 to 100. */
  integrity: number;
  /** Reached 0: offline for the rest of the run, takes no more damage. */
  lost: boolean;
}

export interface WaveProgress {
  /** Current wave, -1 before the first one starts. */
  index: number;
  /** Enemies of this wave not spawned yet. */
  toSpawn: number;
  /** Seconds to the next spawn. */
  timer: number;
}

export type SimStatus = 'playing' | 'won' | 'lost';

/** Why a run was lost (null while playing or after a win). */
export type LostReason = 'destroyed' | 'coresLost' | null;

export type SimEvent =
  | { type: 'dash' }
  | { type: 'fire' }
  | { type: 'shotBlocked'; pos: Vec2 }
  | { type: 'enemySpawn'; pos: Vec2; targetCoreId: CoreId | null }
  | { type: 'enemyHit'; pos: Vec2 }
  | { type: 'enemyKilled'; pos: Vec2 }
  | { type: 'playerHurt' }
  | { type: 'playerDestroyed' }
  | { type: 'waveStart'; wave: number }
  | { type: 'roomCleared' }
  /** Integrity removed from a core this tick (one event per damaged core per tick). */
  | { type: 'coreDamaged'; coreId: CoreId; amount: number; cause: 'threat' }
  | { type: 'coreLost'; coreId: CoreId }
  | { type: 'allCoresLost' };

export interface SimState {
  tick: number;
  status: SimStatus;
  lostReason: LostReason;
  player: PlayerState;
  /** Same order as the room's cores. */
  cores: CoreState[];
  enemies: EnemyState[];
  shots: ShotState[];
  waves: readonly Wave[];
  wave: WaveProgress;
  nextId: number;
  /** Seeded random state (mulberry32), kept in the state so a run is fully reproducible. */
  rngState: number;
  /** Events emitted during the last tick only. */
  events: SimEvent[];
}
