// The screenshot staging for Dusk Runner: when the page opens with
// `?shot=<name>&seed=<n>`, the game is put into a chosen moment instead of
// the title screen, so a real render of the game's own code can be captured.
// The state is set directly (a deterministic pose, not a faked image), the
// scene renders for a few frames, and `window.__shotReady` is raised for the
// screenshot tool. One module, one job: pose the aircraft for the camera.
//
// Shots (the contact sheet is the judgement):
//   start   — the cover: banking hard over sunset mountain silhouettes, HUD lit.
//   cockpit — inside the cockpit, MFD screens lit, chasing a glowing ring.
//   play    — piercing a glowing ring in Race the Light, the timer already red.
//   final   — Last Call in thick fog, the landing light on the mountain strip.

export function stageShot(name, ctx) {
  const { plane, missions, screens } = ctx;
  if (name === 'cockpit') {
    // Race the Light, level cruise, inside the cockpit, a ring dead ahead.
    // The aircraft is placed 350 m before ring 2, level with it, so the
    // glowing gate and the valley below fill the windshield.
    missions.select('rings');
    const ring = missions.current.rings[1];
    const n = ring.normal;
    plane.reset(missions.current);
    plane.x = ring.x - n[0] * 350;
    plane.y = ring.y;
    plane.z = ring.z - n[2] * 350;
    plane.heading = Math.atan2(n[0], n[2]);
    plane.pitch = 0.0;
    plane.roll = 0.08;
    plane.speed = 65;
    plane.throttle = 0.7;
    plane.fuel = 74;
    plane.damage = 0;
    plane.onGround = false;
    plane.airborne = true;
    plane.nextRing = 1;
    plane.ringsHit = 1;
    plane.time = 35;
    screens.hideAll();
    return 'cockpit';
  }
  if (name === 'play') {
    // Race the Light, at ring 5, the clock nearly gone and the sky dark.
    // The aircraft rides 45 m above the gate and climbs (pitch 0.12): the
    // ground rises steeply toward ring 6, and the old staging flew straight
    // into the north wall. Climbing keeps the 9-second screenshot flight
    // clear of the peaks while the ring stays in frame behind.
    missions.select('rings');
    const ring = missions.current.rings[4];
    const n = ring.normal;
    plane.reset(missions.current);
    plane.x = ring.x - n[0] * 30;
    plane.y = ring.y + 45;
    plane.z = ring.z - n[2] * 30;
    plane.heading = Math.atan2(n[0], n[2]);
    plane.pitch = 0.12;
    plane.roll = 0.35;
    plane.speed = 75;
    plane.throttle = 0.85;
    plane.fuel = 30;
    plane.damage = 0;
    plane.onGround = false;
    plane.airborne = true;
    plane.nextRing = 4;
    plane.ringsHit = 4;
    plane.time = 105;
    screens.hideAll();
    return 'chase';
  }
  if (name === 'final') {
    // Last Call: the beacon found, thick fog, the landing light on the strip.
    // Final approach to the mountain strip (1450, 2650, elev 56 m, heading
    // 0.7): the aircraft starts 500 m out along the strip's own direction,
    // at 200 m — high enough to clear the 93 m hill on the approach and the
    // tall east wall, low enough that the landing light (range 320 m) still
    // paints the strip. The old staging sat at 130 m over ground that rises
    // to ~132 m there, so it started inside the mountain and crashed.
    missions.select('rescue');
    missions.beaconReached = true;
    plane.reset(missions.current);
    const strip = missions.current.landingSite === 'strip'
      ? { x: 1450, z: 2650, heading: 0.7 }
      : { x: 0, z: 0, heading: 0 };
    const back = 500;
    plane.x = strip.x - Math.sin(strip.heading) * back;
    plane.y = 200;
    plane.z = strip.z - Math.cos(strip.heading) * back;
    plane.heading = strip.heading;
    plane.pitch = -0.03;
    plane.roll = 0.02;
    plane.speed = 45;
    plane.throttle = 0.4;
    plane.fuel = 40;
    plane.damage = 0;
    plane.onGround = false;
    plane.airborne = true;
    plane.time = 200;
    screens.hideAll();
    return 'chase';
  }
  // Default (start): the cover — banking hard over the sunset mountains.
  missions.select('rings');
  const ring = missions.current.rings[2];
  const n = ring.normal;
  plane.reset(missions.current);
  plane.x = ring.x - n[0] * 90;
  plane.y = ring.y + 10;
  plane.z = ring.z - n[2] * 90;
  plane.heading = Math.atan2(n[0], n[2]);
  plane.pitch = 0.03;
  plane.roll = 0.6;
  plane.speed = 70;
  plane.throttle = 0.8;
  plane.fuel = 68;
  plane.damage = 0;
  plane.onGround = false;
  plane.airborne = true;
  plane.nextRing = 2;
  plane.ringsHit = 2;
  plane.time = 60;
  screens.hideAll();
  return 'chase';
}
