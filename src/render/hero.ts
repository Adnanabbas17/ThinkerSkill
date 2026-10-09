// ThinkerFighter, the animated human hero. Render only: it follows the interpolated sim position
// and sim state and never changes them. In the sim the hero is still a circle on the 2D plane.

import {
  AnimationMixer,
  Box3,
  BufferAttribute,
  Color,
  Group,
  LoopOnce,
  Vector3,
  type AnimationAction,
  type AnimationClip,
  type Bone,
  type BufferGeometry,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type SkinnedMesh,
} from 'three/webgpu';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { SimEvent, SimState } from '../sim/types';
import type { Tuning } from '../tuning/tuning';
import { initialHeroAnim, nextHeroAnim, type HeroClip } from './heroAnim';

/** Hero height in metres, measured in the Idle pose. Render only: tune after playtests. */
export const HERO_HEIGHT = 1.6;
/** Run_Gun's planted-foot ground speed in hero heights per second (measured from the clip). */
const RUN_SPEED_PER_HEIGHT = 2.2;
/** Crossfade between clips, seconds. Hits use the faster one so they read at once. */
const FADE = 0.1;
const FAST_FADE = 0.05;

const CLIP_NAMES: Record<HeroClip, string> = {
  idle: 'CharacterArmature|Idle',
  run: 'CharacterArmature|Run_Gun',
  hit: 'CharacterArmature|HitReact',
  death: 'CharacterArmature|Death',
};
/** The file carries 14 weapons on the right index finger; only this one is shown. */
const WEAPON_BONE = 'Index1R';
const SHOWN_WEAPON = 'SMG';
/** Suit parts by GLTFLoader name (it strips dots from node names: "UpperLeg.L" loads as "UpperLegL"). */
const BODY = 'Character_Hazmat';
const SUIT_MATERIAL = 'Hazmat_Main';
const BELT_MATERIAL = 'Black';
const BELT_BONES = ['Body', 'Abdomen'];
const ARM_BONE = /^(Shoulder|UpperArm|LowerArm|Pinky|Middle|Index|Thumb)/;

export interface HeroLook {
  /** Hood and upper body. */
  top: number;
  pants: number;
  roughness: number;
  metalness: number;
}

export interface Hero {
  /** Scene object, placed at the sim position and turned to the aim by update(). */
  readonly object: Group;
  /** Call once per rendered frame. `events` are all sim events since the previous frame. */
  update(state: SimState, x: number, z: number, frameDt: number, tuning: Tuning, events: readonly SimEvent[]): void;
}

export async function loadHero(url: string, look: HeroLook): Promise<Hero> {
  const gltf = await new GLTFLoader().loadAsync(url);
  return createHero(gltf.scene, gltf.animations, look);
}

const materialsOf = (mesh: Mesh) =>
  (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) as MeshStandardMaterial[];

export function createHero(model: Object3D, clips: AnimationClip[], look: HeroLook): Hero {
  const hand = model.getObjectByName(WEAPON_BONE);
  for (const child of hand?.children ?? []) {
    if (!(child as Bone).isBone) child.visible = child.name === SHOWN_WEAPON;
  }
  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    // Skinned bounds go stale while animating; one character near the screen centre is cheap to always draw.
    mesh.frustumCulled = false;
    for (const m of materialsOf(mesh)) {
      m.roughness = look.roughness;
      m.metalness = look.metalness;
    }
  });
  paintSuit(model, look);

  const mixer = new AnimationMixer(model);
  const actions = {} as Record<HeroClip, AnimationAction>;
  for (const key of Object.keys(CLIP_NAMES) as HeroClip[]) {
    const clip = clips.find((c) => c.name === CLIP_NAMES[key]);
    if (!clip) throw new Error(`Hero model has no "${CLIP_NAMES[key]}" clip`);
    actions[key] = mixer.clipAction(clip);
  }
  for (const once of [actions.hit, actions.death]) {
    once.setLoop(LoopOnce, 1);
    once.clampWhenFinished = true; // hold the last frame instead of snapping to the rest pose
  }

  // Scale and ground offset, measured once in the Idle pose.
  actions.idle.play();
  mixer.update(0);
  const box = skinnedBox(model);
  const scale = HERO_HEIGHT / (box.max.y - box.min.y);
  model.scale.setScalar(scale);
  model.position.y = -box.min.y * scale;

  const object = new Group();
  object.add(model);

  const runClipSpeed = RUN_SPEED_PER_HEIGHT * HERO_HEIGHT;
  let anim = initialHeroAnim();
  let current = actions.idle;
  let lastTick = -1;

  return {
    object,
    update(state, x, z, frameDt, _tuning, events) {
      const p = state.player;
      if (state.tick < lastTick) anim = initialHeroAnim(); // R started a new run
      lastTick = state.tick;
      anim = nextHeroAnim(
        anim,
        {
          lost: state.status === 'lost',
          hurt: events.some((e) => e.type === 'playerHurt'),
          vel: p.vel,
          aim: p.aimDir,
          runClipSpeed,
        },
        frameDt,
      );

      const next = actions[anim.clip];
      if (next !== current) {
        const fade = anim.clip === 'hit' ? FAST_FADE : FADE;
        current.fadeOut(fade);
        next.reset().fadeIn(fade).play();
        current = next;
      } else if (anim.restart) {
        current.reset().play();
      }
      current.timeScale = anim.rate;
      mixer.update(frameDt);

      // Exactly the interpolated sim position (no root motion), whole body facing the aim.
      object.position.set(x, 0, z);
      object.rotation.y = Math.atan2(p.aimDir.x, p.aimDir.y);
    },
  };
}

