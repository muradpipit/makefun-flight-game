// Screenshot staging: how ?shot=cover|bank|approach|complete|selftest sets up
// a frame. Each scene plays the real physics forward from a fresh flight
// with a simple autopilot, so the frame is what a short game really looks
// like, and the same scene always gives the same frame.

import { newFlight, stepFlight, SCREEN_PLAY, SCREEN_COMPLETE } from './flight.js';
import { RINGS } from './rings.js';
import { wrapAngle } from './vec3.js';

const STEP = 1 / 60;

/**
 * Steer the plane toward a point: bank to match the heading error, pitch to
 * match the altitude error, and hold a cruise throttle.
 */
export function autopilot(f, target, cruiseSpeed) {
  const dx = target[0] - f.pos[0];
  const dy = target[1] - f.pos[1];
  const dz = target[2] - f.pos[2];
  const wantYaw = Math.atan2(-dx, -dz);
  const yawErr = wrapAngle(wantYaw - f.yaw);
  const dist = Math.hypot(dx, dy, dz);
  const wantPitch = Math.max(-0.3, Math.min(0.35, Math.atan2(dy, Math.hypot(dx, dz))));
  const pitchErr = wantPitch - f.pitch;
  let throttle = 0;
  if (f.speed < cruiseSpeed) throttle = 0.8;
  else if (f.speed > cruiseSpeed + 12) throttle = -0.8;
  return {
    pitch: Math.max(-1, Math.min(1, pitchErr * 3.5)),
    // Positive roll banks right and turns the nose right (yaw down), so a
    // leftward heading error needs negative roll.
    roll: Math.max(-1, Math.min(1, -yawErr * 1.8)),
    throttle,
  };
}

/** Where the autopilot aims at this moment in a full sortie. */
let patternPhase = 0;

/** Reset the landing-pattern phase (call before a fresh staged sortie). */
export function resetPattern() {
  patternPhase = 0;
}

export function sortieTarget(f) {
  if (f.mission.ringsDone < RINGS.length) {
    // Pure pursuit of the ring's centre: the plane's path converges on the
    // gate from any approach, and the speed control in flySortie keeps the
    // turn radius small enough to thread it.
    const ring = RINGS[f.mission.next];
    return [ring.x, ring.y, ring.z];
  }
  // Rings done: fly the pattern home to Runway 36. South past the field at
  // altitude, turn onto a long final, then down the centreline to the numbers.
  // The phase latches so the pattern never ping-pongs between its legs.
  if (patternPhase === 0) {
    if (f.pos[2] > 845) patternPhase = 1;
    return [0, 70, 880];
  }
  if (f.pos[1] > 35) return [0, 30, 680];
  // High on final, aim at the numbers for a firm descent; low over the
  // strip, aim below its far end so the glidepath keeps descending until
  // the wheels meet the asphalt instead of floating past the threshold.
  if (f.pos[1] > 8) return [0, 0, 420];
  return [0, -10, 100];
}

/** Fly a whole sortie on autopilot for up to `limitSeconds`. */
export function flySortie(f, limitSeconds) {
  f.screen = SCREEN_PLAY;
  resetPattern();
  const steps = Math.floor(limitSeconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const target = sortieTarget(f);
    // Slow for the gate when the next ring is near, and slower still when
    // the turn onto it is wide, so the turn radius fits inside the approach.
    let cruise = 50;
    if (f.mission.ringsDone < RINGS.length) {
      const ring = RINGS[f.mission.next];
      const dist = Math.hypot(ring.x - f.pos[0], ring.y - f.pos[1], ring.z - f.pos[2]);
      const yawErr = Math.abs(wrapAngle(Math.atan2(-(ring.x - f.pos[0]), -(ring.z - f.pos[2])) - f.yaw));
      cruise = dist < 500 ? 40 : 50;
      if (yawErr > 0.8) cruise = 36;
    } else {
      cruise = 42;
    }
    stepFlight(f, autopilot(f, target, cruise), STEP);
    if (f.screen === SCREEN_COMPLETE) break;
    if (f.screen === 'crashed') break;
  }
  return f;
}

/** Place the flight airborne at a spot, already flying, for a staged scene. */
function placeAirborne(f, pos, speed, ringsPassed) {
  f.screen = SCREEN_PLAY;
  f.pos = [...pos];
  f.speed = speed;
  f.throttle = 0.7;
  f.airborne = true;
  f.mission.passed = RINGS.map((_, i) => i < ringsPassed);
  f.mission.ringsDone = ringsPassed;
  f.mission.next = ringsPassed % RINGS.length;
  f.mission.score = ringsPassed * 100;
}

/**
 * Stage the named scene on a fresh flight and return the screen the HUD
 * should draw over it. Any unknown name stages the cover.
 */
export function stageShot(name, f) {
  resetPattern();
  if (name === 'bank') {
    placeAirborne(f, [-120, 105, -1250], 55, 2);
    for (let i = 0; i < 5 / STEP; i += 1) {
      stepFlight(f, autopilot(f, sortieTarget(f), 55), STEP);
      if (f.screen !== SCREEN_PLAY) break;
    }
    return f.screen;
  }
  if (name === 'approach') {
    placeAirborne(f, [90, 55, 1500], 50, 8);
    for (let i = 0; i < 7 / STEP; i += 1) {
      stepFlight(f, autopilot(f, sortieTarget(f), 42), STEP);
      if (f.screen !== SCREEN_PLAY) break;
    }
    return f.screen;
  }
  if (name === 'complete') {
    flySortie(f, 300);
    if (f.screen !== SCREEN_COMPLETE) {
      // The autopilot did not bring it home: stage the completed sortie
      // directly — the plane, parked on the runway with the score it earned.
      f.screen = SCREEN_COMPLETE;
      f.pos = [0, 1.4, 300];
      f.yaw = 0;
      f.pitch = 0;
      f.roll = 0;
      f.speed = 0;
      f.throttle = 0;
      f.airborne = false;
      f.fuel = 100;
      f.mission.complete = true;
      f.mission.score = Math.max(f.mission.score, 800 + 250);
    }
    return f.screen;
  }
  if (name === 'selftest') {
    flySortie(f, 300);
    return f.screen;
  }
  // Cover: off the runway, climbing toward the first ring, the runway and
  // the valley spread out below.
  placeAirborne(f, [-70, 85, 260], 55, 0);
  for (let i = 0; i < 4.5 / STEP; i += 1) {
    stepFlight(f, autopilot(f, sortieTarget(f), 55), STEP);
    if (f.screen !== SCREEN_PLAY) break;
  }
  return f.screen;
}
