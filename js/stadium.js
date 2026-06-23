import * as THREE from 'three';

// Style-driven stadium builder. All venues share the same bowl bones (so the
// crowd and match animations always fit), but seat colours, facade, roof type
// and signature extras come from each venue's `style` (see venues.js).
const SEG = 48;
const DEG = Math.PI / 180;

function ringShape(rxo, rzo, rxi, rzi) {
  const s = new THREE.Shape();
  s.absellipse(0, 0, rxo, rzo, 0, Math.PI * 2, false, 0);
  const hole = new THREE.Path();
  hole.absellipse(0, 0, rxi, rzi, 0, Math.PI * 2, true, 0);
  s.holes.push(hole);
  return s;
}

// Partial ring between angles a0..a1 (radians, shape space).
function arcRingShape(rxo, rzo, rxi, rzi, a0, a1) {
  const s = new THREE.Shape();
  s.absellipse(0, 0, rxo, rzo, a0, a1, false, 0);
  s.absellipse(0, 0, rxi, rzi, a1, a0, true, 0);
  s.closePath();
  return s;
}

function extrudeFlat(shape, y0, y1) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: y1 - y0, bevelEnabled: false, curveSegments: SEG,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0, 0);
  return geo;
}

const ringGeo = (rxo, rzo, rxi, rzi, y0, y1) =>
  extrudeFlat(ringShape(rxo, rzo, rxi, rzi), y0, y1);

function makePitchTexture() {
  const w = 512, h = 352;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');

  const stripes = 10;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? '#2f9e44' : '#37b24d';
    ctx.fillRect((w / stripes) * i, 0, w / stripes + 1, h);
  }

  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 3;
  const mx = 28, my = 24;
  ctx.strokeRect(mx, my, w - 2 * mx, h - 2 * my);
  ctx.beginPath(); ctx.moveTo(w / 2, my); ctx.lineTo(w / 2, h - my); ctx.stroke();
  ctx.beginPath(); ctx.arc(w / 2, h / 2, 42, 0, Math.PI * 2); ctx.stroke();
  const boxW = 76, boxH = 184, goalW = 26, goalH = 88;
  for (const x of [mx, w - mx - boxW]) ctx.strokeRect(x, (h - boxH) / 2, boxW, boxH);
  for (const x of [mx, w - mx - goalW]) ctx.strokeRect(x, (h - goalH) / 2, goalW, goalH);

  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Shared geometries + material cache (many venues reuse the same colours).
let bones = null;
const matCache = new Map();

function mat(color, opts = {}) {
  const key = `${color}|${opts.roughness ?? 0.85}|${opts.metalness ?? 0.05}|${opts.opacity ?? 1}`;
  if (!matCache.has(key)) {
    matCache.set(key, new THREE.MeshStandardMaterial({
      color, roughness: opts.roughness ?? 0.85, metalness: opts.metalness ?? 0.05,
      ...(opts.opacity != null && opts.opacity < 1
        ? { transparent: true, opacity: opts.opacity, depthWrite: false, side: THREE.DoubleSide }
        : {}),
    }));
  }
  return matCache.get(key);
}

function buildBones() {
  bones = {
    apron: ringGeo(1.72, 1.38, 0.555, 0.365, 0.002, 0.012),
    tier1: ringGeo(1.06, 0.82, 0.62, 0.42, 0.012, 0.10),
    tier2: ringGeo(1.31, 1.04, 0.82, 0.60, 0.10, 0.24),
    tier3: ringGeo(1.56, 1.23, 1.02, 0.76, 0.24, 0.40),
    facade: ringGeo(1.63, 1.29, 1.55, 1.22, 0.0, 0.42),
    pitch: new THREE.PlaneGeometry(1.10, 0.72).rotateX(-Math.PI / 2),
    pole: new THREE.CylinderGeometry(0.018, 0.026, 0.62, 6),
    lampHead: new THREE.BoxGeometry(0.16, 0.07, 0.05),
    post: new THREE.CylinderGeometry(0.0035, 0.0035, 0.027, 5),
    crossbar: new THREE.CylinderGeometry(0.0035, 0.0035, 0.082, 5).rotateX(Math.PI / 2),
    mast: new THREE.CylinderGeometry(0.007, 0.013, 0.42, 6),
    pylon: new THREE.CylinderGeometry(0.035, 0.04, 0.52, 8),
    arch: new THREE.TorusGeometry(1.45, 0.02, 8, 60, Math.PI),
    dome: new THREE.SphereGeometry(1, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2),
    berm: new THREE.CylinderGeometry(1.58, 2.05, 0.42, SEG, 1, true),
    pitchMat: new THREE.MeshStandardMaterial({ map: makePitchTexture(), roughness: 0.9 }),
    apronMat: mat(0x39404f, { roughness: 0.95 }),
    poleMat: mat(0x6b7280, { roughness: 0.7 }),
    whiteMat: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }),
    lampMat: new THREE.MeshStandardMaterial({
      color: 0xffffff, emissive: 0xfff6c8, emissiveIntensity: 1.4,
    }),
  };
}

