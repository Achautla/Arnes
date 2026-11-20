// Plantas como objetos: árboles, palmas, mangle, arbustos, flores, helechos, pasto, troncos y cactus.
// Se generan con ramas que se afinan y copas o frondas que siguen a cada rama; la semilla da otra planta
// de la misma especie. Tronco y follaje son piezas con su propio color y textura (se ven en los estilos de color).
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { clay } from "./util.js";

export const SPECIES = {
  ceiba: { label: "Ceiba o árbol de copa ancha", alto: 1400, grosor: 1, follaje: 0.8 },
  roble: { label: "Roble o encino", alto: 900, grosor: 0.9, follaje: 0.85 },
  pino: { label: "Pino", alto: 1200, grosor: 0.6, follaje: 0.8 },
  palmera: { label: "Palmera", alto: 900, grosor: 0.5, follaje: 0.7 },
  platanera: { label: "Platanera", alto: 380, grosor: 0.5, follaje: 0.8 },
  sauce: { label: "Sauce llorón", alto: 900, grosor: 0.8, follaje: 0.9 },
  mangle: { label: "Mangle (raíces en zancos)", alto: 600, grosor: 0.6, follaje: 0.8 },
  seco: { label: "Árbol seco", alto: 700, grosor: 0.7, follaje: 0 },
  arbusto: { label: "Arbusto", alto: 120, grosor: 0.5, follaje: 0.9 },
  helecho: { label: "Helecho", alto: 90, grosor: 0.3, follaje: 0.9 },
  flores: { label: "Matas con flores", alto: 50, grosor: 0.3, follaje: 0.8 },
  pasto: { label: "Pasto alto", alto: 70, grosor: 0.2, follaje: 1 },
  cactus: { label: "Cactus", alto: 350, grosor: 0.8, follaje: 0 },
  tronco: { label: "Tronco caído", alto: 400, grosor: 0.8, follaje: 0.2 },
};
export const PLANT_DEFAULT = { especie: "ceiba", alto: 1400, grosor: 1, follaje: 0.8, semilla: 3, flor: "#d8425a" };

const rng = seed => { let s = (seed * 9301 + 49297) >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);

// Rama: cilindro que se afina, orientado de a hacia b, con curvatura suave
function limb(list, a, b, r0, r1, seg = 7, bend = null) {
  const dir = b.clone().sub(a), len = dir.length(); if (len < 1e-4) return;
  const geo = new THREE.CylinderGeometry(r1, r0, len, seg, bend ? 4 : 1, false); geo.translate(0, len / 2, 0);
  if (bend) { const p = geo.getAttribute("position"); for (let i = 0; i < p.count; i++) { const t = p.getY(i) / len; p.setX(i, p.getX(i) + bend.x * Math.sin(t * Math.PI) ); p.setZ(i, p.getZ(i) + bend.z * Math.sin(t * Math.PI)); } }
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize())); geo.translate(a.x, a.y, a.z);
  list.push(geo);
}
// Copa: bulto de esferas deformadas (se lee como masa de hojas en el semirender)
function blob(list, at, r, R, squash = 0.75, n = 1) {
  if (!(r > 1e-4)) return; // sin radio no hay copa (antes generaba NaN y contagiaba el contacto de la piel)
  for (let i = 0; i < n; i++) {
    const g = new THREE.IcosahedronGeometry(r * (0.75 + R() * 0.4), 2), p = g.getAttribute("position");
    for (let k = 0; k < p.count; k++) { const v = V(p.getX(k), p.getY(k), p.getZ(k)), w = 1 + (Math.sin(v.x * 7 / r + R()) + Math.sin(v.z * 9 / r) + Math.sin(v.y * 8 / r)) * 0.06; p.setXYZ(k, v.x * w, v.y * w * squash, v.z * w); }
    g.translate(at.x + (R() - 0.5) * r * (n > 1 ? 1.2 : 0), at.y + (R() - 0.5) * r * (n > 1 ? 0.5 : 0), at.z + (R() - 0.5) * r * (n > 1 ? 1.2 : 0)); g.computeVertexNormals(); list.push(g);
  }
}
// Hoja larga (palma, platanera, helecho): tira curva con ancho que se afina, doblada hacia abajo por el peso
function frond(list, at, dir, len, width, droop, R, segs = 10, split = false) {
  const pos = [], idx = [], side = V(-dir.z, 0, dir.x).normalize();
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, w = width * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.05)) * (split ? 0.6 : 1);
    const c = at.clone().addScaledVector(dir, t * len); c.y += Math.sin(t * Math.PI * 0.5) * len * 0.25 - t * t * droop * len;
    for (const s of [-1, 1]) { const q = c.clone().addScaledVector(side, s * w); q.y -= w * 0.25; pos.push(q.x, q.y, q.z); }
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); list.push(g.toNonIndexed());
}
// Árbol con ramas que se abren de forma recursiva; las puntas llevan copa
function branchTree(wood, leaf, base, dir, len, r, depth, R, o) {
  const tip = base.clone().addScaledVector(dir, len);
  limb(wood, base, tip, r, r * 0.68, depth > 1 ? 8 : 6, depth > 2 ? V((R() - 0.5) * len * 0.08, 0, (R() - 0.5) * len * 0.08) : null);
  if (depth <= 0) { if (o.leaf > 0) blob(leaf, tip, o.crown * (0.8 + R() * 0.5), R, o.squash, 1); return; }
  const kids = o.kids + (R() < 0.4 ? 1 : 0);
  for (let i = 0; i < kids; i++) {
    const az = (i / kids) * Math.PI * 2 + R() * 1.2, el = o.spread * (0.7 + R() * 0.6);
    const d = dir.clone().applyAxisAngle(V(Math.cos(az), 0, Math.sin(az)), el).add(V(0, o.lift, 0)).normalize();
    branchTree(wood, leaf, tip.clone().addScaledVector(dir, -len * 0.05 * R()), d, len * (0.62 + R() * 0.18), r * 0.62, depth - 1, R, o);
  }
}

