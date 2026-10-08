# Milestone 2 plan: the thinking loop

Status: **revision 3.** Slice 0 is built and its playtest passed. Arena Proposal A (40 x 32 m) and a Pulse range
of 14 m are approved. Proposal B (keep 40 x 28, move room N west) was rejected. Pulse range playtest passed.
Slice 1a is built and deployed. Its playtest found that camping just left of the start held cores A and B; fixed
by range (R6): `pulseRange` is now 10.5 m. Slice 1b is built and deployed, waiting for the owner's playtest of
endless waves, the hint line, run length and the 10.5 m range feel. Slice 2 is not started.

M1 acceptance: WAIVED. The 5-first-time-player test was not run. Owner
playtests passed (movement, dash, camera, hero, slice 0). Recorded risk:
the M2 acceptance test now doubles as the controls check.

Goal (from CLAUDE.md): full v1 scope in grey boxes, win and lose, debrief. Accepted when Bot A loses at least
9 of 10 seeds, Bot B wins at least 8 of 10, and 3 of 5 first-time players finish a run without help and start
a second run unprompted.

Ground rules for every slice:
- Grey boxes only. New objects (cores, doors, breakers, vents, terminals, source) are plain boxes and cylinders
  in PALETTE colours. Threat types are told apart by a tint and one shape cue, nothing more.
- All rules in `src/sim` (no Three.js, no DOM, seeded, deterministic). All feel values in `src/tuning`.
  All layouts and lists in `src/content`.
- Each slice ends with: build and tests green, deploy, a short "how to verify" list, and a stop for playtest
  when it touches controls or combat.
- Existing tests keep passing. Where a slice must change an existing test, it says which and why.

---

## 0. What in the current code must change (flagged, not changed)

| Area | Today | Needed for Milestone 2 | Slice |
|---|---|---|---|
| Enemy detour (`src/sim/enemies.ts`) | Pinned enemy slides toward the player's side; pairs converge on a box face and jam (README TODO) | Slide toward the nearer end of the face | 0 |
| Room type (`src/content/testRoom.ts`) | `Room` = bounds, static boxes, player start, spawn points | New `Arena` type with cores, doors, breakers, vents, terminals, source sites. `Room` stays for existing unit tests | 1a |
| Collision and shots (`collision.ts`, `projectiles.ts`) | Read only `room.obstacles` (static) | Also read closed doors from sim state (dynamic blockers) | 5 |
| Enemy targeting (`enemies.ts`) | Every enemy chases the player | Threats target cores (some chase the player), per-type behaviour | 1a, 3 |
| Enemy state (`types.ts`) | No type, no target | `type`, `disguised`, `revealed`, `targetCoreId` | 1a, 3, 4 |
| Weapon (`projectiles.ts`) | One gun, `shotDamage` hurts everything | 3 tool modes, energy, damage only with the correct counter | 3 |
| Input (`keys.ts`, `input.ts`, `TickInput`) | move, aim, dash, fire | Add `tool: 1 \| 2 \| 3` (keys 1/2/3) and `scan` (hold E). Also used to interact with breakers and vents | 3, 4 |
| Waves (`waves.ts`, `testWaves.ts`) | 3 fixed waves; clearing them = **win** | Endless, escalating waves with an onboarding ramp until the source is shut down; win comes from the source, not from waves | 1b, 5 |
| Win and lose (`sim.ts`, `enemies.ts`) | Lose when hero HP = 0 | Also lose when all 3 cores are lost; win when the source is shut down with at least 1 core online | 1a, 5 |
| Events (`SimEvent`) | Cleared every tick; no ids, no time, no truth flags | Persistent run log in `SimState` (`log: LoggedEvent[]` with tick), events carry ids and truth flags | 1b onward |
| HUD (`src/ui/hud.ts`) | HP, wave, try, banners | Core bars (reported integrity), energy, current tool, alarm feed, ramp hints, E prompt, scan progress, debrief screen | 1a to 7 |
| Game flow (`main.ts`) | R restarts after win or lose | End of run shows the debrief; R from the debrief starts a new run | 7 |
| Render (`scene.ts`) | Draws test room boxes, hero, robots, shots | Grey-box meshes for the new objects; robot tint per revealed type; disguised robots look like the base type | 1a to 6 |
| Tests that depend on the old flow | `waves.test.ts` expects "clear last wave = won" | Keep for the M1 test room (waves stay a valid sandbox mode) or retire when the test room is retired. Decision in Q8 | 1b |

Nothing here needs a new dependency or an asset file.

---

## 1. Slices (vertical, each playable and testable on its own)

Order principle: **build the pressure first, then the thinking that relieves it.** Cores and triage come first (slice 1 is split into 1a and 1b so each half stays small)
because every other skill is measured against them. Threat types and tools come before disguise, because a
disguise only makes sense once types differ. The source comes before clues, because clues point at it. The
debrief comes after all events exist. Bots are enforced last, but their harness starts as soon as a full run
is possible.

