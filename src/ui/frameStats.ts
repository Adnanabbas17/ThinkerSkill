// Rolling frame timing for the HUD. Pure logic, unit tested.

export class FrameStats {
  private samples: { t: number; dt: number }[] = [];

  /** Record one rendered frame at time `tMs` that took `dtMs` since the previous one. */
  push(tMs: number, dtMs: number): void {
    this.samples.push({ t: tMs, dt: dtMs });
    while (this.samples.length && this.samples[0].t <= tMs - 5000) this.samples.shift();
  }

  /** Average fps over the last 1 second. */
  fps(nowMs: number): number {
    let frames = 0;
    let time = 0;
    for (const s of this.samples) {
      if (s.t > nowMs - 1000) {
        frames++;
        time += s.dt;
      }
    }
    return time > 0 ? (frames * 1000) / time : 0;
  }

  /** Longest frame in the last 5 seconds, in ms. */
  worstMs(nowMs: number): number {
    let worst = 0;
    for (const s of this.samples) if (s.t > nowMs - 5000 && s.dt > worst) worst = s.dt;
    return worst;
  }
}
