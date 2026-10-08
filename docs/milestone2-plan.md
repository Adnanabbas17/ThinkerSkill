# Milestone 2 plan: the thinking loop

Status: **draft for owner approval.** Nothing in this plan is built yet.

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
| Room type (`src/content/testRoom.ts`) | `Room` = bounds, static boxes, player start, spawn points | New `Arena` type with cores, doors, breakers, vents, terminals, source sites. `Room` stays for existing unit tests | 1 |
| Collision and shots (`collision.ts`, `projectiles.ts`) | Read only `room.obstacles` (static) | Also read closed doors from sim state (dynamic blockers) | 5 |
| Enemy targeting (`enemies.ts`) | Every enemy chases the player | Threats target cores (some chase the player), per-type behaviour | 1, 3 |
| Enemy state (`types.ts`) | No type, no target | `type`, `disguised`, `revealed`, `targetCoreId` | 1, 3, 4 |
| Weapon (`projectiles.ts`) | One gun, `shotDamage` hurts everything | 3 tool modes, energy, damage only with the correct counter | 3 |
| Input (`keys.ts`, `input.ts`, `TickInput`) | move, aim, dash, fire | Add `tool: 1 \| 2 \| 3` (keys 1/2/3) and `scan` (hold E). Also used to interact with breakers and vents | 3, 4 |
| Waves (`waves.ts`, `testWaves.ts`) | 3 fixed waves; clearing them = **win** | Endless, escalating waves until the source is shut down; win comes from the source, not from waves | 1, 5 |
| Win and lose (`sim.ts`, `enemies.ts`) | Lose when hero HP = 0 | Also lose when all 3 cores are lost; win when the source is shut down with at least 1 core online | 1, 5 |
| Events (`SimEvent`) | Cleared every tick; no ids, no time, no truth flags | Persistent run log in `SimState` (`log: LoggedEvent[]` with tick), events carry ids and truth flags | 1 onward |
| HUD (`src/ui/hud.ts`) | HP, wave, try, banners | Core bars, energy, current tool, alarm feed, scan progress, debrief screen | 1 to 7 |
| Game flow (`main.ts`) | R restarts after win or lose | End of run shows the debrief; R from the debrief starts a new run | 7 |
| Render (`scene.ts`) | Draws test room boxes, hero, robots, shots | Grey-box meshes for the new objects; robot tint per revealed type; disguised robots look like the base type | 1 to 6 |
| Tests that depend on the old flow | `waves.test.ts` expects "clear last wave = won" | Keep for the M1 test room (waves stay a valid sandbox mode) or retire when the test room is retired. Decision in Q8 | 5 |

Nothing here needs a new dependency or an asset file.

---

## 1. Slices (vertical, each playable and testable on its own)

Order principle: **build the pressure first, then the thinking that relieves it.** Cores and triage come first
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

### Slice 1: arena, 3 cores, core-targeting threats, lose on all cores lost
- **Files:** `src/content/arena.ts` (new: `Arena` type and the v1 arena), `src/content/waves.ts` (new: endless
  wave schedule, see section 2), `src/sim/types.ts`, `src/sim/sim.ts`, `src/sim/cores.ts` (new),
  `src/sim/enemies.ts` (targeting), `src/sim/waves.ts` (endless schedule), `src/sim/log.ts` (new: run log),
  `src/tuning/tuning.ts` (core HP, core damage), `src/render/scene.ts` (core boxes), `src/ui/hud.ts` (3 core bars), `src/main.ts` (use the arena).
- **Sim rules added:** cores have integrity 0 to 100; a threat touching a core damages it per second; a core at 0 is
  lost; threats pick a core target at spawn (weights in content); some threats chase the player; lose when all 3
  cores are lost; the run log records every event with its tick.
- **Unit tests:** core damage over time; core lost at 0 and stops taking damage; lose when all 3 lost and not before;
  targeting is seeded and repeatable; run log keeps events across ticks in order; arena reachability (every spawn
  vent reaches every core and the player start) like `testRoom.test.ts`.
- **Browser check:** three grey core pillars with bars in the HUD; robots walk to cores and bars drop; let all
  three fall and the run ends with "All cores lost".

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
  (scan progress ring, "FALSE ALARM" stamp after a core is checked).
- **Sim rules added:** holding E aimed at a threat within range for `scanTime` reveals its true type
  permanently; while scanning the hero moves slower and cannot fire; disguised threats show the base type until
  revealed; false alarms are emitted on a seeded cadence for cores that are not being damaged. Scanning a core
  (or standing next to it) confirms an alarm as false.
- **Unit tests:** scan completes only after holding for `scanTime` on one target, resets if the aim leaves it;
  scan reveals and logs `threatScanned`; disguised threat still resists wrong tools even before it is revealed;
  false alarm never coincides with real damage on that core; false alarm cadence is seeded and repeatable.
