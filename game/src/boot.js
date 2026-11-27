// Dusk Runner — the boot: wires the 3D world, the flight model, the HUD and
// the screens into one running game. A THREE.WebGLRenderer paints the sunset
// world (terrain, sky, aircraft, rings, smoke); a 2D canvas overlays the dense
// HUD and the cockpit MFD; DOM screens cover the title, pause and endings.
// The loop steps the arcade flight physics, moves the camera, and renders.
// Screenshots are staged with `?shot=<name>&seed=<n>` (see shots.js).

import { Terrain } from './world/terrain.js';
import { FlightPhysics, EV_RING, EV_LANDED, EV_CRASHED, EV_FUEL_OUT } from './physics/flight-physics.js';
import { MissionManager } from './missions/mission-manager.js';
import { CameraRig } from './render/camera-rig.js';
import { EnvironmentManager } from './render/environment-manager.js';
import { TerrainMesh } from './render/terrain-mesh.js';
import { Aircraft } from './render/aircraft.js';
import { RingGates } from './render/ring-gates.js';
import { SmokeTrail } from './render/smoke.js';
import { MFDRenderer } from './render/mfd-renderer.js';
import { HUD } from './ui/hud.js';
import { ScreenManager } from './ui/screens.js';
import { Input } from './ui/input.js';
import { SoundBank } from './ui/audio.js';
import { stageShot } from './shots.js';

const THREE = window.THREE;
const params = new URLSearchParams(window.location.search);
const SEED = parseInt(params.get('seed') || '1', 10) || 1;
const SHOT = params.get('shot') || '';

// --- Renderer, scene, fog, light -------------------------------------------
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
// Exponential fog, violet at dusk — distant peaks haze out cinematically
// while the runway and the next ring stay readable. Density is driven per
// mission by EnvironmentManager.applyFog (clear ~0.0004, rescue ~0.0009).
scene.fog = new THREE.FogExp2(0x4a2c5c, 0.00035);

// --- World ------------------------------------------------------------------
const terrain = new Terrain(SEED);
const terrainMesh = new TerrainMesh(scene, terrain);
const env = new EnvironmentManager(scene, SEED);
const aircraft = new Aircraft(scene);
const ringGates = new RingGates(scene);
const smoke = new SmokeTrail(scene);
const cameraRig = new CameraRig();

// --- Game state --------------------------------------------------------------
const missions = new MissionManager(terrain);
const plane = new FlightPhysics(terrain);
const hud = new HUD();
const mfd = new MFDRenderer();
const screens = new ScreenManager();
const input = new Input(canvas);
const sound = new SoundBank();
let mode = 'chase';
let state = 'title';
let time = 0;
let frames = 0;
let missionDone = false;
let warnCooldown = 0;
// Ring-pass feedback: a golden flash and a floating "+100" when a gate is flown.
let ringFlash = 0;
let scorePop = null;

// The 2D overlay canvas (HUD + MFD), stacked over the WebGL canvas.
const overlay = document.getElementById('overlay');
const octx = overlay.getContext('2d');

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  overlay.width = w;
  overlay.height = h;
  cameraRig.resize(w, h);
  input.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

/** Set the scene fog from the mission's fog level (rescue is thick). */
function applyFog(mission) {
  env.applyFog(mission);
}

/** Rebuild the rings and the beacon for the current mission. */
function loadMission(mission) {
  applyFog(mission);
  ringGates.build(mission.rings);
  ringGates.buildBeacon(mission.beacon);
  plane.reset(mission);
  missionDone = false;
}

/** The PAPI reading from the glideslope, and whether the aircraft is on final. */
function computePapi() {
  const r = terrain.runway;
  const dx = plane.x - r.x;
  const dz = plane.z - (r.z - r.length / 2);
  const dist = Math.hypot(dx, dz);
  const along = dz;
  const across = dx;
  const headingDiff = Math.abs(((plane.heading - r.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  const onFinal = !plane.onGround && dist < 2500 && dist > 40 && headingDiff < 0.45
    && plane.y < 420 && Math.abs(across) < 160 && along < 0;
  const angle = Math.atan2(Math.max(0, plane.y - r.elev), Math.max(1, dist));
  const deg = (angle * 180) / Math.PI;
  const white = deg > 3.5 ? 4 : deg > 3.2 ? 3 : deg > 2.8 ? 2 : deg > 2.5 ? 1 : 0;
  return { white, onFinal };
}

// --- Flow --------------------------------------------------------------------
function launch() {
  sound.unlock();
  state = 'playing';
  screens.hideAll();
}

function restart() {
  loadMission(missions.current);
  state = 'title';
  screens.showTitle();
}

screens.onMissionPick((id) => {
  missions.select(id);
  loadMission(missions.current);
});
screens.onLaunch(launch);
screens.onResume(() => {
  state = 'playing';
  screens.hideAll();
});
screens.onRestart(restart);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && state === 'title') launch();
});

