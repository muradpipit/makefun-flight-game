// Keyboard and mouse: the pilot's stick. Arrows pitch and bank, W/S work
// the throttle, the mouse steers like a stick, and the wheel trims throttle.

/** A fresh input state. */
export function createInput() {
  return {
    keys: new Set(),
    mouseX: 0, // -1..1 across the canvas, 0 at centre
    mouseY: 0, // -1..1 down the canvas, 0 at centre
    mouseActive: false,
    wheel: 0, // accumulated wheel ticks, consumed by the game loop
    pressed: new Set(), // keys pressed since the last poll
  };
}

/** Attach listeners to the window and the canvas. */
export function attachInput(input, canvas, onGesture) {
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.key)) {
      event.preventDefault();
    }
    if (!event.repeat) input.pressed.add(event.key.toLowerCase());
    input.keys.add(event.key.toLowerCase());
    onGesture();
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.key.toLowerCase());
  });
  window.addEventListener('blur', () => input.keys.clear());
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    input.mouseY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    input.mouseActive = true;
  });
  canvas.addEventListener('mouseleave', () => {
    input.mouseActive = false;
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    input.wheel += event.deltaY > 0 ? -1 : 1;
  }, { passive: false });
  canvas.addEventListener('mousedown', () => onGesture());
}

/** Was a key pressed since the last poll? (Clears the flag.) */
export function wasPressed(input, key) {
  const hit = input.pressed.has(key);
  if (hit) input.pressed.delete(key);
  return hit;
}

/** Clear all one-shot press flags (call once per frame after polling). */
export function clearPressed(input) {
  input.pressed.clear();
}

/**
 * The pilot's flight inputs for this frame: pitch and roll in -1..1,
 * throttle change in -1..1. The mouse steers when it has moved recently and
 * no arrow key is steering that axis.
 */
export function readFlightInput(input) {
  const keys = input.keys;
  let pitch = 0;
  let roll = 0;
  let throttle = 0;
  if (keys.has('arrowup')) pitch += 1;
  if (keys.has('arrowdown')) pitch -= 1;
  if (keys.has('arrowleft')) roll -= 1;
  if (keys.has('arrowright')) roll += 1;
  if (keys.has('w')) throttle += 1;
  if (keys.has('s')) throttle -= 1;
  if (keys.has('shift')) throttle += 1;
  if (keys.has('control')) throttle -= 1;
  if (input.mouseActive) {
    if (pitch === 0) pitch = Math.max(-1, Math.min(1, -input.mouseY * 1.6));
    if (roll === 0) roll = Math.max(-1, Math.min(1, input.mouseX * 1.4));
  }
  if (input.wheel !== 0) {
    throttle += Math.max(-1, Math.min(1, input.wheel * 0.15));
    input.wheel = 0;
  }
  return { pitch, roll, throttle };
}
