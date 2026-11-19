// Maniquí de la Fase 2: 55 articulaciones, rotación anatómica (doblar y girar sobre el hueso),
// manos completas, dedos del pie, mandíbula, rostro con guías y expresiones.
// Convención: la figura mira hacia +Z; su lado izquierdo es +X. Cada rotación se guarda como
// [sx, ty, sz] en grados: (sx, sz) es el "doblar" (vector de giro perpendicular al hueso) y ty es
// el giro sobre el propio hueso (eje Y local). Así el giro siempre gira el hueso, sin importar su posición.
import * as THREE from "three";
import { DEG, RAD, clamp, clay, clayDark } from "./util.js";

// ------------------------------------------------------------------ Articulaciones
const FINGERS = ["index", "middle", "ring", "pinky"];
const SIDE_BODY = ["clavicle", "shoulder", "elbow", "wrist", "hip", "knee", "ankle", "toes"];
const HAND = [...FINGERS.flatMap(f => [f + "1", f + "2", f + "3"]), "thumb1", "thumb2", "thumb3"];
export const CENTER = ["hips", "spine1", "spine2", "spine3", "chest", "neck1", "neck2", "head", "jaw"];
export const BODY_JOINTS = [...CENTER, ...["L", "R"].flatMap(s => SIDE_BODY.map(b => `${b}_${s}`))];
export const HAND_JOINTS = { L: HAND.map(b => `${b}_L`), R: HAND.map(b => `${b}_R`) };
export const JOINTS = [...BODY_JOINTS, ...HAND_JOINTS.L, ...HAND_JOINTS.R];

const BASE_LABEL = {
  hips: "Pelvis", spine1: "Columna baja", spine2: "Columna media", spine3: "Columna alta", chest: "Pecho",
  neck1: "Cuello bajo", neck2: "Cuello alto", head: "Cabeza", jaw: "Mandíbula",
  clavicle: "Clavícula", shoulder: "Hombro", elbow: "Codo y antebrazo", wrist: "Muñeca",
  hip: "Cadera", knee: "Rodilla", ankle: "Tobillo", toes: "Dedos del pie",
};
export const FINGER_LABEL = { thumb: "Pulgar", index: "Índice", middle: "Medio", ring: "Anular", pinky: "Meñique" };
export function jointLabel(j) {
  const m = j.match(/^(\w+?)_([LR])$/);
  const base = m ? m[1] : j, side = m ? (m[2] === "L" ? " izquierda" : " derecha") : "";
  const fm = base.match(/^(thumb|index|middle|ring|pinky)(\d)$/);
  if (fm) return `${FINGER_LABEL[fm[1]]} ${["base", "medio", "punta"][+fm[2] - 1]}${side ? (m[2] === "L" ? " (izq.)" : " (der.)") : ""}`;
  const L = BASE_LABEL[base] || base;
  const fem = /^(Muñeca|Cadera|Rodilla|Columna|Pelvis|Cabeza|Mandíbula|Clavícula)/.test(L);
  return L + (side ? (fem ? side : side.replace("izquierda", "izquierdo").replace("derecha", "derecho")) : "");
}

// Límites del lado izquierdo, en grados; el derecho se refleja (giro y lado invertidos)
const LIM = {
  hips: { x: [-35, 35], y: [-60, 60], z: [-30, 30] },
  spine1: { x: [-12, 22], y: [-12, 12], z: [-10, 10] },
  spine2: { x: [-12, 22], y: [-14, 14], z: [-10, 10] },
  spine3: { x: [-10, 18], y: [-16, 16], z: [-10, 10] },
  chest: { x: [-10, 16], y: [-14, 14], z: [-8, 8] },
  neck1: { x: [-30, 28], y: [-35, 35], z: [-20, 20] },
  neck2: { x: [-30, 28], y: [-35, 35], z: [-20, 20] },
  head: { x: [-30, 30], y: [-25, 25], z: [-20, 20] },
  jaw: { x: [0, 28], y: [-6, 6], z: [0, 0] },
  clavicle: { x: [0, 0], y: [-18, 15], z: [-8, 28] },
  shoulder: { x: [-180, 60], y: [-95, 95], z: [-35, 180] },
  elbow: { x: [-150, 0], y: [-90, 90], z: [0, 0] },
  wrist: { x: [-25, 35], y: [0, 0], z: [-80, 75] },
  hip: { x: [-130, 35], y: [-45, 50], z: [-30, 55] },
  knee: { x: [0, 155], y: [-25, 25], z: [0, 0] },
  ankle: { x: [-40, 50], y: [-20, 20], z: [-25, 20] },
  toes: { x: [-60, 35], y: [0, 0], z: [0, 0] },
  finger1: { x: [-22, 22], y: [0, 0], z: [-95, 25] },
  finger2: { x: [0, 0], y: [0, 0], z: [-110, 5] },
  finger3: { x: [0, 0], y: [0, 0], z: [-85, 10] },
  thumb1: { x: [-30, 70], y: [-40, 40], z: [-50, 30] },
  thumb2: { x: [0, 0], y: [0, 0], z: [-65, 15] },
  thumb3: { x: [0, 0], y: [0, 0], z: [-85, 20] },
};
function baseOf(j) {
  const m = j.match(/^(\w+?)_([LR])$/);
  const b = m ? m[1] : j;
  const f = b.match(/^(index|middle|ring|pinky)(\d)$/);
  return { b: f ? "finger" + f[2] : b, side: m ? m[2] : null };
}
export function limitsFor(j, relaxed = false) {
  const { b, side } = baseOf(j);
  const L = LIM[b];
  if (!L) return { x: [-180, 180], y: [-180, 180], z: [-180, 180] };
  if (relaxed) {
    const w = (r, k) => (r[0] === r[1] ? r : [Math.max(-180, r[0] - k), Math.min(180, r[1] + k)]);
    const R = { x: w(L.x, 40), y: w(L.y, 40), z: w(L.z, 40) };
    return side === "R" ? mirrorLim(R) : R;
  }
  return side === "R" ? mirrorLim(L) : L;
}
const mirrorLim = L => ({ x: L.x, y: [-L.y[1], -L.y[0]], z: [-L.z[1], -L.z[0]] });

