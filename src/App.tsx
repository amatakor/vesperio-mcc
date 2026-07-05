import { matchRoute } from "./routes";
import { itemById, constellationBySlug, vehicleBySlug } from "./lib/data";
import {
  HomePage,
  ItemPage,
  CategoryPage,
  RegistryIndexPage,
  ConstellationPage,
  VehiclePage,
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
    case "registry":
      return <RegistryIndexPage />;
    case "constellation":
      return <ConstellationPage profile={constellationBySlug(route.slug)!} />;
    case "vehicle":
      return <VehiclePage profile={vehicleBySlug(route.slug)!} />;
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