function addRoof(g, style) {
  const color = style.roofColor ?? 0xd9dde2;
  const roofMat = mat(color, { roughness: 0.55, metalness: 0.15 });

  switch (style.roofType) {
    case 'ring': {
      const [rxi, rzi] = style.ringInner ?? [0.96, 0.71];
      g.add(new THREE.Mesh(ringGeo(1.65, 1.31, rxi, rzi, 0.46, 0.495), roofMat));
      break;
    }
    case 'canopies': {
      const [a, b] = style.canopySpan ?? [40, 140];
      const [rxi, rzi] = style.canopyInner ?? [0.96, 0.71];
      for (const off of [0, 180]) {
        const shape = arcRingShape(1.66, 1.32, rxi, rzi, (a + off) * DEG, (b + off) * DEG);
        g.add(new THREE.Mesh(extrudeFlat(shape, 0.46, 0.50), roofMat));
      }
      break;
    }
    case 'asym': {
      // wrap-around roof with one open end (Estadio BBVA)
      const shape = arcRingShape(1.66, 1.32, 0.95, 0.70, 25 * DEG, 335 * DEG);
      g.add(new THREE.Mesh(extrudeFlat(shape, 0.46, 0.50), roofMat));
      break;
    }
    case 'pinwheel': {
      // eight sliding petals (Mercedes-Benz Stadium)
      const tri = new THREE.Shape();
      tri.moveTo(0.18, -0.05); tri.lineTo(1.5, -0.45); tri.lineTo(1.42, 0.35);
      tri.closePath();
      const petalGeo = extrudeFlat(tri, 0, 0.025);
      const petals = new THREE.Group();
      for (let i = 0; i < 8; i++) {
        const p = new THREE.Mesh(petalGeo, roofMat);
        p.rotation.y = i * Math.PI / 4;
        petals.add(p);
      }
      petals.position.y = 0.50;
      petals.scale.z = 0.8;
      g.add(petals);
      break;
    }
    case 'dome': {
      // translucent canopy over everything (SoFi)
      const dome = new THREE.Mesh(bones.dome, mat(color, {
        roughness: 0.3, metalness: 0, opacity: 0.22,
      }));
      dome.scale.set(1.70, 0.55, 1.36);
      dome.position.y = 0.15;
      dome.renderOrder = 5;
      g.add(dome);
      break;
    }
    case 'retractable': {
      // closed ring with the centre panels parted for the match
      g.add(new THREE.Mesh(ringGeo(1.65, 1.31, 0.92, 0.68, 0.46, 0.49), roofMat));
      const panelGeo = new THREE.BoxGeometry(0.5, 0.022, 1.0);
      const panelMat = mat(color, { roughness: 0.45, metalness: 0.25 });
      for (const x of [-0.55, 0.55]) {
        const p = new THREE.Mesh(panelGeo, panelMat);
        p.position.set(x, 0.50, 0);
        g.add(p);
      }
      break;
    }
    default: break; // 'none'
  }
}