### Slice 0: enemy detour fix (prerequisite)
- **Files:** `src/sim/enemies.ts`, `src/sim/enemies.test.ts`.
- **Rule change:** when an enemy is pinned head-on against a box, it slides toward the nearer end of the face
  it is touching (ties broken by enemy id), not toward the player's side. Detour length stays 0.5 s.
- **Unit tests:** (1) two enemies pinned either side of a face's centre slide apart, never toward each other;
  (2) a single enemy pinned at a face's centre still gets around the box within 3 s; (3) the existing
  "get around a box hit head-on" test still passes.
- **Balance re-check:** rerun the stuck check (50 runs) and the bot balance table on the current test room.
  Then re-add M1's block 3 at (0, 4.5) in the stuck harness only, to prove the jam is gone. Report before and after.
- **Browser check:** stand straight behind a green block with robots coming from the other side; they split
  around it instead of piling up.

### Slice 1a: arena, 3 cores, lose condition
- **Files:** `src/content/arena.ts` (new: `Arena` type and the v1 arena), `src/sim/types.ts`, `src/sim/sim.ts`,
  `src/sim/cores.ts` (new), `src/sim/enemies.ts` (core targeting), `src/tuning/tuning.ts` (core HP, core damage),
  `src/render/scene.ts` (core boxes), `src/ui/hud.ts` (3 core bars), `src/main.ts` (use the arena).
- **Sim rules added:** cores have integrity 0 to 100; a threat touching a core damages it per second; a core at 0 is
  lost; threats pick a core target at spawn (weights in content); some threats chase the player; lose when all 3
  cores are lost. Waves stay the current finite list for now (temporary; clearing them still ends the run).
- **Unit tests:** core damage over time; core lost at 0 and stops taking damage; lose when all 3 lost and not before;
  targeting is seeded and repeatable; arena reachability (every spawn vent reaches every core and the player
  start) like `testRoom.test.ts`; arena camera check asserting the corrected claim in section 2 ("Arena layout"),
  with room interiors included in the standing points.
- **Browser check:** three grey core pillars with bars in the HUD; robots walk to cores and bars drop; let all
  three fall and the run ends with "All cores lost".
- **As built (owner-approved decisions):**
  - Target rule: at spawn, an enemy chases the hero with chance `chasePlayerShare` (0.25); otherwise it picks an
    online core by weight (equal for A, B, C). The target is fixed; if that core is lost, the enemy switches to
    the nearest core still online. Core attackers ignore the hero but still hurt it on contact, and stay
    against their core, clawing, until killed. `coreDamagePerSec` = 4 per touching enemy.
  - `chasePlayerShare` has one source of truth: tuning, for now. It moves to threat data (`ThreatDef`) when
    threat types arrive in slice 3.
  - Navigation: the slice 0 slide rule sent enemies into dead-end corners where a source room meets the outer
    wall (2 of 24 vent-to-core pairs never arrived; 7 of 24 with groups of 6). Fix: if the nearer end of a face
    is closed, slide towards the other end. Guarded by `src/sim/arenaNav.test.ts` (runs in CI): every vent to
    every core within 15 s and at most 4 s over a straight walk, groups of 6 within 20 s. Re-run it after any
    layout change. Still local steering; reconsider a grid flow field if slice 5 doors break it.
  - No invisible walls: the arena's obstacles are built from one tagged list of solids, the renderer draws one
    box per entry, and a test checks there is exactly one drawn part per obstacle. Vents, terminals and labels
    are never obstacles.
  - Cut to later slices: N/S/W/E floor labels (slice 5); doors, breakers, terminals, vent valves are data only.

### Slice 1b: endless waves, run log
- **Files:** `src/content/waves.ts` (new: endless schedule and onboarding ramp, section 2), `src/sim/waves.ts`,
  `src/sim/log.ts` (new: run log), `src/sim/types.ts`, `src/sim/sim.ts`, `src/ui/hud.ts` (ramp hint line),
  `src/sim/waves.test.ts` (the "clear the last wave = won" test moves to the M1 test-room fixture, see Q8).
- **Sim rules added:** waves never end and escalate; clearing waves no longer ends the run (until slice 5 the run
  only ends by losing); the onboarding ramp unlocks content at fixed times and emits a `hint` event; the run log
  records every event with its tick.
- **Unit tests:** waves keep spawning past the last scheduled entry and escalate; the ramp unlocks each item at
  its time and emits its hint once; run log keeps events across ticks in order and survives the end of a run.
- **Browser check:** play several minutes: waves keep coming and get denser; the one-line hint appears at the
  first ramp step without pausing play.

