// Criaturas: plantillas deformables con esqueleto propio, piel continua con pesos, corazas superpuestas,
// pliegues, escamas, pelaje o plumas. Se posan por articulación y con poses rápidas por plantilla.
import * as THREE from "three";
import { texturedMat, clay } from "./util.js";
import { strands } from "./humandress.js";

export const SURFACES = { piel: "Piel lisa", rugosa: "Piel rugosa", escamas: "Escamas", pelaje: "Pelaje", plumas: "Plumas", quitina: "Quitina" };
export const ARMORS = { ninguna: "Sin coraza", bandas: "Bandas superpuestas", escudos: "Escudos en el lomo", placas: "Placas en todo el cuerpo" };
// proporciones en unidades relativas; «length» es el largo total en metros
const base = { length: 2, bodyLen: 1, bodyH: 0.3, bodyW: 0.34, neckLen: 0.25, neckW: 0.6, neckAng: 25, headLen: 0.3, headW: 0.7, snout: 0.5, tailLen: 0.6, tailW: 0.6, legPairs: 2, legLen: 0.45, legW: 0.35, sprawl: 0, footLen: 0.12, claws: 4, horns: 0, hornLen: 0.2, ears: 0, spikes: 0, armor: "ninguna", armorSize: 0.6, teeth: 0, bulk: 0.4, hump: 0, frontLeg: 1, frontLegW: 1, belly: 0.75, brow: 0.4, folds: 0.3, surface: "piel", upright: false, wings: false, fins: false, seed: 3, color: "#7d7262" };
export const TEMPLATES = {
  reptil: { label: "Reptil y anfibio", ...base, teeth: 0.6, length: 3, bodyLen: 1, bodyH: 0.3, bodyW: 0.42, bulk: 0.7, brow: 0.7, hump: 0.35, frontLegW: 1.15, neckLen: 0.14, neckW: 0.75, neckAng: 8, headLen: 0.36, headW: 0.62, snout: 0.75, tailLen: 1.3, tailW: 0.7, legLen: 0.34, legW: 0.5, sprawl: 0.7, footLen: 0.2, claws: 5, armor: "placas", armorSize: 0.7, folds: 0.7, surface: "rugosa", color: "#6c6a55" },
  cuadrupedo: { label: "Cuadrúpedo", ...base, teeth: 0.6, length: 2, bodyH: 0.34, neckLen: 0.35, neckAng: 35, legLen: 0.65, legW: 0.28, tailLen: 0.55, tailW: 0.35, surface: "pelaje", ears: 1, color: "#7a5a3c" },
  ave: { label: "Ave", ...base, length: 0.9, bodyLen: 0.55, bodyH: 0.4, bodyW: 0.4, neckLen: 0.45, neckW: 0.45, neckAng: 55, headLen: 0.22, snout: 0.4, tailLen: 0.35, tailW: 0.3, legPairs: 1, legLen: 0.55, legW: 0.18, claws: 3, wings: true, surface: "plumas", color: "#5b5047" },
  serpiente: { label: "Serpiente", ...base, length: 4, bodyLen: 2.4, bodyH: 0.09, bodyW: 0.1, neckLen: 0.05, neckW: 0.9, neckAng: 0, headLen: 0.14, headW: 1.25, snout: 0.4, tailLen: 1.6, tailW: 0.9, legPairs: 0, folds: 0.1, surface: "escamas", color: "#4e5a3a" },
  pez: { label: "Pez", ...base, length: 1.2, bodyLen: 0.8, bodyH: 0.42, bodyW: 0.2, neckLen: 0.02, neckAng: 0, headLen: 0.28, headW: 0.9, snout: 0.3, tailLen: 0.45, tailW: 0.4, legPairs: 0, fins: true, folds: 0, surface: "escamas", color: "#5d7a86" },
  insecto: { label: "Insectoide", ...base, length: 1, bodyLen: 0.9, bodyH: 0.2, bodyW: 0.26, neckLen: 0.06, neckW: 0.4, neckAng: 5, headLen: 0.2, headW: 0.8, snout: 0.2, tailLen: 0.7, tailW: 1.3, legPairs: 3, legLen: 0.6, legW: 0.12, sprawl: 0.9, claws: 2, horns: 2, hornLen: 0.35, folds: 0, surface: "quitina", armor: "placas", color: "#3a352e" },
  aracnido: { label: "Arácnido", ...base, length: 1, bodyLen: 0.5, bodyH: 0.24, bodyW: 0.36, neckLen: 0.02, neckAng: 0, headLen: 0.25, headW: 0.9, snout: 0.15, tailLen: 0.6, tailW: 1.6, legPairs: 4, legLen: 0.85, legW: 0.1, sprawl: 0.95, claws: 1, folds: 0, surface: "pelaje", color: "#2e2a27" },
  bipedo: { label: "Bípedo no humano", ...base, teeth: 0.6, length: 2.4, bodyLen: 0.75, bodyH: 0.38, bodyW: 0.5, neckLen: 0.18, neckAng: 70, headLen: 0.3, snout: 0.45, tailLen: 0.7, legPairs: 2, legLen: 0.95, legW: 0.4, upright: true, claws: 4, surface: "rugosa", armor: "escudos", folds: 0.5, bodyLen: 0.95, legLen: 0.7, legW: 0.3, color: "#5a5a50" },
  colosal: { label: "Colosal", ...base, teeth: 0.6, length: 30, bodyLen: 1, bodyH: 0.38, bodyW: 0.5, neckLen: 0.3, neckAng: 30, headLen: 0.3, snout: 0.55, tailLen: 1.1, legLen: 0.55, legW: 0.5, sprawl: 0.2, spikes: 0.7, armor: "placas", folds: 0.7, surface: "rugosa", color: "#4b4a44" },
};
export const QUICK_POSES = { reposo: "Reposo", caminar: "Caminando", acechar: "Acechando", rugir: "Rugiendo", erguido: "Erguido", enroscado: "Enroscado" };
export function newCreatureParams(t = "reptil") { const T = TEMPLATES[t] || TEMPLATES.reptil; const { label, ...p } = T; return { template: t, ...p }; }

