#!/usr/bin/env python3
"""Static server for the World Cup globe, with a same-origin proxy for the
live fixture feed so scores update in real time.

    python3 serve.py [port]        # default 8642  ->  http://127.0.0.1:8642

Serves this folder like ``python3 -m http.server`` and adds one route:

    GET /api/feed   the fifa-world-cup-2026 JSON feed, fetched server-side
                    (the feed sends no CORS header, so the browser can't read
                    it directly), short-cached, and returned same-origin with
                    no-store. If upstream is down it falls back to the bundled
                    data/matches.json so the client always gets something.

This is what makes live scores reliable: the browser polls /api/feed (no
proxy needed). Plain static hosting still works -- the page then falls back
to public CORS proxies (see js/main.js), just less reliably.
"""
import json
import sys
import time
import urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

FEED_URL = "https://fixturedownload.com/feed/json/fifa-world-cup-2026"
CACHE_TTL = 20  # s — collapse bursts/multiple tabs into one upstream fetch
ROOT = Path(__file__).resolve().parent

_cache = {"at": 0.0, "body": None}


def fetch_feed():
    """Return the feed bytes, cached for CACHE_TTL. Only a valid, non-empty
    match array is cached, so a bad upstream response never sticks."""
    now = time.time()
    if _cache["body"] is not None and now - _cache["at"] < CACHE_TTL:
        return _cache["body"]
    req = urllib.request.Request(FEED_URL, headers={"User-Agent": "world-cup-globe/1.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        body = r.read()
    data = json.loads(body)  # raises on non-JSON -> caller falls back
    if not (isinstance(data, list) and data):
        raise ValueError("feed was not a non-empty match array")
    _cache.update(at=now, body=body)
    return body


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path.split("?", 1)[0] == "/api/feed":
            return self.serve_feed()
        return super().do_GET()

    def serve_feed(self):
        try:
            body = fetch_feed()
        except Exception as e:
            snap = ROOT / "data" / "matches.json"
            if not snap.exists():
                self.send_error(502, f"feed fetch failed: {e}")
                return
            body = snap.read_bytes()  # bundled snapshot keeps the client alive
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8642
    handler = partial(Handler, directory=str(ROOT))
    srv = ThreadingHTTPServer(("127.0.0.1", port), handler)
    print(f"World Cup globe -> http://127.0.0.1:{port}  (live feed at /api/feed)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")


if __name__ == "__main__":
    main()