// Etiquetas de cada eje, del extremo izquierdo al derecho del deslizador (lado izquierdo del cuerpo;
// en el lado derecho la interfaz invierte el signo para que signifiquen lo mismo)
const TORSO_AX = { x: "Atrás ↔ adelante", y: "Girar a su derecha ↔ a su izquierda", z: "Inclinar a su izquierda ↔ a su derecha" };
export function axisLabels(j) {
  const { b } = baseOf(j);
  if (["hips", "spine1", "spine2", "spine3", "chest", "neck1", "neck2", "head"].includes(b)) return TORSO_AX;
  return {
    jaw: { x: "Cerrada ↔ abierta", y: "Hacia un lado ↔ al otro" },
    clavicle: { y: "Adelante ↔ atrás", z: "Bajar ↔ encoger" },
    shoulder: { x: "Adelante ↔ atrás", y: "Rotar adentro ↔ afuera", z: "Hacia el cuerpo ↔ separar" },
    elbow: { x: "Doblar ↔ estirar", y: "Palma adentro ↔ afuera" },
    wrist: { x: "Lado del pulgar ↔ del meñique", z: "Doblar a la palma ↔ hacia atrás" },
    hip: { x: "Adelante ↔ atrás", y: "Rotar adentro ↔ afuera", z: "Juntar ↔ separar" },
    knee: { x: "Estirar ↔ doblar", y: "Girar adentro ↔ afuera" },
    ankle: { x: "Punta arriba ↔ punta abajo", y: "Punta adentro ↔ afuera", z: "Planta adentro ↔ afuera" },
    toes: { x: "Arriba ↔ abajo" },
    finger1: { x: "Hacia el pulgar ↔ al meñique", z: "Doblar ↔ estirar" },
    finger2: { z: "Doblar ↔ estirar" }, finger3: { z: "Doblar ↔ estirar" },
    thumb1: { x: "Abrir ↔ cruzar la palma", y: "Girar", z: "Doblar ↔ estirar" },
    thumb2: { z: "Doblar ↔ estirar" }, thumb3: { z: "Doblar ↔ estirar" },
  }[b] || {};
}
export const sideSign = (j, ax) => (/_R$/.test(j) && ax !== "x" ? -1 : 1);

// ------------------------------------------------------------------ Doblar y girar ↔ cuaternión
const Y = new THREE.Vector3(0, 1, 0);
const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _va = new THREE.Vector3();
export function paramsToQuat(p, out = new THREE.Quaternion()) {
  const [sx, ty, sz] = p || [0, 0, 0];
  _qb.setFromAxisAngle(Y, ty * DEG);
  _va.set(sx * DEG, 0, sz * DEG);
  const ang = _va.length();
  if (ang > 1e-7) out.setFromAxisAngle(_va.divideScalar(ang), ang); else out.identity();
  return out.multiply(_qb);
}
export function quatToParams(q) {
  let tw = new THREE.Quaternion(0, q.y, 0, q.w);
  const n = tw.length();
  if (n < 1e-7) tw.identity(); else tw.normalize();
  if (tw.w < 0) { tw.x *= -1; tw.y *= -1; tw.z *= -1; tw.w *= -1; }
  const ty = 2 * Math.atan2(tw.y, tw.w) * RAD;
  const sw = q.clone().multiply(tw.invert());
  if (sw.w < 0) { sw.x *= -1; sw.y *= -1; sw.z *= -1; sw.w *= -1; }
  const ang = 2 * Math.acos(clamp(sw.w, -1, 1));
  const s = Math.sqrt(Math.max(1 - sw.w * sw.w, 0));
  const k = s < 1e-7 ? 0 : (ang / s) * RAD;
  return [sw.x * k, ty, sw.z * k];
}
// Recorte elíptico del "doblar" y recorte simple del giro
export function clampParams(p, L) {
  let [sx, ty, sz] = p;
  ty = clamp(ty, ...L.y);
  const xm = sx >= 0 ? L.x[1] : -L.x[0], zm = sz >= 0 ? L.z[1] : -L.z[0];
  if (xm <= 0) sx = 0; if (zm <= 0) sz = 0;
  const r = Math.hypot(xm > 0 ? sx / xm : 0, zm > 0 ? sz / zm : 0);
  if (r > 1) { sx /= r; sz /= r; }
  return [sx, ty, sz];
}

// ------------------------------------------------------------------ Poses de mano (lado izquierdo, grados)
// c = doblez de [base, medio, punta] por dedo; s = separación de la base; t = pulgar [abrir, giro, base, medio, punta]
export const HAND_POSES = {
  abierta: { label: "Abierta", c: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], s: [-12, -3, 5, 14], t: [-10, 0, 0, 0, 0] },
  relajada: { label: "Relajada", c: [[18, 25, 12], [22, 30, 15], [26, 34, 18], [30, 38, 20]], s: [-4, -1, 2, 5], t: [10, 10, 10, 12, 8] },
  puno: { label: "Puño", c: [[85, 100, 70], [88, 100, 70], [88, 100, 70], [88, 100, 70]], s: [0, 0, 0, 0], t: [45, 20, 20, 35, 30] },
  sujetar: { label: "Sujetar", c: [[50, 55, 35], [55, 58, 38], [58, 60, 40], [60, 62, 42]], s: [-2, 0, 2, 4], t: [40, 25, 15, 25, 15] },
  senalar: { label: "Señalar", c: [[0, 0, 0], [85, 100, 70], [88, 100, 70], [88, 100, 70]], s: [-4, 0, 0, 0], t: [40, 20, 15, 35, 30] },
  apoyada: { label: "Apoyada", c: [[6, 4, 2], [6, 4, 2], [8, 5, 3], [10, 6, 3]], s: [-10, -3, 4, 12], t: [-5, 0, 5, 0, 0] },
  contar: { label: "Contar (dos)", c: [[0, 0, 0], [0, 0, 0], [88, 100, 70], [88, 100, 70]], s: [-10, 6, 0, 0], t: [45, 20, 20, 35, 30] },
  pellizco: { label: "Pellizco", c: [[45, 40, 25], [15, 20, 10], [20, 25, 12], [25, 30, 15]], s: [0, 2, 5, 8], t: [55, 25, 15, 15, 10] },
  lapiz: { label: "Sostener lápiz", c: [[45, 30, 15], [50, 35, 20], [70, 75, 50], [75, 80, 55]], s: [0, 0, 2, 4], t: [50, 30, 20, 20, 10] },
  garra: { label: "Garra", c: [[25, 65, 55], [25, 65, 55], [25, 65, 55], [25, 65, 55]], s: [-14, -4, 6, 16], t: [10, 10, 20, 40, 40] },
  pistola: { label: "Pistola", c: [[0, 0, 0], [88, 100, 70], [88, 100, 70], [88, 100, 70]], s: [-3, 0, 0, 0], t: [-15, -10, 0, 0, 0] },
  pulgar: { label: "Pulgar arriba", c: [[88, 100, 65], [90, 100, 65], [92, 100, 65], [94, 100, 65]], s: [0, 0, 0, 0], t: [-25, 0, -10, -5, 0] },
  vaso: { label: "Vaso", c: [[35, 40, 25], [38, 42, 28], [40, 45, 30], [44, 48, 32]], s: [-3, 0, 3, 6], t: [30, 30, 10, 15, 10] },
};
export function handPoseRot(name, side) {
  const P = HAND_POSES[name] || HAND_POSES.relajada;
  const out = {};
  const k = side === "L" ? 1 : -1;
  FINGERS.forEach((f, i) => {
    out[`${f}1_${side}`] = [P.s[i], 0, -P.c[i][0] * k];
    out[`${f}2_${side}`] = [0, 0, -P.c[i][1] * k];
    out[`${f}3_${side}`] = [0, 0, -P.c[i][2] * k];
  });
  out[`thumb1_${side}`] = [P.t[0], P.t[1] * k, -P.t[2] * k];
  out[`thumb2_${side}`] = [0, 0, -P.t[3] * k];
  out[`thumb3_${side}`] = [0, 0, -P.t[4] * k];
  return out;
}
export function applyHandPose(pose, side, name) { Object.assign(pose.rot, handPoseRot(name, side)); }

