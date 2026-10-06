import type { Room } from '../content/testRoom';
import type { Tuning } from '../tuning/tuning';
import { createPlayer, stepPlayer } from './player';
import type { SimState, TickInput } from './types';

// `seed` drives wave spawn order once combat lands (Checkpoint B).
export function createSim(room: Room, _seed: number): SimState {
  return { tick: 0, player: createPlayer(room), events: [] };
}

/** Advance the sim by exactly one fixed tick. Mutates and returns `state`. */
export function stepSim(state: SimState, input: TickInput, tuning: Tuning, room: Room): SimState {
  state.events = [];
  stepPlayer(state.player, input, tuning, room, state.events);
  state.tick++;
  return state;
}