- **Browser check:** hold E on a robot and watch the ring fill and its tint change; a "Core C under attack" alarm
  with a calm bar and no robots near C, then scanning C stamps "FALSE ALARM". **Stop for playtest** (controls changed).

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
  each contradicts at least one true clue. Reading a terminal takes a short hold and logs `clueRead` with its truth flag.
- **Unit tests:** generator always yields exactly 4 true and 2 false; the true clues alone identify the source room
  and its breaker uniquely; every false clue contradicts a true one; same seed gives the same clue set.
- **Bot harness:** Bot B becomes runnable (report-only).
- **Browser check:** read terminals; the clue panel lists them; two agreeing clues point at a room and its
  breaker; a lone clue that contradicts them is the false one.

### Slice 7: run log to debrief (scores, timeline, what was missed)
- **Files:** `src/sim/debrief.ts` (new: pure scoring from the run log), `src/sim/debrief.test.ts` (new),
  `src/ui/debrief.ts` + `src/ui/debrief.css` (new: plain HTML overlay), `src/main.ts` (end of run shows it; R from
  there restarts).
- **Sim rules added:** none in play; scoring functions only (section 3).
- **Unit tests:** each score from hand-built logs (perfect play = 100, worst play = 0, empty components are
  skipped, not counted as zero); "what was missed" lists each item type; timeline is sorted and capped.
- **Browser check:** finish or lose a run; the debrief shows the timeline, missed items, three skill scores and
  the Thinker Skill rating; R starts a new run.

### Slice 8: balance pass and bot enforcement
- **Files:** `src/sim/bots.test.ts` (assertions on), `src/content/waves.ts`, `src/content/threats.ts`,
  `src/tuning/tuning.ts` (values only, each change proposed to the owner first).
- **Rules:** none new.
- **Tests:** Bot A loses at least 9 of 10 seeds; Bot B wins at least 8 of 10; median Bot B run between 6 and 10
  minutes (target 8).
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
- Proposed size 40 x 28 m (today 30 x 20). Cores in a triangle around the centre, about 9 m apart. The 4 source
  rooms sit in the middle of each edge, each 6 x 4 m with one door facing inward. Breakers sit together in a
  small control area so flipping one is a visible, deliberate trip. Terminals are spread so reading all 6 costs
  real time.
- Layout rules from the M1 room carry over (2.5 m gaps, no closed pockets, reachability test).

### Threats (`threats.ts`)
| Type | Grey-box look | Behaviour | Counter tool |
|---|---|---|---|
| Crawler | Current robot, brown | Walks to its target core and claws it | 1 Pulse |
| Overheater | Robot with red-orange dome tint, glows on the core | Heats a core: its damage also adds to spread | 2 Coolant |
| Relay | Robot with blue dome tint, antenna blinks | Fast, shielded; also flips the nearest open door shut | 3 EMP |
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

### Clues (`clues.ts`)
```ts
type Fact = { kind: 'sourceIn'; room: RoomId } | { kind: 'sourceNotIn'; room: RoomId }
          | { kind: 'roomHeldBy'; room: RoomId; breaker: BreakerId };
interface ClueTemplate { fact: Fact['kind']; text: string }   // e.g. "Interference peaks in sector {room}"
interface Clue { id: string; terminal: string; fact: Fact; isTrue: boolean; text: string }
```
- Per run: 4 true clues (2 facts, each said twice in different words) and 2 false clues (each contradicts a true fact).

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
| `alarmChecked` | alarmId, by: 'scan' \| 'visit' | critical thinking |
| `coreDamaged` | coreId, amount, cause: 'threat' \| 'spread' \| 'cooling' | crisis |
| `coreLost` | coreId | crisis, missed list |
| `clueRead` | clueId, isTrue | problem solving |
| `breakerFlipped` | breakerId, on, correct | problem solving |
| `doorOpened` / `doorClosed` | doorId | timeline |
| `ventPurged` / `sourceShutdown` | roomId | problem solving |
| existing: `playerHurt`, `playerDestroyed`, `dash`, `fire` | | timeline (filtered) |
| `runEnded` | result, reason | header |

"Followed a false alarm" is derived: after a false `alarm`, the hero moved at least 6 m toward that core within 10 s
without first checking it. "Responded to a real alarm" is derived: the hero came within 5 m of that core within 15 s.

### Scores (each 0 to 100; a component with no data is skipped and the weights renormalised)
- **Critical thinking** = 100 x (0.4 x correct-counter share of tool uses + 0.3 x share of disguised threats scanned
  before the first hit on them + 0.3 x share of false alarms not followed).