const rng = seed => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ esqueleto en reposo
function skeletonPlan(p) {
  const S = 1, bl = p.bodyLen, legH = p.legPairs ? p.legLen * (1 - p.sprawl * 0.55) : 0;
  const bones = []; const add = (name, parent, pos) => { bones.push({ name, parent, pos }); return name; };
  const y0 = (p.legPairs ? legH : 0) + p.bodyH * 0.5;
  add("raiz", null, V(0, 0, 0));
  const hipsP = p.upright ? V(0, legH + p.bodyH * 0.2, 0) : V(0, y0, -bl / 2);
  add("cadera", "raiz", hipsP);
  // lomo: de la cadera al pecho
  const nS = Math.max(2, Math.round(bl * 4)), chestP = p.upright ? hipsP.clone().add(V(0, bl, bl * 0.12)) : V(0, y0 + p.bodyH * 0.05, bl / 2);
  let prev = "cadera";
  const axial = [{ name: "cadera", p: hipsP.clone() }];
  for (let i = 1; i <= nS; i++) { const n = i === nS ? "pecho" : "lomo" + i, q = hipsP.clone().lerp(chestP, i / nS); prev = add(n, prev, q); axial.push({ name: n, p: q }); }
  // cuello y cabeza
  const nN = Math.max(1, Math.round(p.neckLen * 6)), ang = THREE.MathUtils.degToRad(p.upright ? Math.max(p.neckAng, 60) : p.neckAng);
  const ndir = p.upright ? V(0, Math.sin(ang), Math.cos(ang) * 0.6).normalize() : V(0, Math.sin(ang), Math.cos(ang));
  let q = chestP.clone();
  for (let i = 1; i <= nN; i++) { q = q.clone().addScaledVector(ndir, p.neckLen / nN); prev = add("cuello" + i, prev, q); axial.push({ name: "cuello" + i, p: q }); }
  const headP = q.clone().addScaledVector(ndir, p.headLen * 0.15);
  add("cabeza", prev, headP); axial.push({ name: "cabeza", p: headP });
  const hdir = V(0, -0.15, 1).normalize();
  const snoutTip = headP.clone().addScaledVector(hdir, p.headLen * (0.55 + p.snout));
  add("mandibula", "cabeza", headP.clone().add(V(0, -p.headLen * 0.12 * p.headW, -p.headLen * 0.05)));
  // cola: de la cadera hacia atrás, bajando un poco
  const nT = Math.max(2, Math.round(p.tailLen * 6)); prev = "cadera";
  const tail = [];
  for (let i = 1; i <= nT; i++) { const t = i / nT, tq = hipsP.clone().add(V(0, -p.bodyH * 0.25 * t - (p.upright ? legH * 0.7 * t : 0), -p.tailLen * t)); if (p.tailLen > 0.02) { prev = add("cola" + i, prev, tq); tail.push({ name: "cola" + i, p: tq }); } }
  // patas: pares repartidos entre la cadera y el pecho (traseras primero)
  const legs = [];
  for (let k = 0; k < p.legPairs + (p.wings ? 1 : 0); k++) {
    const wingPair = k === p.legPairs;
    const front = wingPair || (k === p.legPairs - 1 && p.legPairs > 1);
    const t = wingPair ? 0.92 : p.legPairs === 1 ? 0 : k / (p.legPairs - 1);
    const attachAt = p.upright ? (front ? chestP.clone().add(V(0, -p.bodyH * 0.1, 0)) : hipsP) : hipsP.clone().lerp(chestP, t);
    const parent = axial.reduce((b, a) => (a.p.distanceTo(attachAt) < b.p.distanceTo(attachAt) && !a.name.startsWith("cuello") && a.name !== "cabeza" ? a : b), axial[0]).name;
    const isArm = p.upright && front && !wingPair, isWing = wingPair;
    const L = isWing ? p.bodyLen * 0.8 + p.neckLen * 0.5 : isArm ? p.legLen * 0.62 * (p.frontLeg ?? 1) : p.legLen * (front ? p.frontLeg ?? 1 : 1);
    for (const [side, sx] of [["I", 1], ["D", -1]]) {
      const hip = attachAt.clone().add(V(sx * p.bodyW * 0.42, isWing ? p.bodyH * 0.3 : isArm ? -p.bodyH * 0.05 : -p.bodyH * 0.25, 0));
      const sp = isWing ? 1 : p.sprawl;
      const knee = hip.clone().add(V(sx * L * 0.45 * sp + sx * 0.02, -L * 0.45 * (1 - sp * 0.85), (front ? -L * 0.08 : L * 0.12) * (1 - sp)));
      const ankle = isWing ? knee.clone().add(V(sx * L * 0.6, 0.02, -L * 0.1)) : isArm ? knee.clone().add(V(sx * L * 0.04, -L * 0.48, L * 0.12)) : V(knee.x + sx * L * 0.05 * sp, Math.max(0.02 * L, knee.y - L * 0.48), knee.z + (front ? L * 0.06 : -L * 0.18) * (1 - sp));
      const toe = isWing ? ankle.clone().add(V(sx * L * 0.7, -0.02, -L * 0.15)) : isArm ? ankle.clone().add(V(0, -p.footLen * 0.9, p.footLen * 0.3)) : ankle.clone().add(V(sx * p.footLen * 0.2 * sp, -ankle.y + 0.005, p.footLen * (p.upright ? 1.2 : 1)));
      const nm = wingPair ? `ala${side}` : `pata${k + 1}${side}`;
      add(nm + "_1", parent, hip); add(nm + "_2", nm + "_1", knee); add(nm + "_3", nm + "_2", ankle); add(nm + "_4", nm + "_3", toe);
      legs.push({ name: nm, side: sx, pts: [hip, knee, ankle, toe], wing: isWing, arm: isArm, front });
    }
  }
  return { bones, axial, tail, legs, headP, snoutTip, hdir, ndir };
}

