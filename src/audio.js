import { S } from './state.js';

/**
 * Tum ses prosedureldir — hicbir ses dosyasi yuklenmez.
 * Ortam droneu + kovalamaca droneu surekli calar, efektler anlik uretilir.
 */
let actx, master, chaseGain;

export function audioInit() {
  if (actx) return;
  actx = new (window.AudioContext || window.webkitAudioContext)();
  master = actx.createGain();
  master.gain.value = 0.5;
  master.connect(actx.destination);

  // yumusak ortam droneu (iki sinus + yavas frekans salinimi)
  const ambGain = actx.createGain();
  ambGain.gain.value = 0.06;
  ambGain.connect(master);
  const lp = actx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 380;
  lp.connect(ambGain);
  [55, 82.5].forEach((f, i) => {
    const o = actx.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    const lfo = actx.createOscillator();
    lfo.frequency.value = 0.07 + i * 0.03;
    const lg = actx.createGain();
    lg.gain.value = 4;
    lfo.connect(lg).connect(o.frequency);
    o.connect(lp);
    o.start(); lfo.start();
  });

  // kovalamaca droneu — basta sessiz, Kulge uyaninca acilir
  chaseGain = actx.createGain();
  chaseGain.gain.value = 0;
  chaseGain.connect(master);
  const co = actx.createOscillator();
  co.type = 'sawtooth'; co.frequency.value = 46;
  co.connect(chaseGain); co.start();
  const cl = actx.createOscillator();
  cl.type = 'square'; cl.frequency.value = 92;
  const cg = actx.createGain();
  cg.gain.value = 0.4;
  cl.connect(cg).connect(chaseGain); cl.start();
}

export function resumeAudio() {
  try { audioInit(); actx.resume(); } catch { /* kullanici etkilesimi yoksa sessizce gec */ }
}

function sfx(freq, dur, type, vol, to) {
  if (S.muted || !actx) return;
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, actx.currentTime);
  if (to) o.frequency.exponentialRampToValueAtTime(to, actx.currentTime + dur);
  g.gain.setValueAtTime(vol || 0.15, actx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0008, actx.currentTime + dur);
  o.connect(g).connect(master);
  o.start(); o.stop(actx.currentTime + dur);
}

export const SFX = {
  jump:  () => sfx(240, 0.12, 'square', 0.12, 460),
  gem:   () => { sfx(880, 0.1, 'triangle', 0.16, 1200); setTimeout(() => sfx(1320, 0.14, 'triangle', 0.14), 70); },
  torch: () => sfx(300, 0.18, 'sawtooth', 0.14, 180),
  valve: () => sfx(200, 0.25, 'sine', 0.16, 520),
  door:  () => sfx(150, 0.4, 'sawtooth', 0.18, 60),
  hurt:  () => sfx(220, 0.2, 'square', 0.16, 70),
  win:   () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => sfx(f, 0.2, 'triangle', 0.16), i * 120)),
  step:  () => sfx(90, 0.05, 'sine', 0.05),
};

export function setMute(m) {
  S.muted = m;
  if (master) master.gain.value = m ? 0 : 0.5;
}

export function startHum() {
  if (chaseGain && actx) chaseGain.gain.linearRampToValueAtTime(0.12, actx.currentTime + 1.2);
}
export function stopHum() {
  if (chaseGain && actx) chaseGain.gain.linearRampToValueAtTime(0, actx.currentTime + 0.6);
}
