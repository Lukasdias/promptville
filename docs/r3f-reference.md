# React Three Fiber Reference

Distilled from the official R3F docs (r3f.docs.pmnd.rs). Applies to `@react-three/fiber` v8+ and three.js r150+.

## 1. Your First Scene (`getting-started/your-first-scene`)

- `<Canvas>` sets up the `Scene`, a `PerspectiveCamera`, and the render loop automatically — no manual `requestAnimationFrame`.
- **Canvas is responsive**: it fills its parent DOM node; control size via the parent.
- **Native elements**: every three.js class is a lowercase camelCase JSX element — `<mesh />` = `new THREE.Mesh()`. Nothing to import for the catalogue (v8 tree-shakes via `extend`).
- **Constructor args**: always passed as an array via `args` — `<boxGeometry args={[2, 2, 2]} />`. Changing `args` **reconstructs the object**.
- **Props**: any three.js property works as a React prop — `color="red"` calls `.set()`, `position={[0, 0, 5]}` calls `.set()`.
- Lights: `<ambientLight intensity={0.1} />`, `<directionalLight position={[0, 0, 5]} color="red" />`.

## 2. Canvas (`api/canvas`)

Key props:

- `gl` — renderer props, or a callback (sync/async) to create your own renderer (WebGPU via promise).
- `camera` — `{ fov: 75, near: 0.1, far: 1000, position: [0, 0, 5] }`, or your own camera. `orthographic` flag for ortho.
- `shadows` — `false`, `true` (PCFSoft), or `'basic' | 'percentage' | 'soft' | 'variance'`.
- `frameloop` — `'always' | 'demand' | 'never'`. `'demand'` renders only when needed (saves battery).
- `dpr` — default `[1, 2]` auto-clamped devicePixelRatio.
- `flat` — disables ACES tonemapping (flat/cartoon look). `linear` — disables sRGB conversion.
- `onCreated(state)`, `onPointerMissed`, `eventSource`, `eventPrefix`, `fallback` (non-WebGL fallback UI), `resize` config.

**Defaults**: antialias, alpha, `powerPreference: "high-performance"`, SRGB output, ACES tonemapping, PerspectiveCamera, Raycaster.

Wrap Canvas in an error boundary to guard against WebGL context crashes.

## 3. Objects (`api/objects`)

- **Declare declaratively**: prefer `<sphereGeometry args={[1, 16, 16]} />` + `<meshStandardMaterial color="hotpink" />` over constructing objects in props. React then manages lifecycle and disposal.
- **`args` = constructor args**; changing them reconstructs.
- **`.set()` shortcuts**: `color="hotpink"`, `position={[1, 2, 3]}`, `scale={1}` (SetScalar).
- **Dash-case piercing** for nested props: `rotation-x={1}`, `material-uniforms-resolution-value={[512, 512]}`.
- **`attach`** binds a child to a parent property: `attach="material"`, `attach="geometry"` (auto-inferred for materials/geometries), nested `attach="a-b-c"`, array `attach="material-0"`. Custom: `attach={(parent, self) => (parent.add(self), () => parent.remove(self))}`.
- **`<primitive object={...} />`** injects existing three.js objects. Never add the same object twice (three.js reparents); clone to reuse. Primitives don't auto-dispose.
- **`extend({ ... })`** registers third-party/custom classes as JSX elements; add TypeScript types via `ThreeElements` module augmentation.
- **Disposal**: R3F auto-calls `.dispose()` on unmount; opt out with `dispose={null}` (valid on whole groups).

## 4. Hooks (`api/hooks`)

**Only valid inside `<Canvas>`** (they rely on context) — calling outside crashes.

