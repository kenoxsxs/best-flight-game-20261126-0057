// The aircraft for Dusk Runner: the Kestrel, a rugged civilian twin-prop
// courier — high wing, a cargo pod slung under the belly, two engines with
// spinning props, faded white paint with taxi-yellow accents, a little worn
// from the work. Nothing stealth, nothing military: a working aeroplane built
// from primitives, so its silhouette is a courier's, not a fighter's. One
// class, one job: the aircraft mesh. It carries a landing light (a real
// SpotLight) for the foggy rescue, and its navigation lights glow brighter as
// the dusk deepens.

/** The fuselage skin, drawn on a canvas: faded white paint, faint panel
 * frames and longerons, rivet dots, and the "DUSK-1" registration on both
 * flanks, set high on the upper fuselage clear of the yellow cheatline.
 * (Cylinder UV: u = 0.25 is the right flank, u = 0.75 the left, u = 0.5 the
 * top, v = 1 the nose. The text is rotated so it reads along the fuselage,
 * letters upright on each side.) */
function makeFuselageTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#f2ead9';
  g.fillRect(0, 0, 512, 512);
  // A faint vertical wash: the crown catches the sun, the belly stays grubby.
  const wash = g.createLinearGradient(0, 0, 0, 512);
  wash.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
  wash.addColorStop(0.55, 'rgba(255, 255, 255, 0)');
  wash.addColorStop(1, 'rgba(90, 80, 60, 0.14)');
  g.fillStyle = wash;
  g.fillRect(0, 0, 512, 512);
  // Panel frames: rings around the fuselage (horizontal on the canvas).
  g.strokeStyle = 'rgba(60, 55, 45, 0.28)';
  g.lineWidth = 2;
  for (let y = 42; y < 512; y += 64) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(512, y);
    g.stroke();
  }
  // Longeron seams: lines along the fuselage (vertical on the canvas).
  g.strokeStyle = 'rgba(60, 55, 45, 0.20)';
  for (const x of [64, 192, 320, 448]) {
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x, 512);
    g.stroke();
  }
  // Rivet dots along each frame line.
  g.fillStyle = 'rgba(60, 55, 45, 0.22)';
  for (let y = 42; y < 512; y += 64) {
    for (let x = 8; x < 512; x += 16) {
      g.fillRect(x, y - 4, 2, 2);
    }
  }
  // Registration on both flanks, high on the upper fuselage.
  g.fillStyle = '#3a3630';
  g.font = '900 52px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.save();
  g.translate(0.37 * 512, 0.45 * 512);
  g.rotate(-Math.PI / 2);
  g.fillText('DUSK-1', 0, 0);
  g.restore();
  g.save();
  g.translate(0.63 * 512, 0.45 * 512);
  g.rotate(Math.PI / 2);
  g.fillText('DUSK-1', 0, 0);
  g.restore();
  const tex = new window.THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

