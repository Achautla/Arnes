// Cuerpo realista (malla MakeHuman, CC0) manejado por las articulaciones del maniquí.
// El maniquí sigue siendo el esqueleto que se posa, se resuelve con IK y se toca; esta malla solo lo viste.
import * as THREE from "three";

const BASE = new URL("../data/human/", import.meta.url).href;
let H = null, loading = null;
export const humanReady = () => !!H;
export const humanData = () => H;
export function loadHuman() {
  return loading ??= (async () => {
    const [meta, buf] = await Promise.all([
      fetch(BASE + "human.json").then(r => { if (!r.ok) throw new Error("human.json " + r.status); return r.json(); }),
      fetch(BASE + "human.bin").then(r => { if (!r.ok) throw new Error("human.bin " + r.status); return r.arrayBuffer(); }),
    ]);
    const part = (k, T) => { const [o, n] = meta.parts[k]; return new T(buf, o, n / T.BYTES_PER_ELEMENT); };
    H = {
      N: meta.N, buf, bones: meta.bones, sliders: meta.sliders,
      pos: part("pos", Float32Array), body: part("body", Uint16Array), eyeL: part("eyeL", Uint16Array), eyeR: part("eyeR", Uint16Array),
      si: part("si", Uint8Array), sw: part("sw", Uint8Array), brow: part("brow", Uint8Array), lips: part("lips", Uint8Array),
      morphs: new Map(meta.morphs.map(m => [m.n, m])), cache: new Map(),
    };
    H.boneIndex = Object.fromEntries(H.bones.map((b, i) => [b.name, i]));
    // hueso dominante de cada vértice (para saber qué articulación tocaste)
    H.dom = new Uint8Array(H.N);
    for (let i = 0; i < H.N; i++) H.dom[i] = H.si[i * 4];
    dispatchEvent(new Event("arnes-human"));
    return H;
  })().catch(e => { loading = null; throw e; });
}

// ------------------------------------------------------------------ forma
export const DEFAULT_HUMAN = { gender: 1, age: 0.5, muscle: 0.5, weight: 0.5, height: 0.5, race: [0.2, 0.2, 0.6], s: {} };
export const RACES = ["african", "asian", "caucasian"];
// Edad en años ↔ valor MakeHuman (0.1875 = 11 años, 0.5 = 25, 1 = 90)
export const ageToYears = a => a < 0.5 ? 11 + (a - 0.1875) / 0.3125 * 14 : 25 + (a - 0.5) / 0.5 * 65;
export const yearsToAge = y => y < 25 ? 0.1875 + (Math.max(11, y) - 11) / 14 * 0.3125 : 0.5 + (Math.min(90, y) - 25) / 65 * 0.5;

