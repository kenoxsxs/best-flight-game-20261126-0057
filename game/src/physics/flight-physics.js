// The flight physics for Dusk Runner: a small fixed-wing simulation with real
// trade-offs — throttle buys speed and burns fuel, banking turns the aircraft,
// slow flight stalls, hard arrivals damage the airframe, and damage feeds back
// into how the aircraft handles. One class, one job: move the aircraft.
//
// Axes: x east, z north, y up (metres). Heading 0 is north and grows clockwise.

const G = 9.81;

/** Event bits FlightPhysics.step returns. */
export const EV_NONE = 0;
export const EV_RING = 1;
export const EV_LANDED = 2;
export const EV_CRASHED = 4;
export const EV_FUEL_OUT = 8;
export const EV_STALL = 16;
export const EV_TOUCHDOWN_HARD = 32;
export const EV_OVERSPEED = 64;

export class FlightPhysics {
  constructor(terrain) {
    this.terrain = terrain;
    this.reset(null);
  }

  /** Place the aircraft on the runway threshold, cold and dark, ready to start. */
  reset(mission) {
    const r = this.terrain.runway;
    this.x = r.x;
    this.y = r.elev + 1.2;
    this.z = r.z - r.length / 2 + 40;
    this.heading = r.heading;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.throttle = 0;
    this.fuel = 100;
    this.damage = 0;
    this.vspeed = 0;
    this.onGround = true;
    this.landed = false;
    this.landedOn = null;
    this.hasFlown = false;
    this.crashed = false;
    this.crashReason = '';
    this.stalled = false;
    this.engineOut = false;
    this.overspeed = false;
    this.gLoad = 1;
    this.score = 0;
    this.ringsHit = 0;
    this.time = 0;
    this.airborne = false;
    this.mission = mission;
    // Handling multipliers (1 = normal; the cargo run is heavier and lazier).
    this.handling = mission?.handling ?? { pitch: 1, roll: 1, stall: 30, burn: 1, accel: 1 };
    this.nextRing = 0;
  }

  /** True while the aircraft is smoking (damage high enough to show). */
  get smoking() {
    return this.damage > 25 && !this.crashed;
  }

  /** True while the engine has no fuel to burn. */
  get fuelEmpty() {
    return this.fuel <= 0;
  }

  /** The next ring to fly through, or null when the course is done. */
  currentRing() {
    const rings = this.mission?.rings ?? [];
    return this.nextRing < rings.length ? rings[this.nextRing] : null;
  }

