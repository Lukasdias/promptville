import { useCity } from "../../city";
import { useActivityPump } from "../../activity";
import { Ground } from "./Ground";
import { Terrain } from "./Terrain";
import { City } from "./City";
import { World } from "./World";
import { Details } from "./Details";
import { Sidewalks } from "./Sidewalks";
import { Mountains } from "./Mountains";
import { People } from "./People";
import { Traffic } from "./Traffic";
import { Crossers } from "./Crossers";
import { CivicDistrict } from "./CivicDistrict";
import { SelectedBanner } from "./SelectedBanner";

export function Scene() {
  const {
    blocks,
    mainStreets,
    renderStreets,
    intersections,
    crosswalkIntersections,
    controller,
    graphWithCurbs,
    curbs,
    civic,
    extent,
    bounds,
  } = useCity();

  useActivityPump();

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
      <Terrain extent={extent} bounds={bounds} />
      <Ground blocks={blocks} streets={renderStreets} />
      <Sidewalks streets={renderStreets} intersections={crosswalkIntersections} />
      <City />
      <World blocks={blocks} streets={renderStreets} />
      <Details blocks={blocks} streets={renderStreets} />
      <CivicDistrict civic={civic} />
      <People />
      <Traffic
        streets={renderStreets}
        intersections={intersections}
        controller={controller}
        graph={graphWithCurbs}
        curbs={curbs}
        visitorPaths={civic?.visitorPaths ?? []}
        visitorBuildings={civic?.lots.map((l) => l.kind) ?? []}
      />
      <Crossers streets={mainStreets} intersections={intersections} controller={controller} />
      <Mountains blocks={blocks} streets={renderStreets} />
      <SelectedBanner />
    </>
  );
}