export function buildPlant(p, g) {
  const sp = SPECIES[p.especie] ? p.especie : "ceiba", R = rng(p.semilla || 3);
  const H = Math.max(0.1, (p.alto || SPECIES[sp].alto) / 100), th = p.grosor ?? SPECIES[sp].grosor, fol = p.follaje ?? SPECIES[sp].follaje;
  const wood = [], leaf = [], flower = [];
  if (sp === "ceiba" || sp === "roble" || sp === "sauce" || sp === "seco" || sp === "mangle") {
    const trunkH = H * (sp === "ceiba" ? 0.5 : sp === "mangle" ? 0.35 : 0.38), r = H * 0.035 * th * (sp === "ceiba" ? 1.4 : 1);
    const base = V(0, sp === "mangle" ? H * 0.12 : 0, 0);
    limb(wood, base, V(0, trunkH, 0), r, r * 0.75, 10, V((R() - 0.5) * r, 0, (R() - 0.5) * r));
    // contrafuertes de la ceiba y raíces en zancos del mangle
    if (sp === "ceiba") for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + R(); limb(wood, V(Math.cos(a) * r * 2.6, 0, Math.sin(a) * r * 2.6), V(Math.cos(a) * r * 0.4, H * 0.12, Math.sin(a) * r * 0.4), r * 0.55, r * 0.25, 5); }
    if (sp === "mangle") for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + R() * 0.5, d = H * (0.16 + R() * 0.12); const mid = V(Math.cos(a) * d * 0.55, H * (0.16 + R() * 0.06), Math.sin(a) * d * 0.55); limb(wood, V(Math.cos(a) * d, -0.05, Math.sin(a) * d), mid, r * 0.22, r * 0.25, 5); limb(wood, mid, V(0, H * 0.18, 0), r * 0.25, r * 0.35, 5); }
    const O = {
      ceiba: { kids: 3, spread: 1.0, lift: 0.15, crown: H * 0.13, squash: 0.55 },
      roble: { kids: 3, spread: 0.75, lift: 0.3, crown: H * 0.14, squash: 0.8 },
      sauce: { kids: 3, spread: 0.65, lift: 0.35, crown: H * 0.1, squash: 1.4 },
      seco: { kids: 2, spread: 0.6, lift: 0.4, crown: 0, squash: 1 },
      mangle: { kids: 3, spread: 0.85, lift: 0.25, crown: H * 0.12, squash: 0.65 },
    }[sp];
    O.leaf = fol;
    const depth = sp === "seco" ? 4 : 3;
    for (let i = 0; i < 3; i++) { const az = i / 3 * Math.PI * 2 + R(); const d = V(Math.cos(az) * 0.6, 1, Math.sin(az) * 0.6).normalize(); branchTree(wood, leaf, V(0, trunkH * 0.95, 0), d, H * 0.22, r * 0.7, depth - 1, R, O); }
    // sauce: cortinas que cuelgan de la copa
    if (sp === "sauce" && fol > 0) for (let i = 0; i < 40 * fol; i++) { const a = R() * Math.PI * 2, d = H * (0.15 + R() * 0.25), top = V(Math.cos(a) * d, H * (0.7 + R() * 0.2), Math.sin(a) * d); frond(leaf, top, V(Math.cos(a) * 0.15, -1, Math.sin(a) * 0.15).normalize(), H * (0.35 + R() * 0.25), H * 0.025, 0, R, 6); }
  } else if (sp === "pino") {
    const r = H * 0.022 * th; limb(wood, V(0, 0, 0), V(0, H * 0.98, 0), r, r * 0.2, 9);
    if (fol > 0) { const tiers = 7; for (let i = 0; i < tiers; i++) { const t = i / tiers, y = H * (0.25 + t * 0.68), rad = H * 0.24 * (1 - t * 0.85) * (0.85 + fol * 0.3); const c = new THREE.ConeGeometry(rad, H * 0.2, 11, 1); const pp = c.getAttribute("position"); for (let k = 0; k < pp.count; k++) if (pp.getY(k) < 0) { const a = Math.atan2(pp.getZ(k), pp.getX(k)); const w = 1 + Math.sin(a * 5 + i) * 0.12; pp.setX(k, pp.getX(k) * w); pp.setZ(k, pp.getZ(k) * w); } c.translate(0, y, 0); c.computeVertexNormals(); leaf.push(c); } }
  } else if (sp === "palmera") {
    const r = H * 0.022 * th, lean = V((R() - 0.5) * 0.4, 1, (R() - 0.5) * 0.4).normalize();
    const top = V(lean.x * H * 0.3, H, lean.z * H * 0.3);
    limb(wood, V(0, 0, 0), top, r * 1.2, r * 0.8, 9, V(lean.x * H * 0.12, 0, lean.z * H * 0.12));
    // anillos del tronco
    for (let i = 1; i < 14; i++) { const t = i / 14, c = V(0, 0, 0).lerp(top, t); c.x += Math.sin(t * Math.PI) * lean.x * H * 0.12; c.z += Math.sin(t * Math.PI) * lean.z * H * 0.12; const ring = new THREE.TorusGeometry(r * (1.2 - t * 0.4), r * 0.12, 5, 12); ring.rotateX(Math.PI / 2); ring.translate(c.x, c.y, c.z); wood.push(ring); }
    if (fol > 0) for (let i = 0; i < 11; i++) { const a = i / 11 * Math.PI * 2 + R() * 0.3; frond(leaf, top, V(Math.cos(a), 0.15, Math.sin(a)).normalize(), H * (0.38 + R() * 0.12) * (0.6 + fol * 0.5), H * 0.045, 0.9, R, 12, true); }
    for (let i = 0; i < 5; i++) blob(flower, top.clone().add(V((R() - 0.5) * r * 2, -r * 2, (R() - 0.5) * r * 2)), r * 0.7, R, 1);
  } else if (sp === "platanera") {
    const r = H * 0.05 * th; limb(wood, V(0, 0, 0), V(0, H * 0.55, 0), r, r * 0.8, 9);
    if (fol > 0) for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + R(); frond(leaf, V(0, H * 0.5, 0), V(Math.cos(a), 1.3, Math.sin(a)).normalize(), H * (0.45 + R() * 0.15), H * 0.09, 0.8, R, 10); }
  } else if (sp === "arbusto" || sp === "flores") {
    const n = sp === "flores" ? 5 : 8;
    for (let i = 0; i < n; i++) blob(leaf, V((R() - 0.5) * H * 0.9, H * (0.35 + R() * 0.25), (R() - 0.5) * H * 0.9), H * (0.3 + R() * 0.15) * (0.6 + fol * 0.5), R, 0.8);
    if (sp === "flores") for (let i = 0; i < 40; i++) { const a = R() * Math.PI * 2, d = R() * H * 0.7; const s = new THREE.IcosahedronGeometry(H * 0.06, 0); s.translate(Math.cos(a) * d, H * (0.5 + R() * 0.35), Math.sin(a) * d); flower.push(s); }
  } else if (sp === "helecho") {
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2 + R() * 0.4; frond(leaf, V(0, H * 0.05, 0), V(Math.cos(a), 1.1, Math.sin(a)).normalize(), H * (0.9 + R() * 0.4), H * 0.12, 0.9, R, 12, true); }
  } else if (sp === "pasto") {
    for (let i = 0; i < 70 * fol + 10; i++) { const a = R() * Math.PI * 2, d = Math.sqrt(R()) * H * 0.8; frond(leaf, V(Math.cos(a) * d, 0, Math.sin(a) * d), V((R() - 0.5) * 0.5, 1, (R() - 0.5) * 0.5).normalize(), H * (0.6 + R() * 0.5), H * 0.02, 0.5 + R() * 0.5, R, 4); }
  } else if (sp === "cactus") {
    const r = H * 0.08 * th; limb(wood, V(0, 0, 0), V(0, H, 0), r, r * 0.92, 12); blob(wood, V(0, H, 0), r * 0.95, R, 0.6);
    for (let i = 0; i < 2 + (R() < 0.5 ? 1 : 0); i++) { const a = R() * Math.PI * 2, y = H * (0.3 + R() * 0.3), side = V(Math.cos(a), 0, Math.sin(a)), elbow = V(0, y, 0).addScaledVector(side, r * 2.6), up = elbow.clone().add(V(0, H * (0.25 + R() * 0.2), 0)); limb(wood, V(0, y, 0), elbow, r * 0.6, r * 0.6, 10); limb(wood, elbow, up, r * 0.6, r * 0.55, 10); blob(wood, up, r * 0.58, R, 0.6); }
    for (let i = 0; i < 4 && fol; i++) { const s = new THREE.IcosahedronGeometry(r * 0.25, 0); s.translate((R() - 0.5) * r, H + r * 0.6, (R() - 0.5) * r); flower.push(s); }
  } else if (sp === "tronco") {
    const r = H * 0.09 * th, a = V(-H / 2, r * 0.85, 0), b = V(H / 2, r * 0.8, 0);
    limb(wood, a, b, r, r * 0.85, 12);
    for (let i = 0; i < 3; i++) { const x = (R() - 0.5) * H * 0.8; limb(wood, V(x, r * 1.4, 0), V(x + (R() - 0.5) * r * 2, r * 2.6 + R() * r, (R() - 0.5) * r * 2), r * 0.25, r * 0.1, 6); }
    if (fol > 0) for (let i = 0; i < 6 * fol; i++) blob(leaf, V((R() - 0.5) * H * 0.9, r * 1.7, (R() - 0.5) * r * 1.2), r * 0.45, R, 0.5);
  }
  const add = (list, part) => {
    if (!list.length) return;
    const geo = mergeGeometries(list.map(x => (x.index ? x.toNonIndexed() : x)).map(x => { for (const k of Object.keys(x.attributes)) if (k !== "position" && k !== "normal") x.deleteAttribute(k); if (!x.getAttribute("normal")) x.computeVertexNormals(); return x; }), false);
    const m = new THREE.Mesh(geo, part.side === 2 ? doubleClay : clay); m.castShadow = m.receiveShadow = true; m.userData.part = part; m.userData.noContact = true; g.add(m);
  };
  const wcol = sp === "cactus" ? "#5f7a3c" : sp === "mangle" ? "#6b5a48" : "#6f5640";
  add(wood, { color: wcol, tex: sp === "cactus" ? "follaje" : "madera" });
  add(leaf, { color: sp === "pasto" ? "#7f8f45" : sp === "pino" ? "#3f5a3a" : sp === "sauce" ? "#6f8a4a" : "#4f6b3a", tex: "follaje", side: 2 });
  add(flower, { color: sp === "palmera" ? "#8a6a3a" : p.flor || "#d8425a" });
  g.userData.parts = true;
}
const doubleClay = clay.clone(); doubleClay.side = THREE.DoubleSide;
