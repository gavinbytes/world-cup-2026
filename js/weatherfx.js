import * as THREE from 'three';
import { makeGlowTexture } from './stadium.js';

// Map a WMO weather code to a visual effect type.
export function fxTypeForCode(code) {
  if (code == null) return null;
  if (code === 0 || code === 1) return 'sun';
  if (code === 2) return 'partly';
  if (code === 3) return 'clouds';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 95) return 'storm';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 51) return 'rain';
  return 'clouds';
}

function makeCloudTexture() {
  const w = 256, h = 128;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const blob = (x, y, r) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.9)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };
  for (let i = 0; i < 10; i++) {
    blob(48 + Math.random() * 160, 45 + Math.random() * 38, 26 + Math.random() * 22);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const RAIN_N = 380;
const SNOW_N = 300;
const CLOUD_N = 7;
const AREA_R = 3.6;   // radius of the affected patch around the stadium
const TOP_Y = 6;      // local height drops spawn at
const CLOUD_COLORS = {
  partly: 0xffffff, clouds: 0xc9d2e0, snow: 0xdde4ee,
  rain: 0x9aa6ba, storm: 0x6b7689,
};
const CLOUD_COUNTS = { partly: 4, clouds: 7, rain: 7, storm: 7, snow: 6 };

// One reusable group of weather effects, repositioned onto whichever stadium
// is selected. Local space is Y-up on the globe surface.
export class WeatherFX {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);
    this.type = null;
    this.nextFlash = 0;
    this.flashUntil = 0;

    // --- rain: short vertical line segments ---
    this.rainPos = new Float32Array(RAIN_N * 6);
    this.rainSpeed = new Float32Array(RAIN_N);
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({
      color: 0xa8c8ff, transparent: true, opacity: 0.5, depthWrite: false,
    }));
    for (let i = 0; i < RAIN_N; i++) this._resetDrop(i, true);
    this.group.add(this.rain);

    // --- snow: drifting glow points ---
    this.snowPos = new Float32Array(SNOW_N * 3);
    this.snowSpeed = new Float32Array(SNOW_N);
    const snowGeo = new THREE.BufferGeometry();
    snowGeo.setAttribute('position', new THREE.BufferAttribute(this.snowPos, 3));
    this.snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({
      map: makeGlowTexture(), color: 0xffffff, size: 0.09,
      transparent: true, opacity: 0.9, depthWrite: false,
    }));
    for (let i = 0; i < SNOW_N; i++) this._resetFlake(i, true);
    this.group.add(this.snow);

    // --- clouds: billboarded sprites drifting over the roof ---
    const cloudTex = makeCloudTexture();
    this.clouds = [];
    for (let i = 0; i < CLOUD_N; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTex, transparent: true, opacity: 0.9, depthWrite: false,
      }));
      const w = 2 + Math.random() * 1.4;
      s.scale.set(w, w * 0.45, 1);
      s.position.set(
        (Math.random() * 2 - 1) * 2.8,
        2.6 + Math.random() * 1.2,
        (Math.random() * 2 - 1) * 2.2,
      );
      s.userData.speed = 0.15 + Math.random() * 0.22;
      this.clouds.push(s);
      this.group.add(s);
    }

    // --- sun: warm additive glow up in the sky ---
    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: 0xffd98a, transparent: true,
      blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.85,
    }));
    this.sun.scale.set(6, 6, 1);
    this.sun.position.set(-4.5, 6.5, 2.5); // across from the fly-in camera, in frame
    this.group.add(this.sun);

    // --- fog: translucent layers hugging the ground ---
    this.fog = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(4.4 - i * 0.7, 36).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({
          color: 0xdce4f2, transparent: true, opacity: 0.16,
          depthWrite: false, side: THREE.DoubleSide,
        }),
      );
      disc.position.y = 0.35 + i * 0.35;
      disc.userData.spin = (i % 2 ? -1 : 1) * (0.05 + i * 0.03);
      this.fog.add(disc);
    }
    this.group.add(this.fog);

    // --- lightning: a point light that flickers during storms ---
    this.bolt = new THREE.PointLight(0xcfe0ff, 0, 35, 2);
    this.bolt.position.set(0, 5, 0);
    this.group.add(this.bolt);
  }

  _resetDrop(i, randomY = false) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * AREA_R;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const y = randomY ? 0.5 + Math.random() * (TOP_Y - 0.5) : TOP_Y - Math.random();
    const o = i * 6;
    this.rainPos[o] = x; this.rainPos[o + 1] = y; this.rainPos[o + 2] = z;
    this.rainPos[o + 3] = x; this.rainPos[o + 4] = y - 0.22; this.rainPos[o + 5] = z;
    this.rainSpeed[i] = 6 + Math.random() * 4;
  }

  _resetFlake(i, randomY = false) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * AREA_R;
    const o = i * 3;
    this.snowPos[o] = Math.cos(a) * r;
    this.snowPos[o + 1] = randomY ? 0.3 + Math.random() * (TOP_Y - 0.3) : TOP_Y - Math.random();
    this.snowPos[o + 2] = Math.sin(a) * r;
    this.snowSpeed[i] = 0.5 + Math.random() * 0.5;
  }

  show(pos, up, type) {
    if (!type) { this.hide(); return; }
    this.type = type;
    this.group.position.copy(pos);
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);

    this.rain.visible = type === 'rain' || type === 'storm';
    this.snow.visible = type === 'snow';
    this.sun.visible = type === 'sun' || type === 'partly';
    this.fog.visible = type === 'fog';
    const count = CLOUD_COUNTS[type] ?? 0;
    this.clouds.forEach((c, i) => {
      c.visible = i < count;
      if (CLOUD_COLORS[type]) c.material.color.set(CLOUD_COLORS[type]);
      c.material.opacity = type === 'partly' ? 0.75 : 0.95;
    });
    this.bolt.intensity = 0;
    this.nextFlash = performance.now() / 1000 + 1.2;
    this.flashUntil = 0;
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
    this.type = null;
    this.bolt.intensity = 0;
  }

  update(dt, t) {
    if (!this.group.visible) return;

    if (this.rain.visible) {
      for (let i = 0; i < RAIN_N; i++) {
        const o = i * 6;
        const dy = this.rainSpeed[i] * dt;
        this.rainPos[o + 1] -= dy;
        this.rainPos[o + 4] -= dy;
        if (this.rainPos[o + 1] < 0.1) this._resetDrop(i);
      }
      this.rain.geometry.attributes.position.needsUpdate = true;
    }

    if (this.snow.visible) {
      for (let i = 0; i < SNOW_N; i++) {
        const o = i * 3;
        this.snowPos[o + 1] -= this.snowSpeed[i] * dt;
        this.snowPos[o] += Math.sin(t * 1.7 + i) * 0.25 * dt;
        this.snowPos[o + 2] += Math.cos(t * 1.3 + i * 0.7) * 0.2 * dt;
        if (this.snowPos[o + 1] < 0.1) this._resetFlake(i);
      }
      this.snow.geometry.attributes.position.needsUpdate = true;
    }

    for (const c of this.clouds) {
      if (!c.visible) continue;
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 4.2) c.position.x = -4.2;
    }

    if (this.sun.visible) {
      this.sun.material.opacity = 0.75 + 0.15 * Math.sin(t * 1.3);
    }

    if (this.fog.visible) {
      for (const d of this.fog.children) d.rotation.y += d.userData.spin * dt;
    }

    if (this.type === 'storm') {
      if (t > this.nextFlash) {
        this.flashUntil = t + 0.14 + Math.random() * 0.12;
        this.nextFlash = t + 2.5 + Math.random() * 4.5;
      }
      this.bolt.intensity = t < this.flashUntil ? 300 + Math.random() * 400 : 0;
    }
  }
}