// ------------------------------------------------------------------ Expresiones
export const EXPRESSIONS = {
  neutral: { label: "Neutral", brow: [0, 0, 0, 0], lid: [0.85, 0.85], open: 0, wide: 1, smile: [0, 0], jaw: 0 },
  enojo: { label: "Enojo", brow: [-0.7, -0.7, -20, -20], lid: [0.7, 0.7], open: 0.12, wide: 0.92, smile: [-0.5, -0.5], jaw: 3 },
  alegria: { label: "Alegría", brow: [0.35, 0.35, 0, 0], lid: [0.65, 0.65], open: 0.35, wide: 1.2, smile: [1, 1], jaw: 8 },
  tristeza: { label: "Tristeza", brow: [0.15, 0.15, 22, 22], lid: [0.55, 0.55], open: 0, wide: 0.9, smile: [-0.8, -0.8], jaw: 0 },
  sorpresa: { label: "Sorpresa", brow: [1, 1, 6, 6], lid: [1.2, 1.2], open: 0.8, wide: 0.8, smile: [0, 0], jaw: 18 },
  miedo: { label: "Miedo", brow: [0.85, 0.85, 20, 20], lid: [1.15, 1.15], open: 0.5, wide: 1.15, smile: [-0.35, -0.35], jaw: 10 },
  desprecio: { label: "Desprecio", brow: [0.25, -0.2, 0, -6], lid: [0.7, 0.75], open: 0, wide: 1, smile: [0.55, -0.25], jaw: 0 },
  determinacion: { label: "Determinación", brow: [-0.35, -0.35, -8, -8], lid: [0.75, 0.75], open: 0, wide: 1, smile: [-0.1, -0.1], jaw: 0 },
};
export const DEFAULT_FACE = { mode: "simple", guides: true, expr: { ...EXPRESSIONS.neutral } };

// ------------------------------------------------------------------ Construcción
export const DEFAULT_PARAMS = { height: 175, heads: 7.5, build: 0.5, shape: 0 };
function dims(p) {
  const H = p.height / 100, hh = H / p.heads, b = p.build, s = p.shape;
  const t = 0.8 + 0.45 * b;
  const d = {
    H, hh, t,
    hipsY: 0.55 * H, chestY: 0.70 * H, shoulderY: H - 1.35 * hh, headY: H - hh,
    hipJY: 0.52 * H, kneeY: 0.285 * H, ankleY: 0.045 * H,
    sw: 0.114 * H * (1.04 - 0.12 * s) * (0.93 + 0.14 * b),
    hw: 0.054 * H * (0.94 + 0.26 * s) * (0.95 + 0.1 * b),
    upper: 0.172 * H, fore: 0.157 * H, hand: 0.108 * H,
  };
  d.neckY = d.shoulderY + 0.012 * H;
  if (p.dims) Object.assign(d, p.dims); // cuerpo realista: el esqueleto toma las medidas de su malla
  return d;
}
const ball = new THREE.SphereGeometry(1, 28, 18);
const inkMat = new THREE.MeshBasicMaterial({ color: 0x2b2a28 });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0xe9e4da, roughness: 0.5 });
const mouthMat = new THREE.MeshBasicMaterial({ color: 0x2b2420 });
const browMat = new THREE.MeshStandardMaterial({ color: 0x3a2a22, roughness: 0.9 });
const lipLineMat = new THREE.MeshStandardMaterial({ color: 0x6b3b34, roughness: 0.6, transparent: true, opacity: 0.55 });

function part(parent, m, mass, joint) {
  m.castShadow = true; m.receiveShadow = true;
  m.userData.mass = mass; m.userData.joint = joint;
  parent.add(m); return m;
}
function seg(parent, a, b, r, mass, joint, flat = 1) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(len - r * 0.9, 0.004), 6, 14), clay);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(Y, dir.normalize());
  if (flat !== 1) m.scale.set(flat, 1, 1 / flat);
  return part(parent, m, mass, joint);
}
function ell(parent, pos, sx, sy, sz, mass, joint) {
  const m = new THREE.Mesh(ball, clay);
  m.position.copy(pos); m.scale.set(sx, sy, sz);
  return part(parent, m, mass, joint);
}
function knob(parent, r, joint) {
  const m = new THREE.Mesh(ball, clayDark);
  m.scale.setScalar(r); return part(parent, m, 0, joint);
}
function boxm(parent, w, h, d, pos, mass, joint, mat = clay) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.copy(pos); return part(parent, m, mass, joint);
}

