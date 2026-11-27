// The world outside the aircraft: sky, sun, clouds, the procedural terrain
// mesh, the lake and the runway. Everything is drawn with plain canvas fills,
// projected through the camera from vec3.js.

import { terrainHeight, WORLD, fbm } from './noise.js';
import { project, cssColor, mixColor } from './vec3.js';

const SKY_TOP = [84, 148, 214];
const SKY_HORIZON = [196, 222, 240];
const FOG_COLOR = [186, 210, 228];
const GRASS_LOW = [96, 138, 66];
const GRASS_HIGH = [74, 116, 58];
const ROCK = [122, 106, 92];
const SNOW = [238, 242, 246];
const SAND = [198, 178, 128];
const WATER = [64, 128, 172];
const WATER_DEEP = [38, 92, 138];

// Cloud puffs: fixed positions, so the sky is the same every flight.
const CLOUDS = [];
{
  const spots = [
    [-900, 330, -2600], [-300, 360, -3300], [500, 320, -2100], [1100, 380, -3100],
    [-1500, 340, -1500], [1600, 350, -1400], [-600, 400, -4200], [900, 370, -4300],
    [-1800, 360, -3400], [200, 310, -900], [-1100, 390, -800], [1400, 330, -2600],
    [300, 420, -4800], [-400, 300, -1800],
  ];
  for (const spot of spots) CLOUDS.push({ x: spot[0], y: spot[1], z: spot[2], r: 90 + (Math.abs(spot[0]) % 70) });
}

