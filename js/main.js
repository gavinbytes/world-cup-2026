import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { VENUES, COUNTRY_COLORS, kitColors } from './venues.js';
import { buildStadium, makeGlowTexture } from './stadium.js';
import { WeatherFX, fxTypeForCode } from './weatherfx.js';
import { MatchScene } from './matchscene.js';
import { initUI, showVenuePanel, hideVenuePanel, setTooltip, applyLiveMatches } from './ui.js';

const R = 100;
const GLOBE_CAM_DIST = 320;
// Venues sit slightly off the globe so the high-res imagery patch (at +0.012)
// fits between the globe surface and the stadium without z-fighting.
const VENUE_LIFT = 0.02;

const container = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050810);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 6000);
// On narrow (portrait) screens the horizontal FOV shrinks, so back the camera
// off until the whole globe fits in view.
const globeDist = () => Math.max(GLOBE_CAM_DIST, 300 / camera.aspect);
// open centred on the host countries
camera.position.copy(latLonToVec3(30, -96, globeDist()));

// OrbitControls captures camera.up once at construction (it defines the orbit
// axis), so each view change rebuilds the controls: world-up for the globe,
// surface-normal-up for a stadium — that's what keeps the stadium upright.
let controls = null;

function newControls() {
  if (controls) controls.dispose();
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.autoRotate = true;
}

function applyGlobeControls() {
  camera.up.set(0, 1, 0);
  newControls();
  controls.target.set(0, 0, 0);
  controls.minDistance = 115;
  controls.maxDistance = 900;
  // every venue is in the Americas — keep the globe facing them
  // (venue beacons span azimuth ≈ -0.58 (Vancouver) … 0.33 (Boston))
  controls.autoRotate = false;
  controls.minAzimuthAngle = -1.15;
  controls.maxAzimuthAngle = 0.95;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 2.55;
}

function applyStadiumControls(target, up) {
  camera.up.copy(up);
  newControls();
  controls.target.copy(target);
  controls.minDistance = 1.8;
  controls.maxDistance = 60;
  controls.minPolarAngle = 0.2;   // not straight overhead
  controls.maxPolarAngle = 1.32;  // never below the horizon
  controls.autoRotateSpeed = 0.5;
}

applyGlobeControls();

// lights — key light follows the camera so the visible side is always lit
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xbfd4ff, 0x10131c, 0.75));

// ---------- globe ----------
const globe = new THREE.Mesh(
  new THREE.SphereGeometry(R, 96, 96),
  new THREE.MeshStandardMaterial({ color: 0x9aa7c4, roughness: 1, metalness: 0 }),
);
scene.add(globe);

new THREE.TextureLoader().load('assets/earth.jpg', (tex) => {
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  globe.material.map = tex;
  globe.material.color.set(0xffffff);
  globe.material.needsUpdate = true;
});