export function buildFigure(params = DEFAULT_PARAMS) {
  const P = { ...DEFAULT_PARAMS, ...params };
  const d = dims(P);
  const root = new THREE.Group();
  const joints = {};
  const v = (x, y, z = 0) => new THREE.Vector3(x, y, z);
  const mk = (name, parent, x, y, z = 0) => {
    const o = new THREE.Object3D(); o.name = name; o.position.set(x, y, z);
    o.userData.jointName = name; parent.add(o); joints[name] = o; return o;
  };
  const { H, hh, t } = d;

  // Tronco: pelvis y cuatro segmentos de columna entre la pelvis y los hombros
  const hips = mk("hips", root, 0, d.hipsY);
  const segH = (d.chestY - d.hipsY) / 3;
  const s1 = mk("spine1", hips, 0, segH * 0.55);
  const s2 = mk("spine2", s1, 0, segH);
  const s3 = mk("spine3", s2, 0, segH);
  const chest = mk("chest", s3, 0, d.chestY - d.hipsY - segH * 2.55);
  const neck1 = mk("neck1", chest, 0, d.neckY - d.chestY);
  const neckLen = d.headY - d.neckY;
  const neck2 = mk("neck2", neck1, 0, neckLen * 0.5);
  const head = mk("head", neck2, 0, neckLen * 0.5);

  ell(hips, v(0, -0.004 * H), d.hw * 1.62 + 0.008, 0.062 * H, 0.062 * H * t, 0.16, "hips");
  ell(s1, v(0, segH * 0.4), 0.07 * H * t, segH * 0.62, 0.05 * H * t, 0.05, "spine1");
  ell(s2, v(0, segH * 0.45), 0.075 * H * t, segH * 0.62, 0.052 * H * t, 0.05, "spine2");
  ell(s3, v(0, segH * 0.45), 0.085 * H * t, segH * 0.66, 0.056 * H * t, 0.05, "spine3");
  const ch = d.shoulderY - d.chestY;
  ell(chest, v(0, ch * 0.2, 0.004 * H), d.sw * 0.8, ch * 0.85 + 0.004, 0.063 * H * t * (1 + 0.06 * P.shape), 0.16, "chest");
  for (const j of [s1, s2, s3]) knob(j, 0.022 * H * t, j.name).position.set(0, 0, -0.02 * H);
  seg(neck1, v(0, 0), v(0, neckLen * 0.5), 0.026 * H * t, 0.01, "neck1");
  seg(neck2, v(0, 0), v(0, neckLen * 0.5 + 0.01 * H), 0.025 * H * t, 0.01, "neck2");
  knob(neck1, 0.028 * H * t, "neck1"); knob(neck2, 0.026 * H * t, "neck2");

  // Cabeza, mandíbula y rostro
  const skull = ell(head, v(0, hh * 0.52, -0.01 * hh), hh * 0.335, hh * 0.48, hh * 0.41, 0.07, "head");
  const jaw = mk("jaw", head, 0, hh * 0.36, hh * 0.04);
  const chin = ell(jaw, v(0, -hh * 0.26, hh * 0.17), hh * 0.25, hh * 0.13, hh * 0.22, 0.01, "jaw");
  chin.userData.face = "jaw";
  buildFace(head, jaw, hh);

  // Brazos
  for (const s of ["L", "R"]) {
    const k = s === "L" ? 1 : -1;
    const cl = mk("clavicle_" + s, chest, 0.02 * H * k, d.shoulderY - d.chestY - 0.012 * H, 0.012 * H);
    seg(cl, v(0, 0), v((d.sw - 0.02 * H) * k, 0.008 * H, -0.012 * H), 0.012 * H * t, 0.004, "clavicle_" + s);
    const sh = mk("shoulder_" + s, cl, (d.sw - 0.02 * H) * k, 0.012 * H, -0.012 * H);
    knob(sh, 0.031 * H * t, "shoulder_" + s);
    seg(sh, v(0, 0), v(0, -d.upper), 0.024 * H * t, 0.028, "shoulder_" + s);
    const el = mk("elbow_" + s, sh, 0, -d.upper);
    knob(el, 0.022 * H * t, "elbow_" + s);
    // Antebrazo aplanado con una cresta: el giro de la palma se nota
    seg(el, v(0, 0), v(0, -d.fore), 0.02 * H * t, 0.016, "elbow_" + s, 1.3);
    const ridge = seg(el, v(0.006 * H * k, -0.02 * H, 0.012 * H), v(0.004 * H * k, -d.fore * 0.85, 0.01 * H), 0.008 * H * t, 0, "elbow_" + s);
    ridge.material = clayDark;
    const wr = mk("wrist_" + s, el, 0, -d.fore);
    knob(wr, 0.016 * H * t, "wrist_" + s);
    buildHand(wr, s, d.hand, t, mk);
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
    knob(an, 0.022 * H * t, "ankle_" + s);
    const footL = 0.145 * H, rear = footL * 0.72, fw = 0.05 * H * t, fh = 0.034 * H;
    const heel = boxm(an, fw, fh, rear, v(0, -d.ankleY + fh / 2, rear / 2 - 0.035 * H), 0.012, "ankle_" + s);
    heel.userData.foot = true;
    const toes = mk("toes_" + s, an, 0, -d.ankleY + fh * 0.35, rear - 0.035 * H);
    const toe = boxm(toes, fw * 0.95, fh * 0.65, footL - rear, v(0, fh * 0.32 - fh * 0.35 + fh * 0.0, (footL - rear) / 2), 0.002, "toes_" + s);
    toe.position.y = fh * 0.325 - fh * 0.35 + 0.0005;
    toe.userData.foot = true;
  }
  root.userData.figure = true;
  return { root, joints, d, restHips: new THREE.Vector3(0, d.hipsY, 0), skull };
}