- **As built (owner-approved decisions):**
  - Run log: `SimState.log` holds every event with its tick, never cleared, kept after the run ends. `coreDamaged`
    is merged per core, cause and threat type over 60 ticks (one entry per second) and keeps its cause and enemy
    type (`threatType`, crawler for now); the amount is the exact sum.
  - Endless waves (arena only; `?room=test` keeps the finite M1 waves and their win): first spawn 1.5 s, gap
    between spawns shrinks linearly 3 s to 1 s over 300 s then holds, at most 20 enemies alive. Starting values;
    slice 8 tunes them. The run only ends by losing until slice 5.
  - Ramp: table in `src/content/waves.ts`; a step with `at: null` never fires. Only the crawler hint (0:00) is
    live; the other 5 steps get their times in the slice that builds the mechanic (3, 4, 5/6). The first hint
    reads "Shoot them (click)" instead of the plan's "Pulse (1)", because tool keys arrive in slice 3. HUD shows the
    hint for 6 s without pausing play; elapsed time replaces "wave n / 3" in endless mode.
  - Measured on the 10.5 m build (scratch bots, nothing committed): an idle hero (never moves or shoots) is
    destroyed after 11 to 31 s (median 15 s), by the 25% hero chasers. A camper at (-12, 0) that shoots the nearest
    enemy within range and never moves loses all 3 cores in 34 to 55 s over 10 seeds (0 cores alive at 3, 5 and 8
    minutes in 10 of 10 seeds). Camping the old A+B spot no longer works. Run length for real play is unmeasured:
    slice 2 (spread and alarms) and slice 8 (balance) tune it.

### Slice 2: damage spread and real alarms (triage)
- **Files:** `src/sim/cores.ts`, `src/content/arena.ts` (core links), `src/tuning/tuning.ts` (spread rate,
  threshold), `src/ui/hud.ts` (alarm feed), `src/ui/sfx.ts` (alarm beep), `src/render/scene.ts` (core flicker).
- **Sim rules added:** a core below the spread threshold (for example 50) leaks damage into its linked cores;
  an alarm event fires when a core starts taking damage, rate-limited per core.
- **Unit tests:** spread starts only below the threshold; spread stops when the core is repaired above it or lost;
  alarm fires once per attack start, not every tick; alarm carries `coreId` and `isFalse: false`.
- **Browser check:** leave one core alone until it drops below half; its neighbours start losing integrity
  without any robot on them; the HUD alarm feed shows "Core B under attack".

### Slice 3: three threat types, three tool modes, energy (correct counter)
- **Files:** `src/content/threats.ts` (new), `src/content/tools.ts` (new), `src/sim/types.ts`, `src/sim/projectiles.ts`
  (tool-aware hits), `src/sim/tools.ts` (new: energy, tool switch, coolant cone, EMP burst), `src/sim/enemies.ts`
  (per-type behaviour), `src/input/keys.ts`, `src/input/input.ts` (keys 1/2/3), `src/tuning/tuning.ts`,
  `src/render/scene.ts` (type tint, tool visuals as grey shapes), `src/ui/hud.ts` (tool + energy), `src/ui/sfx.ts`.
- **Sim rules added:** each threat type has exactly one counter tool; only the counter deals damage; any other tool
  spends energy and produces a `resisted` event; energy regenerates slowly; no energy means the tool does nothing.
- **Unit tests:** per type, the counter kills and the two wrong tools deal 0 damage; wrong-tool use spends energy and
  logs `resisted`; energy never goes below 0 or above max; tool switch takes effect next tick; determinism test
  extended with tool switching.
- **Browser check:** press 1/2/3 and see the HUD tool change; each threat colour dies only to its tool; firing the
  wrong tool shows "RESISTED" and drains the energy bar. **Stop for playtest** (combat changed).

### Slice 4: scanning, disguised threats, false alarms (critical thinking)
- **Files:** `src/sim/scan.ts` (new), `src/sim/enemies.ts`, `src/sim/cores.ts`, `src/content/waves.ts`
  (disguise share, false alarm cadence), `src/input/*` (hold E), `src/tuning/tuning.ts` (scan time, range,
  slow-down), `src/render/scene.ts` (disguised robots look like the base type until revealed), `src/ui/hud.ts`
  (scan progress ring, core bars show **reported** integrity, "FALSE ALARM" stamp after a core is checked).
- **Sim rules added:** holding E aimed at a threat within range for `scanTime` reveals its true type
  permanently; while scanning the hero moves slower and cannot fire; disguised threats show the base type until
  revealed. Each core now has **real** integrity (the sim value, used for all rules) and **reported** integrity
  (what the HUD and the bots see). Normally they are equal. False alarms are emitted on a seeded cadence for a
  core that is not being damaged; during a false alarm that core's reported integrity shows a spoofed drop
  while its real integrity does not change. A scan of that core, or a visit (hero within a few metres), resyncs
  reported to real and stamps the alarm as false. Real damage always updates both values.
- **Unit tests:** scan completes only after holding for `scanTime` on one target, resets if the aim leaves it;
  scan reveals and logs `threatScanned`; disguised threat still resists wrong tools even before it is revealed;
  a false alarm never changes real integrity; during a false alarm reported is below real and real is unchanged;
  a scan or a visit resyncs reported to real and logs `alarmChecked`; real damage during a false alarm lowers both;
  false alarm never starts on a core that is taking real damage; cadence is seeded and repeatable.
