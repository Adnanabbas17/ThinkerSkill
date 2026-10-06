import { describe, expect, it } from 'vitest';

// Guard: src/sim must stay free of Three.js so rules run headless and deterministic.
const THREE_IMPORT = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)['"]three(?:\/[^'"]*)?['"]/;

const sources = import.meta.glob<string>('./**/*.{ts,tsx,js,mjs}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('src/sim', () => {
  it('detects three imports (self-check of the guard)', () => {
    expect(THREE_IMPORT.test(`import * as THREE from 'three';`)).toBe(true);
    expect(THREE_IMPORT.test(`import { Mesh } from "three/webgpu";`)).toBe(true);
    expect(THREE_IMPORT.test(`const t = await import('three');`)).toBe(true);
    expect(THREE_IMPORT.test(`import { createRng } from './rng';`)).toBe(false);
  });

  it('has no file that imports three', () => {
    const files = Object.keys(sources);
    expect(files.length).toBeGreaterThan(0);
    const offenders = files.filter(
      (file) => !file.endsWith('/no-three.test.ts') && THREE_IMPORT.test(sources[file]),
    );
    expect(offenders).toEqual([]);
  });
});
