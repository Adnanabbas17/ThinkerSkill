import { testRoom } from './content/testRoom';
import { createInput } from './input/input';
import { createView, wantsForcedWebGL } from './render/scene';
import { advanceClock } from './sim/fixedStep';
import { createSim, stepSim } from './sim/sim';
import { createTuningPanel } from './tuning/panel';
import { loadTuning } from './tuning/storage';
import { createHud } from './ui/hud';

async function start(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const hud = createHud(document);

  try {
    const room = testRoom;
    const tuning = loadTuning();
    const view = await createView(canvas, wantsForcedWebGL(location.search), room);
    hud.setBackend(view.backend);
    const input = createInput(canvas);
    createTuningPanel(tuning);

    const state = createSim(room, 1);
    let acc = 0;
    let alpha = 1;
    let last: number | null = null;
    let paused = document.hidden;
    document.addEventListener('visibilitychange', () => {
      paused = document.hidden;
      last = null; // no catch-up burst when the tab comes back
    });

    await view.renderer.setAnimationLoop((now) => {
      const frameDt = last === null ? 0 : (now - last) / 1000;
      last = now;
      if (!paused) {
        const clock = advanceClock(acc, frameDt);
        acc = clock.acc;
        alpha = clock.alpha;
        for (let i = 0; i < clock.steps; i++) stepSim(state, input.sample(view.screenToFloor), tuning, room);
      }
      view.draw(state, alpha, frameDt, tuning);
      hud.frame(now, frameDt * 1000);
    });
  } catch (err) {
    console.error(err);
    hud.setBackend('unavailable (no WebGPU or WebGL 2)');
  }
}

void start();
