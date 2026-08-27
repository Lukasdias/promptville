import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/fredoka/600.css";
import "@fontsource/nunito/400.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="font-body text-neutral-800">Promptville scaffold</div>
  </StrictMode>,
);