// atmosphere glow
const atmosphere = new THREE.Mesh(
  new THREE.SphereGeometry(R * 1.07, 64, 64),
  new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vNormal;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec3 vNormal;
      void main() {
        float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
        gl_FragColor = vec4(0.25, 0.5, 1.0, 1.0) * intensity;
      }`,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  }),
);
scene.add(atmosphere);

// stars
{
  const n = 2400;
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(1500 + Math.random() * 1500);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xcdd6ff, size: 1.4, sizeAttenuation: false, transparent: true, opacity: 0.8,
  })));
}

// ---------- venues: stadiums + beacons ----------
function latLonToVec3(lat, lon, r) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

const glowTex = makeGlowTexture();
const venuePoints = [];
const beacons = [];

const venuePos = (v) => latLonToVec3(v.lat, v.lon, R + VENUE_LIFT);

for (const [key, v] of Object.entries(VENUES)) {
  const pos = venuePos(v);
  const up = pos.clone().normalize();
  const color = COUNTRY_COLORS[v.country];

  const stadium = buildStadium(v.style);
  stadium.position.copy(pos);
  stadium.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  scene.add(stadium);

  const beacon = new THREE.Group();
  beacon.position.copy(pos);
  beacon.quaternion.copy(stadium.quaternion);

  const glow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color, transparent: true, opacity: 0.95, depthWrite: false,
  }));
  glow.scale.setScalar(7);
  glow.position.y = 1.2;
  beacon.add(glow);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.3, 9, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  beam.position.y = 4.5;
  beacon.add(beam);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(1.7, 2.1, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  ring.position.y = 0.05;
  beacon.add(ring);
  beacon.userData = { ring, glow, beam };
  scene.add(beacon);
  beacons.push(beacon);

  venuePoints.push({ key, pos, up });
}

// ---------- camera flights ----------
let mode = 'globe';
let selectedKey = null;
let flight = null;

// On phones the venue info card is a bottom sheet covering the lower part of
// the screen, so the camera's centred subject (the stadium) would land behind
// it. Shift the rendered frame up via a view offset so the stadium sits in the
// visible band above the card. Ramped each frame (see animate) so the lift
// eases in with the fly-in and back out on return to the globe.
const isMobile = () => window.matchMedia('(max-width: 768px)').matches;
const STADIUM_VIEW_LIFT = 0.3; // fraction of viewport height
let viewShift = 0;             // current (eased) lift
let appliedShift = -1;         // last lift pushed to the projection matrix

function desiredViewShift() {
  const goingToStadium = mode === 'stadium' || (flight && selectedKey);
  return isMobile() && goingToStadium ? STADIUM_VIEW_LIFT : 0;
}

function applyViewShift(frac) {
  if (Math.abs(frac - appliedShift) < 0.002) return; // avoid redundant rebuilds
  appliedShift = frac;
  if (frac < 0.002) { camera.clearViewOffset(); return; }
  const W = window.innerWidth, H = window.innerHeight;
  camera.setViewOffset(W, H, 0, frac * H, W, H);
}

// During a flight the camera is driven manually (controls.update() is not
// called), so OrbitControls can't clamp or fight the animation. camera.up is
// lerped too, rolling the horizon upright as we land at a stadium.
function flyTo(camEnd, targetEnd, upEnd, dur, onDone) {
  flight = {
    t0: performance.now(), dur,
    cam0: camera.position.clone(), cam1: camEnd.clone(),
    tg0: controls.target.clone(), tg1: targetEnd.clone(),
    up0: camera.up.clone(), up1: upEnd.clone().normalize(),
    onDone,
  };
  controls.enabled = false;
  controls.autoRotate = false;
}

function tangents(up) {
  let east = new THREE.Vector3(0, 1, 0).cross(up);
  if (east.lengthSq() < 1e-6) east = new THREE.Vector3(1, 0, 0);
  east.normalize();
  const north = up.clone().cross(east).normalize();
  return { east, north };
}

// High-res satellite imagery patch (Esri World Imagery) draped on the globe
// around each visited venue. Loaded lazily and cached, but only shown while
// that venue is selected — zooming back out fades back to the base texture.
const patches = new Map();
const DEG = Math.PI / 180;

function ensurePatch(key) {
  if (patches.has(key)) return;
  patches.set(key, null);
  const v = VENUES[key];
  const dLon = 4.5, dLat = 3.4;
  const url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export'
    + `?bbox=${v.lon - dLon},${v.lat - dLat},${v.lon + dLon},${v.lat + dLat}`
    + '&bboxSR=4326&imageSR=4326&size=1024,774&format=jpg&f=image';
  new THREE.TextureLoader().load(url, (tex) => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const geo = new THREE.SphereGeometry(
      R + 0.012, 48, 32,
      (v.lon - dLon + 180) * DEG, 2 * dLon * DEG,
      (90 - (v.lat + dLat)) * DEG, 2 * dLat * DEG,
    );
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: tex, roughness: 1, metalness: 0,
      transparent: true, opacity: 0,
      polygonOffset: true, polygonOffsetFactor: -1,
    }));
    mesh.userData.venueKey = key;
    mesh.visible = false;
    scene.add(mesh);
    patches.set(key, mesh);
  }, undefined, () => {
    // imagery fetch failed (offline / Esri hiccup): drop the placeholder so a
    // later visit retries instead of leaving the venue permanently patch-less
    patches.delete(key);
  });
}

function selectVenue(key) {
  const v = VENUES[key];
  if (!v || (mode === 'stadium' && selectedKey === key)) return;
  selectedKey = key;
  setTooltip(0, 0, null);
  fx.hide();
  ensurePatch(key);

  const pos = venuePos(v);
  const up = pos.clone().normalize();
  const { east, north } = tangents(up);
  const camEnd = pos.clone()
    .add(up.clone().multiplyScalar(3.1))
    .add(east.clone().multiplyScalar(4.4))
    .add(north.clone().multiplyScalar(-2.0));
  const tgEnd = pos.clone().add(up.clone().multiplyScalar(0.2));

  showVenuePanel(key);
  flyTo(camEnd, tgEnd, up, 1900, () => {
    mode = 'stadium';
    applyStadiumControls(tgEnd, up);
  });
}

function backToGlobe() {
  selectedKey = null;
  fx.hide();
  matchScene.hide();
  hideVenuePanel();
  const camEnd = camera.position.clone().normalize().multiplyScalar(globeDist());
  flyTo(camEnd, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0), 1500, () => {
    mode = 'globe';
    applyGlobeControls();
  });
}

// ---------- weather + match animation over the selected stadium ----------
const fx = new WeatherFX(scene);
const matchScene = new MatchScene(scene);

function handleWeather(key, weather) {
  if (key !== selectedKey || !weather || weather.status !== 'ok') {
    fx.hide();
    return;
  }
  const v = VENUES[key];
  const pos = venuePos(v);
  fx.show(pos, pos.clone().normalize(), fxTypeForCode(weather.code));
}

function handleNextMatch(key, nm) {
  if (key !== selectedKey) return;
  const v = VENUES[key];
  const pos = venuePos(v);
  const [kitA, kitB] = kitColors(nm && nm.HomeTeam, nm && nm.AwayTeam);
  matchScene.show(pos, pos.clone().normalize(), kitA, kitB);
}

// ---------- picking ----------
// Screen-space nearest-venue picking: robust for clustered east-coast venues
// (MetLife and Lincoln Financial are only ~2 globe units apart).
let downAt = null;
const PICK_RADIUS_PX = 22;

function pick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const camDir = camera.position.clone().normalize();
  let best = null;
  let bestD = event.pointerType === 'touch' ? 34 : PICK_RADIUS_PX;
  for (const p of venuePoints) {
    if (p.up.dot(camDir) < 0.2) continue; // far side of the globe
    const ndc = p.pos.clone().project(camera);
    if (ndc.z > 1) continue;
    const sx = rect.left + ((ndc.x + 1) / 2) * rect.width;
    const sy = rect.top + ((-ndc.y + 1) / 2) * rect.height;
    const d = Math.hypot(sx - event.clientX, sy - event.clientY);
    if (d < bestD) { bestD = d; best = p.key; }
  }
  return best;
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  downAt = { x: e.clientX, y: e.clientY };
});
renderer.domElement.addEventListener('pointerup', (e) => {
  if (!downAt) return;
  const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
  downAt = null;
  if (moved > 5 || flight) return;
  const key = pick(e);
  if (key) selectVenue(key);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return; // no hover tooltip on touch
  if (flight || mode === 'stadium') { setTooltip(0, 0, null); return; }
  const key = pick(e);
  renderer.domElement.style.cursor = key ? 'pointer' : 'grab';
  setTooltip(e.clientX, e.clientY, key);
});

// ---------- boot ----------
async function boot() {
  const [matches, photos] = await Promise.all([
    fetch('data/matches.json', { cache: 'no-store' }).then((r) => r.json()),
    fetch('data/photos.json', { cache: 'no-store' }).then((r) => r.json()).catch(() => ({})),
  ]);
  initUI(matches, photos, {
    onVenueClick: selectVenue,
    onBack: backToGlobe,
    onWeather: handleWeather,
    onNextMatch: handleNextMatch,
  });
  document.getElementById('loading').remove();
  if ('ontouchstart' in window) {
    document.getElementById('hint').textContent =
      'Drag to spin · Tap a beacon to fly to its stadium';
  }
  pollLive();
  setInterval(pollLive, 60000);
  // console/debug access
  window.__globe = {
    selectVenue,
    backToGlobe,
    forceFx(type) {
      if (!selectedKey) return 'select a venue first';
      const p = venuePos(VENUES[selectedKey]);
      fx.show(p, p.clone().normalize(), type);
      return 'fx: ' + type;
    },
    screenPos(key) {
      const p = venuePoints.find((q) => q.key === key);
      if (!p) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      const ndc = p.pos.clone().project(camera);
      return {
        x: rect.left + ((ndc.x + 1) / 2) * rect.width,
        y: rect.top + ((-ndc.y + 1) / 2) * rect.height,
      };
    },
  };
}
boot().catch((err) => {
  document.getElementById('loading').textContent =
    'Could not load schedule — serve this folder over HTTP (see README). ' + err;
});

// Live scores: poll the fixture feed every minute. The feed sends no CORS
// header, so the browser can't read it directly. When served via serve.py we
// hit the same-origin proxy (reliable); on plain static hosting we fall back
// through public CORS proxies. On total failure the last good data (bundled
// data/matches.json at boot, or the previous poll) stays in place.
const FEED_URL = 'https://fixturedownload.com/feed/json/fifa-world-cup-2026';

async function fetchLiveFeed() {
  const sources = [
    // serve.py proxy, addressed relative to the page so it also resolves when
    // the app is mounted under a sub-path (e.g. /worldcup/) behind a reverse
    // proxy. On static hosting this 404s and we fall through to the proxies.
    new URL('api/feed', document.baseURI).href,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(FEED_URL)}`,
    `https://api.codetabs.com/v1/proxy/?quest=${encodeURIComponent(FEED_URL)}`,
    `https://corsproxy.io/?url=${encodeURIComponent(FEED_URL)}`,
  ];
  for (const url of sources) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      if (Array.isArray(data) && data.length) return data;
    } catch { /* try the next source */ }
  }
  return null;
}

