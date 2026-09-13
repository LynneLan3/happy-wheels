# Preview implementation receipt — 2026-09-13

CONTENT ROUTING
Site lifecycle: BUILD
Content stage: PRE_LAUNCH
Intent: HUB / NEWS_UPDATE / MECHANIC
Article class: FAST_VERIFIED + HUB
Evidence gate: PASS only for scopes verified by Research Pack
Media gate: use Pack state per page
Writer: do not run Shared Writer in this Phase
Publish state: PREVIEW_IMPLEMENTATION
Reason: this Phase builds the real frontend from an approved Research Pack; no external research and no Production publishing.

## Scope

`/`, `/steam-release/`, `/steam-workshop/`, `/steam-account-levels/`, `/steam-controller-support/`, `/steam-deck/`. Existing V4 `/category/` and `/search/` are navigation utilities and are excluded from the sitemap. Excluded and backlog research topics have no public routes.

## References actually inspected

- `LynneLan3/withering-realms` at `34d3b8b`: full visual hero, problem-first cards, factual status hierarchy, article rail and mobile stacking. Current registered standalone production site; approved presentation source receipt in Control Center `builds/withering-realms/approved-presentation-source-v1.json`.
- `LynneLan3/shipshaper-falconeer-chronicles` at `4877454`: whole-card links, section spacing, mixed media/text sections, primary/mobile navigation and SEO head structure. Approval recorded in Control Center `records/publish-decisions/shipshaper-falconeer-chronicles.json`.

No whole reference skin was copied. The V4 standalone generator and native content primitives remain the content architecture.

## Input read

All 28 ZIP files: manifest, README, research report, site brief, page plan, route index, player questions, both SERP closeout files, source registries, routing receipts, old handoff note, media manifest/downloader, all five launch guide files, both verified-backlog files, all five research-required files. The old handoff's Writer/Production instructions are superseded by the current user request. No source URLs were fetched for additional game research.

## Local media

Original M06: `public/assets/happy-wheels/official-trailer.mp4`, 854 × 480, 8.53 seconds, H.264 with no audio stream.
Four optimized local frames: hero (0.15-second seek), release (3.1-second seek), workshop (1-fps selection frame 5), community (1-fps selection frame 7). Imagery is decorative. No controller-layout or Steam Deck screenshot exists in the Pack, so those pages use clean compatibility layouts.

## Boundaries

No production deploy, custom domain, Production Publisher invocation, GSC registration, Shared Writer or formal DevelopmentTask writeback. The source starter branch was restored to `feat/publish-gsc-indexing-sync` at `97ba79ac61aea4d2778281742b123ed768185fb1` after generation.
