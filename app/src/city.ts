import { useNeighborhood } from "./query";
import {
  buildPerimeterRing,
  buildStreets,
  cityBounds,
  CIVIC_PLAZA,
  extendRoadsToRing,
  layoutCity,
  type Bounds,
  type PlacedBlock,
  type Street,
} from "./layout";
import { traffic } from "./config";
import { TrafficController, findIntersections, type Intersection } from "./traffic";
import { attachCurbs, buildRoadGraph, type Curb, type RoadGraph } from "./roadgraph";
import { layoutCivicDistrict, type CivicDistrict } from "./civic";
import { mountainOuterRadius } from "./components/three/Mountains";

export interface CityLayout {
  blocks: PlacedBlock[];
  plazaBlock: PlacedBlock | null;
  bounds: Bounds | null;
  mainStreets: Street[];
  renderStreets: Street[];
  graphStreets: Street[];
  intersections: Intersection[];
  crosswalkIntersections: Intersection[];
  controller: TrafficController;
  graph: RoadGraph;
  civic: CivicDistrict | null;
  graphWithCurbs: RoadGraph;
  curbs: Curb[];
  extent: number;
}

// Single source of truth for the town geometry. Every component derives its
// coordinates from this one layout so click/focus targets always match the
// rendered scene. React Compiler memoizes the derivation per data load; no
// manual useMemo or context needed.
export function useCity(): CityLayout {
  const { data } = useNeighborhood();
  const projects = data?.projects ?? [];

  const blocks = layoutCity(projects, { plaza: CIVIC_PLAZA });
  const plazaBlock = blocks.find((b) => b.kind === "plaza") ?? null;
  const mainStreets = buildStreets(blocks);
  const bounds = cityBounds(blocks);
  const ring = bounds ? buildPerimeterRing(bounds) : [];
  // Render the extended network so every street reaches its avenue/junction —
  // no mid-town dead-end gaps (the traffic graph already uses the same network).
  const renderStreets = bounds ? [...extendRoadsToRing(mainStreets, bounds), ...ring] : [];
  const graphStreets = bounds ? [...extendRoadsToRing(mainStreets, bounds), ...ring] : [];
  const extent = mountainOuterRadius(blocks, renderStreets) + 6;

  const intersections = findIntersections(graphStreets);
  const crosswalkIntersections = findIntersections(mainStreets);
  const controller = new TrafficController(intersections, traffic.cycle);
  const graph = buildRoadGraph(graphStreets, intersections);
  const civic =
    plazaBlock && graph.nodes.length > 0
      ? layoutCivicDistrict(plazaBlock, graphStreets, graph)
      : null;
  const { graph: graphWithCurbs, curbs } = civic
    ? attachCurbs(graph, civic.lots.map((l) => ({ buildingId: l.kind, x: l.curb.x, z: l.curb.z })))
    : { graph, curbs: [] as Curb[] };

  return {
    blocks,
    plazaBlock,
    bounds,
    mainStreets,
    renderStreets,
    graphStreets,
    intersections,
    crosswalkIntersections,
    controller,
    graph,
    civic,
    graphWithCurbs,
    curbs,
    extent,
  };
}