// The screens for Dusk Runner: the title, pause and end overlays that sit
// over the live 3D scene as DOM, so buttons are real buttons and the title can
// be the cover shot. One class, one job: show and hide the screens and fill
// in their numbers. The game itself never stops rendering behind them.

export class ScreenManager {
  constructor() {
    this.titleEl = document.getElementById('title-screen');
    this.pauseEl = document.getElementById('pause-screen');
    this.endEl = document.getElementById('end-screen');
    this.endTitle = document.getElementById('end-title');
    this.endReason = document.getElementById('end-reason');
    this.endScore = document.getElementById('end-score');
    this.state = 'title';
  }

  /** Show only the title screen (the cover: big name, LAUNCH SORTIE). */
  showTitle() {
    this.state = 'title';
    this.titleEl.classList.remove('hidden');
    this.pauseEl.classList.add('hidden');
    this.endEl.classList.add('hidden');
  }

  /** Hide every overlay: the pilot is flying. */
  hideAll() {
    this.state = 'playing';
    this.titleEl.classList.add('hidden');
    this.pauseEl.classList.add('hidden');
    this.endEl.classList.add('hidden');
  }

  /** Show the pause screen. */
  showPause() {
    this.state = 'paused';
    this.pauseEl.classList.remove('hidden');
  }

  /** Show the end screen after a crash or a fuel-out. */
  showGameOver(reason, score) {
    this.state = 'over';
    this.endTitle.textContent = 'SORTIE OVER';
    this.endReason.textContent = reason;
    this.endScore.textContent = `SCORE ${score}`;
    this.endEl.classList.remove('hidden');
  }

  /** Show the end screen after a completed sortie, with the bonus. */
  showComplete(score, bonus) {
    this.state = 'complete';
    this.endTitle.textContent = 'MISSION COMPLETE';
    this.endReason.textContent = `Landing bonus +${bonus} — well flown, pilot.`;
    this.endScore.textContent = `SCORE ${score}`;
    this.endEl.classList.remove('hidden');
  }

  /** Wire the title screen's mission buttons; `cb` gets the mission id. */
  onMissionPick(cb) {
    const buttons = this.titleEl.querySelectorAll('[data-mission]');
    buttons.forEach((b) => {
      b.addEventListener('click', () => {
        buttons.forEach((x) => x.classList.remove('picked'));
        b.classList.add('picked');
        cb(b.getAttribute('data-mission'));
      });
    });
  }

  /** Wire the LAUNCH SORTIE button and the Space key. */
  onLaunch(cb) {
    document.getElementById('launch-btn').addEventListener('click', cb);
  }

  /** Wire the pause screen's resume button. */
  onResume(cb) {
    document.getElementById('resume-btn').addEventListener('click', cb);
  }

  /** Wire every restart button to the same callback. */
  onRestart(cb) {
    document.querySelectorAll('.restart-btn').forEach((b) => b.addEventListener('click', cb));
  }
}
