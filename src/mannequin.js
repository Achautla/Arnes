// Maniquí segmentado: esqueleto con límites anatómicos, manos con poses, IK, espejo y centro de masa.
// Convención: la figura mira hacia +Z; su lado izquierdo es +X. Rotaciones locales en grados (Euler XYZ).
import * as THREE from "three";
import { DEG, RAD, clamp, clay, clayDark } from "./util.js";

export const JOINTS = ["hips", "spine", "chest", "neck", "head",
  "shoulder_L", "elbow_L", "wrist_L", "shoulder_R", "elbow_R", "wrist_R",
  "hip_L", "knee_L", "ankle_L", "hip_R", "knee_R", "ankle_R"];

export const JOINT_LABEL = {
  hips: "Pelvis", spine: "Abdomen", chest: "Pecho", neck: "Cuello", head: "Cabeza",
  shoulder_L: "Hombro izquierdo", elbow_L: "Codo izquierdo", wrist_L: "Muñeca izquierda",
  shoulder_R: "Hombro derecho", elbow_R: "Codo derecho", wrist_R: "Muñeca derecha",
  hip_L: "Cadera izquierda", knee_L: "Rodilla izquierda", ankle_L: "Tobillo izquierdo",
  hip_R: "Cadera derecha", knee_R: "Rodilla derecha", ankle_R: "Tobillo derecho",
};

export const AXIS_LABEL = {
  x: "Adelante / atrás", y: "Giro", z: "Hacia el lado",
};

// Límites del lado izquierdo; el derecho se refleja (Y y Z invertidos)
const LIM = {
  hips: { x: [-35, 35], y: [-50, 50], z: [-30, 30] },
  spine: { x: [-25, 50], y: [-35, 35], z: [-25, 25] },
  chest: { x: [-20, 30], y: [-30, 30], z: [-20, 20] },
  neck: { x: [-35, 40], y: [-45, 45], z: [-25, 25] },
  head: { x: [-30, 30], y: [-35, 35], z: [-15, 15] },
  shoulder: { x: [-180, 60], y: [-90, 90], z: [-30, 180] },
  elbow: { x: [-150, 0], y: [-80, 80], z: [0, 0] },
  wrist: { x: [-70, 70], y: [0, 0], z: [-35, 25] },
  hip: { x: [-125, 30], y: [-45, 45], z: [-25, 45] },
  knee: { x: [0, 150], y: [0, 0], z: [0, 0] },
  ankle: { x: [-45, 35], y: [0, 0], z: [-20, 20] },
};
export function limitsFor(j, relaxed = false) {
  if (relaxed) return { x: [-180, 180], y: [-180, 180], z: [-180, 180] };
  const m = j.match(/^(\w+?)_([LR])$/);
  if (!m) return LIM[j];
  const L = LIM[m[1]];
  if (m[2] === "L") return L;
  return { x: L.x, y: [-L.y[1], -L.y[0]], z: [-L.z[1], -L.z[0]] };
}

export const HAND_POSES = {
  abierta: { label: "Abierta", f: [[0, 0], [0, 0], [0, 0], [0, 0]], t: [0, 0], spread: 1 },
  relajada: { label: "Relajada", f: [[22, 25], [28, 30], [32, 32], [36, 34]], t: [12, 10], spread: 0.4 },
  puno: { label: "Puño", f: [[90, 100], [90, 100], [90, 100], [90, 100]], t: [35, 45], spread: 0 },
  sujetar: { label: "Sujetar", f: [[55, 50], [58, 52], [60, 55], [62, 58]], t: [28, 15], spread: 0.2 },
  senalar: { label: "Señalar", f: [[0, 0], [90, 100], [90, 100], [90, 100]], t: [35, 40], spread: 0 },
  apoyada: { label: "Apoyada", f: [[8, 4], [8, 4], [10, 5], [12, 6]], t: [5, 0], spread: 0.8 },
};

export const DEFAULT_PARAMS = { height: 175, heads: 7.5, build: 0.5, shape: 0 };

