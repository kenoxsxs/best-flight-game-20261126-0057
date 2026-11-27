// The multi-function displays for Dusk Runner: when the pilot presses C, the
// camera moves into the cockpit and this draws the world as seen through the
// windshield — a dark frame, a glareshield, and a dashboard of three real
// screens: TAC RADAR on the left, the ADI (artificial horizon) in the middle,
// and ENG / FUEL / SYS on the right. One class, one job: the inside of the
// aircraft. Every screen is drawn live from the flight state, so the cockpit
// is flown, not painted.

const CYAN = '#00f0ff';
const DIM = '#7de8ff';
const AMBER = '#ffb43c';
const RED = '#ff2e4d';

export class MFDRenderer {
  /** Draw the windshield frame and the three MFD screens over the world. */
  draw(ctx, width, height, plane, mission, terrain) {
    const w = width;
    const h = height;
    this.sunGlare(ctx, w, h);
    this.frame(ctx, w, h);
    const panelTop = h * 0.66;
    const grad = ctx.createLinearGradient(0, panelTop, 0, h);
    grad.addColorStop(0, '#20242a');
    grad.addColorStop(1, '#101215');
    ctx.fillStyle = grad;
    ctx.fillRect(0, panelTop, w, h - panelTop);
    ctx.fillStyle = '#4a5058';
    ctx.fillRect(0, panelTop, w, 3);
    const cy = panelTop + (h - panelTop) / 2 + 6;
    this.adi(ctx, w * 0.2, cy, 64, plane);
    this.tacRadar(ctx, w * 0.5, cy, 62, plane, mission, terrain);
    this.engFuelSys(ctx, w * 0.8, cy, 62, plane);
  }

  /** Sun glare: a faint warm wash in the top corner of the glass, so the
   * cockpit reads as looking into a low sun — subtle, never washing out. */
  sunGlare(ctx, w, h) {
    const grad = ctx.createRadialGradient(w * 0.92, h * 0.02, 10, w * 0.92, h * 0.02, h * 0.55);
    grad.addColorStop(0, 'rgba(255, 240, 210, 0.20)');
    grad.addColorStop(0.5, 'rgba(255, 220, 180, 0.07)');
    grad.addColorStop(1, 'rgba(255, 220, 180, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h * 0.66);
  }

  /** The windshield frame: thin steel-grey pillars, a slim top bar and a
   * narrow centre post — lines, not walls. The view stays open. */
  frame(ctx, w, h) {
    ctx.fillStyle = '#2b2f36';
    // Left pillar: a slim tapered bar.
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w * 0.022, 0);
    ctx.lineTo(w * 0.016, h * 0.55);
    ctx.lineTo(0, h * 0.57);
    ctx.closePath();
    ctx.fill();
    // Right pillar, mirrored.
    ctx.beginPath();
    ctx.moveTo(w, 0);
    ctx.lineTo(w * 0.978, 0);
    ctx.lineTo(w * 0.984, h * 0.55);
    ctx.lineTo(w, h * 0.57);
    ctx.closePath();
    ctx.fill();
    // Slim top bar and a narrow centre post.
    ctx.fillRect(0, 0, w, h * 0.018);
    ctx.fillRect(w / 2 - 2, 0, 4, h * 0.06);
  }

