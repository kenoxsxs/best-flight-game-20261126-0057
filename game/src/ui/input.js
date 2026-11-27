// The input for Dusk Runner: keyboard and mouse, one class, one job. The
// keyboard flies the aircraft (arrows or WASD to pitch and bank, Shift and
// Ctrl for the throttle, Space for the airbrake); the mouse steers while its
// button is held, like a stick. One-shot keys (pause, restart, mute, cockpit)
// are consumed once, so the game loop can poll them without double-firing.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDown = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.width = 1280;
    this.height = 720;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown = true;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    window.addEventListener('mouseup', () => {
      this.mouseDown = false;
    });
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
  }

  /** True once for a key pressed since the last poll, then cleared. */
  wasPressed(code) {
    if (this.pressed.has(code)) {
      this.pressed.delete(code);
      return true;
    }
    return false;
  }

  /** Pitch input: -1 (nose down) to 1 (nose up). */
  pitch() {
    let v = 0;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) v += 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) v -= 1;
    if (v === 0 && this.mouseDown) {
      v = -((this.mouseY - this.height / 2) / (this.height / 2)) * 0.9;
    }
    return Math.max(-1, Math.min(1, v));
  }

  /** Roll input: -1 (bank left) to 1 (bank right). */
  roll() {
    let v = 0;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) v += 1;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) v -= 1;
    if (v === 0 && this.mouseDown) {
      v = ((this.mouseX - this.width / 2) / (this.width / 2)) * 0.9;
    }
    return Math.max(-1, Math.min(1, v));
  }

  /** Throttle change per second: Shift up, Ctrl down. */
  throttle() {
    let v = 0;
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) v += 0.5;
    if (this.keys.has('ControlLeft') || this.keys.has('ControlRight')) v -= 0.5;
    return v;
  }

  /** True while the airbrake (Space) is held. */
  brake() {
    return this.keys.has('Space');
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }
}
