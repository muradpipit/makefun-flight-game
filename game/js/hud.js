// The cockpit glass: HUD instruments, the compass, the mission panel and the
// title, pause, crash and complete screens. Everything is drawn on the same
// canvas as the world, so a screenshot always shows the instruments lit.

import { SCREEN_TITLE, SCREEN_PAUSED, SCREEN_CRASHED, SCREEN_COMPLETE, overRunway } from './flight.js';
import { RINGS } from './rings.js';
import { wrapAngle } from './vec3.js';

const PANEL = 'rgba(10, 18, 28, 0.62)';
const PANEL_EDGE = 'rgba(140, 200, 240, 0.35)';
const TEXT = '#e8f2f8';
const AMBER = '#ffd24a';
const GREEN = '#7ee787';
const RED = '#ff6b5e';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = PANEL;
  ctx.strokeStyle = PANEL_EDGE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();
}

function headingText(yaw) {
  const deg = Math.round(((yaw * 180) / Math.PI) % 360 + 360) % 360;
  return String(deg).padStart(3, '0');
}

/** The compass tape across the top of the screen. */
function drawCompass(ctx, f, width) {
  const deg = (((f.yaw * 180) / Math.PI) % 360 + 360) % 360;
  const cx = width / 2;
  panel(ctx, cx - 190, 12, 380, 46);
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - 186, 14, 372, 42);
  ctx.clip();
  ctx.fillStyle = TEXT;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const pxPerDeg = 3;
  for (let d = Math.floor(deg / 10) * 10 - 60; d <= deg + 60; d += 10) {
    const norm = ((d % 360) + 360) % 360;
    const x = cx + (d - deg) * pxPerDeg;
    const label =
      norm === 0 ? 'N' : norm === 90 ? 'E' : norm === 180 ? 'S' : norm === 270 ? 'W'
        : norm % 30 === 0 ? String(norm / 10) : '';
    ctx.fillText(label, x, 30);
    ctx.fillRect(x - 0.5, 44, 1, norm % 30 === 0 ? 10 : 6);
  }
  ctx.restore();
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(cx, 14);
  ctx.lineTo(cx - 6, 6);
  ctx.lineTo(cx + 6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = AMBER;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(headingText(f.yaw) + '°', cx, 72);
}

/** Artificial horizon + altitude, bottom left. */
function drawAttitude(ctx, f, x, y, r) {
  panel(ctx, x - r - 14, y - r - 34, r * 2 + 28, r * 2 + 52);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate(-f.roll);
  const pitchPx = f.pitch * r * 1.6;
  ctx.fillStyle = '#3f7ec2';
  ctx.fillRect(-r - 2, -r - 2 - pitchPx, r * 2 + 4, r + 2 + pitchPx);
  ctx.fillStyle = '#8a6b46';
  ctx.fillRect(-r - 2, pitchPx, r * 2 + 4, r + 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r, pitchPx);
  ctx.lineTo(r, pitchPx);
  ctx.stroke();
  for (const dy of [-28, 28]) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, pitchPx + dy);
    ctx.lineTo(r * 0.45, pitchPx + dy);
    ctx.stroke();
  }
  ctx.restore();
  // Fixed wings of the symbol.
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.55, y);
  ctx.lineTo(x - r * 0.12, y);
  ctx.moveTo(x + r * 0.12, y);
  ctx.lineTo(x + r * 0.55, y);
  ctx.stroke();
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.fill();
  // Altitude and vertical speed under the ball.
  const altFt = Math.round((f.pos[1] - 1.4) * 3.28084);
  const vs = Math.round(Math.sin(f.pitch) * f.speed * 196.85);
  ctx.fillStyle = TEXT;
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`ALT ${altFt.toLocaleString('en-US')} FT`, x, y + r + 16);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#b8d2e2';
  ctx.fillText(`V/S ${vs >= 0 ? '+' : ''}${vs} FPM`, x, y + r + 34);
}

