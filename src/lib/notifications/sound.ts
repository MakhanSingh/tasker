// A deliberately gentle notification chime, synthesised rather than loaded
// from an audio file — no asset to ship, and the shape is tunable here.
//
// What keeps it from grating:
//  - Pure sine waves. Square/saw waves carry harsh upper harmonics; sine has
//    none, so the tone reads as soft however loud the speakers are.
//  - Two notes a perfect fifth apart (A5 → E6). A consonant interval sounds
//    settled; a second or tritone would sound like an alarm.
//  - A ~12ms fade-in and a long exponential fade-out. Starting or stopping a
//    tone abruptly produces an audible click, which is what makes most
//    in-app sounds feel cheap.
//  - Low gain, and the whole thing is over in well under half a second.

const NOTES = [
  { frequency: 880.0, delay: 0 }, // A5
  { frequency: 1318.5, delay: 0.09 }, // E6
];

const PEAK_GAIN = 0.11;
const ATTACK = 0.012;
const RELEASE = 0.42;

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
  if (!Ctor) return null;
  // One context for the tab's lifetime — creating one per chime leaks audio
  // resources and browsers cap how many may exist.
  context ??= new Ctor();
  return context;
}

export function playNotificationChime() {
  const ctx = getContext();
  if (!ctx) return;

  // Browsers start the context suspended until the user has interacted with
  // the page. Resuming is best-effort: if it's refused there's simply no
  // sound, which must never surface as an error.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  if (ctx.state !== "running") return;

  const start = ctx.currentTime;

  for (const { frequency, delay } of NOTES) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    const noteStart = start + delay;
    gain.gain.setValueAtTime(0.0001, noteStart);
    gain.gain.linearRampToValueAtTime(PEAK_GAIN, noteStart + ATTACK);
    // Exponential decay tails off the way a struck bell does; a linear ramp
    // sounds like the sound was cut off.
    gain.gain.exponentialRampToValueAtTime(0.0001, noteStart + RELEASE);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + RELEASE + 0.02);
  }
}
