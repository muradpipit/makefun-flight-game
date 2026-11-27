// Synthesised sound: no audio files, everything is built with WebAudio —
// an engine drone that follows the throttle, wind that follows the speed,
// a chime for a ring and a thud for a crash.

/** Create the audio layer. It stays silent until unlock() runs on a gesture. */
export function createAudio() {
  const state = {
    ctx: null,
    master: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    windGain: null,
    windSource: null,
    muted: false,
    unlocked: false,
  };

  /** Start the AudioContext and the engine/wind loops (call from a gesture). */
  function unlock() {
    if (state.unlocked) return;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ac = new AudioContextClass();
      state.ctx = ac;
      state.master = ac.createGain();
      state.master.gain.value = 0.5;
      state.master.connect(ac.destination);

      state.engineOsc = ac.createOscillator();
      state.engineOsc.type = 'sawtooth';
      state.engineOsc.frequency.value = 62;
      state.engineOsc2 = ac.createOscillator();
      state.engineOsc2.type = 'square';
      state.engineOsc2.frequency.value = 31;
      const engineFilter = ac.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      state.engineGain = ac.createGain();
      state.engineGain.gain.value = 0;
      state.engineOsc.connect(engineFilter);
      state.engineOsc2.connect(engineFilter);
      engineFilter.connect(state.engineGain);
      state.engineGain.connect(state.master);
      state.engineOsc.start();
      state.engineOsc2.start();

      // Wind: a looped noise buffer through a band-pass filter.
      const length = ac.sampleRate * 2;
      const buffer = ac.createBuffer(1, length, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      state.windSource = ac.createBufferSource();
      state.windSource.buffer = buffer;
      state.windSource.loop = true;
      const windFilter = ac.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 800;
      windFilter.Q.value = 0.6;
      state.windGain = ac.createGain();
      state.windGain.gain.value = 0;
      state.windSource.connect(windFilter);
      windFilter.connect(state.windGain);
      state.windGain.connect(state.master);
      state.windSource.start();
      state.unlocked = true;
    } catch {
      state.ctx = null;
    }
  }

  /** Follow the flight: engine pitch from throttle, wind from speed. */
  function update(f) {
    if (!state.ctx || state.muted) return;
    const t = state.ctx.currentTime;
    const engineLevel = f.screen === 'play' ? 0.05 + f.throttle * 0.11 : 0;
    state.engineGain.gain.setTargetAtTime(engineLevel, t, 0.1);
    state.engineOsc.frequency.setTargetAtTime(58 + f.throttle * 62 + f.speed * 0.25, t, 0.1);
    state.engineOsc2.frequency.setTargetAtTime(29 + f.throttle * 31 + f.speed * 0.12, t, 0.1);
    const windLevel = f.screen === 'play' ? Math.min(0.16, f.speed * 0.0016) : 0;
    state.windGain.gain.setTargetAtTime(windLevel, t, 0.15);
  }

  /** A short tone: frequency, duration, type, volume. */
  function tone(freq, dur, type, volume, when) {
    if (!state.ctx) return;
    const ac = state.ctx;
    const osc = ac.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = ac.createGain();
    const start = ac.currentTime + (when || 0);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain);
    gain.connect(state.master);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  /** Play a one-shot event from the flight's event flags. */
  function playEvent(name) {
    if (!state.ctx || state.muted) return;
    if (name === 'ring') {
      tone(660, 0.35, 'sine', 0.3, 0);
      tone(880, 0.45, 'sine', 0.3, 0.09);
      tone(1320, 0.5, 'sine', 0.22, 0.18);
    } else if (name === 'land') {
      tone(220, 0.25, 'sine', 0.3, 0);
      tone(330, 0.3, 'sine', 0.25, 0.08);
    } else if (name === 'crash') {
      tone(70, 0.7, 'sine', 0.5, 0);
      tone(50, 0.9, 'triangle', 0.4, 0.05);
    }
  }

  function setMuted(muted) {
    state.muted = muted;
    if (state.master) state.master.gain.value = muted ? 0 : 0.5;
  }

  return { unlock, update, playEvent, setMuted, get muted() { return state.muted; } };
}
