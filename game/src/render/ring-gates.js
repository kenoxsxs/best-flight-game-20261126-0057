// The target rings for Dusk Runner: glowing 3D gates the pilot flies through,
// each a torus standing in the air on the course, plus the rescue beacon's
// smoke column and flashing light. One class, one job: the things the pilot
// aims at. The next ring burns gold and pulses; the ones after it wait in dim
// cyan; a ring already flown is gone. The rings are rebuilt when the mission
// changes, and the next ring is highlighted every frame.

/** A small number sprite, drawn on a canvas and floated at a ring's centre. */
function makeNumberSprite(number) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#ffdc82';
  g.font = 'bold 72px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(number), 64, 68);
  const tex = new window.THREE.CanvasTexture(c);
  const mat = new window.THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new window.THREE.Sprite(mat);
  sprite.scale.set(18, 18, 1);
  return sprite;
}

/** A soft smoke puff texture for the beacon column. */
function makeSmokeTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(200, 200, 210, 0.55)');
  grad.addColorStop(1, 'rgba(200, 200, 210, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new window.THREE.CanvasTexture(c);
}

export class RingGates {
  constructor(scene) {
    this.scene = scene;
    this.group = new window.THREE.Group();
    scene.add(this.group);
    this.rings = [];
    this.nextIndex = 0;
    this.beacon = null;
    this.beaconPuffs = [];
    this.smokeTex = makeSmokeTexture();
  }

  /** Build the torus meshes for a mission's rings. */
  build(rings) {
    const THREE = window.THREE;
    // Clear the old gates.
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
    }
    this.rings = [];
    this.nextIndex = 0;
    const zAxis = new THREE.Vector3(0, 0, 1);
    for (const ring of rings) {
      const geo = new THREE.TorusGeometry(ring.radius, 1.3, 12, 36);
      const mat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.75 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(ring.x, ring.y, ring.z);
      const normal = new THREE.Vector3(ring.normal[0], ring.normal[1], ring.normal[2]).normalize();
      mesh.quaternion.setFromUnitVectors(zAxis, normal);
      this.group.add(mesh);
      // A glow shell, bright only for the next ring.
      const glowGeo = new THREE.TorusGeometry(ring.radius + 0.6, 2.6, 10, 36);
      const glowMat = new THREE.MeshBasicMaterial({
        color: 0xff8c28,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.copy(mesh.position);
      glow.quaternion.copy(mesh.quaternion);
      this.group.add(glow);
      // The ring's number, floating at its centre.
      const label = makeNumberSprite(ring.number);
      label.position.set(ring.x, ring.y, ring.z);
      this.group.add(label);
      this.rings.push({ mesh, glow, label, data: ring });
    }
    this.setNext(0);
  }

  /** Highlight ring `index` as the next gate; hide the ones already flown. */
  setNext(index) {
    this.nextIndex = index;
    this.rings.forEach((r, i) => {
      const flown = i < index;
      r.mesh.visible = !flown;
      r.glow.visible = !flown;
      r.label.visible = !flown;
      if (!flown) {
        r.mesh.material.color.setHex(i === index ? 0xffbe3c : 0x00f0ff);
        r.mesh.material.opacity = i === index ? 1 : 0.55;
      }
    });
  }

  /** Pulse the next ring's glow; spin the beacon light. */
  update(time) {
    const next = this.rings[this.nextIndex];
    if (next) {
      const pulse = 0.6 + 0.4 * Math.sin(time * 5);
      next.glow.material.opacity = 0.35 * pulse;
      const s = 1 + 0.04 * Math.sin(time * 5);
      next.glow.scale.set(s, s, s);
    }
    if (this.beacon) {
      const flash = 0.5 + 0.5 * Math.sin(time * 6);
      this.beacon.material.opacity = 0.6 + 0.4 * flash;
      this.beacon.scale.setScalar(1 + 0.3 * flash);
      for (const puff of this.beaconPuffs) {
        puff.position.y += 0.06;
        puff.material.opacity = Math.max(0, puff.material.opacity - 0.0015);
        if (puff.position.y > this.beacon.position.y + 90) {
          puff.position.y = this.beacon.position.y;
          puff.material.opacity = 0.5;
        }
      }
    }
  }

  /** The rescue beacon: a flashing light and a rising smoke column. */
  buildBeacon(beacon) {
    const THREE = window.THREE;
    this.clearBeacon();
    if (!beacon) return;
    const mat = new THREE.MeshBasicMaterial({ color: 0xff783c, transparent: true, opacity: 0.9 });
    this.beacon = new THREE.Mesh(new THREE.SphereGeometry(4, 12, 10), mat);
    this.beacon.position.set(beacon.x, beacon.y, beacon.z);
    this.group.add(this.beacon);
    for (let i = 0; i < 6; i += 1) {
      const puffMat = new THREE.SpriteMaterial({ map: this.smokeTex, transparent: true, opacity: 0.5, depthWrite: false });
      const puff = new THREE.Sprite(puffMat);
      puff.position.set(beacon.x, beacon.y + i * 15, beacon.z);
      puff.scale.set(14 + i * 6, 14 + i * 6, 1);
      this.group.add(puff);
      this.beaconPuffs.push(puff);
    }
  }

  clearBeacon() {
    if (this.beacon) {
      this.group.remove(this.beacon);
      this.beacon = null;
    }
    for (const puff of this.beaconPuffs) {
      this.group.remove(puff);
    }
    this.beaconPuffs = [];
  }
}
