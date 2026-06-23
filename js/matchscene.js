import * as THREE from 'three';

// A tiny football match + cheering crowd, placed onto whichever stadium is
// selected (one shared instance, like WeatherFX). Local space is Y-up.
const PITCH_X = 0.46;   // playable half-extents (inside the painted lines)
const PITCH_Z = 0.28;
const GOAL_HALF_Z = 0.042;
const PITCH_Y = 0.017;  // just above the pitch plane

// 4-3-3 for the team defending the -x goal; mirrored for the other team.
const FORMATION = [
  [-0.45, 0],                                        // keeper
  [-0.34, -0.21], [-0.34, 0.21], [-0.36, -0.07], [-0.36, 0.07],
  [-0.18, 0], [-0.20, -0.16], [-0.20, 0.16],
  [-0.06, -0.20], [-0.06, 0.20], [-0.04, 0],
];

const SKIN_TONES = [0xf1c27d, 0xc68642, 0x8d5524, 0xffdbac];
const CROWD_PALETTE = [
  0xe8e8e8, 0x24242a, 0x8a8f99, 0xd83a3a, 0x3a62d8,
  0xe8c93a, 0x35b06b, 0xee7733, 0xc9b8e8,
];

// Exposed (walkable) top surface of each seating tier: y, x-radii range,
// z-radii range — matches the bowl bones in stadium.js.
const TIER_ROWS = [
  { y: 0.10, x: [0.64, 0.80], z: [0.44, 0.58], rows: 2 },
  { y: 0.24, x: [0.84, 1.00], z: [0.62, 0.74], rows: 2 },
  { y: 0.40, x: [1.04, 1.50], z: [0.78, 1.18], rows: 4 },
];
const FAN_SPACING = 0.027;

export class MatchScene {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    scene.add(this.group);

