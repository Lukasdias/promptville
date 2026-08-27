import { useMemo } from "react";
import { useApp } from "../../store";
import { layoutCity } from "../../layout";
import { Block } from "./Block";

export function City() {
  const data = useApp((s) => s.data);
  const blocks = useMemo(
    () => (data ? layoutCity(data.projects) : []),
    [data],
  );
  if (blocks.length === 0) return null;
  return (
    <group>
      {blocks.map((b, i) => (
        <Block key={b.projectId} block={b} paletteIndex={i % 12} />
      ))}
    </group>
  );
}