// Dimensiones del cuerpo a partir de los parámetros
function dims(p) {
  const H = p.height / 100, hh = H / p.heads, b = p.build, s = p.shape;
  const t = 0.8 + 0.45 * b;
  const d = {
    H, hh, t,
    hipsY: 0.55 * H, spineY: 0.62 * H, chestY: 0.70 * H,
    shoulderY: H - 1.35 * hh, headY: H - hh,
    hipJY: 0.52 * H, kneeY: 0.285 * H, ankleY: 0.045 * H,
    sw: 0.114 * H * (1.04 - 0.12 * s) * (0.93 + 0.14 * b),
    hw: 0.054 * H * (0.94 + 0.26 * s) * (0.95 + 0.1 * b),
    upper: 0.172 * H, fore: 0.157 * H, hand: 0.108 * H,
  };
  d.neckY = d.shoulderY + 0.012 * H;
  return d;
}

const UP = new THREE.Vector3(0, 1, 0);
const ball = new THREE.SphereGeometry(1, 28, 18);

function seg(parent, a, b, r, mass, joint) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(len - r * 0.9, 0.005), 6, 14), clay);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, dir.normalize());
  return part(parent, m, mass, joint);
}
function ell(parent, pos, sx, sy, sz, mass, joint) {
  const m = new THREE.Mesh(ball, clay);
  m.position.copy(pos); m.scale.set(sx, sy, sz);
  return part(parent, m, mass, joint);
}
function knob(parent, r, joint) {
  const m = new THREE.Mesh(ball, clayDark);
  m.scale.setScalar(r);
  return part(parent, m, 0, joint);
}
function part(parent, m, mass, joint) {
  m.castShadow = true; m.receiveShadow = true;
  m.userData.mass = mass; m.userData.joint = joint;
  parent.add(m);
  return m;
}

// Mano: palma y dedos en dos falanges. Se construye para la mano izquierda (palma hacia -X);
// la derecha es su reflejo.
function buildHand(side, poseName, size, t) {
  const pose = HAND_POSES[poseName] || HAND_POSES.relajada;
  const g = new THREE.Group();
  g.name = "hand";
  const palmL = size * 0.48, palmW = size * 0.46, palmT = size * 0.16 * t;
  const palm = new THREE.Mesh(new THREE.BoxGeometry(palmT, palmL, palmW), clay);
  palm.position.y = -palmL / 2 - size * 0.04;
  part(g, palm, 0.004, "wrist_" + side);
  const fw = palmW / 4.3;
  const lens = [0.92, 1, 0.95, 0.78].map(k => k * size * 0.24);
  for (let i = 0; i < 4; i++) {
    const z = (i - 1.5) * fw * 1.05 * (1 + 0.15 * pose.spread);
    const base = new THREE.Group();
    base.position.set(0, -palmL - size * 0.04, z);
    base.rotation.x = (i - 1.5) * 0.06 * pose.spread;
    base.rotation.z = -pose.f[i][0] * DEG;
    g.add(base);
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(palmT * 0.75, lens[i], fw * 0.9), clay);
    p1.position.y = -lens[i] / 2;
    part(base, p1, 0.0005, "wrist_" + side);
    const mid = new THREE.Group();
    mid.position.y = -lens[i];
    mid.rotation.z = -pose.f[i][1] * DEG;
    base.add(mid);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(palmT * 0.7, lens[i] * 0.85, fw * 0.85), clay);
    p2.position.y = -lens[i] * 0.42;
    part(mid, p2, 0.0005, "wrist_" + side);
  }
  // Pulgar: sale del borde de la palma hacia adelante (+Z) y se dobla hacia la palma
  const tb = new THREE.Group();
  tb.position.set(-palmT * 0.2, -size * 0.12, palmW / 2);
  tb.rotation.x = (35 + 25 * pose.spread) * DEG;
  tb.rotation.z = -pose.t[0] * DEG;
  g.add(tb);
  const t1 = new THREE.Mesh(new THREE.BoxGeometry(palmT * 0.8, size * 0.22, fw * 1.05), clay);
  t1.position.y = -size * 0.11;
  part(tb, t1, 0.0005, "wrist_" + side);
  const tm = new THREE.Group();
  tm.position.y = -size * 0.22; tm.rotation.z = -pose.t[1] * DEG;
  tb.add(tm);
  const t2 = new THREE.Mesh(new THREE.BoxGeometry(palmT * 0.75, size * 0.17, fw), clay);
  t2.position.y = -size * 0.085;
  part(tm, t2, 0.0005, "wrist_" + side);
  if (side === "R") g.scale.x = -1;
  return g;
}

