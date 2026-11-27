// The sound for Dusk Runner: tiny synthesised WebAudio, no audio files. An
// engine hum that follows the throttle, a chime for a gate, a beep for a
// warning and a thud for a touchdown. One class, one job: make noise. Every
// call is guarded, so a browser without audio never breaks the game, and
// nothing starts until the pilot's first click (the browser's rule).

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.muted = false;
  }

  /** Create the audio context on the first user gesture. */
  unlock() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
    } catch (e) {
      this.ctx = null;
    }
  }

  /** The engine hum follows the throttle (0-1). */
  engine(throttle, airborne) {
    if (!this.ctx || !this.engineGain) return;
    const target = this.muted ? 0 : airborne ? 0.03 + throttle * 0.05 : throttle * 0.03;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    this.engineOsc.frequency.setTargetAtTime(55 + throttle * 55, this.ctx.currentTime, 0.1);
  }

  /** A short tone. */
  beep(freq, dur, type, vol) {
    if (!this.ctx || this.muted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol || 0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + dur);
    } catch (e) {
      // Silence is fine.
    }
  }

  /** Two-note chime for a gate. */
  ring() {
    this.beep(880, 0.12, 'sine', 0.14);
    setTimeout(() => this.beep(1318, 0.18, 'sine', 0.12), 90);
  }

  /** A warning beep (stall, low fuel, overspeed). */
  warn() {
    this.beep(440, 0.15, 'square', 0.07);
  }

  /** A low thud for a touchdown. */
  thud() {
    this.beep(70, 0.25, 'sine', 0.2);
  }

  /** Toggle the mute. */
  toggleMute() {
    this.muted = !this.muted;
    if (this.engineGain) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }
}
