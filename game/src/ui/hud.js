// The head-up display for Dusk Runner: dense, neon cyan on dark glass, bold
// type, always readable at a glance — heading tape on top, airspeed and
// altitude tapes on the sides, a bottom data bar (speed, altitude, AGL, V/S,
// throttle, G-load), a mini radar, a mission panel with fuel and hull, and the
// final-approach banner with the PAPI reading. One class, one job: the
// instruments the pilot flies by. Warnings flash; they never whisper.
//
// In cockpit mode only the top elements draw (heading tape, warnings, the
// gunsight and the approach banner) — the MFD screens own the bottom half.

const CYAN = '#00f0ff';
const DIM = '#7de8ff';
const AMBER = '#ffb43c';
const RED = '#ff2e4d';
const GREEN = '#2eff8a';
const PANEL = 'rgba(14, 10, 24, 0.72)';

export class HUD {
  /** Draw every instrument over the world for this frame. */
  draw(ctx, width, height, plane, mission, terrain, mode, time, papiWhite) {
    const w = width;
    const h = height;
    ctx.save();
    ctx.textBaseline = 'middle';
    this.headingTape(ctx, w, plane, mode === 'cockpit' ? 30 : 14);
    this.beaconArrow(ctx, w, plane, mission);
    this.centreMark(ctx, w, h, plane);
    this.warnings(ctx, w, h, plane, time);
    this.finalApproach(ctx, w, h, plane, terrain, papiWhite);
    if (mode === 'cockpit') {
      this.objectiveLine(ctx, plane, mission);
      ctx.restore();
      return;
    }
    this.airspeedTape(ctx, 16, 70, plane);
    this.dataBlock(ctx, 16, 256, plane, terrain);
    this.altitudeTape(ctx, w - 16, 70, plane, terrain);
    // Attitude ball: tucked in with a real margin (was flush to the left
    // edge and read as clipped). Smaller, and clear of both edges.
    this.attitudeBall(ctx, 88, h - 84, 44, plane);
    this.throttleFuel(ctx, w / 2, h - 52, plane);
    this.missionPanel(ctx, w - 16, h - 16, plane, mission);
    this.miniRadar(ctx, w - 76, h - 170, 52, plane, mission, terrain);
    ctx.restore();
  }

  /** Rescue beacon arrow: in the fog the pilot flies by instruments, so a
   * rotating arrow under the heading tape points at the beacon with the
   * distance. Only while the beacon is still unfound. */
  beaconArrow(ctx, w, plane, mission) {
    if (mission.id !== 'rescue' || !mission.beacon) return;
    if (mission.objective(plane) !== 'FIND THE BEACON') return;
    const dx = mission.beacon.x - plane.x;
    const dz = mission.beacon.z - plane.z;
    const dist = Math.round(Math.hypot(dx, dz));
    const bearing = Math.atan2(dx, dz);
    const rel = ((bearing - plane.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    const cx = w / 2;
    const cy = 110;
    const r = 20;
    ctx.fillStyle = PANEL;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff783c';
    ctx.lineWidth = 2;
    ctx.stroke();
    // Arrow pointing toward the beacon (up = straight ahead).
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rel);
    ctx.fillStyle = '#ff783c';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 3);
    ctx.lineTo(-7, 8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffe8c9';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`BEACON ${dist}m`, cx, cy + r + 12);
  }

  /** A compact data block under the airspeed tape: AGL, vertical speed, G. */
  dataBlock(ctx, x, y, plane, terrain) {
    const agl = Math.round(Math.max(0, plane.y - terrain.heightAt(plane.x, plane.z)) * 3.281);
    const vs = Math.round(plane.vspeed * 196.85);
    const rows = [
      ['AGL', `${agl} FT`],
      ['V/S', `${vs >= 0 ? '+' : ''}${vs} FPM`],
      ['G-LOAD', `${plane.gLoad.toFixed(1)}G`],
    ];
    ctx.fillStyle = PANEL;
    ctx.fillRect(x, y, 108, 78);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, 108, 78);
    ctx.textAlign = 'left';
    rows.forEach(([label, value], i) => {
      const yy = y + 16 + i * 24;
      ctx.fillStyle = DIM;
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillText(label, x + 8, yy);
      ctx.fillStyle = label === 'G-LOAD' && plane.gLoad > 2.5 ? AMBER : '#ffe8c9';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(value, x + 100, yy);
      ctx.textAlign = 'left';
    });
  }