// Construye la figura. Devuelve { root, joints, d, restHips }
export function buildFigure(params = DEFAULT_PARAMS, hands = { L: "relajada", R: "relajada" }) {
  const d = dims({ ...DEFAULT_PARAMS, ...params });
  const root = new THREE.Group();
  const joints = {};
  const mk = (name, parent, x, y, z = 0) => {
    const o = new THREE.Object3D();
    o.name = name; o.position.set(x, y, z); o.rotation.order = "XYZ";
    parent.add(o); joints[name] = o; return o;
  };
  const v = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const { H, hh, t } = d;

  const hips = mk("hips", root, 0, d.hipsY);
  const spine = mk("spine", hips, 0, d.spineY - d.hipsY);
  const chest = mk("chest", spine, 0, d.chestY - d.spineY);
  const neck = mk("neck", chest, 0, d.neckY - d.chestY);
  const head = mk("head", neck, 0, d.headY - d.neckY);

  // Tronco
  ell(hips, v(0, -0.004 * H), d.hw * 1.62 + 0.008, 0.062 * H, 0.062 * H * t, 0.16, "hips");
  knob(hips, 0.03 * H * t, "spine").position.set(0, d.spineY - d.hipsY - 0.01 * H, 0);
  ell(spine, v(0, (d.chestY - d.spineY) * 0.4), 0.074 * H * t * (1 + 0.08 * d.t), 0.057 * H, 0.052 * H * t, 0.14, "spine");
  const ch = d.shoulderY - d.chestY;
  ell(chest, v(0, ch * 0.33, 0.004 * H), d.sw * 0.82, ch * 0.78 + 0.004, 0.063 * H * t * (1 + 0.06 * params.shape), 0.2, "chest");
  seg(neck, v(0, 0), v(0, d.headY - d.neckY + 0.01 * H), 0.026 * H * t, 0.02, "neck");
  knob(neck, 0.028 * H * t, "neck");
  ell(head, v(0, hh / 2, 0.004 * H), hh * 0.335, hh / 2, hh * 0.41, 0.08, "head");
  const nose = new THREE.Mesh(new THREE.BoxGeometry(hh * 0.12, hh * 0.13, hh * 0.12), clay);
  nose.position.set(0, hh * 0.45, hh * 0.4);
  part(head, nose, 0, "head");

  // Brazos
  for (const s of ["L", "R"]) {
    const k = s === "L" ? 1 : -1;
    const sh = mk("shoulder_" + s, chest, d.sw * k, d.shoulderY - d.chestY);
    knob(sh, 0.03 * H * t, "shoulder_" + s);
    seg(sh, v(0, 0), v(0, -d.upper), 0.024 * H * t, 0.028, "shoulder_" + s);
    const el = mk("elbow_" + s, sh, 0, -d.upper);
    knob(el, 0.023 * H * t, "elbow_" + s);
    seg(el, v(0, 0), v(0, -d.fore), 0.019 * H * t, 0.016, "elbow_" + s);
    const wr = mk("wrist_" + s, el, 0, -d.fore);
    knob(wr, 0.017 * H * t, "wrist_" + s);
    wr.add(buildHand(s, hands[s], d.hand, t));
  }
  // Piernas
  for (const s of ["L", "R"]) {
    const k = s === "L" ? 1 : -1;
    const hp = mk("hip_" + s, hips, d.hw * k, d.hipJY - d.hipsY);
    knob(hp, 0.037 * H * t, "hip_" + s);
    seg(hp, v(0, 0), v(0, d.kneeY - d.hipJY), 0.039 * H * t, 0.1, "hip_" + s);
    const kn = mk("knee_" + s, hp, 0, d.kneeY - d.hipJY);
    knob(kn, 0.031 * H * t, "knee_" + s);
    seg(kn, v(0, 0), v(0, d.ankleY - d.kneeY), 0.028 * H * t, 0.046, "knee_" + s);
    const an = mk("ankle_" + s, kn, 0, d.ankleY - d.kneeY);
    knob(an, 0.023 * H * t, "ankle_" + s);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.05 * H * t, 0.034 * H, 0.145 * H), clay);
    foot.position.set(0, -d.ankleY + 0.017 * H, 0.036 * H);
    part(an, foot, 0.014, "ankle_" + s).userData.foot = true;
  }
  root.userData.figure = true;
  return { root, joints, d, restHips: new THREE.Vector3(0, d.hipsY, 0) };
}

