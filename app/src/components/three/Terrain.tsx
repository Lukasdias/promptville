import { useMemo } from "react";
import { PlaneGeometry, type BufferAttribute } from "three";
import { createNoise3D } from "simplex-noise";
import { mulberry32 } from "../../rand";
import { cityPad, hillHeight, padOvershoot, PAD_MARGIN } from "../../ground";
import { grassMaterial, grassTexture, GRASS_TILE_WORLD } from "../../textures";
import type { Bounds } from "../../layout";
import { useApp } from "../../store";
import { isPanActive } from "../../pan";

const SEG = 120;
const NOISE_SCALE = 0.02;
const TERRAIN_SINK = 0.05;
const HILL_NOISE_AMP = 0.6;
const HILL_NOISE_FALLOFF = 8;

export function Terrain({ extent, bounds }: { extent: number; bounds: Bounds | null }) {
  const clearSelection = useApp((s) => s.clearSelection);

  const geometry = useMemo(() => {
    const size = extent * 2;
    const g = new PlaneGeometry(size, size, SEG, SEG);
    g.rotateX(-Math.PI / 2);
    const pad = bounds ? cityPad(bounds, PAD_MARGIN) : null;
    const noise = createNoise3D(mulberry32(1313));
    const pos = g.attributes.position as BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const wx = pos.getX(i);
      const wz = pos.getZ(i);
      let h = 0;
      if (pad) {
        const over = padOvershoot(wx, wz, pad);
        h = hillHeight(over);
        if (over > 0) {
          h += (noise(wx * NOISE_SCALE, 0, wz * NOISE_SCALE) + 1) * HILL_NOISE_AMP * Math.min(1, over / HILL_NOISE_FALLOFF);
        }
      }
      pos.setY(i, h);
    }
    g.computeVertexNormals();
    grassTexture.repeat.set(Math.max(2, Math.round(size / GRASS_TILE_WORLD)), Math.max(2, Math.round(size / GRASS_TILE_WORLD)));
    grassTexture.needsUpdate = true;
    return g;
  }, [extent, bounds]);

  return (
    <mesh
      geometry={geometry}
      position={[0, -TERRAIN_SINK, 0]}
      receiveShadow
      material={grassMaterial}
      onClick={(e) => {
        if (isPanActive()) return;
        e.stopPropagation();
        clearSelection();
      }}
    />
  );
}
