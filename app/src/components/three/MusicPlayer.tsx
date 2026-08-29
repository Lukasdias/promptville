import { useEffect, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { Audio, AudioListener, AudioLoader } from "three";
import { useApp } from "../../store";
import { useNeighborhood } from "../../query";
import { clockRef } from "../../night";
import { daylight } from "../../daynight";

// Day↔night blend from the live clock, held through a soft midpoint so the two
// tracks crossfade rather than hard-cutting when the cycle crosses dusk/dawn.
function blendFor(t: number): number {
  const d = daylight(t);
  return Math.max(0, Math.min(1, (d - 0.35) / 0.3));
}

// How long after the startup SFX before the world OST fades in.
const OST_DELAY_MS = 1200;

// Global (non-positional) background music for Promptville. Mounted INSIDE the
// Canvas because it uses useThree/useFrame/useLoader. Sequence on first load:
//   play the one-shot start-up SFX once, then fade in the day/night OST loops
//   (crossfaded by the town clock). The header <Music> button is a mute toggle.
export function MusicPlayer() {
  const musicOn = useApp((s) => s.musicOn);
  const camera = useThree((s) => s.camera);
  const { data } = useNeighborhood();
  const loaded = Boolean(data);

  const dayBuffer = useLoader(AudioLoader, "/day-ost.mp3");
  const nightBuffer = useLoader(AudioLoader, "/night-ost.mp3");
  const sfxBuffer = useLoader(AudioLoader, "/start-up-sound.mp3");

  const dayRef = useRef<Audio | null>(null);
  const nightRef = useRef<Audio | null>(null);
  const sfxRef = useRef<Audio | null>(null);
  const startedRef = useRef(false);
  const startedSfxRef = useRef(false);

  // One listener for the whole app, riding the camera.
  useEffect(() => {
    const listener = new AudioListener();
    camera.add(listener);

    const day = new Audio(listener);
    day.setBuffer(dayBuffer);
    day.setLoop(true);
    const night = new Audio(listener);
    night.setBuffer(nightBuffer);
    night.setLoop(true);
    const sfx = new Audio(listener);
    sfx.setBuffer(sfxBuffer);
    sfx.setLoop(false);

    dayRef.current = day;
    nightRef.current = night;
    sfxRef.current = sfx;

    return () => {
      camera.remove(listener);
      dayRef.current = null;
      nightRef.current = null;
      sfxRef.current = null;
    };
  }, [camera, dayBuffer, nightBuffer, sfxBuffer]);

  // Kick off once the world is loaded: SFX first, OST after a short delay.
  useEffect(() => {
    if (!loaded || startedRef.current) return;
    startedRef.current = true;
    // Play the one-shot SFX once (browsers usually allow this on load; if they
    // block it, the music still starts on the first user gesture below).
    void sfxRef.current?.play();
    window.setTimeout(() => {
      startedSfxRef.current = true;
      void dayRef.current?.play();
      void nightRef.current?.play();
    }, OST_DELAY_MS);
  }, [loaded]);

  // Mute/unmute: pause the loops (SFX is one-shot, unaffected).
  useEffect(() => {
    if (!startedSfxRef.current) return;
    if (musicOn) {
      void dayRef.current?.play();
      void nightRef.current?.play();
    } else {
      dayRef.current?.pause();
      nightRef.current?.pause();
    }
  }, [musicOn]);

  // Crossfade day↔night each frame from the live clock.
  useFrame(() => {
    const day = dayRef.current;
    const night = nightRef.current;
    if (!day || !night) return;
    const w = blendFor(clockRef.current);
    day.setVolume(w);
    night.setVolume(1 - w);
  });

  return null;
}
