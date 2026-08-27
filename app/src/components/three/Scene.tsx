import { useMemo } from "react";
import { useNeighborhood } from "../../query";
import { buildStreets, layoutCity } from "../../layout";
import { traffic } from "../../config";
import { TrafficController, findIntersections } from "../../traffic";
import { Ground } from "./Ground";
import { City } from "./City";
import { World } from "./World";
import { Details } from "./Details";
import { Sidewalks } from "./Sidewalks";
import { Mountains, mountainOuterRadius } from "./Mountains";
import { People } from "./People";
import { Traffic } from "./Traffic";
import { Crossers } from "./Crossers";
import { SelectedBanner } from "./SelectedBanner";

export function Scene() {
  const { data } = useNeighborhood();
  const blocks = useMemo(
    () => (data ? layoutCity(data.projects) : []),
    [data],
  );
  const streets = useMemo(() => buildStreets(blocks), [blocks]);
  const extent = useMemo(() => mountainOuterRadius(blocks) + 6, [blocks]);
  const intersections = useMemo(() => findIntersections(streets), [streets]);
  const controller = useMemo(
    () => new TrafficController(intersections, traffic.cycle),
    [intersections],
  );

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
      <Sidewalks streets={streets} intersections={intersections} />
      <City />
      <World blocks={blocks} streets={streets} />
      <Details blocks={blocks} streets={streets} />
      <People />
      <Traffic streets={streets} intersections={intersections} controller={controller} />
      <Crossers streets={streets} intersections={intersections} controller={controller} />
      <Mountains blocks={blocks} />
      <SelectedBanner />
    </>
  );
}