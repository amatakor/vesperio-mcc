# Source terms and deferred checks: decision memo (S6, plan Phase 5)

Prepared 2026-07-11 by Claude Code from direct fetches (all URLs, methods, and timestamps listed per section). This memo closes the two mechanical items from REGISTRY_V2_PLAN.md section C4 and prepares the two judgment items for Florian's ruling. Nothing in this memo changes any gate by itself; the ready-to-apply configs below are inert until ruled on.

Verbatim quotes keep their sources' own punctuation; everything else follows house style.

---

## 1. NewSpace Index (newspace.im): RULING NEEDED

**Status quo:** GATED per CLAUDE.md. Discovery pointer to primary sources only; treated as press (SNR 3 provisional) if ever cited after Florian verifies the terms.

**What the site actually says.** There is no terms or license page reachable from the site's navigation, footer, or sitemap.xml. The only legal text is a "Disclaimer" page at `https://www.newspace.im/disclaimer` (updated 2024-01-06 per its own byline, built with the Termify template tool), found only by guessing the URL. Fetched 2026-07-11 07:07 UTC, HTTP 200. Its operative reuse clause, verbatim:

> "All intellectual property rights concerning these materials are vested in NewSpace Index. Copying, distribution and any other use of these materials is not permitted without the written permission of NewSpace Index, except and only to the extent otherwise provided in regulations of mandatory law (such as the right to quote), unless otherwise stated for certain materials."

It also disclaims accuracy, verbatim:

> "NewSpace Index is not responsible for any content, code or any other imprecision. NewSpace Index does not provide warranties or guarantees."

Site identity: "© Made by Erik Kulu, 2016-2026", contact erik.kulu@newspace.im. Single maintainer, as the original research assumed.

**Recommendation: keep the gate closed (option B below).** The only discoverable terms text forbids reuse beyond mandatory-law quotation without written permission. Citing a fact with a link is arguably within the quotation right, but the site's own accuracy disclaimer plus the single-maintainer press-tier classification mean it would enter at SNR 3 provisional at best, and everything it covers has primary sources it already points to. The clean options:

- **Option A (accept as press-tier citable):** requires either relying on the quotation right or written permission from Erik Kulu. Ready-to-apply config: none needed in sources.json (it is a registry reference, not a feed); the change is removing the GATED sentence from CLAUDE.md's aggregator edge-case list and allowing `newspace.im` as a press-class (SNR 3 provisional) source URL in registry fields.
- **Option B (keep gated, recommended):** no config change. CLAUDE.md wording stays. Discovery-pointer use continues (following its links to primary sources involves no reuse of its content).
- **Option C (write for permission):** email erik.kulu@newspace.im asking for citation permission with attribution; flip to Option A on a yes.

## 2. CelesTrak (celestrak.org): RULING NEEDED (recommend: continue current use, tighten one thing)

**Status quo:** the orbits pipeline fetches CelesTrak element sets twice daily (update-orbits.yml, deterministic scripts, backoff on errors); registry satellite counts are CelesTrak-derived ("cataloged on orbit" figures).

**What the policy actually says.** `https://celestrak.org/usage-policy.php` (byline "by Dr. T.S. Kelso — 2026 May 15 — Updated 2026 May 22"; fetched 2026-07-11 07:09 UTC, HTTP 200) is a fair-use and rate-limiting document for automated queries, not a redistribution license. Key verbatim lines:

> "Only download the data you need, when you are going to use it, and only download data once per update."

> "M2M (machine-to-machine) software should immediately stop querying when it receives any non-HTTP 200 responses and report the results to a human for investigation. Repeatedly ignoring them will end up sending your IP address to the firewall."

> "Bottom line: There is no way for CelesTrak to set up a system to manage millions of users without having to charge for access, which would immediately break our long tradition of making data freely available to all users."

No clause on redistribution, required citation, copyright, or license was found on the usage-policy page, the webmaster page, or the GP-data-formats compliance page it references (searched for "redistribut-", "cite", "credit", "attribut-", "copyright", "license"; zero hits beyond one more "freely available to all users").

**Material robots.txt finding.** `https://celestrak.org/robots.txt` (fetched 2026-07-11) names `claudebot` for a site-wide disallow:

```
User-agent: claudebot
Disallow: /
```

The wildcard rule does not block the site root but does block the CSV/TLE query endpoints and several data paths for all crawlers.

**Recommendation: continue the current deterministic use; codify two constraints.** The data is stated to be freely available; our twice-daily fetch with error backoff already sits far inside the policy's cadence guidance (element sets update at most every 2 hours). The two constraints worth making explicit in CLAUDE.md's edge-case list on a yes ruling: (a) CelesTrak is fetched ONLY by the deterministic orbits scripts, never by agent tools (the robots.txt claudebot line makes agent fetching off-limits regardless of which UA our tools present; the current design already conforms), and (b) any non-200 response stops the run's remaining CelesTrak queries, per the policy's M2M instruction (fetch-elements.ts already backs off; verify the stop-on-error behavior matches "immediately stop querying" when touching that script next). Ready-to-apply: one sentence in CLAUDE.md edge cases; no sources.json change (CelesTrak is not a news source).

## 3. GCAT field semantics: CLOSED (confirmed, ingestion path unblocked)

**Question (C4):** do GCAT's records cleanly separate satellite-level anomalies and decays from launch failures, so decay ingestion for incident timelines cannot conflate the two?

**Answer: yes, at the catalog level.** GCAT partitions by catalog file before any status field. Verbatim, from `https://planet4589.org/space/gcat/web/cat/cats.html`:

> "The ftocat (F, Failure to orbit catalog) contains objects from failed launches which were expected to have had satellite catalog entries if the launch had been successful."

