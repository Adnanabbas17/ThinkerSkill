import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  Group,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGPURenderer,
} from 'three/webgpu';
import { isArena, solidParts, type SolidKind } from '../content/arena';
import type { Room } from '../content/testRoom';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ENEMY_RADIUS } from '../sim/enemies';
import { SIM_DT } from '../sim/fixedStep';
import type { SimEvent, SimState, Vec2 } from '../sim/types';
import type { Tuning } from '../tuning/tuning';
import { advanceGait, createRobotKit, type EnemyRobot } from './enemyRobot';
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
/** Render-only effect sizes and times. */
const SHOT_Y = 0.5;
const TRACER_LENGTH = 0.6;
const MUZZLE_TIME = 0.05;
const MUZZLE_AHEAD = 1.2; // at the SMG's barrel tip (measured from screenshots), on the line the shots travel
const MUZZLE_Y = 0.56;
const IMPACT_TIME = 0.1;
const IMPACT_POOL = 8;
const SPARKS = 8;
const WALL_HEIGHT = 1.6;
const OBSTACLE_HEIGHT = 1.4;
const ROOM_HEIGHT = 2;
const CONSOLE_HEIGHT = 1;
const CORE_HEIGHT = 2.4;
const VENT_SIZE = 1.2;
const LABEL_SIZE = 1.5;
/** A core blinks while it is being hit and for this long after the last damage. */
const CORE_BLINK_SECONDS = 1;

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
  enemyTrim: 0xa85c18,
  enemyDark: 0x3a1c08,
  enemyEye: 0xfcfcfc,
  flash: 0xffffff,
  tracer: 0xfff0b0,
  // Milestone 2 grey boxes (arena only).
  greyRoom: 0x8a8a8a,
  greyCover: 0xb0b0b0,
  greyConsole: 0x5c5c5c,
  greyCore: 0xd6d6d6,
  greyCoreLost: 0x3c3c3c,
  greyCoreAlarm: 0xffc46a,
  vent: 0x6e6e6e,
  floorLabel: '#ececec',
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

