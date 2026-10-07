// The enemy: a six-legged crawler robot built and animated in code. Render only: in the sim an
// enemy is still a circle of ENEMY_RADIUS. Units are metres; origin on the floor at the enemy's
// centre; front is +Z. All robots share one set of geometries and materials.

import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  type BufferGeometry,
} from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// ---------------------------------------------------------------------------------------------
// Gait: pure math, unit tested.

export const GAIT = {
  /** Metres travelled per full step cycle. */
  stride: 0.7,
  /** Hip swing about the vertical axis, radians each way (forward and back). */
  swing: 0.3,
  /** Hip lift on the forward swing, radians at the peak. */
  lift: 0.2,
  /** Core bob while moving, metres each way. */
  bob: 0.012,
};

/** Legs 0-2 on the +X side and 3-5 on the -X side, each ordered front, middle, rear. */
export const LEG_COUNT = 6;
const LEG_ANGLES = [42, 90, 138].map((d) => MathUtils.degToRad(d));
/**
 * Tripod gait: front and rear legs of one side move with the middle leg of the other side.
 * Group A (legs 0, 2, 4) and group B (legs 1, 3, 5) are half a cycle apart.
 */
const LEG_PHASE_OFFSET = [0, 0.5, 0, 0.5, 0, 0.5];

export interface LegPose {
  /** Swing towards the front (+) or back (-), radians. */
  swing: number;
  /** Lift of the leg's outer end, radians (0 = foot on the floor). */
  lift: number;
}

/** Advance a gait phase (0..1, one full cycle) by a distance travelled. */
export function advanceGait(phase: number, distance: number): number {
  const p = (phase + distance / GAIT.stride) % 1;
  return p < 0 ? p + 1 : p;
}

/**
 * Pose of one leg at a gait phase. In the first half of its cycle the leg swings from back to
 * front in the air; in the second half it pushes back on the floor. Writes into `out` (no allocation).
 */
export function legPose(phase: number, leg: number, out: LegPose): LegPose {
  const t = ((phase + LEG_PHASE_OFFSET[leg]) % 1) * Math.PI * 2;
  out.swing = -Math.cos(t) * GAIT.swing;
  out.lift = Math.max(0, Math.sin(t)) * GAIT.lift;
  return out;
}

/** Core height offset: one bob per step (two per cycle), none when standing still. */
export function coreBob(phase: number, moving: boolean): number {
  return moving ? Math.sin(phase * Math.PI * 4) * GAIT.bob : 0;
}

// ---------------------------------------------------------------------------------------------
// Model.

export interface RobotLook {
  body: number;
  trim: number;
  eye: number;
  dark: number;
  flash: number;
  roughness: number;
  metalness: number;
}

export interface EnemyRobot {
  /** Pool object: the caller sets position, facing, scale and visibility. */
  readonly group: Group;
  /** Body and dome turn the flash colour while true. */
  setFlash(on: boolean): void;
  /** Place the legs and core for a gait phase. */
  pose(phase: number, moving: boolean): void;
}

const HIP_RADIUS = 0.29;
const HIP_Y = 0.36;
const scratch: LegPose = { swing: 0, lift: 0 }; // reused every call: no per-frame allocation

/** Shared geometries and materials; make() builds one robot that uses them. */
export function createRobotKit(look: RobotLook): { make(): EnemyRobot; drawCallsPerRobot: number } {
  const mat = (color: number, extra: object = {}) =>
    new MeshStandardMaterial({ color, roughness: look.roughness, metalness: look.metalness, ...extra });
  const bodyMat = mat(look.body, { flatShading: true });
  const trimMat = mat(look.trim);
  const eyeMat = mat(look.eye);
  const darkMat = mat(look.dark);
  const flashMat = mat(look.flash, { emissive: look.flash, flatShading: true });

  // Body: 8 sides, turned 22.5 degrees so a flat side faces front.
  const bodyGeo = new CylinderGeometry(0.31, 0.37, 0.26, 8).rotateY(Math.PI / 8).translate(0, 0.37, 0);
  // Dome: half sphere on top of the body, shifted forward.
  const domeGeo = new SphereGeometry(0.21, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.5, 0.02);
  // Eye and antenna tip share a material and never move apart: one mesh.
  const eyeTipGeo = merged([
    new BoxGeometry(0.34, 0.12, 0.1).translate(0, 0.39, 0.33),
    new SphereGeometry(0.04, 10, 6).translate(-0.12, 0.87, -0.14),
  ]);
  const antennaGeo = new CylinderGeometry(0.014, 0.014, 0.24, 6).translate(-0.12, 0.74, -0.14);
  // One leg in hip space (+Z points outward): upper box tilted so its outer end is higher,
  // lower box tilted so the foot sits slightly inward.
  const legGeo = merged([
    new BoxGeometry(0.07, 0.07, 0.19).rotateX(MathUtils.degToRad(-24)).translate(0, 0.045, 0.085),
    new BoxGeometry(0.06, 0.46, 0.06).rotateX(MathUtils.degToRad(4.6)).translate(0, -0.135, 0.175),
  ]);

  const make = (): EnemyRobot => {
    const group = new Group();
    const core = new Group();
    const body = new Mesh(bodyGeo, bodyMat);
    const dome = new Mesh(domeGeo, trimMat);
    core.add(body, dome, new Mesh(eyeTipGeo, eyeMat), new Mesh(antennaGeo, darkMat));
    group.add(core);

    const hips: Group[] = [];
    const sides: number[] = [];
    const bases: number[] = [];
    for (let i = 0; i < LEG_COUNT; i++) {
      const side = i < 3 ? 1 : -1;
      const a = LEG_ANGLES[i % 3];
      const hip = new Group();
      hip.position.set(side * HIP_RADIUS * Math.sin(a), HIP_Y, HIP_RADIUS * Math.cos(a));
      hip.rotation.order = 'YXZ'; // swing about the vertical, then lift about the hip's own axis
      hip.add(new Mesh(legGeo, darkMat));
      group.add(hip);
      hips.push(hip);
      sides.push(side);
      bases.push(a);
    }

    let flashing = false;
    return {
      group,
      setFlash(on) {
        if (on === flashing) return;
        flashing = on;
        body.material = on ? flashMat : bodyMat;
        dome.material = on ? flashMat : trimMat;
      },
      pose(phase, moving) {
        core.position.y = coreBob(phase, moving);
        for (let i = 0; i < LEG_COUNT; i++) {
          legPose(phase, i, scratch);
          // Swinging forward turns the leg towards +Z: a smaller angle from the front.
          hips[i].rotation.y = sides[i] * (bases[i] - scratch.swing);
          hips[i].rotation.x = -scratch.lift; // negative tips the outer end up
        }
      },
    };
  };

  return { make, drawCallsPerRobot: 4 + LEG_COUNT };
}

function merged(parts: BufferGeometry[]): BufferGeometry {
  const geometry = mergeGeometries(parts);
  for (const p of parts) p.dispose();
  return geometry;
}