// Mano con 15 articulaciones. La palma de la mano izquierda mira hacia -X; la derecha es su reflejo
function buildHand(wrist, side, size, t, mk) {
  const k = side === "L" ? 1 : -1;
  const palmL = size * 0.46, palmW = size * 0.44, palmT = size * 0.17 * t;
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  boxm(wrist, palmT, palmL, palmW, v(-0.004 * k, -palmL / 2 - size * 0.04, 0), 0.004, "wrist_" + side);
  const lens = [0.92, 1, 0.95, 0.78].map(q => q * size * 0.52);
  const fw = palmW / 4.4;
  FINGERS.forEach((f, i) => {
    const z = (1.5 - i) * fw * 1.08;
    let parent = wrist, y = -palmL - size * 0.04;
    const segs = [0.45, 0.32, 0.23];
    for (let n = 1; n <= 3; n++) {
      const j = mk(`${f}${n}_${side}`, parent, n === 1 ? -0.002 * k : 0, n === 1 ? y : -lens[i] * segs[n - 2], n === 1 ? z : 0);
      const L = lens[i] * segs[n - 1];
      boxm(j, palmT * (0.78 - n * 0.06), L * 0.98, fw * (0.92 - n * 0.04), v(0, -L / 2, 0), 0.0004, `${f}${n}_${side}`);
      parent = j;
    }
  });
  // Pulgar: nace en el borde delantero de la palma, inclinado hacia afuera
  const tb = mk("thumb1_" + side, wrist, -palmT * 0.25 * k, -size * 0.1, palmW / 2 - fw * 0.2);
  tb.userData.rest = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.6, 0, -0.18 * k));
  const tl = [size * 0.22, size * 0.17, size * 0.15];
  boxm(tb, palmT * 0.8, tl[0], fw * 1.15, v(0, -tl[0] / 2, 0), 0.0006, "thumb1_" + side);
  const t2 = mk("thumb2_" + side, tb, 0, -tl[0]);
  boxm(t2, palmT * 0.72, tl[1], fw * 1.05, v(0, -tl[1] / 2, 0), 0.0004, "thumb2_" + side);
  const t3 = mk("thumb3_" + side, t2, 0, -tl[1]);
  boxm(t3, palmT * 0.66, tl[2], fw, v(0, -tl[2] / 2, 0), 0.0003, "thumb3_" + side);
}

// Rostro: guías de construcción (modo simple) y rasgos (modo detallado)
function buildFace(head, jaw, hh) {
  const rx = hh * 0.335, ry = hh * 0.48, rz = hh * 0.41, cy = hh * 0.52, cz = -0.01 * hh;
  const onSkull = (u, w, lift = 1.012) => { // u: ángulo horizontal (0 = frente), w: ángulo vertical
    return new THREE.Vector3(rx * Math.sin(u) * Math.cos(w) * lift, cy + ry * Math.sin(w) * lift, cz + rz * Math.cos(u) * Math.cos(w) * lift);
  };
  const guides = new THREE.Group(); guides.name = "guides";
  const tube = (pts, r = hh * 0.007) => {
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, r, 5, false), inkMat);
    m.userData.face = "guide"; m.userData.joint = "head"; guides.add(m); return m;
  };
  tube(Array.from({ length: 21 }, (_, i) => onSkull(0, -1.1 + i * 0.11)));          // eje central
  tube(Array.from({ length: 21 }, (_, i) => onSkull(-1.2 + i * 0.12, 0)));           // línea de ojos
  tube(Array.from({ length: 11 }, (_, i) => onSkull(-0.45 + i * 0.09, -0.42)), hh * 0.005); // base de la nariz
  tube(Array.from({ length: 11 }, (_, i) => onSkull(-0.38 + i * 0.076, -0.62)), hh * 0.005); // boca
  tube(Array.from({ length: 11 }, (_, i) => onSkull(-0.5 + i * 0.1, 0.3)), hh * 0.005);       // cejas
  head.add(guides);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(hh * 0.07, hh * 0.18, 4), clay);
  nose.position.copy(onSkull(0, -0.22, 1)).add(new THREE.Vector3(0, 0, hh * 0.03));
  nose.rotation.set(-0.25, Math.PI / 4, 0);
  part(head, nose, 0, "head").userData.face = "nose";

  const det = new THREE.Group(); det.name = "detail";
  const feat = {};
  for (const s of ["L", "R"]) {
    const k = s === "L" ? 1 : -1;
    const ep = onSkull(0.36 * k, 0.0, 0.93);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(hh * 0.058, 18, 12), eyeMat);
    eye.position.copy(ep); det.add(eye);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(hh * 0.022, 12, 8), inkMat);
    pupil.position.copy(ep).add(new THREE.Vector3(0, 0, hh * 0.05)); det.add(pupil);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(hh * 0.064, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), clay);
    lid.position.copy(ep); det.add(lid);
    const lowLid = new THREE.Mesh(new THREE.SphereGeometry(hh * 0.062, 18, 10, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), clay);
    lowLid.position.copy(ep); det.add(lowLid);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(hh * 0.15, hh * 0.028, hh * 0.04), inkMat);
    const bp = onSkull(0.36 * k, 0.26, 1.0); brow.position.copy(bp); det.add(brow);
    const ear = new THREE.Mesh(ball, clay);
    ear.scale.set(hh * 0.035, hh * 0.11, hh * 0.07); ear.position.copy(onSkull(1.45 * k, -0.05, 0.97)); det.add(ear);
    feat["lid" + s] = lid; feat["brow" + s] = brow; feat["browPos" + s] = bp.clone(); feat["eye" + s] = ep.clone();
  }
  // Boca: centro y dos comisuras, en la mandíbula para que se abra con ella
  const mouth = new THREE.Group();
  const mp = onSkull(0, -0.62, 1.0); // en coordenadas de la cabeza
  mouth.position.copy(mp).sub(jaw.position);
  const lipW = hh * 0.1;
  const center = new THREE.Mesh(new THREE.BoxGeometry(lipW, hh * 0.016, hh * 0.02), inkMat); mouth.add(center);
  const cL = new THREE.Mesh(new THREE.BoxGeometry(lipW * 0.55, hh * 0.016, hh * 0.02), inkMat); mouth.add(cL);
  const cR = cL.clone(); mouth.add(cR);
  const hole = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mouthMat); hole.scale.set(lipW * 0.6, 0.0001, hh * 0.02); mouth.add(hole);
  jaw.add(mouth);
  head.add(det);
  // Cabeza esculpida (modo realista): una sola superficie con frente, cuencas, pómulos, nariz, labios,
  // mentón y mandíbula. Los rasgos se ajustan con parámetros sin rehacer el personaje.
  const sg = new THREE.SphereGeometry(1, 72, 54);
  const dirs = sg.attributes.position.array.slice();
  const sculpt = new THREE.Mesh(sg, clay); sculpt.userData.joint = "head"; sculpt.castShadow = true; sculpt.receiveShadow = true;
  sculpt.visible = false; head.add(sculpt);
  const skullMeshes = []; head.children.forEach(c => { if (c.isMesh && c.userData.joint === "head" && c !== sculpt && !c.userData.face) skullMeshes.push(c); });
  head.userData.face = { guides, det, mouth, center, cL, cR, hole, lipW, ...feat, hh, sculpt, dirs, rx, ry, rz, cy, cz, skullMeshes, jaw };
}

