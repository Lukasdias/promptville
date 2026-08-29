import { useEffect, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { Audio, AudioListener, AudioLoader } from "three";
import { useApp } from "../../store";
import { clockRef } from "../../night";
import { daylight } from "../../daynight";

// Day↔night blend from the live clock, held through a soft midpoint so the two
// tracks crossfade rather than hard-cutting when the cycle crosses dusk/dawn.
function blendFor(t: number): number {
  const d = daylight(t);
  return Math.max(0, Math.min(1, (d - 0.35) / 0.3));
}

// Global (non-positional) background music for Promptville. Mounted INSIDE the
// Canvas because it uses useThree/useFrame/useLoader. A single web-audio
// listener rides the camera; the two loops (day/night OST) share it and are
// crossfaded each frame by the town's clock, so the music follows auto-cycle
// and manual slider changes alike. The header button only flips `musicOn`.
export function MusicPlayer() {
  const musicOn = useApp((s) => s.musicOn);
  const camera = useThree((s) => s.camera);

  // Load the two streams once; `useLoader` caches by URL so re-mounts reuse them.
  const dayBuffer = useLoader(AudioLoader, "/day-ost.mp3");
  const nightBuffer = useLoader(AudioLoader, "/night-ost.mp3");

  const dayRef = useRef<Audio | null>(null);
  const nightRef = useRef<Audio | null>(null);
  const playingRef = useRef(false);

  // One listener for the whole app, riding the camera (the camera's transform
  // drives all positional/global audio sampling).
  useEffect(() => {
    const listener = new AudioListener();
    camera.add(listener);

    const day = new Audio(listener);
    day.setBuffer(dayBuffer);
    day.setLoop(true);
    const night = new Audio(listener);
    night.setBuffer(nightBuffer);
    night.setLoop(true);

    dayRef.current = day;
    nightRef.current = night;

    return () => {
      camera.remove(listener);
      dayRef.current = null;
      nightRef.current = null;
    };
  }, [camera, dayBuffer, nightBuffer]);

  // Start/stop on the music toggle. Browsers require a user gesture to resume
  // the context, so this is triggered by the header button's click.
  useEffect(() => {
    if (musicOn && !playingRef.current) {
      playingRef.current = true;
      void dayRef.current?.play();
      void nightRef.current?.play();
    } else if (!musicOn && playingRef.current) {
      playingRef.current = false;
      dayRef.current?.pause();
      nightRef.current?.pause();
    }
  }, [musicOn]);

  // Crossfade day↔night each frame from the live clock.
  useFrame(() => {
    if (!musicOn) return;
    const day = dayRef.current;
    const night = nightRef.current;
    if (!day || !night) return;
    const w = blendFor(clockRef.current);
    day.setVolume(w);
    night.setVolume(1 - w);
  });

  return null;
}
