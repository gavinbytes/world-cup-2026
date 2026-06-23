#!/bin/sh
# Refresh the match schedule (scores update as the tournament progresses).
cd "$(dirname "$0")"
curl -sL "https://fixturedownload.com/feed/json/fifa-world-cup-2026" -o data/matches.json \
  && echo "Schedule updated: $(date)"