- **Crisis management** = 100 x (0.5 x average core integrity over the run + 0.3 x share of real alarms responded to
  within 15 s + 0.2 x share of cores alive at the end).
- **Problem solving** = 50 if the source was shut down, plus 25 x min(1, par time / shutdown time) with par = 4 min,
  plus 25 x (1 - wrong breaker flips / 3, floored at 0). False clues acted on (a wrong breaker flipped right after
  reading a false clue) are listed in "what was missed".
- **Thinker Skill rating** = mean of the three, shown as a number and a band (90+ Sharp, 70+ Solid, 50+ Shaky, below 50 Overwhelmed).
- **Decision timeline:** scans, tool switches that changed the outcome, alarms and responses, clue reads, breaker
  flips, door opens, core losses, shutdown. Capped at about 25 entries, most important first.
- **What was missed:** disguised threats hit before scanning, wrong-tool energy spent, false alarms followed, real
  alarms ignored, false clues acted on, cores lost.

All scoring is a pure function `debrief(log)` in `src/sim/debrief.ts`, so bots and unit tests can call it.

---

## 4. Bot A and Bot B

Both bots are pure functions `(view, memory, rng) -> TickInput` in `src/sim/bots/`, used only by tests. A small
grid path planner (A* on a 0.5 m grid over the arena walls and closed doors) is shared. Each test runs 10 seeds.

| | Bot A | Bot B |
|---|---|---|
| Observation | Live state, no delay | State delayed 18 ticks (300 ms) through a ring buffer |
| Aim | Exact | Angle noise of a few degrees per shot (seeded) |
| Target | Nearest threat | Threats on the most damaged core first, then the nearest |
| Tool | Uniform random per engagement | The counter for the revealed type |
| Scanning | Never | Scans any threat it has not revealed before engaging; checks alarms by visiting or scanning the core |
| Cores | Ignores them | Moves to defend the most damaged core when it is under attack |
| Clues | Ignores them | Reads terminals; acts only on true clues (uses the `isTrue` flag as an oracle for "reasons correctly") |
| Source | Walks to random rooms, flips random breakers, purges any valve it reaches | Flips the breaker the true clues name, enters that room, purges the valve |
| Must | Lose at least 9 of 10 | Win at least 8 of 10 |
| First runnable | Slice 5 (report-only) | Slice 6 (report-only) |
| Enforced | Slice 8 | Slice 8 |

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
| Q1 | Milestone 1 acceptance (5 first-time players) has not been reported. CLAUDE.md says one milestone at a time. | Run the M1 playtest before slice 1, or explicitly waive it. Slice 0 can start now. |
| Q2 | Arena size | 40 x 28 m. Big enough for 4 rooms, 3 cores and 6 terminals with 2.5 m lanes; the camera already follows. |
| Q3 | How can a human tell a false alarm? | Core bars are always truthful; a false alarm has no damage behind it. Checking costs a glance or a short scan. Simple, fair and teachable. |
| Q4 | How can a human tell a false clue? | Corroboration: true facts appear twice, false ones once and contradict a true one. Scanning stays for threats only. |
| Q5 | Wrong tool effect | 0 damage, energy spent, "RESISTED" shown. Clear feedback beats partial damage. |
| Q6 | Does Pulse cost energy? | Yes, a small amount. Otherwise Pulse becomes free spam and the energy rule only bites on 2 and 3. |
| Q7 | Wrong breaker cost | Cooling loss on that breaker's core until flipped back. Visible, recoverable and tied to triage. |
| Q8 | Keep the M1 test room? | Keep it as a unit-test fixture and as `?room=test` for feel tuning; the game starts in the arena. |
| Q9 | Bot B using the clue truth flag | Accept it as an oracle for "reasons correctly". Bot B still has to walk, read and act like a player. |
| Q10 | Run length target of 8 min | Escalation plus par time; no hard timer. Check the median Bot B run in slice 8. |
| Q11 | Score weights | Use the ones in section 3 now; retune after playtests. |
| Q12 | Visual exceptions already approved (hero model, robots, tracers, palette) vs "grey boxes" | Keep what exists; all new objects are grey boxes. |
| R1 | Biggest milestone so far: 9 slices with many new rules | Strict slice order; each slice stays playable; stop for playtest after slices 3 and 4. |
| R2 | Balance churn between slices | Bots report from slice 5 so problems show early; tuning changes always proposed first. |
| R3 | Players miss the point of scanning | Disguise share starts at 0 and grows; first disguised threat appears only after the player has seen all 3 types. |
| R4 | Run log growth over 8 min | Roughly a few thousand entries; fine for memory and the determinism test. |
| R5 | Performance with more objects | All grey boxes share geometry and materials (as the robots do); check fps in slice 5 and 8. |
