import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
// Structural mono for the whole site (6A design handoff, OFL licensed).
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "@fontsource/ibm-plex-mono/latin-700.css";
import "./index.css";

const container = document.getElementById("root")!;
const generatedAt = container.dataset.generatedAt ?? new Date().toISOString();
const app = (
  <StrictMode>
    <App path={window.location.pathname} generatedAt={generatedAt} />
  </StrictMode>
);

// Prerendered pages hydrate; the dev server renders from scratch.
if (container.hasChildNodes()) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}