- **Browser check:** hold E on a robot and watch the ring fill and its tint change; a "Core C under attack" alarm
  whose bar drops while no robots are near C; walk to C or scan it and the bar jumps back and stamps
  "FALSE ALARM". **Stop for playtest** (controls changed).

### Slice 5: hidden source, breakers, doors, vent shutdown, win (problem solving core)
- **Files:** `src/content/arena.ts` (source sites, doors, breakers, vents), `src/sim/environment.ts` (new),
  `src/sim/collision.ts` and `src/sim/projectiles.ts` (closed doors block), `src/sim/waves.ts` (source drives the
  waves), `src/sim/sim.ts` (win), `src/render/scene.ts` (doors open and close, breaker and vent boxes),
  `src/ui/hud.ts` (interaction prompt), `src/sim/bots/botA.ts` + `src/sim/bots.test.ts` (report-only).
- **Sim rules added:** the source sits in one of 4 sealed rooms (seeded). Each room's door is held shut by one
  of 3 breakers. Flipping a breaker (hold E at it) cuts that breaker's power: the doors it holds open, and the
  core it also feeds loses cooling and takes spread damage until the breaker is flipped back. Inside the source
  room, holding E at the vent valve for a few seconds purges it and shuts the source down. Waves never end
  until then. Win when the source is shut down with at least 1 core online.
- **Unit tests:** doors block movement and shots only when closed; correct breaker opens the source room;
  wrong breaker opens a different room and starts cooling loss on its core; flipping back restores it; vent
  purge needs the full hold; win requires the source shut down and at least 1 core online; waves keep coming
  until the shutdown; source site is seeded and covers all 4 rooms across seeds.
- **Bot harness:** Bot A becomes runnable (report-only, does not fail the build yet).
- **Browser check:** find the room by trying breakers; a wrong breaker opens the wrong door and a core starts
  draining; the right one opens the source room; purge the vent and see "Source shut down".

### Slice 6: clues, true and false
- **Files:** `src/content/clues.ts` (new: clue templates), `src/content/arena.ts` (terminal positions),
  `src/sim/clues.ts` (new: seeded clue set per run), `src/sim/environment.ts` (read a terminal with E),
  `src/ui/hud.ts` (clue log panel, non-pausing), `src/render/scene.ts` (terminal boxes), `src/sim/bots/botB.ts` (report-only).
- **Sim rules added:** each run generates 6 clues from the seeded source site: 4 true, 2 false. True clues
  corroborate each other (each true fact appears in 2 clues). False clues are planted by the source and
  each contradicts at least one true clue. No false fact is ever stated twice, so "a fact stated by 2 different
  terminals is true" always holds. Reading a terminal takes a short hold and logs `clueRead` (the log keeps the
  truth flag for the debrief; bots and the HUD never see it).
- **Unit tests:** generator always yields exactly 4 true and 2 false; the true clues alone identify the source room
  and its breaker uniquely; every false clue contradicts a true one; same seed gives the same clue set.
- **Unit tests (also):** the corroboration rule picks the right room and breaker for every seed in a sample of 100.
- **Bot harness:** Bot B and Bot C become runnable (report-only). Report Bot C's win rate next to Bot B's.
- **Browser check:** read terminals; the clue panel lists them; two agreeing clues point at a room and its
  breaker; a lone clue that contradicts them is the false one.

### Slice 7: run log to debrief (scores, timeline, what was missed)
- **Files:** `src/sim/debrief.ts` (new: pure scoring from the run log), `src/sim/debrief.test.ts` (new),
  `src/ui/debrief.ts` + `src/ui/debrief.css` (new: plain HTML overlay), `src/main.ts` (end of run shows it; R from
  there restarts).
- **Sim rules added:** none in play; scoring functions only (section 3).
- **Unit tests:** each score from hand-built logs (perfect play = 100, worst play = 0); a component one below its
  minimum is skipped and the remaining weights renormalise (checked with exact numbers), and exactly at its minimum
  it counts; a skill whose components with data are worth less than half its weight shows "not enough data", and
  exactly half still scores; a skill with not enough data is left out of the rating; the rating shows "not enough
  data" when all three skills do; "what was missed" lists each item type; timeline is sorted and capped.
- **Browser check:** finish or lose a run; the debrief shows the timeline, missed items, three skill scores and
  the Thinker Skill rating; R starts a new run.

### Slice 8: balance pass and bot enforcement
- **Files:** `src/sim/bots.test.ts` (assertions on), `src/content/waves.ts`, `src/content/threats.ts`,
  `src/tuning/tuning.ts` (values only, each change proposed to the owner first).
- **Rules:** none new.
- **Tests:** Bot A loses at least 9 of 10 seeds; Bot B wins at least 8 of 10; median Bot B run between 6 and 10
  minutes (target 8). Bot C stays report-only and is never enforced.
