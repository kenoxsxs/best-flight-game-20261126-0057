// The 3D ground for Dusk Runner: a heightmap mesh built from the valley's
// own height function, vertex-coloured by ground kind, lit by the sunset; a
// runway and a mountain airstrip with painted markings; PAPI glideslope lights
// beside the main runway; and a small outpost (hangar, tower, windsock) by the
// threshold. One class, one job: the world the aircraft flies over.

import { makeRng, range } from '../core/random.js';

/** Sunset ground colours (0-1), one style with the sky — kept bright enough to
 * read in twilight, never muddy brown. Water is a dark blue-teal now (shallow
 * water at the lake shore); scree is the brown gravel at the foot of cliffs. */
const GROUND = {
  grass: [0.22, 0.40, 0.20],
  forest: [0.15, 0.30, 0.17],
  rock: [0.48, 0.36, 0.28],
  snow: [0.93, 0.82, 0.70],
  water: [0.16, 0.28, 0.42],
  scree: [0.42, 0.33, 0.25],
  runway: [0.17, 0.16, 0.20],
  strip: [0.20, 0.18, 0.22],
};

/** Blend two colours by t (0 = a, 1 = b), in place on a fresh array. */
function blend(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** A fine noise texture for the ground, drawn once on a canvas: a near-white
 * base (so it never darkens the vertex colours much), thousands of tiny dark
 * and light speckles, a few soft blotches and faint contour scratches. Tiled
 * over the terrain it breaks the flat plastic look and makes the ground read
 * as moving detail under the aircraft. */
function makeGroundTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#e8e8e8';
  g.fillRect(0, 0, 256, 256);
  // Soft blotches: large-scale variation so no two tiles read the same.
  const rng = (() => {
    let a = 1234567;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();
  for (let i = 0; i < 26; i += 1) {
    const x = rng() * 256;
    const y = rng() * 256;
    const r = 18 + rng() * 42;
    const dark = rng() > 0.5;
    const grad = g.createRadialGradient(x, y, 1, x, y, r);
    grad.addColorStop(0, dark ? 'rgba(120, 110, 100, 0.20)' : 'rgba(255, 255, 255, 0.22)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Speckle: thousands of 1-2 px dots, darker and lighter, the grain of the ground.
  for (let i = 0; i < 5200; i += 1) {
    const v = rng();
    const shade = v < 0.45 ? 90 + Math.floor(rng() * 70) : 215 + Math.floor(rng() * 40);
    g.fillStyle = `rgba(${shade}, ${shade - 6}, ${shade - 14}, ${0.25 + rng() * 0.45})`;
    const s = rng() < 0.85 ? 1 : 2;
    g.fillRect(Math.floor(rng() * 256), Math.floor(rng() * 256), s, s);
  }
  // Faint contour scratches: thin short strokes, like worn paths and rock seams.
  g.strokeStyle = 'rgba(110, 95, 80, 0.28)';
  g.lineWidth = 1;
  for (let i = 0; i < 46; i += 1) {
    const x = rng() * 256;
    const y = rng() * 256;
    const len = 8 + rng() * 22;
    const ang = rng() * Math.PI;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.stroke();
  }
  const tex = new window.THREE.CanvasTexture(c);
  tex.wrapS = window.THREE.RepeatWrapping;
  tex.wrapT = window.THREE.RepeatWrapping;
  tex.repeat.set(72, 72);
  tex.anisotropy = 4;
  return tex;
}

/** A soft radial puff texture for the valley fog banks. */
function makeFogTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(226, 214, 240, 0.55)');
  grad.addColorStop(0.55, 'rgba(216, 200, 232, 0.28)');
  grad.addColorStop(1, 'rgba(216, 200, 232, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new window.THREE.CanvasTexture(c);
}

/** Paint a runway's markings onto a canvas: asphalt, centreline, thresholds, number. */
function makeStripTexture(number, width, length) {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#2c2833';
  g.fillRect(0, 0, 64, 1024);
  // Edge lines.
  g.fillStyle = '#e8e2d5';
  g.fillRect(2, 0, 2, 1024);
  g.fillRect(60, 0, 2, 1024);
  // Centreline dashes.
  for (let y = 40; y < 984; y += 64) {
    g.fillRect(30, y, 4, 34);
  }
  // Threshold bars at both ends.
  for (const y0 of [8, 976]) {
    for (let i = 0; i < 4; i += 1) {
      g.fillRect(8 + i * 13, y0, 8, 30);
    }
  }
  // The runway number, readable from the approach end.
  g.fillStyle = '#e8e2d5';
  g.font = 'bold 64px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.save();
  g.translate(32, 880);
  g.fillText(number, 0, 0);
  g.restore();
  const tex = new window.THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

export class TerrainMesh {
  constructor(scene, terrain) {
    const THREE = window.THREE;
    this.terrain = terrain;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildGround();
    this.buildSea();
    this.buildLake();
    this.buildTrees();
    this.buildRidges();
    this.buildValleyFog();
    this.buildStrip(terrain.runway, '36', true);
    this.buildStrip(terrain.airstrip, '04', false);
    this.buildPapi();
    this.buildOutpost();
  }

  /** The sea to the south: a dark water plane where the land falls away. */
  buildSea() {
    const THREE = window.THREE;
    const geo = new THREE.PlaneGeometry(7000, 3800);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a3a6e, roughness: 0.25, metalness: 0.35 });
    const sea = new THREE.Mesh(geo, mat);
    sea.position.set(0, 0.5, -2700);
    this.group.add(sea);
  }

  /** The lake west of the valley: a flat disc of dark water at level 3 m,
   * roughness 0.1 so it mirrors the sunset sky. The basin floor sits at
   * 0.5 m inside a 160 m radius, so the disc floats 2.5 m clear of the
   * ground everywhere and never clips the shore. */
  buildLake() {
    const THREE = window.THREE;
    const lake = this.terrain.lake;
    const geo = new THREE.CircleGeometry(160, 40);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x1e3a5c, roughness: 0.1, metalness: 0.55 });
    const water = new THREE.Mesh(geo, mat);
    water.position.set(lake.x, lake.level, lake.z);
    this.group.add(water);
  }

  /** Pines on the lower slopes: one InstancedMesh (a single draw call), ~420
   * dark-green cones scattered by a seeded generator on gentle ground
   * (12–95 m, slope < 0.55), kept clear of the runway, the ring course, the
   * airstrip, the lake and the rescue beacon. They give the valley its scale
   * — a forest the aircraft flies over, not a green carpet. */
  buildTrees() {
    const THREE = window.THREE;
    const t = this.terrain;
    const rng = makeRng(t.seed + 55);
    // Keep-out circles: [x, z, radius] — runway strip, ring gates, airstrip,
    // lake, outpost, rescue beacon.
    const keepOut = [
      [0, 0, 220], [0, 600, 70], [320, 1250, 70], [-420, 1850, 70], [220, 2450, 70],
      [880, 2850, 70], [-780, 3050, 70], [480, 3250, 70], [0, 1400, 70],
      [700, 1500, 70], [1200, 2200, 70], [1450, 2650, 260], [-520, 1850, 330],
      [-70, -360, 120], [-700, 2100, 60],
    ];
    const spots = [];
    for (let tries = 0; tries < 6000 && spots.length < 420; tries += 1) {
      const x = range(rng, -1600, 1700);
      const z = range(rng, -300, 3700);
      const h = t.heightAt(x, z);
      if (h < 12 || h > 95) continue;
      if (t.slopeAt(x, z) > 0.55) continue;
      let blocked = false;
      for (const [kx, kz, kr] of keepOut) {
        if (Math.hypot(x - kx, z - kz) < kr) { blocked = true; break; }
      }
      if (blocked) continue;
      spots.push([x, h, z]);
    }
    const geo = new THREE.ConeGeometry(1, 1, 7);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, metalness: 0, flatShading: true });
    const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
    const dummy = new THREE.Object3D();
    const colour = new THREE.Color();
    spots.forEach(([x, h, z], i) => {
      const height = range(rng, 8, 14);
      const radius = range(rng, 2.2, 3.6);
      dummy.position.set(x, h + height / 2 - 0.5, z);
      dummy.rotation.y = rng() * Math.PI * 2;
      dummy.scale.set(radius, height, radius);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // Per-tree tint: dark pines, some a touch lighter, never uniform.
      const v = 0.8 + rng() * 0.45;
      colour.setRGB(0.10 * v, 0.24 * v, 0.12 * v);
      mesh.setColorAt(i, colour);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.group.add(mesh);
    this.treeCount = spots.length;
  }

  /** The heightmap: a displaced plane, vertex-coloured by ground kind AND
   * slope. 256 segments keep the ridged peaks sharp; the normals (computed
   * first) tell steep from gentle, so rock shows on the cliff faces, grass
   * on the easy slopes, snow only where it can stick, and brown scree at
   * the foot of the cliffs — blended smoothly, never banded. */
  buildGround() {
    const THREE = window.THREE;
    const t = this.terrain;
    const width = 6000;
    const depth = 6000;
    // 256 segments: the advisor's cap, sharp enough for ridged peaks without
    // freezing the browser (160 was too coarse for the new arêtes).
    const segX = 256;
    const segZ = 256;
    const geo = new THREE.PlaneGeometry(width, depth, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i) + 1500;
      pos.setY(i, t.heightAt(x, z));
    }
    // Normals first — the slope at each vertex drives the colouring.
    geo.computeVertexNormals();
    const norm = geo.attributes.normal;
    const colours = new Float32Array(pos.count * 3);
    const sstep = (a, b, v) => {
      const u = Math.min(1, Math.max(0, (v - a) / (b - a)));
      return u * u * (3 - 2 * u);
    };
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i) + 1500;
      const h = pos.getY(i);
      // Steepness from the normal: 0 is flat, ~0.5 is a 60-degree face.
      const steep = 1 - norm.getY(i);
      const kind = t.groundKind(x, z);
      let col = GROUND[kind] || GROUND.grass;
      if (kind === 'grass' || kind === 'forest') {
        // Steep grass turns to bare rock; a little scree at the cliff foot.
        col = blend(col, GROUND.rock, sstep(0.18, 0.38, steep));
        if (h > 55 && h < 115) col = blend(col, GROUND.scree, sstep(0.10, 0.22, steep) * 0.55);
      } else if (kind === 'snow') {
        // Snow only sticks where the slope lets it: steep faces stay rock.
        col = blend(col, GROUND.rock, sstep(0.25, 0.45, steep));
      } else if (kind === 'rock') {
        // Gentle low rock greens over; mid-slope rock sheds scree.
        if (h < 100) col = blend(col, GROUND.grass, (1 - sstep(0.10, 0.22, steep)) * 0.45);
        if (h > 55 && h < 115) col = blend(col, GROUND.scree, sstep(0.10, 0.25, steep) * 0.6);
      }
      // Per-vertex jitter from a stable hash, so no two neighbouring vertices
      // share exactly one flat colour — the ground reads as varied earth.
      const frac = ((Math.sin(x * 12.9898 + z * 78.233 + 4.7) * 43758.5453) % 1 + 1) % 1;
      const j = 0.86 + 0.28 * frac;
      colours[i * 3] = col[0] * j;
      colours[i * 3 + 1] = col[1] * j;
      colours[i * 3 + 2] = col[2] * j;
    }
    // The geometry is centred at z = 1500 in world space.
    geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    // The noise texture multiplies the vertex colours: fine grain on top of
    // the broad ground kinds, so the terrain never reads as flat plastic.
    const mat = new THREE.MeshStandardMaterial({
      map: makeGroundTexture(),
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, 0, 1500);
    mesh.receiveShadow = true;
    // The ground casts shadows on itself now: with the sun this low, the
    // near ridges throw long soft shadows across the valley floor. The
    // aircraft still never casts (its blob stays fixed).
    mesh.castShadow = true;
    this.group.add(mesh);
  }

  /** Layered mountain ridges ringing the valley: three jagged skyline curtains
   * (near, mid, far), each a different haze colour so the distance reads as
   * atmospheric perspective. They are unlit silhouettes (never black, never
   * blown out) with a vertical light gradient baked into their vertex colours,
   * and they darken with the dusk. Pure scenery — outside the flight area,
   * never touching gameplay. */
  buildRidges() {
    const THREE = window.THREE;
    const seed = this.terrain.seed;
    this.ridgeMats = [];
    this.ridgeBase = [];
    const layers = [
      { radius: 2900, base: 340, amp: 420, colour: 0x8a5570, wobble: 260 },
      { radius: 3600, base: 520, amp: 620, colour: 0x6e4a78, wobble: 340 },
      { radius: 4400, base: 760, amp: 820, colour: 0x4a3a72, wobble: 420 },
      { radius: 5200, base: 950, amp: 1000, colour: 0x3a2f5e, wobble: 520 },
    ];
    const SEG = 96;
    layers.forEach((layer, li) => {
      const positions = [];
      const colours = [];
      const indices = [];
      const peaks = [];
      // Jagged peaks: three sine scales plus a hash jitter, smoothed so the
      // skyline has broad shoulders and sharp spires, never uniform teeth.
      for (let i = 0; i <= SEG; i += 1) {
        const a = (i / SEG) * Math.PI * 2;
        const h1 = Math.sin(a * 3 + li * 1.7 + seed * 0.13);
        const h2 = Math.sin(a * 7 + li * 2.9 + seed * 0.31);
        const h3 = Math.sin(a * 13 + li * 4.1 + seed * 0.07);
        const hash = ((Math.sin(i * 127.1 + li * 311.7 + seed) * 43758.5453) % 1 + 1) % 1;
        let peak = layer.base + layer.amp * (0.42 + 0.26 * h1 + 0.18 * h2 + 0.14 * h3) + hash * layer.amp * 0.22;
        peak = Math.max(layer.base * 0.55, peak);
        peaks.push(peak);
      }
      for (let i = 0; i <= SEG; i += 1) {
        const peak = 0.25 * peaks[Math.max(0, i - 1)] + 0.5 * peaks[i] + 0.25 * peaks[Math.min(SEG, i + 1)];
        peaks[i] = peak;
      }
      for (let i = 0; i <= SEG; i += 1) {
        const a = (i / SEG) * Math.PI * 2;
        const r = layer.radius + Math.sin(a * 5 + li * 2.3) * layer.wobble * 0.5
          + (((Math.sin(i * 91.7 + li * 57.3) * 43758.5453) % 1 + 1) % 1 - 0.5) * layer.wobble;
        const x = Math.cos(a) * r;
        const z = 1500 + Math.sin(a) * r;
        // Base vertex (sunk below the ground, darker) and peak vertex (lighter).
        positions.push(x, -30, z, x, peaks[i], z);
        colours.push(0.45, 0.45, 0.5, 1.0, 1.0, 1.0);
        if (i < SEG) {
          const b = i * 2;
          indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
        }
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colours, 3));
      geo.setIndex(indices);
      const mat = new THREE.MeshBasicMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        fog: false,
      });
      mat.color.setHex(layer.colour);
      const mesh = new THREE.Mesh(geo, mat);
      this.group.add(mesh);
      this.ridgeMats.push(mat);
      this.ridgeBase.push(new THREE.Color(layer.colour));
    });
    // The colour the ridges sink toward as the light dies.
    this.ridgeDusk = new THREE.Color(0x191230);
  }

  /** Valley fog: a dozen big soft lavender banks lying low over the valley
   * floor, drifting almost imperceptibly. They sell the "lembah berkabut"
   * without ever hiding the runway or the rings. */
  buildValleyFog() {
    const THREE = window.THREE;
    const tex = makeFogTexture();
    this.fogBanks = [];
    const spots = [
      [-900, 900, 420], [700, 1400, 520], [-1400, 2200, 480], [1100, 2600, 560],
      [-600, 2900, 460], [300, 700, 380], [-1800, 1500, 540], [1600, 1800, 500],
      [-300, 3400, 620], [900, 3300, 440], [-1200, 600, 400], [500, 2100, 480],
    ];
    spots.forEach(([x, z, s], i) => {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        opacity: 0.13 + (i % 3) * 0.03,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.position.set(x, 26 + (i % 4) * 7, z);
      sprite.scale.set(s * 1.9, s * 0.42, 1);
      sprite.userData.drift = 1.5 + (i % 5) * 0.7;
      this.group.add(sprite);
      this.fogBanks.push(sprite);
    });
  }

  /** One flat strip (runway or airstrip) with painted markings. */
  buildStrip(strip, number, main) {
    const THREE = window.THREE;
    const tex = makeStripTexture(number, strip.width, strip.length);
    const geo = new THREE.PlaneGeometry(strip.width, strip.length);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(strip.x, strip.elev + 0.25, strip.z);
    mesh.rotation.y = -strip.heading;
    this.group.add(mesh);
    // Edge lights: warm dots along both sides (only the main runway).
    if (main) {
      const lightGeo = new THREE.SphereGeometry(0.9, 8, 6);
      const lightMat = new THREE.MeshBasicMaterial({ color: 0xffbe5a });
      const s = Math.sin(strip.heading);
      const c = Math.cos(strip.heading);
      for (let along = -strip.length / 2 + 10; along <= strip.length / 2 - 10; along += 60) {
        for (const across of [-strip.width / 2 - 2, strip.width / 2 + 2]) {
          const lamp = new THREE.Mesh(lightGeo, lightMat);
          lamp.position.set(
            strip.x + s * along + c * across,
            strip.elev + 0.8,
            strip.z + c * along - s * across,
          );
          this.group.add(lamp);
        }
      }
    }
  }

  /** PAPI glideslope lights: four lamps beside the threshold. */
  buildPapi() {
    const THREE = window.THREE;
    const strip = this.terrain.runway;
    this.papi = [];
    const s = Math.sin(strip.heading);
    const c = Math.cos(strip.heading);
    const along = -strip.length / 2 + 60;
    for (let i = 0; i < 4; i += 1) {
      const across = -(strip.width / 2 + 8 + i * 5);
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), mat);
      lamp.position.set(
        strip.x + s * along + c * across,
        strip.elev + 0.9,
        strip.z + c * along - s * across,
      );
      this.group.add(lamp);
      this.papi.push(mat);
    }
  }

  /** Set the PAPI reading: the first `whiteCount` lamps are white, the rest red. */
  setPapi(whiteCount) {
    this.papi.forEach((mat, i) => {
      mat.color.setHex(i < whiteCount ? 0xfff0c8 : 0xff283c);
    });
  }

  /** The outpost by the threshold: hangar, tower and a windsock. */
  buildOutpost() {
    const THREE = window.THREE;
    const wall = new THREE.MeshStandardMaterial({ color: 0x4a3a52, roughness: 0.9 });
    const roof = new THREE.MeshStandardMaterial({ color: 0x2e2438, roughness: 0.9 });
    const hangar = new THREE.Mesh(new THREE.BoxGeometry(34, 12, 22), wall);
    hangar.position.set(-70, 6, -360);
    this.group.add(hangar);
    const hangarRoof = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 34, 12, 1, false, 0, Math.PI), roof);
    hangarRoof.rotation.z = Math.PI / 2;
    hangarRoof.rotation.y = Math.PI / 2;
    hangarRoof.position.set(-70, 12, -360);
    hangarRoof.scale.set(1, 1, 0.65);
    this.group.add(hangarRoof);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(7, 26, 7), wall);
    tower.position.set(-40, 13, -380);
    this.group.add(tower);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 10), new THREE.MeshStandardMaterial({ color: 0x1c2a3a, roughness: 0.4 }));
    cab.position.set(-40, 28, -380);
    this.group.add(cab);
    // Windsock: a pole and an orange cone that swings slowly.
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 9, 6), new THREE.MeshStandardMaterial({ color: 0x888888 }));
    pole.position.set(30, 4.5, -340);
    this.group.add(pole);
    const sock = new THREE.Mesh(new THREE.ConeGeometry(1.4, 5, 8), new THREE.MeshStandardMaterial({ color: 0xff7a3d, roughness: 0.7 }));
    sock.rotation.z = Math.PI / 2;
    sock.position.set(32.5, 8.6, -340);
    this.group.add(sock);
    this.windsock = sock;
  }

  /** Sway the windsock gently, darken the ridges as the light dies, and let
   * the valley fog banks drift. */
  update(time, dusk) {
    if (this.windsock) {
      this.windsock.rotation.y = Math.sin(time * 0.5) * 0.4;
    }
    if (this.ridgeMats && typeof dusk === 'number') {
      this.ridgeMats.forEach((mat, i) => {
        mat.color.copy(this.ridgeBase[i]).lerp(this.ridgeDusk, dusk * 0.55);
      });
    }
    if (this.fogBanks) {
      for (const bank of this.fogBanks) {
        bank.position.x += bank.userData.drift * 0.016;
        if (bank.position.x > 2200) bank.position.x = -2200;
      }
    }
  }
}
