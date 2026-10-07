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
  SphereGeometry,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu';
import type { Room } from '../content/testRoom';
import { ENEMY_RADIUS } from '../sim/enemies';
import { SHOT_RADIUS } from '../sim/projectiles';
import type { SimEvent, SimState, Vec2 } from '../sim/types';
import type { Tuning } from '../tuning/tuning';
import { loadHero, type Hero } from './hero';

export type BackendName = 'WebGPU' | 'WebGL 2';

export interface View {
  renderer: WebGPURenderer;
  backend: BackendName;
  /** Project a screen point through the current camera onto the floor (sim coordinates). */
  screenToFloor(clientX: number, clientY: number): Vec2 | null;
  /**
   * Draw the sim interpolated by `alpha` (0 = previous tick, 1 = current tick).
   * `events` are all sim events since the previous draw.
   */
  draw(state: SimState, alpha: number, frameDt: number, tuning: Tuning, events: readonly SimEvent[]): void;
}

/** `?forceWebGL=1` in the URL forces the WebGL 2 backend. */
export function wantsForcedWebGL(search: string): boolean {
  return new URLSearchParams(search).get('forceWebGL') === '1';
}

const WALL_THICKNESS = 0.6;
const WALL_HEIGHT = 1.6;
const OBSTACLE_HEIGHT = 1.4;

/**
 * Every scene color in one place. Placeholder theme: classic 8-bit platformer
 * palette (colors only, no borrowed shapes or names). Replaced in Milestone 3.
 */
export const PALETTE = {
  sky: 0x5c94fc,
  floor: 0xe09a5a,
  wall: 0xc84c0c,
  obstacle: 0x00a800,
  player: 0xfcfcfc,
  playerNose: 0xd82800,
  playerDestroyed: 0x3c3c3c,
  heroTop: 0x0058f8,
  heroPants: 0xfcfcfc,
  enemy: 0x7c3c00,
  enemyEye: 0xfcfcfc,
  flash: 0xffffff,
  shot: 0xff2a00,
  ambient: 0xfff4e0,
  sun: 0xffffff,
};