- **Bot C check:** if Bot C wins within 2 of Bot B (clues barely matter), propose a higher wrong-breaker cost.
- **Alignment:** set the problem-solving par time and the 8-minute run target together here, from Bot B's
  median times, so a good run can reach full par score inside the target length.
- **Browser check:** full runs; then the 5-player acceptance test.

---

## 2. Data design for `src/content`

All types live next to their data. Sizes in metres, times in seconds.

### Arena (`arena.ts`)
```ts
interface Arena {
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  walls: Box[];                 // static cover and room walls (same Box as today)
  playerStart: Vec2;
  playerRadius: number;
  cores: CoreDef[];             // exactly 3
  coreLinks: [CoreId, CoreId][];// damage spread paths
  spawnVents: SpawnVent[];      // where threats enter
  sourceRooms: SourceRoom[];    // exactly 4 candidates
  breakers: BreakerDef[];       // exactly 3
  terminals: TerminalDef[];     // exactly 6 clue terminals
}
interface CoreDef { id: 'A' | 'B' | 'C'; pos: Vec2; radius: number }
interface SpawnVent { id: string; pos: Vec2 }
interface SourceRoom { id: 'N' | 'E' | 'S' | 'W'; walls: Box[]; door: DoorDef; ventValve: Vec2; sector: string }
interface DoorDef { id: string; box: Box; heldBy: BreakerId }
interface BreakerDef { id: 1 | 2 | 3; pos: Vec2; feedsCore: CoreId }
interface TerminalDef { id: string; pos: Vec2 }
```
- Layout rules from the M1 room carry over (2.5 m gaps, no closed pockets, reachability test).

### Arena layout (approved: Proposal A)
Size 40 x 32 m: x from -20 to 20, y from -16 to 16 (y points towards the camera). Centre positions, sizes in metres.
40 x 28 was rejected: with the 4 rooms fixed, no core placement met the rules (best shortest core-to-core walk 2.87 s,
under the 3 s minimum).

| Element | Position | Size |
|---|---|---|
| Core A (north) | (-8, -12.5) | 1.6 x 1.6 |
| Core B (south-west) | (-16, 12.5) | 1.6 x 1.6 |
| Core C (south-east) | (16, 12.5) | 1.6 x 1.6 |
| Room N / S | (0, -13.75) / (0, 13.75) | 7 x 4.5 |
| Room W / E | (-17.75, 0) / (17.75, 0) | 4.5 x 7 |
| Doors N / S / W / E | (0, -11.5), (0, 11.5), (-15.5, 0), (15.5, 0) | 2 m wide |
| Cover 1-4 | (-8, -5), (8, -5), (-8, 5), (8, 5) | 3 x 1 |
| Cover 5-8 | (-13, -9.5), (13, -9.5), (-9, 11), (9, 11) | 2 x 1.5 |
| Console | (0, 4); breakers 1/2/3 at x -1.5, 0, 1.5 on its north face | 5 x 0.6 |
| Spawn vents V1-V8 | (-18, -14), (18, -14), (-18, -7), (18, -7), (-18, 7), (18, 7), (-8, 14), (8, 14) | points |
| Terminals T1-T6 | (-13, -13.5), (13, -13.5), (-11, 1.5), (11, 1.5), (-12, 8), (12, 8) | floor pads |
| Floor labels N / S / W / E | (0, -9.5), (0, 9.5), (-13.5, 0), (13.5, 0) | about 1.5 m letters, flat, non-blocking |
| Floor labels A / B / C | (-8, -10), (-13.5, 12.5), (13.5, 12.5) | same |
| Player start | (0, 0) | - |

Measured with the default camera (height 16, back 9, FOV 50, 16:9):
- **Camera:** At most 1 core on screen from open floor. From inside room S, B and C both show. Never all 3 from
  anywhere.
- **Walks between cores (7 m/s, no dash):** A-B 3.50 s, A-C 4.55 s, B-C 4.29 s.
- **Pulse:** at the default 10.5 m, no core pair is coverable from any open-floor spot (rule test). See R6.
- **Gaps:** between solids 3.51 m; solids to outer wall 2.70 m; start clearance 3.70 m; vent clearance 2.00 m.
- **Reachability:** all vents, terminals and labels connect to the start; each core is approachable from 4 sides.
- Start to cores: A 2.0 s, B 2.8 s, C 2.8 s (information only).

### Pulse range
`pulseRange` = **10.5 m** (tuning, live-editable; was 14 m). A Pulse shot is removed once it has travelled
`pulseRange`. 10.5 m is the largest 0.5 m step at which no open-floor spot reaches enemies at 2 cores (see R6).
Rule test in `src/content/arena.test.ts`: it fails if any pair is coverable at the default range.
Trade-off: shots now end about 2.3 m before the top edge of the screen (11 m from the hero vs 13.3 m), so some visible threats are out of reach.
Range mechanism (14 m build): owner playtest **PASSED**, no fade or puff needed. The feel of **10.5 m is NOT yet
playtested**. It also applies in `?room=test`.