export class Aircraft {
  constructor(scene) {
    const THREE = window.THREE;
    this.group = new THREE.Group();
    this.group.rotation.order = 'YXZ';
    scene.add(this.group);
    const white = new THREE.MeshStandardMaterial({ color: 0xf2ead9, roughness: 0.55, metalness: 0.05 });
    const fuselageMat = new THREE.MeshStandardMaterial({ map: makeFuselageTexture(), roughness: 0.55, metalness: 0.05 });
    const yellow = new THREE.MeshStandardMaterial({ color: 0xf5b81e, roughness: 0.5, metalness: 0.1 });
    const orange = new THREE.MeshStandardMaterial({ color: 0xe86a2a, roughness: 0.6, metalness: 0.1 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b2b33, roughness: 0.5, metalness: 0.3 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x9a9a9a, roughness: 0.35, metalness: 0.8 });
    // Cockpit glass: glossy and dark, catching the sunset — high metalness,
    // low roughness, slightly transparent so the cabin reads through.
    const glass = new THREE.MeshStandardMaterial({ color: 0x1a2438, roughness: 0.1, metalness: 0.8, transparent: true, opacity: 0.7 });

    // Fuselage: tapered, nose forward (+Z), skinned with the panel texture.
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.25, 7.5, 14), fuselageMat);
    body.rotation.x = Math.PI / 2;
    this.group.add(body);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 10), white);
    nose.position.set(0, 0, 3.75);
    this.group.add(nose);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(1.25, 1.6, 12), white);
    tail.rotation.x = -Math.PI / 2;
    tail.position.set(0, 0, -4.5);
    this.group.add(tail);
    // Taxi-yellow cheatline along the fuselage.
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.35, 6.8), yellow);
    stripe.position.set(1.18, 0.1, 0.2);
    this.group.add(stripe);
    const stripe2 = stripe.clone();
    stripe2.position.x = -1.18;
    this.group.add(stripe2);
    // Canopy: a glass half-dome on top, ahead of the wing.
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass);
    canopy.scale.set(0.85, 0.8, 1.5);
    canopy.position.set(0, 0.6, 1.4);
    this.group.add(canopy);
    // Cabin windows: three small dark panes per flank, set proud of the
    // curved skin at the local fuselage radius so they read as glass, not
    // paint. (Radius tapers 1.25 at the tail to 0.85 at the nose.)
    for (const side of [-1, 1]) {
      for (const z of [-0.5, -1.5, -2.5]) {
        const r = 1.25 - ((z + 3.75) / 7.5) * 0.4;
        const x = Math.sqrt(Math.max(0.01, r * r - 0.38 * 0.38)) + 0.02;
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.42), glass);
        win.position.set(side * x, 0.38, z);
        this.group.add(win);
      }
    }

    // Roof antenna mast and a pitot tube under the left wing — the small
    // details that sell "working courier" at chase-cam distance.
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.9, 6), metal);
    antenna.position.set(0, 1.45, -0.6);
    this.group.add(antenna);
    const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), orange);
    antennaTip.position.set(0, 1.92, -0.6);
    this.group.add(antennaTip);
    const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.8, 6), metal);
    pitot.rotation.x = Math.PI / 2;
    pitot.position.set(-3.5, 1.05, 1.5);
    this.group.add(pitot);

    // High wing: one broad wing across the top, with struts. A slight
    // dihedral (tips 0.06 rad up) so the wing reads as a real lifting
    // surface, not a flat plank.
    this.wingL = this.makeWing(white, yellow, -1);
    this.wingR = this.makeWing(white, yellow, 1);
    this.wingL.position.y = 1.2;
    this.wingR.position.y = 1.2;
    this.wingL.rotation.z = -0.06;
    this.wingR.rotation.z = 0.06;
    this.group.add(this.wingL);
    this.group.add(this.wingR);
    for (const side of [-1, 1]) {
      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.2, 6), dark);
      strut.position.set(side * 1.6, 0.4, 0.6);
      strut.rotation.z = side * 0.5;
      this.group.add(strut);
    }
    // Cargo pod slung under the belly: the courier's reason to fly.
    const pod = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.1, 3.6), yellow);
    pod.position.set(0, -1.25, 0.4);
    this.group.add(pod);
    // Cargo pod door seams: thin dark outlines on both flanks so the big
    // yellow pod reads as a loading door, not a blank block.
    for (const side of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.72, 2.4), dark);
      door.position.set(side * 1.02, -1.25, 0.4);
      this.group.add(door);
    }

    // Twin engines: a nacelle under each wing half, each with a spinning prop.
    this.props = [];
    for (const side of [-1, 1]) {
      const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 2.6, 10), white);
      nacelle.rotation.x = Math.PI / 2;
      nacelle.position.set(side * 2.9, 0.55, 0.6);
      this.group.add(nacelle);
      // Exhaust stub behind the nacelle: hot gas exits here (the exhaust
      // smoke spawns from this spot at high throttle).
      const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.6, 8), dark);
      exhaust.rotation.x = Math.PI / 2;
      exhaust.position.set(side * 2.9, 0.55, -0.95);
      this.group.add(exhaust);
      const prop = new THREE.Group();
      prop.position.set(side * 2.9, 0.55, 2.1);
      const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.7, 10), metal);
      spinner.rotation.x = Math.PI / 2;
      prop.add(spinner);
      // Three blades, 120 degrees apart — a proper courier turboprop.
      for (const a of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.6, 0.1), dark);
        blade.rotation.z = a;
        blade.translateY(1.15);
        prop.add(blade);
      }
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(2.5, 24),
        new THREE.MeshBasicMaterial({ color: 0x3c2846, transparent: true, opacity: 0.1, side: THREE.DoubleSide }),
      );
      prop.add(disc);
      this.group.add(prop);
      this.props.push(prop);
    }

    // Tail: yellow stabiliser and fin.
    const stab = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.18, 1.3), yellow);
    stab.position.set(0, 0.15, -4.2);
    this.group.add(stab);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.9, 1.6), yellow);
    fin.position.set(0, 1.0, -4.3);
    fin.rotation.x = -0.15;
    this.group.add(fin);

    // Navigation lights: red left, green right, white tail.
    this.navLights = [];
    const light = (colour, x, y, z) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: colour }));
      m.position.set(x, y, z);
      this.group.add(m);
      this.navLights.push(m);
      return m;
    };
    light(0xff2e4d, -5.6, 1.2, 0.4);
    light(0x2eff8a, 5.6, 1.2, 0.4);
    this.tailLight = light(0xffffff, 0, 0.2, -5.2);

    // Landing light: a real SpotLight on the nose, plus its lens.
    this.landingLight = new THREE.SpotLight(0xfff2c8, 0, 320, 0.5, 0.4, 1.2);
    this.landingLight.position.set(0, -0.6, 4.2);
    this.landingLight.target.position.set(0, -14, 60);
    this.group.add(this.landingLight);
    this.group.add(this.landingLight.target);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2c8 }));
    lens.position.set(0, -0.6, 4.2);
    this.group.add(lens);
    this.lens = lens;

    // Fixed landing gear: two legs and wheels.
    this.gear = new THREE.Group();
    for (const side of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.4, 6), dark);
      leg.position.set(side * 1.0, -1.3, 1.2);
      leg.rotation.z = side * 0.25;
      this.gear.add(leg);
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10), dark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * 1.35, -1.95, 1.2);
      this.gear.add(wheel);
    }
    this.group.add(this.gear);
    // No shadow casting from the airframe: with the sun this low, its shadow
    // smeared into a glitchy black blob on the ground. The landing light and
    // the terrain's own shadows carry the grounding instead.
    this.group.traverse((child) => {
      if (child.isMesh) child.castShadow = false;
    });
  }

  /** One wing half: a swept white panel with a yellow tip cap and a small
   * upright winglet at the tip. */
  makeWing(white, yellow, side) {
    const THREE = window.THREE;
    const wing = new THREE.Group();
    const panel = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.22, 2.0), white);
    panel.position.set(side * 2.9, 0, 0.3);
    panel.rotation.y = side * -0.1;
    wing.add(panel);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.24, 1.8), yellow);
    tip.position.set(side * 5.5, 0, 0.15);
    tip.rotation.y = side * -0.1;
    wing.add(tip);
    // Winglet: a small upright fin at the tip, yellow like the cap.
    const winglet = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.85, 1.5), yellow);
    winglet.position.set(side * 5.65, 0.42, 0.1);
    winglet.rotation.y = side * -0.1;
    wing.add(winglet);
    return wing;
  }

  /** Switch the landing light on or off (the foggy rescue needs it). */
  setLandingLight(on) {
    this.landingLight.intensity = on ? 2.5 : 0;
    this.lens.material.color.setHex(on ? 0xfff6d8 : 0x8a8078);
  }

  /** Place and pose the aircraft from the flight state; spin the props. */
  update(plane, dt, time, dusk) {
    this.group.position.set(plane.x, plane.y, plane.z);
    this.group.rotation.y = plane.heading;
    // Attitude is eased toward the flight state (lerp) so the airframe
    // never snaps: heavy, not stiff. Heading stays direct — the nose must
    // always point where the aircraft is actually going.
    if (this.smoothPitch === undefined) {
      this.smoothPitch = plane.pitch;
      this.smoothRoll = plane.roll;
    }
    const k = Math.min(1, dt * 12);
    this.smoothPitch += (plane.pitch - this.smoothPitch) * k;
    this.smoothRoll += (plane.roll - this.smoothRoll) * k;
    this.group.rotation.x = -this.smoothPitch;
    this.group.rotation.z = -this.smoothRoll;
    // Both props spin faster with throttle.
    for (const prop of this.props) {
      prop.rotation.z += (2 + plane.throttle * 26) * dt;
    }
    // A badly hurt airframe bends its right wing (from its 0.06 dihedral).
    this.wingR.rotation.z = plane.damage > 50 ? -0.22 : 0.06;
    this.gear.visible = plane.onGround;
    // Navigation lights glow brighter as the dusk deepens.
    const glow = 1 + dusk * 0.9;
    for (const light of this.navLights) {
      light.scale.setScalar(glow);
    }
    this.tailLight.visible = Math.sin(time * 6) > 0;
  }
}
