# World Cup 2026 Stadium Globe — static front-end + serve.py feed proxy.
# No third-party Python deps (stdlib only), so a slim base is all we need.
FROM python:3.12-slim

WORKDIR /app

# Copy the app (.dockerignore keeps .git, caches, etc. out of the image).
COPY . .

# Run as an unprivileged user instead of root.
RUN useradd --create-home --uid 10001 app && chown -R app:app /app
USER app

# HOST=0.0.0.0 lets Docker's published port forward into the container.
# The host only publishes this to 127.0.0.1 (see docker-compose.yml / runbook),
# so the app is still reachable only through your reverse proxy.
ENV PORT=8642 \
    HOST=0.0.0.0

EXPOSE 8642

# Lightweight healthcheck: the feed route returns JSON (or the bundled snapshot).
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python3 -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8642/api/feed', timeout=4).status==200 else 1)"

CMD ["python3", "serve.py"]
