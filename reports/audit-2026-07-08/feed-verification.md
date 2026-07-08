# Feed verification pass (EXECUTION_PLAN 1.2) - 2026-07-08

Method: every existing sources.json entry, every candidate feed from external-research.md section 1, plus conventional-path guesses and SWEEP_MEMORY replacement URLs, fetched with a deterministic bun script (2 attempts max, UA "VesperioMCC-Sweep contact@vesperio.ai", 25s timeout). Feed-path discovery for hub-based sources ran as a delegated agent pass; every agent-reported feed was re-verified by the deterministic script before being trusted. Verdict rule: usable = HTTP 200 + parses as RSS/Atom/JSON + newest entry under 30 days old (guards stale mirrors).

| Source | URL | HTTP | Format | Newest entry | Verdict | Note |
|---|---|---|---|---|---|---|
| AST SpaceMobile feed guess | https://ast-science.com/feed/ | 200 | rss | 2026-06-17 | usable |  |
| BlackSky IR | https://ir.blacksky.com/rss/pressrelease.aspx | 200 | rss | 2026-07-07 | usable |  |
| CGTN Tech-Sci | https://www.cgtn.com/subscribe/rss/section/tech-sci.xml | 200 | rss | 2026-07-07 | usable |  |
| ESA Human and Robotic Exploration | https://www.esa.int/rssfeed/Science_Exploration/Human_and_Robotic_Exploration | 200 | rss | 2026-07-03 | usable |  |
| ESA Navigation | https://www.esa.int/rssfeed/Applications/Navigation | 200 | rss | 2026-06-23 | usable |  |
| ESA Observing the Earth | https://www.esa.int/rssfeed/Applications/Observing_the_Earth | 200 | rss | 2026-07-07 | usable |  |
| ESA Space Transportation | https://www.esa.int/rssfeed/Enabling_Support/Space_Transportation | 200 | rss | 2026-07-03 | usable |  |
| ESA TopNews RSS | https://www.esa.int/rssfeed/TopNews | 200 | rss | 2026-07-07 | usable |  |
| European Spaceflight | https://europeanspaceflight.com/feed/ | 200 | rss | 2026-07-07 | usable |  |
| Federal Register API: FAA | https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions%5Bagencies%5D%5B%5D=federal-aviation-administration | 200 | json | 2026-07-07 | usable |  |
| Federal Register API: FCC | https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions%5Bagencies%5D%5B%5D=federal-communications-commission | 200 | json | 2026-07-06 | usable |  |
| Federal Register API: NOAA | https://www.federalregister.gov/api/v1/documents.json?per_page=20&order=newest&conditions%5Bagencies%5D%5B%5D=national-oceanic-and-atmospheric-administration | 200 | json | 2026-07-07 | usable |  |
| Firefly feed guess | https://fireflyspace.com/feed/ | 200 | rss | 2026-07-07 | usable |  |
| JAXA press RDF | https://global.jaxa.jp/rss/press.rdf | 200 | rdf | 2026-07-07 | usable |  |
| Kineis feed guess | https://www.kineis.com/en/feed/ (final: https://kineis.com/en/feed/) | 200 | rss | 2026-07-03 | usable |  |
| Launch Library 2 (TheSpaceDevs) | https://ll.thespacedevs.com/2.2.0/launch/upcoming/ | 200 | json | 2026-07-14 | usable |  |
| Myriota feed guess | https://myriota.com/feed/ | 200 | rss | 2026-07-01 | usable |  |
| NASASpaceflight | https://www.nasaspaceflight.com/feed/ | 200 | rss | 2026-07-06 | usable |  |
| Office of Space Commerce feed guess | https://space.commerce.gov/feed/ | 200 | rss | 2026-06-25 | usable |  |
| Payload | https://payloadspace.com/feed/ | 200 | rss | 2026-07-07 | usable |  |
| Planet Labs IR | https://investors.planet.com/rss/pressrelease.aspx | 200 | rss | 2026-07-07 | usable |  |
| Redwire IR | https://ir.rdw.com/news-events/press-releases/rss | 200 | rss | 2026-06-30 | usable |  |
| SEC EDGAR 8-K feed: ASTS | https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=ASTS&type=8-K&output=atom | 200 | atom | 2026-07-07 | usable |  |
| SEC EDGAR 8-K feed: BKSY | https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=BKSY&type=8-K&output=atom | 200 | atom | 2026-07-07 | usable |  |
| SEC EDGAR 8-K feed: GSAT | https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=GSAT&type=8-K&output=atom | 200 | atom | 2026-07-07 | usable |  |
| SEC EDGAR 8-K feed: IRDM | https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=IRDM&type=8-K&output=atom | 200 | atom | 2026-07-07 | usable |  |
| SEC EDGAR 8-K feed: PL | https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=PL&type=8-K&output=atom | 200 | atom | 2026-07-07 | usable |  |
| SEC EDGAR 8-K feed: RDW | https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=RDW&type=8-K&output=atom | 200 | atom | 2026-07-07 | usable |  |
| SEC EDGAR 8-K feed: RKLB | https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=RKLB&type=8-K&output=atom | 200 | atom | 2026-07-07 | usable |  |
| SEC EDGAR 8-K feed: SATL | https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=SATL&type=8-K&output=atom | 200 | atom | 2026-07-07 | usable |  |
| SEC EDGAR 8-K feed: SATS | https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=SATS&type=8-K&output=atom | 200 | atom | 2026-07-07 | usable |  |
| SEC EDGAR 8-K feed: SPIR | https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=SPIR&type=8-K&output=atom | 200 | atom | 2026-07-07 | usable |  |
| SEC EDGAR 8-K feed: VSAT | https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=VSAT&type=8-K&output=atom | 200 | atom | 2026-07-07 | usable |  |
| SpaceflightNow | https://spaceflightnow.com/feed/ | 200 | rss | 2026-07-06 | usable |  |
| SpaceNews | https://spacenews.com/feed/ | 200 | rss | 2026-07-07 | usable |  |
| SpacePolicyOnline | https://spacepolicyonline.com/feed/ | 200 | rss | 2026-07-05 | usable |  |
| Spire IR | https://ir.spire.com/news-events/press-releases/rss | 200 | rss | 2026-06-24 | usable |  |
| Synspective feed guess | https://synspective.com/feed/ | 200 | rss | 2026-07-06 | usable |  |
| Via Satellite | https://www.satellitetoday.com/feed/ | 200 | rss | 2026-07-07 | usable |  |
| Astrocast feed guess | https://www.astrocast.com/feed/ | 200 | rss | 2024-04-04 | stale |  |
| ESA Telecom | https://www.esa.int/rssfeed/Applications/Telecommunications_Integrated_Applications | 200 | rss | 2026-05-29 | stale |  |
| RFA feed guess | https://www.rfa.space/feed/ | 200 | rss | 2026-03-06 | stale |  |
| Telesat feed guess | https://www.telesat.com/feed/ | 200 | rss | - | stale |  |
| Airbus Defence and Space | https://www.airbus.com/en/newsroom/press-releases | 200 | html | - | not_a_feed |  |
| Amazon / Project Kuiper News | https://www.aboutamazon.com/news/tag/project-kuiper (final: https://www.aboutamazon.com/news/tag/amazon-leo) | 200 | html | - | not_a_feed |  |
| Arianespace (newsroom.arianespace.com) | https://newsroom.arianespace.com/ (final: https://newsroom.arianespace.com/en/?lang=eng) | 200 | html | - | not_a_feed |  |
| AST SpaceMobile News | https://ast-science.com/news/ (final: https://ast-science.com/blog/) | 200 | html | - | not_a_feed |  |
| Axiom Space News | https://www.axiomspace.com/news (final: https://www.axiomspace.com/newsroom) | 200 | html | - | not_a_feed |  |
| BlackSky (/news/) | https://www.blacksky.com/news/ (final: https://blacksky.com/company/news/) | 200 | html | - | not_a_feed |  |
| Capella (/news) | https://www.capellaspace.com/news | 200 | html | - | not_a_feed |  |
| CASC news (China Aerospace) | http://english.spacechina.com/ (final: https://english.spacechina.com/) | 200 | html | - | not_a_feed |  |
| CGSTL / Chang Guang | http://www.jl1.cn/ | 200 | html | - | not_a_feed |  |
| CNES press (FR) | https://presse.cnes.fr/fr (final: https://cnes.fr/presse) | 200 | html | - | not_a_feed |  |
| DLR press (DE) | https://www.dlr.de/de/aktuelles/nachrichten | 200 | html | - | not_a_feed |  |
| ESA Open Invitations (esa-star) | https://esastar-publication-ext.sso.esa.int/ | 200 | html | - | not_a_feed |  |
| EUSPA procurement | https://www.euspa.europa.eu/opportunities/procurement (final: https://www.euspa.europa.eu/opportunities/procurement-grants/procurement) | 200 | html | - | not_a_feed |  |
| EUSPA procurement (new path) | https://www.euspa.europa.eu/opportunities/procurement-grants/procurement | 200 | html | - | not_a_feed |  |
| FCC IBFS (satellite filings) | https://fcc.report/IBFS/ | 200 | html | - | not_a_feed |  |
| Firefly Aerospace | https://fireflyspace.com/news/ | 200 | html | - | not_a_feed |  |
| GHGSat | https://www.ghgsat.com/en/newsroom/ | 200 | html | - | not_a_feed |  |
| Gunter's Space Page | https://space.skyrocket.de/ | 200 | html | - | not_a_feed |  |
| HawkEye 360 | https://www.he360.com/newsroom/ | 200 | html | - | not_a_feed |  |
| ICEYE | https://www.iceye.com/press (final: https://www.iceye.com/newsroom) | 200 | html | - | not_a_feed |  |
| Isar Aerospace (/newsroom) | https://www.isaraerospace.com/newsroom (final: https://isaraerospace.com/newsroom) | 200 | html | - | not_a_feed |  |
| ITU Space Network filings (SNL) | https://www.itu.int/ITU-R/space/snl/ (final: https://www.itu.int/space-networks-hub/) | 200 | html | - | not_a_feed |  |
| JAXA / MHI | https://global.jaxa.jp/press/ | 200 | html | - | not_a_feed |  |
| Kineis | https://www.kineis.com/en/news/ (final: https://kineis.com/en/news/) | 200 | html | - | not_a_feed |  |
| Maxar Intelligence | https://www.maxar.com/press-releases (final: https://vantor.com/blog/) | 200 | html | - | not_a_feed |  |
| Myriota | https://myriota.com/news/ | 200 | html | - | not_a_feed |  |
| NextSpaceflight | https://nextspaceflight.com/launches/ | 200 | html | - | not_a_feed |  |
| NGA contract announcements | https://www.nga.mil/news/Contract_Announcements.html | 200 | html | - | not_a_feed |  |
| NOAA CRSRA via space.commerce.gov | https://space.commerce.gov/regulations/commercial-remote-sensing-regulatory-affairs/ | 200 | html | - | not_a_feed |  |
| OQ Technology | https://www.oqtec.com/news | 200 | html | - | not_a_feed |  |
| Payload | https://payloadspace.com/ | 200 | html | - | not_a_feed |  |
| Pixxel | https://www.pixxel.space/newsroom | 200 | html | - | not_a_feed |  |
| Planet Labs | https://www.planet.com/pulse/ | 200 | html | - | not_a_feed |  |
| Rocket Lab | https://rocketlabcorp.com/updates/ | 200 | html | - | not_a_feed |  |
| SAM.gov (space/EO NAICS filters) | https://sam.gov/search/ | 200 | html | - | not_a_feed |  |
| Satellogic | https://satellogic.com/news/ | 200 | html | - | not_a_feed |  |
| SEC EDGAR 8-K feed: LUNR | https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=LUNR&type=8-K&output=atom | 200 | html | - | not_a_feed |  |
| SES Press Releases | https://www.ses.com/press-releases (final: https://www.ses.com/news/press-releases) | 200 | html | - | not_a_feed |  |
| Sierra Space News | https://www.sierraspace.com/newsroom/ | 200 | html | - | not_a_feed |  |
| SpaceX | https://www.spacex.com/updates/ | 200 | html | - | not_a_feed |  |
| Spire (/press-media/) | https://spire.com/press-media/ | 200 | html | - | not_a_feed |  |
| Spire Global | https://spire.com/press-releases/ (final: https://spire.com/) | 200 | html | - | not_a_feed |  |
| Starlink (via SpaceX updates + starlink.com) | https://www.starlink.com/updates (final: https://starlink.com/updates) | 200 | html | - | not_a_feed |  |
| Stoke Space (/news/) | https://www.stokespace.com/news/ | 200 | html | - | not_a_feed |  |
| Synspective | https://synspective.com/news/ | 200 | html | - | not_a_feed |  |
| Telesat News | https://www.telesat.com/press/ | 200 | html | - | not_a_feed |  |
| ULA (newsroom.ulalaunch.com) | https://newsroom.ulalaunch.com/ | 200 | html | - | not_a_feed |  |
| Umbra | https://umbra.space/blog (final: https://umbra.space/blog/) | 200 | html | - | not_a_feed |  |
| Unseenlabs | https://unseenlabs.space/news/ (final: https://unseenlabs.com/en/news/) | 200 | html | - | not_a_feed |  |
| Unseenlabs (.com/en/news/) | https://unseenlabs.com/en/news/ | 200 | html | - | not_a_feed |  |
| Arianespace | https://www.arianespace.com/press-releases/ | 404 | html | - | unreachable |  |
| Arianespace newsroom RSS guess | https://newsroom.arianespace.com/rss.xml | 404 | html | - | unreachable |  |
| Astrocast | https://www.astrocast.com/news/ | 404 | html | - | unreachable |  |
| Axiom feed guess | https://www.axiomspace.com/news/rss.xml | 404 | html | - | unreachable |  |
| BlackSky | https://www.blacksky.com/newsroom/ (final: http://blacksky.com/newsroom/) | 404 | html | - | unreachable |  |
| Blue Origin | https://www.blueorigin.com/news | 429 | html | - | unreachable |  |
| Capella Space | https://www.capellaspace.com/press-releases | 404 | html | - | unreachable |  |
| Eutelsat Group (OneWeb) Press | https://www.eutelsat.com/en/group/media-center.html | 404 | html | - | unreachable |  |
| FCC Daily Digest | https://www.fcc.gov/proceedings-actions/daily-digest | fetch_error | error | - | unreachable | 2 attempts failed: timeout 25s |
| ICEYE feed guess | https://www.iceye.com/press/rss.xml | 404 | html | - | unreachable |  |
| Isar Aerospace | https://www.isaraerospace.com/news (final: https://isaraerospace.com/news) | 404 | json | - | unreachable |  |
| ISRO | https://www.isro.gov.in/Press_Release.html | 404 | html | - | unreachable |  |
| NGA / NRO public announcements | https://www.nga.mil/news/press_releases.html | 403 | html | - | unreachable |  |
| NOAA CRSRA (US remote sensing licenses) | https://www.nesdis.noaa.gov/about/commercial-remote-sensing-regulatory-affairs | 404 | html | - | unreachable |  |
| Rocket Factory Augsburg | https://www.rfa.space/news/ | 404 | html | - | unreachable |  |
| Satellogic feed guess | https://satellogic.com/news/feed/ | 403 | json | - | unreachable |  |
| Stoke Space | https://www.stokespace.com/updates/ | 404 | html | - | unreachable |  |
| ULA | https://www.ulalaunch.com/about/news | fetch_error | error | - | unreachable | 2 attempts failed: timeout 25s |
| ULA newsroom RSS guess | https://newsroom.ulalaunch.com/rss.xml | 404 | html | - | unreachable |  |
| Umbra feed guess | https://umbra.space/blog/rss.xml | 404 | html | - | unreachable |  |
| Vantor (ex-Maxar) newsroom guess | https://www.vantor.com/news (final: https://vantor.com/news) | 404 | html | - | unreachable |  |
| Vast News | https://www.vastspace.com/news | 404 | html | - | unreachable |  |
| Xinhua tech/space (EN) | https://english.news.cn/tech/index.htm | 404 | html | - | unreachable |  |

