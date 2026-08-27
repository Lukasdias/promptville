import { useCity } from "../../city";
import { Block } from "./Block";

export function City() {
  const { blocks } = useCity();
  if (blocks.length === 0) return null;
  return (
    <group>
      {blocks.map((b, i) => (
        b.kind === "plaza" ? null : <Block key={b.projectId} block={b} paletteIndex={i % 12} />
      ))}
    </group>
  );
}