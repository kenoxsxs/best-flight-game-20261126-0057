// Seeded randomness for Dusk Runner: one small deterministic generator and a
// smooth value-noise field the terrain, clouds and ring courses all share, so a
// seed always rebuilds the same valley. Nothing here touches the network or the
// DOM; it is pure arithmetic the game and its screenshots both rely on.

/** A mulberry32 generator: tiny, fast, and fully determined by its seed. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A deterministic 2D integer hash in [0, 1), stable across machines. */
export function hash2(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

/** Smooth value noise in [0, 1] at world (x, z), cell size `cell` metres. */
export function valueNoise(x, z, cell, seed) {
  const gx = x / cell;
  const gz = z / cell;
  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = smooth(gx - ix);
  const fz = smooth(gz - iz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  const top = a + (b - a) * fx;
  const bottom = c + (d - c) * fx;
  return top + (bottom - top) * fz;
}

/** Fractal noise: `octaves` layers of value noise, each twice as fine, half as strong. */
export function fbm(x, z, cell, octaves, seed) {
  let sum = 0;
  let amp = 1;
  let total = 0;
  let size = cell;
  for (let o = 0; o < octaves; o += 1) {
    sum += valueNoise(x, z, size, seed + o * 101) * amp;
    total += amp;
    amp *= 0.5;
    size *= 0.5;
  }
  return sum / total;
}

/** Ridged multifractal noise in [0, 1]: each octave is folded into a sharp
 * crest (1 - |2n - 1|, squared so the ridges stay narrow), which is what
 * makes mountain ranges read as jagged arêtes instead of smooth dunes. Same
 * mean as fbm, so swapping it in keeps the peak heights while sharpening
 * the skyline. */
export function ridged(x, z, cell, octaves, seed) {
  let sum = 0;
  let amp = 1;
  let total = 0;
  let size = cell;
  for (let o = 0; o < octaves; o += 1) {
    const n = valueNoise(x, z, size, seed + o * 101);
    const r = 1 - Math.abs(2 * n - 1);
    sum += r * r * amp;
    total += amp;
    amp *= 0.5;
    size *= 0.5;
  }
  return sum / total;
}

/** A number in [min, max) from a generator. */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Pick one element of an array with a generator. */
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}
