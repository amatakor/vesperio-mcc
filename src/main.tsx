import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import { matchRoute } from "./routes";
import type { PageData } from "./lib/page-data";
// IBM Plex Sans + IBM Plex Mono + Space Grotesk (OFL licensed) are
// self-hosted static-weight fonts, declared via @font-face in index.css
// and served from public/fonts/.
import "./index.css";

const container = document.getElementById("root")!;
const generatedAt = container.dataset.generatedAt ?? new Date().toISOString();

/**
 * Prerendered pages embed their data slice as a JSON script tag; the
 * client bundle carries no dataset. The dev server has no prerender
 * step, so dev builds the slice in the browser from the full dataset;
 * the import.meta.env.DEV guard removes that path (and the dataset)
 * from production builds.
 */
function embeddedPageData(): PageData | null {
  const el = document.getElementById("__MCC_DATA__");
  if (!el?.textContent) return null;
  try {
    return JSON.parse(el.textContent) as PageData;
  } catch {
    return null;
  }
}

async function start(): Promise<void> {
  let pageData = embeddedPageData();
  if (pageData === null && import.meta.env.DEV) {
    const server = await import("./lib/page-data-server");
    pageData = server.buildPageData(matchRoute(window.location.pathname), generatedAt);
  }

  const app = (
    <StrictMode>
      <App path={window.location.pathname} generatedAt={generatedAt} pageData={pageData} />
    </StrictMode>
  );

  // Prerendered pages hydrate; the dev server renders from scratch.
  if (container.hasChildNodes()) {
    hydrateRoot(container, app);
  } else {
    createRoot(container).render(app);
  }
}

void start();
