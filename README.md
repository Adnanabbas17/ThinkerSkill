# Thinker Skill

A browser 3D top-down action game. You play ThinkerFighter, a response engineer, in a reactor facility in meltdown. Reflexes create the pressure; critical thinking, triage, and problem solving win the run. Each run ends with a per-skill debrief.

**Status:** Milestone 1 (feel prototype, grey boxes) in progress.

## Controls

- WASD: move
- Mouse: aim
- Left click (hold): fire
- Shift: dash (in the move direction, or towards the aim when standing still)
- R: restart after the run is cleared or lost
- M: mute or unmute (placeholder sounds)
- ` (backquote): tuning panel (sliders, reset, copy as JSON; values are saved in this browser)

**Test room:** survive 3 waves of crawler drones (3, 5, 8). Clear them all to clear the room. Lose all HP and you are destroyed.

**Live:** https://adnanabbas17.github.io/ThinkerSkill/
(add `?forceWebGL=1` to force the WebGL 2 backend)

## Commands

Requires Node 22.12 or newer.

```bash
npm install       # install dependencies
npm run dev       # dev server at http://localhost:5173
npm test          # unit tests (Vitest)
npm run build     # type-check and build to dist/
npm run preview   # serve dist/ at http://localhost:4173
```

Pushing to `main` runs tests, builds, and deploys `dist/` to GitHub Pages. You can also run the deploy manually from the Actions tab.

## Stack

TypeScript, Vite, Three.js (`WebGPURenderer` with WebGL 2 fallback), Vitest. Plain HTML and CSS for the HUD.

Asset credits: see [ASSETS.md](ASSETS.md).

## Known issues

- WebGPU device loss leaves a frozen canvas with a misleading fps; fix planned for a later milestone.
