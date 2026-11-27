// Seeded random numbers and the procedural heightfield for Skyline Ridge.
// Everything in the world is deterministic: the same seed always builds the
// same valley, so a screenshot staged from a seed always shows the same land.

/** A small deterministic PRNG (mulberry32). */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smoothstep interpolation between 0 and 1. */
function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Hash a pair of integer lattice coordinates to a pseudo-random value in [0, 1). */
function latticeHash(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634239) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** 2D value noise in [-1, 1], bilinearly smoothed between lattice points. */
export function valueNoise(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = latticeHash(ix, iz, seed);
  const b = latticeHash(ix + 1, iz, seed);
  const c = latticeHash(ix, iz + 1, seed);
  const d = latticeHash(ix + 1, iz + 1, seed);
  const u = smooth(fx);
  const v = smooth(fz);
  const top = a + (b - a) * u;
  const bottom = c + (d - c) * u;
  return (top + (bottom - top) * v) * 2 - 1;
}

/** Fractal noise: three octaves of value noise, roughly in [-1, 1]. */
export function fbm(x, z, seed) {
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  for (let octave = 0; octave < 3; octave += 1) {
    sum += amp * valueNoise(x * freq, z * freq, seed + octave * 101);
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum;
}

// ---- The valley -----------------------------------------------------------
// The world runs x east, z south, y up. The runway lies along the z axis at
// x = 0, from z = -120 to z = 620, heading north (toward -z). The ring course
// winds north through the valley and back south to the runway.
export const WORLD = {
  seed: 20261126,
  waterLevel: 4,
  runway: { x: 0, zMin: -120, zMax: 620, halfWidth: 26 },
};

/** Height of the land at (x, z), in metres, before any flattening. */
function rawHeight(x, z) {
  const valley = fbm(x / 900, z / 900, WORLD.seed);
  const ridge = fbm(x / 260 + 7.3, z / 260 + 2.1, WORLD.seed + 5);
  // A broad valley floor along the runway's line, rising into ridges at the
  // sides and a high bowl of peaks far to the north.
  const side = Math.min(1, Math.abs(x) / 1400);
  const north = Math.max(0, Math.min(1, (-z - 1400) / 1800));
  let h = 8 + valley * 14 + side * side * (36 + ridge * 38) + north * 62;
  // A lake basin to the east, low enough to hold water.
  const lakeDx = (x - 1250) / 700;
  const lakeDz = (z + 2600) / 800;
  const lake = Math.max(0, 1 - (lakeDx * lakeDx + lakeDz * lakeDz));
  h -= lake * 22;
  return h;
}

/** Height of the terrain at (x, z): flattened to the runway strip near it. */
export function terrainHeight(x, z) {
  const h = rawHeight(x, z);
  const r = WORLD.runway;
  const dx = Math.max(0, Math.abs(x - r.x) - r.halfWidth);
  const dz = Math.max(0, Math.max(r.zMin - z, z - r.zMax));
  const dist = Math.sqrt(dx * dx + dz * dz);
  const flat = Math.max(0, 1 - dist / 140);
  const blend = smooth(flat);
  return h * (1 - blend);
}