### Threats (`threats.ts`)
| Type | Grey-box look | Behaviour | Counter tool |
|---|---|---|---|
| Crawler | Current robot, brown | Walks to its target core and claws it | 1 Pulse |
| Overheater | Robot with red-orange dome tint, glows on the core | Heats a core: its damage also adds to spread | 2 Coolant |
| Relay | Robot with blue dome tint, antenna blinks | Fast and shielded | 3 EMP |
```ts
interface ThreatDef { type: 'crawler' | 'overheater' | 'relay'; counter: ToolId; hp: number; speed: number;
  coreDamagePerSec: number; chasesPlayerShare: number; canDisguise: boolean }
```
- Disguise: an Overheater or Relay can spawn disguised as a Crawler (same look). It keeps its real behaviour,
  counter and resistances. A scan reveals it. Crawlers never disguise.

### Tool modes (`tools.ts`)
| Key | Tool | Use | Energy |
|---|---|---|---|
| 1 | Pulse | Current gun (tracers) | Small cost per shot |
| 2 | Coolant | Short cone spray while held | Cost per second |
| 3 | EMP | Charged burst, short radius | Large cost per burst |
```ts
interface ToolDef { id: 1 | 2 | 3; name: string; energyCost: number; range: number; pattern: 'shot' | 'cone' | 'burst' }
```
- Only the counter deals damage. A wrong tool still costs energy and logs `resisted`. Energy regenerates slowly,
  so spamming the wrong tool leaves you unable to fight.

### False alarms and disguised threats (`waves.ts`)
```ts
interface WaveRules { baseInterval: number; escalationPerMinute: number;
  mix: { crawler: number; overheater: number; relay: number };   // weights, change over time
  disguiseShare: number;          // share of non-crawlers that spawn disguised, grows over time
  falseAlarmEverySec: [number, number]; // seeded range
  coreTargetWeights: Record<CoreId, number> }
```
- Waves are endless and escalate until the source is shut down. The source, not a wave count, ends them.

### Onboarding ramp (`waves.ts`)
Each mechanic first appears at a fixed time, with one non-pausing HUD line shown for about 6 s.
```ts
interface RampStep { at: number; unlock: 'crawler' | 'overheater' | 'relay' | 'sourceHunt' | 'disguise' | 'falseAlarms'; hint: string }
```
| Time | Unlock | Hint |
|---|---|---|
| 0:00 | Crawlers | "Crawlers are attacking the cores. Pulse (1) stops them." |
| 0:40 | Overheaters | "Overheaters resist Pulse. Only Coolant (2) works." |
| 1:20 | Relays | "Relays resist Pulse and Coolant. Only EMP (3) works." |
| 2:00 | Source hunt | "The waves won't stop until you shut down the source. Read terminals (E) to find it." |
| 2:45 | Disguise | "Some threats hide their type. Hold E on one to scan it." |
| 3:30 | False alarms | "Alarms can be spoofed. Visit or scan a core to check it." |

Before its step, an item never spawns or fires (terminals, breakers and vents are inert before the source hunt).
Times are first proposals; slice 8 tunes them with the run-length target.

### Clues (`clues.ts`)
```ts
type Fact = { kind: 'sourceIn'; room: RoomId } | { kind: 'sourceNotIn'; room: RoomId }
          | { kind: 'roomHeldBy'; room: RoomId; breaker: BreakerId };
interface ClueTemplate { fact: Fact['kind']; text: string }   // e.g. "Interference peaks in sector {room}"
interface Clue { id: string; terminal: string; fact: Fact; isTrue: boolean; text: string }
```
- Per run: 4 true clues (2 facts, each said twice in different words) and 2 false clues (each contradicts a true fact).

### E key priority
E means one thing at a time, chosen when the hold starts and locked until release:
1. **Interact** if an interactable is within reach (1.5 m): vent valve, then breaker, then terminal; nearest wins.
   Interactables are deliberate, close-range actions, so they come first.
2. Otherwise **scan the threat under the aim**: the threat nearest to the aim line within scan range and a small
   angle; ties go to the closer one.
3. Otherwise **scan the core under the aim** (within range).
4. Otherwise nothing.
The HUD shows what E will do ("E: scan", "E: flip breaker 2") before the hold starts.

### Hidden source and environment
- Source: one of the 4 rooms, chosen from the run seed. While active it keeps the waves coming.
- Doors: closed while their breaker is on; open when it is flipped off.
- Breakers: 3, each holds some doors shut and also cools one core. Flipping the wrong one opens a wrong
  room and starts a cooling loss on its core, so a wrong guess has a visible cost.
- Vents: one valve per source room; purging the source room's valve shuts the source down.

---

## 3. Debrief: events and scores

