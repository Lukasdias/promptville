import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Scene } from "./components/three/Scene";
import { Header } from "./components/hud/Header";
import { StatsPanel } from "./components/hud/StatsPanel";
import { DetailCard } from "./components/hud/DetailCard";
import { HintBar } from "./components/hud/HintBar";
import { MissingState } from "./components/hud/MissingState";

export default function App() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Canvas
        frameloop="demand"
        shadows
        camera={{ position: [0, 18, 26], fov: 50 }}
        className="h-full w-full"
      >
        <Scene />
        <OrbitControls
          enablePan
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.4}
          minDistance={6}
          maxDistance={80}
        />
      </Canvas>
      <Header />
      <StatsPanel />
      <DetailCard />
      <HintBar />
      <MissingState />
    </div>
  );
}