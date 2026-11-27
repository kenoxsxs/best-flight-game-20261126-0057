// The damage smoke for Dusk Runner: a trail of dark puffs streaming from a
// hurt airframe, built from 3D sprites so it lives in the world and drifts
// behind the aircraft. One class, one job: hold, age and draw smoke. More
// damage means thicker smoke; the pilot sees the hurt, not just a number.

function makeSmokeTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(40, 32, 38, 0.55)');
  grad.addColorStop(0.6, 'rgba(40, 32, 38, 0.28)');
  grad.addColorStop(1, 'rgba(40, 32, 38, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new window.THREE.CanvasTexture(c);
}

// Pale warm-grey exhaust: thin, faint, gone in under a second — the engine
// working hard, not a fire.
function makeExhaustTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(205, 195, 188, 0.5)');
  grad.addColorStop(0.6, 'rgba(205, 195, 188, 0.25)');
  grad.addColorStop(1, 'rgba(205, 195, 188, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new window.THREE.CanvasTexture(c);
}

export class SmokeTrail {
  constructor(scene) {
    this.scene = scene;
    this.tex = makeSmokeTexture();
    this.parts = [];
    this.accumulator = 0;
    // A fixed pool of sprites, reused so the loop never allocates.
    this.pool = [];
    for (let i = 0; i < 48; i += 1) {
      const mat = new window.THREE.SpriteMaterial({ map: this.tex, transparent: true, opacity: 0, depthWrite: false });
      const sprite = new window.THREE.Sprite(mat);
      sprite.visible = false;
      scene.add(sprite);
      this.pool.push({ sprite, life: 0, max: 1, size: 4 });
    }
    // A second, smaller pool for engine exhaust: pale puffs at high throttle.
    this.exhaustAccumulator = 0;
    this.exhaustTex = makeExhaustTexture();
    this.exhaustPool = [];
    for (let i = 0; i < 24; i += 1) {
      const mat = new window.THREE.SpriteMaterial({ map: this.exhaustTex, transparent: true, opacity: 0, depthWrite: false });
      const sprite = new window.THREE.Sprite(mat);
      sprite.visible = false;
      scene.add(sprite);
      this.exhaustPool.push({ sprite, life: 0, max: 1, size: 2 });
    }
  }

  /** Emit puffs at the aircraft's tail while it is smoking. */
  emit(plane, dt) {
    if (!plane.smoking) return;
    this.accumulator += dt * (4 + plane.damage * 0.12);
    while (this.accumulator >= 1) {
      this.accumulator -= 1;
      const slot = this.pool.find((p) => !p.sprite.visible);
      if (!slot) return;
      slot.sprite.visible = true;
      slot.sprite.position.set(
        plane.x + (Math.random() - 0.5) * 2,
        plane.y + 0.5,
        plane.z + (Math.random() - 0.5) * 2,
      );
      slot.life = 0;
      slot.max = 1.6 + Math.random() * 0.9;
      slot.size = 4 + Math.random() * 3;
      slot.sprite.material.opacity = 0.5;
      slot.sprite.scale.set(slot.size, slot.size, 1);
    }
  }

  /** Emit thin exhaust puffs behind the engines at high throttle. The puffs
   * spawn at the exhaust stubs (local ±2.9, 0.55, −1.3, rotated by heading)
   * and stay in the world while the aircraft flies on, so they trail behind
   * the engines — the juice that says the throttles are open. */
  exhaust(plane, dt) {
    if (!plane.airborne || plane.crashed || plane.throttle < 0.8) return;
    this.exhaustAccumulator += dt * (6 + plane.throttle * 10);
    while (this.exhaustAccumulator >= 1) {
      this.exhaustAccumulator -= 1;
      const slot = this.exhaustPool.find((p) => !p.sprite.visible);
      if (!slot) return;
      const h = plane.heading;
      const ch = Math.cos(h);
      const sh = Math.sin(h);
      const lx = Math.random() < 0.5 ? -2.9 : 2.9;
      const lz = -1.3;
      slot.sprite.visible = true;
      slot.sprite.position.set(
        plane.x + lx * ch + lz * sh + (Math.random() - 0.5) * 0.4,
        plane.y + 0.55 + (Math.random() - 0.5) * 0.3,
        plane.z - lx * sh + lz * ch + (Math.random() - 0.5) * 0.4,
      );
      slot.life = 0;
      slot.max = 0.7 + Math.random() * 0.5;
      slot.size = 2 + Math.random() * 1.5;
      slot.sprite.material.opacity = 0.22;
      slot.sprite.scale.set(slot.size, slot.size, 1);
    }
  }

  /** Age the puffs; they rise, spread and fade. */
  update(dt) {
    for (const p of this.pool) this.age(p, dt, 0.5);
    for (const p of this.exhaustPool) this.age(p, dt, 0.22);
  }

  age(p, dt, base) {
    if (!p.sprite.visible) return;
    p.life += dt;
    p.sprite.position.y += dt * 3;
    const s = p.size + p.life * 7;
    p.sprite.scale.set(s, s, 1);
    p.sprite.material.opacity = base * (1 - p.life / p.max);
    if (p.life >= p.max) {
      p.sprite.visible = false;
      p.sprite.material.opacity = 0;
    }
  }
}
