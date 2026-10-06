import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the same build works on GitHub Pages (subpath) and itch.io.
  base: './',
  test: {
    environment: 'node',
  },
});