// ------------------------------------------------------------------ malla
function lerpPath(pts, t) { // t en largo de arco 0..1
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + pts[i].p.distanceTo(pts[i - 1].p));
  const s = t * L.at(-1); let i = 1; while (i < L.length - 1 && L[i] < s) i++;
  const u = (s - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]);
  return { p: pts[i - 1].p.clone().lerp(pts[i].p, u), a: pts[i - 1].name, b: pts[i].name, u, tan: pts[i].p.clone().sub(pts[i - 1].p).normalize() };
}
export function buildCreature(o) {
  const p = { ...newCreatureParams(o.cparams?.template), ...(o.cparams || {}) };
  const plan = skeletonPlan(p), rnd = rng(p.seed);
  const total = p.bodyLen + p.tailLen + p.neckLen + p.headLen * (1 + p.snout);
  const k = p.length / total; // escala a metros
  const root = new THREE.Group(); root.userData.isCreature = true;
  // huesos
  const bonesBy = {}, list = [];
  for (const b of plan.bones) {
    const bone = new THREE.Bone(); bone.name = b.name; bonesBy[b.name] = bone; list.push(bone);
    const wp = b.pos.clone().multiplyScalar(k); bone.userData.rest = wp;
    if (b.parent) { bonesBy[b.parent].add(bone); bone.position.copy(wp).sub(bonesBy[b.parent].userData.rest); } else bone.position.copy(wp);
  }
  const bi = n => list.indexOf(bonesBy[n]);
  const pos = [], skI = [], skW = [], idx = [], col = [];
  let bellyK = 1;
  const ring = (center, tan, up, rx, ry, segs, bonesW, profile) => {
    const side = new THREE.Vector3().crossVectors(up, tan).normalize(), u2 = new THREE.Vector3().crossVectors(tan, side).normalize();
    const start = pos.length / 3;
    for (let j = 0; j < segs; j++) {
      const a = j / segs * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
      const pr = profile ? profile(a) : 1;
      const q = center.clone().addScaledVector(side, c * rx * pr).addScaledVector(u2, s * ry * pr * (s < 0 ? bellyK : 1));
      pos.push(q.x, q.y, q.z); skI.push(...bonesW.map(x => x[0]), ...Array(4 - bonesW.length).fill(0)); skW.push(...bonesW.map(x => x[1]), ...Array(4 - bonesW.length).fill(0));
      col.push(s < -0.3 ? 1.12 : 1, s < -0.3 ? 1.08 : 1, s < -0.3 ? 1.0 : 1); // vientre más claro
    }
    return start;
  };
  const jaw = new Set();
  // la boca: no se cosen las caras entre la mandíbula y el resto de la cabeza, para que pueda abrirse
  const stitch = (a, b, segs) => { for (let j = 0; j < segs; j++) { const j2 = (j + 1) % segs; if (jaw.has(b + j) !== jaw.has(b + j2)) continue; idx.push(a + j, b + j, a + j2, a + j2, b + j, b + j2); } };
  const cap = (a, segs, tip, bw, flip) => {
    const add = (bwx) => { const c = pos.length / 3; pos.push(tip.x, tip.y, tip.z); skI.push(...bwx.map(x => x[0]), ...Array(4 - bwx.length).fill(0)); skW.push(...bwx.map(x => x[1]), ...Array(4 - bwx.length).fill(0)); col.push(1, 1, 1); return c; };
    const c = add(bw), cj = jaw.has(a) || jaw.has(a + segs - 1) || [...Array(segs).keys()].some(j => jaw.has(a + j)) ? add([[bi("mandibula"), 1]]) : -1;
    for (let j = 0; j < segs; j++) { const j2 = (j + 1) % segs, ja = jaw.has(a + j), jb = jaw.has(a + j2); if (ja !== jb) continue; const t = ja ? cj : c; if (flip) idx.push(a + j, t, a + j2); else idx.push(a + j2, t, a + j); }
  };
  // eje del cuerpo: punta de la cola → cola → cadera → lomo → cuello → cabeza → hocico
  const axis = [...plan.tail.slice().reverse(), ...plan.axial, { name: "cabeza", p: plan.snoutTip }].map(a => ({ name: a.name, p: a.p.clone().multiplyScalar(k) }));
  const nR = Math.max(40, Math.round(total * 30)), SEG = 22;
  const tailFrac = p.tailLen / total, bodyEnd = (p.tailLen + p.bodyLen) / total, neckEnd = (p.tailLen + p.bodyLen + p.neckLen) / total;
  const R = (t) => { // radio relativo a lo largo del eje
    const bh = p.bodyH * k * 0.5, bw = p.bodyW * k * 0.5;
    let f;
    if (p.profile && t < neckEnd) { const u = t / neckEnd * (p.profile.length - 1), i0 = Math.floor(u), fr = u - i0; f = p.profile[i0] * (1 - fr) + (p.profile[Math.min(p.profile.length - 1, i0 + 1)] ?? 0) * fr; }
    else if (t < tailFrac) { const u = t / Math.max(1e-4, tailFrac); f = Math.pow(u, 0.9) * p.tailW; }
    else if (t < bodyEnd) { const u = (t - tailFrac) / (bodyEnd - tailFrac); f = 0.75 + 0.25 * Math.sin(Math.PI * Math.min(1, u * 1.1 + 0.05)); f = Math.max(f, p.tailW); }
    else if (t < neckEnd) { const u = (t - bodyEnd) / Math.max(1e-4, neckEnd - bodyEnd); f = 0.9 * (1 - u) + p.neckW * u; }
    else { const u = (t - neckEnd) / (1 - neckEnd); f = p.headW * (u < 0.3 ? 0.85 + u * 0.5 : u < 0.88 ? 1 - (u - 0.3) * (0.55 - p.snout * 0.2) : Math.max(0.05, (1 - 0.58 * (0.55 - p.snout * 0.2)) * Math.sqrt(Math.max(0, 1 - ((u - 0.88) / 0.12) ** 2)))) * (p.neckW + 0.4) * 0.8; }
    // pliegues: arrugas en anillo cerca del cuello y del nacimiento de la cola
    const ridge = Math.pow(Math.abs(Math.sin(t * 190)), 6);
    const w = p.folds * 0.16 * (Math.exp(-(((t - bodyEnd) / 0.06) ** 2)) + Math.exp(-(((t - tailFrac) / 0.07) ** 2)) * 0.7 + 0.25) * ridge;
    const hu = (t - neckEnd) / (1 - neckEnd);
    return [bw * f * (1 + w), bh * f * (1 + w) * (t > neckEnd ? 0.8 - Math.max(0, hu - 0.3) * 0.45 : 1)];
  };
  let prevRing = -1, first = -1;
  const rings = [];
  for (let i = 0; i <= nR; i++) {
    const t = i / nR, s = lerpPath(axis, t);
    const [rx, ry] = R(t);
    // línea del lomo: el arco medido en tu dibujo y la joroba de los hombros suben o bajan el centro del cuerpo
    let lift = 0;
    if (p.arch && t < neckEnd) { const u = t / neckEnd * (p.arch.length - 1), i0 = Math.floor(u), fr = u - i0; lift += (p.arch[i0] * (1 - fr) + (p.arch[Math.min(p.arch.length - 1, i0 + 1)] ?? 0) * fr) * p.bodyH * k * 0.5; }
    if (p.hump) lift += p.hump * p.bodyH * k * 0.35 * Math.exp(-(((t - (bodyEnd - (bodyEnd - tailFrac) * 0.18)) / 0.08) ** 2));
    if (lift) s.p.y += lift;
    const up = Math.abs(s.tan.y) > 0.95 ? V(0, 0, -1) : V(0, 1, 0);
    const bw = s.a === s.b ? [[bi(s.a), 1]] : [[bi(s.a), 1 - s.u], [bi(s.b), s.u]];
    // la parte de abajo del hocico va con la mandíbula
    bellyK = t > tailFrac * 0.5 && t < neckEnd ? p.belly : 1;
    const r0 = ring(s.p, s.tan, up, Math.max(rx, 0.002), Math.max(ry, 0.002), SEG, bw);
    if (t > neckEnd + (1 - neckEnd) * 0.25) for (let j = 0; j < SEG; j++) if (Math.sin(j / SEG * Math.PI * 2) < -0.2) { const v = r0 + j; jaw.add(v); skI.splice(v * 4, 4, bi("mandibula"), 0, 0, 0); skW.splice(v * 4, 4, 1, 0, 0, 0); }
    if (prevRing >= 0) stitch(prevRing, r0, SEG); else first = r0;
    prevRing = r0; rings.push({ start: r0, t, p: s.p, tan: s.tan, up, rx, ry, bw });
  }
  cap(first, SEG, axis[0].p.clone().addScaledVector(axis[0].p.clone().sub(axis[1].p).normalize(), 0.01 * k), [[bi(axis[0].name), 1]], true);
  cap(prevRing, SEG, plan.snoutTip.clone().multiplyScalar(k).addScaledVector(plan.hdir, 0.01 * k), [[bi("cabeza"), 1]], false);
  // patas como tubos que se afinan, con pie y garras
  const legW = p.legW * Math.max(p.bodyH, p.bodyW) * k * 0.55;
  for (const L of plan.legs) {
    const pts = L.pts.map(x => x.clone().multiplyScalar(k)), names = [1, 2, 3, 4].map(i => `${L.name}_${i}`);
    let pr = -1;
    const n = 18;
    for (let i = 0; i <= n; i++) {
      const t = i / n * 3, seg = Math.min(2, Math.floor(t)), u = t - seg;
      const c = pts[seg].clone().lerp(pts[seg + 1], u), tan = pts[seg + 1].clone().sub(pts[seg]).normalize();
      const r = legW * (L.wing ? 0.45 : 1) * (L.front && !L.wing ? p.frontLegW ?? 1 : 1) * (1.3 - 0.62 * Math.min(1, t / 2.4)) * (1 + p.folds * 0.08 * Math.sin(t * 18) * Math.exp(-(((u - 0) / 0.25) ** 2)));
      const bw = u < 0.2 && seg > 0 ? [[bi(names[seg - 1]), 0.5 - u * 2.5], [bi(names[seg]), 0.5 + u * 2.5]] : [[bi(names[seg]), 1]];
      const up = Math.abs(tan.y) > 0.9 ? V(0, 0, 1) : V(0, 1, 0);
      const r0 = ring(c, tan, up, r, r * (L.wing ? 0.35 : 0.95), 14, bw);
      if (pr >= 0) stitch(pr, r0, 14);
      pr = r0;
    }
    // masa muscular del hombro o de la cadera: lo que hace que se vea pesada
    if (p.bulk > 0 && !L.wing && p.legW > 0.2) {
      const mus = new THREE.SphereGeometry(1, 16, 12), m = legW * (L.front ? p.frontLegW ?? 1 : 1) * (0.7 + p.bulk * 0.4);
      mus.scale(m * 0.75, m * 1.1, m * 1.3);
      const parentBone = list.indexOf(bonesBy[names[0]].parent);
      appendGeo(mus, pts[0].clone().lerp(pts[1], 0.12).add(V(-L.side * m * 0.45, m * 0.1, 0)), new THREE.Quaternion().setFromEuler(new THREE.Euler(L.front ? -0.25 : 0.25, 0, L.side * 0.2)), bi(names[0]), parentBone, 1);
    }
    // pie: elipsoide plano que va del tobillo a la punta
    const ankle = pts[2], toe = pts[3], fdir = toe.clone().sub(ankle);
    const foot = new THREE.SphereGeometry(1, 14, 8); foot.scale(legW * (L.wing ? 0.4 : 1.1), legW * 0.45, fdir.length() * 0.55);
    const fq = new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), fdir.clone().normalize());
    appendGeo(foot, ankle.clone().lerp(toe, 0.5), fq, bi(names[2]));
    // garras
    if (!L.wing) for (let c = 0; c < p.claws; c++) {
      const sp = (c - (p.claws - 1) / 2) * legW * 0.55;
      const claw = new THREE.ConeGeometry(legW * 0.16, legW * 0.9, 6); claw.rotateX(Math.PI / 2);
      const side = new THREE.Vector3().crossVectors(V(0, 1, 0), fdir.clone().normalize()).normalize();
      appendGeo(claw, toe.clone().addScaledVector(side, sp).add(V(0, legW * 0.1, 0)), new THREE.Quaternion().setFromUnitVectors(V(0, 0, 1), fdir.clone().normalize().add(V(0, -0.4, 0)).normalize()), bi(names[2]));
    }
    // ala: una membrana o plumas largas entre el ala y el cuerpo
    if (L.wing) {
      const span = pts[3].clone().sub(pts[0]), wl = new THREE.PlaneGeometry(1, 1, 6, 2);
      wl.scale(span.length(), p.bodyLen * k * 1.1, 1); wl.rotateX(-Math.PI / 2);
      { const wp = wl.getAttribute("position"); for (let i = 0; i < wp.count; i++) { const u = wp.getX(i) / span.length() + 0.5; wp.setZ(i, wp.getZ(i) * (1 - u * 0.75) + p.bodyLen * k * 0.25 * (1 - u)); } }
      appendGeo(wl, pts[0].clone().lerp(pts[3], 0.5).add(V(0, 0, -p.bodyLen * k * 0.2)), new THREE.Quaternion().setFromUnitVectors(V(1, 0, 0), span.clone().normalize()), bi(names[1]));
    }
  }
  function appendGeo(geo, at, quat, bone, bone2 = -1, shade = 0.85) {
    const g = geo.index ? geo.toNonIndexed() : geo, a = g.getAttribute("position"), start = pos.length / 3;
    for (let i = 0; i < a.count; i++) { const v = V(a.getX(i), a.getY(i), a.getZ(i)).applyQuaternion(quat).add(at); pos.push(v.x, v.y, v.z); if (bone2 >= 0) { skI.push(bone, bone2, 0, 0); skW.push(0.5, 0.5, 0, 0); } else { skI.push(bone, 0, 0, 0); skW.push(1, 0, 0, 0); } col.push(shade, shade, shade); }
    for (let i = 0; i < a.count; i++) idx.push(start + i);
  }
  // ojos, cuernos, orejas y púas del lomo (rígidos a su hueso)
  const head = plan.headP.clone().multiplyScalar(k), hl = p.headLen * k, hd = plan.hdir;
  const [hrx, hry] = R(1 - (1 - neckEnd) * 0.6);
  for (const sx of [1, -1]) {
    if (p.brow > 0) { const br = new THREE.SphereGeometry(1, 12, 8); br.scale(hrx * 0.35, hry * 0.18 * (0.6 + p.brow), hl * 0.28); appendGeo(br, head.clone().addScaledVector(hd, hl * 0.3).add(V(sx * hrx * 0.62, hry * 0.62, 0)), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, sx * 0.25, sx * -0.3)), bi("cabeza"), -1, 0.8); }
    const eye = new THREE.SphereGeometry(Math.max(0.004, hl * 0.07), 10, 8);
    appendGeo(eye, head.clone().addScaledVector(hd, hl * 0.32).add(V(sx * hrx * 0.82, hry * 0.45, 0)), new THREE.Quaternion(), bi("cabeza"));
    for (let h = 0; h < p.horns; h++) {
      const horn = new THREE.ConeGeometry(hl * 0.07, p.hornLen * k, 7); horn.translate(0, p.hornLen * k / 2, 0);
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9 - h * 0.3, 0, sx * (0.35 + h * 0.25)));
      appendGeo(horn, head.clone().add(V(sx * hrx * (0.4 + h * 0.2), hry * 0.75, -hl * 0.05 * h)), q, bi("cabeza"));
    }
    if (p.ears) { const ear = new THREE.ConeGeometry(hl * 0.12 * p.ears, hl * 0.4 * p.ears, 5); ear.scale(1, 1, 0.35); ear.translate(0, hl * 0.2 * p.ears, 0); appendGeo(ear, head.clone().add(V(sx * hrx * 0.6, hry * 0.8, -hl * 0.12)), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.3, 0, sx * 0.35)), bi("cabeza")); }
  }
  // dientes: conos en el borde de la quijada de arriba y de abajo
  if (p.teeth) {
    const hr = rings.filter(r => r.t > neckEnd + (1 - neckEnd) * 0.3 && r.t < 0.985), n = Math.min(hr.length, 9);
    for (let i = 0; i < n; i++) { const r = hr[Math.floor(i / n * hr.length)], side = new THREE.Vector3().crossVectors(r.up, r.tan).normalize(), u2 = new THREE.Vector3().crossVectors(r.tan, side).normalize();
      for (const sx of [1, -1]) for (const low of [0, 1]) {
        const a = -Math.PI / 2 + sx * (Math.PI / 2 + 0.2) , th = Math.max(r.rx, r.ry) * 0.45 * p.teeth * (low ? 0.8 : 1);
        const tooth = new THREE.ConeGeometry(th * 0.28, th, 5); tooth.translate(0, -th / 2, 0); if (low) tooth.rotateX(Math.PI);
        const at = r.p.clone().addScaledVector(side, Math.cos(a) * r.rx * 0.9).addScaledVector(u2, Math.sin(a) * r.ry * 0.9);
        appendGeo(tooth, at, new THREE.Quaternion(), bi(low ? "mandibula" : "cabeza"), -1, 1.25);
      } }
  }
  // corazas: bandas que se enciman (como tejas) sobre lomo y cola; escudos en filas; placas también en patas
  const armorMat = p.surface === "quitina" ? "quitina" : "rugosa";
  if (p.armor !== "ninguna" || p.spikes > 0) {
    const step = Math.max(2, Math.round(nR / (10 + p.armorSize * 14)));
    for (let i = 2; i < rings.length - 3; i += step) {
      const r = rings[i]; if (r.t > neckEnd + 0.02 && p.armor !== "placas") continue;
      const side = new THREE.Vector3().crossVectors(r.up, r.tan).normalize(), u2 = new THREE.Vector3().crossVectors(r.tan, side).normalize();
      if (p.armor === "bandas" || p.armor === "placas") {
        // banda: arco de 220° un poco más ancho que el cuerpo, con el borde trasero levantado
        const arc = 16, len = step / nR * axisLen(axis) * 1.35, out = 1.03 + p.armorSize * 0.06;
        const s0 = pos.length / 3;
        for (let row = 0; row < 3; row++) for (let j = 0; j <= arc; j++) {
          const a = -Math.PI * 0.1 + j / arc * Math.PI * 1.2, c = Math.cos(a), s = Math.sin(a);
          const lift = row === 2 ? 1.07 + p.armorSize * 0.05 : row === 1 ? 1.03 : 0.98; const back = (row - 1) * len * 0.5;
          const q = r.p.clone().addScaledVector(r.tan, -back).addScaledVector(side, c * r.rx * out * lift).addScaledVector(u2, s * r.ry * out * lift + (row === 2 ? r.ry * 0.04 : 0));
          pos.push(q.x, q.y, q.z); skI.push(...r.bw.map(x => x[0]), ...Array(4 - r.bw.length).fill(0)); skW.push(...r.bw.map(x => x[1]), ...Array(4 - r.bw.length).fill(0)); col.push(row === 2 ? 0.6 : 0.78, row === 2 ? 0.6 : 0.78, row === 2 ? 0.58 : 0.76);
        }
        for (let row = 0; row < 2; row++) for (let j = 0; j < arc; j++) { const a = s0 + row * (arc + 1) + j, b = a + arc + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
      }
      if (p.armor === "escudos" || p.armor === "placas") {
        // placas óseas encimadas como tejas: filas alternadas, cada placa inclinada hacia atrás con su borde levantado
        const rows = 3 + Math.round(p.armorSize * 4), span = p.armor === "placas" ? 2.4 : 1.5, odd = Math.round((i - 2) / step) % 2;
        const segLen = step / nR * axisLen(axis), rad = Math.max(r.rx, r.ry);
        for (let rr = 0; rr < rows; rr++) {
          const a = Math.PI / 2 + ((rr + (odd ? 0.5 : 0)) / rows - 0.5) * span, c = Math.cos(a), s = Math.sin(a);
          if (s < -0.1) continue;
          const pw = rad * span / rows * 1.15 * (0.85 + rnd() * 0.3), pl = segLen * (1.25 + p.armorSize * 0.35), pt = rad * 0.05 * (0.6 + p.armorSize);
          const plate = new THREE.BoxGeometry(pw, pt, pl, 2, 1, 2), pp = plate.getAttribute("position");
          for (let q = 0; q < pp.count; q++) { const x = pp.getX(q) / pw, z = pp.getZ(q) / pl; pp.setY(q, pp.getY(q) - (x * x) * pt * 2.5 + (z < 0 ? -z * pt * 1.6 : 0)); }
          plate.computeVertexNormals();
          const nrm = side.clone().multiplyScalar(c).addScaledVector(u2, s).normalize(), at = r.p.clone().addScaledVector(side, c * r.rx * 1.02).addScaledVector(u2, s * r.ry * 1.02);
          const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(nrm, r.tan).normalize(), nrm, r.tan.clone().negate());
          const quat = new THREE.Quaternion().setFromRotationMatrix(basis).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.22, 0, 0)));
          appendGeo(plate, at.addScaledVector(r.tan, -pl * 0.25), quat, r.bw[0][0], r.bw[1]?.[0] ?? -1, 0.68 + rnd() * 0.12);
        }
      }
      if (p.spikes > 0 && i % (step * 2) === 2 % (step * 2)) {
        const sp = new THREE.ConeGeometry(Math.max(r.rx, r.ry) * 0.12, Math.max(r.rx, r.ry) * 0.6 * p.spikes, 5);
        sp.translate(0, Math.max(r.rx, r.ry) * 0.3 * p.spikes, 0);
        appendGeo(sp, r.p.clone().addScaledVector(u2, r.ry * 0.95), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), u2.clone().addScaledVector(r.tan, -0.4).normalize()), r.bw[0][0]);
      }
    }
  }
  function axisLen(ax) { let s = 0; for (let i = 1; i < ax.length; i++) s += ax[i].p.distanceTo(ax[i - 1].p); return s; }
  // aletas del pez: dorsal y de la cola
  if (p.fins) {
    const r = rings[Math.round(rings.length * 0.55)], fin = new THREE.PlaneGeometry(p.bodyLen * k * 0.5, p.bodyH * k * 0.5, 4, 2); fin.rotateY(Math.PI / 2);
    appendGeo(fin, r.p.clone().add(V(0, r.ry + p.bodyH * k * 0.2, 0)), new THREE.Quaternion(), r.bw[0][0]);
    const tf = new THREE.PlaneGeometry(p.bodyH * k * 0.9, p.bodyH * k * 1.1, 2, 4); tf.rotateY(Math.PI / 2);
    appendGeo(tf, axis[0].p.clone().add(V(0, 0, -p.bodyH * k * 0.3)), new THREE.Quaternion(), bi(axis[0].name));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(skI, 4)); geo.setAttribute("skinWeight", new THREE.Float32BufferAttribute(skW, 4));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  const mat = matFor(p, o.color || p.color, true, THREE.DoubleSide);
  const mesh = new THREE.SkinnedMesh(geo, mat); mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.computeBoundingSphere = function () { this.boundingSphere = new THREE.Sphere(V(0, p.length * 0.2, 0), p.length * 1.2); };
  root.add(mesh); root.add(list[0]);
  root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(list));
  // pelaje y plumas: cintas que salen de la piel y siguen al hueso de su raíz
  if (p.surface === "pelaje" || p.surface === "plumas") {
    const roots = [], posA = geo.getAttribute("position"), nA = geo.getAttribute("normal"), n0 = rings.length * SEG;
    const count = Math.min(6000, Math.round(p.length * (p.surface === "plumas" ? 900 : 1800)));
    for (let i = 0; i < count; i++) {
      const v = (rnd() * n0) | 0, n = V(nA.getX(v), nA.getY(v), nA.getZ(v)); if (n.y < -0.6 && p.surface === "pelaje" && rnd() < 0.6) continue;
      const tan = rings[Math.floor(v / SEG)]?.tan || V(0, 0, 1);
      roots.push({ p: V(posA.getX(v), posA.getY(v), posA.getZ(v)), n, dir: tan.clone().negate().addScaledVector(n, -tan.dot(n)).normalize(), len: p.length * (p.surface === "plumas" ? 0.05 : 0.025) * (0.6 + rnd() * 0.8), si: [skI[v * 4], skI[v * 4 + 1], skI[v * 4 + 2], skI[v * 4 + 3]], sw: [skW[v * 4], skW[v * 4 + 1], skW[v * 4 + 2], skW[v * 4 + 3]] });
    }
    const fg = strands(roots, { width: p.length * (p.surface === "plumas" ? 0.012 : 0.0035), curl: p.surface === "plumas" ? 0.02 : 0.25, lift: p.surface === "plumas" ? 0.05 : 0.3, gravity: 0.15, seed: p.seed });
    const nv = fg.getAttribute("position").count, per = nv / roots.length, si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
    roots.forEach((r, i) => { for (let j = 0; j < per; j++) { si.set(r.si, (i * per + j) * 4); sw.set(r.sw, (i * per + j) * 4); } });
    fg.setAttribute("skinIndex", new THREE.BufferAttribute(si, 4)); fg.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
    const fur = new THREE.SkinnedMesh(fg, matFor(p, o.color || p.color, true, THREE.DoubleSide, true)); fur.frustumCulled = false; fur.castShadow = true;
    fur.computeBoundingSphere = mesh.computeBoundingSphere; root.add(fur); fur.bind(mesh.skeleton, mesh.bindMatrix);
  }
  const ctl = { mesh, bones: bonesBy, list, p, k, plan };
  root.userData.creature = ctl;
  applyCreaturePose(root, o.cpose || {});
  return root;
}
function matFor(p, hex, useColor, side = THREE.FrontSide, fur = false) {
  const kind = fur ? null : p.surface === "pelaje" || p.surface === "plumas" ? "rugosa" : p.surface === "piel" ? null : p.surface;
  const m = kind ? texturedMat(useColor ? hex : null, kind, side) : new THREE.MeshStandardMaterial({ color: useColor ? hex : "#bdb6ac", roughness: 0.8, side });
  if (!fur) { const c = m.clone(); c.vertexColors = true; c.onBeforeCompile = m.onBeforeCompile; c.customProgramCacheKey = m.customProgramCacheKey; return c; }
  return m;
}
export function setCreatureStyle(root, useColor, hex) {
  const ctl = root.userData.creature; if (!ctl) return;
  root.traverse(m => { if (m.isSkinnedMesh) { const fur = m !== ctl.mesh; m.material = matFor(ctl.p, hex || ctl.p.color, useColor, THREE.DoubleSide, fur); } });
}

