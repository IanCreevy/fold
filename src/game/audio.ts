/** Tiny Web Audio flourishes — no asset pipeline needed. */
let ctx: AudioContext | null = null;

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function unlockAudio() {
  void ac().resume();
}

function tone(freq: number, dur: number, type: OscillatorType, gain = 0.04) {
  const c = ac();
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + dur);
}

export function sfxFold() {
  tone(220, 0.08, "triangle", 0.03);
  tone(330, 0.12, "sine", 0.025);
}

export function sfxGo() {
  tone(392, 0.1, "square", 0.03);
  tone(523, 0.14, "square", 0.025);
}

export function sfxWin(stars: number) {
  tone(523, 0.12, "sine", 0.04);
  setTimeout(() => tone(659, 0.12, "sine", 0.04), 80);
  if (stars >= 2) setTimeout(() => tone(784, 0.16, "sine", 0.045), 160);
  if (stars >= 3) setTimeout(() => tone(988, 0.2, "triangle", 0.05), 260);
}

export function sfxScrap() {
  tone(880, 0.08, "triangle", 0.035);
}