function addMorph(out, name, w) {
  if (!w) return;
  const m = H.morphs.get(name); if (!m) return;
  let c = H.cache.get(name);
  if (!c) { c = m.d ? { q: new Int8Array(H.buf, m.o, H.N * 3) } : { idx: new Uint16Array(H.buf, m.o, m.c), q: new Int8Array(H.buf, m.o + m.c * 2, m.c * 3) }; H.cache.set(name, c); }
  const k = m.s * w, q = c.q;
  if (!c.idx) { for (let i = 0; i < q.length; i++) out[i] += q[i] * k; return; }
  const idx = c.idx;
  for (let i = 0; i < idx.length; i++) { const v = idx[i] * 3, j = i * 3; out[v] += q[j] * k; out[v + 1] += q[j + 1] * k; out[v + 2] += q[j + 2] * k; }
}
const tri = (v, lo, hi) => v < 0.5 ? [[lo, (0.5 - v) / 0.5], ["avg", 1 - (0.5 - v) / 0.5]] : [["avg", (1 - v) / 0.5], [hi, 1 - (1 - v) / 0.5]];
export function macroTerms(h) {
  const g = clamp01(h.gender ?? 0.5), a = Math.max(0.1875, clamp01(h.age ?? 0.5));
  const G = [["female", 1 - g], ["male", g]];
  const A = a < 0.5 ? [["child", (0.5 - a) / 0.3125], ["young", 1 - (0.5 - a) / 0.3125]] : [["young", (1 - a) / 0.5], ["old", 1 - (1 - a) / 0.5]];
  const Mu = tri(clamp01(h.muscle ?? 0.5), "minmuscle", "maxmuscle").map(([k, w]) => [k === "avg" ? "averagemuscle" : k, w]);
  const W = tri(clamp01(h.weight ?? 0.5), "minweight", "maxweight").map(([k, w]) => [k === "avg" ? "averageweight" : k, w]);
  const race = h.race || DEFAULT_HUMAN.race, rs = race.reduce((s, x) => s + x, 0) || 1;
  const out = [];
  for (const [gn, gw] of G) for (const [an, aw] of A) {
    if (!gw || !aw) continue;
    for (const [mn, mw] of Mu) for (const [wn, ww] of W) out.push([`u/${gn}/${an}/${mn}/${wn}`, gw * aw * mw * ww]);
    RACES.forEach((r, i) => out.push([`r/${r}/${gn}/${an}`, gw * aw * race[i] / rs]));
    const ht = h.height ?? 0.5;
    if (ht > 0.5) out.push([`h/${gn}/${an}/maxheight`, gw * aw * (ht - 0.5) * 2]);
    else if (ht < 0.5) out.push([`h/${gn}/${an}/minheight`, gw * aw * (0.5 - ht) * 2]);
  }
  for (const [k, v] of Object.entries(h.s || {})) if (v) out.push([`s/${k}/${v > 0 ? "+" : "-"}`, Math.abs(v)]);
  return out;
}
const clamp01 = v => Math.min(1, Math.max(0, v));
const shapeCache = new Map();
export function shapeOf(h) {
  const key = JSON.stringify(h);
  if (shapeCache.has(key)) return shapeCache.get(key);
  const out = Float32Array.from(H.pos);
  for (const [n, w] of macroTerms(h)) addMorph(out, n, w);
  // cabeza más chica o más grande que el cuerpo (proporciones estilizadas: héroe de 9 cabezas, figuras tipo JoJo)
  if (h.headScale && Math.abs(h.headScale - 1) > 1e-3) {
    const hb = H.boneIndex.head, nb = H.boneIndex.neck_01, J0 = heads(out), c = J0[hb].head.clone();
    for (let v = 0; v < H.N; v++) {
      let w = 0; for (let k = 0; k < 4; k++) { const b = H.si[v * 4 + k]; if (b === hb) w += H.sw[v * 4 + k] / 255; else if (b === nb) w += H.sw[v * 4 + k] / 255 * 0.35; }
      if (w <= 0) continue;
      const k = 1 + (h.headScale - 1) * Math.min(1, w);
      out[v * 3] = c.x + (out[v * 3] - c.x) * k; out[v * 3 + 1] = c.y + (out[v * 3 + 1] - c.y) * k; out[v * 3 + 2] = c.z + (out[v * 3 + 2] - c.z) * k;
    }
  }
  // pies en el piso después de la forma
  let minY = Infinity; for (let i = 0; i < 13380; i++) minY = Math.min(minY, out[i * 3 + 1]);
  for (let i = 1; i < out.length; i += 3) out[i] -= minY;
  if (shapeCache.size > 24) shapeCache.delete(shapeCache.keys().next().value);
  shapeCache.set(key, out); return out;
}
// Expresiones del maniquí (cejas, párpados, boca) → unidades de expresión de MakeHuman
function exprTerms(e) {
  if (!e) return [];
  const t = [], side = ["left", "right"];
  for (let i = 0; i < 2; i++) {
    const b = e.brow?.[i] || 0, ang = e.brow?.[2 + i] || 0, lid = e.lid?.[i] ?? 0.85, s = side[i];
    if (b > 0) t.push([`e/eyebrows-${s}-up`, b]); else if (b < 0) t.push([`e/eyebrows-${s}-down`, -b]);
    if (ang > 0) t.push([`e/eyebrows-${s}-inner-up`, Math.min(1, ang / 22)]); else if (ang < 0) t.push([`e/eyebrows-${s}-down`, Math.min(1, -ang / 25)], [`e/eyebrows-${s}-extern-up`, Math.min(1, -ang / 40)]);
    if (lid < 0.85) t.push([`e/eye-${s}-closure`, Math.min(1, (0.85 - lid) / 0.85)]); else if (lid > 0.85) t.push([`e/eye-${s}-opened-up`, Math.min(1, (lid - 0.85) / 0.35)]);
  }
  const sm = ((e.smile?.[0] || 0) + (e.smile?.[1] || 0)) / 2;
  if (sm > 0) t.push(["e/mouth-corner-puller", sm], ["e/mouth-elevation", sm * 0.3]); else if (sm < 0) t.push(["e/mouth-depression", -sm]);
  const op = Math.min(1, (e.open || 0) + (e.jaw || 0) / 40);
  if (op > 0) t.push(["e/mouth-open", op]);
  const w = e.wide ?? 1;
  if (w > 1) t.push(["e/mouth-retraction", Math.min(1, (w - 1) / 0.25)]); else if (w < 1) t.push(["e/mouth-pursing", Math.min(1, (1 - w) / 0.25)]);
  return t;
}
export function heads(P) {
  const mean = idx => { const v = new THREE.Vector3(); for (const i of idx) v.x += P[i * 3], v.y += P[i * 3 + 1], v.z += P[i * 3 + 2]; return v.multiplyScalar(1 / idx.length); };
  return H.bones.map(b => ({ head: mean(b.head), tail: mean(b.tail) }));
}
// Medidas para que el maniquí (esqueleto de pose) quede con los huesos de este cuerpo
export function humanDims(h) {
  const P = shapeOf(h), J = heads(P), B = n => J[H.boneIndex[n]];
  let top = 0; for (let i = 0; i < 13380; i++) top = Math.max(top, P[i * 3 + 1]);
  const d = {
    H: top, hipsY: B("pelvis").head.y, chestY: B("spine_03").head.y, shoulderY: B("upperarm_l").head.y, sw: B("upperarm_l").head.x,
    neckY: B("neck_01").head.y, headY: B("head").head.y, hipJY: B("thigh_l").head.y, hw: B("thigh_l").head.x,
    kneeY: B("calf_l").head.y, ankleY: B("foot_l").head.y,
    upper: B("upperarm_l").head.distanceTo(B("lowerarm_l").head), fore: B("lowerarm_l").head.distanceTo(B("hand_l").head),
    hand: B("hand_l").head.distanceTo(B("middle_03_l").tail),
  };
  d.hh = top - d.headY;
  return d;
}

// ------------------------------------------------------------------ correspondencia maniquí ↔ huesos
const MAP = {
  pelvis: "hips", spine_01: "spine1", spine_02: "spine3", spine_03: "chest", neck_01: "neck1", head: "head",
};
for (const [s, S] of [["l", "L"], ["r", "R"]]) {
  Object.assign(MAP, {
    [`clavicle_${s}`]: `clavicle_${S}`, [`upperarm_${s}`]: `shoulder_${S}`, [`lowerarm_${s}`]: `elbow_${S}`, [`hand_${s}`]: `wrist_${S}`,
    [`thigh_${s}`]: `hip_${S}`, [`calf_${s}`]: `knee_${S}`, [`foot_${s}`]: `ankle_${S}`, [`ball_${s}`]: `toes_${S}`,
  });
  for (const f of ["thumb", "index", "middle", "ring", "pinky"]) for (let n = 1; n <= 3; n++) MAP[`${f}_0${n}_${s}`] = `${f}${n}_${S}`;
}
const NEXT = { hips: "spine1", spine1: "spine2", spine3: "chest", chest: "neck1", neck1: "head" };
for (const S of ["L", "R"]) {
  Object.assign(NEXT, { [`clavicle_${S}`]: `shoulder_${S}`, [`shoulder_${S}`]: `elbow_${S}`, [`elbow_${S}`]: `wrist_${S}`, [`wrist_${S}`]: `middle1_${S}`, [`hip_${S}`]: `knee_${S}`, [`knee_${S}`]: `ankle_${S}`, [`ankle_${S}`]: `toes_${S}` });
  for (const f of ["thumb", "index", "middle", "ring", "pinky"]) { NEXT[`${f}1_${S}`] = `${f}2_${S}`; NEXT[`${f}2_${S}`] = `${f}3_${S}`; }
}
const isArm = n => /^(upperarm|lowerarm|hand|thumb|index|middle|ring|pinky)/.test(n);
const isFoot = n => /^(foot|ball)/.test(n);
function frameQuat(dir, sec) {
  const x = dir.clone().normalize(), z = sec.clone().addScaledVector(x, -sec.dot(x));
  if (z.lengthSq() < 1e-8) z.set(0, 0, 1).addScaledVector(x, -x.z);
  z.normalize(); const y = new THREE.Vector3().crossVectors(z, x);
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
}
// Posiciones y giros del maniquí en reposo, en el espacio de la figura
function restOf(fig) {
  const saved = new Map();
  for (const [n, j] of Object.entries(fig.joints)) { saved.set(j, [j.quaternion.clone(), j.position.clone()]); j.quaternion.copy(n === "hips" ? new THREE.Quaternion() : (j.userData.rest || new THREE.Quaternion())); }
  fig.joints.hips.position.copy(fig.restHips);
  const rp = fig.root.position.clone(), rq = fig.root.quaternion.clone(), rs = fig.root.scale.clone();
  fig.root.position.set(0, 0, 0); fig.root.quaternion.identity(); fig.root.scale.set(1, 1, 1);
  fig.root.updateMatrixWorld(true);
  const out = {};
  for (const [n, j] of Object.entries(fig.joints)) out[n] = { p: new THREE.Vector3().setFromMatrixPosition(j.matrixWorld), q: j.getWorldQuaternion(new THREE.Quaternion()) };
  for (const [j, [q, p]] of saved) { j.quaternion.copy(q); j.position.copy(p); }
  fig.root.position.copy(rp); fig.root.quaternion.copy(rq); fig.root.scale.copy(rs);
  fig.root.updateMatrixWorld(true);
  return out;
}