    this.teamAMat = new THREE.MeshStandardMaterial({ color: 0xd83a3a, roughness: 0.8 });
    this.teamBMat = new THREE.MeshStandardMaterial({ color: 0x3a62d8, roughness: 0.8 });
    const bodyGeo = new THREE.CylinderGeometry(0.005, 0.0065, 0.016, 6);
    bodyGeo.translate(0, 0.008, 0);
    const headGeo = new THREE.SphereGeometry(0.0048, 8, 6);
    headGeo.translate(0, 0.0205, 0);
    const skinMats = SKIN_TONES.map((c) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));

    this.players = [];
    for (let team = 0; team < 2; team++) {
      for (let i = 0; i < FORMATION.length; i++) {
        const sx = team === 0 ? 1 : -1;
        const home = { x: FORMATION[i][0] * sx, z: FORMATION[i][1] };
        const p = new THREE.Group();
        p.add(new THREE.Mesh(bodyGeo, team === 0 ? this.teamAMat : this.teamBMat));
        p.add(new THREE.Mesh(headGeo, skinMats[(i + team) % SKIN_TONES.length]));
        p.position.set(home.x, PITCH_Y, home.z);
        this.group.add(p);
        this.players.push({
          mesh: p, team, home,
          keeper: i === 0,
          chase: 0.25 + Math.random() * 0.35,
          speed: 0.05 + Math.random() * 0.04,
          jitter: Math.random() * Math.PI * 2,
        });
      }
    }

    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.005, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }),
    );
    this.ball.position.y = PITCH_Y + 0.005;
    this.group.add(this.ball);
    this.ballVel = new THREE.Vector2(0, 0);
    this.kickCooldown = 0;
    this.goalBoostUntil = 0;

    this._buildCrowd();
  }

  _buildCrowd() {
    const bases = [];
    for (const tier of TIER_ROWS) {
      for (let r = 0; r < tier.rows; r++) {
        const f = (r + 0.5) / tier.rows;
        const rx = tier.x[0] + (tier.x[1] - tier.x[0]) * f;
        const rz = tier.z[0] + (tier.z[1] - tier.z[0]) * f;
        const perim = Math.PI * 2 * Math.sqrt((rx * rx + rz * rz) / 2);
        const n = Math.floor(perim / FAN_SPACING);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          bases.push({
            x: Math.cos(a) * rx, y: tier.y, z: Math.sin(a) * rz,
            theta: a, phase: Math.random() * Math.PI * 2,
          });
        }
      }
    }
    this.fanBases = bases;

    const fanGeo = new THREE.BoxGeometry(0.011, 0.02, 0.011);
    fanGeo.translate(0, 0.01, 0);
    this.crowd = new THREE.InstancedMesh(
      fanGeo, new THREE.MeshLambertMaterial(), bases.length);
    const color = new THREE.Color();
    const m = new THREE.Matrix4();
    bases.forEach((b, i) => {
      m.makeTranslation(b.x, b.y, b.z);
      this.crowd.setMatrixAt(i, m);
      color.setHex(CROWD_PALETTE[(Math.random() * CROWD_PALETTE.length) | 0]);
      this.crowd.setColorAt(i, color);
    });
    this.crowd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.crowd);
  }

  show(pos, up, kitA, kitB) {
    this.group.position.copy(pos);
    this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
    this.teamAMat.color.set(kitA);
    this.teamBMat.color.set(kitB);
    this.ball.position.set(0, PITCH_Y + 0.005, 0);
    this.ballVel.set(0, 0);
    this.kickCooldown = performance.now() / 1000 + 0.8;
    this.group.visible = true;
  }

  hide() {
    this.group.visible = false;
  }

  update(dt, t) {
    if (!this.group.visible) return;
    const b = this.ball.position;

    // ball physics: friction, bounce, goals
    this.ballVel.multiplyScalar(Math.max(0, 1 - 1.6 * dt));
    b.x += this.ballVel.x * dt;
    b.z += this.ballVel.y * dt;
    if (Math.abs(b.x) > PITCH_X) {
      if (Math.abs(b.z) < GOAL_HALF_Z) {
        // GOOOAL — crowd erupts, ball back to the centre spot
        this.goalBoostUntil = t + 3;
        b.set(0, PITCH_Y + 0.005, 0);
        this.ballVel.set(0, 0);
        this.kickCooldown = t + 1.4;
      } else {
        b.x = Math.sign(b.x) * PITCH_X;
        this.ballVel.x *= -0.55;
      }
    }
    if (Math.abs(b.z) > PITCH_Z) {
      b.z = Math.sign(b.z) * PITCH_Z;
      this.ballVel.y *= -0.55;
    }

    // players chase a blend of their formation spot and the ball
    let nearest = null;
    let nearestD = Infinity;
    for (const p of this.players) {
      const pos = p.mesh.position;
      let tx, tz;
      if (p.keeper) {
        tx = (p.team === 0 ? 1 : -1) * (PITCH_X - 0.012);
        tz = THREE.MathUtils.clamp(b.z * 0.7, -0.08, 0.08);
      } else {
        const sway = Math.sin(t * 0.9 + p.jitter) * 0.03;
        tx = p.home.x + (b.x - p.home.x) * p.chase;
        tz = p.home.z + (b.z - p.home.z) * p.chase + sway;
      }
      const dx = tx - pos.x, dz = tz - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.004) {
        const step = Math.min(p.speed * dt, d);
        pos.x += (dx / d) * step;
        pos.z += (dz / d) * step;
        p.mesh.rotation.y = Math.atan2(dx, dz);
        pos.y = PITCH_Y + Math.abs(Math.sin(t * 13 + p.jitter)) * 0.0014;
      } else {
        pos.y = PITCH_Y;
      }
      const bd = Math.hypot(b.x - pos.x, b.z - pos.z);
      if (bd < nearestD) { nearestD = bd; nearest = p; }
    }

    // kick when the nearest player reaches the ball
    if (t > this.kickCooldown && nearest && nearestD < 0.022) {
      const goalX = nearest.team === 0 ? -PITCH_X : PITCH_X; // attack the far goal
      const target = new THREE.Vector2(goalX, (Math.random() - 0.5) * 0.3);
      const dir = target.sub(new THREE.Vector2(b.x, b.z)).normalize();
      dir.rotateAround(new THREE.Vector2(), (Math.random() - 0.5) * 0.5);
      this.ballVel.copy(dir.multiplyScalar(0.28 + Math.random() * 0.3));
      this.kickCooldown = t + 0.5 + Math.random() * 0.6;
    }

    // crowd: a wave around the bowl + individual bouncing; goals crank it up
    const amp = t < this.goalBoostUntil ? 0.02 : 0.0075;
    const m = new THREE.Matrix4();
    for (let i = 0; i < this.fanBases.length; i++) {
      const f = this.fanBases[i];
      const wave = Math.max(0, Math.sin(f.theta * 2 - t * 2.2));
      const bounce = Math.max(0, Math.sin(t * 6 + f.phase)) * 0.0022;
      m.makeTranslation(f.x, f.y + wave * wave * amp + bounce, f.z);
      this.crowd.setMatrixAt(i, m);
    }
    this.crowd.instanceMatrix.needsUpdate = true;
  }
}
