import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
// IBM Plex Sans + IBM Plex Mono + Space Grotesk (OFL licensed) are
// self-hosted static-weight fonts, declared via @font-face in index.css
// and served from public/fonts/.
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