// --- Pose ---------------------------------------------------------------
export function emptyPose() {
  const r = {};
  for (const j of JOINTS) r[j] = [0, 0, 0];
  return { rot: r, hips: [0, 0, 0] };
}
export function applyPose(fig, pose, relaxed = false) {
  for (const j of JOINTS) {
    const r = pose.rot?.[j] || [0, 0, 0];
    const L = limitsFor(j, relaxed);
    fig.joints[j].rotation.set(clamp(r[0], ...L.x) * DEG, clamp(r[1], ...L.y) * DEG, clamp(r[2], ...L.z) * DEG);
  }
  const h = pose.hips || [0, 0, 0];
  fig.joints.hips.position.set(fig.restHips.x + h[0], fig.restHips.y + h[1], fig.restHips.z + h[2]);
  fig.root.updateMatrixWorld(true);
}
export function readPose(fig) {
  const rot = {};
  for (const j of JOINTS) {
    const e = fig.joints[j].rotation;
    rot[j] = [e.x * RAD, e.y * RAD, e.z * RAD].map(v => Math.round(v * 10) / 10);
  }
  const p = fig.joints.hips.position;
  return { rot, hips: [p.x - fig.restHips.x, p.y - fig.restHips.y, p.z - fig.restHips.z].map(v => Math.round(v * 1000) / 1000) };
}
export function clampJoint(fig, j, relaxed) {
  const L = limitsFor(j, relaxed), e = fig.joints[j].rotation;
  e.set(clamp(e.x * RAD, ...L.x) * DEG, clamp(e.y * RAD, ...L.y) * DEG, clamp(e.z * RAD, ...L.z) * DEG);
}

export function mirrorPose(pose) {
  const out = { rot: {}, hips: [-(pose.hips?.[0] || 0), pose.hips?.[1] || 0, pose.hips?.[2] || 0] };
  for (const j of JOINTS) {
    const m = j.match(/^(\w+?)_([LR])$/);
    const src = m ? `${m[1]}_${m[2] === "L" ? "R" : "L"}` : j;
    const r = pose.rot[src] || [0, 0, 0];
    out.rot[j] = [r[0], -r[1], -r[2]];
  }
  return out;
}

// --- IK por descenso cíclico de coordenadas (CCD) con límites --------------
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _e = new THREE.Vector3();
const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _wq = new THREE.Quaternion();
export const CHAINS = {
  wrist_L: ["elbow_L", "shoulder_L"], wrist_R: ["elbow_R", "shoulder_R"],
  ankle_L: ["knee_L", "hip_L"], ankle_R: ["knee_R", "hip_R"],
};
export function solveIK(fig, end, target, relaxed = false, iterations = 14) {
  const chain = CHAINS[end];
  const endJ = fig.joints[end];
  const lower = fig.joints[chain[0]];
  // Pre-flexión para salir de la singularidad del brazo o pierna estirados
  if (Math.abs(lower.rotation.x) < 0.05) lower.rotation.x = chain[0].startsWith("elbow") ? -0.3 : 0.3;
  fig.root.updateMatrixWorld(true);
  for (let it = 0; it < iterations; it++) {
    for (const name of chain) {
      const j = fig.joints[name];
      j.getWorldPosition(_a);
      endJ.getWorldPosition(_e);
      _b.subVectors(_e, _a).normalize();
      _c.subVectors(target, _a).normalize();
      if (_b.lengthSq() < 1e-8 || _c.lengthSq() < 1e-8) continue;
      _q.setFromUnitVectors(_b, _c);
      j.parent.getWorldQuaternion(_pq);
      j.getWorldQuaternion(_wq);
      _wq.premultiply(_q);
      j.quaternion.copy(_pq.invert().multiply(_wq));
      clampJoint(fig, name, relaxed);
      j.updateMatrixWorld(true);
    }
    endJ.getWorldPosition(_e);
    if (_e.distanceTo(target) < 0.003) break;
  }
}

