import { useMemo } from "react";
import { useNeighborhood } from "../../query";
import { buildPerimeterRing, buildStreets, cityBounds, extendRoadsToRing, layoutCity } from "../../layout";
import { traffic } from "../../config";
import { TrafficController, findIntersections } from "../../traffic";
import { buildRoadGraph } from "../../roadgraph";
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

  // Visible roads = main grid + ring. The ring connects every dead end.
  const mainStreets = useMemo(() => buildStreets(blocks), [blocks]);
  const bounds = useMemo(() => cityBounds(blocks), [blocks]);
  const ring = useMemo(() => (bounds ? buildPerimeterRing(bounds) : []), [bounds]);
  const renderStreets = useMemo(() => (bounds ? [...mainStreets, ...ring] : []), [mainStreets, ring, bounds]);

  // Routing roads = streets extended to the ring so the graph has no dead ends.
  const graphStreets = useMemo(
    () => (bounds ? [...extendRoadsToRing(mainStreets, bounds), ...ring] : []),
    [mainStreets, bounds, ring],
  );

  const extent = useMemo(() => mountainOuterRadius(blocks, renderStreets) + 6, [blocks, renderStreets]);
  const intersections = useMemo(() => findIntersections(graphStreets), [graphStreets]);
  const crosswalkIntersections = useMemo(() => findIntersections(mainStreets), [mainStreets]);
  const controller = useMemo(
    () => new TrafficController(intersections, traffic.cycle),
    [intersections],
  );
  const graph = useMemo(
    () => buildRoadGraph(graphStreets, intersections),
    [graphStreets, intersections],
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
      <Ground blocks={blocks} streets={renderStreets} extent={extent} />
      <Sidewalks streets={renderStreets} intersections={crosswalkIntersections} />
      <City />
      <World blocks={blocks} streets={renderStreets} />
      <Details blocks={blocks} streets={renderStreets} />
      <People />
      <Traffic streets={renderStreets} intersections={intersections} controller={controller} graph={graph} />
      <Crossers streets={mainStreets} intersections={intersections} controller={controller} />
      <Mountains blocks={blocks} streets={renderStreets} />
      <SelectedBanner />
    </>
  );
}