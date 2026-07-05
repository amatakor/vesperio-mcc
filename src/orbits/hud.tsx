/**
 * HUD panels for the Orbits stage: the layers legend and the data
 * freshness panel. Purely presentational, driven entirely by props;
 * the scene integrator owns state, worker wiring, and CSS import.
 */

import type { ConstellationDomain } from "../data/schema";

export interface LegendConstellation {
  slug: string;
  name: string;
  category: ConstellationDomain;
  /** CSS custom property name for the category neon, e.g. "--neon-eo". */
  colorToken: string;
  enabled: boolean;
  status: "ok" | "loading" | "stale" | "missing";
  /** Satellites loaded, null before load. */
  count: number | null;
}

export interface LayersPanelProps {
  constellations: LegendConstellation[];
  selectedSlug: string | null;
  onToggleConstellation(slug: string): void;
  onSelectConstellation(slug: string | null): void;
  spaceportsOn: boolean;
  onToggleSpaceports(): void;
  facilitiesOn: boolean;
  onToggleFacilities(): void;
}

const CATEGORY_ORDER: ConstellationDomain[] = ["eo", "connectivity", "iot", "human-spaceflight"];

const CATEGORY_LABELS: Record<ConstellationDomain, string> = {
  eo: "EO",
  connectivity: "CONNECTIVITY",
  iot: "IOT",
  "human-spaceflight": "HUMAN SPACEFLIGHT",
};

function statusSuffix(c: LegendConstellation): string {
  switch (c.status) {
    case "ok":
      return c.count !== null ? String(c.count) : "";
    case "loading":
      return "...";
    case "stale":
      return "STALE";
    case "missing":
      return "NO DATA";
    default:
      return "";
  }
}

export function LayersPanel(props: LayersPanelProps) {
  const {
    constellations,
    selectedSlug,
    onToggleConstellation,
    onSelectConstellation,
    spaceportsOn,
    onToggleSpaceports,
    facilitiesOn,
    onToggleFacilities,
  } = props;

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: constellations.filter((c) => c.category === category),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="opanel olayers">
      <div className="opanel-title">LAYERS</div>
      {groups.map((group) => (
        <div className="ogroup" key={group.category}>
          <div className="ogroup-head">
            <span
              className="oswatch"
              style={{ background: `var(${CATEGORY_TOKEN_FOR(group.items)})` }}
              aria-hidden="true"
            />
            <span className="ogroup-label">{CATEGORY_LABELS[group.category]}</span>
          </div>
          {group.items.map((c) => {
            const selected = selectedSlug === c.slug;
            return (
              <div key={c.slug} className={`orow${selected ? " orow-selected" : ""}`}>
                <button
                  type="button"
                  className="ocheck"
                  aria-pressed={c.enabled}
                  aria-label={`Toggle ${c.name} layer`}
                  onClick={() => onToggleConstellation(c.slug)}
                >
                  {c.enabled ? "[x]" : "[ ]"}
                </button>
                <button
                  type="button"
                  className="oname"
                  onClick={() => onSelectConstellation(selected ? null : c.slug)}
                >
                  {c.name}
                </button>
                <span className="ostatus">{statusSuffix(c)}</span>
              </div>
            );
          })}
        </div>
      ))}
      <div className="odivider" />
      <div className="orow">
        <button
          type="button"
          className="ocheck"
          aria-pressed={spaceportsOn}
          aria-label="Toggle spaceports layer"
          onClick={onToggleSpaceports}
        >
          {spaceportsOn ? "[x]" : "[ ]"}
        </button>
        <span className="oname otoggle-label">SPACEPORTS</span>
      </div>
      <div className="orow">
        <button
          type="button"
          className="ocheck"
          aria-pressed={facilitiesOn}
          aria-label="Toggle facilities and HQs layer"
          onClick={onToggleFacilities}
        >
          {facilitiesOn ? "[x]" : "[ ]"}
        </button>
        <span className="oname otoggle-label">FACILITIES &amp; HQS</span>
      </div>
    </div>
  );
}

/** All items in a group share one category, hence one color token. */
function CATEGORY_TOKEN_FOR(items: LegendConstellation[]): string {
  return items[0]?.colorToken ?? "--neon-reserve";
}

export interface DataPanelEntry {
  label: string;
  fetchedAt: string | null;
  stale: boolean;
}

export interface DataPanelProps {
  entries: DataPanelEntry[];
}

function formatFetchedAt(iso: string | null): string {
  if (!iso) return "UNAVAILABLE";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "UNAVAILABLE";
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getUTCFullYear();
  const mo = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const h = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  return `${y}-${mo}-${day} ${h}:${mi} UTC`;
}

export function DataPanel(props: DataPanelProps) {
  const { entries } = props;
  const anyStale = entries.some((e) => e.stale);
  return (
    <div className="opanel odata">
      <div className="opanel-title">DATA</div>
      {entries.map((entry) => (
        <div className="okv" key={entry.label}>
          <div className="okv-label">{entry.label.toUpperCase()}</div>
          <div className="okv-value">{formatFetchedAt(entry.fetchedAt)}</div>
        </div>
      ))}
      {anyStale ? (
        <div className="ostale">ELEMENTS OLDER THAN 7 DAYS - POSITIONS MAY DRIFT</div>
      ) : null}
    </div>
  );
}
