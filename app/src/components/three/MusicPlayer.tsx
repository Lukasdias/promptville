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
const OST_DELAY_MS = 1000;

// Global (non-positional) background music for Promptville. Mounted INSIDE the
// Canvas because it uses useThree/useFrame/useLoader.
//
// It is NOT auto-played. The loading screen shows an explicit "enable sound"
// button; clicking it (a real user gesture) flips `musicOn` in the store, which
// is the browser permission that resumes the AudioContext and runs the sequence:
//   one-shot start-up SFX once, then the day/night OST loops (crossfaded by the
//   town clock). The header <Music> button is a mute toggle afterwards.
export function MusicPlayer() {
  const musicOn = useApp((s) => s.musicOn);
  const camera = useThree((s) => s.camera);
  const { data } = useNeighborhood();
  const loaded = Boolean(data);

  // Day plays the "5 a.m." track, night plays the "5 p.m." track. (The raw
  // files were the other way around — PM in day-ost, AM in night-ost — so we
  // load the paired buffers swapped here.)
  const dayBuffer = useLoader(AudioLoader, "/night-ost.mp3");
  const nightBuffer = useLoader(AudioLoader, "/day-ost.mp3");
  const sfxBuffer = useLoader(AudioLoader, "/start-up-sound.mp3");

  const dayRef = useRef<Audio | null>(null);
  const nightRef = useRef<Audio | null>(null);
  const sfxRef = useRef<Audio | null>(null);
  const listenerRef = useRef<AudioListener | null>(null);
  // Guards so the startup sequence runs exactly once.
  const startedRef = useRef(false);
  const ostStartedRef = useRef(false);

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
    listenerRef.current = listener;

    return () => {
      camera.remove(listener);
      dayRef.current = null;
      nightRef.current = null;
      sfxRef.current = null;
      listenerRef.current = null;
    };
  }, [camera, dayBuffer, nightBuffer, sfxBuffer]);

  // The permission button (in the Splash) flips `musicOn` to true inside a click
  // handler — a real user gesture. That is our trigger to run the sequence.
  useEffect(() => {
    if (!musicOn || !loaded) return;
    if (!startedRef.current) runSequence();
  }, [musicOn, loaded]);

  // Mute toggle (header button): pause/resume just the loops.
  useEffect(() => {
    const day = dayRef.current;
    const night = nightRef.current;
    if (!day || !night) return;
    if (musicOn && ostStartedRef.current) {
      day.play();
      night.play();
    } else if (!musicOn) {
      day.pause();
      night.pause();
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

  function runSequence(): void {
    if (startedRef.current) return;
    startedRef.current = true;
    // This runs inside a user-gesture task; resume the context so `play()` works.
    const ctx = listenerRef.current?.context;
    const ready = ctx && ctx.state === "suspended" ? ctx.resume() : Promise.resolve();

    void ready.then(() => {
      const sfx = sfxRef.current;
      if (sfx) sfx.play();
    });
    window.setTimeout(() => {
      if (ostStartedRef.current) return;
      ostStartedRef.current = true;
      const day = dayRef.current;
      const night = nightRef.current;
      if (day) day.play();
      if (night) night.play();
    }, OST_DELAY_MS);
  }
}
