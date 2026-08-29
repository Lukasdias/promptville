import { Canvas } from "@react-three/fiber";
import { Scene } from "./components/three/Scene";
import { CivCamera } from "./components/three/CivCamera";
import { Header } from "./components/hud/Header";
import { Clock } from "./components/hud/Clock";
import { StatsPanel } from "./components/hud/StatsPanel";
import { DetailCard } from "./components/hud/DetailCard";
import { HintBar } from "./components/hud/HintBar";
import { HelpPanel } from "./components/hud/HelpPanel";
import { TweakPanel } from "./components/hud/TweakPanel";
import { LegendCard } from "./components/hud/LegendCard";
import { LoadingState } from "./components/hud/LoadingState";
import { MissingState } from "./components/hud/MissingState";
import { Toasts } from "./components/hud/Toasts";
import { ChatSidebar } from "./components/hud/ChatSidebar";
import { NavigatorPanel } from "./components/navigator/NavigatorPanel";

export default function App() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Canvas
        frameloop="always"
        shadows
        camera={{ position: [0, 18, 26], fov: 50 }}
        className="h-full w-full"
      >
        <Scene />
        <CivCamera />
      </Canvas>
      <Header />
      <Clock />
      <NavigatorPanel />
      <ChatSidebar />
      <StatsPanel />
      <DetailCard />
      <HintBar />
      <HelpPanel />
      <TweakPanel />
      <LegendCard />
      <Toasts />
      <LoadingState />
      <MissingState />
    </div>
  );
}