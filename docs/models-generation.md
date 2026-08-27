# Promptville — 3D Model Generation Prompts

Use these prompts with an AI 3D model generator (Meshy, Tripo, Rodin, Luma Genie, etc.)
to create assets that drop straight into Promptville. Style is locked to the app's
"Storybook Toytown" identity: low-poly, pastel, flat-shaded, slightly oversized cute
proportions.

## Style prefix (append to every prompt)

> Low-poly cartoon, storybook toy-town style, pastel colors, soft rounded edges,
> flat-shaded surfaces with no gradients. Plain white materials only, so I can recolor
> the model programmatically at runtime. Centered at the origin, standing on flat
> ground at y=0, facing +Z, no background, no baked lighting, no shadows, no text.
> Export as GLB (glTF 2.0), under 3000 triangles.

## Asset prompts

### House — base (1x)

> A cute low-poly house with a square footprint, a simple pitched roof, one front door
> and two windows that are slightly oversized for charm. **Material convention: walls
> must be a single material named `body`; roof a single material named `roof`.**
> Approx 1.2 units wide, 1.2 deep, ~1.6 tall.

### House — cottage (for tiny/0-token sessions)

> A tiny low-poly cottage with a big rounded cone roof, round door, two round windows.
> Material convention: `body` (walls) and `roof`. Approx 1 unit wide.

### House — townhouse (for token-heavy sessions)

> A tall low-poly two-story townhouse, hip roof, door on the ground floor, four windows.
> Material convention: `body` (walls) and `roof`. Approx 1.2 wide, 2.4 tall.

### Tree

> A low-poly cartoon tree: brown trunk and a fluffy two-tier round foliage, pastel
> green. Single material named `trunk` and single material named `foliage`.

### Street lamp

> A low-poly cartoon street lamp: thin dark pole and a round pastel-yellow glowing
> orb on top. Materials named `pole` and `glow`.

### Car (tiny, optional decoration)

> A tiny low-poly cartoon car, rounded cube body with a small windshield, pastel red.
> Single material named `car`.

### Park bench

> A low-poly cartoon park bench, cream/wood colored, four legs and a flat seat.

## Integration notes

- Target format: **GLB** (glTF 2.0), y-up, meters. Keep under 3000 triangles per asset
  (the town already has ~2300 draw calls; models must stay cheap).
- **Recolor at runtime, not in generation**: the app encodes data in color (roof =
  model, body = project). Keep generated models white/near-white and tint the materials
  in code via `useGLTF` + `useMemo` material clones:
  `material.clone()` → `newMaterial.color.set(hex)`. Never rely on baked colors.
- **Material naming**: name materials `body`, `roof`, `trunk`, `foliage`, `pole`,
  `glow`, `car` so the loader can find and tint them by name.
- **Draco compression**: fine if the generator supports it; three's `GLTFLoader` +
  `DRACOLoader` handle it. Not required.
- Place GLBs in `app/public/models/` and load with drei `useGLTF`:
  `const { nodes, materials } = useGLTF("/models/house.glb")`.
  Preload with `useGLTF.preload("/models/house.glb")`.

## Runtime tinting reference

```tsx
import { useGLTF } from "@react-three/drei";
import { MeshStandardMaterial } from "three";

function TintedHouse({ bodyColor, roofColor }: { bodyColor: string; roofColor: string }) {
  const { nodes, materials } = useGLTF("/models/house.glb");
  const body = useMemo(() => materials.body.clone() as MeshStandardMaterial, [materials]);
  const roof = useMemo(() => materials.roof.clone() as MeshStandardMaterial, [materials]);
  body.color.set(bodyColor);
  roof.color.set(roofColor);
  // replace the mesh materials inside nodes["house"] (or node.star) with body/roof
  return <primitive object={nodes.house} dispose={null} />;
}
```

## Generation checklist

- [ ] Pastel, flat-shaded, no gradients
- [ ] White/neutral materials (recolor at runtime)
- [ ] Materials named per convention (`body`, `roof`, …)
- [ ] Centered at origin, ground at y=0, facing +Z
- [ ] GLB, < 3000 triangles
- [ ] No background, lighting, or shadows baked in