/** A flat letter painted on the floor, readable from the camera (top of the letter = up the screen). */
function floorLabel(text: string, x: number, z: number): Mesh {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = PALETTE.floorLabel;
  ctx.font = 'bold 112px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 68);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  const mat = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  const m = new Mesh(new PlaneGeometry(LABEL_SIZE, LABEL_SIZE), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, 0.02, z);
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
  // Every obstacle is drawn (solidParts gives one part per obstacle), so nothing collides unseen.
  // The test room keeps its green blocks; the arena uses grey boxes per kind.
  const arenaLook: Record<SolidKind, { mat: MeshStandardMaterial; height: number }> = {
    room: { mat: matte(PALETTE.greyRoom), height: ROOM_HEIGHT },
    cover: { mat: matte(PALETTE.greyCover), height: OBSTACLE_HEIGHT },
    console: { mat: matte(PALETTE.greyConsole), height: CONSOLE_HEIGHT },
    core: { mat: matte(PALETTE.greyCore), height: CORE_HEIGHT },
  };
  const obstacleMat = matte(PALETTE.obstacle);
  const coreMeshes: Mesh[] = []; // same order as room.cores and state.cores
  const coreLostMat = matte(PALETTE.greyCoreLost);
  const coreAlarmMat = matte(PALETTE.greyCoreAlarm);
  for (const { kind, box: o } of solidParts(room)) {
    const look = isArena(room) ? arenaLook[kind] : { mat: obstacleMat, height: OBSTACLE_HEIGHT };
    const mesh = box(o.hw * 2, look.height, o.hh * 2, look.mat, o.x, look.height / 2, o.y);
    scene.add(mesh);
    if (kind === 'core' && isArena(room)) coreMeshes.push(mesh);
  }
  if (isArena(room)) {
    // Spawn vents: flat grey squares, nothing to collide with.
    const ventGeo = new PlaneGeometry(VENT_SIZE, VENT_SIZE);
    const ventMat = matte(PALETTE.vent);
    for (const v of room.spawnPoints) {
      const m = new Mesh(ventGeo, ventMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(v.x, 0.01, v.y);
      scene.add(m);
    }
    for (const l of room.floorLabels) scene.add(floorLabel(l.text, l.x, l.y));
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

  // Enemies and shots: pooled, one per live sim entity (by index).
  // Enemies are six-legged crawler robots sharing one set of geometries and materials.
  const robots = createRobotKit({
    body: PALETTE.enemy,
    trim: PALETTE.enemyTrim,
    eye: PALETTE.enemyEye,
    dark: PALETTE.enemyDark,
    flash: PALETTE.flash,
    ...MATTE,
  });
  const enemyPool: EnemyRobot[] = [];
  const enemyAt = (i: number) => {
    while (enemyPool.length <= i) {
      const robot = robots.make();
      scene.add(robot.group);
      enemyPool.push(robot);
    }
    return enemyPool[i];
  };
  // Gait phase per enemy id, so legs keep their rhythm when pool order shifts after a kill.
  const gaitPhase = new Map<number, number>();
  const isAlive = (enemies: SimState['enemies'], id: number) => {
    for (const e of enemies) if (e.id === id) return true;
    return false;
  };

  // Shots: tracers, a thin bright core inside an additive glow, centred on the sim shot
  // position and aligned with its direction (what you see is what hits).
  const glow = (opacity: number) =>
    new MeshBasicMaterial({ color: PALETTE.tracer, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false });
  // Flash and sparks blend normally so they keep the tracer colour on any background.
  const flare = () => new MeshBasicMaterial({ color: PALETTE.tracer, transparent: true, depthWrite: false });
  const tracerCoreGeo = new BoxGeometry(0.022, 0.022, TRACER_LENGTH);
  const tracerGlowGeo = new BoxGeometry(0.05, 0.05, TRACER_LENGTH * 1.08);
  const tracerCoreMat = new MeshBasicMaterial({ color: PALETTE.tracer });
  const tracerGlowMat = glow(0.45);
  const shotPool: Group[] = [];
  const shotAt = (i: number) => {
    while (shotPool.length <= i) {
      const g = new Group();
      g.add(new Mesh(tracerCoreGeo, tracerCoreMat), new Mesh(tracerGlowGeo, tracerGlowMat));
      g.position.y = SHOT_Y;
      scene.add(g);
      shotPool.push(g);
    }
    return shotPool[i];
  };

  // Muzzle flash: one flash in front of the hero on the line the shots travel, ~0.05 s per shot.
  const muzzle = new Group(); // turned to the aim
  const muzzleMat = flare();
  muzzleMat.depthTest = false; // a flash at the barrel tip is never hidden by the gun itself
  // A burst at the barrel tip: small core plus three prongs flaring forward (+Z).
  const muzzleGeo = mergeGeometries([
    new OctahedronGeometry(0.08),
    new BoxGeometry(0.06, 0.06, 0.34).translate(0, 0, 0.17).toNonIndexed(),
    new BoxGeometry(0.045, 0.045, 0.2).translate(0, 0, 0.1).rotateY(0.7).toNonIndexed(),
    new BoxGeometry(0.045, 0.045, 0.2).translate(0, 0, 0.1).rotateY(-0.7).toNonIndexed(),
  ]);
  const muzzleFlash = new Mesh(muzzleGeo, muzzleMat);
  muzzleFlash.renderOrder = 10;
  muzzle.add(muzzleFlash);
  muzzle.visible = false;
  scene.add(muzzle);
  let muzzleLeft = 0;

  // Impacts: a short spark puff where a shot hits a wall, a box or an enemy. Pooled ring.
  const sparkGeo = mergeGeometries([
    new OctahedronGeometry(0.07), // centre burst (already non-indexed)
    ...Array.from({ length: SPARKS }, (_, k) => {
      const yaw = (k / SPARKS) * Math.PI * 2;
      const pitch = MathUtils.degToRad(k % 2 === 0 ? 20 : 50);
      return new BoxGeometry(0.035, 0.035, 0.2).translate(0, 0, 0.14).rotateX(-pitch).rotateY(yaw).toNonIndexed();
    }),
  ]);
  const impacts = Array.from({ length: IMPACT_POOL }, () => {
    const mesh = new Mesh(sparkGeo, flare());
    mesh.visible = false;
    scene.add(mesh);
    return { mesh, mat: mesh.material, age: IMPACT_TIME };
  });
  let nextImpact = 0;
  const impactAt = (x: number, y: number, z: number) => {
    const fx = impacts[nextImpact];
    nextImpact = (nextImpact + 1) % IMPACT_POOL;
    fx.age = 0;
    fx.mesh.position.set(x, y, z);
    fx.mesh.rotation.y = Math.random() * Math.PI * 2;
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
      for (let i = 0; i < coreMeshes.length; i++) {
        const c = state.cores[i];
        // Blink between the normal and the alarm colour while a core is taking (or just took) damage.
        const blink = c && !c.lost && c.quiet < CORE_BLINK_SECONDS && Math.floor(state.tick / 8) % 2 === 0;
        coreMeshes[i].material = c?.lost ? coreLostMat : blink ? coreAlarmMat : arenaLook.core.mat;
      }
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

      const enemies = state.enemies;
      for (let i = 0; i < enemies.length; i++) {
        const e = enemies[i];
        const robot = enemyAt(i);
        const group = robot.group;
        group.visible = true;
        const ex = lerp(e.prevPos.x, e.pos.x, alpha);
        const ez = lerp(e.prevPos.y, e.pos.y, alpha);
        group.position.set(ex, 0, ez);
        group.rotation.y = Math.atan2(px - ex, pz - ez);
        // Spawn warning: grows from small to full size.
        const grow = tuning.enemySpawnTime > 0 ? 1 - e.spawnTime / tuning.enemySpawnTime : 1;
        group.scale.setScalar(0.3 + 0.7 * grow);
        robot.setFlash(e.flash > 0);
        // Legs step with actual speed and stand still during the spawn warning.
        const speed = Math.hypot(e.pos.x - e.prevPos.x, e.pos.y - e.prevPos.y) / SIM_DT;
        const moving = e.spawnTime <= 0 && speed > 0.05;
        const phase = advanceGait(gaitPhase.get(e.id) ?? 0, moving ? speed * frameDt : 0);
        gaitPhase.set(e.id, phase);
        robot.pose(phase, moving);
      }
      for (let i = enemies.length; i < enemyPool.length; i++) enemyPool[i].group.visible = false;
      if (gaitPhase.size > enemies.length) {
        for (const id of gaitPhase.keys()) if (!isAlive(enemies, id)) gaitPhase.delete(id);
      }

      const shots = state.shots;
      for (let i = 0; i < shots.length; i++) {
        const s = shots[i];
        const g = shotAt(i);
        g.visible = true;
        g.position.x = lerp(s.prevPos.x, s.pos.x, alpha);
        g.position.z = lerp(s.prevPos.y, s.pos.y, alpha);
        g.rotation.y = Math.atan2(s.dir.x, s.dir.y);
      }
      for (let i = shots.length; i < shotPool.length; i++) shotPool[i].visible = false;

      // Effects from this frame's sim events.
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        if (ev.type === 'fire') {
          muzzleLeft = MUZZLE_TIME;
          muzzleFlash.rotation.z = Math.random() * Math.PI;
        } else if (ev.type === 'shotBlocked') {
          // Pull the sparks 0.12 m back towards the hero so they are not buried in the wall.
          const dx = px - ev.pos.x;
          const dz = pz - ev.pos.y;
          const d = Math.hypot(dx, dz) || 1;
          impactAt(ev.pos.x + (dx / d) * 0.12, SHOT_Y, ev.pos.y + (dz / d) * 0.12);
        } else if (ev.type === 'enemyHit') {
          // The event gives the enemy's centre; put the sparks on its side facing the hero.
          const dx = px - ev.pos.x;
          const dz = pz - ev.pos.y;
          const d = Math.hypot(dx, dz) || 1;
          impactAt(ev.pos.x + (dx / d) * ENEMY_RADIUS * 0.8, 0.42, ev.pos.y + (dz / d) * ENEMY_RADIUS * 0.8);
        }
      }
      muzzle.visible = muzzleLeft > 0;
      if (muzzleLeft > 0) {
        const t = 1 - muzzleLeft / MUZZLE_TIME;
        muzzle.position.set(px + p.aimDir.x * MUZZLE_AHEAD, MUZZLE_Y, pz + p.aimDir.y * MUZZLE_AHEAD);
        muzzle.rotation.y = Math.atan2(p.aimDir.x, p.aimDir.y);
        muzzle.scale.setScalar(1 + 0.6 * t);
        muzzleMat.opacity = 1 - 0.7 * t;
        muzzleLeft -= frameDt;
      }
      for (let i = 0; i < impacts.length; i++) {
        const fx = impacts[i];
        fx.mesh.visible = fx.age < IMPACT_TIME;
        if (!fx.mesh.visible) continue;
        const t = fx.age / IMPACT_TIME;
        fx.mesh.scale.setScalar(0.8 + t);
        fx.mat.opacity = 1 - t;
        fx.age += frameDt;
      }

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
