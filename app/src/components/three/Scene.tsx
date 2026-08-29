import { useCity } from "../../city";
import { useActivityPump } from "../../activity";
import { Ground } from "./Ground";
import { Terrain } from "./Terrain";
import { Streets } from "./Streets";
import { City } from "./City";
import { ServiceRing } from "./ServiceRing";
import { Signals } from "./Signals";
import { World } from "./World";
import { Details } from "./Details";
import { Sidewalks } from "./Sidewalks";
import { Mountains } from "./Mountains";
import { People } from "./People";
import { Traffic } from "./Traffic";
import { Crossers } from "./Crossers";
import { CivicDistrict } from "./CivicDistrict";
import { SelectedBanner } from "./SelectedBanner";
import { Sky } from "./Sky";
import { CloudField } from "./CloudField";
import { Rain } from "./Rain";
import { DustMotes } from "./DustMotes";
import { GroundFog } from "./GroundFog";
import { LightingRig } from "./LightingRig";
import { LitWindows } from "./LitWindows";
import { HouseNightLights } from "./HouseNightLights";

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
      <Sky extent={extent} />
      <CloudField extent={extent} />
      <Rain />
      <DustMotes />
      <GroundFog />
      <LightingRig />
      <fog attach="fog" args={["#aee6ff", 40, 120]} />
      <Terrain extent={extent} bounds={bounds} />
      <Ground blocks={blocks} />
      <Streets streets={renderStreets} />
      <Sidewalks streets={renderStreets} intersections={crosswalkIntersections} />
      <City />
      <ServiceRing />
      <Signals />
      <LitWindows />
      <HouseNightLights />
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