function relocate(fig, J) {
  const want = {};
  for (const [bn, jn] of Object.entries(MAP)) if (fig.joints[jn] && H.boneIndex[bn] !== undefined) want[jn] = J[H.boneIndex[bn]].head.clone();
  const mid = (a, b) => a.clone().add(b).multiplyScalar(0.5);
  want.spine2 = mid(want.spine1, want.spine3);
  want.neck2 = mid(want.neck1, want.head);
  // los brazos del maniquí cuelgan rectos en reposo (las poses cuentan desde ahí): solo toman los largos del cuerpo
  const R = restOf(fig);
  for (const S of ["L", "R"]) {
    const s = S.toLowerCase(), b = n => J[H.boneIndex[`${n}_${s}`]];
    const sh = want[`shoulder_${S}`];
    want[`elbow_${S}`] = sh.clone().add(new THREE.Vector3(0, -b("upperarm").head.distanceTo(b("lowerarm").head), 0));
    want[`wrist_${S}`] = want[`elbow_${S}`].clone().add(new THREE.Vector3(0, -b("lowerarm").head.distanceTo(b("hand").head), 0));
    const handK = b("hand").head.distanceTo(b("middle_03").tail) / R[`wrist_${S}`].p.distanceTo(R[`middle3_${S}`].p) * 0.82;
    for (const f of ["thumb", "index", "middle", "ring", "pinky"]) for (let n = 1; n <= 3; n++) {
      const k = `${f}${n}_${S}`; want[k] = want[`wrist_${S}`].clone().add(R[k].p.clone().sub(R[`wrist_${S}`].p).multiplyScalar(handK));
    }
  }
  // recorre de padres a hijos: posición local = giro de reposo del padre⁻¹ · (deseada − del padre)
  const order = []; fig.root.traverse(o => { if (o.userData.jointName) order.push(o); });
  const newW = new Map();
  for (const o of order) {
    const n = o.userData.jointName, par = o.parent;
    const pw = par.userData.jointName ? newW.get(par.userData.jointName) : new THREE.Vector3();
    const target = want[n] || pw.clone().add(R[n].p.clone().sub(par.userData.jointName ? R[par.userData.jointName].p : new THREE.Vector3()));
    newW.set(n, target);
    if (n === "hips") { const off = o.position.clone().sub(fig.restHips); fig.restHips.copy(target); o.position.copy(target).add(off); continue; }
    const pq = par.userData.jointName ? R[par.userData.jointName].q.clone().invert() : new THREE.Quaternion();
    o.position.copy(target.clone().sub(pw).applyQuaternion(pq));
  }
  fig.root.updateMatrixWorld(true);
}

// ------------------------------------------------------------------ materiales
const SKIN_DEFAULT = "#c99a76", CLAY = "#bdb6ac";
function skinMaterial() {
  return new THREE.MeshPhysicalMaterial({ color: SKIN_DEFAULT, vertexColors: true, roughness: 0.55, metalness: 0, sheen: 0.3, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xff9a80), clearcoat: 0.05, clearcoatRoughness: 0.6 });
}
const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.25 });