function addExtras(g, style) {
  for (const extra of style.extras ?? []) {
    switch (extra) {
      case 'berm': { // grass slope wrapping the bowl (Estadio Akron)
        const berm = new THREE.Mesh(bones.berm, new THREE.MeshStandardMaterial({
          color: 0x4e8c3a, roughness: 1, side: THREE.DoubleSide,
        }));
        berm.scale.z = 0.8;
        berm.position.y = 0.21;
        g.add(berm);
        break;
      }
      case 'masts': { // crown of masts around the rim (BC Place)
        const m = mat(0xf2f4f7, { roughness: 0.4 });
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const mast = new THREE.Mesh(bones.mast, m);
          mast.position.set(Math.cos(a) * 1.60, 0.62, Math.sin(a) * 1.26);
          g.add(mast);
        }
        break;
      }
      case 'arches': { // signature arches over the roof (AT&T Stadium)
        const m = mat(0xdde1e6, { roughness: 0.35, metalness: 0.4 });
        for (const z of [-0.28, 0.28]) {
          const arch = new THREE.Mesh(bones.arch, m);
          arch.scale.y = 0.45;
          arch.position.set(0, 0.1, z);
          g.add(arch);
        }
        break;
      }
      case 'pylons': { // canopy support pylons (Hard Rock Stadium)
        const m = mat(0x8f99a3, { roughness: 0.5, metalness: 0.3 });
        for (const [x, z] of [[1.05, 0.85], [1.05, -0.85], [-1.05, 0.85], [-1.05, -0.85]]) {
          const p = new THREE.Mesh(bones.pylon, m);
          p.position.set(x, 0.26, z);
          g.add(p);
        }
        break;
      }
      case 'lighthouse': { // Gillette Stadium's lighthouse
        const tower = new THREE.Mesh(
          new THREE.CylinderGeometry(0.045, 0.055, 0.4, 12), bones.whiteMat);
        tower.position.set(1.78, 0.2, 0);
        g.add(tower);
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.03, 8, 8), bones.lampMat);
        lamp.position.set(1.78, 0.43, 0);
        g.add(lamp);
        break;
      }
      case 'tower': { // Levi's Stadium suite tower
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.16),
          mat(0xe3e5e8, { roughness: 0.5 }));
        t.position.set(0, 0.15, -1.45);
        g.add(t);
        break;
      }
      default: break;
    }
  }
}

// A stylised model of the venue, Y-up, sitting on y=0.
export function buildStadium(style = {}) {
  if (!bones) buildBones();
  const g = new THREE.Group();
  const seats = style.seats ?? [0x99a3b8, 0x7c8699, 0x99a3b8];

  g.add(new THREE.Mesh(bones.apron, bones.apronMat));
  const pitch = new THREE.Mesh(bones.pitch, bones.pitchMat);
  pitch.position.y = 0.016;
  g.add(pitch);

  g.add(new THREE.Mesh(bones.tier1, mat(seats[0])));
  g.add(new THREE.Mesh(bones.tier2, mat(seats[1])));
  g.add(new THREE.Mesh(bones.tier3, mat(seats[2])));
  if (!style.noFacade) {
    g.add(new THREE.Mesh(bones.facade, mat(style.facade ?? 0x2b3244, {
      roughness: 0.6, metalness: 0.25,
    })));
  }

  // goal frames
  for (const sx of [-1, 1]) {
    for (const z of [-0.039, 0.039]) {
      const post = new THREE.Mesh(bones.post, bones.whiteMat);
      post.position.set(sx * 0.49, 0.029, z);
      g.add(post);
    }
    const bar = new THREE.Mesh(bones.crossbar, bones.whiteMat);
    bar.position.set(sx * 0.49, 0.043, 0);
    g.add(bar);
  }

  addRoof(g, style);
  addExtras(g, style);

  if (style.lights) {
    const a = Math.PI / 4;
    for (let i = 0; i < 4; i++) {
      const ang = a + i * Math.PI / 2;
      const x = Math.cos(ang) * 1.52, z = Math.sin(ang) * 1.20;
      const pole = new THREE.Mesh(bones.pole, bones.poleMat);
      pole.position.set(x, 0.31, z);
      g.add(pole);
      const lamp = new THREE.Mesh(bones.lampHead, bones.lampMat);
      lamp.position.set(x, 0.64, z);
      lamp.lookAt(0, 0.1, 0);
      g.add(lamp);
    }
  }
  return g;
}

// Soft round glow texture for the location beacons.
export function makeGlowTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
