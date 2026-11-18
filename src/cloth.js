// Ropa y pliegues (Fase 3 · M4)
// - Las partes ceñidas (torso, mangas, piernas, cuello) se ajustan al cuerpo en reposo y siguen
//   a los huesos con pesos suaves (skinning por CPU).
// - Las partes sueltas (faldón de gabardina, falda, vestido, capa) se simulan como tela
//   (dinámica basada en posiciones) colgadas de anclas que siguen al cuerpo.
// - Los pliegues salen de la compresión de la tela: donde se encoge, se forman crestas.
import * as THREE from "three";
import { readJoint } from "./mannequin.js";

export const MATERIALS = {
  rigido: { label: "Rígida (lana, mezclilla)", lambda: 0.075, amp: 0.02, bend: 0.55, folds: 6, gain: 5.0 },
  medio: { label: "Media (algodón)", lambda: 0.05, amp: 0.015, bend: 0.25, folds: 9, gain: 5.5 },
  suelto: { label: "Suelta (seda, gasa)", lambda: 0.032, amp: 0.011, bend: 0.06, folds: 13, gain: 6.0 },
};

// largo: 0..1 (faldas y capas: de la cadera al tobillo) · manga: 0 sin manga, 0.3 corta, 1 larga
export const GARMENTS = {
  camisa: { label: "Camisa", layer: 1, color: "#e6e1d6", mat: "medio", sleeve: 1, collar: "bajo" },
  pantalon: { label: "Pantalón", layer: 2, color: "#3d4048", mat: "rigido", length: 1 },
  saco: { label: "Saco", layer: 3, color: "#4b4744", mat: "rigido", sleeve: 1, collar: "bajo" },
  gabardina: { label: "Gabardina", layer: 4, color: "#8b7b62", mat: "rigido", sleeve: 1, length: 0.72, collar: "alzado", belt: true },
  vestido: { label: "Vestido", layer: 1, color: "#6d3038", mat: "suelto", sleeve: 0.3, length: 0.55 },
  falda: { label: "Falda", layer: 2, color: "#3f4a5c", mat: "medio", length: 0.5 },
  capa: { label: "Capa", layer: 5, color: "#2b2a2f", mat: "suelto", length: 0.8, collar: "bajo" },
};
export const FOLD_TYPES = {
  tubo: "Tubo", zigzag: "Zigzag", espiral: "Espiral", medio: "Medio cierre", caida: "Caída", inerte: "Inerte",
};

let gid = 0;
export function newGarment(type) {
  const g = GARMENTS[type];
  const o = { id: "r" + Date.now().toString(36) + (gid++), type, color: g.color, mat: g.mat, ease: 0.9 };
  for (const k of ["sleeve", "length", "collar", "belt"]) if (g[k] !== undefined) o[k] = g[k];
  return o;
}
export const defaultQuality = () => (matchMedia("(pointer: coarse)").matches || (navigator.hardwareConcurrency || 8) <= 4 ? "media" : "alta");
export const Q = { baja: { step: 0.026, around: 18, steps: 45, iters: 5 }, media: { step: 0.018, around: 26, steps: 70, iters: 6 }, alta: { step: 0.012, around: 36, steps: 95, iters: 8 } };

// ------------------------------------------------------------------ materiales
const matCache = new Map();
function clothMat(hex, useColor, map) {
  const key = (map ? "map" : useColor ? hex : "clay");
  if (!matCache.has(key)) {
    matCache.set(key, map
      ? new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color: useColor ? hex : 0xbdb6ac, roughness: 0.9, metalness: 0, side: THREE.DoubleSide }));
  }
  return matCache.get(key);
}

// ------------------------------------------------------------------ utilidades
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const IDQ = new THREE.Quaternion();
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3();

// Pesos a lo largo de una cadena de articulaciones ([{name, s}]) con transición suave de ancho W
function weightsAlong(s, chain, W) {
  let k = 0;
  while (k < chain.length - 1 && s > chain[k + 1].s) k++;
  const w = new Map([[chain[k].name, 1]]);
  if (k < chain.length - 1) {
    const t = smooth(chain[k + 1].s - W, chain[k + 1].s + W, s);
    if (t > 0) { w.set(chain[k].name, (w.get(chain[k].name) || 0) * (1 - t)); w.set(chain[k + 1].name, t); }
  }
  if (k > 0) {
    const t = smooth(chain[k].s - W, chain[k].s + W, s);
    if (t < 1) { const cur = w.get(chain[k].name); w.set(chain[k].name, cur * t); w.set(chain[k - 1].name, (w.get(chain[k - 1].name) || 0) + cur * (1 - t)); }
  }
  return w;
}

// ------------------------------------------------------------------ captura del cuerpo en reposo
function restCapture(fig) {
  const saved = [];
  for (const j of Object.values(fig.joints)) {
    saved.push([j, j.quaternion.clone(), j.position.clone()]);
    j.quaternion.copy(j.name === "hips" ? IDQ : (j.userData.rest || IDQ));
  }
  fig.joints.hips.position.copy(fig.restHips);
  const rootM = fig.root.matrix.clone(), rp = fig.root.position.clone(), rq = fig.root.quaternion.clone();
  fig.root.position.set(0, 0, 0); fig.root.quaternion.identity(); fig.root.updateMatrixWorld(true);
  const bind = {}, pos = {};
  for (const [n, j] of Object.entries(fig.joints)) { bind[n] = j.matrixWorld.clone().invert(); pos[n] = new THREE.Vector3().setFromMatrixPosition(j.matrixWorld); }
  const meshesBy = {};
  fig.root.traverse(m => { if (m.isMesh && m.userData.joint && !m.userData.cloth) (meshesBy[m.userData.joint] ||= []).push(m); });
  const ray = new THREE.Raycaster();
  // radio exterior del cuerpo desde un eje: rayo desde afuera hacia el eje, primer impacto = superficie exterior
  const radius = (center, dir, joints, far = 0.6) => {
    const ms = joints.flatMap(j => meshesBy[j] || []);
    ray.set(_v.copy(center).addScaledVector(dir, far), _w.copy(dir).negate()); ray.far = far;
    const h = ray.intersectObjects(ms, false)[0];
    return h ? far - h.distance : 0;
  };
  const out = { bind, pos, radius };
  out.restore = () => {
    for (const [j, q, p] of saved) { j.quaternion.copy(q); j.position.copy(p); }
    fig.root.position.copy(rp); fig.root.quaternion.copy(rq); fig.root.matrix.copy(rootM);
    fig.root.updateMatrixWorld(true);
  };
  return out;
}

