// The ring course: eight glowing gates strung through the valley, plus the
// mission logic that turns flying through them into a score.

import { project, wrapAngle } from './vec3.js';

// The course: a loop north through the valley, over the lake, and back to
// the runway. Each ring faces along the course direction.
export const RINGS = [
  { x: -40, y: 70, z: -350, r: 20 },
  { x: -260, y: 95, z: -900, r: 20 },
  { x: 120, y: 120, z: -1500, r: 20 },
  { x: -420, y: 140, z: -2100, r: 22 },
  { x: 300, y: 110, z: -2600, r: 20 },
  { x: 1050, y: 90, z: -2900, r: 22 },
  { x: 700, y: 70, z: -1900, r: 20 },
  { x: 180, y: 55, z: -900, r: 20 },
];

export const RING_POINTS = 100;

/** The course direction at ring i (unit vector toward the next ring). */
export function ringDirection(i) {
  const a = RINGS[i];
  const b = RINGS[(i + 1) % RINGS.length];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz) || 1;
  return [dx / len, dy / len, dz / len];
}

/** A fresh mission state. */
export function newMission() {
  return {
    passed: new Array(RINGS.length).fill(false),
    next: 0,
    score: 0,
    ringsDone: 0,
    landed: false,
    complete: false,
    message: '',
    messageUntil: 0,
  };
}

/** Flash a message on the HUD for a few seconds. */
export function flashMessage(mission, text, now, seconds) {
  mission.message = text;
  mission.messageUntil = now + seconds;
}

/**
 * Check whether the plane crossed the next ring this step. `prev` and `pos`
 * are the plane positions before and after the step. Returns true on a pass.
 */
export function checkRingPass(mission, prev, pos, now) {
  const ring = RINGS[mission.next];
  const dir = ringDirection(mission.next);
  const relPrev = [prev[0] - ring.x, prev[1] - ring.y, prev[2] - ring.z];
  const relNow = [pos[0] - ring.x, pos[1] - ring.y, pos[2] - ring.z];
  const dPrev = relPrev[0] * dir[0] + relPrev[1] * dir[1] + relPrev[2] * dir[2];
  const dNow = relNow[0] * dir[0] + relNow[1] * dir[1] + relNow[2] * dir[2];
  // A gate is a gate: crossing its plane in either direction counts, so a
  // course that doubles back on itself still reads the pass.
  if ((dPrev <= 0 && dNow > 0) || (dPrev >= 0 && dNow < 0)) {
    const radial = Math.hypot(
      relNow[0] - dir[0] * dNow,
      relNow[1] - dir[1] * dNow,
      relNow[2] - dir[2] * dNow,
    );
    if (radial < ring.r - 2) {
      mission.passed[mission.next] = true;
      mission.ringsDone += 1;
      mission.score += RING_POINTS;
      const done = mission.ringsDone === RINGS.length;
      flashMessage(
        mission,
        done ? 'ALL RINGS CLEARED — LAND ON RUNWAY 36!' : `RING ${mission.ringsDone} OF ${RINGS.length} — +${RING_POINTS}`,
        now,
        3,
      );
      mission.next = (mission.next + 1) % RINGS.length;
      return true;
    }
  }
  return false;
}

/** Draw one ring as a glowing circle facing along the course. */
function drawRing(ctx, cam, ring, dir, highlight, time) {
  // A basis in the ring's plane: u across, v up-ish.
  const u = [dir[2], 0, -dir[0]];
  const uLen = Math.hypot(u[0], u[2]) || 1;
  u[0] /= uLen;
  u[2] /= uLen;
  const v = [
    dir[1] * u[2] - dir[2] * u[1],
    dir[2] * u[0] - dir[0] * u[2],
    dir[0] * u[1] - dir[1] * u[0],
  ];
  const pulse = highlight ? 0.75 + 0.25 * Math.sin(time * 4) : 0.55;
  const points = [];
  for (let i = 0; i <= 28; i += 1) {
    const a = (i / 28) * Math.PI * 2;
    const px = ring.x + (Math.cos(a) * u[0] + Math.sin(a) * v[0]) * ring.r;
    const py = ring.y + (Math.cos(a) * u[1] + Math.sin(a) * v[1]) * ring.r;
    const pz = ring.z + (Math.cos(a) * u[2] + Math.sin(a) * v[2]) * ring.r;
    const p = project(cam, [px, py, pz]);
    points.push(p);
  }
  if (points.some((p) => p === null)) return;
  const glowColor = highlight ? `rgba(255, 176, 32, ${pulse})` : 'rgba(120, 200, 255, 0.5)';
  const coreColor = highlight ? '#ffd24a' : '#9fdcff';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
  ctx.strokeStyle = coreColor;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}

/** Draw every ring; the next one glows amber, passed ones fade to green. */
export function drawRings(ctx, cam, mission, time) {
  for (let i = 0; i < RINGS.length; i += 1) {
    const ring = RINGS[i];
    const dx = ring.x - cam.eye[0];
    const dy = ring.y - cam.eye[1];
    const dz = ring.z - cam.eye[2];
    if (dx * dx + dy * dy + dz * dz > 4200 * 4200) continue;
    const dir = ringDirection(i);
    drawRing(ctx, cam, ring, dir, i === mission.next, time);
    if (mission.passed[i]) {
      // A small green tick above a cleared ring.
      const top = project(cam, [ring.x, ring.y + ring.r + 12, ring.z]);
      if (top) {
        ctx.fillStyle = '#7ee787';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('✓', top.x, top.y);
      }
    }
  }
}

/** Heading (radians) from the plane toward the next ring. */
export function headingToNextRing(mission, pos) {
  const ring = RINGS[mission.next];
  return wrapAngle(Math.atan2(-(ring.x - pos[0]), -(ring.z - pos[2])));
}
