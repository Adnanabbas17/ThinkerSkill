import { createCubeScene, wantsForcedWebGL } from './render/scene';
import { createHud } from './ui/hud';
import { tuning } from './tuning/tuning';

async function start(): Promise<void> {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const hud = createHud(document);

  try {
    const view = await createCubeScene(canvas, wantsForcedWebGL(location.search));
    hud.setBackend(view.backend);

    let last = performance.now();
    await view.renderer.setAnimationLoop((now) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      view.frame(dt, tuning.cubeSpinSpeed);
      hud.tick(now);
    });
  } catch (err) {
    console.error(err);
    hud.setBackend('unavailable (no WebGPU or WebGL 2)');
  }
}

void start();
