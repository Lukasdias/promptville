import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { MathUtils } from "three";
import { useNeighborhood } from "../../query";
import { useCity } from "../../city";
import { useApp } from "../../store";
import {
  DEFAULT_CAMERA,
  DEFAULT_DISTANCE,
  DEFAULT_EXTENT,
  DEFAULT_YAW,
  DRAG_THRESHOLD,
  EDGE_MARGIN,
  clampState,
  computePosition,
  focusTargetFor,
  nudgeYaw,
  panDelta,
  zoomBy,
  type CameraState,
} from "../../camera";
import { isPanActive, setPanActive } from "../../pan";

const LAMBDA_PAN = 6;
const LAMBDA_ROTATE = 8;
const LAMBDA_ZOOM = 5;
const KEY_PAN_SPEED = 1.6;
const PIXEL_PAN_SCALE = 0.003;
// Initial zoom distance as a fraction of the city extent.
const FIT_SCALE = 0.9;

const HANDLED_KEYS = new Set([
  "w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright",
  "q", "e", "r", "+", "-", "f", "home", "escape", "tab", "m", "p", "l", "/",
]);

export function CivCamera() {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const selected = useApp((s) => s.selected);
  const helpOpen = useApp((s) => s.helpOpen);
  const toggleHelp = useApp((s) => s.toggleHelp);
  const tweaksOpen = useApp((s) => s.tweaksOpen);
  const toggleTweaks = useApp((s) => s.toggleTweaks);
  const clearSelection = useApp((s) => s.clearSelection);
  const toggleNavigator = useApp((s) => s.toggleNavigator);
  const focusSearch = useApp((s) => s.focusSearch);

  const { data } = useNeighborhood();
  const projects = data?.projects ?? [];
  const { blocks, extent } = useCity();

  const state = useRef<CameraState>({ ...DEFAULT_CAMERA });
  const goal = useRef<CameraState>({ ...DEFAULT_CAMERA });
  const keys = useRef<Set<string>>(new Set());
  const pointer = useRef({ down: false, x: 0, y: 0, startX: 0, startY: 0, lastX: 0, lastY: 0 });
  const edgeScroll = useRef(true);
  const helpOpenRef = useRef(helpOpen);
  useEffect(() => {
    helpOpenRef.current = helpOpen;
  }, [helpOpen]);
  const tweaksOpenRef = useRef(tweaksOpen);
  useEffect(() => {
    tweaksOpenRef.current = tweaksOpen;
  }, [tweaksOpen]);
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    const t = focusTargetFor(blocks, projects, selected);
    goal.current.x = t.x;
    goal.current.z = t.z;
  }, [selected, blocks, projects]);

  // On first data load, zoom out to frame the whole town. Never overrides a
  // user zoom once they have moved the camera.
  useEffect(() => {
    if (extent <= DEFAULT_EXTENT) return;
    if (goal.current.distance !== DEFAULT_CAMERA.distance) return;
    goal.current.distance = clampState(
      { ...DEFAULT_CAMERA, distance: extent * FIT_SCALE },
      extent,
    ).distance;
  }, [extent]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      if (!HANDLED_KEYS.has(k)) return;
      e.preventDefault();
      keys.current.add(k);

      if (k === "q" || k === "e") {
        goal.current.yaw = nudgeYaw(goal.current.yaw, k === "q" ? -1 : 1);
      } else if (k === "r") {
        goal.current.x = 0;
        goal.current.z = 0;
        goal.current.yaw = DEFAULT_YAW;
        goal.current.distance = DEFAULT_DISTANCE;
      } else if (k === "f" || k === "home") {
        const t = focusTargetFor(blocks, projects, selectedRef.current);
        goal.current.x = t.x;
        goal.current.z = t.z;
      } else if (k === "+") {
        goal.current.distance = zoomBy(goal.current.distance, 1 / 1.15);
      } else if (k === "-") {
        goal.current.distance = zoomBy(goal.current.distance, 1.15);
      } else if (k === "p") {
        toggleTweaks();
      } else if (k === "tab") {
        toggleHelp();
      } else if (k === "escape") {
        if (helpOpenRef.current) toggleHelp();
        else if (tweaksOpenRef.current) toggleTweaks();
        else clearSelection();
      } else if (k === "m") {
        edgeScroll.current = !edgeScroll.current;
      } else if (k === "l") {
        toggleNavigator();
      } else if (k === "/") {
        focusSearch();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current.delete(e.key.toLowerCase());
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [gl, blocks, projects, toggleHelp, toggleTweaks, clearSelection, toggleNavigator, focusSearch]);

  useEffect(() => {
    const el = gl.domElement;
    const onPointerDown = (e: PointerEvent) => {
      setPanActive(false);
      pointer.current = {
        down: true,
        x: e.clientX,
        y: e.clientY,
        startX: e.clientX,
        startY: e.clientY,
        lastX: e.clientX,
        lastY: e.clientY,
      };
    };
    const onPointerMove = (e: PointerEvent) => {
      pointer.current.x = e.clientX;
      pointer.current.y = e.clientY;
      if (
        pointer.current.down &&
        Math.hypot(e.clientX - pointer.current.startX, e.clientY - pointer.current.startY) > DRAG_THRESHOLD
      ) {
        setPanActive(true);
      }
    };
    const onPointerUp = () => {
      pointer.current.down = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      goal.current.distance = zoomBy(goal.current.distance, e.deltaY > 0 ? 1.15 : 1 / 1.15);
    };
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05);
    const st = state.current;
    const g = goal.current;
    const k = keys.current;

    let sx = 0;
    let sz = 0;
    if (k.has("w") || k.has("arrowup")) sz += 1;
    if (k.has("s") || k.has("arrowdown")) sz -= 1;
    if (k.has("d") || k.has("arrowright")) sx += 1;
    if (k.has("a") || k.has("arrowleft")) sx -= 1;

    const pt = pointer.current;
    if (edgeScroll.current && !pt.down) {
      if (pt.x <= EDGE_MARGIN) sx -= 1;
      else if (pt.x >= size.width - EDGE_MARGIN) sx += 1;
      if (pt.y <= EDGE_MARGIN) sz += 1;
      else if (pt.y >= size.height - EDGE_MARGIN) sz -= 1;
    }

    if (sx !== 0 || sz !== 0) {
      const mag = Math.hypot(sx, sz);
      const p = panDelta(st, sx / mag, sz / mag);
      const speed = g.distance * KEY_PAN_SPEED * d;
      g.x += p.x * speed;
      g.z += p.z * speed;
    }

    if (pt.down && isPanActive()) {
      const dx = pt.x - pt.lastX;
      const dy = pt.y - pt.lastY;
      pt.lastX = pt.x;
      pt.lastY = pt.y;
      const p = panDelta(st, -dx, dy);
      const scale = g.distance * PIXEL_PAN_SCALE;
      g.x += p.x * scale;
      g.z += p.z * scale;
    } else {
      pt.lastX = pt.x;
      pt.lastY = pt.y;
    }

    st.x = MathUtils.damp(st.x, g.x, LAMBDA_PAN, d);
    st.z = MathUtils.damp(st.z, g.z, LAMBDA_PAN, d);
    st.yaw = MathUtils.damp(st.yaw, g.yaw, LAMBDA_ROTATE, d);
    st.distance = MathUtils.damp(st.distance, g.distance, LAMBDA_ZOOM, d);
    st.pitch = g.pitch;

    const clamped = clampState(st, extent);
    const pos = computePosition(clamped);
    camera.position.set(pos.x, pos.y, pos.z);
    camera.lookAt(clamped.x, 0, clamped.z);
  });

  return null;
}