/** Speed, throttle and fuel, bottom right. */
function drawEngine(ctx, f, x, y) {
  const w = 210;
  panel(ctx, x, y, w, 118);
  const knots = Math.round(f.speed * 1.94384);
  ctx.fillStyle = TEXT;
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${knots}`, x + 14, y + 34);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#b8d2e2';
  ctx.fillText('KNOTS', x + 74, y + 32);
  // Throttle bar.
  ctx.fillStyle = '#b8d2e2';
  ctx.fillText('THR', x + 14, y + 58);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x + 52, y + 48, 144, 10);
  ctx.fillStyle = f.throttle > 0.85 ? AMBER : GREEN;
  ctx.fillRect(x + 52, y + 48, 144 * f.throttle, 10);
  // Fuel bar.
  ctx.fillStyle = '#b8d2e2';
  ctx.fillText('FUEL', x + 14, y + 82);
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.fillRect(x + 52, y + 72, 144, 10);
  ctx.fillStyle = f.fuel < 25 ? RED : '#4fc3f7';
  ctx.fillRect(x + 52, y + 72, 144 * (f.fuel / 100), 10);
  ctx.fillStyle = f.fuel < 25 ? RED : TEXT;
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(`${Math.round(f.fuel)}%`, x + 52, y + 102);
  if (f.fuel < 25) {
    ctx.fillStyle = RED;
    ctx.fillText('LOW FUEL', x + 110, y + 102);
  }
}

/** Score, mission and rings, top left. */
function drawMission(ctx, f) {
  panel(ctx, 12, 12, 250, 96);
  ctx.fillStyle = TEXT;
  ctx.textAlign = 'left';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`SCORE ${f.mission.score}`, 26, 38);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = '#b8d2e2';
  const missionText = f.mission.complete
    ? 'SORTIE COMPLETE'
    : f.mission.ringsDone === RINGS.length
      ? 'MISSION 2 — LAND ON RUNWAY 36'
      : `MISSION 1 — RING RUN ${f.mission.ringsDone}/${RINGS.length}`;
  ctx.fillText(missionText, 26, 60);
  // Ring pips.
  for (let i = 0; i < RINGS.length; i += 1) {
    ctx.fillStyle = f.mission.passed[i] ? GREEN : i === f.mission.next ? AMBER : 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(30 + i * 26, 84, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  // Timer, top right of the panel, clear of the ring pips.
  ctx.fillStyle = TEXT;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'right';
  const mins = Math.floor(f.time / 60);
  const secs = Math.floor(f.time % 60);
  ctx.fillText(`${mins}:${String(secs).padStart(2, '0')}`, 248, 38);
  ctx.textAlign = 'left';
}

/** Centre reticle and the arrow toward the next ring. */
function drawReticle(ctx, f, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  ctx.strokeStyle = 'rgba(232, 242, 248, 0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy);
  ctx.lineTo(cx - 10, cy);
  ctx.moveTo(cx + 10, cy);
  ctx.lineTo(cx + 22, cy);
  ctx.moveTo(cx, cy - 22);
  ctx.lineTo(cx, cy - 10);
  ctx.moveTo(cx, cy + 10);
  ctx.lineTo(cx, cy + 22);
  ctx.stroke();

  // Edge arrow to the next ring (or the runway once the rings are done).
  let target;
  if (f.mission.ringsDone < RINGS.length) {
    const ring = RINGS[f.mission.next];
    target = [ring.x, ring.y, ring.z];
  } else {
    target = [0, 2, 250];
  }
  const dx = target[0] - f.pos[0];
  const dy = target[1] - f.pos[1];
  const dz = target[2] - f.pos[2];
  const dist = Math.hypot(dx, dy, dz);
  const headingTo = Math.atan2(-dx, -dz);
  const rel = wrapAngle(headingTo - f.yaw);
  const arrowX = cx + Math.sin(rel) * 190;
  const arrowY = cy - Math.sin(Math.atan2(dy, Math.hypot(dx, dz)) - f.pitch) * 120;
  const clampedX = Math.max(40, Math.min(width - 40, arrowX));
  const clampedY = Math.max(90, Math.min(height - 90, arrowY));
  ctx.save();
  ctx.translate(clampedX, clampedY);
  ctx.rotate(Math.atan2(arrowY - cy, arrowX - cx));
  ctx.fillStyle = f.mission.ringsDone < RINGS.length ? AMBER : GREEN;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-8, -9);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-8, 9);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#e8f2f8';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${Math.round(dist)} m`, clampedX, clampedY + 26);
}

