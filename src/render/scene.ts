import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu';
import type { Room } from '../content/testRoom';
import type { SimState, Vec2 } from '../sim/types';
import type { Tuning } from '../tuning/tuning';

export type BackendName = 'WebGPU' | 'WebGL 2';

export interface View {
  renderer: WebGPURenderer;
  backend: BackendName;
  /** Project a screen point through the current camera onto the floor (sim coordinates). */
  screenToFloor(clientX: number, clientY: number): Vec2 | null;
  /** Draw the sim interpolated by `alpha` (0 = previous tick, 1 = current tick). */
  draw(state: SimState, alpha: number, frameDt: number, tuning: Tuning): void;
}

/** `?forceWebGL=1` in the URL forces the WebGL 2 backend. */
export function wantsForcedWebGL(search: string): boolean {
  return new URLSearchParams(search).get('forceWebGL') === '1';
}

const WALL_THICKNESS = 0.6;
const WALL_HEIGHT = 1.6;
const OBSTACLE_HEIGHT = 1.4;

const grey = (hex: number) => new MeshStandardMaterial({ color: hex, roughness: 0.85, metalness: 0 });

function box(w: number, h: number, d: number, mat: MeshStandardMaterial, x: number, y: number, z: number): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export async function createView(canvas: HTMLCanvasElement, forceWebGL: boolean, room: Room): Promise<View> {
  const renderer = new WebGPURenderer({ canvas, antialias: true, forceWebGL });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  await renderer.init();
  const backend: BackendName = 'isWebGPUBackend' in renderer.backend ? 'WebGPU' : 'WebGL 2';

  const scene = new Scene();
  scene.background = new Color(0x15181c);
  scene.add(new AmbientLight(0xffffff, 0.6));
  const sun = new DirectionalLight(0xffffff, 2.2);
  sun.position.set(6, 14, 8);
  scene.add(sun);

  // Room: floor, 4 walls just outside the playable bounds, obstacles.
  const w = room.maxX - room.minX;
  const d = room.maxY - room.minY;
  const cx = (room.minX + room.maxX) / 2;
  const cz = (room.minY + room.maxY) / 2;
  const floor = new Mesh(new PlaneGeometry(w + WALL_THICKNESS * 2, d + WALL_THICKNESS * 2), grey(0x4a4f56));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  scene.add(floor);

  const wallMat = grey(0x6b7179);
  const t = WALL_THICKNESS;
  const yWall = WALL_HEIGHT / 2;
  scene.add(
    box(w + t * 2, WALL_HEIGHT, t, wallMat, cx, yWall, room.minY - t / 2),
    box(w + t * 2, WALL_HEIGHT, t, wallMat, cx, yWall, room.maxY + t / 2),
    box(t, WALL_HEIGHT, d, wallMat, room.minX - t / 2, yWall, cz),
    box(t, WALL_HEIGHT, d, wallMat, room.maxX + t / 2, yWall, cz),
  );
  const obstacleMat = grey(0x8a9099);
  for (const o of room.obstacles) {
    scene.add(box(o.hw * 2, OBSTACLE_HEIGHT, o.hh * 2, obstacleMat, o.x, OBSTACLE_HEIGHT / 2, o.y));
  }

  // Player drone: body plus a nose that points along the aim (+z in local space).
  const player = new Group();
  const pr = room.playerRadius;
  player.add(box(pr * 1.8, 0.5, pr * 1.8, grey(0xd8dde3), 0, 0.45, 0));
  player.add(box(0.2, 0.2, 0.55, grey(0xf2f4f6), 0, 0.45, pr + 0.15));
  scene.add(player);

  const camera = new PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.up.set(0, 0, -1); // keeps "up on screen" = away from camera, even when looking straight down
  const focus = new Vector3(room.playerStart.x, 0, room.playerStart.y);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const placeCamera = (tuning: Tuning) => {
    camera.position.set(focus.x, tuning.camHeight, focus.z + tuning.camBack);
    camera.lookAt(focus);
    camera.updateMatrixWorld();
  };

  const ray = new Vector3();
  return {
    renderer,
    backend,
    screenToFloor(clientX, clientY) {
      ray.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1, 0.5);
      ray.unproject(camera).sub(camera.position).normalize();
      if (ray.y > -1e-6) return null; // cursor above the horizon
      const k = -camera.position.y / ray.y;
      return { x: camera.position.x + ray.x * k, y: camera.position.z + ray.z * k };
    },
    draw(state, alpha, frameDt, tuning) {
      const p = state.player;
      const px = p.prevPos.x + (p.pos.x - p.prevPos.x) * alpha;
      const pz = p.prevPos.y + (p.pos.y - p.prevPos.y) * alpha;
      player.position.set(px, 0, pz);
      player.rotation.y = Math.atan2(p.aimDir.x, p.aimDir.y);

      if (camera.fov !== tuning.camFov) {
        camera.fov = tuning.camFov;
        camera.updateProjectionMatrix();
      }
      const follow = 1 - Math.exp(-tuning.camFollow * frameDt);
      focus.x += (px - focus.x) * follow;
      focus.z += (pz - focus.z) * follow;
      placeCamera(tuning);
      renderer.render(scene, camera);
    },
  };
}
