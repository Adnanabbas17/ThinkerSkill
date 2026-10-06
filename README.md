# Thinker Skill

A browser 3D top-down action game. You pilot a "Thinker" response drone through a reactor facility in meltdown. Reflexes create the pressure; critical thinking, triage, and problem solving win the run. Each run ends with a per-skill debrief.

**Status:** Milestone 0 (scaffold). The page shows a rotating test cube, an fps counter, and the active render backend.

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
