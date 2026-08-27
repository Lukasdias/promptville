import { useMemo } from "react";
import { useNeighborhood } from "../../query";
import { layoutCity } from "../../layout";
import { Ground } from "./Ground";
import { City } from "./City";
import { World } from "./World";
import { SelectedBanner } from "./SelectedBanner";

export function Scene() {
  const { data } = useNeighborhood();
  const blocks = useMemo(
    () => (data ? layoutCity(data.projects) : []),
    [data],
  );

  return (
    <>
      <color attach="background" args={["#aee6ff"]} />
      <fog attach="fog" args={["#aee6ff", 40, 110]} />
      <hemisphereLight intensity={0.9} groundColor="#cfe8b0" />
      <directionalLight
        position={[18, 30, 10]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={80}
        shadow-camera-left={-40}
        shadow-camera-right={40}
        shadow-camera-top={40}
        shadow-camera-bottom={-40}
      />
      <Ground blocks={blocks} />
      <City />
      <World />
      <SelectedBanner />
    </>
  );
}