// ------------------------------------------------------------------ partes ceñidas (tubos)
// axis: puntos del eje en reposo; frame: N (frente del anillo); joints que se miden; chain para pesos
function tubePart(R, opts) {
  const { axis, N, measure, chain, ease, around, step, W = 0.05, minR = 0.02, extra, name, closedTop, cap = 0 } = opts;
  // longitud y muestreo del eje
  const segLen = [], acc = [0];
  for (let i = 1; i < axis.length; i++) { segLen.push(axis[i].distanceTo(axis[i - 1])); acc.push(acc[i - 1] + segLen[i - 1]); }
  const L = acc[acc.length - 1], rows = Math.max(3, Math.round(L / step) + 1);
  const ringC = [], ringT = [], sArr = [];
  for (let i = 0; i < rows; i++) {
    const s = (i / (rows - 1)) * L;
    let k = 0; while (k < segLen.length - 1 && s > acc[k + 1]) k++;
    const t = (s - acc[k]) / (segLen[k] || 1);
    ringC.push(axis[k].clone().lerp(axis[k + 1], t));
    ringT.push(axis[k + 1].clone().sub(axis[k]).normalize());
    sArr.push(s);
  }
  // radios medidos y suavizados (la tela no entra en los huecos)
  const rad = [];
  for (let i = 0; i < rows; i++) {
    const T = ringT[i], n0 = N.clone().addScaledVector(T, -N.dot(T)).normalize(), b0 = new THREE.Vector3().crossVectors(T, n0);
    const r = [];
    for (let c = 0; c < around; c++) {
      const a = (c / around) * Math.PI * 2;
      const d = n0.clone().multiplyScalar(Math.cos(a)).addScaledVector(b0, Math.sin(a));
      r.push(R.radius(ringC[i], d, measure(i, sArr[i] / L)));
    }
    rad.push({ r, n0, b0 });
  }
  for (let pass = 0; pass < 4; pass++) for (const ring of rad) {
    const r = ring.r; for (let c = 0; c < around; c++) r[c] = Math.max(r[c], 0.5 * (r[(c + around - 1) % around] + r[(c + 1) % around]));
  }
  // anillos sin impacto: toman el vecino; luego suavizado vertical convexo
  for (let i = 0; i < rows; i++) for (let c = 0; c < around; c++) if (!rad[i].r[c]) {
    let j = 1; while (j < rows && !(rad[i - j]?.r[c] || rad[i + j]?.r[c])) j++;
    rad[i].r[c] = rad[i - j]?.r[c] || rad[i + j]?.r[c] || minR;
  }
  for (let pass = 0; pass < 3; pass++) for (let i = 1; i < rows - 1; i++) for (let c = 0; c < around; c++)
    rad[i].r[c] = Math.max(rad[i].r[c], 0.5 * (rad[i - 1].r[c] + rad[i + 1].r[c]));
  // vértices
  const n = rows * around, rest = new Float32Array(n * 3), sv = new Float32Array(n), av = new Float32Array(n), rd = new Float32Array(n * 3);
  const W4 = [];
  for (let i = 0; i < rows; i++) {
    const { r, n0, b0 } = rad[i];
    const w = weightsAlong(sArr[i], chain, W);
    for (let c = 0; c < around; c++) {
      const a = (c / around) * Math.PI * 2, idx = i * around + c;
      let rr = Math.max(r[c], minR) + ease;
      // un poco más de tela sobre codos y rodillas: al doblarse no asoma la articulación
      for (let k = 1; k < chain.length; k++) rr += opts.jointEase ? opts.jointEase * Math.max(0, 1 - Math.abs(sArr[i] - chain[k].s) / 0.06) : 0;
      if (closedTop && i === 0) rr *= 0.35;
      if (cap && sArr[i] < cap) rr *= 0.82 + 0.18 * Math.sqrt(sArr[i] / cap); // copa del hombro: entra bajo el torso
      const p = ringC[i].clone().addScaledVector(n0, Math.cos(a) * rr).addScaledVector(b0, Math.sin(a) * rr);
      rest.set([p.x, p.y, p.z], idx * 3); sv[idx] = sArr[i]; av[idx] = a;
      const dr = p.clone().sub(ringC[i]).normalize(); rd.set([dr.x, dr.y, dr.z], idx * 3);
      W4.push(extra ? extra(p, new Map(w)) : w);
    }
  }
  const part = finishPart({ name, kind: "tube", rows, cols: around, closed: true, rest, sv, av, weights: W4 });
  part.rd = rd; part.bends = opts.bends || [];
  // normales hacia afuera: si el orden de los triángulos quedó al revés, se invierte
  part.pos.set(rest); part.geo.computeVertexNormals();
  const nr = part.geo.attributes.normal.array, mid = Math.floor(rows / 2) * around;
  let dot = 0;
  for (let c = 0; c < around; c++) { const i = mid + c; dot += nr[i * 3] * (rest[i * 3] - ringC[Math.floor(rows / 2)].x) + nr[i * 3 + 1] * (rest[i * 3 + 1] - ringC[Math.floor(rows / 2)].y) + nr[i * 3 + 2] * (rest[i * 3 + 2] - ringC[Math.floor(rows / 2)].z); }
  if (dot < 0) { const ix = part.geo.index.array; for (let k = 0; k < ix.length; k += 3) { const t = ix[k + 1]; ix[k + 1] = ix[k + 2]; ix[k + 2] = t; } part.geo.index.needsUpdate = true; }
  return part;
}