// ------------------------------------------------------------------ figura
// Viste la figura del maniquí con el cuerpo realista. Devuelve el controlador (o null si aún no cargan los datos)
export function attachHuman(fig, h, face) {
  if (!H) return null;
  h = { ...DEFAULT_HUMAN, ...h };
  const N = H.N;
  const shape = Float32Array.from(shapeOf(h));
  const SW = Float32Array.from(H.sw, x => x / 255), SI = Uint16Array.from(H.si);
  const J = heads(shape);
  const cut = cutLimbs(shape, SI, SW, J, h.limbs || {});
  const geo = new THREE.BufferGeometry();
  const pos = new THREE.BufferAttribute(Float32Array.from(shape), 3);
  geo.setAttribute("position", pos);
  geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(SI, 4));
  geo.setAttribute("skinWeight", new THREE.BufferAttribute(SW, 4));
  const col = new Float32Array(N * 3).fill(1);
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const bodyIdx = cut.keep ? H.body.filter((_, k) => cut.keep[(k / 3) | 0]) : H.body;
  const idx = new Uint32Array(bodyIdx.length + H.eyeL.length + H.eyeR.length);
  idx.set(bodyIdx, 0); idx.set(H.eyeL, bodyIdx.length); idx.set(H.eyeR, bodyIdx.length + H.eyeL.length);
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.addGroup(0, bodyIdx.length, 0); geo.addGroup(bodyIdx.length, H.eyeL.length + H.eyeR.length, 1);
  const skin = skinMaterial();
  const mesh = new THREE.SkinnedMesh(geo, [skin, eyeMat]);
  mesh.name = "cuerpo-realista"; mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false;
  mesh.userData.human = true;
  // Esqueleto en reposo de MakeHuman: huesos sin giro, colocados en sus cabezas
  const bones = H.bones.map((b, i) => { const o = new THREE.Bone(); o.name = b.name; return o; });
  H.bones.forEach((b, i) => {
    const p = b.parent >= 0 ? J[b.parent].head : new THREE.Vector3();
    bones[i].position.copy(J[i].head).sub(p);
    if (b.parent >= 0) bones[b.parent].add(bones[i]); else mesh.add(bones[i]);
  });
  // Ojos: color de iris por dirección desde el centro de cada ojo
  paintEyes(col, shape);
  // el maniquí deja de verse y de tocarse: lo reemplaza esta malla
  fig.root.traverse(m => { if (m.isMesh && !m.userData.human) { m.layers.set(7); m.userData.mannequinHidden = true; } });
  fig.root.add(mesh);
  fig.root.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(bones));

  // Las articulaciones del maniquí se mudan a las de este cuerpo (pelo, objetos e IK quedan en su lugar)
  relocate(fig, J);
  // Alineación de cada hueso con su articulación del maniquí, en reposo
  const R = restOf(fig);
  const across = (s, S) => ({ h: J[H.boneIndex[`pinky_01_${s}`]].head.clone().sub(J[H.boneIndex[`index_01_${s}`]].head), m: R[`pinky1_${S}`].p.clone().sub(R[`index1_${S}`].p) });
  const AC = { l: across("l", "L"), r: across("r", "R") };
  const pairs = [];
  H.bones.forEach((b, i) => {
    const j = MAP[b.name]; if (!j || !fig.joints[j]) return;
    const hdir = J[i].tail.clone().sub(J[i].head);
    const nx = NEXT[j];
    let mdir;
    if (nx && R[nx]) mdir = R[nx].p.clone().sub(R[j].p);
    else if (j === "head") mdir = new THREE.Vector3(0, 1, 0);
    else if (/^toes/.test(j)) mdir = new THREE.Vector3(0, 0, 1);
    else { const prev = Object.keys(NEXT).find(k => NEXT[k] === j); mdir = R[j].p.clone().sub(R[prev].p); }
    const side = /_l$/.test(b.name) ? "l" : /_r$/.test(b.name) ? "r" : null;
    let sh, sm;
    if (side && isArm(b.name)) { sh = AC[side].h; sm = AC[side].m; }
    else if (isFoot(b.name)) { sh = sm = new THREE.Vector3(1, 0, 0); }
    else { sh = sm = new THREE.Vector3(0, 0, 1); }
    const A = frameQuat(mdir, sm).multiply(frameQuat(hdir, sh).invert());
    pairs.push({ i, j, A, R0inv: R[j].q.clone().invert() });
  });
  const pelvisLocal = bones[H.boneIndex.pelvis].position.clone();
  const W = bones.map(() => new THREE.Quaternion());
  const rootInv = new THREE.Quaternion(), tq = new THREE.Quaternion(), hipP = new THREE.Vector3(), inv = new THREE.Matrix4();
  const byBone = new Map(pairs.map(p => [p.i, p]));
  function drive() {
    inv.copy(fig.root.matrixWorld).invert();
    fig.root.getWorldQuaternion(rootInv).invert();
    for (let i = 0; i < bones.length; i++) {
      const p = byBone.get(i), par = H.bones[i].parent;
      if (p) {
        fig.joints[p.j].getWorldQuaternion(tq);
        W[i].copy(rootInv).multiply(tq).multiply(p.R0inv).multiply(p.A);
      } else if (par >= 0) W[i].copy(W[par]); else W[i].identity();
      if (par >= 0) bones[i].quaternion.copy(W[par]).invert().multiply(W[i]); else bones[i].quaternion.copy(W[i]);
    }
    hipP.setFromMatrixPosition(fig.joints.hips.matrixWorld).applyMatrix4(inv);
    bones[0].position.copy(hipP).sub(pelvisLocal);
    bones[0].updateMatrixWorld(true);
  }
  const orig = fig.root.updateMatrixWorld;
  fig.root.updateMatrixWorld = function (force) { orig.call(this, force); drive(); };
  // qué articulación del maniquí tocaste
  const jointOfBone = H.bones.map(b => { let n = b.name, k = H.boneIndex[n]; while (k >= 0 && !MAP[H.bones[k].name]) k = H.bones[k].parent; return k >= 0 ? MAP[H.bones[k].name] : "hips"; });
  mesh.userData.jointAt = vi => jointOfBone[H.dom[vi]] || "hips";

  const eyeFix = [];
  for (const [S, side] of [["L", "left"], ["R", "right"]]) if (h.eyes?.[S] === "cerrado" || h.eyes?.[S] === "parche") eyeFix.push([`e/eye-${side}-closure`, h.eyes?.[S] === "parche" ? 0.6 : 1]);
  const ctl = {
    mesh, spec: h, skin, shape, J, bones, SI, SW, geo, cut,
    setExpression(e) {
      const P = pos.array; P.set(shape);
      const terms = exprTerms(e).filter(([n]) => !eyeFix.some(([m]) => m.replace("closure", "") === n.replace(/closure|opened-up|slit/, "")));
      for (const [n, w] of [...terms, ...eyeFix]) addMorph(P, n, w);
      pos.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
    },
    setStyle(useColor, hex, browHex) {
      skin.color.set(useColor ? hex || SKIN_DEFAULT : CLAY);
      tint(col, useColor, browHex);
      marks(col, shape, J, h, useColor, hex || SKIN_DEFAULT, browHex);
      if (h.eyes?.L === "vidrio" || h.eyes?.R === "vidrio") glassEye(col, shape, h.eyes);
      geo.attributes.color.needsUpdate = true;
    },
    dispose() { fig.root.updateMatrixWorld = orig; mesh.removeFromParent(); geo.dispose(); skin.dispose(); },
  };
  ctl.extras = buildExtras(h, J, bones, cut, shape, i => byBone.get(i)?.A, R);
  ctl.setExpression(face?.expr);
  ctl.setStyle(true, null);
  fig.human = ctl;
  fig.root.updateMatrixWorld(true);
  return ctl;
}
// Cejas y labios: se tiñen en la propia piel (los datos traen la región que mueve cada rasgo)
function tint(col, useColor, browHex) {
  const b = new THREE.Color(browHex || "#3a2a22"), N = H.N;
  for (let i = 0; i < 13380; i++) {
    const br = H.brow[i] / 255 * 0.85, lp = H.lips[i] / 255 * (useColor ? 0.45 : 0.25);
    let r = 1, g = 1, bl = 1;
    r = r * (1 - br) + b.r * 2.2 * br; g = g * (1 - br) + b.g * 2.2 * br; bl = bl * (1 - br) + b.b * 2.2 * br;
    r *= 1 - lp * 0.15; g *= 1 - lp * 0.55; bl *= 1 - lp * 0.5;
    col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = bl;
  }
}
function paintEyes(col, P) {
  for (const list of [H.eyeL, H.eyeR]) {
    const vs = [...new Set(list)], c = new THREE.Vector3();
    for (const v of vs) c.add(new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]));
    c.multiplyScalar(1 / vs.length);
    for (const v of vs) {
      const d = new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]).sub(c).normalize();
      const k = d.z; // hacia el frente
      const rgb = k > 0.93 ? [0.04, 0.03, 0.03] : k > 0.8 ? [0.28, 0.18, 0.1] : [0.93, 0.91, 0.87];
      col[v * 3] = rgb[0]; col[v * 3 + 1] = rgb[1]; col[v * 3 + 2] = rgb[2];
    }
  }
}