async function pollLive() {
  const data = await fetchLiveFeed();
  if (data) applyLiveMatches(data);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  appliedShift = -1; // re-derive the view offset against the new viewport size
  // keep the globe fully in frame when the viewport narrows (e.g. rotation)
  if (mode === 'globe' && !flight) camera.position.setLength(globeDist());
});

// ---------- render loop ----------
const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
let lastFrame = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;

  if (flight) {
    let k = Math.min((now - flight.t0) / flight.dur, 1);
    const e = easeInOut(k);
    const r0 = flight.cam0.length(), r1 = flight.cam1.length();
    const dir = flight.cam0.clone().normalize()
      .lerp(flight.cam1.clone().normalize(), e).normalize();
    camera.position.copy(dir.multiplyScalar(r0 + (r1 - r0) * e));
    controls.target.lerpVectors(flight.tg0, flight.tg1, e);
    camera.up.lerpVectors(flight.up0, flight.up1, e).normalize();
    camera.lookAt(controls.target);
    if (k === 1) {
      const f = flight;
      flight = null;
      if (f.onDone) f.onDone();
    }
  } else {
    controls.update();
  }

  viewShift += (desiredViewShift() - viewShift) * Math.min(1, dt * 4);
  applyViewShift(viewShift);

  sun.position.copy(camera.position).setLength(500).add(new THREE.Vector3(0, 180, 0));
  fx.update(dt, now / 1000);
  matchScene.update(dt, now / 1000);

  // fade satellite patches in near their selected venue, out on zoom-out
  for (const mesh of patches.values()) {
    if (!mesh) continue;
    const target = mesh.userData.venueKey === selectedKey ? 1 : 0;
    const o = mesh.material.opacity + (target - mesh.material.opacity) * Math.min(1, dt * 2.5);
    mesh.material.opacity = o;
    mesh.visible = o > 0.02;
  }

  const t = now / 1000;
  const camDist = camera.position.length();
  const fade = THREE.MathUtils.clamp((camDist - 130) / 90, 0, 1);
  beacons.forEach((b, i) => {
    const s = THREE.MathUtils.clamp(camDist / GLOBE_CAM_DIST, 0.15, 1.6) * fade;
    b.scale.setScalar(Math.max(s, 0.001));
    b.userData.ring.scale.setScalar(1 + 0.22 * Math.sin(t * 2.2 + i * 0.7));
    b.visible = fade > 0.02;
  });

  renderer.render(scene, camera);
}
requestAnimationFrame(animate);