// ------------------------------------------------------------------ pose
export function creatureJoints(root) { return root.userData.creature ? root.userData.creature.list.filter(b => b.name !== "raiz").map(b => b.name) : []; }
export function applyCreaturePose(root, pose) {
  const ctl = root.userData.creature; if (!ctl) return;
  for (const b of ctl.list) b.quaternion.identity();
  for (const [n, r] of Object.entries(pose || {})) { const b = ctl.bones[n]; if (b && Array.isArray(r)) b.quaternion.setFromEuler(new THREE.Euler(...r.map(x => THREE.MathUtils.degToRad(x)), "XYZ")); }
  // apoyar en el piso: lo más bajo de las patas (o del cuerpo) toca y = 0
  root.updateMatrixWorld(true);
  const raiz = ctl.bones.raiz; raiz.position.y = 0; root.updateMatrixWorld(true);
  let min = Infinity; const v = new THREE.Vector3(), inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const pts = ctl.plan.legs.length ? ctl.plan.legs.filter(L => !L.arm && !L.wing).flatMap(L => [3, 4].map(i => ctl.bones[`${L.name}_${i}`])) : ctl.list;
  for (const b of pts) { v.setFromMatrixPosition(b.matrixWorld).applyMatrix4(inv); min = Math.min(min, v.y); }
  const pad = ctl.plan.legs.length ? 0.004 * ctl.p.length : ctl.p.bodyH * ctl.k * 0.5;
  if (isFinite(min)) { raiz.position.y = -min + pad; root.updateMatrixWorld(true); }
}
// Poses rápidas por plantilla: se construyen desde los nombres de los huesos que tenga
export function quickPose(root, kind) {
  const ctl = root.userData.creature; if (!ctl) return {};
  const names = Object.keys(ctl.bones), P = {}, set = (n, r) => { if (ctl.bones[n]) P[n] = r; };
  const each = (re, f) => names.filter(n => re.test(n)).forEach((n, i, arr) => f(n, i, arr.length));
  if (kind === "caminar") {
    each(/^lomo/, (n, i) => set(n, [0, Math.sin(i * 1.2) * 6, 0]));
    each(/^cola/, (n, i) => set(n, [0, Math.sin(i * 0.9 + 1) * 9, 0]));
    for (const L of ctl.plan.legs) { const ph = (L.side > 0 ? 0 : Math.PI) + (L.front ? Math.PI : 0); set(`${L.name}_1`, [Math.sin(ph) * 28, 0, 0]); set(`${L.name}_2`, [Math.max(0, Math.cos(ph)) * -30, 0, 0]); }
    set("cabeza", [-5, 6, 0]);
  } else if (kind === "acechar") {
    each(/^cuello/, n => set(n, [12, 0, 0])); set("cabeza", [-8, 0, 0]);
    for (const L of ctl.plan.legs) { set(`${L.name}_1`, [L.front ? -20 : 20, 0, L.side * 10]); set(`${L.name}_2`, [L.front ? 35 : -35, 0, 0]); }
    each(/^cola/, (n, i) => set(n, [-3, 4 * Math.sin(i), 0]));
  } else if (kind === "rugir") {
    each(/^cuello/, n => set(n, [-12, 0, 0])); set("cabeza", [-18, 0, 0]); set("mandibula", [38, 0, 0]);
    each(/^cola/, n => set(n, [-6, 0, 0]));
  } else if (kind === "erguido") {
    set("cadera", [-35, 0, 0]); each(/^lomo/, n => set(n, [-6, 0, 0])); each(/^cuello/, n => set(n, [20, 0, 0])); set("cabeza", [18, 0, 0]);
    for (const L of ctl.plan.legs) if (L.front) { set(`${L.name}_1`, [-40, 0, 0]); set(`${L.name}_2`, [-50, 0, 0]); } else { set(`${L.name}_1`, [30, 0, 0]); set(`${L.name}_2`, [-20, 0, 0]); }
    each(/^cola/, n => set(n, [12, 0, 0]));
  } else if (kind === "enroscado") {
    each(/^(lomo|cola|cuello)/, n => set(n, [0, 38, 0])); set("cabeza", [-15, -20, 0]);
  }
  return P;
}