// ------------------------------------------------------------------ extremidades diferentes
// Corte con muñón redondeado: los vértices pasado el corte se doblan sobre una cúpula y pasan al hueso que queda
export const LIMB_LEVELS = {
  brazo: { completo: "Completo", mano: "Sin mano", antebrazo: "Hasta el antebrazo", codo: "Hasta el codo", brazo: "Hasta media brazo", hombro: "Sin brazo" },
  pierna: { completo: "Completa", pie: "Sin pie", pantorrilla: "Bajo la rodilla", rodilla: "Hasta la rodilla", muslo: "Sobre la rodilla", cadera: "Sin pierna" },
};
export const PROSTHESES = {
  brazo: { ninguna: "Ninguna", gancho: "Gancho", mano: "Mano mecánica", palo: "Muñón con funda" },
  pierna: { ninguna: "Ninguna", palo: "Pata de palo", lamina: "Lámina deportiva", moderna: "Prótesis moderna" },
};
const CUTS = {
  mano: ["hand", 0.05, "lowerarm"], antebrazo: ["lowerarm", 0.5, "lowerarm"], codo: ["lowerarm", 0.04, "upperarm"], brazo: ["upperarm", 0.5, "upperarm"], hombro: ["upperarm", 0.12, "clavicle"],
  pie: ["foot", 0.02, "calf"], pantorrilla: ["calf", 0.45, "calf"], rodilla: ["calf", 0.03, "thigh"], muslo: ["thigh", 0.5, "thigh"], cadera: ["thigh", 0.14, "pelvis"],
};
function descendants(bi) { const out = new Set([bi]); let grew = true; while (grew) { grew = false; H.bones.forEach((b, i) => { if (!out.has(i) && out.has(b.parent)) { out.add(i); grew = true; } }); } return out; }
function cutLimbs(P, SI, SW, J, limbs) {
  const res = { keep: null, stumps: [] };
  const faceCount = H.body.length / 3;
  for (const [key, level] of Object.entries(limbs)) {
    const m = key.match(/^(brazo|pierna)_([LR])$/); if (!m || !CUTS[level]) continue;
    const s = m[2].toLowerCase(), [bn, f, ownerN] = CUTS[level];
    const bi = H.boneIndex[`${bn}_${s}`], owner = ownerN === "pelvis" ? H.boneIndex.pelvis : H.boneIndex[`${ownerN}_${s}`];
    const a = J[bi].head, b = J[bi].tail, axis = b.clone().sub(a).normalize(), cp = a.clone().lerp(b, f);
    const chain = descendants(bi);
    const cw = v => { let w = 0; for (let k = 0; k < 4; k++) if (chain.has(SI[v * 4 + k])) w += SW[v * 4 + k]; return w; };
    // radio del miembro en el corte
    const rs = [];
    for (let v = 0; v < 13380; v++) { if (cw(v) < 0.5) continue; const p = new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]).sub(cp); const t = p.dot(axis); if (Math.abs(t) < 0.012) rs.push(p.addScaledVector(axis, -t).length()); }
    rs.sort((x, y) => x - y); const R = rs.length ? rs[(rs.length * 0.6) | 0] : 0.05;
    const hCap = R * 0.75, s0 = -R * 0.55, gone = new Uint8Array(H.N);
    for (let v = 0; v < 13380; v++) {
      const w = cw(v); if (w < 0.02) continue;
      const p = new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]).sub(cp), t = p.dot(axis);
      if (t <= s0) continue;
      const radial = p.clone().addScaledVector(axis, -t);
      const u = Math.min((t - s0) / (hCap * 1.7), 1), th = u * Math.PI / 2;
      const np = cp.clone().addScaledVector(axis, s0 + hCap * Math.sin(th)).add(radial.multiplyScalar(Math.cos(th) * (0.92 + 0.08 * (1 - u))));
      // mezcla suave en la orilla de la zona del miembro
      const k = Math.min(1, w * 1.6), cur = new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
      cur.lerp(np, k); P[v * 3] = cur.x; P[v * 3 + 1] = cur.y; P[v * 3 + 2] = cur.z;
      if (u >= 1 && w > 0.9) gone[v] = 1;
      // el muñón se mueve con el hueso que queda
      let moved = 0;
      for (let q = 0; q < 4; q++) if (chain.has(SI[v * 4 + q]) && !(ownerN === bn && SI[v * 4 + q] === bi)) { moved += SW[v * 4 + q]; SW[v * 4 + q] = 0; }
      for (let q = 0; q < 4; q++) if (SI[v * 4 + q] === owner) { SW[v * 4 + q] += moved; moved = 0; }
      if (moved) { let mi = 0; for (let q = 1; q < 4; q++) if (SW[v * 4 + q] < SW[v * 4 + mi]) mi = q; SI[v * 4 + mi] = owner; SW[v * 4 + mi] += moved; }
    }
    res.keep ??= new Uint8Array(faceCount).fill(1);
    for (let k = 0; k < faceCount; k++) if (gone[H.body[k * 3]] && gone[H.body[k * 3 + 1]] && gone[H.body[k * 3 + 2]]) res.keep[k] = 0;
    res.stumps.push({ key, kind: m[1], side: m[2], level, bone: owner, tip: cp.clone().addScaledVector(axis, s0 + hCap), axis, R, bi });
  }
  return res;
}
// Prótesis y parche: piezas rígidas dentro del hueso que las carga
const patchMat = new THREE.MeshStandardMaterial({ color: 0x18171a, roughness: 0.85 });
const protMat = { madera: new THREE.MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.8 }), metal: new THREE.MeshStandardMaterial({ color: 0x8d9096, roughness: 0.35, metalness: 0.6 }), negro: new THREE.MeshStandardMaterial({ color: 0x1e1e20, roughness: 0.5 }), funda: new THREE.MeshStandardMaterial({ color: 0xc8c2b6, roughness: 0.7 }) };
function buildExtras(h, J, bones, cut, P, Aof = () => null, R = null) {
  const out = [];
  const put = (bi, mesh, worldPos) => { mesh.position.copy(worldPos).sub(J[bi].head); bones[bi].add(mesh); mesh.castShadow = mesh.receiveShadow = true; mesh.userData.human = true; out.push(mesh); return mesh; };
  const seg = (r1, r2, a, b, mat) => { const d = b.clone().sub(a), m = new THREE.Mesh(new THREE.CylinderGeometry(r2, r1, d.length(), 16), mat); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); return [m, a.clone().add(b).multiplyScalar(0.5)]; };
  for (const st of cut.stumps) {
    const kind = h.prosthesis?.[st.key] || "ninguna"; if (kind === "ninguna") continue;
    const s = st.side.toLowerCase(), tip = st.tip, ax = st.axis;
    if (st.kind === "pierna") {
      // el largo que falta: del corte al piso siguiendo la pierna en reposo
      const ankle = J[H.boneIndex[`foot_${s}`]].head, ground = new THREE.Vector3(ankle.x, 0.0, ankle.z + 0.02);
      const below = st.bone === H.boneIndex[`thigh_${s}`] || st.bone === H.boneIndex.pelvis;
      const knee = J[H.boneIndex[`calf_${s}`]].head;
      const sock = seg(st.R * 1.08, st.R * 0.9, tip.clone().addScaledVector(ax, -st.R * 1.6), tip.clone().addScaledVector(ax, st.R * 0.35), kind === "palo" ? protMat.madera : protMat.funda);
      put(st.bone, sock[0], sock[1]);
      const from = below ? knee : tip.clone().addScaledVector(ax, st.R * 0.3);
      const calfB = H.boneIndex[`calf_${s}`];
      if (below) {
        const k = new THREE.Mesh(new THREE.SphereGeometry(0.032, 16, 12), protMat.metal); put(calfB, k, knee);
        const top = tip.clone().addScaledVector(ax, st.R * 0.3);
        if (top.distanceTo(knee) > 0.03) { const py = seg(0.02, 0.02, top, knee, kind === "palo" ? protMat.madera : protMat.metal); put(H.boneIndex[`thigh_${s}`], py[0], py[1]); }
      }
      if (kind === "palo") { const p = seg(0.035, 0.022, from, ground.clone().setY(0.01), protMat.madera); put(calfB, p[0], p[1]); }
      else if (kind === "lamina") {
        const curve = new THREE.CatmullRomCurve3([from, from.clone().lerp(ground, 0.55).add(new THREE.Vector3(0, 0, -0.03)), ground.clone().add(new THREE.Vector3(0, 0.05, 0.06)), ground.clone().add(new THREE.Vector3(0, 0.008, 0.13))]);
        const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.016, 8), protMat.negro); put(calfB, m, new THREE.Vector3());
      } else {
        const p = seg(0.016, 0.016, from, ankle, protMat.metal); put(calfB, p[0], p[1]);
        const footB = H.boneIndex[`foot_${s}`], ft = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.05, 0.24), protMat.funda); put(footB, ft, ankle.clone().add(new THREE.Vector3(0, -ankle.y + 0.03, 0.06)));
      }
    } else {
      const handB = H.boneIndex[`hand_${s}`], wrist = J[handB].head;
      const sock = seg(st.R * 1.1, st.R * 0.95, tip.clone().addScaledVector(ax, -st.R * 1.8), tip.clone().addScaledVector(ax, st.R * 0.4), protMat.funda);
      put(st.bone, sock[0], sock[1]);
      const end = tip.clone().addScaledVector(ax, st.R * 0.4);
      if (kind === "gancho") {
        const rod = seg(0.012, 0.01, end, end.clone().addScaledVector(ax, 0.06), protMat.metal); put(st.bone, rod[0], rod[1]);
        const hook = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 8, 20, Math.PI * 1.3), protMat.metal);
        hook.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)); put(st.bone, hook, end.clone().addScaledVector(ax, 0.095));
      } else if (kind === "mano") {
        // brazo mecánico: codo y antebrazo siguen a sus huesos, así se puede doblar
        const lowB = H.boneIndex[`lowerarm_${s}`], elbow = J[lowB].head;
        const aboveElbow = st.bone !== lowB;
        if (aboveElbow) {
          if (end.distanceTo(elbow) > 0.02) { const up = seg(0.026, 0.026, end, elbow, protMat.metal); put(st.bone, up[0], up[1]); }
          const k = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), protMat.metal); put(lowB, k, elbow);
        }
        const fore = seg(0.028, 0.022, aboveElbow ? elbow : end, wrist, protMat.metal); put(lowB, fore[0], fore[1]);
        const m1 = J[H.boneIndex[`middle_01_${s}`]].head, hax = m1.clone().sub(wrist).normalize();
        const across = J[H.boneIndex[`pinky_01_${s}`]].head.clone().sub(J[H.boneIndex[`index_01_${s}`]].head).normalize();
        const palm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.085, 0.026), protMat.negro);
        palm.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(across, hax, new THREE.Vector3().crossVectors(across, hax).normalize()));
        put(handB, palm, wrist.clone().lerp(m1, 0.55));
        for (let i = 0; i < 4; i++) {
          const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0075, 0.055, 4, 8), protMat.metal); f.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), hax);
          put(handB, f, m1.clone().addScaledVector(hax, 0.035).addScaledVector(across, (i - 1.5) * 0.019));
        }
      }
    }
  }
  // apoyos que van con el personaje: bastón o muleta en la mano
  if (h.support && h.support !== "ninguno") {
    const s = h.supportSide === "L" ? "l" : "r", S = s.toUpperCase(), hb = H.boneIndex[`hand_${s}`], m3 = J[H.boneIndex[`middle_01_${s}`]].head, grip = J[hb].head.clone().lerp(m3, 0.85);
    const wood = h.support === "baston_plata" ? protMat.negro : protMat.madera;
    // el bastón cuelga recto con el brazo en reposo: su dirección se lleva al espacio del hueso
    const A = Aof(hb) || new THREE.Quaternion(), inv = A.clone().invert();
    const len = R ? Math.max(0.5, R[`wrist_${S}`].p.y - 0.07) : 0.8;
    const local = d => d.clone().applyQuaternion(inv);
    const foot = grip.clone().add(local(new THREE.Vector3(s === "l" ? 0.03 : -0.03, -len, 0.05)));
    if (h.support === "muleta") {
      const arm = grip.clone().add(local(new THREE.Vector3(s === "l" ? -0.035 : 0.035, 0.42, -0.02)));
      const a = seg(0.012, 0.012, arm.clone().add(new THREE.Vector3(0, 0, 0.03)), foot, protMat.metal); put(hb, a[0], a[1]);
      const pad = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.1, 4, 8), protMat.negro); pad.rotation.x = Math.PI / 2; put(hb, pad, arm.clone().add(new THREE.Vector3(0, -0.01, 0.03)));
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 10), protMat.negro); handle.rotation.x = Math.PI / 2; put(hb, handle, grip);
    } else {
      const a = seg(0.011, 0.009, grip.clone().add(new THREE.Vector3(0, 0.02, 0)), foot, wood); put(hb, a[0], a[1]);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 14, 10), h.support === "baston_plata" ? protMat.metal : protMat.madera); put(hb, knob, grip.clone().add(new THREE.Vector3(0, 0.03, 0)));
    }
  }
  // parche en el ojo: disco sobre el ojo y cinta alrededor de la cabeza
  const headB = H.boneIndex.head;
  for (const S of ["L", "R"]) if (h.eyes?.[S] === "parche") {
    const list = [...new Set(S === "L" ? H.eyeL : H.eyeR)], c = new THREE.Vector3();
    for (const v of list) c.add(new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]));
    c.multiplyScalar(1 / list.length);
    let zMax = -1, xMin = 1, xMax = -1, zMin = 1;
    for (let v = 0; v < 13380; v++) if (Math.abs(P[v * 3 + 1] - c.y) < 0.008 && H.dom[v] === headB) { const x = P[v * 3], z = P[v * 3 + 2]; zMax = Math.max(zMax, z); zMin = Math.min(zMin, z); xMin = Math.min(xMin, x); xMax = Math.max(xMax, x); }
    const disc = new THREE.Mesh(new THREE.SphereGeometry(0.024, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), patchMat);
    disc.scale.set(1, 0.45, 1.1); disc.rotation.x = Math.PI / 2;
    put(headB, disc, c.clone().add(new THREE.Vector3(0, 0, 0.011)));
    const band = new THREE.Mesh(new THREE.TorusGeometry(1, 0.003, 6, 48), patchMat);
    band.scale.set((xMax - xMin) / 2 * 0.93, (zMax - zMin) / 2 * 0.97, 1); band.rotation.x = Math.PI / 2;
    const holder = new THREE.Group(); holder.add(band); holder.rotation.x = 0.3;
    put(headB, holder, new THREE.Vector3((xMax + xMin) / 2, c.y + 0.02, (zMax + zMin) / 2 - 0.004));
  }
  return out;
}

