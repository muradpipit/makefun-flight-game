// The aircraft: "Kestrel", a low-poly bush prop-plane built from polygons,
// drawn in chase view just ahead of the camera. Local space: +x right wing,
// +y up, -z nose (the plane flies toward -z when its yaw is 0).

import { rotateEuler, project, dot, norm, mixColor, cssColor } from './vec3.js';

const SUN = norm([-0.45, 0.52, -0.72]);

// Each face: [vertices in local space, base colour]. Vertices are listed
// counter-clockwise seen from outside.
const FUSELAGE = [
  // Nose (a tapered box from z=-4.6 to the cabin).
  [[[-0.55, -0.45, -4.6], [0.55, -0.45, -4.6], [0.55, 0.45, -4.6], [-0.55, 0.45, -4.6]], [214, 58, 48]],
  // Belly, top, left and right of the fuselage.
  [[[-0.7, -0.6, -3.4], [0.7, -0.6, -3.4], [0.7, -0.6, 2.6], [-0.7, -0.6, 2.6]], [176, 44, 38]],
  [[[-0.62, 0.62, -3.4], [0.62, 0.62, -3.4], [0.62, 0.55, 2.6], [-0.62, 0.55, 2.6]], [226, 76, 62]],
  [[[-0.7, -0.6, -3.4], [-0.7, 0.62, -3.4], [-0.62, 0.55, 2.6], [-0.7, -0.6, 2.6]], [196, 50, 42]],
  [[[0.7, -0.6, -3.4], [0.7, 0.62, -3.4], [0.62, 0.55, 2.6], [0.7, -0.6, 2.6]], [196, 50, 42]],
  // Tail cone.
  [[[-0.62, 0.55, 2.6], [0.62, 0.55, 2.6], [0.18, 0.3, 4.6], [-0.18, 0.3, 4.6]], [206, 64, 52]],
  [[[-0.7, -0.6, 2.6], [0.7, -0.6, 2.6], [0.18, -0.1, 4.6], [-0.18, -0.1, 4.6]], [176, 44, 38]],
  // Canopy glass.
  [[[-0.5, 0.62, -1.4], [0.5, 0.62, -1.4], [0.42, 0.98, 0.6], [-0.42, 0.98, 0.6]], [150, 200, 228]],
];

const WINGS = [
  // Main wing (slightly swept, dihedral 4 deg baked into the tips).
  [[[-5.6, 0.28, -0.4], [-0.6, 0.1, -1.1], [-0.6, 0.1, 0.5], [-5.6, 0.28, 1.0]], [240, 236, 222]],
  [[[5.6, 0.28, -0.4], [0.6, 0.1, -1.1], [0.6, 0.1, 0.5], [5.6, 0.28, 1.0]], [240, 236, 222]],
  // Wingtip stripes.
  [[[-5.6, 0.28, -0.4], [-4.9, 0.28, -0.28], [-4.9, 0.28, 0.88], [-5.6, 0.28, 1.0]], [214, 58, 48]],
  [[[5.6, 0.28, -0.4], [4.9, 0.28, -0.28], [4.9, 0.28, 0.88], [5.6, 0.28, 1.0]], [214, 58, 48]],
  // Tailplane.
  [[[-2.1, 0.32, 3.9], [-0.2, 0.28, 3.5], [-0.2, 0.28, 4.4], [-2.1, 0.32, 4.5]], [232, 226, 210]],
  [[[2.1, 0.32, 3.9], [0.2, 0.28, 3.5], [0.2, 0.28, 4.4], [2.1, 0.32, 4.5]], [232, 226, 210]],
  // Fin.
  [[[0, 0.5, 3.6], [0, 0.5, 4.6], [0, 1.7, 4.5]], [214, 58, 48]],
  // Fixed landing gear legs and wheels.
  [[[-0.55, -0.6, -1.6], [-0.55, -1.25, -1.6], [-0.45, -1.25, -1.6], [-0.45, -0.6, -1.6]], [60, 62, 66]],
  [[[0.55, -0.6, -1.6], [0.55, -1.25, -1.6], [0.45, -1.25, -1.6], [0.45, -0.6, -1.6]], [60, 62, 66]],
];

const WHEELS = [
  [-0.5, -1.45, -1.6], [0.5, -1.45, -1.6],
];

/** Face normal from the first three vertices, in local space. */
function faceNormal(verts) {
  const a = [verts[1][0] - verts[0][0], verts[1][1] - verts[0][1], verts[1][2] - verts[0][2]];
  const b = [verts[2][0] - verts[0][0], verts[2][1] - verts[0][1], verts[2][2] - verts[0][2]];
  return norm([
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]);
}

