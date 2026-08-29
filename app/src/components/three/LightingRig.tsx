import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Color } from "three";
import type { DirectionalLight, HemisphereLight } from "three";
import { clockRef, nightRef } from "../../night";
import { skyUniforms } from "./Sky";
import { daylight, sunDirection, skyPalette } from "../../daynight";
import { useApp } from "../../store";
import { SUN_INTENSITY_DAY, HEMI_INTENSITY_DAY, MOON_INTENSITY_NIGHT } from "../../theme";

const SUN_DIST = 30;
const MOON_DIST = 30;
const DAY_HOURS_PER_SECOND = 0.25;
const SLIDER_CADENCE = 0.25;

export function LightingRig() {
  const { scene } = useThree();
  const setTimeOfDay = useApp((s) => s.setTimeOfDay);
  const autoCycle = useApp((s) => s.autoCycle);

  const sunRef = useRef<DirectionalLight>(null);
  const hemiRef = useRef<HemisphereLight>(null);
  const moonRef = useRef<DirectionalLight>(null);

  const auto = useRef(autoCycle);
  useEffect(() => {
    auto.current = autoCycle;
  }, [autoCycle]);
  const writeCounter = useRef(0);
  const bgColor = useRef(new Color("#aee6ff"));

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05);
    let t = clockRef.current;
    if (auto.current) {
      t = (t + (d * DAY_HOURS_PER_SECOND) / 24) % 1;
      clockRef.current = t;
      writeCounter.current += d;
      if (writeCounter.current >= SLIDER_CADENCE) {
        writeCounter.current = 0;
        setTimeOfDay(t * 24);
      }
    }

    const day = daylight(t);
    const night = 1 - day;
    nightRef.current = night;

    const sun = sunDirection(t);
    const p = skyPalette(t);

    if (sunRef.current) {
      sunRef.current.position.set(sun.x * SUN_DIST, sun.y * SUN_DIST, sun.z * SUN_DIST);
      sunRef.current.intensity = day > 0.02 ? SUN_INTENSITY_DAY * day : 0;
      sunRef.current.color.set(p.sunColor);
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = HEMI_INTENSITY_DAY * (0.35 + 0.65 * day);
      hemiRef.current.color.set(p.top);
      hemiRef.current.groundColor.set("#cfe8b0");
    }
    if (moonRef.current) {
      moonRef.current.intensity = MOON_INTENSITY_NIGHT * night;
      moonRef.current.position.set(-sun.x * MOON_DIST, -sun.y * MOON_DIST, -sun.z * MOON_DIST);
    }

    if (scene.fog) scene.fog.color.set(p.fog);
    scene.background = bgColor.current.set(p.top);

    document.documentElement.style.setProperty("--sign-glow", (night * 0.8).toFixed(2));

    skyUniforms.uTop.value.set(p.top);
    skyUniforms.uHorizon.value.set(p.horizon);
    skyUniforms.uSunDir.value.set(sun.x, sun.y, sun.z);
    skyUniforms.uSunColor.value.set(p.sunColor);
    skyUniforms.uNight.value = night;
  });

  return (
    <>
      <directionalLight
        ref={sunRef}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={90}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
      />
      <hemisphereLight ref={hemiRef} groundColor="#cfe8b0" />
      <directionalLight ref={moonRef} color="#9fb2d8" />
    </>
  );
}