  tape(ctx, x, y, width, height, value, step, unit, format) {
    ctx.fillStyle = PANEL;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    const mid = y + height / 2;
    const perPx = height / (step * 6);
    const base = Math.floor(value / step) * step;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.font = 'bold 12px system-ui, sans-serif';
    for (let v = base - step * 3; v <= base + step * 3; v += step) {
      const yy = mid - (v - value) * perPx;
      ctx.strokeStyle = DIM;
      ctx.beginPath();
      ctx.moveTo(x + width - 14, yy);
      ctx.lineTo(x + width, yy);
      ctx.stroke();
      ctx.fillStyle = DIM;
      ctx.textAlign = 'left';
      ctx.fillText(String(v), x + 6, yy);
    }
    ctx.restore();
    ctx.fillStyle = CYAN;
    ctx.fillRect(x - 4, mid - 13, width + 8, 26);
    ctx.fillStyle = '#0e0a18';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(format(value), x + width / 2, mid + 1);
    ctx.fillStyle = DIM;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillText(unit, x + width / 2, y - 10);
  }

  airspeedTape(ctx, x, y, plane) {
    const knots = plane.speed * 1.944;
    this.tape(ctx, x, y, 64, 170, knots, 10, 'KT', (v) => String(Math.round(v)));
  }