  /** Advance the simulation by dt seconds under `input`. Returns event bits. */
  step(dt, input) {
    if (this.crashed || this.landed) return EV_NONE;
    let events = EV_NONE;
    this.time += dt;
    const t = this.terrain;
    const groundH = t.heightAt(this.x, this.z);

    // Throttle: Shift up, Ctrl down; engine out forces it to zero.
    if (this.fuelEmpty) {
      this.throttle = 0;
      if (!this.engineOut) {
        this.engineOut = true;
        events |= EV_FUEL_OUT;
      }
    } else {
      this.throttle = Math.min(1, Math.max(0, this.throttle + (input.throttle ?? 0) * dt));
    }

    // Fuel burn: throttle is the cost of speed. Cargo burns more.
    const burn = (0.03 + this.throttle * 0.3) * this.handling.burn;
    this.fuel = Math.max(0, this.fuel - burn * dt);

    // Damage makes the airframe lazier and draggier.
    const wear = 1 - this.damage * 0.004;
    const pitchRate = (input.pitch ?? 0) * 0.55 * this.handling.pitch * wear;
    const rollRate = (input.roll ?? 0) * 1.5 * this.handling.roll * wear;
    this.pitch = Math.min(0.6, Math.max(-0.5, this.pitch + pitchRate * dt));
    this.roll = Math.min(1.1, Math.max(-1.1, this.roll + rollRate * dt));
    // No roll input: the wings level themselves, slowly.
    if ((input.roll ?? 0) === 0) this.roll *= Math.max(0, 1 - 0.5 * dt);

    // Stall: below the wing's flying speed the nose drops and the aircraft sinks.
    const stallSpeed = this.handling.stall;
    this.stalled = this.speed < stallSpeed && this.y > groundH + 2 && !this.onGround;
    if (this.stalled) {
      this.pitch = Math.max(this.pitch - 0.5 * dt, -0.35);
      events |= EV_STALL;
    }

    // Speed: thrust minus drag minus the climb's share of gravity.
    const drag = 0.004 + (input.brake ? 0.02 : 0) + this.damage * 0.00004;
    const accel = this.throttle * 26 * this.handling.accel - drag * this.speed * this.speed - G * Math.sin(this.pitch);
    this.speed = Math.min(115, Math.max(0, this.speed + accel * dt));

    // Overspeed: past the red line the airframe takes damage.
    this.overspeed = this.speed > 105;
    if (this.overspeed) {
      this.damage = Math.min(100, this.damage + (this.speed - 105) * 0.9 * dt);
      events |= EV_OVERSPEED;
    }

    // Coordinated turn: the bank rolls the nose around, plus a direct roll
    // coupling so the aircraft answers at every speed (arcade, not a sim).
    const turnRate = (G * Math.tan(this.roll)) / Math.max(this.speed, 25) + this.roll * 0.8;
    this.heading += turnRate * dt;

    // G-load: in a level bank the wing carries 1/cos(bank); on the ground it is 1.
    this.gLoad = this.onGround
      ? 1
      : Math.min(4, Math.max(0.2, Math.cos(this.pitch) / Math.max(0.3, Math.cos(this.roll))));

    // Move.
    const climb = this.speed * Math.sin(this.pitch) - (this.stalled ? 6 : 0);
    this.vspeed = climb;
    this.y += climb * dt;
    const forward = this.speed * Math.cos(this.pitch);
    this.x += forward * Math.sin(this.heading) * dt;
    this.z += forward * Math.cos(this.heading) * dt;

    // Ground contact.
    const gh = t.heightAt(this.x, this.z);
    if (this.y <= gh + 1.2) {
      this.y = gh + 1.2;
      const onRunway = t.isOnRunway(this.x, this.z);
      const onStrip = t.isOnStrip(this.x, this.z);
      const gentle = this.vspeed > -5 && Math.abs(this.roll) < 0.35 && this.speed < 58;
      if ((onRunway || onStrip) && gentle) {
        // A landing: roll out, bleed speed, stop.
        if (!this.onGround) {
          this.onGround = true;
          this.airborne = false;
          if (this.vspeed < -3.5) {
            this.damage = Math.min(100, this.damage + (-this.vspeed - 3.5) * 6);
            events |= EV_TOUCHDOWN_HARD;
          }
        }
        // Rolling on a strip: the wheels roll, the engine still pushes, and
        // the brake and the air drag bleed the speed away.
        this.speed = Math.max(0, this.speed - (3 + (input.brake ? 30 : 0)) * dt);
        this.pitch = 0;
        this.roll *= Math.max(0, 1 - 2 * dt);
        if (this.speed < 0.5 && this.airborne !== false) {
          // Fully stopped on a strip: a landing.
        }
        if (this.speed < 2 && !this.landed && this.hasFlown) {
          this.landed = true;
          this.landedOn = onRunway ? 'runway' : 'strip';
          events |= EV_LANDED;
        }
      } else if (this.y <= gh + 1.2 && !this.onGround) {
        // Terrain, water or a runway arrival too fast/hard: a crash.
        this.crashed = true;
        this.crashReason = onRunway || onStrip ? 'Hard arrival on the strip' : 'Terrain impact';
        return events | EV_CRASHED;
      }
      if (this.onGround) {
        // Rolling: keep the nose on the centreline, steer with the rudder (roll keys).
        this.heading += (input.roll ?? 0) * 0.1 * dt * Math.min(1, this.speed / 20);
      }
    } else {
      this.onGround = false;
      if (!this.airborne && this.speed > 30) this.airborne = true;
    }

    // Take-off: fast enough and pulling up lifts the wheels.
    if (this.onGround && this.speed > 38 && this.pitch > 0.06) {
      this.onGround = false;
      this.airborne = true;
    }
    if (this.airborne) this.hasFlown = true;

    // Rings: crossing a ring's plane inside its radius scores it.
    const ring = this.currentRing();
    if (ring && !this.onGround) {
      const dx = this.x - ring.x;
      const dy = this.y - ring.y;
      const dz = this.z - ring.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < ring.radius) {
        this.nextRing += 1;
        this.ringsHit += 1;
        this.score += ring.points;
        this.fuel = Math.min(100, this.fuel + 6);
        events |= EV_RING;
      }
    }

    // Damage at 100 is a break-up.
    if (this.damage >= 100 && !this.crashed) {
      this.crashed = true;
      this.crashReason = 'Airframe break-up';
      return events | EV_CRASHED;
    }
    return events;
  }
}