function finishPart(p) {
  const n = p.rows * p.cols;
  // pesos compactos: hasta 3 huesos por vértice
  p.wj = []; p.ww = new Float32Array(n * 3); p.wn = [];
  for (let i = 0; i < n; i++) {
    const e = [...p.weights[i].entries()].filter(([, w]) => w > 1e-3).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const sum = e.reduce((s, [, w]) => s + w, 0) || 1;
    p.wn.push(e.map(([j]) => j)); e.forEach(([, w], k) => (p.ww[i * 3 + k] = w / sum));
    p.wj.push(e[0][0]);
  }
  delete p.weights;
  // índices de la malla
  const idx = [], C = p.cols, cmax = p.closed ? C : C - 1;
  for (let i = 0; i < p.rows - 1; i++) for (let c = 0; c < cmax; c++) {
    const a = i * C + c, b = i * C + (c + 1) % C, d = (i + 1) * C + c, e = (i + 1) * C + (c + 1) % C;
    idx.push(a, d, b, b, d, e);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setIndex(idx);
  p.geo = geo; p.pos = geo.attributes.position.array; p.strain = new Float32Array(n);
  // largo de reposo hacia el anillo de abajo y entre columnas (para medir compresión)
  p.restV = new Float32Array(n); p.restH = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / C), c = i % C;
    const dn = r < p.rows - 1 ? i + C : i - C;
    p.restV[i] = dist3(p.rest, i, dn);
    const c2 = p.closed ? (c + 2) % C : c + 2 < C ? c + 2 : Math.max(0, c - 2);
    p.restH[i] = dist3(p.rest, i, r * C + c2) || 1e-4;
  }
  return p;
}
const dist3 = (A, i, j) => Math.hypot(A[i * 3] - A[j * 3], A[i * 3 + 1] - A[j * 3 + 1], A[i * 3 + 2] - A[j * 3 + 2]);

// ------------------------------------------------------------------ partes sueltas (tela simulada)
function sheetPart(R, opts) {
  const { name, rows, cols, closed, restAt, pinRows, weightAt, mat, seed } = opts;
  const n = rows * cols, rest = new Float32Array(n * 3), weights = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const p = restAt(r, c); rest.set([p.x, p.y, p.z], (r * cols + c) * 3);
    weights.push(weightAt(p, r));
  }
  const sv = new Float32Array(n), av = new Float32Array(n);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { sv[r * cols + c] = r / (rows - 1); av[r * cols + c] = closed ? (c / cols) * Math.PI * 2 : (c / (cols - 1)) * Math.PI; }
  const part = finishPart({ name, kind: "sheet", rows, cols, closed, rest, weights, sv, av });
  part.pinRows = pinRows; part.mat = mat; part.seed = seed;
  part.cur = new Float32Array(n * 3); part.prev = new Float32Array(n * 3); part.target = new Float32Array(n * 3);
  // restricciones: estructurales, cizalla y flexión
  const cons = [], C = cols;
  const at = (r, c) => (closed ? r * C + ((c + C) % C) : c < 0 || c >= C ? -1 : r * C + c);
  const add = (a, b, k) => { if (a < 0 || b < 0) return; cons.push(a, b, dist3(rest, a, b), k); };
  for (let r = 0; r < rows; r++) for (let c = 0; c < C; c++) {
    const i = r * C + c;
    if (closed || c < C - 1) add(i, at(r, c + 1), 1);
    if (r < rows - 1) add(i, i + C, 1);
    if (r < rows - 1 && (closed || c < C - 1)) { add(i, at(r + 1, c + 1), 0.6); add(at(r, c + 1), i + C, 0.6); }
    if (closed || c < C - 2) add(i, at(r, c + 2), mat.bend);
    if (r < rows - 2) add(i, i + 2 * C, mat.bend);
  }
  part.cons = new Float32Array(cons);
  return part;
}

