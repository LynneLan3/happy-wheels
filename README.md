# Happy Wheels Steam Guide

V4 standalone frontend for the supplied `happy-wheels-steam-research-v2.zip`, checked September 13, 2026.

- Repository: `LynneLan3/happy-wheels`
- Canonical checkout: `/Users/lanling/Code/hot_words_websites/happy-wheels`
- Content: homepage and five Steam release / Workshop / accounts / controller / Deck status pages.
- Delivery scope: Vercel Preview is ready; all pages are noindex until a production identity is approved. Production Publisher and GSC actions remain pending release readiness.

## Delivery status

Frontend implementation and local browser validation passed. Native Git Preview is ready at the URL recorded in `records/preview-deployment.json`. The first deployment bootstrap was handled within the same Vercel project; no second project was created. Production remains blocked by the registry domain policy because Happy Wheels has no independent domain and no explicit `VERCEL_ONLY` policy.

## Commands

```sh
cd /Users/lanling/Code/hot_words_websites/happy-wheels
npm ci
npm run site:generate
npm run check
npm run build
npm run validate:generated
npm run dev -- --port 4337
python3 scripts/check-preview.py
```

Browser checks use the installed Python Playwright package and Chrome. Screenshots are saved in ignored `preview-screenshots/`.

## Source ownership

`site-input/g017-p2-v4-input.json` owns game content, evidence references, FAQs and V4 primitives. `site-input/presentation.json` owns card labels, metadata, media selection and intent-specific status panels. Run `npm run site:generate` after content changes. Do not edit generated JSON directly.

`src/presentation` and Astro page shells apply the mature standalone presentation pattern used by Withering Realms and ShipShaper. The existing V4 generator, Page Data contract, Quick Answer / Fact Card primitives and FAQ renderer remain in use. No new design system, dependencies or external research were added.

## Creation lineage

- V4 starter: `LynneLan3/game-wiki-starter`, commit `2723178090c67522f82503f956ffe2b7a0984372` (V4.1).
- Existing Site Creation: `LynneLan3/hotword-control-center/scripts/create-site-from-v4-handoff.mjs` at `536187a`, executed unchanged with `--local-only`. The current script requires a publisher adoption module absent from this V4 starter revision; the existing matching version was reused without modifying either owner repository's source.
- `records/site-creation.json` is the actual runtime result. The target repository/path were resolved by Site Creation, not supplied as an inferred binding.
- Preview/design lifecycle identifiers were used. No formal GSC DevelopmentTask was fabricated or updated.

## Media

The ZIP contains no binary assets. Its five exact Steam static-art URLs returned 404. The supplied M06 official Steam microtrailer downloaded successfully. The site uses a local copy plus four distinct WebP frames: stage/lawnmower, neighborhood, dinosaur and street character. These are decorative gameplay imagery, not evidence of Workshop, account migration, controller layout or Deck performance. Frame selection was visually inspected. The missing static art is recorded in `records/media-download.json`.

## Boundaries

Only facts in the supplied September 13 snapshot are used. Workshop integration, personal account/favorites/history/upload ownership transfer, price and achievements remain unconfirmed. Steam Deck Playable metadata is dated and is not a hands-on performance claim. The Shared Writer was not run in this Phase, as explicitly requested.

GSC BUILD sync remains blocked by the existing loadSteamActionRows_ runtime mismatch; not part of this frontend Phase.
