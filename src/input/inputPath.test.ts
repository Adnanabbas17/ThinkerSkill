import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyRoom } from '../sim/testUtils';
import { createSim, stepSim } from '../sim/sim';
import { defaultTuning } from '../tuning/tuning';
import { loadTuning } from '../tuning/storage';
import { createInput, type Input } from './input';

// The real input module (createInput) driven by real DOM Events, into the real sim. Node has no DOM,
// so window, document and the canvas are minimal EventTargets; the events are real Event objects
// carrying the same fields a browser sets (code, repeat, button, clientX/Y, cancelable).

const g = globalThis as unknown as Record<string, unknown>;
const saved = { window: g.window, document: g.document, localStorage: g.localStorage };
let win: EventTarget & { innerWidth: number; innerHeight: number };
let doc: EventTarget & { hidden: boolean };
let canvas: EventTarget;
let input: Input;
let sim = createSim(room0(), 1); // one sim per test: speed carries over between drive() calls
function room0() {
  return emptyRoom({ minY: -30, maxY: 30, minX: -30, maxX: 30 }); // room for 1 s of running
}

function key(type: 'keydown' | 'keyup', code: string, repeat = false, target: EventTarget = win): Event {
  const e = Object.assign(new Event(type, { cancelable: true, bubbles: true }), { code, repeat });
  target.dispatchEvent(e);
  return e;
}
const down = (code: string, repeat = false) => key('keydown', code, repeat);
const up = (code: string) => key('keyup', code);
const pointer = (type: string, target: EventTarget, button = 0, x = 400, y = 300) =>
  target.dispatchEvent(Object.assign(new Event(type, { cancelable: true }), { button, clientX: x, clientY: y }));

const room = room0();
const toFloor = () => ({ x: 0, y: -100 }); // aim far up the screen

/** Sample the real input each tick and step the real sim; returns the hero speed after each tick. */
function drive(ticks: number, tuning = { ...defaultTuning }, state = sim) {
  const speeds: number[] = [];
  const events: string[] = [];
  for (let i = 0; i < ticks; i++) {
    stepSim(state, input.sample(toFloor), tuning, room);
    events.push(...state.events.map((e) => e.type));
    speeds.push(Math.hypot(state.player.vel.x, state.player.vel.y));
  }
  return { speeds, last: speeds.at(-1)!, state, events };
}

beforeEach(() => {
  win = Object.assign(new EventTarget(), { innerWidth: 1920, innerHeight: 1080 });
  doc = Object.assign(new EventTarget(), { hidden: false });
  canvas = new EventTarget();
  g.window = win;
  g.document = doc;
  input = createInput(canvas as unknown as HTMLCanvasElement);
  sim = createSim(room, 1);
});
afterEach(() => {
  g.window = saved.window;
  g.document = saved.document;
  g.localStorage = saved.localStorage;
});

const RUN = defaultTuning.moveSpeed * defaultTuning.runSpeedMultiplier;

