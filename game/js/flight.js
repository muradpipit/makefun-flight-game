// The flight model and the sortie state: throttle, lift, banked turns,
// stalls, fuel, landings and crashes. An arcade model on purpose: the plane
// answers at every speed, and a landing reads as a landing.

import { terrainHeight, WORLD } from './noise.js';
import { forwardVector, wrapAngle } from './vec3.js';
import { newMission, checkRingPass, flashMessage, RINGS } from './rings.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CRASHED = 'crashed';
export const SCREEN_COMPLETE = 'complete';

const STALL_SPEED = 26; // m/s: below this the wing stops flying
const MAX_SPEED = 95;
const FUEL_DRAIN = 0.28; // percent per second at full throttle
const RING_FUEL_BONUS = 6; // percent of fuel a cleared ring is worth
const LANDING_BONUS = 250;

/** A fresh flight state, sitting on the runway threshold, ready to roll. */
export function newFlight() {
  return {
    screen: SCREEN_TITLE,
    pos: [0, 1.4, 480],
    yaw: 0, // heading north, toward -z
    pitch: 0,
    roll: 0,
    speed: 0,
    throttle: 0,
    fuel: 100,
    damage: 0,
    airborne: false,
    propAngle: 0,
    time: 0,
    mission: newMission(),
    crashReason: '',
    best: 0,
    muted: false,
    events: [], // one-frame event flags read by the audio layer: 'ring', 'crash', 'land', 'warn'
  };
}

/** Put the flight back on the runway for another sortie. */
export function resetFlight(f) {
  const fresh = newFlight();
  fresh.best = f.best;
  fresh.muted = f.muted;
  Object.assign(f, fresh);
}

/** Is the plane over the runway strip (for landing and refuelling)? */
export function overRunway(f) {
  const r = WORLD.runway;
  return (
    Math.abs(f.pos[0] - r.x) < r.halfWidth - 4 &&
    f.pos[2] > r.zMin + 10 &&
    f.pos[2] < r.zMax - 10
  );
}

/**
 * One fixed physics step (dt seconds) from the pilot's inputs.
 * inputs: { pitch: -1..1 (pull up positive), roll: -1..1, throttle: -1..1 }
 */