### Run log events (all carry `tick`)
| Event | Fields | Used for |
|---|---|---|
| `threatSpawned` | id, type, disguised, targetCore | timeline, denominators |
| `threatScanned` | id, type, wasDisguised | critical thinking |
| `toolSwitched` | from, to | timeline |
| `hit` | threatId, tool, correct | critical thinking |
| `resisted` | threatId, tool, energySpent | critical thinking, missed list |
| `threatKilled` | id, type, tool | timeline |
| `alarm` | id, coreId, isFalse | crisis, critical thinking |
| `alarmChecked` | alarmId, by: 'scan' \| 'visit', wasFalse | critical thinking |
| `coreDamaged` | coreId, amount, cause: 'threat' \| 'spread' \| 'cooling' | crisis |
| `coreLost` | coreId | crisis, missed list |
| `clueRead` | clueId, isTrue (debrief only) | problem solving |
| `hint` | rampStep | timeline (first appearances) |
| `breakerFlipped` | breakerId, on, correct | problem solving |
| `doorOpened` / `doorClosed` | doorId | timeline |
| `ventPurged` / `sourceShutdown` | roomId | problem solving |
| existing: `playerHurt`, `playerDestroyed`, `dash`, `fire` | | timeline (filtered) |
| `runEnded` | result, reason | header |

"Followed a false alarm" is derived: after a false `alarm`, the hero moved at least 6 m toward that core within 10 s
without first checking it. "Responded to a real alarm" is derived: the hero came within 5 m of that core within 15 s.

### Minimum sample sizes
A score built on too few events is noise, so each component has a minimum. A component below its minimum is
**skipped**, and the skill's weights are renormalised over the components that have data. A skill shows
**"not enough data"** only when the components that have data are worth **less than half** of its weight
(exactly half still scores). A skill with not enough data is left out of the rating; if all three lack data,
the rating shows "not enough data" too.

Examples: Critical thinking with only tool uses (weight 0.4) shows not enough data; tool uses plus false alarms
(0.7) scores, with weights 0.4/0.7 and 0.3/0.7. Crisis management with only average integrity (0.5) scores.

| Skill | Component | Minimum |
|---|---|---|
| Critical thinking | Tool uses (hits + resisted) | 10 |
| Critical thinking | Disguised threats engaged | 2 |
| Critical thinking | False alarms raised | 2 |
| Crisis management | Run time for average integrity | 60 s |
| Crisis management | Real alarms raised | 3 |
| Crisis management | Cores alive at the end | always available (3 cores) |
| Problem solving | Time since the source hunt started | 60 s |
| Problem solving | Shutdown, par time, wrong breakers | always available once the hunt has run 60 s |

### Scores (each 0 to 100)
- **Critical thinking** = 100 x (0.4 x correct-counter share of tool uses + 0.3 x share of disguised threats scanned
  before the first hit on them + 0.3 x share of false alarms not followed).
- **Crisis management** = 100 x (0.5 x average core integrity over the run + 0.3 x share of real alarms responded to
  within 15 s + 0.2 x share of cores alive at the end).
- **Problem solving** = 50 if the source was shut down, plus 25 x min(1, par time / shutdown time), where shutdown
  time is measured from the start of the source hunt and par is a first guess of 5 min (aligned in slice 8),
  plus 25 x (1 - wrong breaker flips / 3, floored at 0). False clues acted on (a wrong breaker flipped right after
  reading a false clue) are listed in "what was missed".
- **Thinker Skill rating** = mean of the skills that have enough data, shown as a number and a band (90+ Sharp, 70+ Solid, 50+ Shaky, below 50 Overwhelmed).
- **Decision timeline:** scans, tool switches that changed the outcome, alarms and responses, clue reads, breaker
  flips, door opens, core losses, shutdown. Capped at about 25 entries, most important first.
- **What was missed:** disguised threats hit before scanning, wrong-tool energy spent, false alarms followed, real
  alarms ignored, false clues acted on, cores lost.

All scoring is a pure function `debrief(log)` in `src/sim/debrief.ts`, so bots and unit tests can call it.

---

## 4. Bot A, Bot B and Bot C

Both bots are pure functions `(view, memory, rng) -> TickInput` in `src/sim/bots/`, used only by tests. A small
grid path planner (A* on a 0.5 m grid over the arena walls and closed doors) is shared. Each test runs 10 seeds.

Bots see only what a player sees: reported core integrity (not real), revealed threat types, clue texts. None of
them reads `isTrue` or any other hidden truth.

| | Bot A | Bot B | Bot C (report-only) |
|---|---|---|---|
| Observation | Live state, no delay | State delayed 18 ticks (300 ms) through a ring buffer | Same as Bot B |
| Aim | Exact | Angle noise of a few degrees per shot (seeded) | Same as Bot B |
| Target | Nearest threat | Threats on the most damaged core (by reported integrity) first, then the nearest | Same as Bot B |
| Tool | Uniform random per engagement | The counter for the revealed type | Same as Bot B |
| Scanning | Never | Scans any threat it has not revealed before engaging; checks alarms by visiting or scanning the core | Same as Bot B |
| Cores | Ignores them | Moves to defend the most damaged core when it is under attack | Same as Bot B |
| Clues | Ignores them | Reads terminals; trusts a fact only once 2 different terminals state it (corroboration rule) | Ignores them |
| Source | Walks to random rooms, flips random breakers, purges any valve it reaches | Flips the breaker the corroborated facts name, enters that room, purges the valve | Tries breakers in random order until a door to the source room opens |
| Goal | Lose at least 9 of 10 | Win at least 8 of 10 | Never enforced; compared with Bot B |
| First runnable | Slice 5 (report-only) | Slice 6 (report-only) | Slice 6 (report-only) |
| Enforced | Slice 8 | Slice 8 | Never |

