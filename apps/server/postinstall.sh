#!/usr/bin/env sh

# download and prepare the ip-location-api database
(cd ./node_modules/ip-location-api && [ ! -f ./.db-ready ] && pnpm updatedb && touch .db-ready || exit 0)