satcat (JCAT prefix `S`) holds only objects that reached orbit and carry real US SATCAT numbers ("Sequence numbers in the S catalog are in one-to-one correspondence with the US SATCAT catalog numbers", per `https://planet4589.org/space/gcat/web/intro/jcat.html`). An orbited object's later fate is recorded on its satcat row via `Status` plus `DDate` ("This field gives the event that ends the current phase." / "In the simplest cases, it is the time when the object reentered the atmosphere.", per `https://planet4589.org/space/gcat/web/cat/cols.html`).

**Empirical spot-check (2026-07-11, this session):** downloaded `https://planet4589.org/space/gcat/tsv/cat/satcat.tsv` (69,975 data rows) and counted every `Status` value. The launch-failure status `F` appears ZERO times in satcat; the population is decay and orbit statuses (R 33,028; O 32,544; OX 1,142; L 1,074; DK 473; plus smaller classes). This closes the one inference the documentation research flagged: satcat and launch failures do not mix even at the row level.

**The unblocked ingestion filter, stated plainly:** ingest satellite-level incident events from satcat only (the `satcat.tsv` file), rows with `Status` in {R, D, C, E, AR, OX} and a populated `DDate`; never read `ftocat.tsv` for this purpose (it is definitionally launch failures); treat auxcat/lcat/rcat (marginal orbit, pad explosion, suborbital) as out of scope. Render the McDowell citation wherever the figures appear; GCAT's attribution notice, verbatim from the GCAT root page: "This data may be freely reproduced as long as you cite it." Full citation form: "McDowell, J, 2020: General Catalog of Artificial Space Objects, https://planet4589.org/space/gcat".

**Implementation deferred with reason:** wiring GCAT decays into enrich-incidents.ts is a registry enrichment feature (satcat is a 70k-row file; it needs constellation matching design and a fetch budget), not a source-health fix. The blocker this phase was asked to remove is removed; the filter above is the spec for the enrichment PR that builds it.

## 4. eoPortal ICEYE page: CLOSED (re-verified)

The 2026-07-09 verification holds as of 2026-07-11 07:09 UTC. The bare `/satellite-missions/iceye` slug remains a soft-404 (HTTP 200, 152 characters of visible text, site chrome only). The real page `/satellite-missions/iceye-constellation` returns 101,379 characters of mission content with concrete figures (verbatim samples: "Each ICEYE spacecraft has a mass of 85 kg", "spatial resolutions between 1 and 15 m", "inclination of approximately 97.7°"), a page-level "Last updated: May 17, 2026" stamp, and a field-level dated status note ("As of January 2026, ICEYE has launched over 60 satellites"). Both C4 conditions (page is real, figures extractable with dated status notes) are met; ICEYE citations from this page were and remain valid under the existing eoPortal rules (cite facts and deep-link only, never copy prose).

## 5. Curl-only source re-inclusion (standing item 2): status per source

- **SEC EDGAR (13 ticker feeds):** already re-included before this phase; the deterministic harvester fetches all of them (its UA satisfies SEC's identification requirement) and the 2026-07-11 06:43 run's health block shows all 13 fetching clean.
- **NASASpaceflight (RSS):** same; harvested clean in the same run.
- **UNOOSA:** re-included this PR. Finding: UNOOSA's own press archive on unoosa.org stopped updating in June 2023 (newest UNIS-numbered release dated "VIENNA, 8 June 2023"); the live listing is hosted by UN Information Service Vienna at `https://unis.unvienna.org/unis/en/pr/press-releases-unoosa.html` (server-rendered, per-entry machine-readable dates, newest entry 2026-06-10, no robots.txt on the host). WebFetch cannot read it (404 to that fetcher), so it joins the deterministic harvester as the new `html_listing` feed type.
- **Rocket Lab:** honest failure, closed. The 2026-07-11 probe found every path on rocketlabcorp.com behind a Cloudflare JS challenge (including sitemap.xml) and investors.rocketlabcorp.com timing out behind Akamai Bot Manager, both even from a residential IP with a browser UA; GitHub-hosted runners fare worse. No RSS/JSON endpoint exists. A fetch_note now stops the agent burning fetches on it; Rocket Lab's material events arrive deterministically via its SEC EDGAR 8-K feed plus Launch Library and trade press.
- **Vantor: RULING NEEDED.** The news-bureau page is client-rendered (nav and footer only to every non-browser fetcher). The probe found the site's own public, unauthenticated Sanity CMS content API (project id visible in the page's inline config; `perspective=published` parameter required to exclude drafts) returning clean current JSON (newest item 2026-07-08). This is the same data the page itself loads, but it is a headless-CMS backend, not a published feed: it can change or close without notice and using it is a judgment call about politeness rather than capability. Options: (A) wire it into the harvester as api_json with a note, accepting breakage risk; (B, recommended) leave the fetch_note in place and let Vantor stories arrive via trade and wire coverage, revisiting if Vantor publishes a real feed; (C) email Vantor comms asking for an RSS endpoint. On a yes, the endpoint is re-derived in one minute from the news-bureau page's inline config (deliberately not reproduced here: publishing another company's internal CMS coordinates in this repo would be poor form) and wired as an api_json source in one commit.

## Summary of rulings requested from Florian

| # | Source | Question | Recommendation |
|---|---|---|---|
| 1 | NewSpace Index | accept as citable press-tier, keep gated, or ask permission | keep gated (B) |
| 2 | CelesTrak | continue deterministic-only use under the fair-use policy | yes, plus codify agent-never-fetches and stop-on-error in CLAUDE.md |
| 3 | Vantor | use the site's Sanity CMS backend as a feed | no for now (B); revisit if a real feed appears |

Items 3 (GCAT) and 4 (eoPortal ICEYE) of C4 are closed with evidence above and need no ruling.