// ------------------------------------------------------------------ marcas en la piel, vello facial y ojo de vidrio
export const MARKS = {
  pecas: "Pecas", manchas: "Manchas de la edad", lunar: "Lunar en la mejilla",
  cicatriz_ceja_L: "Cicatriz en la ceja izquierda", cicatriz_ceja_R: "Cicatriz en la ceja derecha", cicatriz_barbilla: "Cicatriz en la barbilla", cicatriz_mejilla: "Cicatriz en la mejilla",
  quemadura_cuello_R: "Quemadura del cuello al hombro derecho", quemadura_cuello_L: "Quemadura del cuello al hombro izquierdo",
  tatuaje_antebrazos: "Tatuajes en los antebrazos", tatuaje_pecho: "Tatuaje en el pecho", ojeras: "Ojeras", arrugas: "Arrugas marcadas",
};
export const BEARDS = { ninguna: "Sin barba", tres_dias: "Barba de tres días", candado: "Candado", corta: "Barba corta", completa: "Barba completa" };
export const MOUSTACHES = { ninguno: "Sin bigote", delgado: "Bigote delgado", grueso: "Bigote grueso" };
const hash = (x, y, z) => { const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return s - Math.floor(s); };
function faceFrame(P) {
  const e = new THREE.Vector3(); const list = [...new Set([...H.eyeL, ...H.eyeR])];
  for (const v of list) e.add(new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2])); e.multiplyScalar(1 / list.length);
  let my = 0, mz = 0, mn = 0; for (let v = 0; v < 13380; v++) if (H.lips[v] > 200) { my += P[v * 3 + 1]; mz += P[v * 3 + 2]; mn++; }
  return { eye: e, mouthY: mn ? my / mn : e.y - 0.07, mouthZ: mn ? mz / mn : e.z };
}
function marks(col, P, J, h, useColor, skinHex, hairHex) {
  const list = h.marks || [], fac = h.facial || {};
  if (!list.length && (!fac.barba || fac.barba === "ninguna")) return;
  const F = faceFrame(P), B = n => J[H.boneIndex[n]], skinC = new THREE.Color(skinHex), hair = new THREE.Color(hairHex || "#2b2522");
  const mixTo = (v, c, a) => { // color final c sobre la piel: el vértice multiplica el tono de la piel
    if (a <= 0) return; const r = Math.min(1.6, c.r / Math.max(0.05, skinC.r)), g = Math.min(1.6, c.g / Math.max(0.05, skinC.g)), b = Math.min(1.6, c.b / Math.max(0.05, skinC.b));
    col[v * 3] += (r - col[v * 3]) * a; col[v * 3 + 1] += (g - col[v * 3 + 1]) * a; col[v * 3 + 2] += (b - col[v * 3 + 2]) * a;
  };
  const scar = new THREE.Color(skinHex).lerp(new THREE.Color("#e8b8a8"), 0.55), burn = new THREE.Color(skinHex).lerp(new THREE.Color("#b45a52"), 0.45), ink = new THREE.Color("#2a3140"), dark = new THREE.Color(skinHex).multiplyScalar(0.7);
  const seg = (p, a, b, w) => { const ab = b.clone().sub(a), t = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), 0, 1); return Math.exp(-(p.distanceToSquared(a.clone().addScaledVector(ab, t))) / (w * w)); };
  const hb = H.boneIndex.head, p = new THREE.Vector3();
  const browL = new THREE.Vector3(F.eye.x + 0.033, F.eye.y + 0.022, F.eye.z + 0.012), browR = browL.clone().setX(F.eye.x - 0.033);
  for (let v = 0; v < 13380; v++) {
    p.set(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
    const face = H.dom[v] === hb && p.z > F.eye.z - 0.05;
    for (const m of list) {
      if (m === "pecas" && face && Math.abs(p.y - (F.eye.y - 0.03)) < 0.03 && hash(p.x * 9, p.y * 9, p.z * 9) > 0.86) mixTo(v, dark, 0.55);
      else if (m === "manchas" && (face || /hand|lowerarm/.test(H.bones[H.dom[v]].name)) && hash(p.x * 3, p.y * 3, p.z * 3) > 0.95) mixTo(v, dark, 0.4);
      else if (m === "lunar" && face) mixTo(v, new THREE.Color("#3a2519"), Math.exp(-p.distanceToSquared(new THREE.Vector3(F.eye.x - 0.04, F.mouthY + 0.02, F.mouthZ - 0.01)) / 0.00002));
      else if (m === "cicatriz_ceja_L" || m === "cicatriz_ceja_R") { const c = m.endsWith("L") ? browL : browR; if (face) mixTo(v, scar, seg(p, c.clone().add(new THREE.Vector3(0.004, 0.018, 0)), c.clone().add(new THREE.Vector3(-0.004, -0.014, 0)), 0.0025)); }
      else if (m === "cicatriz_barbilla" && face) mixTo(v, scar, seg(p, new THREE.Vector3(F.eye.x - 0.012, F.mouthY - 0.045, F.mouthZ), new THREE.Vector3(F.eye.x + 0.014, F.mouthY - 0.04, F.mouthZ), 0.003));
      else if (m === "cicatriz_mejilla" && face) mixTo(v, scar, seg(p, new THREE.Vector3(F.eye.x + 0.06, F.eye.y - 0.02, F.eye.z), new THREE.Vector3(F.eye.x + 0.035, F.mouthY + 0.005, F.mouthZ), 0.003));
      else if (m.startsWith("quemadura_cuello")) {
        const s = m.endsWith("R") ? "r" : "l", a = B("neck_01").head.clone().add(new THREE.Vector3(s === "r" ? -0.04 : 0.04, 0.03, 0)), b = B(`upperarm_${s}`).head;
        const w = seg(p, a, b, 0.055) * (0.6 + 0.4 * hash(p.x * 40, p.y * 40, p.z * 40));
        mixTo(v, burn, Math.min(1, w * 1.4));
      } else if (m === "tatuaje_antebrazos" && /lowerarm/.test(H.bones[H.dom[v]].name)) {
        const t = Math.sin(p.y * 160 + Math.sin(p.x * 90) * 3) * Math.sin(p.z * 120 + p.y * 40);
        if (t > 0.55) mixTo(v, ink, 0.75);
      } else if (m === "tatuaje_pecho" && /spine_03/.test(H.bones[H.dom[v]].name) && p.z > 0.03) {
        const c = B("spine_03").head.clone().add(new THREE.Vector3(0.06, 0.06, 0.12)), d = Math.hypot(p.x - c.x, p.y - c.y);
        if (Math.abs(Math.sin(d * 140)) > 0.8 && d < 0.05) mixTo(v, ink, 0.75);
      } else if (m === "ojeras" && face && Math.abs(Math.abs(p.x - F.eye.x) - 0.033) < 0.02 && p.y < F.eye.y - 0.008 && p.y > F.eye.y - 0.026) mixTo(v, new THREE.Color(skinHex).multiplyScalar(0.78).lerp(new THREE.Color("#6a5060"), 0.2), 0.5);
    }
    // vello facial pintado: barba de tres días y la base de las barbas
    if (fac.barba && fac.barba !== "ninguna" && face) {
      const below = p.y < F.mouthY + 0.012, sides = Math.abs(p.x - F.eye.x) > 0.045 && p.y < F.eye.y - 0.045;
      const lip = Math.abs(p.x - F.eye.x) < 0.028 && p.y > F.mouthY + 0.006 && p.y < F.mouthY + 0.022;
      const candado = fac.barba === "candado" && !(Math.abs(p.x - F.eye.x) < 0.03 || lip);
      if ((below || sides || lip) && !candado && p.y > B("neck_01").head.y + 0.02) mixTo(v, hair, fac.barba === "tres_dias" ? 0.35 + 0.15 * hash(p.x * 70, p.y * 70, p.z * 70) : 0.6);
    }
  }
}
function glassEye(col, P, eyes) {
  for (const [S, list] of [["L", H.eyeL], ["R", H.eyeR]]) {
    if (eyes[S] !== "vidrio") continue;
    const vs = [...new Set(list)], c = new THREE.Vector3();
    for (const v of vs) c.add(new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2])); c.multiplyScalar(1 / vs.length);
    for (const v of vs) { // iris pálido, un poco desviado hacia afuera
      const d = new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]).sub(c).normalize(), k = d.z * 0.97 + d.x * (S === "L" ? 0.24 : -0.24);
      const rgb = k > 0.94 ? [0.25, 0.27, 0.3] : k > 0.82 ? [0.62, 0.68, 0.72] : [0.95, 0.94, 0.92];
      col[v * 3] = rgb[0]; col[v * 3 + 1] = rgb[1]; col[v * 3 + 2] = rgb[2];
    }
  }
}
