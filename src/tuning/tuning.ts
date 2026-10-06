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
