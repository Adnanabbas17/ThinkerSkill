// Every feel value lives here. Pure data: no DOM, so src/sim can read it.

export interface TuningSpec {
  key: string;
  group: string;
  label: string;
  min: number;
  max: number;
  step: number;
}

export const defaultTuning = {
  // Move
  moveSpeed: 7,
  moveAccel: 60,
  moveDecel: 45,
  // Dash
  dashSpeed: 20,
  dashDuration: 0.14,
  dashCooldown: 0.8,
  dashInvuln: 0,
  // Camera
  camHeight: 16,
  camBack: 9,
  camFov: 50,
  camFollow: 8,
  // Fire
  fireRate: 6,
  shotSpeed: 28,
  shotDamage: 1,
  pulseRange: 10.5,
  // Enemy
  enemyHp: 4,
  enemySpeed: 3.6,
  enemyAccel: 20,
  enemyKnockback: 4,
  enemySpawnTime: 0.6,
  chasePlayerShare: 0.25,
  // Core
  coreDamagePerSec: 4,
  spreadThreshold: 50,
  spreadPerSec: 2,
  alarmRearmSeconds: 5,
  // Hurt
  playerHp: 5,
  contactDamage: 1,
  hurtInvuln: 1,
  hurtKnockback: 9,
  // Feedback
  hitFlash: 0.08,
  shakeHurt: 0.35,
  shakeTime: 0.25,
};

export type Tuning = typeof defaultTuning;
export type TuningKey = keyof Tuning;

export const tuningSpecs: (TuningSpec & { key: TuningKey })[] = [
  { key: 'moveSpeed', group: 'Move', label: 'speed (m/s)', min: 2, max: 15, step: 0.1 },
  { key: 'moveAccel', group: 'Move', label: 'accel (m/s²)', min: 5, max: 200, step: 1 },
  { key: 'moveDecel', group: 'Move', label: 'decel (m/s²)', min: 5, max: 200, step: 1 },
  { key: 'dashSpeed', group: 'Dash', label: 'speed (m/s)', min: 5, max: 40, step: 0.5 },
  { key: 'dashDuration', group: 'Dash', label: 'duration (s)', min: 0.05, max: 0.4, step: 0.01 },
  { key: 'dashCooldown', group: 'Dash', label: 'cooldown (s)', min: 0, max: 3, step: 0.05 },
  { key: 'dashInvuln', group: 'Dash', label: 'invulnerable (s)', min: 0, max: 0.3, step: 0.01 },
  { key: 'camHeight', group: 'Camera', label: 'height (m)', min: 6, max: 30, step: 0.5 },
  { key: 'camBack', group: 'Camera', label: 'back (m)', min: 0, max: 20, step: 0.5 },
  { key: 'camFov', group: 'Camera', label: 'fov (°)', min: 30, max: 80, step: 1 },
  { key: 'camFollow', group: 'Camera', label: 'follow (1/s)', min: 1, max: 30, step: 0.5 },
  { key: 'fireRate', group: 'Fire', label: 'rate (shots/s)', min: 1, max: 20, step: 0.5 },
  { key: 'shotSpeed', group: 'Fire', label: 'shot speed (m/s)', min: 8, max: 60, step: 1 },
  { key: 'shotDamage', group: 'Fire', label: 'damage', min: 0.25, max: 5, step: 0.25 },
  { key: 'pulseRange', group: 'Fire', label: 'pulse range (m)', min: 4, max: 40, step: 0.5 },
  { key: 'enemyHp', group: 'Enemy', label: 'hp', min: 1, max: 10, step: 1 },
  { key: 'enemySpeed', group: 'Enemy', label: 'speed (m/s)', min: 0.5, max: 10, step: 0.1 },
  { key: 'enemyAccel', group: 'Enemy', label: 'accel (m/s²)', min: 2, max: 100, step: 1 },
  { key: 'enemyKnockback', group: 'Enemy', label: 'knockback (m/s)', min: 0, max: 20, step: 0.5 },
  { key: 'enemySpawnTime', group: 'Enemy', label: 'spawn warning (s)', min: 0, max: 2, step: 0.05 },
  { key: 'chasePlayerShare', group: 'Enemy', label: 'share chasing hero', min: 0, max: 1, step: 0.05 },
  { key: 'coreDamagePerSec', group: 'Core', label: 'damage per enemy (/s)', min: 0, max: 20, step: 0.5 },
  { key: 'spreadThreshold', group: 'Core', label: 'spread below integrity', min: 0, max: 100, step: 5 },
  { key: 'spreadPerSec', group: 'Core', label: 'spread damage (/s)', min: 0, max: 10, step: 0.5 },
  { key: 'alarmRearmSeconds', group: 'Core', label: 'alarm re-arm after (s)', min: 1, max: 15, step: 0.5 },
  { key: 'playerHp', group: 'Hurt', label: 'player hp', min: 1, max: 20, step: 1 },
  { key: 'contactDamage', group: 'Hurt', label: 'contact damage', min: 0, max: 5, step: 0.5 },
  { key: 'hurtInvuln', group: 'Hurt', label: 'invulnerable (s)', min: 0, max: 3, step: 0.05 },
  { key: 'hurtKnockback', group: 'Hurt', label: 'knockback (m/s)', min: 0, max: 25, step: 0.5 },
  { key: 'hitFlash', group: 'Feedback', label: 'hit flash (s)', min: 0, max: 0.3, step: 0.01 },
  { key: 'shakeHurt', group: 'Feedback', label: 'hurt shake (m)', min: 0, max: 1, step: 0.05 },
  { key: 'shakeTime', group: 'Feedback', label: 'shake time (s)', min: 0.05, max: 1, step: 0.05 },
];

export function cloneDefaults(): Tuning {
  return { ...defaultTuning };
}

/** Every value at its slider maximum (used by tunnelling tests). */
export function maxTuning(): Tuning {
  const t = cloneDefaults();
  for (const s of tuningSpecs) t[s.key] = s.max;
  return t;
}

/** Copy known, finite values from `source` into a fresh tuning, clamped to slider ranges. */
export function sanitizeTuning(source: unknown): Tuning {
  const t = cloneDefaults();
  if (typeof source !== 'object' || source === null) return t;
  const record = source as Record<string, unknown>;
  for (const s of tuningSpecs) {
    const v = record[s.key];
    if (typeof v === 'number' && Number.isFinite(v)) t[s.key] = Math.min(s.max, Math.max(s.min, v));
  }
  return t;
}