// Rasgos: cada uno es un bulto o una hendidura en (ángulo horizontal u, ángulo vertical w) del cráneo
const FEATURES = (f) => [
  // [u, w, ancho u, ancho w, altura (en altura de cabeza)]
  [0, -0.12, 0.07, 0.14, 0.05 + 0.02 * f.nose],            // puente de la nariz
  [0, -0.32, 0.1, 0.09, 0.13 + 0.05 * f.nose],             // punta de la nariz
  [0.12, -0.37, 0.06, 0.05, 0.045], [-0.12, -0.37, 0.06, 0.05, 0.045], // aletas
  [0, -0.45, 0.07, 0.035, -0.012],                         // surco bajo la nariz
  [0, -0.54, 0.2, 0.05, 0.03 + 0.015 * f.lips],            // labio superior
  [0, -0.66, 0.16, 0.05, 0.034 + 0.018 * f.lips],          // labio inferior
  [0.21, -0.6, 0.05, 0.05, -0.018], [-0.21, -0.6, 0.05, 0.05, -0.018], // comisuras
  [0, -0.8, 0.12, 0.05, -0.015],                           // hoyo bajo el labio
  [0, -0.98, 0.32, 0.16, 0.035 + 0.03 * f.chin],             // mentón
  [0.36, 0.0, 0.14, 0.1, -0.06], [-0.36, 0.0, 0.14, 0.1, -0.06], // cuencas de los ojos
  [0.34, 0.25, 0.22, 0.06, 0.03 + 0.02 * f.brow], [-0.34, 0.25, 0.22, 0.06, 0.03 + 0.02 * f.brow], // arco de las cejas
  [0.62, -0.2, 0.18, 0.12, 0.035 + 0.03 * f.cheek], [-0.62, -0.2, 0.18, 0.12, 0.035 + 0.03 * f.cheek], // pómulos
  [0.55, -0.52, 0.16, 0.13, -0.02 - 0.01 * f.cheek], [-0.55, -0.52, 0.16, 0.13, -0.02 - 0.01 * f.cheek], // mejillas
  [1.05, 0.3, 0.25, 0.2, -0.018], [-1.05, 0.3, 0.25, 0.2, -0.018], // sienes
  [Math.PI, -0.15, 0.6, 0.35, 0.025],                      // occipital
];
export const FACE_FEATURES = { nose: "Nariz", jaw: "Mandíbula", cheek: "Pómulos", chin: "Mentón", lips: "Labios", brow: "Cejas (hueso)", age: "Edad (arrugas)" };
function sculptHead(F, feat = {}) {
  const f = { nose: 0, jaw: 0, cheek: 0, chin: 0, lips: 0, brow: 0, age: 0, ...feat };
  const key = JSON.stringify(f); if (F.sculptKey === key) return; F.sculptKey = key;
  const pos = F.sculpt.geometry.attributes.position, a = pos.array, D = F.dirs, hh = F.hh, FT = FEATURES(f);
  for (let i = 0; i < a.length; i += 3) {
    const x = D[i], y = D[i + 1], z = D[i + 2];
    const u = Math.atan2(x, z), w = Math.asin(Math.max(-1, Math.min(1, y)));
    let disp = 0;
    for (const [fu, fw, su, sw, amp0] of FT) { const amp = amp0 * 1.45;
      let du = u - fu; du = Math.atan2(Math.sin(du), Math.cos(du));
      disp += amp * Math.exp(-((du / su) ** 2 + ((w - fw) / sw) ** 2));
    }
    // arrugas de la edad: frente y patas de gallo, como surcos finos
    if (f.age > 0) {
      if (w > 0.35 && w < 0.75 && Math.abs(u) < 0.6) disp -= f.age * 0.004 * Math.max(0, Math.sin((w - 0.35) * 48));
      for (const k of [1, -1]) { const du = u - 0.62 * k, dw = w - 0.02; if (Math.abs(du) < 0.12 && Math.abs(dw) < 0.12) disp -= f.age * 0.003 * Math.max(0, Math.sin(Math.atan2(dw, du) * 6)); }
    }
    let px = F.rx * x, py = F.cy + F.ry * y, pz = F.cz + F.rz * z;
    // mandíbula: la cara se angosta hacia abajo, más o menos según el parámetro
    if (y < -0.15) { const t = Math.min(1, (-y - 0.15) / 0.85); px *= 1 - (0.13 - 0.1 * f.jaw) * t * t; pz *= z > 0 ? 1 + 0.06 * t : 1 - 0.25 * t; }
    // la cara es más plana que el cráneo
    if (z > 0 && Math.abs(u) < 1.2) pz *= 1 - 0.08 * Math.cos(u) * Math.max(0, Math.cos(w));
    const nx = x / F.rx, ny = y / F.ry, nz = z / F.rz, nl = Math.hypot(nx, ny, nz) || 1;
    a[i] = px + (nx / nl) * disp * hh; a[i + 1] = py + (ny / nl) * disp * hh; a[i + 2] = pz + (nz / nl) * disp * hh;
  }
  pos.needsUpdate = true; F.sculpt.geometry.computeVertexNormals(); F.sculpt.geometry.computeBoundingSphere();
}

// Aplica modo de rostro y expresión
export function applyFace(fig, face) {
  const F = fig.joints.head.userData.face; if (!F || !face) return;
  const hh = F.hh, e = face.expr || EXPRESSIONS.neutral;
  F.guides.visible = !!face.guides && face.mode !== "realista";
  const real = face.mode === "realista";
  if (F.sculpt) {
    F.sculpt.visible = real;
    for (const m of F.skullMeshes) m.visible = !real;
    F.jaw.children.forEach(c => { if (c.isMesh && c.userData.face === "jaw") c.visible = !real; });
    fig.root.traverse(m => { if (m.userData.face === "nose") m.visible = !real; });
    if (real) sculptHead(F, face.feat);
  }
  const det = face.mode === "detallado" || real;
  if (F.sculpt) {
    // en realista, cejas de pelo (más delgadas, del tono del cabello) y boca sin trazo: los labios son del modelado
    for (const s of ["L", "R"]) { const br = F["brow" + s]; br.scale.set(real ? 0.85 : 1, real ? 0.55 : 1, real ? 0.6 : 1); br.material = real ? browMat : inkMat; }
    for (const m of [F.center, F.cL, F.cR]) m.material = real ? lipLineMat : inkMat;
  }
  F.det.visible = det; F.mouth.visible = det;
  for (const s of ["L", "R"]) {
    const i = s === "L" ? 0 : 1, k = s === "L" ? 1 : -1;
    const br = F["brow" + s];
    br.position.copy(F["browPos" + s]).add(new THREE.Vector3(0, e.brow[i] * hh * 0.05, 0));
    br.rotation.set(0, 0.36 * k, (e.brow[2 + i] || 0) * DEG * -k);
    const open = clamp(e.lid[i], 0, 1.3);
    F["lid" + s].rotation.set(1.3 - open * 1.9, 0, 0); // 0 = cerrado, 1 = abierto, >1 = muy abierto
  }
  const w = e.wide ?? 1;
  F.center.scale.x = w;
  const half = F.lipW * w / 2;
  for (const [m, s, i] of [[F.cL, 1, 0], [F.cR, -1, 1]]) {
    const ang = (e.smile[i] || 0) * 0.55;
    m.position.set(s * (half + F.lipW * 0.22 * Math.cos(ang)), Math.sin(ang) * F.lipW * 0.25, -hh * 0.01);
    m.rotation.z = ang * s;
  }
  F.hole.scale.y = Math.max(0.0001, (e.open || 0) * hh * 0.07);
  F.hole.position.y = -(e.open || 0) * hh * 0.03;
}