describe('Space through the real input module into the sim', () => {
  it('Space then W: reaches 11.2 m/s', () => {
    down('Space');
    down('KeyW');
    expect(drive(20).last).toBeCloseTo(RUN);
    console.log(`Space then W: expected ${RUN.toFixed(2)} m/s, got ${drive(1).last.toFixed(2)} m/s after 21 ticks`);
  });

  it('W then Space: reaches 11.2 m/s', () => {
    down('KeyW');
    expect(drive(20).last).toBeCloseTo(defaultTuning.moveSpeed);
    down('Space');
    expect(drive(20).last).toBeCloseTo(RUN);
  });

  it('with browser auto-repeat keydowns (repeat = true) on Space and W', () => {
    down('Space');
    down('KeyW');
    for (let i = 0; i < 20; i++) {
      down('Space', true);
      down('KeyW', true);
      drive(1);
    }
    expect(drive(5).last).toBeCloseTo(RUN);
  });

  it('Space + W + left mouse fire: still 11.2 m/s, and it fires', () => {
    down('Space');
    down('KeyW');
    pointer('pointerdown', canvas, 0);
    const r = drive(30);
    expect(r.last).toBeCloseTo(RUN);
    expect(r.events.filter((e) => e === 'fire').length).toBeGreaterThan(2);
    pointer('pointerup', win, 0);
    expect(drive(5).last).toBeCloseTo(RUN); // releasing the button keeps the run
  });

  it('keyup of another key does not clear run (A pressed and released, W released and pressed)', () => {
    down('Space');
    down('KeyW');
    down('KeyA');
    drive(10);
    up('KeyA');
    expect(drive(20).last).toBeCloseTo(RUN);
    up('KeyW');
    down('KeyW');
    expect(drive(20).last).toBeCloseTo(RUN);
    up('ShiftLeft'); // an unrelated keyup
    expect(drive(5).last).toBeCloseTo(RUN);
  });

  it('pointer moves and a mouse click do not clear run', () => {
    down('Space');
    down('KeyW');
    pointer('pointermove', win, 0, 10, 10);
    pointer('pointerdown', canvas, 2); // right button
    pointer('pointerup', win, 2);
    expect(drive(20).last).toBeCloseTo(RUN);
  });

  it('Space keydown and keyup are default-prevented (no scroll, no focused-button click); Shift is not', () => {
    expect(down('Space').defaultPrevented).toBe(true);
    expect(up('Space').defaultPrevented).toBe(true);
    expect(down('ShiftLeft').defaultPrevented).toBe(false);
  });

  it('works when the event comes from a focused element that bubbles to window (e.g. a tuning slider)', () => {
    const slider = new EventTarget();
    const bubbleToWindow = (e: Event) => {
      const k = e as Event & { code: string; repeat: boolean };
      win.dispatchEvent(Object.assign(new Event(k.type, { cancelable: true }), { code: k.code, repeat: k.repeat }));
    };
    slider.addEventListener('keydown', bubbleToWindow);
    slider.addEventListener('keyup', bubbleToWindow);
    key('keydown', 'Space', false, slider);
    down('KeyW');
    expect(drive(20).last).toBeCloseTo(RUN);
  });

  it('release: Space up drops back to 7 m/s; Space down again runs again', () => {
    down('Space');
    down('KeyW');
    drive(20);
    up('Space');
    expect(drive(20).last).toBeCloseTo(defaultTuning.moveSpeed);
    down('Space');
    expect(drive(20).last).toBeCloseTo(RUN);
  });

  it('window blur clears run (expected), a hidden tab clears it, and pressing Space again works', () => {
    down('Space');
    down('KeyW');
    drive(20);
    win.dispatchEvent(new Event('blur'));
    expect(drive(20).last).toBe(0); // blur releases W too
    down('KeyW');
    expect(drive(20).last).toBeCloseTo(defaultTuning.moveSpeed);
    down('Space');
    expect(drive(20).last).toBeCloseTo(RUN);
    doc.hidden = true;
    doc.dispatchEvent(new Event('visibilitychange'));
    expect(drive(5).last).toBeLessThan(RUN);
  });

  it('a saved tuning from before the change (dash keys, no runSpeedMultiplier) still gives run 1.6', () => {
    g.localStorage = {
      getItem: () => JSON.stringify({ moveSpeed: 7, dashSpeed: 20, dashDuration: 0.14, dashCooldown: 0.8, dashInvuln: 0, camFov: 50 }),
      setItem: () => undefined,
    };
    const tuning = loadTuning();
    expect(tuning.runSpeedMultiplier).toBe(1.6);
    down('Space');
    down('KeyW');
    expect(drive(20, tuning).last).toBeCloseTo(RUN);
  });

  it('a saved tuning with runSpeedMultiplier 1 gives no boost (the one way run can look broken)', () => {
    g.localStorage = { getItem: () => JSON.stringify({ runSpeedMultiplier: 1 }), setItem: () => undefined };
    const tuning = loadTuning();
    down('Space');
    down('KeyW');
    expect(drive(20, tuning).last).toBeCloseTo(defaultTuning.moveSpeed);
  });
});