/** World-space box of the skinned meshes in their current pose. */
function skinnedBox(model: Object3D): Box3 {
  model.updateMatrixWorld(true);
  const box = new Box3();
  const v = new Vector3();
  model.traverse((o) => {
    const mesh = o as SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    const count = mesh.geometry.attributes.position.count;
    for (let i = 0; i < count; i++) box.expandByPoint(mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld));
  });
  return box;
}

/** Name of the bone with the largest skin weight on vertex `i`. */
function mainBone(geometry: BufferGeometry, mesh: SkinnedMesh, i: number): string {
  const index = geometry.attributes.skinIndex;
  const weight = geometry.attributes.skinWeight;
  let best = 0;
  for (let k = 1; k < 4; k++) if (weight.getComponent(i, k) > weight.getComponent(i, best)) best = k;
  return mesh.skeleton.bones[index.getComponent(i, best)].name;
}

/**
 * Blue top and white pants on the one-material suit, painted per triangle at load time (no asset
 * edit). A body triangle is pants when its centre is below the middle of the black belt and none
 * of its corners mainly follows an arm or hand bone. Heights use the mesh's own Z axis (its node
 * is turned -90 degrees about X). The hood shares the suit material and takes the top colour.
 */
function paintSuit(model: Object3D, look: HeroLook): void {
  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    for (const m of materialsOf(mesh)) if (m.name === SUIT_MATERIAL) m.color.setHex(look.top);
  });

  const part = (material: string) =>
    model
      .getObjectByName(BODY)
      ?.children.find((c) => (c as SkinnedMesh).isSkinnedMesh && materialsOf(c as Mesh)[0].name === material) as
      | SkinnedMesh
      | undefined;
  const suit = part(SUIT_MATERIAL);
  const belt = part(BELT_MATERIAL);
  if (!suit || !belt) return; // unexpected layout: the whole suit stays the top colour

  const beltZ: number[] = [];
  const beltPos = belt.geometry.attributes.position;
  for (let i = 0; i < beltPos.count; i++) {
    if (BELT_BONES.includes(mainBone(belt.geometry, belt, i))) beltZ.push(beltPos.getZ(i));
  }
  if (beltZ.length === 0) return;
  const beltMiddle = (Math.min(...beltZ) + Math.max(...beltZ)) / 2;

  // Non-indexed so each triangle owns its three vertices and can take one flat colour.
  const geometry = suit.geometry.index ? suit.geometry.toNonIndexed() : suit.geometry;
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const top = new Color(look.top);
  const pants = new Color(look.pants);
  for (let v = 0; v < pos.count; v += 3) {
    const centreZ = (pos.getZ(v) + pos.getZ(v + 1) + pos.getZ(v + 2)) / 3;
    const onArm = [v, v + 1, v + 2].some((i) => ARM_BONE.test(mainBone(geometry, suit, i)));
    const c = centreZ < beltMiddle && !onArm ? pants : top;
    for (let i = v; i < v + 3; i++) colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  if (geometry !== suit.geometry) suit.geometry.dispose();
  suit.geometry = geometry;

  const material = materialsOf(suit)[0].clone();
  material.color.setHex(0xffffff); // the vertex colours carry top and pants
  material.vertexColors = true;
  suit.material = material;
}