- **`useThree`** — reactive access to the state model: `gl`, `scene`, `camera`, `raycaster`, `pointer`, `clock`, `size`, `viewport`, `frameloop`, `performance`, `events`, `set`, `get`, `invalidate`, `advance`, `setSize`, `setDpr`, `setFrameloop`, `onPointerMissed`. Use the **selector form** to avoid re-renders: `useThree((s) => s.camera)`. Selector reactivity does **not** include deeper three.js internals (e.g. `camera.zoom`).
- **`useFrame((state, delta, xrFrame) => ...)`** — runs before each render. **Never `setState` here**; mutate refs directly. Optional numeric `renderPriority` takes over the render loop (you must call `gl.render` yourself). Negative indices only order callbacks without taking over the loop.
- **`useLoader(Loader, url, extensions?, onXhr?)`** — loads any three.js loader, suspends via React.Suspense, **caches by URL**. Array of URLs → parallel loads. Returns `{ nodes, materials }` for loaders that return a scene. `useLoader.preload(...)` pre-warms assets.
- **`useGraph(scene)`** — memoized `{ nodes, materials }` from any Object3D.

## 5. Events (`api/events` + `tutorials/events-and-interaction`)

Any object with a `raycast` method gets events: `onClick`, `onContextMenu`, `onDoubleClick`, `onWheel`, `onPointerUp/Down/Over/Out/Enter/Leave/Move`, `onPointerMissed`, `onUpdate`.

Simple interactivity is just state + a handler:

```jsx
<mesh scale={active ? 1.5 : 1} onClick={() => setActive(!active)}>
```

**Event data**: `{ ...DomEvent, ...Intersection, object, eventObject, unprojectedPoint, ray, camera, sourceEvent, delta, intersections[] }`.

- **Bubbling is 3D-aware**: the event is delivered to the nearest intersected object first, then its ancestors, then the next-nearest object. Objects are transparent to pointer events by default.
- **`stopPropagation()`** also stops delivery to farther objects; those immediately get `pointerout`.
- **Pointer capture**: only via `event.target.setPointerCapture(pointerId)`.
- Customize via the `events` prop factory: `enabled`, `priority`, `filter(intersections, state)`, `compute(event, state)`.
- Attach events to another DOM node via `eventSource`; force raycasts with `state.events.update()` (e.g. when the camera moves).

## 6. Additional Exports (`api/additional-exports`)

`addEffect`, `addAfterEffect`, `addTail`, `buildGraph`, `flushGlobalEffects`, `flushSync`, `invalidate`, `advance`, `extend`, `createPortal`, `createRoot`, `events`, `applyProps`, `useInstanceHandle`.

## 7. TypeScript (`api/typescript`)

- Type refs explicitly: `useRef<Mesh>(null!)` (non-null assertion; safe to access in effects and `useFrame`).
- `ThreeElements['mesh']` types props of any native/custom element: `type FooProps = ThreeElements['mesh'] & { bar: boolean }`.
- `extend` custom classes, then augment: `interface ThreeElements { customElement: ThreeElement<typeof CustomElement> }`, or use the factory form `const Element = extend(CustomElement)` for inferred types.
- Exported types: `Intersection`, `Subscription`, `RenderCallback`, `RootState`, `Performance`, `Dpr`, `Size`, `Viewport`, `Camera`, `CanvasProps`, `Events`, `EventManager`, `ThreeEvent`.

## 8. Testing (`api/testing`)

- `@react-three/test-renderer`: `const renderer = await ReactThreeTestRenderer.create(<Component />)`.
- Inspect: `renderer.scene.children[i].allChildren` (includes geometry/material; `children` omits them).
- Interact: `await renderer.fireEvent(mesh, 'click')`; assert on `mesh.props.scale`.
- `advanceFrames()` for frame-based assertions.

## 9. Scaling Performance (`advanced/scaling-performance`)

- **On-demand rendering**: `<Canvas frameloop="demand">` + `invalidate()` on control change (drei controls do this automatically).
- **Reuse geometries/materials** (module-level singletons) to cut GPU overhead; enable `ColorManagement` for global colors.
- **`useLoader` caches** — same URL = same asset everywhere.
- **Instancing**: each mesh = one draw call; ≤1000 maximum, ideally a few hundred. `instancedMesh` renders hundreds of thousands of objects in one draw call (trees, lamps, rocks).
- **LOD** via drei `<Detailed distances={[...]}>`.
- **Nested loading** with nested `<Suspense>` (low → high quality).
- **drei `<PerformanceMonitor>`**: `onIncline`/`onDecline`/`onChange({ factor })`/`onFallback`, `usePerformanceMonitor` in children, `flipflops` limit.
- **Movement regression**: `state.performance.regress()` + opt-in scaling (`current` = 1 full quality, < 1 scaled). Drei ships `AdaptivePixelRatio`.
- **Concurrency**: React 18 `startTransition`/`useTransition` defer heavy construction (R3F v8 canvases are concurrent by default).