// ------------------------------------------------------------------ Pose
export function emptyPose() {
  const r = {};
  for (const j of JOINTS) r[j] = [0, 0, 0];
  return { rot: r, hips: [0, 0, 0] };
}
const _rq = new THREE.Quaternion();
export function setJoint(fig, j, p, relaxed) {
  const o = fig.joints[j]; if (!o) return;
  const c = clampParams(p || [0, 0, 0], limitsFor(j, relaxed));
  paramsToQuat(c, o.quaternion);
  if (o.userData.rest) o.quaternion.premultiply(o.userData.rest);
  return c;
}
export function applyPose(fig, pose, relaxed = false, autoClav = true) {
  // Orientación del cuerpo entero (acostado, de cabeza…): se guarda aparte, sin límites
  const b = pose.body;
  fig.body = b ? b.slice() : null;
  fig.joints.hips.userData.rest = b ? new THREE.Quaternion().setFromEuler(new THREE.Euler(b[0] * DEG, b[1] * DEG, b[2] * DEG)) : null;
  for (const j of JOINTS) setJoint(fig, j, pose.rot?.[j], relaxed);
  if (autoClav) clavicleFollow(fig, pose, relaxed);
  const h = pose.hips || [0, 0, 0];
  fig.joints.hips.position.set(fig.restHips.x + h[0], fig.restHips.y + h[1], fig.restHips.z + h[2]);
  fig.root.updateMatrixWorld(true);
}
// La clavícula acompaña al brazo cuando sube por encima del hombro
function clavicleFollow(fig, pose, relaxed) {
  for (const s of ["L", "R"]) {
    const sh = pose.rot?.["shoulder_" + s] || [0, 0, 0], own = pose.rot?.["clavicle_" + s] || [0, 0, 0];
    const k = s === "L" ? 1 : -1;
    const raise = Math.max(0, Math.hypot(sh[0], sh[2]) - 80);
    const fwd = Math.max(0, -sh[0] - 60) * 0.12;
    setJoint(fig, "clavicle_" + s, [own[0], own[1] - fwd * k, own[2] + raise * 0.22 * k], relaxed);
  }
}
export function readJoint(fig, j) {
  const o = fig.joints[j];
  _rq.copy(o.quaternion);
  if (o.userData.rest) _rq.premultiply(o.userData.rest.clone().invert());
  return quatToParams(_rq).map(v => Math.round(v * 10) / 10);
}
export function readPose(fig, prev) {
  const rot = {};
  for (const j of JOINTS) rot[j] = readJoint(fig, j);
  // La clavícula automática no se guarda como pose propia
  if (prev) for (const s of ["L", "R"]) rot["clavicle_" + s] = (prev.rot?.["clavicle_" + s] || [0, 0, 0]).slice();
  const p = fig.joints.hips.position;
  return { rot, hips: [p.x - fig.restHips.x, p.y - fig.restHips.y, p.z - fig.restHips.z].map(v => Math.round(v * 1000) / 1000), body: fig.body ? fig.body.slice() : null };
}
export function clampJoint(fig, j, relaxed) { setJoint(fig, j, readJoint(fig, j), relaxed); }

export function mirrorPose(pose) {
  const b = pose.body;
  const out = { rot: {}, hips: [-(pose.hips?.[0] || 0), pose.hips?.[1] || 0, pose.hips?.[2] || 0], body: b ? [b[0], -b[1], -b[2]] : null };
  for (const j of JOINTS) {
    const m = j.match(/^(\w+?)_([LR])$/);
    const src = m ? `${m[1]}_${m[2] === "L" ? "R" : "L"}` : j;
    const r = pose.rot[src] || [0, 0, 0];
    out.rot[j] = [r[0], -r[1], -r[2]];
  }
  return out;
}
// Copia un lado al otro (simetría en vivo)
export function symmetrize(pose, from) {
  const to = from === "L" ? "R" : "L";
  for (const j of JOINTS) {
    if (!j.endsWith("_" + from)) continue;
    const r = pose.rot[j] || [0, 0, 0];
    pose.rot[j.slice(0, -1) + to] = [r[0], -r[1], -r[2]];
  }
}

