# Deploying to gavinbytes.tech/worldcup

The app is a static front-end plus a tiny Python helper ([serve.py](serve.py))
that proxies the live fixture feed (the feed sends no CORS header, so the
browser can't read it directly). Running `serve.py` is what makes live scores
reliable. The recommended setup runs it behind nginx at the `/worldcup` path.

Everything is **mount-point agnostic**: all asset URLs are page-relative and the
feed proxy is addressed relative to the page, so the same code works at the
domain root or under `/worldcup` with no edits.

---

## Docker (run the app in a container, proxy /worldcup to it)

The container runs `serve.py` and is published **only** to `127.0.0.1:8642` on the
host, so it's never exposed to the internet directly — your existing web server
reverse-proxies `/worldcup` to it. This leaves the rest of `gavinbytes.tech`
untouched.

```sh
# 1. Get the code on the VPS
sudo mkdir -p /opt && cd /opt
sudo git clone https://github.com/gavinbytes/world-cup-2026.git worldcup
cd worldcup

# 2. Install Docker if it isn't there (Ubuntu/Debian)
command -v docker || curl -fsSL https://get.docker.com | sudo sh

# 3. Build + start (publishes to 127.0.0.1:8642 only)
sudo docker compose up -d --build
sudo docker compose ps                              # should be "running (healthy)"
curl -s localhost:8642/api/feed | head -c 80        # should print JSON

# 4. See what's already serving gavinbytes.tech on 80/443, then wire up /worldcup
sudo ss -ltnp '( sport = :80 or sport = :443 )'     # shows nginx / apache / etc.
```

If that shows **nginx**, paste the two blocks from `deploy/nginx-worldcup.conf`
into your existing `server { }` for gavinbytes.tech, then
`sudo nginx -t && sudo systemctl reload nginx`.

If it shows **apache2**, use the Apache block under "Alternative A" below
(`sudo a2enmod proxy proxy_http && sudo systemctl reload apache2`).

Both proxy to `http://127.0.0.1:8642/` — the same local port the container
publishes — so the existing reverse-proxy config works unchanged.

Visit **https://gavinbytes.tech/worldcup/** — done.

### Updating later

```sh
cd /opt/worldcup && sudo git pull && sudo docker compose up -d --build
```

### Keeping the bundled schedule fresh (optional)

The live feed (`/api/feed`) keeps a running page current regardless. To also
refresh the bundled first-paint/offline snapshot, uncomment the `volumes:` line
in `docker-compose.yml` (maps `data/matches.json` into the container), then add a
host cron:

```sh
sudo crontab -e
# add:
0 6 * * * cd /opt/worldcup && ./update-schedule.sh >/dev/null 2>&1
```

---

## Recommended (non-Docker): serve.py behind nginx (reliable live scores)

On the VPS (Ubuntu/Debian; Python 3 is already installed):

```sh
# 1. Get the code
sudo mkdir -p /var/www && cd /var/www
sudo git clone https://github.com/gavinbytes/world-cup-2026.git
cd world-cup-2026
sudo chown -R www-data:www-data /var/www/world-cup-2026

# 2. Run serve.py as a service (listens on 127.0.0.1:8642)
sudo cp deploy/worldcup.service /etc/systemd/system/worldcup.service
#    edit User=/WorkingDirectory= in that file if you cloned elsewhere
sudo systemctl daemon-reload
sudo systemctl enable --now worldcup
systemctl status worldcup          # should be "active (running)"
curl -s localhost:8642/api/feed | head -c 80   # should print JSON

# 3. Wire up nginx — paste the two blocks from deploy/nginx-worldcup.conf
#    INTO your existing  server { }  for gavinbytes.tech, then:
sudo nginx -t && sudo systemctl reload nginx
```

Visit **https://gavinbytes.tech/worldcup/** — done.

`serve.py` only binds `127.0.0.1`, so nothing new is exposed to the internet; it
is reachable only through nginx. No firewall changes needed.

### Updating later

```sh
cd /var/www/world-cup-2026 && sudo git pull && sudo systemctl restart worldcup
```

---

## Keep the bundled schedule fresh (optional)

`data/matches.json` is the offline fallback / first paint; live polling keeps the
running page current regardless. To refresh the bundled snapshot daily:

```sh
sudo crontab -e
# add:
0 6 * * * cd /var/www/world-cup-2026 && ./update-schedule.sh >/dev/null 2>&1
```

---

## Alternative A: Apache reverse proxy

If the VPS uses Apache instead of nginx, enable the proxy modules and add this to
the `gavinbytes.tech` vhost (run `serve.py` via the same systemd unit):

```apache
RedirectMatch 301 ^/worldcup$ /worldcup/
ProxyPreserveHost On
ProxyPass        /worldcup/ http://127.0.0.1:8642/
ProxyPassReverse /worldcup/ http://127.0.0.1:8642/
```

```sh
sudo a2enmod proxy proxy_http
sudo systemctl reload apache2
```

## Alternative B: Static only (no Python)

Drop the files in the web root and skip `serve.py` entirely:

```sh
sudo mkdir -p /var/www/html/worldcup
sudo cp -r index.html styles.css js assets data /var/www/html/worldcup/
```

Serve `/worldcup/` as normal static files. Live scores then fall back to public
CORS proxies (the app tries `api/feed` first, gets a 404, and moves on) — it
works, just less reliably than running `serve.py`. Make sure the URL keeps its
trailing slash (`/worldcup/`) so relative asset paths resolve.

---

## Troubleshooting

- **Blank page / 404s for `js/main.js`, `styles.css`** — you're hitting
  `/worldcup` without the trailing slash. The nginx redirect block fixes this;
  confirm both blocks from `deploy/nginx-worldcup.conf` are present.
- **Scores never update (stuck on bundled data)** — check the service:
  `systemctl status worldcup` and `curl -s localhost:8642/api/feed | head`.
  If upstream is down, `serve.py` serves the bundled snapshot until it recovers.
- **502 from nginx** — `serve.py` isn't running on 8642; start the service.
- **Globe loads but no stadium imagery** — that's the external Esri tile service;
  it retries on the next visit and isn't required for the app to work.
