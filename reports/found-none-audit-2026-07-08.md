# found_none batch audit (deferred from BACKFILL_PLAN.md, run 2026-07-08)

Method: adversarial re-search per item (quoted-headline fragments plus company
and event keywords), delegated to a research agent, evidence reviewed by the
orchestrating session. Independent = own write-up with own sourcing; wire
mirrors, press-release reprints, and aggregator rewrites do not count.

Caveat: the orchestrating session's sandbox could not fetch fodnews.com to
re-verify the key Zhuque-2E evidence page directly (empty response, likely
network policy). Both rescores below are therefore VERIFY-THEN-RESCORE
instructions for the next sweep (which has full network), per the
corroboration discipline in SWEEP_MEMORY 2026-07-08-A. See 2026-07-08-J2.

## 2026-06-09-redwire-500m-atm (SNR 5, official_record lead, no penalty)

found_none looks WRONG. Independent coverage found:
- https://www.investing.com/news/stock-market-news/redwire-stock-falls-7-on-500m-equity-offering-program-93CH-4732808
  (Investing.com: market reaction, stock fell 7 percent, own framing; flagged
  AI-assisted plus editor reviewed)
- https://finance.yahoo.com/markets/stocks/articles/redwire-us-500-million-atm-021231065.html
  (Yahoo Finance syndicating Simply Wall St dilution analysis)
Mirrors (do not count): Globe and Mail pressreleases, TradingView, TipRanks,
StockTitan (8-K mirror).
Action: next sweep verifies the Investing.com piece and corrects the item's
corroboration to found_some. No score change expected (lead was never
penalized); this is claim accuracy, not scoring.

## 2026-06-15-axelspace-nsg-up42 (SNR 5, first_party lead, no penalty)

found_none STANDS. Only the first-party release, NSG's own announcement, and
prior/unrelated UP42-platform coverage exist. No action.

## 2026-06-15-zhuque-2e-upper-stage-breakup (SNR 2, penalized: Ars-only)

found_none looks WRONG (the material case). Evidence:
- https://fodnews.com/zhuque-2e-upper-stage-breakup-starlink-iss-debris/
  (FODNews, June 17, 2026: reported to cite the U.S. Space Force Space-Track
  fragmentation advisory directly plus named debris analysts, Darren McKnight
  of LeoLabs and Jim Shell, with Ars cited only as one reference alongside
  its own sourcing)
Mirrors/uncertain: Slashdot (aggregation of Ars), Yahoo News (429, unverified),
Daily Galaxy, Geekspin (likely rewrites, not fetched).
Action: next sweep fetches the FODNews page; if it independently cites the
Space-Track advisory and the named analysts as described, rescore found_none
to found_some via updates[].rescore and attach the source. Expected effect:
the corroboration penalty lifts.

## 2026-06-10-inspace-lvm3-technology-transfer (SNR 1, informal lead)

found_none STANDS. Only small Indian aggregator/PR-rewrite sites (Startuppedia,
PSU Connect, Whalesbook, IndianWeb2, ICICI Direct trending). No SpaceNews,
SpacePolicyOnline, Hindu, Economic Times, Indian Express, or NDTV coverage
yet. Stays SNR 1; recheck on the item's next touch. Note: the IN-SPACe
registry profile added 2026-07-08 gives inspace.gov.in an official_record
path for future upgrades.