## Discovery-pass failures (no working feed found; two attempts each)

- Business Wire aerospace/defense: feed-options page and industry feed endpoints return 403 (WAF). No feed added.
- PR Newswire aerospace & defense: TLS connection reset by Cloudflare bot mitigation on every attempt. No feed added.
- The Space Review: conventional RSS paths 404. No feed added.
- FCC (fcc.gov, any path incl. Daily Digest): connections refused/timed out from our fetch environments, consistent with SWEEP_MEMORY 2026-07-05-O. FCC regulatory flow arrives via the Federal Register API source instead.
- Xinhua English RSS: endpoints return 200 but newest items are 2017-2018 (abandoned). HTML page fetch only.
- ISRO: no RSS discoverable; working press page is isro.gov.in/Press.html (HTML).
- NextSpaceflight: no feed; /news/feed/ returns an SPA shell.
- IR press-release feeds tried and dead: Rocket Lab, AST SpaceMobile, Iridium, Globalstar, Viasat, EchoStar, Intuitive Machines, Satellogic, SES/Intelsat (404s, connection resets, or no discoverable RSS). SEC EDGAR 8-K atom feeds cover the financial-event flow for all of these instead.
- ESA Telecommunications_Integrated_Applications: parses fine but newest entry 2026-05-29 (>30 days); excluded under the freshness rule, worth revisiting.
- RFA /feed/: parses fine but newest entry 2026-03-06 (company posts rarely); left as an HTML source (rfa.space/media/).
- Telesat /feed/: parses but carries no entry dates; left as an HTML source.
- Astrocast /feed/: newest entry 2024-04; site news listing is also stale/404. Marked unfetchable (fetch_note).
- SEC EDGAR ticker LUNR does not resolve; the added source uses CIK 0001844452, confirmed as Intuitive Machines, Inc. by the feed itself.

