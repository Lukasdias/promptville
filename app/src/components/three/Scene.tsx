import { useMemo } from "react";
import { useNeighborhood } from "../../query";
import { buildStreets, layoutCity } from "../../layout";
import { Ground } from "./Ground";
import { City } from "./City";
import { World } from "./World";
import { Details } from "./Details";
import { Mountains, mountainOuterRadius } from "./Mountains";
import { People } from "./People";
import { Traffic } from "./Traffic";
import { SelectedBanner } from "./SelectedBanner";

export function Scene() {
  const { data } = useNeighborhood();
  const blocks = useMemo(
    () => (data ? layoutCity(data.projects) : []),
    [data],
  );
  const streets = useMemo(() => buildStreets(blocks), [blocks]);
  const extent = useMemo(() => mountainOuterRadius(blocks) + 6, [blocks]);

  return (
    <>
      <color attach="background" args={["#aee6ff"]} />
      <fog attach="fog" args={["#aee6ff", 40, 120]} />
      <hemisphereLight intensity={0.9} groundColor="#cfe8b0" />
      <directionalLight
        position={[18, 30, 10]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={90}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
      />
      <Ground blocks={blocks} streets={streets} extent={extent} />
      <City />
      <World blocks={blocks} streets={streets} />
      <Details blocks={blocks} streets={streets} />
      <People />
      <Traffic streets={streets} />
      <Mountains blocks={blocks} />
      <SelectedBanner />
    </>
  );
}