  altitudeTape(ctx, x, y, plane, terrain) {
    const feet = plane.y * 3.281;
    this.tape(ctx, x - 64, y, 64, 170, feet, 100, 'FT', (v) => String(Math.round(v)));
    const vs = plane.vspeed * 196.85;
    const agl = Math.max(0, plane.y - terrain.heightAt(plane.x, plane.z)) * 3.281;
    ctx.fillStyle = PANEL;
    ctx.fillRect(x - 64, y + 178, 64, 46);
    ctx.fillStyle = vs < -500 ? RED : DIM;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${vs >= 0 ? '+' : ''}${Math.round(vs)}`, x - 32, y + 192);
    ctx.fillStyle = DIM;
    ctx.fillText(`AGL ${Math.round(agl)}`, x - 32, y + 210);
  }

  headingTape(ctx, w, plane, topY) {
    const deg = ((plane.heading * 180) / Math.PI % 360 + 360) % 360;
    const x = w / 2 - 130;
    const y = topY;
    const width = 260;
    const height = 30;
    ctx.fillStyle = PANEL;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, width, height);
    const mid = x + width / 2;
    const perDeg = width / 60;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let d = Math.floor(deg / 10) * 10 - 30; d <= Math.floor(deg / 10) * 10 + 30; d += 10) {
      const dd = ((d % 360) + 360) % 360;
      const xx = mid + (dd - deg) * perDeg;
      const label = dd === 0 ? 'N' : dd === 90 ? 'E' : dd === 180 ? 'S' : dd === 270 ? 'W' : String(dd);
      ctx.fillStyle = dd % 90 === 0 ? AMBER : DIM;
      ctx.fillText(label, xx, y + height / 2);
    }
    ctx.restore();
    ctx.fillStyle = CYAN;
    ctx.beginPath();
    ctx.moveTo(mid - 6, y);
    ctx.lineTo(mid + 6, y);
    ctx.lineTo(mid, y + 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#0e0a18';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(String(Math.round(deg)).padStart(3, '0'), mid, y + height + 12);
  }

  attitudeBall(ctx, cx, cy, r, plane) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-plane.roll * 0.7);
    const pitchPx = plane.pitch * r * 1.4;
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
    ctx.restore();
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = AMBER;
    ctx.fillRect(cx - 16, cy - 2, 11, 4);
    ctx.fillRect(cx + 5, cy - 2, 11, 4);
  }

  throttleFuel(ctx, cx, bottom, plane) {
    const w = 220;
    const x = cx - w / 2;
    ctx.fillStyle = PANEL;
    ctx.fillRect(x, bottom - 8, w, 12);
    ctx.fillStyle = AMBER;
    ctx.fillRect(x, bottom - 8, w * plane.throttle, 12);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, bottom - 8, w, 12);
    ctx.fillStyle = DIM;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`THR ${Math.round(plane.throttle * 100)}%`, x, bottom - 18);
    ctx.fillStyle = PANEL;
    ctx.fillRect(x, bottom + 10, w, 12);
    ctx.fillStyle = plane.fuel < 25 ? RED : CYAN;
    ctx.fillRect(x, bottom + 10, w * Math.max(0, plane.fuel / 100), 12);
    ctx.strokeStyle = CYAN;
    ctx.strokeRect(x, bottom + 10, w, 12);
    ctx.fillStyle = plane.fuel < 25 ? RED : DIM;
    ctx.fillText(`FUEL ${Math.round(plane.fuel)}%`, x, bottom + 34);
  }

  /** Mission panel: name, objective, score, clock, fuel, hull and daylight. */
  missionPanel(ctx, rightX, bottomY, plane, mission) {
    const w = 250;
    const x = rightX - w;
    const y = bottomY - 138;
    ctx.fillStyle = PANEL;
    ctx.fillRect(x, y, w, 138);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, 138);
    ctx.textAlign = 'left';
    ctx.fillStyle = AMBER;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(mission.name, x + 10, y + 16);
    ctx.fillStyle = DIM;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(mission.objective(plane), x + 10, y + 36);
    ctx.fillStyle = '#ffe8c9';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`SCORE ${plane.score}`, x + 10, y + 56);
    // The clock turns bright red — larger, with a glow — when the light is
    // nearly gone (under 30 seconds). Under 10 seconds it goes critical:
    // bigger still, harder glow. It must read as red at a glance.
    const timeLeft = mission.timeLeft ? mission.timeLeft(plane) : 999;
    const critical = timeLeft < 10;
    const urgent = timeLeft < 30;
    ctx.fillStyle = urgent ? RED : DIM;
    ctx.font = critical
      ? 'bold 16px system-ui, sans-serif'
      : urgent ? 'bold 14px system-ui, sans-serif' : 'bold 11px system-ui, sans-serif';
    if (urgent) {
      ctx.shadowColor = RED;
      ctx.shadowBlur = critical ? 18 : 12;
    }
    ctx.textAlign = 'right';
    ctx.fillText(mission.clock(plane), x + w - 10, y + 56);
    ctx.shadowBlur = 0;
    // Fuel, hull and daylight bars.
    ctx.textAlign = 'left';
    const barW = w - 20;
    const bar = (label, frac, colour, yy) => {
      ctx.fillStyle = DIM;
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillText(label, x + 10, yy + 8);
      ctx.fillStyle = '#0e0a18';
      ctx.fillRect(x + 52, yy, barW - 42, 9);
      ctx.fillStyle = colour;
      ctx.fillRect(x + 52, yy, (barW - 42) * Math.max(0, Math.min(1, frac)), 9);
    };
    bar('FUEL', plane.fuel / 100, plane.fuel < 25 ? RED : CYAN, y + 66);
    bar('HULL', 1 - plane.damage / 100, plane.damage > 50 ? RED : GREEN, y + 84);
    // Daylight left: the effective deadline counts the rings bonus, so the
    // bar drains with the real clock, not the 90 s board.
    const bonus = mission.id === 'rings' ? (plane.ringsHit || 0) * 10 : 0;
    const limit = (mission.timeLimit || 0) + bonus;
    const light = limit ? 1 - plane.time / limit : 1;
    bar('LIGHT', light, light < 0.25 ? RED : '#ffb43c', y + 102);
    ctx.fillStyle = DIM;
    ctx.fillText(mission.sub(plane), x + 10, y + 130);
  }

  /** Round mini radar: rings, beacon and strips around the aircraft. */
  miniRadar(ctx, cx, cy, r, plane, mission, terrain) {
    ctx.save();
    ctx.fillStyle = 'rgba(4, 20, 28, 0.8)';
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const range = 1800;
    const plot = (x, z) => {
      const dx = x - plane.x;
      const dz = z - plane.z;
      const ahead = dz * Math.cos(plane.heading) + dx * Math.sin(plane.heading);
      const right = dx * Math.cos(plane.heading) - dz * Math.sin(plane.heading);
      return { x: cx + (right / range) * r, y: cy - (ahead / range) * r };
    };
    ctx.strokeStyle = '#ffe8c9';
    ctx.lineWidth = 2;
    for (const strip of [terrain.runway, terrain.airstrip]) {
      const a = plot(strip.x, strip.z);
      const s = Math.sin(strip.heading - plane.heading);
      const c = Math.cos(strip.heading - plane.heading);
      ctx.beginPath();
      ctx.moveTo(a.x - s * 7, a.y - c * 7);
      ctx.lineTo(a.x + s * 7, a.y + c * 7);
      ctx.stroke();
    }
    const rings = mission.rings ?? [];
    rings.forEach((ring, i) => {
      if (i < plane.nextRing) return;
      const p = plot(ring.x, ring.z);
      if (Math.hypot(p.x - cx, p.y - cy) > r - 4) return;
      ctx.fillStyle = i === plane.nextRing ? AMBER : 'rgba(255, 180, 60, 0.5)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    if (mission.beacon) {
      const p = plot(mission.beacon.x, mission.beacon.z);
      if (Math.hypot(p.x - cx, p.y - cy) < r - 4) {
        ctx.fillStyle = '#ff783c';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 4);
        ctx.lineTo(p.x + 4, p.y);
        ctx.lineTo(p.x, p.y + 4);
        ctx.lineTo(p.x - 4, p.y);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.fillStyle = CYAN;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 7);
    ctx.lineTo(cx + 5, cy + 5);
    ctx.lineTo(cx - 5, cy + 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  /** Bottom data bar: the numbers a pilot scans, in one line. */
  bottomBar(ctx, w, h, plane, terrain) {
    const y = h - 26;
    ctx.fillStyle = PANEL;
    ctx.fillRect(0, y, w, 26);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
    const knots = Math.round(plane.speed * 1.944);
    const feet = Math.round(plane.y * 3.281);
    const agl = Math.round(Math.max(0, plane.y - terrain.heightAt(plane.x, plane.z)) * 3.281);
    const vs = Math.round(plane.vspeed * 196.85);
    const cells = [
      `AIRSPEED ${knots} KTS`,
      `ALTITUDE ${feet} FT`,
      `AGL ${agl} FT`,
      `V/S ${vs >= 0 ? '+' : ''}${vs} FPM`,
      `THROTTLE ${Math.round(plane.throttle * 100)}%`,
      `G-LOAD ${plane.gLoad.toFixed(1)}G`,
    ];
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const step = w / cells.length;
    cells.forEach((text, i) => {
      ctx.fillStyle = i === 5 && plane.gLoad > 2.5 ? AMBER : DIM;
      ctx.fillText(text, step * (i + 0.5), y + 13);
    });
  }

  centreMark(ctx, w, h, plane) {
    const cx = w / 2;
    const cy = h * 0.52;
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 16, cy);
    ctx.lineTo(cx - 10, cy);
    ctx.moveTo(cx + 10, cy);
    ctx.lineTo(cx + 16, cy);
    ctx.moveTo(cx, cy - 16);
    ctx.lineTo(cx, cy - 10);
    ctx.moveTo(cx, cy + 10);
    ctx.lineTo(cx, cy + 16);
    ctx.stroke();
    const fpx = cx + plane.roll * 26;
    const fpy = cy - plane.pitch * 60;
    ctx.strokeStyle = 'rgba(255, 180, 60, 0.9)';
    ctx.beginPath();
    ctx.arc(fpx, fpy, 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  /** One-line objective at the top-left (cockpit mode). */
  objectiveLine(ctx, plane, mission) {
    // Clear of the left edge (was flush and read as clipped).
    ctx.fillStyle = PANEL;
    ctx.fillRect(28, 56, 300, 30);
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 1;
    ctx.strokeRect(28, 56, 300, 30);
    ctx.fillStyle = AMBER;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(mission.objective(plane), 38, 72);
    ctx.fillStyle = '#ffe8c9';
    ctx.textAlign = 'right';
    ctx.fillText(`SCORE ${plane.score}`, 318, 72);
  }

  /** Final-approach banner with the PAPI lamps drawn as dots, shown on the glide path. */
  finalApproach(ctx, w, h, plane, terrain, papiWhite) {
    if (papiWhite < 0 || plane.onGround) return;
    const slope = papiWhite === 2 ? 'ON THE SLOPE' : papiWhite > 2 ? 'ABOVE THE SLOPE' : 'BELOW THE SLOPE';
    const text = `FINAL RWY 36 — ${slope}`;
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const tw = ctx.measureText(text).width;
    const dotsW = 4 * 16 + 14;
    const x = w / 2 - (tw + dotsW) / 2 - 12;
    const y = h * 0.14;
    ctx.fillStyle = PANEL;
    ctx.fillRect(x, y - 16, tw + dotsW + 24, 32);
    ctx.strokeStyle = papiWhite === 2 ? GREEN : AMBER;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y - 16, tw + dotsW + 24, 32);
    // The four PAPI lamps, white above the slope and red below it.
    for (let i = 0; i < 4; i += 1) {
      ctx.fillStyle = i < papiWhite ? '#fff0c8' : '#ff283c';
      ctx.beginPath();
      ctx.arc(x + 16 + i * 16, y, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = papiWhite === 2 ? GREEN : AMBER;
    ctx.fillText(text, w / 2 + dotsW / 2, y + 1);
  }

  warnings(ctx, w, h, plane, time) {
    const items = [];
    if (plane.stalled) items.push(['STALL', RED]);
    if (plane.overspeed) items.push(['OVERSPEED', RED]);
    if (plane.fuel < 25 && plane.fuel > 0) items.push(['LOW FUEL', AMBER]);
    if (plane.engineOut) items.push(['ENGINE OUT — GLIDE', RED]);
    if (plane.damage > 50) items.push(['AIRFRAME DAMAGE', AMBER]);
    if (items.length === 0) return;
    const blink = Math.sin(time * 8) > -0.2;
    if (!blink) return;
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px system-ui, sans-serif';
    items.forEach(([text, colour], i) => {
      const y = h * 0.24 + i * 30;
      ctx.fillStyle = colour;
      ctx.fillText(text, w / 2, y);
    });
  }
}
