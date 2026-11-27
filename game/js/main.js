// Skyline Ridge: the bootstrap, the chase camera and the game loop.
// The game is static files only: no network, no library, no build step.

import { newFlight, stepFlight, resetFlight, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_CRASHED, SCREEN_COMPLETE } from './flight.js';
import { drawSky, drawTerrain, drawRunway } from './terrain.js';
import { drawPlane } from './plane.js';
import { drawRings } from './rings.js';
import { drawHud, drawScreen } from './hud.js';
import { createAudio } from './audio.js';
import { createInput, attachInput, wasPressed, clearPressed, readFlightInput } from './input.js';
import { stageShot } from './shots.js';
import { makeCamera, forwardVector } from './vec3.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const flight = newFlight();
const input = createInput();
const audio = createAudio();

let width = 0;
let height = 0;
let camEye = null;

/** Resize the canvas to the window, capping the pixel ratio. */
function resize() {
  const dpr = Math.min(1.5, window.devicePixelRatio || 1);
  width = Math.floor(window.innerWidth);
  height = Math.floor(window.innerHeight);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

/** The chase camera: behind and above the Kestrel, looking past it. */
function computeCamera() {
  const fwd = forwardVector(flight.yaw, flight.pitch);
  // Parked on the ground, pull back and up: the plane, the strip and the
  // valley all fit in the frame behind the title and complete screens.
  const parked = !flight.airborne && flight.speed < 2;
  const dist = parked ? 20 : 16;
  const camHeight = parked ? 9 : 5;
  const targetEye = [
    flight.pos[0] - fwd[0] * dist,
    flight.pos[1] - fwd[1] * dist + camHeight,
    flight.pos[2] - fwd[2] * dist,
  ];
  if (camEye === null) camEye = targetEye;
  const k = shotName ? 1 : 0.3;
  camEye = [
    camEye[0] + (targetEye[0] - camEye[0]) * k,
    camEye[1] + (targetEye[1] - camEye[1]) * k,
    camEye[2] + (targetEye[2] - camEye[2]) * k,
  ];
  const target = [
    flight.pos[0] + fwd[0] * 30,
    flight.pos[1] + fwd[1] * 30 + 1,
    flight.pos[2] + fwd[2] * 30,
  ];
  const cam = makeCamera(camEye, target, width, height, 68);
  return cam;
}

/** Draw one frame: sky, terrain, runway, rings, the Kestrel, then the HUD. */
function render() {
  const cam = computeCamera();
  drawSky(ctx, cam, width, height);
  drawTerrain(ctx, cam, width, height);
  drawRunway(ctx, cam);
  drawRings(ctx, cam, flight.mission, flight.time);
  drawPlane(ctx, cam, flight.pos, flight.yaw, flight.pitch, flight.roll, flight.propAngle);
  if (flight.screen === SCREEN_PLAY || flight.screen === SCREEN_PAUSED) {
    drawHud(ctx, flight, width, height);
  }
  drawScreen(ctx, flight, width, height);
}

/** Report the flight for the status line (and for --dump-dom checks). */
function reportStatus() {
  const state = {
    screen: flight.screen,
    score: flight.mission.score,
    rings: flight.mission.ringsDone,
    speed: Math.round(flight.speed),
    altitude: Math.round(flight.pos[1]),
    fuel: Math.round(flight.fuel),
    time: Math.round(flight.time),
  };
  statusEl.textContent = JSON.stringify(state);
  document.title = `Skyline Ridge — ${flight.screen} — score ${state.score}`;
}

/** One fixed physics step from the pilot's inputs. */
function step(dt) {
  const inputs = readFlightInput(input);
  stepFlight(flight, inputs, dt);
  for (const event of flight.events) audio.playEvent(event);
  flight.events.length = 0;
  audio.update(flight);
}

/** Handle the one-shot keys: start, pause, restart, mute. */
function handleKeys() {
  if (wasPressed(input, 'enter') || wasPressed(input, ' ')) {
    audio.unlock();
    if (flight.screen === SCREEN_TITLE) flight.screen = SCREEN_PLAY;
    else if (flight.screen === SCREEN_CRASHED || flight.screen === SCREEN_COMPLETE) resetFlight(flight);
  }
  if (wasPressed(input, 'p')) {
    if (flight.screen === SCREEN_PLAY) flight.screen = SCREEN_PAUSED;
    else if (flight.screen === SCREEN_PAUSED) flight.screen = SCREEN_PLAY;
  }
  if (wasPressed(input, 'r')) {
    resetFlight(flight);
    flight.screen = SCREEN_PLAY;
  }
  if (wasPressed(input, 'm')) {
    flight.muted = !flight.muted;
    audio.setMuted(flight.muted);
  }
  clearPressed(input);
}

attachInput(input, canvas, () => {
  audio.unlock();
  if (flight.screen === SCREEN_TITLE) flight.screen = SCREEN_PLAY;
});

// ---- Screenshot staging ---------------------------------------------------
// ?shot=cover|bank|approach|complete stages a frozen frame of the real game;
// ?shot=selftest flies a whole sortie and reports the result in #status.
let frozen = false;
if (shotName) {
  stageShot(shotName, flight);
  frozen = true;
  reportStatus();
}

// ---- The loop --------------------------------------------------------------
let last = performance.now();
let accumulator = 0;
const STEP = 1 / 60;

function frame(now) {
  requestAnimationFrame(frame);
  if (frozen) {
    render();
    return;
  }
  let elapsed = (now - last) / 1000;
  last = now;
  if (elapsed > 0.25) elapsed = 0.25;
  accumulator += elapsed;
  handleKeys();
  let guard = 0;
  while (accumulator >= STEP && guard < 5) {
    if (flight.screen === SCREEN_PLAY) step(STEP);
    accumulator -= STEP;
    guard += 1;
  }
  if (guard === 5) accumulator = 0;
  render();
  reportStatus();
}

requestAnimationFrame(frame);
