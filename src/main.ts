import { chooseRoom, isArena } from './content/arena';
import { endlessRules, rampHint } from './content/waves';
import type { Room } from './content/testRoom';
import { testWaves } from './content/testWaves';
import { createInput } from './input/input';
import { createView, wantsForcedWebGL } from './render/scene';
import { advanceClock } from './sim/fixedStep';
import { createSim, stepSim } from './sim/sim';
import type { SimEvent } from './sim/types';
import { createTuningPanel } from './tuning/panel';
import { loadTuning } from './tuning/storage';
import { createHud } from './ui/hud';
import { createSfx } from './ui/sfx';

/** The arena runs endless waves; the M1 test room keeps its three finite waves. */
const newRun = (room: Room, seed: number) => (isArena(room) ? createSim(room, seed, [], endlessRules) : createSim(room, seed, testWaves));

async function start(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const hud = createHud(document);

  try {
    const room = chooseRoom(location.search);
    const tuning = loadTuning();
    const view = await createView(canvas, wantsForcedWebGL(location.search), room);
    hud.setBackend(view.backend);
    const input = createInput(canvas);
    createTuningPanel(tuning);
    const sfx = createSfx();

    // New seed each try so spawns differ; R restarts once the run has ended.
    let tryNumber = 1;
    let state = newRun(room, tryNumber);
    const frameEvents: SimEvent[] = [];
    let acc = 0;
    let alpha = 1;
    let last: number | null = null;
    let paused = document.hidden;
    document.addEventListener('visibilitychange', () => {
      paused = document.hidden;
      last = null; // no catch-up burst when the tab comes back
    });
    window.addEventListener('keydown', (e) => {
      if (e.code !== 'KeyR' || e.repeat || state.status === 'playing') return;
      tryNumber++;
      state = newRun(room, tryNumber);
      hud.clearHint();
      acc = 0;
    });

    await view.renderer.setAnimationLoop((now) => {
      const frameDt = last === null ? 0 : (now - last) / 1000;
      last = now;
      if (!paused) {
        const clock = advanceClock(acc, frameDt);
        acc = clock.acc;
        alpha = clock.alpha;
        for (let i = 0; i < clock.steps; i++) {
          stepSim(state, input.sample(view.screenToFloor), tuning, room);
          frameEvents.push(...state.events);
        }
      }
      view.draw(state, alpha, frameDt, tuning, frameEvents);
      for (const e of frameEvents) if (e.type === 'hint') hud.showHint(rampHint(e.step), now);
      sfx.play(frameEvents);
      frameEvents.length = 0;
      hud.game(state, tuning, tryNumber);
      hud.frame(now, frameDt * 1000);
    });
  } catch (err) {
    console.error(err);
    hud.setBackend('unavailable (no WebGPU or WebGL 2)');
  }
}

void start();