/** Paint the sky gradient, the sun and the clouds behind the terrain. */
export function drawSky(ctx, cam, width, height) {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, cssColor(SKY_TOP));
  grad.addColorStop(0.55, cssColor(SKY_HORIZON));
  grad.addColorStop(1, cssColor([214, 230, 238]));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // The sun sits north-west and high; a soft glow and a bright disc.
  const sunDir = [-0.45, 0.52, -0.72];
  const sunPos = [
    cam.eye[0] + sunDir[0] * 3000,
    cam.eye[1] + sunDir[1] * 3000,
    cam.eye[2] + sunDir[2] * 3000,
  ];
  const sun = project(cam, sunPos);
  if (sun) {
    const glow = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 130);
    glow.addColorStop(0, 'rgba(255, 244, 200, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 236, 170, 0.45)');
    glow.addColorStop(1, 'rgba(255, 236, 170, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sun.x - 140, sun.y - 140, 280, 280);
    ctx.fillStyle = '#fff7d6';
    ctx.beginPath();
    ctx.arc(sun.x, sun.y, 17, 0, Math.PI * 2);
    ctx.fill();
  }

  // Clouds as soft white blobs, nearer ones bigger on screen.
  for (const cloud of CLOUDS) {
    const p = project(cam, [cloud.x, cloud.y, cloud.z]);
    if (!p || p.depth > 5200) continue;
    const scale = (cam.focal * cloud.r) / p.depth;
    if (scale < 3) continue;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, scale, scale * 0.32, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x - scale * 0.55, p.y + scale * 0.06, scale * 0.6, scale * 0.22, 0, 0, Math.PI * 2);
    ctx.ellipse(p.x + scale * 0.55, p.y + scale * 0.05, scale * 0.62, scale * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Colour of one terrain cell from its height, slope and position. */
function cellColor(h, slope, x, z) {
  let base;
  if (h < WORLD.waterLevel + 1.5) base = SAND;
  else if (h > 95) base = SNOW;
  else if (h > 55 || slope > 0.55) base = ROCK;
  else {
    base = mixColor(GRASS_LOW, GRASS_HIGH, Math.min(1, Math.max(0, h / 55)));
    // Broad patches of forest and dry grass, so the valley reads as land
    // rather than one flat green: the tint varies smoothly across cells.
    const patch = fbm(x / 420 + 3.1, z / 420 + 8.7, 31);
    if (patch > 0.18) base = mixColor(base, [52, 92, 44], Math.min(1, (patch - 0.18) * 2.2));
    else if (patch < -0.22) base = mixColor(base, [168, 152, 92], Math.min(1, (-patch - 0.22) * 2));
  }
  return base;
}

/**
 * Draw the terrain as a grid of filled quads around the camera, far cells
 * first, with distance fog. The grid snaps to its cell size so it never
 * shimmers as the camera moves.
 */
export function drawTerrain(ctx, cam, width, height) {
  const CELL = 60;
  const HALF = 26; // cells each way from the camera: ~3.1 km of ground
  const originX = Math.floor(cam.eye[0] / CELL) * CELL - HALF * CELL;
  const originZ = Math.floor(cam.eye[2] / CELL) * CELL - HALF * CELL;
  const count = HALF * 2 + 1;
  const quads = [];

  for (let gz = 0; gz < count; gz += 1) {
    for (let gx = 0; gx < count; gx += 1) {
      const x0 = originX + gx * CELL;
      const z0 = originZ + gz * CELL;
      const cx = x0 + CELL / 2;
      const cz = z0 + CELL / 2;
      const dx = cx - cam.eye[0];
      const dz = cz - cam.eye[2];
      const dist2 = dx * dx + dz * dz;
      if (dist2 > 3200 * 3200) continue;
      const h00 = terrainHeight(x0, z0);
      const h10 = terrainHeight(x0 + CELL, z0);
      const h11 = terrainHeight(x0 + CELL, z0 + CELL);
      const h01 = terrainHeight(x0, z0 + CELL);
      const depth = dx * cam.fwd[0] + dz * cam.fwd[2];
      if (depth < -CELL) continue;
      const hAvg = (h00 + h10 + h11 + h01) / 4;
      const slope = Math.max(
        Math.abs(h10 - h00), Math.abs(h01 - h00),
        Math.abs(h11 - h10), Math.abs(h11 - h01),
      ) / CELL;
      const water = hAvg < WORLD.waterLevel;
      quads.push({ x0, z0, h00, h10, h11, h01, depth, hAvg, slope, water });
    }
  }

  quads.sort((a, b) => b.depth - a.depth);

  for (const q of quads) {
    const p00 = project(cam, [q.x0, q.h00, q.z0]);
    const p10 = project(cam, [q.x0 + CELL, q.h10, q.z0]);
    const p11 = project(cam, [q.x0 + CELL, q.h11, q.z0 + CELL]);
    const p01 = project(cam, [q.x0, q.h01, q.z0 + CELL]);
    if (!p00 && !p10 && !p11 && !p01) continue;
    // A quad straddling the camera plane is skipped; the grid is dense
    // enough that the gap is never visible.
    if (!p00 || !p10 || !p11 || !p01) continue;
    if (Math.max(p00.x, p10.x, p11.x, p01.x) < -40 || Math.min(p00.x, p10.x, p11.x, p01.x) > width + 40) continue;
    if (Math.max(p00.y, p10.y, p11.y, p01.y) < -40 || Math.min(p00.y, p10.y, p11.y, p01.y) > height + 40) continue;

    let color;
    if (q.water) {
      const deep = Math.min(1, (WORLD.waterLevel - q.hAvg) / 6);
      color = mixColor(WATER, WATER_DEEP, deep);
    } else {
      color = cellColor(q.hAvg, q.slope, q.x0 + CELL / 2, q.z0 + CELL / 2);
    }
    const fog = Math.min(1, Math.max(0, (q.depth - 500) / 2200));
    if (fog > 0) color = mixColor(color, FOG_COLOR, fog * 0.75);
    ctx.fillStyle = cssColor(color);
    // Expand each quad a fraction of a pixel around its centroid so the
    // anti-aliased seams between neighbours never show the sky through.
    const quadCx = (p00.x + p10.x + p11.x + p01.x) / 4;
    const quadCy = (p00.y + p10.y + p11.y + p01.y) / 4;
    const grow = (p) => {
      const dx = p.x - quadCx;
      const dy = p.y - quadCy;
      const len = Math.hypot(dx, dy) || 1;
      return { x: p.x + (dx / len) * 0.7, y: p.y + (dy / len) * 0.7 };
    };
    const g00 = grow(p00);
    const g10 = grow(p10);
    const g11 = grow(p11);
    const g01 = grow(p01);
    ctx.beginPath();
    ctx.moveTo(g00.x, g00.y);
    ctx.lineTo(g10.x, g10.y);
    ctx.lineTo(g11.x, g11.y);
    ctx.lineTo(g01.x, g01.y);
    ctx.closePath();
    ctx.fill();
  }
}

/** Draw the runway: asphalt strip, centreline dashes and threshold bars. */
export function drawRunway(ctx, cam) {
  const r = WORLD.runway;
  const y = 0.6;
  const hw = r.halfWidth;
  const corners = [
    [r.x - hw, y, r.zMin], [r.x + hw, y, r.zMin],
    [r.x + hw, y, r.zMax], [r.x - hw, y, r.zMax],
  ];
  const pts = corners.map((c) => project(cam, c));
  if (pts.some((p) => p === null)) return;
  ctx.fillStyle = '#3c4148';
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < 4; i += 1) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#565d66';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Centreline dashes every 40 m.
  ctx.fillStyle = '#f2f2e8';
  for (let z = r.zMin + 30; z < r.zMax - 20; z += 40) {
    const a = project(cam, [r.x - 1.2, y + 0.1, z]);
    const b = project(cam, [r.x + 1.2, y + 0.1, z]);
    const c = project(cam, [r.x + 1.2, y + 0.1, z + 18]);
    const d = project(cam, [r.x - 1.2, y + 0.1, z + 18]);
    if (!a || !b || !c || !d) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
  }
  // Threshold bars at both ends.
  for (const zEnd of [r.zMin + 8, r.zMax - 22]) {
    for (let k = -3; k <= 3; k += 1) {
      if (k === 0) continue;
      const a = project(cam, [r.x + k * 6 - 2, y + 0.1, zEnd]);
      const b = project(cam, [r.x + k * 6 + 2, y + 0.1, zEnd]);
      const c = project(cam, [r.x + k * 6 + 2, y + 0.1, zEnd + 12]);
      const d = project(cam, [r.x + k * 6 - 2, y + 0.1, zEnd + 12]);
      if (!a || !b || !c || !d) continue;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.fill();
    }
  }
}
