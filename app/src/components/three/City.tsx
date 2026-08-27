import { useMemo } from "react";
import { useNeighborhood } from "../../query";
import { CIVIC_PLAZA, layoutCity } from "../../layout";
import { Block } from "./Block";

export function City() {
  const { data } = useNeighborhood();
  const blocks = useMemo(
    () => (data ? layoutCity(data.projects, { plaza: CIVIC_PLAZA }) : []),
    [data],
  );
  if (blocks.length === 0) return null;
  return (
    <group>
      {blocks.map((b, i) => (
        b.kind === "plaza" ? null : <Block key={b.projectId} block={b} paletteIndex={i % 12} />
      ))}
    </group>
  );
}