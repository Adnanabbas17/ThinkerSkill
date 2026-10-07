import { describe, expect, it } from 'vitest';
import { Box3, Mesh, Vector3, type Group } from 'three/webgpu';
import { advanceGait, coreBob, createRobotKit, GAIT, LEG_COUNT, legPose, type LegPose } from './enemyRobot';

const pose = (phase: number, leg: number): LegPose => legPose(phase, leg, { swing: 0, lift: 0 });
const GROUP_A = [0, 2, 4]; // +X front, +X rear, -X middle
const GROUP_B = [1, 3, 5]; // +X middle, -X front, -X rear
const phases = Array.from({ length: 64 }, (_, i) => i / 64);

describe('crawler gait', () => {
  it('advances one full cycle per stride of travel, and wraps into 0..1', () => {
    expect(advanceGait(0.2, GAIT.stride)).toBeCloseTo(0.2);
    expect(advanceGait(0, GAIT.stride / 2)).toBeCloseTo(0.5);
    expect(advanceGait(0.9, GAIT.stride * 0.25)).toBeCloseTo(0.15);
    expect(advanceGait(0.3, 0)).toBe(0.3);
  });

  it('moves the legs as two tripods half a cycle apart', () => {
    for (const p of phases) {
      for (const group of [GROUP_A, GROUP_B]) {
        for (const leg of group) expect(pose(p, leg)).toEqual(pose(p, group[0]));
      }
      const b = pose(p, GROUP_B[0]);
      const aLater = pose((p + 0.5) % 1, GROUP_A[0]);
      expect(b.swing).toBeCloseTo(aLater.swing);
      expect(b.lift).toBeCloseTo(aLater.lift);
    }
  });

  it('swings 0.30 rad forward and back, and lifts up to 0.20 rad only on the forward swing', () => {
    const swings = phases.map((p) => pose(p, 0).swing);
    expect(Math.max(...swings)).toBeCloseTo(GAIT.swing, 2);
    expect(Math.min(...swings)).toBeCloseTo(-GAIT.swing, 2);
    expect(Math.max(...phases.map((p) => pose(p, 0).lift))).toBeCloseTo(GAIT.lift, 2);
    for (const p of phases) {
      const lifted = pose(p, 0).lift > 1e-9; // sin(pi) is ~1e-16, not 0
      const swingingForward = pose(p + 0.001, 0).swing > pose(p, 0).swing;
      if (lifted) expect(swingingForward).toBe(true);
    }
  });

  it('always keeps one tripod on the floor', () => {
    for (const p of phases) {
      const aDown = GROUP_A.every((l) => pose(p, l).lift === 0);
      const bDown = GROUP_B.every((l) => pose(p, l).lift === 0);
      expect(aDown || bDown).toBe(true);
    }
  });

  it('starts (phase 0) with every foot on the floor', () => {
    for (let leg = 0; leg < LEG_COUNT; leg++) expect(pose(0, leg).lift).toBeCloseTo(0);
  });

  it('bobs the core at most 0.012 m while moving and not at all when still', () => {
    const bobs = phases.map((p) => coreBob(p, true));
    expect(Math.max(...bobs)).toBeCloseTo(GAIT.bob, 3);
    expect(Math.min(...bobs)).toBeCloseTo(-GAIT.bob, 3);
    expect(coreBob(0.3, false)).toBe(0);
  });
});

describe('crawler model', () => {
  const kit = createRobotKit({ body: 0x7c3c00, trim: 0xa85c18, eye: 0xfcfcfc, dark: 0x3a1c08, flash: 0xffffff, roughness: 0.9, metalness: 0 });
  const meshes = (g: Group) => {
    const out: Mesh[] = [];
    g.traverse((o) => { if ((o as Mesh).isMesh) out.push(o as Mesh); });
    return out;
  };

  it('uses 10 meshes (draw calls) per robot, all sharing geometry and materials across robots', () => {
    const a = kit.make(), b = kit.make();
    const ma = meshes(a.group), mb = meshes(b.group);
    expect(ma).toHaveLength(kit.drawCallsPerRobot);
    expect(kit.drawCallsPerRobot).toBe(10);
    ma.forEach((m, i) => {
      expect(m.geometry).toBe(mb[i].geometry);
      expect(m.material).toBe(mb[i].material);
    });
  });

  it('stands with its feet on the floor about 0.45 m from the centre', () => {
    const r = kit.make();
    r.pose(0, false);
    r.group.updateMatrixWorld(true);
    const legs = meshes(r.group).slice(4);
    expect(legs).toHaveLength(6);
    for (const leg of legs) {
      const box = new Box3().setFromObject(leg, true);
      expect(box.min.y).toBeGreaterThan(-0.02);
      expect(box.min.y).toBeLessThan(0.02);
      // The lowest corner of the leg is the foot.
      const pos = leg.geometry.attributes.position;
      const v = new Vector3(), foot = new Vector3(0, Infinity, 0);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(leg.matrixWorld);
        if (v.y < foot.y) foot.copy(v);
      }
      expect(Math.hypot(foot.x, foot.z)).toBeGreaterThan(0.4);
      expect(Math.hypot(foot.x, foot.z)).toBeLessThan(0.5);
    }
  });

  it('turns body and dome to the flash material and back', () => {
    const r = kit.make();
    const [body, dome, eye] = meshes(r.group);
    const normal = [body.material, dome.material, eye.material];
    r.setFlash(true);
    expect(body.material).toBe(dome.material);
    expect(body.material).not.toBe(normal[0]);
    expect(eye.material).toBe(normal[2]);
    r.setFlash(false);
    expect([body.material, dome.material]).toEqual(normal.slice(0, 2));
  });

  it('keeps the legs still and the core level when not moving', () => {
    const r = kit.make();
    r.pose(0.37, false);
    const snapshot = () => r.group.children.map((c) => `${c.position.y.toFixed(5)},${c.rotation.x.toFixed(5)},${c.rotation.y.toFixed(5)}`).join('|');
    const before = snapshot();
    r.pose(0.37, false);
    expect(snapshot()).toBe(before);
    expect(r.group.children[0].position.y).toBe(0);
  });
});
