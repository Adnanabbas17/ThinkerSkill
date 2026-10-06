# Thinker Skill: project instructions

## Product
Browser 3D top-down action game (twin-stick style). The player pilots a "Thinker" response drone inside a reactor facility in meltdown. One run lasts about 8 minutes.
- Win: shut down the hidden source of the crisis with at least 1 of 3 reactor cores still online.
- Lose: the Thinker is destroyed or all 3 cores are lost.
- Every run ends with a debrief: decision timeline, what was missed, one score per skill, and a total "Thinker Skill" rating.

## Design law: reflexes create pressure, thinking wins
- Critical thinking: alerts and threats can mislead (false alarms, disguised threat types). Each threat type has one correct counter. Scanning reveals the truth but costs time. Wrong guesses waste limited energy.
- Crisis management: 3 cores are attacked at once and damage spreads. The player cannot save everything and must triage in real time.
- Problem solving: waves never end until the source is found and shut down using the environment (doors, breakers, vents). Clues point to it. Some clues are false.
- No quizzes, lectures, or pop-ups that pause play. If a skill is not exercised by a mechanic, it is not in the game.

## v1 scope
- 1 arena, 1 hero, 3 threat types, 3 tool modes, 3 cores, 1 hidden source per run (position seeded).
- Controls: WASD move, mouse aim, left click fire, Shift dash, 1/2/3 tool mode, hold E to scan.
- No humanoid characters. Hero and enemies are machines animated in code (no skeletal animation).

## Hard constraints
- Static site only. No backend, accounts, API keys, or paid services. Saves use localStorage.
- Host: GitHub Pages from a public repo, deployed by GitHub Actions. Also uploadable to itch.io: one index.html, relative paths, under 1,000 files.
- Size: under 100 MB total, under 15 MB downloaded before the game is playable.
- Speed: 60 fps at 1080p on a laptop with integrated graphics at Medium quality. If a visual feature breaks this, cut the feature.
- Platform for v1: desktop Chrome, Edge, Firefox, Safari. Keyboard and mouse.
- Assets: CC0 or self-made only. Log each asset, source URL, and license in ASSETS.md.

## Stack (ask before changing)
- TypeScript, Vite, Three.js with WebGPURenderer (automatic WebGL 2 fallback), Vitest.
- Plain HTML and CSS for the HUD. No other frameworks.
- Use the three/webgpu entry point and TSL for shaders and post-processing. Do not mix in WebGLRenderer-only code (GLSL ShaderMaterial, EffectComposer).
- Check the docs of the installed Three.js version before using any API.

## Architecture
- src/sim: all game rules. Fixed 60 Hz timestep. Gameplay happens on a 2D plane with circle and box collisions. No physics engine. No Three.js or DOM imports. Deterministic with seeded random. Emits events for the debrief.
- src/input: turns keyboard and mouse into one input state per tick.
- src/render: draws sim state in 3D with interpolation. Never changes rules.
- src/ui: HUD, menus, debrief.
- src/content: arena, threats, and waves as data files.
- src/tuning: every feel value (speeds, dash, cooldowns, damage, shake) in one config, editable live in a dev panel toggled by a key.

## Tests
- Every sim rule has a unit test.
- Bot A (perfect aim, zero reaction delay, attacks the nearest target with a random tool, never scans, searches for the source at random) must lose on at least 9 of 10 test seeds.
- Bot B (300 ms reaction delay, imperfect aim, scans before acting, uses the correct counter, defends the most damaged core, follows true clues) must win on at least 8 of 10 test seeds.

## Graphics target
Stylized high-quality 3D, not photorealism: PBR materials, real-time shadows, bloom, tone mapping, particle fire, smoke and sparks, emissive alarm lighting.
Action feedback: hit flash, screen shake, knockback, muzzle and impact particles.
Low, Medium, High quality setting. No graphics work before Milestone 2 is accepted.

## Milestones (one at a time; I approve each before the next starts)
0. Scaffold: build and tests pass, empty scene is live on GitHub Pages.
1. Feel prototype (grey boxes): move, aim, dash, one tool, one enemy, tuning panel, placeholder sounds. Accepted when 3 of 5 first-time players clear the test room within 3 tries and none call the controls laggy or confusing.
2. Thinking loop (grey boxes): full v1 scope, win and lose, debrief. Accepted when both bot tests pass and 3 of 5 first-time players finish a run without help and start a second run unprompted.
3. Graphics and sound pass: the target above at 60 fps.
4. Release: itch.io page, README, credits.

## Not in v1
Multiplayer, leaderboards, mobile and touch, gamepad, story campaign, voice acting, humanoid characters, a second arena, bosses, monetization.

## Definition of done for v1
A stranger opens a public URL in a desktop browser, plays a full run with no help from me, gets a per-skill debrief, and the game holds 60 fps.

## How to work with me
- I judge game feel by playing. After any change to controls, combat, or camera, stop and ask me to playtest before building on it.
- Inspect existing code before changing it. No unrelated refactors. Never break a working feature.
- For any change touching more than 3 files: show the plan and file list first, then wait for my approval.
- After every change: run build and tests, report the results, and tell me exactly how to verify it in the browser.
- Small commits with clear messages.
- If my request adds scope, breaks a constraint, or is a bad idea, say so first and offer the simpler option.
- Be direct and brief. Separate facts, assumptions, and opinions. Ask instead of guessing.