const MATTE = { roughness: 0.9, metalness: 0 };
const matte = (hex: number) => new MeshStandardMaterial({ color: hex, ...MATTE });
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

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
  scene.background = new Color(PALETTE.sky);
  scene.add(new AmbientLight(PALETTE.ambient, 1.1));
  const sun = new DirectionalLight(PALETTE.sun, 1.8);
  sun.position.set(6, 14, 8);
  scene.add(sun);

  // Room: floor, 4 walls just outside the playable bounds, obstacles.
  const w = room.maxX - room.minX;
  const d = room.maxY - room.minY;
  const cx = (room.minX + room.maxX) / 2;
  const cz = (room.minY + room.maxY) / 2;
  const floor = new Mesh(new PlaneGeometry(w + WALL_THICKNESS * 2, d + WALL_THICKNESS * 2), matte(PALETTE.floor));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  scene.add(floor);

  const wallMat = matte(PALETTE.wall);
  const t = WALL_THICKNESS;
  const yWall = WALL_HEIGHT / 2;
  scene.add(
    box(w + t * 2, WALL_HEIGHT, t, wallMat, cx, yWall, room.minY - t / 2),
    box(w + t * 2, WALL_HEIGHT, t, wallMat, cx, yWall, room.maxY + t / 2),
    box(t, WALL_HEIGHT, d, wallMat, room.minX - t / 2, yWall, cz),
    box(t, WALL_HEIGHT, d, wallMat, room.maxX + t / 2, yWall, cz),
  );
  const obstacleMat = matte(PALETTE.obstacle);
  for (const o of room.obstacles) {
    scene.add(box(o.hw * 2, OBSTACLE_HEIGHT, o.hh * 2, obstacleMat, o.x, OBSTACLE_HEIGHT / 2, o.y));
  }

  // Placeholder hero: body plus a nose that points along the aim (+z in local space).
  // Shown until the ThinkerFighter model has loaded, and for good if it fails to load.
  const player = new Group();
  const pr = room.playerRadius;
  const playerMat = matte(PALETTE.player);
  const noseMat = matte(PALETTE.playerNose);
  player.add(box(pr * 1.8, 0.5, pr * 1.8, playerMat, 0, 0.45, 0));
  player.add(box(0.2, 0.2, 0.55, noseMat, 0, 0.45, pr + 0.15));
  scene.add(player);

  let hero: Hero | null = null;
  loadHero(`${import.meta.env.BASE_URL}models/hero.glb`, { top: PALETTE.heroTop, pants: PALETTE.heroPants, ...MATTE })
    .then((h) => {
      hero = h;
      scene.add(h.object);
      player.visible = false;
    })
    .catch((err) => console.warn('Hero model failed to load; keeping the placeholder hero.', err));

  // Enemies and shots: pooled meshes, one per live sim entity (by index).
  const er = ENEMY_RADIUS;
  const enemyBody = new BoxGeometry(er * 1.7, 0.6, er * 1.7);
  const enemyEye = new BoxGeometry(er * 0.9, 0.18, 0.2);
  const eyeMat = matte(PALETTE.enemyEye);
  const enemyPool: { group: Group; mat: MeshStandardMaterial }[] = [];
  const enemyAt = (i: number) => {
    while (enemyPool.length <= i) {
      const mat = matte(PALETTE.enemy);
      const group = new Group();
      const body = new Mesh(enemyBody, mat);
      body.position.y = 0.35;
      const eye = new Mesh(enemyEye, eyeMat);
      eye.position.set(0, 0.45, er * 0.85);
      group.add(body, eye);
      scene.add(group);
      enemyPool.push({ group, mat });
    }
    return enemyPool[i];
  };
  const shotGeo = new SphereGeometry(SHOT_RADIUS * 1.4, 10, 8);
  const shotMat = new MeshStandardMaterial({ color: PALETTE.shot, emissive: PALETTE.shot, emissiveIntensity: 1.2 });
  const shotPool: Mesh[] = [];
  const shotAt = (i: number) => {
    while (shotPool.length <= i) {
      const m = new Mesh(shotGeo, shotMat);
      m.position.y = 0.45;
      scene.add(m);
      shotPool.push(m);
    }
    return shotPool[i];
  };
  let shake = 0;

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
    draw(state, alpha, frameDt, tuning, events) {
      const p = state.player;
      const px = lerp(p.prevPos.x, p.pos.x, alpha);
      const pz = lerp(p.prevPos.y, p.pos.y, alpha);
      const destroyed = state.status === 'lost';
      // Blink while invulnerable after a hit.
      const shown = destroyed || p.invulnTime <= 0 || Math.floor(state.tick / 4) % 2 === 0;
      if (hero) {
        hero.update(state, px, pz, frameDt, tuning, events);
        hero.object.visible = shown;
      } else {
        player.position.set(px, 0, pz);
        player.rotation.y = Math.atan2(p.aimDir.x, p.aimDir.y);
        player.scale.set(1, destroyed ? 0.35 : 1, 1);
        playerMat.color.setHex(destroyed ? PALETTE.playerDestroyed : PALETTE.player);
        noseMat.color.setHex(destroyed ? PALETTE.playerDestroyed : PALETTE.playerNose);
        player.visible = shown;
      }

      state.enemies.forEach((e, i) => {
        const { group, mat } = enemyAt(i);
        group.visible = true;
        const ex = lerp(e.prevPos.x, e.pos.x, alpha);
        const ez = lerp(e.prevPos.y, e.pos.y, alpha);
        group.position.set(ex, 0, ez);
        group.rotation.y = Math.atan2(px - ex, pz - ez);
        // Spawn warning: grows from small to full size.
        const grow = tuning.enemySpawnTime > 0 ? 1 - e.spawnTime / tuning.enemySpawnTime : 1;
        group.scale.setScalar(0.3 + 0.7 * grow);
        mat.color.setHex(e.flash > 0 ? PALETTE.flash : PALETTE.enemy);
        mat.emissive.setHex(e.flash > 0 ? PALETTE.flash : 0x000000);
      });
      for (let i = state.enemies.length; i < enemyPool.length; i++) enemyPool[i].group.visible = false;

      state.shots.forEach((s, i) => {
        const m = shotAt(i);
        m.visible = true;
        m.position.x = lerp(s.prevPos.x, s.pos.x, alpha);
        m.position.z = lerp(s.prevPos.y, s.pos.y, alpha);
      });
      for (let i = state.shots.length; i < shotPool.length; i++) shotPool[i].visible = false;

      if (camera.fov !== tuning.camFov) {
        camera.fov = tuning.camFov;
        camera.updateProjectionMatrix();
      }
      const follow = 1 - Math.exp(-tuning.camFollow * frameDt);
      focus.x += (px - focus.x) * follow;
      focus.z += (pz - focus.z) * follow;
      placeCamera(tuning);

      if (events.some((e) => e.type === 'playerHurt')) shake = tuning.shakeTime;
      if (shake > 0) {
        const amp = tuning.shakeHurt * (shake / tuning.shakeTime);
        camera.position.x += (Math.random() * 2 - 1) * amp;
        camera.position.z += (Math.random() * 2 - 1) * amp;
        camera.updateMatrixWorld();
        shake = Math.max(0, shake - frameDt);
      }
      renderer.render(scene, camera);
      // Unshaken camera for aiming: screenToFloor runs before the next draw.
      placeCamera(tuning);
    },
  };
}
