import { matchRoute } from "./routes";
import {
  itemById,
  constellationBySlug,
  vehicleBySlug,
  spaceportBySlug,
  orgBySlug,
} from "./lib/data";
import {
  HomePage,
  ItemPage,
  CategoryPage,
  TagPage,
  RegistryIndexPage,
  ConstellationPage,
  VehiclePage,
  SpaceportPage,
  OrgPage,
  SignalsPage,
  StatsPage,
  AboutPage,
  LogPage,
  NotFoundPage,
} from "./pages";

export default function App({ path, generatedAt }: { path: string; generatedAt: string }) {
  const route = matchRoute(path);
  switch (route.page) {
    case "home":
      return <HomePage />;
    case "item":
      return <ItemPage item={itemById(route.id)!} />;
    case "category":
      return <CategoryPage category={route.category} />;
    case "tag":
      return <TagPage tag={route.tag} />;
    case "registry":
      return <RegistryIndexPage />;
    case "constellation":
      return <ConstellationPage profile={constellationBySlug(route.slug)!} />;
    case "vehicle":
      return <VehiclePage profile={vehicleBySlug(route.slug)!} />;
    case "spaceport":
      return <SpaceportPage profile={spaceportBySlug(route.slug)!} />;
    case "org":
      return <OrgPage profile={orgBySlug(route.slug)!} />;
    case "signals":
      return <SignalsPage />;
    case "stats":
      return <StatsPage generatedAt={generatedAt} />;
    case "about":
      return <AboutPage />;
    case "log":
      return <LogPage />;
    case "not-found":
      return <NotFoundPage />;
  }
}