// ------------------------------------------------------------------ criatura desde tu dibujo
// Silueta de una vista de lado: largo, alto, grosor por columna, cola (el extremo que se afila), cabeza,
// y patas (lo que baja por debajo de la panza). Devuelve plantilla y proporciones propuestas.
export async function creatureFromDrawing(side, front = null) {
  const sil = await silhouette(side), { w, h, m } = sil;
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  if (x1 <= x0) throw new Error("No se encontró una silueta cerrada en el dibujo.");
  const W = x1 - x0 + 1, top = new Float32Array(W), bot = new Float32Array(W), th = new Float32Array(W);
  for (let i = 0; i < W; i++) { let a = -1, b = -1; for (let y = y0; y <= y1; y++) if (m[y * w + x0 + i]) { if (a < 0) a = y; b = y; } top[i] = a; bot[i] = b; th[i] = a < 0 ? 0 : b - a; }
  const smooth = arr => arr.map((_, i) => { let s = 0, n = 0; for (let j = -6; j <= 6; j++) { const v = arr[i + j]; if (v !== undefined) { s += v; n++; } } return s / n; });
  // panza: la mediana de la parte baja del cuerpo, sin patas
  const sortedBot = [...bot].filter(v => v >= 0).sort((a, b) => a - b), belly = sortedBot[Math.floor(sortedBot.length * 0.35)];
  const thb = Array.from(th, (t, i) => top[i] < 0 ? 0 : Math.max(0, Math.min(bot[i], belly) - top[i]));
  const ths = smooth(thb), maxT = Math.max(...ths), H = y1 - y0;
  // cola y cabeza: el extremo que se afila en un tramo largo es la cola
  const taper = (from, dir) => { let i = from, n = 0; while (i >= 0 && i < W && ths[i] < maxT * 0.62) { i += dir; n++; } return n; };
  const tL = taper(0, 1), tR = taper(W - 1, -1);
  const tailRight = tR > tL, tailLen = Math.max(tL, tR) / W, headSide = tailRight ? 0 : W - 1;
  // patas: tramos donde lo de abajo baja mucho más que la panza
  const legRuns = []; let run = null;
  for (let i = 0; i < W; i++) { const deep = bot[i] - belly > H * 0.12; if (deep && !run) run = { a: i, depth: 0 }; if (deep) run.depth = Math.max(run.depth, bot[i] - belly); if (!deep && run) { if (i - run.a > W * 0.02) legRuns.push({ ...run, b: i }); run = null; } }
  if (run) legRuns.push({ ...run, b: W });
  const core = ths.filter(v => v > maxT * 0.6).sort((a, b) => a - b), bodyT = core[Math.floor(core.length / 2)] / W, legLen = legRuns.length ? Math.max(...legRuns.map(r => r.depth)) / W : 0;
  // vista de frente: ancho contra alto
  let widthRatio = 1;
  if (front) { const f = await silhouette(front); let a = f.w, b = 0, c = f.h, d = 0; for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (f.m[y * f.w + x]) { a = Math.min(a, x); b = Math.max(b, x); c = Math.min(c, y); d = Math.max(d, y); } widthRatio = (b - a) / Math.max(1, d - c); }
  const hl = H / W;
  const template = !legRuns.length ? (hl < 0.25 ? "serpiente" : "pez") : hl > 0.8 ? "bipedo" : tailLen > 0.15 && legLen < bodyT * 1.4 ? "reptil" : "cuadrupedo";
  const T = newCreatureParams(template), total = 1;
  const headLen = Math.min(0.3, Math.max(0.08, (() => { let i = headSide, n = 0, dir = headSide ? -1 : 1, minT = Infinity, at = 0; while (n < W * 0.35) { if (ths[i] < minT && n > W * 0.06) { minT = ths[i]; at = n; } i += dir; n++; } return at / W; })()));
  const bodyLen = Math.max(0.2, 1 - tailLen - headLen - 0.05);
  const scaleTo = T.bodyLen + T.tailLen + T.neckLen + T.headLen * (1 + T.snout);
  const out = { ...T, tailLen: tailLen * scaleTo, bodyLen: bodyLen * scaleTo, headLen: Math.max(T.headLen * 0.8, headLen * scaleTo / (1 + T.snout)), bodyH: bodyT * scaleTo * 0.6, bodyW: bodyT * scaleTo * 0.6 * Math.min(1.8, Math.max(0.6, widthRatio)), legLen: Math.max(T.legLen, legLen ? legLen * scaleTo * 1.6 : 0), legPairs: template === "serpiente" || template === "pez" ? 0 : Math.max(1, Math.min(4, Math.round(legRuns.length))) };
  if (template === "reptil" || template === "cuadrupedo") out.legPairs = Math.max(2, out.legPairs);
  // perfil de grosor, de la punta de la cola al cuello: guarda la joroba, la panza y cómo se afila
  const ord = tailRight ? ths.slice().reverse() : ths.slice(), end = Math.round(W * (1 - headLen));
  const sample = (arr, i) => arr[Math.min(end - 1, Math.round(i / 19 * (end - 1)))];
  out.profile = Array.from({ length: 20 }, (_, i) => +(Math.max(0.04, sample(ord, i) / (bodyT * W))).toFixed(3));
  // línea del lomo: dónde queda el centro del cuerpo (sube en la joroba, baja en la cola)
  const mids = smooth(Array.from(top, (t, i) => t < 0 ? NaN : (t + Math.min(bot[i], belly)) / 2).map((v, i, a) => isNaN(v) ? a[Math.max(0, i - 1)] || 0 : v));
  const ordM = tailRight ? mids.slice().reverse() : mids, refM = [...ordM].slice(Math.round(end * 0.3), end).sort((a, b) => a - b)[Math.round((end * 0.7) / 2)] ?? ordM[0];
  out.arch = Array.from({ length: 20 }, (_, i) => +Math.max(-1.5, Math.min(1.5, (refM - sample(ordM, i)) / (bodyT * W) * 2)).toFixed(3));
  // patas: el ancho de cada una frente al cuerpo; si las de adelante son más gruesas, se nota
  if (legRuns.length) {
    const widths = legRuns.map(r => (r.b - r.a) / W), headward = r => tailRight ? -r.a : r.a, sorted = [...legRuns].sort((a, b) => headward(a) - headward(b));
    out.legW = Math.max(T.legW, Math.min(0.9, (widths.reduce((a, b) => a + b, 0) / widths.length) / bodyT * 0.7));
    if (sorted.length > 1) { const f = sorted.at(-1), b2 = sorted[0]; out.frontLegW = +Math.max(T.frontLegW ?? 1, Math.min(1.8, (f.b - f.a) / Math.max(1, b2.b - b2.a))).toFixed(2); out.frontLeg = +Math.max(0.8, Math.min(1.5, f.depth / Math.max(1, b2.depth))).toFixed(2); }
  }
  return { params: out, report: { template, legsSeen: legRuns.length, tail: Math.round(tailLen * 100), head: tailRight ? "izquierda" : "derecha", height: Math.round(hl * 100) } };
}
export async function silhouette(file) {
  const bmp = await createImageBitmap(file), k = Math.min(1, 700 / Math.max(bmp.width, bmp.height)), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k), N = w * h;
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.drawImage(bmp, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, L = new Float32Array(N);
  for (let i = 0; i < N; i++) L[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
  // tinta con umbral local: aguanta fotos con sombra o con el papel desigual
  const I = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += L[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; } }
  const R = Math.max(8, Math.round(w * 0.03)), mean = (x, y) => { const x0 = Math.max(0, x - R), x1 = Math.min(w, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(h, y + R + 1); return (I[y1 * (w + 1) + x1] - I[y0 * (w + 1) + x1] - I[y1 * (w + 1) + x0] + I[y0 * (w + 1) + x0]) / ((x1 - x0) * (y1 - y0)); };
  let ink = new Uint8Array(N);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x; ink[i] = L[i] < mean(x, y) - 0.1 && L[i] < 0.75 ? 1 : 0; }
  // renglones del cuaderno: tramos horizontales largos con papel arriba y abajo se borran
  const minRun = w * 0.12;
  for (let y = 5; y < h - 5; y++) { let x = 0; while (x < w) { if (!ink[y * w + x]) { x++; continue; } let e = x; while (e < w && (ink[y * w + e] || ink[(y - 1) * w + e] || ink[(y + 1) * w + e])) e++; if (e - x > minRun) { for (let xx = x; xx < e; xx++) { let up = 0, dn = 0; for (let t = 3; t <= 5; t++) { up += ink[(y - t) * w + xx]; dn += ink[(y + t) * w + xx]; } if (up + dn <= 2) { for (let t = -2; t <= 2; t++) ink[(y + t) * w + xx] = 0; } } } x = e + 1; } }
  // cerrar huecos del trazo (dilatar y erosionar) para que el sombreado y el contorno formen una mancha
  const r = Math.max(3, Math.round(w * 0.012));
  const maxF = (src, val) => { const a = new Uint8Array(N), b = new Uint8Array(N);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 1 - val; for (let t = -r; t <= r; t++) { const xx = x + t; if (xx >= 0 && xx < w && src[y * w + xx] === val) { v = val; break; } } a[y * w + x] = v; }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 1 - val; for (let t = -r; t <= r; t++) { const yy = y + t; if (yy >= 0 && yy < h && a[yy * w + x] === val) { v = val; break; } } b[y * w + x] = v; }
    return b; };
  ink = maxF(maxF(ink, 1), 0);
  { const B = Math.max(2, Math.round(w * 0.01)); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (x < B || y < B || x >= w - B || y >= h - B) ink[y * w + x] = 0; }
  // rellenar: lo que el papel no alcanza desde la orilla es parte de la figura
  const out = new Uint8Array(N).fill(1), st = [];
  for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x); for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
  while (st.length) { const i = st.pop(); if (!out[i] || ink[i]) continue; out[i] = 0; const x = i % w; if (x > 0) st.push(i - 1); if (x < w - 1) st.push(i + 1); if (i >= w) st.push(i - w); if (i < N - w) st.push(i + w); }
  // la mancha que gana: grande y cerca del centro; las que tocan dos orillas son sombra de la foto
  const lab = new Int32Array(N); let best = 0, bestS = -1, id = 0;
  for (let s0 = 0; s0 < N; s0++) { if (!out[s0] || lab[s0]) continue; id++; let n = 0, sx = 0, sy = 0, edges = 0; const q = [s0]; lab[s0] = id;
    while (q.length) { const i = q.pop(), x = i % w, y = (i / w) | 0; n++; sx += x; sy += y; if (x < 2) edges |= 1; if (x > w - 3) edges |= 2; if (y < 2) edges |= 4; if (y > h - 3) edges |= 8;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) if (j >= 0 && j < N && out[j] && !lab[j]) { lab[j] = id; q.push(j); } }
    const nb = (edges & 1) + (edges >> 1 & 1) + (edges >> 2 & 1) + (edges >> 3 & 1), dc = Math.hypot(sx / n / w - 0.5, sy / n / h - 0.5);
    const sc = n * (1 - Math.min(0.9, dc)) * (nb >= 2 ? 0.05 : 1); if (sc > bestS) { bestS = sc; best = id; } }
  const m = new Uint8Array(N); for (let i = 0; i < N; i++) m[i] = lab[i] === best ? 1 : 0;
  return { w, h, m };
}
