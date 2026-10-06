import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  WebGPURenderer,
} from 'three/webgpu';

export type BackendName = 'WebGPU' | 'WebGL 2';

export interface CubeScene {
  renderer: WebGPURenderer;
  backend: BackendName;
  /** Advance the demo by dt seconds and draw one frame. */
  frame(dt: number, spinSpeed: number): void;
}

/** `?forceWebGL=1` in the URL forces the WebGL 2 backend. */
export function wantsForcedWebGL(search: string): boolean {
  return new URLSearchParams(search).get('forceWebGL') === '1';
}

export async function createCubeScene(canvas: HTMLCanvasElement, forceWebGL: boolean): Promise<CubeScene> {
  const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  await renderer.init();

  const backend: BackendName = 'isWebGPUBackend' in renderer.backend ? 'WebGPU' : 'WebGL 2';

  const scene = new Scene();
  scene.background = new Color(0x101418);

  const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.5, 4);
  camera.lookAt(0, 0, 0);

  scene.add(new AmbientLight(0xffffff, 0.3));
  const sun = new DirectionalLight(0xffffff, 2.5);
  sun.position.set(3, 4, 2);
  scene.add(sun);

  const cube = new Mesh(
    new BoxGeometry(1, 1, 1),
    new MeshStandardMaterial({ color: 0x3fa7ff, roughness: 0.4, metalness: 0.2 }),
  );
  scene.add(cube);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    renderer,
    backend,
    frame(dt, spinSpeed) {
      cube.rotation.x += spinSpeed * 0.6 * dt;
      cube.rotation.y += spinSpeed * dt;
      renderer.render(scene, camera);
    },
  };
}
