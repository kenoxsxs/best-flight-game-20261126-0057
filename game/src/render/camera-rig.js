// The camera rig for Dusk Runner: one THREE.PerspectiveCamera that rides
// behind the aircraft in chase mode and sits in the cockpit in cockpit mode.
// The camera follows smoothly (it lags the aircraft a little, so it never
// snaps) and leans with the bank — most of the roll in the cockpit, a little
// less in chase, so the horizon always reads. One class, one job: where the
// pilot looks from.

export class CameraRig {
  constructor() {
    this.camera = new window.THREE.PerspectiveCamera(70, 1280 / 720, 0.1, 9000);
    this.mode = 'chase';
    // Smoothed camera state (the camera chases the aircraft, never snaps to it).
    this.pos = new window.THREE.Vector3(0, 12, -30);
    this.look = new window.THREE.Vector3(0, 10, 60);
    this.roll = 0;
    // Scratch vectors (preallocated, so the loop never allocates).
    this._fwd = new window.THREE.Vector3();
    this._up = new window.THREE.Vector3();
    this._target = new window.THREE.Vector3();
    this._lookTarget = new window.THREE.Vector3();
  }

  resize(width, height) {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Move the camera toward its target for this frame (dt seconds). */
  update(plane, mode, dt) {
    this.mode = mode;
    const THREE = window.THREE;
    const h = plane.heading;
    const p = plane.pitch;
    const r = plane.roll;
    // The aircraft's forward (nose) direction in world space.
    this._fwd.set(Math.sin(h) * Math.cos(p), Math.sin(p), Math.cos(h) * Math.cos(p));
    let tx;
    let ty;
    let tz;
    let lx;
    let ly;
    let lz;
    let targetRoll;
    if (mode === 'cockpit') {
      // In the cockpit: the eye sits just ahead of the wing, looking out.
      // The look point is dropped 22 m so the view tilts down: the pilot sees
      // ground, runway and the next ring through the glass, not empty sky.
      tx = plane.x + this._fwd.x * 2.5;
      ty = plane.y + 1.4;
      tz = plane.z + this._fwd.z * 2.5;
      lx = plane.x + this._fwd.x * 120;
      ly = plane.y + this._fwd.y * 120 - 22;
      lz = plane.z + this._fwd.z * 120;
      targetRoll = r * 0.85;
    } else {
      // Chase: behind and above the tail, looking over the nose.
      tx = plane.x - this._fwd.x * 26;
      ty = plane.y - this._fwd.y * 26 + 7;
      tz = plane.z - this._fwd.z * 26;
      lx = plane.x + this._fwd.x * 60;
      ly = plane.y + this._fwd.y * 60;
      lz = plane.z + this._fwd.z * 60;
      targetRoll = r * 0.7;
    }
    const k = Math.min(1, dt * 6);
    this.pos.x += (tx - this.pos.x) * k;
    this.pos.y += (ty - this.pos.y) * k;
    this.pos.z += (tz - this.pos.z) * k;
    this.look.x += (lx - this.look.x) * k;
    this.look.y += (ly - this.look.y) * k;
    this.look.z += (lz - this.look.z) * k;
    this.roll += (targetRoll - this.roll) * k;
    // The camera's up is the world up, rolled around the look direction.
    this._up.set(0, 1, 0);
    const lookDir = this._target.copy(this.look).sub(this.pos).normalize();
    this._up.applyAxisAngle(lookDir, -this.roll);
    this.camera.position.copy(this.pos);
    this.camera.up.copy(this._up);
    this.camera.lookAt(this.look);
  }
}
