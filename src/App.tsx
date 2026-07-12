import { matchRoute } from "./routes";
import type { PageData } from "./lib/page-data";
import {
  HomePage,
  FeedPagePage,
  ItemPage,
  CategoryPage,
  TagPage,
  KindPage,
  OrbitsPage,
  RegistryIndexPage,
  ConstellationPage,
  VehiclePage,
  SpaceportPage,
  OrgPage,
  SignalsPage,
  SystemPage,
  AboutPage,
  DigestPage,
  LogArchivePage,
  NotFoundPage,
} from "./pages";

/**
 * Routing is shape-only; the page's DATA decides whether the entity
 * exists. pageData comes from the embedded #__MCC_DATA__ slice (or the
 * dev-only in-browser builder); a well-shaped URL with no matching data
 * renders NotFound, mirroring what the prerenderer never emitted.
 */
export default function App({
  path,
  generatedAt,
  pageData,
}: {
  path: string;
  generatedAt: string;
  pageData: PageData | null;
}) {
  const route = matchRoute(path);
  const d = pageData;
  switch (route.page) {
    case "home":
      return d?.page === "home" ? <HomePage data={d} /> : <NotFoundPage />;
    case "feed-page":
      return d?.page === "feed-page" ? <FeedPagePage data={d} /> : <NotFoundPage />;
    case "item":
      return d?.page === "item" ? <ItemPage item={d.item} /> : <NotFoundPage />;
    case "category":
      return d?.page === "category" ? <CategoryPage data={d} /> : <NotFoundPage />;
    case "tag":
      return d?.page === "tag" ? <TagPage data={d} /> : <NotFoundPage />;
    case "kind":
      return d?.page === "kind" ? <KindPage data={d} /> : <NotFoundPage />;
    case "orbits":
      return d?.page === "orbits" ? <OrbitsPage data={d} /> : <NotFoundPage />;
    case "registry":
      return d?.page === "registry" ? <RegistryIndexPage data={d} /> : <NotFoundPage />;
    case "constellation":
      return d?.page === "constellation" ? <ConstellationPage data={d} /> : <NotFoundPage />;
    case "vehicle":
      return d?.page === "vehicle" ? <VehiclePage data={d} /> : <NotFoundPage />;
    case "spaceport":
      return d?.page === "spaceport" ? <SpaceportPage data={d} /> : <NotFoundPage />;
    case "org":
      return d?.page === "org" ? <OrgPage data={d} /> : <NotFoundPage />;
    case "signals":
      return d?.page === "signals" ? <SignalsPage data={d} /> : <NotFoundPage />;
    case "about":
      return <AboutPage />;
    case "digest":
      return d?.page === "digest" ? <DigestPage data={d} /> : <NotFoundPage />;
    case "system":
      return d?.page === "system" ? <SystemPage data={d} generatedAt={generatedAt} /> : <NotFoundPage />;
    case "log-archive":
      return d?.page === "log-archive" ? <LogArchivePage data={d} /> : <NotFoundPage />;
    case "not-found":
      return <NotFoundPage />;
  }
}