// ------------------------------------------------------------------ armar prendas
function buildGarment(fig, R, g, Qs) {
  const d = fig.d, H = d.H, t = d.t, P = R.pos, M = MATERIALS[g.mat] || MATERIALS.medio;
  const def = GARMENTS[g.type];
  const ease = (g.ease ?? 1.2) / 100 + def.layer * 0.005;
  const parts = [], around = Qs.around, step = Qs.step;
  const Z = new THREE.Vector3(0, 0, 1), up = new THREE.Vector3(0, 1, 0);
  const TORSO = ["hips", "spine1", "spine2", "spine3", "chest", "neck1", "clavicle_L", "clavicle_R"];
  const spineChain = ["hips", "spine1", "spine2", "spine3", "chest", "neck1"].map(n => ({ name: n, s: P[n].y }));
  const torsoExtra = (p, w) => { // hombros: la tela de arriba a los lados sigue a la clavícula
    const side = p.x > 0 ? "L" : "R";
    const f = smooth(d.sw * 0.45, d.sw * 0.95, Math.abs(p.x)) * smooth(d.chestY, d.shoulderY, p.y) * 0.35;
    if (f > 0) { for (const k of w.keys()) w.set(k, w.get(k) * (1 - f)); w.set("clavicle_" + side, (w.get("clavicle_" + side) || 0) + f); }
    return w;
  };
  const torso = (yBot, yTop) => {
    // eje de abajo hacia arriba: cada tramo pertenece a la articulación de abajo
    const axis = [new THREE.Vector3(0, yBot, 0), new THREE.Vector3(0, yTop, 0)];
    const chain = spineChain.map(c => ({ name: c.name, s: c.s - yBot }));
    const bends = [{ joint: "spine1", parent: "hips", child: "chest", s: P.spine1.y - yBot, reach: 0.12, up: true }];
    return tubePart(R, { bends, name: "torso", axis, N: Z, measure: () => TORSO, chain, ease, around: around + 12, step, W: 0.06, extra: torsoExtra });
  };
  const sleeve = (s, frac) => {
    const sh = P["shoulder_" + s], el = P["elbow_" + s], wr = P["wrist_" + s];
    const top = sh.clone().add(new THREE.Vector3(0, 0.016 * H * t, 0));
    const len = (sh.distanceTo(el) + el.distanceTo(wr)) * frac;
    const axis = [top, sh.clone()];
    if (len <= sh.distanceTo(el)) axis.push(sh.clone().lerp(el, len / sh.distanceTo(el)));
    else { axis.push(el.clone()); axis.push(el.clone().lerp(wr, (len - sh.distanceTo(el)) / el.distanceTo(wr))); }
    const s0 = 0.016 * H * t;
    const chain = [{ name: "clavicle_" + s, s: 0 }, { name: "shoulder_" + s, s: s0 }, { name: "elbow_" + s, s: s0 + sh.distanceTo(el) }, { name: "wrist_" + s, s: s0 + sh.distanceTo(el) + el.distanceTo(wr) }];
    const bends = [{ joint: "elbow_" + s, parent: "shoulder_" + s, child: "wrist_" + s, s: s0 + sh.distanceTo(el), reach: 0.13 }];
    return tubePart(R, { bends, name: "manga_" + s, axis, N: Z, measure: () => ["shoulder_" + s, "elbow_" + s], chain, ease, around, step, W: 0.045, closedTop: false, minR: 0.025, cap: s0, jointEase: 0.006 });
  };
  const leg = (s, frac) => {
    const hp = P["hip_" + s], kn = P["knee_" + s], an = P["ankle_" + s];
    const top = hp.clone().add(new THREE.Vector3(0, 0.05 * H, 0));
    const lenT = hp.distanceTo(kn), lenS = kn.distanceTo(an), len = (lenT + lenS) * frac;
    const axis = [top, hp.clone()];
    if (len <= lenT) axis.push(hp.clone().lerp(kn, len / lenT)); else { axis.push(kn.clone()); axis.push(kn.clone().lerp(an, Math.min(1, (len - lenT) / lenS))); }
    const s0 = 0.05 * H;
    const chain = [{ name: "hips", s: 0 }, { name: "hip_" + s, s: s0 * 0.6 }, { name: "knee_" + s, s: s0 + lenT }, { name: "ankle_" + s, s: s0 + lenT + lenS }];
    const bends = [{ joint: "knee_" + s, parent: "hip_" + s, child: "ankle_" + s, s: s0 + lenT, reach: 0.12 }, { joint: "hip_" + s, parent: "hips", child: "knee_" + s, s: s0, reach: 0.1, flip: true }];
    return tubePart(R, { bends, name: "pierna_" + s, axis, N: Z, measure: () => ["hip_" + s, "knee_" + s], chain, ease: ease + 0.002, around, step, W: 0.05, minR: 0.03, jointEase: 0.008 });
  };
  const collar = (tall, flare) => {
    const y0 = d.neckY - 0.012 * H, y1 = d.neckY + (tall ? 0.05 : 0.022) * H;
    const axis = [new THREE.Vector3(0, y1, 0.003 * H), new THREE.Vector3(0, y0, 0)];
    const p = tubePart(R, { name: "cuello", axis, N: Z, measure: () => ["neck1", "neck2"], chain: [{ name: "neck1", s: 0 }, { name: "chest", s: y1 - y0 }], ease: ease + 0.006, around, step: Math.min(step, 0.01), W: 0.02, minR: 0.03 });
    if (flare) { // cuello alzado abierto hacia afuera arriba
      for (let i = 0; i < p.rows * p.cols; i++) {
        const k = 1 - p.sv[i] / (y1 - y0), x = p.rest[i * 3], z = p.rest[i * 3 + 2];
        p.rest[i * 3] = x * (1 + 0.35 * k); p.rest[i * 3 + 2] = z * (1 + 0.35 * k) - 0.01 * k * (z > 0 ? 1 : 0);
      }
    }
    return p;
  };
  const band = (y, h, extraEase) => { // cinturón
    const axis = [new THREE.Vector3(0, y - h / 2, 0), new THREE.Vector3(0, y + h / 2, 0)];
    const chain = spineChain.map(c => ({ name: c.name, s: c.s - (y - h / 2) }));
    const p = tubePart(R, { name: "cinturon", axis, N: Z, measure: () => TORSO, chain, ease: ease + extraEase, around: around + 12, step: h / 2, W: 0.06 });
    p.dark = true; return p;
  };
  // falda o faldón simulado: de yTop hacia abajo, con vuelo
  const skirt = (yTop, frac, flare, pinTo) => {
    const ankle = P.ankle_L.y, len = Math.max(0.08, (yTop - ankle) * frac + 0.02);
    const rows = Math.max(6, Math.round(len / (step * 1.6))), cols = Math.round((around + 12) * 0.9);
    const base = [];
    for (let c = 0; c < cols; c++) {
      const a = (c / cols) * Math.PI * 2, dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const r = Math.max(R.radius(new THREE.Vector3(0, yTop, 0), dir, ["hips", "spine1", "hip_L", "hip_R"]), 0.05);
      base.push(r + ease + 0.006);
    }
    for (let pass = 0; pass < 4; pass++) for (let c = 0; c < cols; c++) base[c] = Math.max(base[c], 0.5 * (base[(c + cols - 1) % cols] + base[(c + 1) % cols]));
    const legSpan = d.hw + 0.05 * H * t + ease;
    const pinRows = 2;
    return sheetPart(R, {
      name: "falda", rows, cols, closed: true, mat: M, pinRows, seed: M.folds,
      restAt: (r, c) => {
        const a = (c / cols) * Math.PI * 2, v = r / (rows - 1), y = yTop - v * len;
        const out = Math.max(0, v * len - 0.02) * flare;
        // el ancho mínimo cubre las dos piernas; una onda pequeña siembra los pliegues
        const rr = Math.max(base[c] + out, r >= pinRows ? legSpan * (Math.abs(Math.sin(a)) * 0.9 + 0.35) : 0) * (1 + (r >= pinRows ? 0.03 * Math.sin(a * M.folds) * v : 0));
        return new THREE.Vector3(Math.sin(a) * rr, y, Math.cos(a) * rr);
      },
      weightAt: (p, r) => {
        if (r < pinRows) return new Map([[pinTo, 1]]);
        const v = (yTop - p.y) / len, side = Math.max(-1, Math.min(1, p.x / (d.hw * 1.2)));
        const f = 0.95 * smooth(0, 0.14, v);
        return new Map([[pinTo, 1 - f], ["hip_L", f * (0.5 + 0.5 * side)], ["hip_R", f * (0.5 - 0.5 * side)]]);
      },
    });
  };
  const cape = frac => {
    const yTop = d.shoulderY + 0.012 * H, len = Math.max(0.2, (yTop - P.ankle_L.y) * frac);
    const rows = Math.max(8, Math.round(len / (step * 1.7))), cols = Math.round(around * 0.9);
    const rx = d.sw * 1.08 + ease, rz = 0.07 * H * t + ease;
    return sheetPart(R, {
      name: "capa", rows, cols, closed: false, mat: M, pinRows: 2, seed: M.folds,
      restAt: (r, c) => {
        const u = c / (cols - 1), a = Math.PI * (0.5 + u) * 1.0 + (u - 0.5) * 0.55, v = r / (rows - 1);
        const y = yTop - v * len, grow = 1 + v * 0.55, wob = r >= 2 ? 1 + 0.03 * Math.sin(u * Math.PI * M.folds) * v : 1;
        return new THREE.Vector3(Math.sin(a) * rx * grow * wob, y, Math.cos(a) * rz * grow * wob - (r >= 2 ? 0.01 : 0));
      },
      weightAt: p => {
        const f = smooth(d.sw * 0.4, d.sw * 0.95, Math.abs(p.x)) * 0.6;
        const w = new Map([["chest", 1 - f]]); if (f) w.set("clavicle_" + (p.x > 0 ? "L" : "R"), f); return w;
      },
    });
  };

  const waist = P.spine1.y + 0.01 * H;
  switch (g.type) {
    case "camisa":
      // fajada: termina bajo la cintura del pantalón o la falda
      parts.push(torso(waist - 0.035 * H, d.neckY - 0.004 * H)); if (g.sleeve > 0.05) parts.push(sleeve("L", g.sleeve), sleeve("R", g.sleeve));
      if (g.collar !== "no") parts.push(collar(false, false)); break;
    case "saco":
      parts.push(torso(d.hipJY - 0.07 * H, d.neckY - 0.004 * H)); if (g.sleeve > 0.05) parts.push(sleeve("L", g.sleeve), sleeve("R", g.sleeve));
      parts.push(collar(g.collar === "alzado", g.collar === "alzado")); break;
    case "gabardina":
      parts.push(torso(d.hipJY - 0.01 * H, d.neckY - 0.004 * H)); if (g.sleeve > 0.05) parts.push(sleeve("L", g.sleeve), sleeve("R", g.sleeve));
      parts.push(collar(g.collar === "alzado", g.collar === "alzado"));
      parts.push(skirt(d.hipJY + 0.015 * H, g.length ?? 0.72, 0.16, "hips"));
      if (g.belt) parts.push(band(P.spine1.y + 0.01 * H, 0.03 * H, 0.004)); break;
    case "vestido":
      parts.push(torso(waist - 0.01 * H, d.neckY - 0.008 * H)); if (g.sleeve > 0.05) parts.push(sleeve("L", g.sleeve), sleeve("R", g.sleeve));
      parts.push(skirt(waist, g.length ?? 0.55, 0.4, "hips")); break;
    case "falda": parts.push(skirt(waist, g.length ?? 0.5, 0.32, "hips")); break;
    case "pantalon": {
      const yb = d.hipJY - 0.014 * H, pel = torso(yb, waist); pel.name = "cadera";
      // la entrepierna se cierra hacia las piernas: sin borde de "short"
      for (let i = 0; i < pel.rows * pel.cols; i++) {
        const k = 1 - Math.min(1, (pel.rest[i * 3 + 1] - yb) / (0.05 * H));
        if (k > 0) { pel.rest[i * 3 + 2] *= 1 - 0.28 * k; pel.rest[i * 3] *= 1 - 0.08 * k; }
      }
      parts.push(pel);
      parts.push(leg("L", g.length ?? 1), leg("R", g.length ?? 1)); break;
    }
    case "capa": parts.push(cape(g.length ?? 0.8)); if (g.collar !== "no") parts.push(collar(g.collar === "alzado", true)); break;
  }
  return parts;
}

