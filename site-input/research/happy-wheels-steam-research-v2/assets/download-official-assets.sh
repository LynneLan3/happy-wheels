#!/usr/bin/env bash
set -euo pipefail
OUT="${1:-assets/downloaded-official}"
mkdir -p "$OUT"

curl -L --fail --retry 3 "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/4705510/bc714e8a1f8ec83a0c8d6384d7fc5ef7494385d9/hero_capsule.jpg" -o "$OUT/hero_capsule.jpg"
curl -L --fail --retry 3 "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/4705510/a8561b95b3e93fe950e0208b2656b2e339bf844e/capsule_616x353.jpg" -o "$OUT/capsule_616x353.jpg"
curl -L --fail --retry 3 "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/4705510/af6e926f3cb8e61d39c75df5fb7154e08df0bad3/library_hero.jpg" -o "$OUT/library_hero.jpg"
curl -L --fail --retry 3 "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/4705510/acd7fedb1e3dfe0ce628c0c8a79dc7a8824ffef8/header.jpg" -o "$OUT/header.jpg"
curl -L --fail --retry 3 "https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/4705510/2227852d391b2e8464e20f82f3adb70924699c96/logo.png" -o "$OUT/logo.png"
curl -L --fail --retry 3 "https://video.fastly.steamstatic.com/store_trailers/4705510/1549693948/aa6e5ff5075999f85e4fe1e0b21eb73fc504abad/1786811190/microtrailer.mp4" -o "$OUT/microtrailer.mp4"

echo "Downloaded official Steam assets to $OUT"