// ------------------------------------------------------------------ Cinemática inversa
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _e = new THREE.Vector3();
const _q = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _wq = new THREE.Quaternion();
export const CHAINS = {
  wrist_L: ["elbow_L", "shoulder_L"], wrist_R: ["elbow_R", "shoulder_R"],
  ankle_L: ["knee_L", "hip_L"], ankle_R: ["knee_R", "hip_R"],
  chest: ["spine3", "spine2", "spine1"],
};
function rotateWorld(j, q, relaxed, fig) {
  j.parent.getWorldQuaternion(_pq);
  j.getWorldQuaternion(_wq);
  _wq.premultiply(q);
  j.quaternion.copy(_pq.invert().multiply(_wq));
  clampJoint(fig, j.name, relaxed);
  j.updateMatrixWorld(true);
}
export function solveIK(fig, end, target, relaxed = false, iterations = 16) {
  const chain = CHAINS[end]; if (!chain) return;
  const endJ = fig.joints[end];
  const lower = fig.joints[chain[0]];
  if (end.startsWith("wrist") || end.startsWith("ankle")) {
    const p = readJoint(fig, chain[0]);
    if (Math.abs(p[0]) < 3) setJoint(fig, chain[0], [chain[0].startsWith("elbow") ? -18 : 18, p[1], p[2]], relaxed);
  }
  fig.root.updateMatrixWorld(true);
  for (let it = 0; it < iterations; it++) {
    for (const name of chain) {
      const j = fig.joints[name];
      j.getWorldPosition(_a); endJ.getWorldPosition(_e);
      _b.subVectors(_e, _a); _c.subVectors(target, _a);
      if (_b.lengthSq() < 1e-10 || _c.lengthSq() < 1e-10) continue;
      _q.setFromUnitVectors(_b.normalize(), _c.normalize());
      rotateWorld(j, _q, relaxed, fig);
    }
    endJ.getWorldPosition(_e);
    if (_e.distanceTo(target) < 0.002) break;
  }
  void lower;
}
// Codo o rodilla: gira el brazo o la pierna alrededor de la línea hombro–muñeca sin mover la mano
export function swingPole(fig, pole, target, relaxed) {
  const upperName = { elbow_L: "shoulder_L", elbow_R: "shoulder_R", knee_L: "hip_L", knee_R: "hip_R" }[pole];
  const endName = { elbow_L: "wrist_L", elbow_R: "wrist_R", knee_L: "ankle_L", knee_R: "ankle_R" }[pole];
  const up = fig.joints[upperName];
  const s = up.getWorldPosition(new THREE.Vector3()), e = fig.joints[endName].getWorldPosition(new THREE.Vector3());
  const p = fig.joints[pole].getWorldPosition(new THREE.Vector3());
  const axis = e.clone().sub(s).normalize();
  const proj = v => { const d = v.clone().sub(s); return d.sub(axis.clone().multiplyScalar(d.dot(axis))); };
  const cur = proj(p), want = proj(target);
  if (cur.lengthSq() < 1e-8 || want.lengthSq() < 1e-8) return;
  cur.normalize(); want.normalize();
  let ang = Math.acos(clamp(cur.dot(want), -1, 1));
  if (cur.clone().cross(want).dot(axis) < 0) ang = -ang;
  rotateWorld(up, new THREE.Quaternion().setFromAxisAngle(axis, ang), relaxed, fig);
  solveIK(fig, endName, e, relaxed, 6);
}

// Mover la pelvis (con o sin pies fijos se resuelve afuera)
export function moveHips(fig, delta) {
  const inv = new THREE.Quaternion();
  fig.root.getWorldQuaternion(inv).invert();
  fig.joints.hips.position.add(delta.clone().applyQuaternion(inv));
  fig.root.updateMatrixWorld(true);
}

// Mirada: reparte el giro entre los dos segmentos del cuello y la cabeza
const _h = new THREE.Vector3(), _d = new THREE.Vector3(), _cq = new THREE.Quaternion();
export function lookAt(fig, target, relaxed) {
  for (const n of ["neck1", "neck2", "head"]) { const p = readJoint(fig, n); setJoint(fig, n, [0, 0, p[2]], relaxed); }
  fig.root.updateMatrixWorld(true);
  const head = fig.joints.head;
  head.getWorldPosition(_h); _h.y += fig.d.hh * 0.5;
  fig.joints.chest.getWorldQuaternion(_cq);
  _d.subVectors(target, _h).applyQuaternion(_cq.invert());
  const yaw = Math.atan2(_d.x, _d.z) * RAD;
  const pitch = -Math.atan2(_d.y, Math.hypot(_d.x, _d.z)) * RAD;
  const split = { neck1: 0.3, neck2: 0.3, head: 0.4 };
  for (const [n, k] of Object.entries(split)) { const p = readJoint(fig, n); setJoint(fig, n, [pitch * k, yaw * k, p[2]], relaxed); }
  fig.root.updateMatrixWorld(true);
}

// Punto más bajo de la figura (para apoyarla en el piso)
export function lowestPoint(fig) {
  let min = Infinity;
  const box = new THREE.Box3();
  fig.root.updateMatrixWorld(true);
  fig.root.traverse(o => {
    if (!o.isMesh || !o.visible || o.userData.face === "guide") return;
    box.setFromObject(o);
    if (box.min.y < min) min = box.min.y;
  });
  return min;
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
    if (box.min.y > 0.04) return;
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
export function actionPoints(fig) {
  const w = n => fig.joints[n].getWorldPosition(new THREE.Vector3());
  const head = w("head"); head.y += fig.d.hh * 0.55;
  const aL = w("ankle_L"), aR = w("ankle_R");
  const foot = aL.y < aR.y - 0.02 ? aL : aR.y < aL.y - 0.02 ? aR : aL.clone().add(aR).multiplyScalar(0.5);
  return [head, w("neck1"), w("spine3"), w("spine1"), w("hips"), foot];
}

// ------------------------------------------------------------------ Migración desde la Fase 1
// Las poses v1 usaban ángulos de Euler XYZ y 17 articulaciones
const _eu = new THREE.Euler(), _mq = new THREE.Quaternion();
export function eulerToParams(r) {
  _eu.set((r?.[0] || 0) * DEG, (r?.[1] || 0) * DEG, (r?.[2] || 0) * DEG, "XYZ");
  return quatToParams(_mq.setFromEuler(_eu)).map(v => Math.round(v * 10) / 10);
}
export function fromV1(rot1 = {}) {
  const out = {};
  const half = r => (r ? [r[0] / 2, r[1] / 2, r[2] / 2] : [0, 0, 0]);
  const third = r => (r ? [r[0] / 3, r[1] / 3, r[2] / 3] : [0, 0, 0]);
  for (const [j, r] of Object.entries(rot1)) {
    if (j === "spine") { out.spine1 = eulerToParams(half(r)); out.spine2 = eulerToParams(half(r)); }
    else if (j === "chest") { out.spine3 = eulerToParams(half(r)); out.chest = eulerToParams(half(r)); }
    else if (j === "neck") { out.neck1 = eulerToParams(half(r)); out.neck2 = eulerToParams(half(r)); }
    else if (/^wrist_/.test(j)) out[j] = eulerToParams([0, 0, -(r?.[0] || 0) * (j.endsWith("_L") ? 1 : -1)]); // en v1 el "doblar" de la muñeca estaba en X
    else out[j] = eulerToParams(r);
  }
  void third;
  return out;
}
