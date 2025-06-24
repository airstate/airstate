#!/usr/bin/env sh

# download and prepare the ip-location-api database
if [ -z "$SKIP_IP_DB_UPDATE" ]; then
  (cd ./node_modules/ip-location-api && [ ! -f ./.db-ready ] && pnpm updatedb && touch .db-ready || exit 0)
fi



