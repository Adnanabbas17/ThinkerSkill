import { cloneDefaults, sanitizeTuning, type Tuning } from './tuning';

const STORAGE_KEY = 'thinkerskill.tuning.v1';

export function loadTuning(): Tuning {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizeTuning(JSON.parse(raw)) : cloneDefaults();
  } catch {
    return cloneDefaults();
  }
}

export function saveTuning(t: Tuning): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(t));
  } catch {
    // Storage blocked (private mode etc.): values still apply for this session.
  }
}