## 10. Pitfalls (`advanced/pitfalls`)

- **Don't mount/unmount indiscriminately** — creation compiles buffers/materials. Prefer toggling `visible`, or `useMemo` shared `geometry`/`material`.
- **Avoid `setState` in loops / `useFrame` / fast events** — mutate refs instead; use `delta` for refresh-rate-independent motion.
- **Animate in `useFrame`** with lerp/damp, or a spring lib (`@react-spring/three`, framer-motion).
- **Don't bind fast state reactively** from stores — read via `useFrame(() => (ref.current.position.x = api.getState().x))`.
- **Re-pool objects** for the GC — reuse `Vector3`/`Matrix4` scratch objects instead of `new` per frame.
- **Prefer `useLoader`** over manual loaders (avoids re-fetch/re-parse per instance).
- **`startTransition`** for expensive updates.

## 11. Loading Models (`tutorials/loading-models`)

- GLTF: `useLoader(GLTFLoader, '/model.gltf')` → `<primitive object={gltf.scene} />`. Convert to components with gltf.pmnd.rs → `useGLTF` from drei + `<group dispose={null}>`.
- OBJ: `useLoader(OBJLoader, url)`; FBX: `useLoader(FBXLoader, url)` or drei's `useFBX(url)`.
- Loader UI: drei `<Html center>` + `useProgress()` inside `<Suspense fallback>`.

## 12. Loading Textures (`tutorials/loading-textures`)

- `useLoader(TextureLoader, url)` → `map={...}` on the material.
- Array form loads multiple maps in parallel: `const [colorMap, normalMap, ...] = useLoader(TextureLoader, [url1, url2, ...])`.
- drei `useTexture` — array or object notation: `useTexture({ map: 'x.jpg', normalMap: 'y.jpg' })`.
- Note for this project: flat low-poly colors are cheaper than textures and fit the cartoon look, so textures are not required.

## 13. Basic Animations (`tutorials/basic-animations`)

- `useFrame(({ clock }) => ...)` — `clock.elapsedTime` drives continuous animation.
- **Refs over state** for per-frame updates (transient updates):

```jsx
const myMesh = useRef()
useFrame(({ clock }) => {
  myMesh.current.rotation.x = clock.elapsedTime
})
```

## 14. How It Works (`tutorials/how-it-works`)

- Fiber is a React renderer for three.js: each component instantiates a THREE object into the scene graph. `<mesh><boxGeometry/><meshNormalMaterial/></mesh>` is equivalent to `new THREE.Mesh()`, assigning material/geometry, and `scene.add(mesh)`.
- `<Canvas>` sets up: camera at `[0, 0, 0]`, render loop, raycast pointer events, tone mapping, resize handling.
- Render loop order per frame: global before-effects → clock delta saved (shared across `useFrame`) → `useFrame` callbacks in order → `renderer.render(scene, camera)` → global after-effects.

## Applied to Opencode City

- **`frameloop="demand"`** + drei OrbitControls (auto-invalidate) → GPU-idle when static; big win for a whole town.
- **Shared/instanced geometry**: houses share `BoxGeometry`; trees/lights share instanced meshes or materials.
- **Cartoon look**: `flat` (no ACES tonemapping), soft shadows, hemisphere + directional lights.
- **Selection**: `onClick`/`onPointerOver`/`onPointerOut` per house; `e.stopPropagation()` so ground clicks clear selection; drei `Html` for the title banner + spring for the pop-in.
- **Hover/animation in `useFrame`** with delta + refs, never `setState` in the loop.
- **Performance**: keep draw calls low (<500), `useMemo` shared materials, `startTransition` when selecting heavy blocks.