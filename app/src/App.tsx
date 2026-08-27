import { useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Scene } from "./components/three/Scene";
import { useApp } from "./store";

export default function App() {
  const load = useApp((s) => s.load);
  useEffect(() => {
    void load();
  }, [load]);

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
    </div>
  );
}