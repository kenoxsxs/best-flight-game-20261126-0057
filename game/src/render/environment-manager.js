// The environment manager for Dusk Runner: the setting sun as a visible
// mission timer. One class, one job: the light of the world. As the mission
// clock runs out, the sky slides from golden hour through reddish purple into
// dark twilight, the sun sinks toward the horizon and reddens, the fog follows
// the sky, and the instrument and navigation lights glow brighter against the
// dark. The boot feeds it one number — the dusk factor, 0 at launch and 1 at
// the deadline — and it moves every light in the scene.

import { SkyDome } from './sky-dome.js';

/** The sky's colour at each stage of the sunset (fog + background). */
const FOG_STAGES = [
  { dusk: 0.0, colour: 0xe8956a },
  { dusk: 0.5, colour: 0xb06a7e },
  { dusk: 0.8, colour: 0x6e4a6e },
  { dusk: 1.0, colour: 0x2e2a55 },
];

function fogColourAt(dusk) {
  for (let i = 1; i < FOG_STAGES.length; i += 1) {
    if (dusk <= FOG_STAGES[i].dusk) {
      const a = FOG_STAGES[i - 1];
      const b = FOG_STAGES[i];
      const t = (dusk - a.dusk) / (b.dusk - a.dusk);
      const ca = a.colour;
      const cb = b.colour;
      const r = ((ca >> 16) & 0xff) + (((cb >> 16) & 0xff) - ((ca >> 16) & 0xff)) * t;
      const g = ((ca >> 8) & 0xff) + (((cb >> 8) & 0xff) - ((ca >> 8) & 0xff)) * t;
      const bl = (ca & 0xff) + ((cb & 0xff) - (ca & 0xff)) * t;
      return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
    }
  }
  return FOG_STAGES[FOG_STAGES.length - 1].colour;
}

export class EnvironmentManager {
  constructor(scene, seed) {
    const THREE = window.THREE;
    this.scene = scene;
    this.sky = new SkyDome(scene, seed);
    // The sun: low in the west, warm gold, throwing long shadows. Kept at
    // 1.2 (not 1.35) so the orange wash does not swallow the ground's own
    // green and brown — the vertex colours must still read.
    this.sunDir = new THREE.Vector3(-0.86, 0.22, -0.3).normalize();
    this.sun = new THREE.DirectionalLight(0xffaa55, 1.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -130;
    this.sun.shadow.camera.right = 130;
    this.sun.shadow.camera.top = 130;
    this.sun.shadow.camera.bottom = -130;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 900;
    // Soft-shadow tuning for the terrain self-shadowing: the normal bias
    // keeps the steep ridged faces from striping with acne, and the small
    // depth bias keeps the shadow edge honest. Map stays 1024 (the advisor's
    // cap) — the shadow camera only covers ±130 m around the aircraft.
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 1.5;
    scene.add(this.sun);
    scene.add(this.sun.target);
    // Sky bounce: violet sky above, dark brown earth below — never flat black.
    // Stronger (1.0) and with a cooler ambient so the green/brown ground
    // colours survive the sunset instead of drowning in orange.
    this.hemi = new THREE.HemisphereLight(0x8a5aae, 0x4a3a2a, 1.0);
    scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(0x3a3a5e, 0.55);
    scene.add(this.ambient);
    // Rim/fill light from the east (opposite the setting sun): cool lavender,
    // no shadows. It lifts the side of the aircraft the sun never reaches,
    // so the Kestrel reads as a painted courier, never a black silhouette.
    // Slightly stronger (0.6) now that the terrain casts its own soft shadows
    // and the east slopes would otherwise go too dark.
    this.fillDir = new THREE.Vector3(0.85, 0.35, 0.25).normalize();
    this.fill = new THREE.DirectionalLight(0x9a86e0, 0.6);
    scene.add(this.fill);
    scene.add(this.fill.target);
    this.dusk = 0;
  }

  /** Set the scene fog from the mission's fog level (rescue is thick).
   * The scene uses FogExp2: density 0.00028 in clear air, up to ~0.00092 in
   * the rescue fog — far peaks haze out cinematically while the runway and
   * the next ring stay readable. (A density of 0.0025 would fog everything
   * past ~500 m into a wall, so it is tuned down for this 6 km world.) */
  applyFog(mission) {
    const f = mission.fog;
    this.scene.fog.density = 0.00028 + f * 0.00085;
  }

  /** Move every light for this frame: sky, sun, fog and the glow of the dark. */
  update(dusk, camera, plane, time, dt) {
    this.dusk = dusk;
    this.sky.update(camera, time, dt);
    this.sky.updateDusk(dusk);
    // The sun sinks and reddens as the light dies — but the scene never goes
    // black: hemisphere and ambient keep a floor so no frame has dead areas.
    this.sun.intensity = 1.2 - dusk * 0.55;
    this.sun.color.setHex(dusk > 0.6 ? 0xff5a2a : 0xffaa55);
    this.hemi.intensity = 1.0 - dusk * 0.35;
    this.ambient.intensity = 0.55 - dusk * 0.18;
    this.fill.intensity = 0.6 - dusk * 0.15;
    this.scene.fog.color.setHex(fogColourAt(dusk));
    // The sun follows the aircraft so its shadow stays close and sharp.
    this.sun.position.set(plane.x + this.sunDir.x * 320, plane.y + this.sunDir.y * 320, plane.z + this.sunDir.z * 320);
    this.sun.target.position.set(plane.x, plane.y, plane.z);
    // The fill follows too, always lighting the sun's shadow side.
    this.fill.position.set(plane.x + this.fillDir.x * 320, plane.y + this.fillDir.y * 320, plane.z + this.fillDir.z * 320);
    this.fill.target.position.set(plane.x, plane.y, plane.z);
  }
}
