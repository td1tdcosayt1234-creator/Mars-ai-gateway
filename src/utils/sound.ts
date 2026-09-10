/**
 * Web Audio API ambient & mechanical click sound synthesizer.
 * Completely zero-dependency, safe, and fails gracefully if audio context is blocked.
 */

let audioCtx: AudioContext | null = null;
let ambientOscillator: OscillatorNode | null = null;
let ambientGain: GainNode | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

export function playTerminalBlip(frequency = 880, duration = 0.04) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {
    // ignore
  }
}

export function playKeySuccess() {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    
    // Two-tone harmonic chime
    [587.33, 880, 1174.66].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.05, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.4);
    });
  } catch {
    // ignore
  }
}

export function toggleCosmicDrone(enable: boolean): boolean {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (!enable) {
      if (ambientOscillator && ambientGain) {
        ambientGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5);
        setTimeout(() => {
          try {
            ambientOscillator?.stop();
            ambientOscillator?.disconnect();
            ambientOscillator = null;
          } catch {
            // ignore
          }
        }, 500);
      }
      return false;
    }

    if (ambientOscillator) return true;

    // Create deep Mars atmospheric drone
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, ctx.currentTime); // Low A

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, ctx.currentTime);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.018, ctx.currentTime + 1.2);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    ambientOscillator = osc;
    ambientGain = gain;
    return true;
  } catch {
    return false;
  }
}
