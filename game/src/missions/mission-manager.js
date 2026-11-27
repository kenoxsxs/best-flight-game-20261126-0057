// The missions for Dusk Runner: three sorties that are genuinely different,
// not the same course with different numbers. A time trial through glowing
// gates; a search and rescue in thick fog, found by instruments; a heavy cargo
// run to a short mountain strip that punishes sloppy flying. One class, one
// job: define the sorties, their courses and their win conditions. The flight
// model owns the aircraft; this owns what the flight is for.

/** Normalise a 3D vector. */
function norm(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

/** Build a ring course: positions above the ground, normals along the course. */
function buildCourse(terrain, points, radius, pointsEach) {
  const rings = points.map((p, i) => ({
    x: p[0],
    y: terrain.heightAt(p[0], p[1]) + p[2],
    z: p[1],
    radius,
    number: i + 1,
    points: pointsEach,
    normal: [0, 0, 1],
  }));
  for (let i = 0; i < rings.length; i += 1) {
    const prev = i === 0 ? { x: 0, y: 30, z: -300 } : rings[i - 1];
    const next = i === rings.length - 1 ? rings[i] : rings[i + 1];
    const dir = [next.x - prev.x, next.y - prev.y, next.z - prev.z];
    rings[i].normal = norm(dir);
  }
  return rings;
}

export class MissionManager {
  constructor(terrain) {
    this.terrain = terrain;
    this.beaconReached = false;
    this.missions = [
      {
        id: 'rings',
        name: 'RACE THE LIGHT',
        briefing: 'The sun is going down and the delivery rings are waiting. Fly all 8 rings as fast as you can, then bring the Kestrel home to Runway 36 before dark. Rings pay 100 points and a splash of fuel.',
        handling: { pitch: 1, roll: 1, stall: 30, burn: 1, accel: 1 },
        fog: 0.15,
        rings: buildCourse(terrain, [
          [0, 600, 70], [320, 1250, 90], [-420, 1850, 80], [220, 2450, 110],
          [880, 2850, 120], [-780, 3050, 130], [480, 3250, 100], [0, 1400, 80],
        ], 40, 100),
        beacon: null,
        landingSite: 'runway',
        // The clock is a race against the light: 90 s on the board, and every
        // gate flown buys 10 s more daylight (up to 170 s for a perfect run).
        // The 9 km course takes ~130 s even for a perfect autopilot, so a 60 s
        // board would be unplayable; 90 s keeps the pressure without a
        // guaranteed loss. The sun dies when the effective clock does.
        timeLimit: 90,
        bonusPerRing: 10,
        timeLeft: (plane) => Math.max(0, Math.ceil(90 + (plane.ringsHit || 0) * 10 - plane.time)),
        objective: (plane) => `RING ${Math.min(plane.nextRing + 1, 8)}/8`,
        clock: (plane) => `TIME ${Math.max(0, Math.ceil(90 + (plane.ringsHit || 0) * 10 - plane.time))}s`,
        sub: (plane) => (plane.nextRing >= 8 ? 'ALL RINGS — LAND ON 36' : 'NEXT RING LIT GOLD • +10s PER RING'),
      },
      {
        id: 'rescue',
        name: 'LAST CALL',
        briefing: 'A hiker is stranded in the western foothills and the fog is thick. Find the smoke, mark the spot, then put the Kestrel down on the little mountain strip before the light is gone. Fly by the radar and the compass — your eyes will lie to you.',
        handling: { pitch: 1, roll: 1, stall: 30, burn: 1, accel: 1 },
        fog: 0.75,
        rings: [],
        beacon: { x: -700, y: terrain.heightAt(-700, 2100) + 6, z: 2100 },
        landingSite: 'strip',
        timeLimit: 360,
        timeLeft: (plane) => Math.max(0, Math.ceil(360 - plane.time)),
        objective: (plane) => (this.beaconReached ? 'BEACON FOUND — RTB' : 'FIND THE BEACON'),
        clock: (plane) => `TIME ${Math.max(0, Math.ceil(360 - plane.time))}s`,
        sub: (plane) => {
          if (this.beaconReached) return 'BEACON MARKED — LAND ON THE STRIP';
          const b = this.current.beacon;
          const d = Math.round(Math.hypot(plane.x - b.x, plane.y - b.y, plane.z - b.z));
          return `DIST TO BEACON ${d}m • FOG 75%`;
        },
      },
      {
        id: 'cargo',
        name: 'HEAVY LOAD',
        briefing: 'Medical supplies for the mountain outpost, and the Kestrel is loaded heavy — lazy in the roll, thirsty on fuel, and it stalls sooner. Two guide rings, then a short strip at 56 metres. Save the throttle, land it soft, deliver before dark.',
        handling: { pitch: 0.6, roll: 0.55, stall: 38, burn: 2, accel: 0.85 },
        fog: 0.3,
        rings: buildCourse(terrain, [[700, 1500, 100], [1200, 2200, 110]], 42, 50),
        beacon: null,
        landingSite: 'strip',
        timeLimit: 420,
        timeLeft: (plane) => Math.max(0, Math.ceil(420 - plane.time)),
        objective: (plane) => (plane.nextRing >= 2 ? 'LAND AT THE STRIP' : `GUIDE ${plane.nextRing + 1}/2`),
        clock: (plane) => `TIME ${Math.max(0, Math.ceil(420 - plane.time))}s`,
        sub: () => 'LOAD 850 KG — HEAVY • WATCH THE STALL',
      },
    ];
    this.current = this.missions[0];
  }

  /** Select a mission by id and reset its run state. */
  select(id) {
    this.current = this.missions.find((m) => m.id === id) || this.missions[0];
    this.beaconReached = false;
    return this.current;
  }

  /** True when the aircraft is within 80 m of the rescue beacon. */
  checkBeacon(plane) {
    const b = this.current.beacon;
    if (!b || this.beaconReached) return this.beaconReached;
    const d = Math.hypot(plane.x - b.x, plane.y - b.y, plane.z - b.z);
    if (d < 80) {
      this.beaconReached = true;
      plane.score += 150;
    }
    return this.beaconReached;
  }

  /** True when the sortie is complete: its goal met and the aircraft down safe. */
  isComplete(plane) {
    if (!plane.landed) return false;
    if (plane.landedOn !== this.current.landingSite) return false;
    if (this.current.id === 'rings') return plane.nextRing >= this.current.rings.length;
    if (this.current.id === 'rescue') return this.beaconReached;
    return true;
  }

  /** End-of-sortie bonus: a landing is worth 200, plus a point per second left on the mission clock. */
  completionBonus(plane) {
    const timeLeft = this.current.timeLeft ? this.current.timeLeft(plane) : 0;
    return 200 + Math.round(timeLeft);
  }
}