// Mover la pelvis manteniendo los pies donde estaban
export function moveHips(fig, delta, pinFeet, relaxed) {
  const feet = pinFeet ? ["ankle_L", "ankle_R"].map(n => fig.joints[n].getWorldPosition(new THREE.Vector3())) : null;
  // delta en coordenadas del mundo → local de la raíz
  const inv = new THREE.Quaternion();
  fig.root.getWorldQuaternion(inv).invert();
  fig.joints.hips.position.add(delta.clone().applyQuaternion(inv));
  fig.root.updateMatrixWorld(true);
  if (feet) { solveIK(fig, "ankle_L", feet[0], relaxed); solveIK(fig, "ankle_R", feet[1], relaxed); }
}

// Mirada: reparte el giro entre cuello (40 %) y cabeza (60 %)
const _h = new THREE.Vector3(), _d = new THREE.Vector3(), _cq = new THREE.Quaternion();
export function lookAt(fig, target, relaxed) {
  const head = fig.joints.head;
  fig.joints.neck.rotation.set(0, 0, fig.joints.neck.rotation.z);
  head.rotation.set(0, 0, head.rotation.z);
  fig.root.updateMatrixWorld(true);
  head.getWorldPosition(_h); _h.y += fig.d.hh * 0.5;
  fig.joints.chest.getWorldQuaternion(_cq);
  _d.subVectors(target, _h).applyQuaternion(_cq.invert());
  const yaw = Math.atan2(_d.x, _d.z) * RAD;
  const pitch = -Math.atan2(_d.y, Math.hypot(_d.x, _d.z)) * RAD;
  fig.joints.neck.rotation.x = pitch * 0.4 * DEG; fig.joints.neck.rotation.y = yaw * 0.4 * DEG;
  head.rotation.x = pitch * 0.6 * DEG; head.rotation.y = yaw * 0.6 * DEG;
  clampJoint(fig, "neck", relaxed); clampJoint(fig, "head", relaxed);
  fig.root.updateMatrixWorld(true);
}

// Centro de masa y apoyo
export function centerOfMass(fig) {
  const c = new THREE.Vector3(), p = new THREE.Vector3();
  let m = 0;
  fig.root.traverse(o => { if (o.isMesh && o.userData.mass) { o.getWorldPosition(p); c.addScaledVector(p, o.userData.mass); m += o.userData.mass; } });
  return m ? c.divideScalar(m) : c;
}
export function supportPolygon(fig) {
  const pts = [];
  fig.root.traverse(o => {
    if (!o.userData.foot) return;
    const box = new THREE.Box3().setFromObject(o);
    if (box.min.y > 0.05) return; // el pie no toca el piso
    const g = o.geometry.parameters, hw = g.width / 2, hd = g.depth / 2;
    for (const [x, z] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) {
      const v = new THREE.Vector3(x, -g.height / 2, z).applyMatrix4(o.matrixWorld);
      pts.push([v.x, v.z]);
    }
  });
  return hull(pts);
}
function hull(P) {
  if (P.length < 3) return P;
  P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p); }
  for (const p of P.slice().reverse()) { while (up.length >= 2 && cr(up.at(-2), up.at(-1), p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
export function insidePolygon(pt, poly) {
  if (poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > pt[1]) !== (zj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

// Puntos para la línea de acción: cabeza → pecho → pelvis → pie de apoyo
export function actionPoints(fig) {
  const w = n => fig.joints[n].getWorldPosition(new THREE.Vector3());
  const head = w("head"); head.y += fig.d.hh * 0.55;
  const aL = w("ankle_L"), aR = w("ankle_R");
  const foot = aL.y < aR.y - 0.02 ? aL : aR.y < aL.y - 0.02 ? aR : aL.clone().add(aR).multiplyScalar(0.5);
  return [head, w("neck"), w("spine"), w("hips"), foot];
}
