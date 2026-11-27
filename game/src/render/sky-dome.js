// The Sunset Sortie sky for Dusk Runner: a gradient dome (deep purple above,
// orange at the horizon), a low sun with a glow, and soft clouds drifting over
// the valley. One class, one job: everything above the ground. The dome follows
// the camera so the pilot never reaches its edge; the sun and clouds are fixed
// in the world, so the light always comes from the west.

import { makeRng, range } from '../core/random.js';

const ZENITH = [0.07, 0.04, 0.20];
const MID = [0.58, 0.15, 0.46];
const HORIZON = [1.0, 0.55, 0.20];

function lerpColor(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** A soft round puff texture, drawn once on a canvas and reused by every cloud. */
function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 32, 4, 64, 32, 60);
  grad.addColorStop(0, 'rgba(255, 200, 170, 0.75)');
  grad.addColorStop(0.6, 'rgba(255, 180, 150, 0.35)');
  grad.addColorStop(1, 'rgba(255, 180, 150, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 64);
  return new window.THREE.CanvasTexture(c);
}

/** A warm radial glow for the sun. */
function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 4, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255, 217, 122, 0.95)');
  grad.addColorStop(0.25, 'rgba(255, 154, 61, 0.5)');
  grad.addColorStop(1, 'rgba(255, 154, 61, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new window.THREE.CanvasTexture(c);
}

export class SkyDome {
  constructor(scene, seed) {
    const THREE = window.THREE;
    this.scene = scene;
    // Gradient dome: vertex colours from the zenith down to the horizon.
    const geo = new THREE.SphereGeometry(6000, 24, 16);
    const pos = geo.attributes.position;
    const colours = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i += 1) {
      const y = pos.getY(i) / 6000;
      let col;
      if (y > 0.25) {
        col = lerpColor(MID, ZENITH, Math.min(1, (y - 0.25) / 0.75));
      } else if (y > 0) {
        col = lerpColor(HORIZON, MID, y / 0.25);
      } else {
        col = HORIZON;
      }
      colours[i * 3] = col[0];
      colours[i * 3 + 1] = col[1];
      colours[i * 3 + 2] = col[2];
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
    this.dome = new THREE.Mesh(geo, mat);
    scene.add(this.dome);
    // The sun: a bright disc low in the west, with a glow sprite.
    this.sunDir = new THREE.Vector3(-0.86, 0.16, -0.3).normalize();
    const sunGeo = new THREE.CircleGeometry(180, 24);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffd97a, fog: false });
    this.sun = new THREE.Mesh(sunGeo, sunMat);
    this.sun.position.copy(this.sunDir).multiplyScalar(5200);
    this.sun.lookAt(0, 0, 0);
    scene.add(this.sun);
    const glowMat = new THREE.SpriteMaterial({ map: makeGlowTexture(), transparent: true, fog: false, depthWrite: false });
    this.glow = new THREE.Sprite(glowMat);
    this.glow.position.copy(this.sunDir).multiplyScalar(5100);
    this.glow.scale.set(1600, 1600, 1);
    scene.add(this.glow);
    // Clouds: soft sprites scattered high over the valley, drifting slowly.
    const rng = makeRng(seed + 77);
    const cloudTex = makeCloudTexture();
    this.clouds = [];
    for (let i = 0; i < 32; i += 1) {
      const mat2 = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.75, fog: false, depthWrite: false });
      const sprite = new THREE.Sprite(mat2);
      const x = range(rng, -2600, 2600);
      const y = range(rng, 340, 640);
      const z = range(rng, -600, 5200);
      const s = range(rng, 300, 700);
      sprite.position.set(x, y, z);
      sprite.scale.set(s * 1.8, s * 0.55, 1);
      sprite.userData.drift = range(rng, 1, 4);
      scene.add(sprite);
      this.clouds.push(sprite);
    }
    // A second, higher layer: thin cirrus streaks far above the cumulus,
    // flatter and fainter, so the sky has depth instead of one cloud band.
    this.cirrus = [];
    for (let i = 0; i < 10; i += 1) {
      const mat3 = new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.32, fog: false, depthWrite: false });
      const sprite = new THREE.Sprite(mat3);
      const x = range(rng, -2800, 2800);
      const y = range(rng, 760, 980);
      const z = range(rng, -800, 5200);
      const s = range(rng, 500, 1100);
      sprite.position.set(x, y, z);
      sprite.scale.set(s * 2.4, s * 0.22, 1);
      sprite.userData.drift = range(rng, 0.5, 1.5);
      scene.add(sprite);
      this.cirrus.push(sprite);
    }
    // Stars: faint points high in the dome that fade in as twilight deepens.
    // They ride with the camera like the dome, so they never parallax away.
    const starRng = makeRng(seed + 99);
    const starCount = 220;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const a = starRng() * Math.PI * 2;
      const e = Math.asin(0.15 + starRng() * 0.85);
      const r = 5800;
      starPos[i * 3] = Math.cos(a) * Math.cos(e) * r;
      starPos[i * 3 + 1] = Math.sin(e) * r;
      starPos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    this.starMat = new THREE.PointsMaterial({
      color: 0xdde4ff, size: 2, sizeAttenuation: false,
      transparent: true, opacity: 0, fog: false, depthWrite: false,
    });
    this.stars = new THREE.Points(starGeo, this.starMat);
    scene.add(this.stars);
  }

  /** Follow the camera and drift the clouds. */
  update(camera, time, dt) {
    this.dome.position.copy(camera.position);
    this.stars.position.copy(camera.position);
    this.sun.position.copy(camera.position).addScaledVector(this.sunDir, 5200);
    this.sun.lookAt(camera.position);
    this.glow.position.copy(camera.position).addScaledVector(this.sunDir, 5100);
    for (const c of this.clouds) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 3000) c.position.x = -3000;
    }
    for (const c of this.cirrus) {
      c.position.x += c.userData.drift * dt;
      if (c.position.x > 3200) c.position.x = -3200;
    }
    void time;
  }

  /** Dusk: the sun is the mission timer. As `dusk` (0-1) grows, the sky
   * darkens, the sun sinks toward the horizon and dims, and the light dies. */
  updateDusk(dusk) {
    const THREE = window.THREE;
    // The dome darkens (its material colour multiplies the vertex colours).
    this.dome.material.color.setRGB(1 - dusk * 0.55, 1 - dusk * 0.6, 1 - dusk * 0.4);
    // The sun sinks and reddens.
    this.sunDir.set(-0.86, 0.22 - dusk * 0.18, -0.3).normalize();
    this.sun.material.color.setHex(dusk > 0.7 ? 0xff5a2a : 0xffd97a);
    this.glow.material.opacity = 1 - dusk * 0.55;
    // Stars come out as the light dies: invisible before dusk 0.4, clear by 0.9.
    this.starMat.opacity = Math.max(0, Math.min(0.8, (dusk - 0.4) * 1.6));
    void THREE;
  }
}
