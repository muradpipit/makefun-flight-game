// Tiny 3D helpers: the camera basis and the perspective projection used by
// every renderer in the game. No library, just vectors and one projection.

/** Normalise a 3-vector. */
export function norm(v) {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/** Cross product of two 3-vectors. */
export function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** Dot product of two 3-vectors. */
export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/**
 * Build a camera from an eye position and a look-at target.
 * Returns { eye, fwd, right, up, focal, cx, cy } ready for project().
 */
export function makeCamera(eye, target, width, height, fovDeg) {
  const fwd = norm([target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]]);
  const right = norm(cross(fwd, [0, 1, 0]));
  const up = cross(right, fwd);
  const focal = (height / 2) / Math.tan((fovDeg * Math.PI) / 360);
  return { eye, fwd, right, up, focal, cx: width / 2, cy: height / 2 };
}

/**
 * Project a world point into screen space.
 * Returns null when the point is behind the camera or too close to it.
 * Otherwise { x, y, depth } with depth in metres along the view direction.
 */
export function project(cam, p) {
  const dx = p[0] - cam.eye[0];
  const dy = p[1] - cam.eye[1];
  const dz = p[2] - cam.eye[2];
  const depth = dx * cam.fwd[0] + dy * cam.fwd[1] + dz * cam.fwd[2];
  if (depth < 2) return null;
  const px = dx * cam.right[0] + dy * cam.right[1] + dz * cam.right[2];
  const py = dx * cam.up[0] + dy * cam.up[1] + dz * cam.up[2];
  return {
    x: cam.cx + (px * cam.focal) / depth,
    y: cam.cy - (py * cam.focal) / depth,
    depth,
  };
}

/** Rotate a point by yaw (about Y), then pitch (about X), then roll (about Z). */
export function rotateEuler(p, yaw, pitch, roll) {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  // Yaw about Y.
  let x = p[0] * cy + p[2] * sy;
  let y = p[1];
  let z = -p[0] * sy + p[2] * cy;
  // Pitch about X.
  let y2 = y * cp - z * sp;
  let z2 = y * sp + z * cp;
  y = y2;
  z = z2;
  // Roll about Z.
  const x2 = x * cr - y * sr;
  const y3 = x * sr + y * cr;
  return [x2, y3, z];
}

/** Unit forward vector for a heading (yaw) and pitch, in world space. */
export function forwardVector(yaw, pitch) {
  return [
    -Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch),
  ];
}

/** Wrap an angle in radians to (-PI, PI]. */
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a <= -Math.PI) a += Math.PI * 2;
  return a;
}

/** Linear interpolation between two RGB colours, each [r, g, b]. */
export function mixColor(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Format an RGB triple as a CSS colour string. */
export function cssColor(c) {
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