/** Warnings: stall, low fuel, pull up, and the flashing mission message. */
function drawWarnings(ctx, f, width) {
  const cx = width / 2;
  ctx.textAlign = 'center';
  let y = 84;
  if (f.airborne && f.speed < 26) {
    ctx.fillStyle = RED;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('⚠ STALL — NOSE DOWN, ADD POWER', cx, y);
    y += 30;
  }
  if (f.fuel < 25 && f.fuel > 0) {
    ctx.fillStyle = RED;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('LOW FUEL — LAND ON RUNWAY 36 TO REFUEL', cx, y);
    y += 26;
  }
  const groundClearance = f.pos[1] - 1.4;
  if (f.airborne && groundClearance < 25 && Math.sin(f.pitch) * f.speed < -4) {
    ctx.fillStyle = AMBER;
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('PULL UP', cx, y);
    y += 26;
  }
  if (f.mission.message && f.time < f.mission.messageUntil) {
    ctx.fillStyle = '#e8f2f8';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(f.mission.message, cx, y + 8);
  }
}

/** The full HUD over a live flight. */
export function drawHud(ctx, f, width, height) {
  drawCompass(ctx, f, width);
  drawMission(ctx, f);
  drawAttitude(ctx, f, 96, height - 118, 52);
  drawEngine(ctx, f, width - 224, height - 132);
  drawReticle(ctx, f, width, height);
  drawWarnings(ctx, f, width);
  // Controls hint, fading out after the first 20 seconds of flight.
  if (f.time < 20 && f.screen === 'play') {
    ctx.fillStyle = 'rgba(232, 242, 248, 0.75)';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      '↑ ↓ pitch   ← → bank   W / S throttle   mouse steers   P pause   R restart',
      width / 2,
      height - 16,
    );
  }
  if (overRunway(f) && !f.airborne && f.mission.ringsDone < RINGS.length) {
    ctx.fillStyle = GREEN;
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ON RUNWAY 36 — FULL THROTTLE (W) TO TAKE OFF', width / 2, height - 40);
  }
}

function overlay(ctx, width, height, title, lines, accent) {
  ctx.fillStyle = 'rgba(6, 12, 20, 0.48)';
  ctx.fillRect(0, 0, width, height);
  const cx = width / 2;
  const cy = height / 2 - 40;
  ctx.fillStyle = accent;
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, cx, cy - 40);
  ctx.fillStyle = TEXT;
  ctx.font = '16px sans-serif';
  lines.forEach((line, i) => ctx.fillText(line, cx, cy + 8 + i * 26));
}

/** Title screen. */
export function drawTitle(ctx, f, width, height) {
  overlay(ctx, width, height, 'SKYLINE RIDGE', [
    'A bush-plane sortie over the canyon valley: fly all eight rings,',
    'then bring the Kestrel home to Runway 36. Fuel is short — land to refuel.',
    '',
    '↑ ↓ pitch      ← → bank and turn      W / S throttle      mouse steers',
    'P pause      R restart      M sound',
    '',
    'Press ENTER or click to fly.',
  ], AMBER);
}

/** Pause screen. */
export function drawPaused(ctx, width, height) {
  overlay(ctx, width, height, 'PAUSED', ['Press P to keep flying.', ''], TEXT);
}

/** Crash screen. */
export function drawCrashed(ctx, f, width, height) {
  overlay(ctx, width, height, 'CRASHED', [
    f.crashReason,
    `Score ${f.mission.score}  ·  Rings ${f.mission.ringsDone}/${RINGS.length}  ·  Best ${f.best}`,
    '',
    'Press R to fly again.',
  ], RED);
}

/** Mission-complete screen. */
export function drawComplete(ctx, f, width, height) {
  overlay(ctx, width, height, 'SORTIE COMPLETE', [
    'All eight rings, and the Kestrel is home on Runway 36.',
    `Score ${f.mission.score}  ·  Time ${Math.floor(f.time / 60)}:${String(Math.floor(f.time % 60)).padStart(2, '0')}  ·  Best ${f.best}`,
    '',
    'Press R to fly another sortie.',
  ], GREEN);
}

/** Draw the screen overlay for the flight's current screen. */
export function drawScreen(ctx, f, width, height) {
  if (f.screen === SCREEN_TITLE) drawTitle(ctx, f, width, height);
  else if (f.screen === SCREEN_PAUSED) drawPaused(ctx, width, height);
  else if (f.screen === SCREEN_CRASHED) drawCrashed(ctx, f, width, height);
  else if (f.screen === SCREEN_COMPLETE) drawComplete(ctx, f, width, height);
}
