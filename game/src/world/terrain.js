// The valley Dusk Runner flies in: one deterministic heightmap, a flat runway,
// a remote mountain airstrip for the cargo mission, and a lake. Everything is
// pure functions of (x, z) and the seed, so the same seed always rebuilds the
// same world — the game, the autopilot and the screenshots all agree on it.
//
// World axes: x east, z north, y up, all in metres. Heading 0 is north (+z) and
// grows clockwise, so east is PI/2.

import { fbm, ridged, valueNoise } from '../core/random.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(a, b, t) {
  const u = clamp((t - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
}

/** The ground under (x, z): grass, forest, rock, snow, water, runway or strip. */
export class Terrain {
  constructor(seed) {
    this.seed = seed;
    // Main runway: flat, north-south, threshold at z = -300.
    this.runway = { x: 0, z: 0, heading: 0, length: 620, width: 34, elev: 0 };
    // Remote mountain strip for the cargo run: shorter, higher, angled.
    this.airstrip = { x: 1450, z: 2650, heading: 0.7, length: 380, width: 24, elev: 56 };
    // Lake basin west of the valley.
    this.lake = { x: -520, z: 1850, radius: 300, level: 3 };
  }

  /** Distance from (x, z) to a runway/strip centreline, and along-track distance. */
  stripFrame(strip, x, z) {
    const dx = x - strip.x;
    const dz = z - strip.z;
    const s = Math.sin(strip.heading);
    const c = Math.cos(strip.heading);
    // Along-track (forward) and across-track (side) in the strip's own frame.
    const along = dx * s + dz * c;
    const across = dx * c - dz * s;
    return { along, across };
  }

  /** Ground elevation in metres at (x, z). */
  heightAt(x, z) {
    const s = this.seed;
    // Rolling base hills, four octaves now so the valley floor has fine grain.
    let h = fbm(x, z, 420, 4, s) * 58;
    // Mountain walls west, east and far north — ridged multifractal noise
    // (5 octaves) so the peaks are sharp, jagged arêtes instead of smooth
    // dunes. Same ceiling as before (~300 m, snow-capped above 165 m); the
    // mean is unchanged, only the skyline is crisper.
    const west = smoothstep(-700, -1500, x);
    const east = smoothstep(800, 1600, x);
    const north = smoothstep(2600, 3400, z);
    const wall = Math.max(west, east, north);
    h += wall * (100 + ridged(x, z, 260, 5, s + 7) * 200);
    // A second ridge line for depth, south-west.
    const ridge = smoothstep(500, 1200, -z) * smoothstep(-300, -900, x);
    h += ridge * (55 + fbm(x, z, 300, 3, s + 13) * 110);
    // The valley floor: flatten toward 8 m along the runway corridor.
    const corridor = 1 - smoothstep(180, 700, Math.abs(x));
    const valleyLen = 1 - smoothstep(3400, 4200, z) * smoothstep(-500, -1100, z);
    const valley = corridor * valleyLen;
    h = h * (1 - valley) + 8 * valley;
    // Lake basin: dip the ground so water (level 3) covers it.
    const lakeD = Math.hypot(x - this.lake.x, z - this.lake.z);
    const lakeMask = 1 - smoothstep(this.lake.radius * 0.55, this.lake.radius, lakeD);
    h = h * (1 - lakeMask) + 0.5 * lakeMask;
    // The coast: far to the south the land falls away into the sea.
    const coast = smoothstep(-900, -1500, z);
    h = h * (1 - coast) + -6 * coast;
    // Runway: perfectly flat, blended at the edges.
    const rf = this.stripFrame(this.runway, x, z);
    const rAlong = 1 - smoothstep(this.runway.length / 2, this.runway.length / 2 + 60, Math.abs(rf.along));
    const rAcross = 1 - smoothstep(this.runway.width / 2, this.runway.width / 2 + 55, Math.abs(rf.across));
    const rMask = rAlong * rAcross;
    h = h * (1 - rMask) + this.runway.elev * rMask;
    // Mountain airstrip: a flat plateau at its elevation.
    const af = this.stripFrame(this.airstrip, x, z);
    const aAlong = 1 - smoothstep(this.airstrip.length / 2, this.airstrip.length / 2 + 50, Math.abs(af.along));
    const aAcross = 1 - smoothstep(this.airstrip.width / 2, this.airstrip.width / 2 + 45, Math.abs(af.across));
    const aMask = aAlong * aAcross;
    h = h * (1 - aMask) + this.airstrip.elev * aMask;
    return h;
  }

  /** Ground slope at (x, z): the gradient magnitude (rise over run), from a
   * finite difference of the height function. 0 is flat, ~1 is a steep
   * mountainside, >1.5 is a cliff. Used for slope-based colouring (rock on
   * the steep faces, grass on the gentle slopes) and for tree placement. */
  slopeAt(x, z) {
    const d = 4;
    const gx = (this.heightAt(x + d, z) - this.heightAt(x - d, z)) / (2 * d);
    const gz = (this.heightAt(x, z + d) - this.heightAt(x, z - d)) / (2 * d);
    return Math.hypot(gx, gz);
  }

  /** True when (x, z) is water (below the lake level inside the basin). */
  isWater(x, z) {
    const lakeD = Math.hypot(x - this.lake.x, z - this.lake.z);
    return lakeD < this.lake.radius && this.heightAt(x, z) < this.lake.level;
  }

  /** True when (x, z) is on the main runway surface. */
  isOnRunway(x, z) {
    const f = this.stripFrame(this.runway, x, z);
    return Math.abs(f.along) <= this.runway.length / 2 && Math.abs(f.across) <= this.runway.width / 2;
  }

  /** True when (x, z) is on the mountain airstrip. */
  isOnStrip(x, z) {
    const f = this.stripFrame(this.airstrip, x, z);
    return Math.abs(f.along) <= this.airstrip.length / 2 && Math.abs(f.across) <= this.airstrip.width / 2;
  }

  /** Ground kind at (x, z) for colouring: water, runway, strip, snow, rock, forest, grass. */
  groundKind(x, z) {
    if (this.isOnRunway(x, z)) return 'runway';
    if (this.isOnStrip(x, z)) return 'strip';
    const h = this.heightAt(x, z);
    if (this.isWater(x, z)) return 'water';
    if (h > 165) return 'snow';
    if (h > 105) return 'rock';
    // Forest patches from a coarse noise field.
    if (valueNoise(x, z, 180, this.seed + 31) > 0.56 && h > 12) return 'forest';
    return 'grass';
  }
}
