export type Rng = () => number;

/** Deterministic PRNG (mulberry32). Same seed -> same sequence. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** +1 or -1, matching the reference's randomOp(). */
export function randomOp(rng: Rng): 1 | -1 {
  return Math.floor(rng() * 10) % 2 ? 1 : -1;
}