/**
 * Draw the Kestrel at `pos` with attitude (yaw, pitch, roll), as seen from
 * `cam`. Faces are shaded by the sun and sorted far-to-near.
 */
export function drawPlane(ctx, cam, pos, yaw, pitch, roll, propAngle) {
  const faces = [];
  for (const [verts, color] of [...FUSELAGE, ...WINGS]) {
    const world = verts.map((v) => {
      const r = rotateEuler(v, yaw, pitch, roll);
      return [pos[0] + r[0], pos[1] + r[1], pos[2] + r[2]];
    });
    const projected = world.map((w) => project(cam, w));
    if (projected.some((p) => p === null)) continue;
    const depth = projected.reduce((sum, p) => sum + p.depth, 0) / projected.length;
    const localNormal = faceNormal(verts);
    const worldNormal = rotateEuler(localNormal, yaw, pitch, roll);
    const light = 0.62 + 0.38 * Math.max(0, dot(worldNormal, SUN));
    const shaded = [color[0] * light, color[1] * light, color[2] * light];
    faces.push({ projected, color: shaded, depth });
  }

  // Propeller first, so the fuselage (nearer the camera) draws over it: the
  // disc is a faint halo around the nose, never a blob on the fuselage.
  const hubLocal = [0, 0, -4.7];
  const hubRot = rotateEuler(hubLocal, yaw, pitch, roll);
  const hub = [pos[0] + hubRot[0], pos[1] + hubRot[1], pos[2] + hubRot[2]];
  const hubScreen = project(cam, hub);
  let propRadius = 0;
  if (hubScreen) {
    const tipLocal = [0, 1.15, -4.7];
    const tipRot = rotateEuler(tipLocal, yaw, pitch, roll);
    const tip = project(cam, [pos[0] + tipRot[0], pos[1] + tipRot[1], pos[2] + tipRot[2]]);
    if (tip) {
      propRadius = Math.hypot(tip.x - hubScreen.x, tip.y - hubScreen.y);
      ctx.fillStyle = 'rgba(30, 32, 36, 0.10)';
      ctx.beginPath();
      ctx.arc(hubScreen.x, hubScreen.y, propRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  faces.sort((a, b) => b.depth - a.depth);
  for (const face of faces) {
    ctx.fillStyle = cssColor(face.color);
    ctx.beginPath();
    ctx.moveTo(face.projected[0].x, face.projected[0].y);
    for (let i = 1; i < face.projected.length; i += 1) ctx.lineTo(face.projected[i].x, face.projected[i].y);
    ctx.closePath();
    ctx.fill();
  }

  // Propeller blades and spinner, over the nose.
  if (hubScreen && propRadius > 0) {
    ctx.strokeStyle = 'rgba(30, 32, 36, 0.5)';
    ctx.lineWidth = 1.5;
    const a1 = propAngle;
    const a2 = propAngle + Math.PI;
    ctx.beginPath();
    ctx.moveTo(hubScreen.x - Math.cos(a1) * propRadius, hubScreen.y - Math.sin(a1) * propRadius);
    ctx.lineTo(hubScreen.x + Math.cos(a1) * propRadius, hubScreen.y + Math.sin(a1) * propRadius);
    ctx.moveTo(hubScreen.x - Math.cos(a2) * propRadius, hubScreen.y - Math.sin(a2) * propRadius);
    ctx.lineTo(hubScreen.x + Math.cos(a2) * propRadius, hubScreen.y + Math.sin(a2) * propRadius);
    ctx.stroke();
    ctx.fillStyle = '#2c2e32';
    ctx.beginPath();
    ctx.arc(hubScreen.x, hubScreen.y, Math.max(2, propRadius * 0.09), 0, Math.PI * 2);
    ctx.fill();
  }

  // Wheels as dark discs.
  for (const wheel of WHEELS) {
    const wRot = rotateEuler(wheel, yaw, pitch, roll);
    const w = project(cam, [pos[0] + wRot[0], pos[1] + wRot[1], pos[2] + wRot[2]]);
    if (!w) continue;
    ctx.fillStyle = '#22242a';
    ctx.beginPath();
    // A wheel is 0.35 m across: its screen size follows the same projection
    // as the rest of the plane (190 / depth at this focal length).
    ctx.arc(w.x, w.y, Math.max(2, 190 / w.depth), 0, Math.PI * 2);
    ctx.fill();
  }
}