  /** TAC RADAR: a heading-up scope — rings, beacon and strips around the plane. */
  tacRadar(ctx, cx, cy, r, plane, mission, terrain) {
    ctx.save();
    ctx.fillStyle = '#04141c';
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.66, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.33, 0, Math.PI * 2);
    ctx.stroke();
    // Sweep line, rotating slowly.
    const sweep = (performance.now() / 2400) % (Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(sweep) * r, cy + Math.sin(sweep) * r);
    ctx.stroke();
    const range = 1800;
    const plot = (x, z) => {
      const dx = x - plane.x;
      const dz = z - plane.z;
      const ahead = dz * Math.cos(plane.heading) + dx * Math.sin(plane.heading);
      const right = dx * Math.cos(plane.heading) - dz * Math.sin(plane.heading);
      return { x: cx + (right / range) * r, y: cy - (ahead / range) * r };
    };
    // Runway and airstrip as white bars.
    ctx.strokeStyle = '#ffe8c9';
    ctx.lineWidth = 2;
    for (const strip of [terrain.runway, terrain.airstrip]) {
      const a = plot(strip.x, strip.z);
      const s = Math.sin(strip.heading - plane.heading);
      const c = Math.cos(strip.heading - plane.heading);
      ctx.beginPath();
      ctx.moveTo(a.x - s * 8, a.y - c * 8);
      ctx.lineTo(a.x + s * 8, a.y + c * 8);
      ctx.stroke();
    }
    // Rings: gold dots with numbers (next ring brightest).
    const rings = mission.rings ?? [];
    rings.forEach((ring, i) => {
      if (i < plane.nextRing) return;
      const p = plot(ring.x, ring.z);
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d > r - 4) return;
      ctx.fillStyle = i === plane.nextRing ? AMBER : 'rgba(255, 180, 60, 0.55)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, i === plane.nextRing ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffe8c9';
      ctx.font = 'bold 9px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(String(ring.number), p.x + 5, p.y + 3);
    });
    // Rescue beacon: a flashing orange diamond.
    if (mission.beacon) {
      const p = plot(mission.beacon.x, mission.beacon.z);
      if (Math.hypot(p.x - cx, p.y - cy) < r - 4) {
        ctx.fillStyle = '#ff783c';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 5);
        ctx.lineTo(p.x + 5, p.y);
        ctx.lineTo(p.x, p.y + 5);
        ctx.lineTo(p.x - 5, p.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    // The aircraft: a small triangle at the centre, nose up.
    ctx.fillStyle = CYAN;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 8);
    ctx.lineTo(cx + 6, cy + 6);
    ctx.lineTo(cx - 6, cy + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = DIM;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAC RADAR', cx, cy - r - 10);
    ctx.restore();
  }

  /** ADI: the artificial horizon with a pitch ladder and heading readout. */
  adi(ctx, cx, cy, r, plane) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-plane.roll * 0.7);
    const pitchPx = plane.pitch * r * 1.2;
    ctx.fillStyle = '#7a4a9e';
    ctx.fillRect(-r, -r - pitchPx, r * 2, r + pitchPx);
    ctx.fillStyle = '#c96a3d';
    ctx.fillRect(-r, -pitchPx, r * 2, r + pitchPx);
    ctx.strokeStyle = '#ffe8c9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-r, -pitchPx);
    ctx.lineTo(r, -pitchPx);
    ctx.stroke();
    // Pitch ladder rungs.
    ctx.lineWidth = 1;
    for (const deg of [-20, -10, 10, 20]) {
      const yy = -pitchPx - (deg / 20) * r * 0.35;
      ctx.beginPath();
      ctx.moveTo(-r * 0.45, yy);
      ctx.lineTo(r * 0.45, yy);
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = AMBER;
    ctx.fillRect(cx - 18, cy - 2, 12, 4);
    ctx.fillRect(cx + 6, cy - 2, 12, 4);
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    // Heading + speed + altitude readouts under the ball.
    const deg = ((plane.heading * 180) / Math.PI % 360 + 360) % 360;
    ctx.fillStyle = '#ffe8c9';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `HDG ${String(Math.round(deg)).padStart(3, '0')}  ${Math.round(plane.speed * 1.944)} KT  ${Math.round(plane.y * 3.281)} FT`,
      cx,
      cy + r + 16,
    );
    ctx.fillStyle = DIM;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillText('PFD', cx, cy - r - 10);
  }

  /** ENG / FUEL / SYS: throttle, fuel, hull and engine state, all live. */
  engFuelSys(ctx, cx, cy, r, plane) {
    ctx.save();
    ctx.fillStyle = '#04141c';
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 2;
    const w = r * 2;
    const h = r * 2;
    const x = cx - w / 2;
    const y = cy - h / 2;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);
    ctx.textAlign = 'left';
    ctx.font = 'bold 10px system-ui, sans-serif';
    const bar = (label, frac, colour, yy) => {
      ctx.fillStyle = DIM;
      ctx.fillText(label, x + 8, yy - 4);
      ctx.fillStyle = '#0e0a18';
      ctx.fillRect(x + 8, yy, w - 16, 9);
      ctx.fillStyle = colour;
      ctx.fillRect(x + 8, yy, (w - 16) * Math.max(0, Math.min(1, frac)), 9);
    };
    bar('THR', plane.throttle, AMBER, y + 22);
    bar('FUEL', plane.fuel / 100, plane.fuel < 25 ? RED : CYAN, y + 48);
    bar('HULL', 1 - plane.damage / 100, plane.damage > 50 ? RED : '#2eff8a', y + 74);
    ctx.fillStyle = '#ffe8c9';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(`RPM ${Math.round(900 + plane.throttle * 2100)}`, x + 8, y + 102);
    ctx.fillText(`G ${plane.gLoad.toFixed(1)}`, x + 8, y + 118);
    const sys = plane.engineOut
      ? ['ENG OUT', RED]
      : plane.damage > 50
        ? ['DMG — RTB', AMBER]
        : ['SYS NOMINAL', '#2eff8a'];
    ctx.fillStyle = sys[1];
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText(sys[0], x + 8, y + 134);
    ctx.fillStyle = DIM;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ENG / FUEL / SYS', cx, cy - r - 10);
    ctx.restore();
  }
}