export function stepFlight(f, inputs, dt) {
  f.time += dt;
  const mission = f.mission;
  if (f.screen !== SCREEN_PLAY) return;

  // Throttle: 0..1, slews toward the pilot's demand.
  const demand = Math.max(0, Math.min(1, f.throttle + inputs.throttle * dt * 0.9));
  f.throttle = demand;
  const ground = terrainHeight(f.pos[0], f.pos[2]);
  const onGround = f.pos[1] <= ground + 1.45;

  // Engine: full throttle accelerates, drag caps the speed.
  const thrust = 26 * f.throttle;
  const drag = 0.0045 * f.speed * f.speed + 1.2;
  f.speed += (thrust - drag) * dt;
  if (f.speed > MAX_SPEED) f.speed = MAX_SPEED;
  if (f.speed < 0) f.speed = 0;

  // Fuel burns with throttle; empty tanks mean no thrust.
  if (f.fuel > 0) {
    f.fuel -= FUEL_DRAIN * (0.25 + f.throttle) * dt;
    if (f.fuel <= 0) {
      f.fuel = 0;
      f.throttle = Math.min(f.throttle, 0.08);
      flashMessage(mission, 'FUEL EMPTY — GLIDE TO THE RUNWAY!', f.time, 3);
    }
  }

  // Roll toward the pilot's bank, then turn with the bank.
  const targetRoll = inputs.roll * 1.05;
  f.roll += (targetRoll - f.roll) * Math.min(1, dt * 3.2);
  const turnRate = -Math.sin(f.roll) * 1.15 * Math.min(1, f.speed / 40);
  f.yaw = wrapAngle(f.yaw + turnRate * dt);

  // Pitch: the stick pulls the nose up; a stall drops it.
  const stalled = f.airborne && f.speed < STALL_SPEED;
  const targetPitch = stalled ? -0.22 : inputs.pitch * 0.42;
  f.pitch += (targetPitch - f.pitch) * Math.min(1, dt * 2.4);
  f.pitch = Math.max(-0.5, Math.min(0.5, f.pitch));

  // Move along the nose.
  const prev = [f.pos[0], f.pos[1], f.pos[2]];
  const fwd = forwardVector(f.yaw, f.pitch);
  const lift = f.airborne ? 1 : 0;
  f.pos[0] += fwd[0] * f.speed * dt;
  f.pos[1] += fwd[1] * f.speed * dt * lift;
  f.pos[2] += fwd[2] * f.speed * dt;

  // Lift-off: enough speed and a pulled stick, or just enough speed.
  // The bump clears the ground-contact check on the very next line, or the
  // plane would touch down again on the same step it left the ground.
  if (!f.airborne && f.speed > 30 && (f.pitch > 0.05 || f.speed > 42)) {
    f.airborne = true;
    f.pos[1] += 1.2;
    flashMessage(mission, 'AIRBORNE — FLY THE RINGS!', f.time, 3);
  }

  // Stay in the world: outside the valley, steer gently back toward its
  // centre instead of spinning — a hard wall would fight the landing
  // pattern, which flies south of the field to turn onto final.
  const outOfBounds = Math.abs(f.pos[0]) > 2400 || f.pos[2] > 1200 || f.pos[2] < -4600;
  if (outOfBounds) {
    const homeYaw = Math.atan2(f.pos[0], f.pos[2]);
    const homeErr = wrapAngle(homeYaw - f.yaw);
    f.yaw = wrapAngle(f.yaw + Math.max(-1, Math.min(1, homeErr * 2)) * 0.6 * dt);
  }
  if (f.pos[1] > 700) f.pitch = Math.min(f.pitch, -0.05);

  f.propAngle += dt * (4 + f.throttle * 46 + f.speed * 0.2);

  // Rings: only while airborne. A cleared ring is worth fuel as well as points.
  if (f.airborne && checkRingPass(mission, prev, f.pos, f.time)) {
    f.fuel = Math.min(100, f.fuel + RING_FUEL_BONUS);
    f.events.push('ring');
  }

  // Ground contact.
  const groundNow = terrainHeight(f.pos[0], f.pos[2]);
  if (f.pos[1] <= groundNow + 1.45) {
    f.pos[1] = groundNow + 1.45;
    const sinkRate = -fwd[1] * f.speed;
    if (f.airborne) {
      if (overRunway(f) && sinkRate < 6 && f.speed < 62) {
        // A landing: roll out, refuel, and finish the sortie if the rings
        // are done.
        f.airborne = false;
        f.pitch = 0;
        f.roll *= 0.5;
        f.fuel = 100;
        f.events.push('land');
        if (mission.ringsDone === RINGS.length && !mission.complete) {
          mission.complete = true;
          mission.score += LANDING_BONUS;
          mission.score += Math.max(0, Math.round(200 - f.time));
          f.screen = SCREEN_COMPLETE;
          f.best = Math.max(f.best, mission.score);
          flashMessage(mission, `SORTIE COMPLETE — +${LANDING_BONUS} LANDING BONUS`, f.time, 5);
        } else {
          flashMessage(mission, 'TOUCHDOWN — REFUELLED, ROLL AGAIN!', f.time, 3);
        }
      } else {
        // Rough ground, water or a hard hit: the sortie ends.
        f.crashReason =
          groundNow < 4 && !overRunway(f)
            ? 'Ditched in the lake'
            : sinkRate >= 6
              ? `Hard impact — ${sinkRate.toFixed(0)} m/s down`
              : 'Clipped the ridge';
        f.screen = SCREEN_CRASHED;
        f.best = Math.max(f.best, mission.score);
        f.events.push('crash');
      }
    }
    // Rolling on the ground: friction slows the plane. Only stop it dead
    // when the pilot is not asking for power, or it could never spool up.
    if (!f.airborne) {
      f.speed = Math.max(0, f.speed - 3.5 * dt);
      if (f.speed < 1 && f.throttle < 0.05) f.speed = 0;
    }
  }

  // Stall warning for the HUD and the audio layer.
  if (stalled && !f.events.includes('stall')) f.events.push('stall');
}
