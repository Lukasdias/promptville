import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/fredoka/600.css";
import "@fontsource/nunito/400.css";
import { useApp } from "./store";
import "./index.css";

function Probe() {
  const load = useApp((s) => s.load);
  const data = useApp((s) => s.data);
  const error = useApp((s) => s.error);
  useEffect(() => {
    void load();
  }, [load]);
  if (error) return <div className="p-4 text-red-600">{error}</div>;
  if (!data) return <div className="p-4">Loading…</div>;
  return (
    <div className="p-4">
      {data.stats.totalSessions} sessions / {data.projects.length} projects
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Probe />
  </StrictMode>,
);