Bot C exists to show that clues matter. From slice 6, its win rate is reported next to Bot B's. If Bot C wins
within 2 of Bot B, slice 8 proposes a higher wrong-breaker cost.

Why Bot A should lose: two thirds of its tool picks are wrong and burn energy, disguised threats waste even its
right picks, random breakers drain cores, and nothing defends the cores.

---

## 5. Prerequisite: slice 0

See slice 0 above. It is first because every new room layout (arena walls, source rooms, cores) creates more
box faces on enemy paths, and the current rule jams pairs of enemies on any box sitting across a path.
Done when: the new unit tests pass, the stuck check shows no case over 5 s and no jam on a box (including with
M1's block 3 put back in the harness), and the bot balance table on the current room moves by no more than one
win per bot.

---

## 6. Risks and open questions (with recommended answers)

| # | Question or risk | Recommendation |
|---|---|---|
| Q1 | Milestone 1 acceptance (5 first-time players) | **Decided:** waived. See the status note at the top. |
| Q2 | Arena size | **Decided:** 40 x 32 m (Proposal A); Pulse range now 10.5 m (R6). 40 x 28 could not meet the layout rules. See section 2, "Arena layout". |
| Q3 | How can a human tell a false alarm? | **Decided:** the alarmed core's HUD bar shows a spoofed drop (reported integrity) while real integrity is unchanged. Only a scan of the core or a visit reveals the true value. Real damage always shows. |
| Q4 | How can a human tell a false clue? | Corroboration: true facts appear twice, false ones once and contradict a true one. Scanning stays for threats only. |
| Q5 | Wrong tool effect | 0 damage, energy spent, "RESISTED" shown. Clear feedback beats partial damage. |
| Q6 | Does Pulse cost energy? | Yes, a small amount. Otherwise Pulse becomes free spam and the energy rule only bites on 2 and 3. |
| Q7 | Wrong breaker cost | Cooling loss on that breaker's core until flipped back. Visible, recoverable and tied to triage. |
| Q8 | Keep the M1 test room? | Keep it as a unit-test fixture and as `?room=test` for feel tuning; the game starts in the arena. |
| Q9 | How does Bot B know which clues are true? | **Decided:** it never reads `isTrue`. It uses the corroboration rule (trust a fact stated by 2 different terminals), the same reasoning a player can use. |
| Q10 | Run length target of 8 min | Escalation plus par time; no hard timer. Par time and the run-length target are aligned together in slice 8 from Bot B's median times. |
| Q11 | Score weights | Use the ones in section 3 now; retune after playtests. |
| Q12 | Visual exceptions already approved (hero model, robots, tracers, palette) vs "grey boxes" | Keep what exists; all new objects are grey boxes. |
| Q13 | Spoofed bars could feel unfair if they look exactly like real damage | Keep one honest cue: a real attack also triggers the core's grey-box flicker in the world; a spoof only changes the HUD bar. Confirm in the slice 4 playtest. |
| Q14 | **Open, decide in slice 1b:** should scanning need line of sight and a range limit, so room S cannot be used to scan threats at B and C from safety? | No code now. |
| R1 | Biggest milestone so far: 10 slices (0, 1a, 1b, 2 to 8) with many new rules | Strict slice order; each slice stays playable; stop for playtest after slices 3 and 4. |
| R2 | Balance churn between slices | Bots report from slice 5 so problems show early; tuning changes always proposed first. |
| R3 | Players miss the point of scanning | Disguise share starts at 0 and grows; first disguised threat appears only after the player has seen all 3 types. |
| R4 | Run log growth over 8 min | Roughly a few thousand entries; fine for memory and the determinism test. |
| R5 | Performance with more objects | All grey boxes share geometry and materials (as the robots do); check fps in slice 5 and 8. |
| R6 | **Resolved by range.** Slice 1a playtest: camping just left of the start held A and B at 14 m. With real reach (hero centre to enemy centre = 0.5 m muzzle + range + 0.57 m hit radius, enemy touching the near side of a core, cover ignored), pairs become coverable at: A+B 10.61 m (from (-12, 0)), B+C 13.70 m, A+C 14.68 m. Default set to 10.5 m (0.11 m margin on A+B); no pair is coverable from any open-floor spot. Enemies still walking to a core can be shot earlier; the rule covers enemies already at a core. | Rule test guards it. Playtest the 10.5 m feel. Layout unchanged. |