// ------------------------------------------------------------------ vestir una figura
export function dress(fig, clothes, opts = {}) {
  const Qs = Q[opts.quality || defaultQuality()];
  const R = restCapture(fig);
  let garments;
  try { garments = clothes.map(g => ({ g, parts: buildGarment(fig, R, g, Qs) })); }
  finally { R.restore(); }
  const group = new THREE.Group(); group.name = "ropa"; group.userData.clothRoot = true;
  const bindInv = R.bind, R0 = R.pos;
  let useColor = !!opts.useColor, showMap = !!opts.map, wind = opts.wind || 0, windDir = opts.windDir || 0;
  for (const { g, parts } of garments) for (const p of parts) {
    const m = new THREE.Mesh(p.geo, clothMat(p.dark ? shade(g.color) : g.color, useColor, showMap));
    m.castShadow = m.receiveShadow = true; m.userData.cloth = true; m.userData.garment = g.id;
    m.userData.jointAt = i => p.wj[i] || "hips";
    m.frustumCulled = false;
    p.mesh = m; p.g = g; group.add(m);
  }
  fig.root.add(group);
  // Lo que la ropa cubre del maniquí se oculta: así ninguna articulación asoma por la tela
  const covered = new Set();
  for (const { g, parts } of garments) for (const p of parts) {
    if (p.name === "torso") ["spine1", "spine2", "spine3", "chest"].forEach(j => covered.add(j));
    if (p.name === "cadera") covered.add("hips");
    if (p.name.startsWith("manga_")) { const sd = p.name.slice(-1); covered.add("shoulder_" + sd); if ((g.sleeve ?? 1) > 0.97) covered.add("elbow_" + sd); }
    if (p.name.startsWith("pierna_")) { const sd = p.name.slice(-1); covered.add("hip_" + sd); if ((g.length ?? 1) > 0.97) covered.add("knee_" + sd); }
  }
  const hidden = [];
  fig.root.traverse(m => { if (m.isMesh && !m.userData.cloth && covered.has(m.userData.joint) && m.visible) { m.visible = false; hidden.push(m); } });

  const skinM = {}, tmp = new THREE.Matrix4(), rootInv = new THREE.Matrix4();
  function skinMatrices() {
    fig.root.updateMatrixWorld(true);
    rootInv.copy(fig.root.matrixWorld).invert();
    for (const [n, j] of Object.entries(fig.joints)) skinM[n] = (skinM[n] || new THREE.Matrix4()).multiplyMatrices(rootInv, j.matrixWorld).multiply(bindInv[n]);
  }
  function skinTo(p, out, rows = p.rows) {
    const e = skinM, R = p.rest;
    for (let i = 0, n = rows * p.cols; i < n; i++) {
      let x = 0, y = 0, z = 0;
      const js = p.wn[i];
      for (let k = 0; k < js.length; k++) {
        const w = p.ww[i * 3 + k], m = e[js[k]].elements;
        const rx = R[i * 3], ry = R[i * 3 + 1], rz = R[i * 3 + 2];
        x += w * (m[0] * rx + m[4] * ry + m[8] * rz + m[12]);
        y += w * (m[1] * rx + m[5] * ry + m[9] * rz + m[13]);
        z += w * (m[2] * rx + m[6] * ry + m[10] * rz + m[14]);
      }
      out[i * 3] = x; out[i * 3 + 1] = y; out[i * 3 + 2] = z;
    }
  }
  // Cuerpo como cápsulas (en espacio de la figura) para que la tela no lo atraviese
  function colliders(margin) {
    const d = fig.d, H = d.H, t = d.t, J = n => new THREE.Vector3().setFromMatrixPosition(tmp.multiplyMatrices(rootInv, fig.joints[n].matrixWorld));
    const local = (n, x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(tmp.multiplyMatrices(rootInv, fig.joints[n].matrixWorld));
    const caps = [];
    const cap = (a, b, r) => caps.push([a, b, r + margin]);
    cap(J("hips"), J("chest"), 0.062 * H * t);
    cap(local("hips", d.hw * 0.7, 0, 0), local("chest", d.sw * 0.45, 0.03 * H, 0), 0.055 * H * t);
    cap(local("hips", -d.hw * 0.7, 0, 0), local("chest", -d.sw * 0.45, 0.03 * H, 0), 0.055 * H * t);
    cap(J("hip_L"), J("hip_R"), 0.058 * H * t);
    for (const s of ["L", "R"]) {
      cap(J("hip_" + s), J("knee_" + s), 0.044 * H * t);
      cap(J("knee_" + s), J("ankle_" + s), 0.033 * H * t);
      cap(J("shoulder_" + s), J("elbow_" + s), 0.028 * H * t);
      cap(J("elbow_" + s), J("wrist_" + s), 0.023 * H * t);
      cap(J("clavicle_" + s), J("shoulder_" + s), 0.03 * H * t);
    }
    cap(J("neck1"), J("head"), 0.032 * H * t);
    const hc = local("head", 0, d.hh * 0.5, 0); cap(hc, hc, d.hh * 0.42);
    return caps;
  }
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _p = new THREE.Vector3();
  function collide(arr, i, caps, floorY) {
    _p.set(arr[i], arr[i + 1], arr[i + 2]);
    let hit = false;
    for (const [a, b, r] of caps) {
      _a.subVectors(b, a); const L2 = _a.lengthSq();
      const tt = L2 > 1e-9 ? Math.min(1, Math.max(0, _b.subVectors(_p, a).dot(_a) / L2)) : 0;
      _b.copy(a).addScaledVector(_a, tt);
      const dx = _p.x - _b.x, dy = _p.y - _b.y, dz = _p.z - _b.z, dd = dx * dx + dy * dy + dz * dz;
      if (dd < r * r) {
        const dl = Math.sqrt(dd) || 1e-6, k = r / dl;
        _p.set(_b.x + dx * k, _b.y + dy * k, _b.z + dz * k); hit = true;
      }
    }
    if (_p.y < floorY) { _p.y = floorY; hit = true; }
    arr[i] = _p.x; arr[i + 1] = _p.y; arr[i + 2] = _p.z;
    return hit;
  }
  function simulate(p, steps, reset, caps, floorY, windV) {
    const N = p.rows * p.cols, C = p.cols, pin = p.pinRows * C, dt = 1 / 60, g = 9.8 * dt * dt;
    skinTo(p, p.target);
    if (reset) { p.cur.set(p.target); p.prev.set(p.target); }
    const cons = p.cons, nc = cons.length / 4, iters = Qs.iters;
    for (let s = 0; s < steps; s++) {
      for (let i = pin; i < N; i++) {
        const k = i * 3, x = p.cur[k], y = p.cur[k + 1], z = p.cur[k + 2];
        const gust = 0.6 + 0.4 * Math.sin(i * 1.7 + s * 0.11);
        p.cur[k] += (x - p.prev[k]) * 0.985 + windV.x * dt * dt * gust;
        p.cur[k + 1] += (y - p.prev[k + 1]) * 0.985 - g + windV.y * dt * dt * gust;
        p.cur[k + 2] += (z - p.prev[k + 2]) * 0.985 + windV.z * dt * dt * gust;
        p.prev[k] = x; p.prev[k + 1] = y; p.prev[k + 2] = z;
      }
      for (let i = 0; i < pin * 3; i++) p.cur[i] = p.target[i];
      for (let it = 0; it < iters; it++) {
        for (let c = 0; c < nc; c++) {
          const a = cons[c * 4], b = cons[c * 4 + 1], L = cons[c * 4 + 2], st = cons[c * 4 + 3];
          const ka = a * 3, kb = b * 3;
          const dx = p.cur[kb] - p.cur[ka], dy = p.cur[kb + 1] - p.cur[ka + 1], dz = p.cur[kb + 2] - p.cur[ka + 2];
          const dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9, diff = (dl - L) / dl * st;
          const wa = a < pin ? 0 : 1, wb = b < pin ? 0 : 1, ws = wa + wb; if (!ws) continue;
          const fa = diff * wa / ws, fb = diff * wb / ws;
          p.cur[ka] += dx * fa; p.cur[ka + 1] += dy * fa; p.cur[ka + 2] += dz * fa;
          p.cur[kb] -= dx * fb; p.cur[kb + 1] -= dy * fb; p.cur[kb + 2] -= dz * fb;
        }
        if (it === iters - 1 || it % 2 === 1) for (let i = pin; i < N; i++) if (collide(p.cur, i * 3, caps, floorY) && it === iters - 1) {
          // fricción: la tela apoyada en el cuerpo casi no resbala
          const k = i * 3; p.prev[k] += (p.cur[k] - p.prev[k]) * 0.7; p.prev[k + 1] += (p.cur[k + 1] - p.prev[k + 1]) * 0.7; p.prev[k + 2] += (p.cur[k + 2] - p.prev[k + 2]) * 0.7;
        }
      }
      // fricción con el piso: la tela que toca el suelo se queda quieta
      for (let i = pin; i < N; i++) if (p.cur[i * 3 + 1] <= floorY + 1e-4) { p.prev[i * 3] = p.cur[i * 3]; p.prev[i * 3 + 2] = p.cur[i * 3 + 2]; }
    }
    p.pos.set(p.cur);
  }

  // Compresión → crestas de pliegue sobre las partes ceñidas
  function foldsOn(p, M, twist) {
    const C = p.cols, N = p.rows * C, P = p.pos, geo = p.geo;
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals();
    const nrm = geo.attributes.normal.array;
    for (let i = 0; i < N; i++) {
      const r = Math.floor(i / C);
      const dn = r < p.rows - 1 ? i + C : i - C, up = r > 0 ? i - C : i + C;
      const cur = 0.5 * (dist3(P, i, dn) + dist3(P, i, up)), rest = 0.5 * (p.restV[i] + p.restV[up]);
      p.strain[i] = cur / (rest || 1e-6);
    }
    if (p.kind === "sheet") {
      // tela colgada: pliegues verticales que nacen del ancla y se abren hacia el borde
      const nf = p.closed ? M.folds : Math.max(3, Math.round(M.folds * 0.6));
      for (let i = p.pinRows * C; i < N; i++) {
        const v = p.sv[i], a = p.av[i];
        const ridge = Math.sin(a * nf + 0.9 * Math.sin(a * 2)) * 0.75 + 0.25 * Math.sin(a * nf * 2 + 1.1);
        const h = M.amp * 1.7 * smooth(0.04, 0.6, v) * ridge;
        P[i * 3] += nrm[i * 3] * h; P[i * 3 + 1] += nrm[i * 3 + 1] * h; P[i * 3 + 2] += nrm[i * 3 + 2] * h;
      }
      return;
    }
    // suavizado del mapa para que las crestas no salgan ruidosas
    const st = p.strain, tmpS = new Float32Array(N);
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < N; i++) { const r = Math.floor(i / C), c = i % C; tmpS[i] = (st[i] * 2 + st[r * C + (c + 1) % C] + st[r * C + (c + C - 1) % C] + st[Math.max(0, r - 1) * C + c] + st[Math.min(p.rows - 1, r + 1) * C + c]) / 6; }
      st.set(tmpS);
    }
    // doblez de cada articulación: el lado de adentro del codo, la rodilla o la cintura junta tela
    const bendData = (p.bends || []).map(b => {
      const J = fig.joints[b.joint], Pa = fig.joints[b.parent], Ch = fig.joints[b.child];
      const inv = new THREE.Matrix4().copy(Pa.matrixWorld).invert();
      const a0 = new THREE.Vector3().setFromMatrixPosition(J.matrixWorld).applyMatrix4(inv), c0 = new THREE.Vector3().setFromMatrixPosition(Ch.matrixWorld).applyMatrix4(inv);
      const cur = c0.sub(a0).normalize(), rest = R0[b.child].clone().sub(R0[b.joint]).normalize();
      const ang = Math.acos(Math.max(-1, Math.min(1, cur.dot(rest))));
      const dir = cur.clone().addScaledVector(rest, -cur.dot(rest)); if (dir.lengthSq() < 1e-8) return null;
      dir.normalize(); if (b.flip) dir.negate();
      return { s: b.s, reach: b.reach, k: smooth(0.2, 1.9, ang), dir };
    }).filter(Boolean);
    p.lastBend = bendData; let nf = 0;
    for (let i = 0; i < N; i++) {
      let comp = Math.min(1, Math.max(0, (1 - st[i]) * M.gain));
      for (const b of bendData) {
        const prox = 1 - Math.abs(p.sv[i] - b.s) / b.reach; if (prox <= 0) continue;
        const inner = p.rd[i * 3] * b.dir.x + p.rd[i * 3 + 1] * b.dir.y + p.rd[i * 3 + 2] * b.dir.z;
        comp = Math.max(comp, b.k * prox * Math.max(0, 0.25 + 0.75 * inner));
      }
      if (comp < 0.02) continue;
      const s = p.sv[i], a = p.av[i];
      const ridge = 0.5 + 0.5 * Math.sin((s / M.lambda) * Math.PI * 2 + 2.2 * Math.sin(a * 2) + twist * a);
      const h = M.amp * 1.4 * comp * (0.25 + 0.75 * ridge); if (h > 0.002) nf++;
      P[i * 3] += nrm[i * 3] * h; P[i * 3 + 1] += nrm[i * 3 + 1] * h; P[i * 3 + 2] += nrm[i * 3 + 2] * h;
    }
    p.nFold = nf;
  }
  function colorMap(p, base) {
    const col = p.geo.attributes.color.array, N = p.rows * p.cols;
    for (let i = 0; i < N; i++) {
      let s = p.strain[i];
      if (p.kind === "sheet") { // en la tela colgada, la compresión se ve en el ancho (pliegues que se juntan)
        const C = p.cols, r = Math.floor(i / C), c = i % C, c2 = p.closed ? (c + 2) % C : Math.min(c + 2, C - 1);
        const j = r * C + c2; if (j !== i) s = Math.min(s, dist3(p.pos, i, j) / p.restH[i]);
      }
      const comp = Math.min(1, Math.max(0, (1 - s) * 3)), ten = Math.min(1, Math.max(0, (s - 1) * 4));
      col[i * 3] = base.r * (1 - comp - ten) + 0.24 * comp + 0.78 * ten;
      col[i * 3 + 1] = base.g * (1 - comp - ten) + 0.5 * comp + 0.35 * ten;
      col[i * 3 + 2] = base.b * (1 - comp - ten) + 0.72 * comp + 0.27 * ten;
    }
    p.geo.attributes.color.needsUpdate = true;
  }
  const baseCol = new THREE.Color(0.84, 0.82, 0.77);

  let labels = [];
  function classify() {
    const out = [], W = n => new THREE.Vector3().setFromMatrixPosition(fig.joints[n].matrixWorld);
    const ang = (a, b, c) => { const u = W(a).sub(W(b)).normalize(), v = W(c).sub(W(b)).normalize(); return 180 - Math.acos(Math.max(-1, Math.min(1, u.dot(v)))) * 180 / Math.PI; };
    const tw = (...js) => js.reduce((s, j) => s + Math.abs(readJoint(fig, j)[1]), 0);
    const worn = new Set(garments.flatMap(x => x.parts.map(p => p.name)));
    const has = n => worn.has(n);
    const mid = (a, b) => W(a).add(W(b)).multiplyScalar(0.5);
    for (const s of ["L", "R"]) {
      if (has("manga_" + s)) {
        const bend = ang("shoulder_" + s, "elbow_" + s, "wrist_" + s), twist = tw("elbow_" + s, "wrist_" + s);
        if (bend > 95) out.push({ at: W("elbow_" + s), type: "medio" });
        else if (bend > 30) out.push({ at: W("elbow_" + s), type: "zigzag" });
        if (twist > 35) out.push({ at: mid("elbow_" + s, "wrist_" + s), type: "espiral" });
        else if (bend <= 30) { const dir = W("wrist_" + s).sub(W("shoulder_" + s)).normalize(); if (dir.y < -0.75) out.push({ at: mid("shoulder_" + s, "elbow_" + s), type: "tubo" }); }
      }
      if (has("pierna_" + s)) {
        const bend = ang("hip_" + s, "knee_" + s, "ankle_" + s), twist = tw("hip_" + s, "knee_" + s);
        if (bend > 95) out.push({ at: W("knee_" + s), type: "medio" });
        else if (bend > 30) out.push({ at: W("knee_" + s), type: "zigzag" });
        else if (twist > 35) out.push({ at: mid("hip_" + s, "knee_" + s), type: "espiral" });
        else out.push({ at: mid("knee_" + s, "ankle_" + s), type: "tubo" });
      }
    }
    if (has("torso")) {
      const twist = tw("spine1", "spine2", "spine3", "chest");
      const u = W("chest").sub(W("hips")).normalize(), hipUp = new THREE.Vector3(0, 1, 0).applyQuaternion(fig.joints.hips.getWorldQuaternion(new THREE.Quaternion()));
      const bend = Math.acos(Math.max(-1, Math.min(1, u.dot(hipUp)))) * 180 / Math.PI;
      if (twist > 30) out.push({ at: W("spine2"), type: "espiral" });
      else if (bend > 35) out.push({ at: W("spine1"), type: "zigzag" });
    }
    for (const { parts } of garments) for (const p of parts) if (p.kind === "sheet") {
      const N = p.rows * p.cols; let n = 0; const c = new THREE.Vector3(), floorY = floorLocal() + 0.012;
      for (let i = 0; i < N; i++) if (p.pos[i * 3 + 1] < floorY) { n++; c.x += p.pos[i * 3]; c.y += p.pos[i * 3 + 1]; c.z += p.pos[i * 3 + 2]; }
      const hem = (p.rows - 1) * p.cols + Math.floor(p.cols / 2);
      if (n > N * 0.04) out.push({ at: c.multiplyScalar(1 / n).applyMatrix4(fig.root.matrixWorld), type: "inerte" });
      out.push({ at: new THREE.Vector3(p.pos[hem * 3], p.pos[hem * 3 + 1], p.pos[hem * 3 + 2]).applyMatrix4(fig.root.matrixWorld), type: "caida" });
    }
    labels = out;
  }
  const floorLocal = () => -fig.root.position.y + 0.004;

  let sig = "", settled = false, changedAt = 0;
  function signature() {
    let s = ""; for (const j of Object.values(fig.joints)) { const q = j.quaternion; s += (q.x * 1e3 | 0) + "," + (q.y * 1e3 | 0) + "," + (q.z * 1e3 | 0) + ";"; }
    const h = fig.joints.hips.position; s += (h.x * 1e3 | 0) + "," + (h.y * 1e3 | 0) + "," + (h.z * 1e3 | 0);
    const r = fig.root; s += "|" + (r.position.y * 1e3 | 0) + "," + (r.rotation.y * 1e3 | 0);
    return s;
  }
  // mode: "settle" (reposo completo, determinista) | "live" (pocos pasos mientras se arrastra)
  function update(mode = "settle") {
    skinMatrices();
    const caps = colliders(0.012), floorY = floorLocal();
    handle.caps = caps;
    const ry = -fig.root.rotation.y, wa = windDir * Math.PI / 180;
    const windV = new THREE.Vector3(Math.sin(wa), 0.15, Math.cos(wa)).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry).multiplyScalar(wind * 9);
    for (const { g, parts } of garments) {
      const M = MATERIALS[g.mat] || MATERIALS.medio;
      for (const p of parts) {
        if (p.kind === "sheet") simulate(p, mode === "settle" ? Qs.steps : 4, mode === "settle" || !p.started, caps, floorY, windV), p.started = true;
        else skinTo(p, p.pos);
        const twist = p.name.startsWith("manga") ? Math.sign(readJoint(fig, "elbow_" + p.name.slice(-1))[1]) * Math.min(3, Math.abs(readJoint(fig, "elbow_" + p.name.slice(-1))[1]) / 25) : 0;
        foldsOn(p, M, twist);
        p.geo.attributes.position.needsUpdate = true; p.geo.computeVertexNormals(); p.geo.computeBoundingSphere();
        if (showMap) colorMap(p, baseCol);
      }
    }
    if (mode === "settle") classify();
    sig = signature(); settled = mode === "settle";
  }
  // Se llama en cada cuadro: actualiza solo si la pose cambió; asienta la tela al soltar
  function tick(now = performance.now()) {
    const s = signature();
    if (s !== sig) { changedAt = now; update("live"); return true; }
    if (!settled && now - changedAt > 220) { update("settle"); return true; }
    return false;
  }
  function setStyle({ color, map } = {}) {
    if (color !== undefined) useColor = color;
    if (map !== undefined) showMap = map;
    for (const { g, parts } of garments) for (const p of parts) p.mesh.material = clothMat(p.dark ? shade(g.color) : g.color, useColor, showMap);
    if (showMap) for (const { parts } of garments) for (const p of parts) colorMap(p, baseCol);
  }
  function setWind(w, dir) { wind = w; windDir = dir; update("settle"); }
  function dispose() { for (const m of hidden) m.visible = true; fig.root.remove(group); for (const { parts } of garments) for (const p of parts) p.geo.dispose(); }
  const handle = { group, update, tick, setStyle, setWind, dispose, labels: () => labels, garments };
  update("settle");
  return handle;
}
function shade(hex) { const c = new THREE.Color(hex); c.multiplyScalar(0.55); return "#" + c.getHexString(); }
