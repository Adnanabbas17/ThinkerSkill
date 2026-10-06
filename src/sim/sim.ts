import type { Room } from '../content/testRoom';
import type { Wave } from '../content/testWaves';
import type { Tuning } from '../tuning/tuning';
import { stepEnemies } from './enemies';
import { createPlayer, stepPlayer } from './player';
import { fire, stepShots } from './projectiles';
import type { SimState, TickInput } from './types';
import { copy } from './vec';
import { stepWaves } from './waves';

/** With no waves the room is a sandbox: no enemies, never won or lost. */
export function createSim(room: Room, seed: number, waves: readonly Wave[] = []): SimState {
  return {
    tick: 0,
    status: 'playing',
    player: createPlayer(room),
    enemies: [],
    shots: [],
    waves,
    wave: { index: -1, toSpawn: 0, timer: 0 },
    nextId: 1,
    rngState: seed >>> 0,
    events: [],
  };
}

/** Advance the sim by exactly one fixed tick. Mutates and returns `state`. */
export function stepSim(state: SimState, input: TickInput, tuning: Tuning, room: Room): SimState {
  state.events = [];
  if (state.status === 'lost') {
    // Destroyed: everything holds still (prevPos = pos stops interpolation drift).
    state.player.prevPos = copy(state.player.pos);
    for (const e of state.enemies) e.prevPos = copy(e.pos);
    for (const sh of state.shots) sh.prevPos = copy(sh.pos);
  } else {
    stepPlayer(state.player, input, tuning, room, state.events);
    if (state.status === 'playing') fire(state, input, tuning, room);
    stepShots(state, tuning, room);
    stepEnemies(state, tuning, room);
    stepWaves(state, tuning, room);
  }
  state.tick++;
  return state;
}