// --- Main loop ---------------------------------------------------------------
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  frames += 1;
  const mission = missions.current;

  if (state === 'playing') {
    // One-shot keys.
    if (input.wasPressed('KeyP')) {
      state = 'paused';
      screens.showPause();
    }
    if (input.wasPressed('KeyR')) restart();
    if (input.wasPressed('KeyM')) sound.toggleMute();
    if (input.wasPressed('KeyC')) mode = mode === 'chase' ? 'cockpit' : 'chase';
    // Fly.
    const events = plane.step(dt, {
      pitch: input.pitch(),
      roll: input.roll(),
      throttle: input.throttle(),
      brake: input.brake(),
    });
    missions.checkBeacon(plane);
    if (events & EV_RING) {
      ringGates.setNext(plane.nextRing);
      sound.ring();
      // A golden flash and a floating score popup: the pass must be felt.
      ringFlash = 1;
      scorePop = { text: '+100', t: 0 };
    }
    if (events & EV_LANDED) {
      sound.thud();
      if (missions.isComplete(plane) && !missionDone) {
        missionDone = true;
        const bonus = missions.completionBonus(plane);
        plane.score += bonus;
        state = 'complete';
        screens.showComplete(plane.score, bonus);
      }
    }
    if (events & EV_CRASHED) {
      state = 'over';
      screens.showGameOver(plane.crashReason, plane.score);
    }
    if (events & EV_FUEL_OUT) sound.warn();
    // Race the Light: the sun set before the last ring — out of light. Only
    // while the sortie is still live (a crash or landing already ended it).
    if (state === 'playing' && mission.id === 'rings' && plane.nextRing < 8 && mission.timeLeft(plane) <= 0) {
      state = 'over';
      screens.showGameOver('Out of light — the sun set before the last ring', plane.score);
    }
    if (plane.stalled && time - warnCooldown > 1.2) {
      warnCooldown = time;
      sound.warn();
    }
    sound.engine(plane.throttle, plane.airborne);
    smoke.emit(plane, dt);
    smoke.exhaust(plane, dt);
  } else if (state === 'title') {
    // The cover scene idles: the prop turns slowly, the world lives.
    plane.throttle = 0.22;
    sound.engine(0, false);
  }

  // World updates (every state, so the title screen is alive).
  smoke.update(dt);
  // Dusk: the sun is the mission timer — the light dies as the clock runs out.
  // The effective deadline counts the rings bonus (+10 s per gate), so the
  // sun sets when the *effective* clock dies, not the 90 s board.
  const bonus = mission.id === 'rings' ? (plane.ringsHit || 0) * 10 : 0;
  const limit = (mission.timeLimit || 0) + bonus;
  const dusk = state === 'playing' && limit
    ? Math.min(1, Math.max(0, plane.time / limit))
    : 0;
  aircraft.update(plane, dt, time, dusk);
  aircraft.group.visible = mode !== 'cockpit';
  cameraRig.update(plane, mode, dt);
  ringGates.update(time);
  env.update(dusk, cameraRig.camera, plane, time, dt);
  terrainMesh.update(time, dusk);
  // The rescue flies with its landing light on, to find the strip in the fog.
  aircraft.setLandingLight(mission.id === 'rescue' && plane.airborne);
  const papi = computePapi();
  terrainMesh.setPapi(papi.white);

  renderer.render(scene, cameraRig.camera);

  // 2D overlay: the dense HUD, and the MFD in the cockpit.
  octx.clearRect(0, 0, overlay.width, overlay.height);
  if (state !== 'title') {
    hud.draw(octx, overlay.width, overlay.height, plane, mission, terrain, mode, time, papi.onFinal ? papi.white : -1);
    if (mode === 'cockpit') {
      mfd.draw(octx, overlay.width, overlay.height, plane, mission, terrain);
    }
  }
  // Ring-pass feedback on the overlay: a golden edge flash that fades, and
  // a "+100" that rises and fades over about a second.
  if (ringFlash > 0) {
    const w = overlay.width;
    const h = overlay.height;
    const grad = octx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.75);
    grad.addColorStop(0, 'rgba(255, 190, 60, 0)');
    grad.addColorStop(1, `rgba(255, 190, 60, ${0.5 * ringFlash})`);
    octx.fillStyle = grad;
    octx.fillRect(0, 0, w, h);
    ringFlash = Math.max(0, ringFlash - dt * 1.6);
  }
  if (scorePop) {
    scorePop.t += dt;
    const a = Math.max(0, 1 - scorePop.t / 1.1);
    if (a <= 0) {
      scorePop = null;
    } else {
      octx.save();
      octx.globalAlpha = a;
      octx.fillStyle = '#ffbe3c';
      octx.shadowColor = '#ff8c28';
      octx.shadowBlur = 16;
      octx.font = '900 34px system-ui, sans-serif';
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.fillText(scorePop.text, overlay.width / 2, overlay.height * 0.38 - scorePop.t * 55);
      octx.restore();
    }
  }

  // Screenshot staging: raise the flag once the scene has rendered.
  if (SHOT && frames >= 4 && !window.__shotReady) {
    window.__shotReady = true;
  }
}

// --- Start -------------------------------------------------------------------
loadMission(missions.current);
if (SHOT) {
  mode = stageShot(SHOT, { plane, missions, screens });
  state = screens.state === 'title' ? 'title' : 'playing';
  if (SHOT !== 'start') state = 'playing';
} else {
  screens.showTitle();
}
requestAnimationFrame(frame);
