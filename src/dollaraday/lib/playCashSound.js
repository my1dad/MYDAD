import { assetUrl } from "@/lib/assetUrl";

/** Packaged cash-register cha-ching (public/sounds/cha-ching.mp3). */
export const CASH_SOUND_URL = `${assetUrl("sounds/cha-ching.mp3")}?v=2`;

let sharedAudio = null;
let unlocked = false;

function getCashAudio() {
  if (typeof Audio === "undefined") return null;
  if (!sharedAudio || sharedAudio.src.indexOf("v=2") === -1) {
    sharedAudio = new Audio(CASH_SOUND_URL);
    sharedAudio.preload = "auto";
    sharedAudio.volume = 0.5;
    sharedAudio.playbackRate = 1.1;
    sharedAudio.preservesPitch = false;
  }
  return sharedAudio;
}

/** Prefer the OS default / active sound output when the browser supports it. */
async function bindDefaultOutput(audio) {
  if (typeof audio.setSinkId !== "function") return;
  try {
    await audio.setSinkId("");
  } catch {
    // Ignore — still uses the current default device.
  }
}

/**
 * Play the packaged cha-ching on the active sound card.
 * Call from a user gesture (e.g. Confirm deposit).
 */
export function playCashSound() {
  try {
    const audio = getCashAudio();
    if (!audio) return;

    const play = async () => {
      await bindDefaultOutput(audio);
      audio.pause();
      audio.currentTime = 0;
      audio.volume = 0.5;
      audio.playbackRate = 1.1;
      audio.preservesPitch = false;
      const result = audio.play();
      if (result?.catch) {
        await result.catch(() => {});
      }
      unlocked = true;
    };

    void play();
  } catch {
    // Best-effort — never block the deposit flow.
  }
}

/** Warm/decode the clip early so the first deposit click is instant. */
export function preloadCashSound() {
  try {
    const audio = getCashAudio();
    if (!audio || unlocked) return;
    audio.load();
  } catch {
    // ignore
  }
}
