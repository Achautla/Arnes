// Ropa y cabello para el cuerpo realista: capas que nacen de la propia piel (siguen la forma y la pose)
import * as THREE from "three";
import { humanData } from "./human.js";
import { texturedMat } from "./util.js";

const CLAY = "#bdb6ac";
// Datos por cuerpo: normales, a qué parte pertenece cada vértice y qué tan abajo está en brazo o pierna
function prep(ctl) {
  if (ctl._prep) return ctl._prep;
  const H = humanData(), N = H.N, P = ctl.shape, J = ctl.J, B = n => J[H.boneIndex[n]];
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(P, 3)); g.setIndex(new THREE.BufferAttribute(H.body, 1)); g.computeVertexNormals();
  const nrm = g.getAttribute("normal").array;
  const set = names => new Set(names.map(n => H.boneIndex[n]).filter(i => i !== undefined));
  const arm = { L: set(["upperarm_l", "lowerarm_l", "hand_l", ...fingerNames("l")]), R: set(["upperarm_r", "lowerarm_r", "hand_r", ...fingerNames("r")]) };
  const leg = { L: set(["thigh_l", "calf_l", "foot_l", "ball_l"]), R: set(["thigh_r", "calf_r", "foot_r", "ball_r"]) };
  const headS = set(["head", "neck_01"]), headOnly = set(["head"]);
  const W = (v, S) => { let w = 0; for (let k = 0; k < 4; k++) if (S.has(ctl.SI[v * 4 + k])) w += ctl.SW[v * 4 + k]; return w; };
  const armW = new Float32Array(N), legW = new Float32Array(N), headW = new Float32Array(N), hW = new Float32Array(N), armU = new Float32Array(N), legU = new Float32Array(N), side = new Int8Array(N);
  const along = (p, a, b, c) => { // 0 en a, 0.5 en b, 1 en c
    const ab = b.clone().sub(a), bc = c.clone().sub(b);
    const t1 = THREE.MathUtils.clamp(p.clone().sub(a).dot(ab) / ab.lengthSq(), -1, 1.4), t2 = p.clone().sub(b).dot(bc) / bc.lengthSq();
    return t1 < 1 ? t1 * 0.5 : 0.5 + Math.max(0, t2) * 0.5;
  };
  const p = new THREE.Vector3();
  for (let v = 0; v < N; v++) {
    p.set(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
    const s = p.x >= 0 ? "L" : "R", lo = s.toLowerCase(); side[v] = s === "L" ? 1 : -1;
    armW[v] = W(v, arm[s]); legW[v] = W(v, leg[s]); headW[v] = W(v, headS); hW[v] = W(v, headOnly);
    if (armW[v] > 0.05) armU[v] = along(p, B(`upperarm_${lo}`).head, B(`lowerarm_${lo}`).head, B(`hand_${lo}`).head);
    if (legW[v] > 0.05) legU[v] = along(p, B(`thigh_${lo}`).head, B(`calf_${lo}`).head, B(`foot_${lo}`).head);
  }
  const eyes = [...new Set([...H.eyeL, ...H.eyeR])], ec = new THREE.Vector3();
  for (const v of eyes) ec.add(new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]));
  ec.multiplyScalar(1 / eyes.length);
  // centro y medidas de la cabeza
  const hc = new THREE.Vector3(); let n = 0, top = 0;
  for (let v = 0; v < 13380; v++) if (hW[v] > 0.9) { hc.x += P[v * 3]; hc.z += P[v * 3 + 2]; n++; top = Math.max(top, P[v * 3 + 1]); }
  hc.x /= n; hc.z /= n; hc.y = (top + ec.y) / 2;
  const L = {
    pelvisY: B("pelvis").head.y, neckY: B("neck_01").head.y, headY: B("head").head.y, chestY: B("spine_03").head.y,
    kneeY: B("calf_l").head.y, ankleY: B("foot_l").head.y, eyeY: ec.y, eyeZ: ec.z, top, hc,
  };
  return ctl._prep = { H, N, P, nrm, armW, legW, headW, hW, armU, legU, side, L };
}
function fingerNames(s) { const o = []; for (const f of ["thumb", "index", "middle", "ring", "pinky"]) for (let i = 1; i <= 3; i++) o.push(`${f}_0${i}_${s}`); return o; }

function material(hex, tex, useColor, side = THREE.FrontSide) {
  if (tex && tex !== "lisa") return texturedMat(useColor ? hex : null, tex, side);
  return new THREE.MeshStandardMaterial({ color: useColor ? hex : CLAY, roughness: 0.85, side });
}
// Capa sobre la piel: los triángulos donde los tres vértices cumplen la regla, inflados por la normal
function shell(ctl, D, pred, off, smooth = 0) {
  const { H, N, P, nrm } = D, keep = ctl.cut.keep;
  const inc = new Uint8Array(N); for (let v = 0; v < N; v++) inc[v] = pred(v) ? 1 : 0;
  const idx = [];
  for (let f = 0; f < H.body.length / 3; f++) {
    if (keep && !keep[f]) continue;
    const a = H.body[f * 3], b = H.body[f * 3 + 1], c = H.body[f * 3 + 2];
    if (inc[a] && inc[b] && inc[c]) idx.push(a, b, c);
  }
  if (!idx.length) return null;
  const pos = new Float32Array(N * 3), base = new Float32Array(N);
  for (let v = 0; v < N; v++) { const o = inc[v] ? off(v) : 0; base[v] = o; for (let k = 0; k < 3; k++) pos[v * 3 + k] = P[v * 3 + k] + nrm[v * 3 + k] * o; }
  if (smooth > 0) {
    // la tela cruza los huecos: suavizado laplaciano sin dejar que se meta en la piel
    const nb = new Map(); const add = (a, b) => { let l = nb.get(a); if (!l) nb.set(a, l = new Set()); l.add(b); };
    for (let i = 0; i < idx.length; i += 3) { const a = idx[i], b = idx[i + 1], c = idx[i + 2]; add(a, b); add(a, c); add(b, a); add(b, c); add(c, a); add(c, b); }
    const tmp = new Float32Array(pos.length);
    for (let it = 0; it < smooth; it++) {
      tmp.set(pos);
      for (const [v, l] of nb) {
        let x = 0, y = 0, z = 0; for (const u of l) { x += pos[u * 3]; y += pos[u * 3 + 1]; z += pos[u * 3 + 2]; }
        const n = l.size; x /= n; y /= n; z /= n;
        tmp[v * 3] = pos[v * 3] * 0.4 + x * 0.6; tmp[v * 3 + 1] = pos[v * 3 + 1] * 0.4 + y * 0.6; tmp[v * 3 + 2] = pos[v * 3 + 2] * 0.4 + z * 0.6;
        // nunca más adentro que su separación mínima
        const dx = tmp[v * 3] - P[v * 3], dy = tmp[v * 3 + 1] - P[v * 3 + 1], dz = tmp[v * 3 + 2] - P[v * 3 + 2];
        const along = dx * nrm[v * 3] + dy * nrm[v * 3 + 1] + dz * nrm[v * 3 + 2], need = base[v] * 0.8;
        if (along < need) { const k = need - along; tmp[v * 3] += nrm[v * 3] * k; tmp[v * 3 + 1] += nrm[v * 3 + 1] * k; tmp[v * 3 + 2] += nrm[v * 3 + 2] * k; }
      }
      pos.set(tmp);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("skinIndex", ctl.geo.getAttribute("skinIndex")); g.setAttribute("skinWeight", ctl.geo.getAttribute("skinWeight"));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Tubo (falda, faldón de abrigo, vestido): anillos que siguen el contorno de cadera y piernas
function tube(ctl, D, yTop, yBot, ease, flare) {
  const { H, P, L } = D, rings = 16, around = 44;
  const bi = n => H.boneIndex[n];
  const pos = [], si = [], sw = [], idx = [];
  for (let r = 0; r <= rings; r++) {
    const t = r / rings, y = yTop + (yBot - yTop) * t;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    const yy = Math.max(y, L.kneeY + 0.05);
    for (let v = 0; v < 13380; v++) { if (Math.abs(P[v * 3 + 1] - yy) > 0.015 || D.armW[v] > 0.3) continue; x0 = Math.min(x0, P[v * 3]); x1 = Math.max(x1, P[v * 3]); z0 = Math.min(z0, P[v * 3 + 2]); z1 = Math.max(z1, P[v * 3 + 2]); }
    if (!isFinite(x0)) { x0 = -0.17; x1 = 0.17; z0 = -0.12; z1 = 0.12; }
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, f = 1 + flare * t * t;
    const rx = ((x1 - x0) / 2 + ease) * f, rz = ((z1 - z0) / 2 + ease) * f;
    for (let a = 0; a < around; a++) {
      const th = a / around * Math.PI * 2, x = cx + Math.sin(th) * rx, z = cz + Math.cos(th) * rz;
      pos.push(x, y, z);
      const k = Math.min(1, t * 1.2), sideL = THREE.MathUtils.clamp(0.5 + (x - cx) / rx * 0.5, 0, 1);
      si.push(bi("pelvis"), bi("thigh_l"), bi("thigh_r"), bi("spine_01")); sw.push(1 - 0.7 * k, 0.7 * k * sideL, 0.7 * k * (1 - sideL), 0);
    }
  }
  for (let r = 0; r < rings; r++) for (let a = 0; a < around; a++) {
    const i = r * around + a, j = r * around + (a + 1) % around;
    idx.push(i, i + around, j, j, i + around, j + around);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Capa: una sábana por la espalda, de los hombros hacia abajo
function cape(ctl, D, length, ease) {
  const { H, P, L } = D, rows = 18, cols = 22, bi = n => H.boneIndex[n];
  const yTop = L.neckY - 0.02, yBot = yTop - (yTop * 0.95) * length;
  const pos = [], si = [], sw = [], idx = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows, y = yTop + (yBot - yTop) * t;
    let x0 = Infinity, x1 = -Infinity, zb = Infinity; const yy = Math.max(y, L.kneeY);
    for (let v = 0; v < 13380; v++) { if (Math.abs(P[v * 3 + 1] - yy) > 0.02 || D.headW[v] > 0.5 || D.armW[v] > 0.3) continue; x0 = Math.min(x0, P[v * 3]); x1 = Math.max(x1, P[v * 3]); zb = Math.min(zb, P[v * 3 + 2]); }
    const half = Math.min(0.3, Math.max(0.16, (x1 - x0) / 2)) * (1 + 0.25 * t) + ease;
    for (let c = 0; c <= cols; c++) {
      const u = c / cols * 2 - 1, x = u * half, z = zb - ease - 0.02 - 0.06 * t + Math.cos(u * Math.PI / 2) * 0.03 - (1 - Math.cos(u * Math.PI / 2)) * -0.08 * (1 - t);
      pos.push(x, y, z);
      si.push(bi("spine_03"), bi("spine_02"), bi("clavicle_l"), bi("clavicle_r"));
      const k = t, cl = Math.max(0, u) * (1 - t) * 0.5, cr = Math.max(0, -u) * (1 - t) * 0.5;
      sw.push((1 - k) * (1 - cl - cr), k, cl, cr);
    }
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const i = r * (cols + 1) + c; idx.push(i, i + cols + 1, i + 1, i + 1, i + cols + 1, i + cols + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ cabello
export const HUMAN_HAIR = { ninguno: "Sin cabello", rapado: "Rapado", corto: "Corto", rizado: "Rizado", afro: "Afro", chongo: "Chongo", cola: "Cola de caballo", trenza: "Trenza", largo: "Largo suelto", melena: "Melena", mechon: "Corto con mechón", calvo: "Calvicie (coronilla)" };
function hairParts(ctl, D, hair) {
  const { P, nrm, hW, L } = D, st = hair.style, vol = hair.volume ?? 0.5, len = hair.length ?? 0.5, out = [];
  const long = ["largo", "melena"].includes(st);
  const browY = L.eyeY + 0.03, napeY = L.headY + 0.005, earTop = L.eyeY + 0.012, c = L.hc;
  const pred = v => {
    if (hW[v] < 0.55 && D.headW[v] < 0.9) return false;
    const x = P[v * 3] - c.x, z = P[v * 3 + 2] - c.z, y = P[v * 3 + 1], th = Math.atan2(x, z);
    const f = (1 + Math.cos(th)) / 2;
    let line = napeY + (browY + (st === "mechon" || st === "corto" ? 0.03 : 0.045) - napeY) * Math.pow(f, 0.8);
    const rec = hair.recede || 0; // entradas: la línea sube en las sienes
    if (rec > 0 && f > 0.55) line += rec * 0.05 * Math.pow(Math.abs(Math.sin(th)) * 2.2, 2) * (f - 0.55) / 0.45 + rec * 0.012;
    if (Math.abs(Math.sin(th)) > 0.6 && !long) line = Math.max(line, earTop + (st === "rapado" ? 0.01 : 0));
    if (st === "calvo") { if (y > L.top - 0.06 && Math.cos(th) > -0.6) return false; line = Math.max(line, earTop - 0.01); }
    return y > line;
  };
  const curl = v => st === "rizado" || st === "afro" ? (Math.sin(P[v * 3] * 260) * Math.sin(P[v * 3 + 1] * 240) * Math.sin(P[v * 3 + 2] * 250)) * 0.006 : 0;
  const thick = st === "rapado" || st === "calvo" ? 0.0025 : st === "afro" ? 0.03 + 0.035 * vol : st === "rizado" ? 0.014 + 0.012 * vol : 0.007 + 0.012 * vol;
  const g = shell(ctl, D, pred, v => thick * (0.6 + 0.4 * Math.max(0, (P[v * 3 + 1] - L.eyeY) / (L.top - L.eyeY))) + curl(v) * (st === "afro" ? 2.5 : 1));
  if (g) {
    out.push({ geo: g });
  }
  const headB = D.H.boneIndex.head, spine = D.H.boneIndex.spine_03, neck = D.H.boneIndex.neck_01;
  const backZ = (() => { let z = 1; for (let v = 0; v < 13380; v++) if (hW[v] > 0.9 && Math.abs(P[v * 3 + 1] - c.y) < 0.02) z = Math.min(z, P[v * 3 + 2]); return z; })();
  const rigid = (geo, at) => out.push({ geo, rigid: headB, at });
  if (st === "chongo") rigid(new THREE.SphereGeometry(0.045 + 0.02 * vol, 20, 14), new THREE.Vector3(c.x, L.top - 0.035, backZ + 0.01));
  if (st === "mechon") { const s = new THREE.SphereGeometry(0.04, 16, 10); s.scale(1.4, 0.5, 0.9); s.rotateZ(0.5); rigid(s, new THREE.Vector3(c.x + 0.025, L.top - 0.02, L.eyeZ - 0.005)); }
  if (st === "cola" || st === "trenza") {
    const Ltail = 0.12 + 0.35 * len, start = new THREE.Vector3(c.x, c.y + 0.02, backZ - 0.01);
    if (st === "cola") {
      const curve = new THREE.CatmullRomCurve3([start, start.clone().add(new THREE.Vector3(0, -0.03, -0.04)), start.clone().add(new THREE.Vector3(0, -Ltail * 0.6, -0.05)), start.clone().add(new THREE.Vector3(0, -Ltail, -0.03))]);
      const tg = new THREE.TubeGeometry(curve, 20, 0.022 + 0.01 * vol, 10);
      const a = tg.getAttribute("position"); // afilar hacia la punta
      for (let i = 0; i < a.count; i++) { const t = Math.floor(i / 11) / 20, p = curve.getPoint(t), q = new THREE.Vector3().fromBufferAttribute(a, i); q.lerp(p, t * 0.7); a.setXYZ(i, q.x, q.y, q.z); }
      tg.computeVertexNormals(); out.push({ geo: tg, rigid: headB, at: new THREE.Vector3(), abs: true });
      rigid(new THREE.SphereGeometry(0.02, 12, 8), start);
    } else for (let i = 0; i < 9; i++) { const t = i / 8; rigid(new THREE.SphereGeometry(0.024 * (1 - t * 0.45), 12, 8), start.clone().add(new THREE.Vector3(Math.sin(i * 1.7) * 0.006, -Ltail * t, -0.04 - 0.01 * Math.sin(t * 3)))); }
  }
  if (long) {
    // cortina: de la altura de los ojos hacia abajo, por los lados y la espalda
    const Lh = st === "melena" ? 0.12 + 0.08 * len : 0.18 + 0.4 * len;
    const rows = 14, cols = 28, pos = [], si = [], sw = [], idx = [];
    const yTop = L.eyeY + 0.01, yBot = yTop - Lh;
    let rx = 0.08, rz = 0.1;
    for (let v = 0; v < 13380; v++) if (hW[v] > 0.9 && Math.abs(P[v * 3 + 1] - yTop) < 0.01) { rx = Math.max(rx, Math.abs(P[v * 3] - c.x)); rz = Math.max(rz, Math.abs(P[v * 3 + 2] - c.z)); }
    const a0 = Math.PI * 0.38, a1 = Math.PI * 1.62;
    for (let r = 0; r <= rows; r++) {
      const t = r / rows, y = yTop + (yBot - yTop) * t, grow = 1 + (0.15 + 0.3 * vol) * t + 0.02;
      for (let k = 0; k <= cols; k++) {
        const th = a0 + (a1 - a0) * k / cols, x = c.x + Math.sin(th) * (rx + thick) * grow * (1 + 0.25 * t), z = c.z + Math.cos(th) * (rz + thick) * grow - 0.02 * t;
        pos.push(x, y, z);
        const down = Math.max(0, (L.headY - y) / Math.max(0.01, L.headY - yBot));
        si.push(headB, neck, spine, 0); sw.push(1 - down * 0.8, down * 0.3, down * 0.5, 0);
      }
    }
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) { const i = r * (cols + 1) + k; idx.push(i, i + 1, i + cols + 1, i + 1, i + cols + 2, i + cols + 1); }
    for (let i = 0; i < sw.length; i += 4) { const s = sw[i] + sw[i + 1] + sw[i + 2]; sw[i] /= s; sw[i + 1] /= s; sw[i + 2] /= s; }
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g2.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); g2.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
    g2.setIndex(idx); g2.computeVertexNormals();
    out.push({ geo: g2, double: true });
  }
  return out;
}

// ------------------------------------------------------------------ vestir
export const FOOTWEAR = { descalzo: "Descalzo", zapatos: "Zapatos", botas: "Botas", sandalias: "Sandalias" };
export function dressHuman(fig, clothes, opts = {}) {
  const ctl = fig.human, D = prep(ctl), { armW, legW, headW, armU, legU, P, L } = D;
  const group = new THREE.Group(); group.name = "ropa"; group.userData.clothRoot = true;
  const items = [];
  let useColor = !!opts.useColor;
  const skinned = (geo, g, kind = "ropa", double = false) => {
    const m = new THREE.SkinnedMesh(geo, material(g.color, g.tex, useColor, double ? THREE.DoubleSide : THREE.FrontSide));
    m.bind(ctl.mesh.skeleton, ctl.mesh.bindMatrix); m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
    m.userData.cloth = true; m.userData.garment = g.id; m.userData.human = true;
    m.userData.jointAt = ctl.mesh.userData.jointAt;
    group.add(m); items.push({ m, g, double });
  };
  const ease = g => 0.6 + (g.ease ?? 0.9) * 0.45;
  const torso = v => armW[v] < 0.5 && legW[v] < 0.5 && headW[v] < 0.35;
  const nk = ctl.J[D.H.boneIndex.neck_01], nDir = nk.tail.clone().sub(nk.head).normalize();
  const neckT = v => (P[v * 3] - nk.head.x) * nDir.x + (P[v * 3 + 1] - nk.head.y) * nDir.y + (P[v * 3 + 2] - nk.head.z) * nDir.z;
  const top = (g, hemY, off, neckDrop = -0.025, upTo = 1, smooth = 6) => {
    const s = g.sleeve ?? 1;
    const pred = v => {
      const y = P[v * 3 + 1];
      if (armW[v] >= 0.5) return armU[v] <= Math.max(0.07, Math.min(upTo, s) * 0.98);
      if (legW[v] >= 0.5) return y > hemY && legU[v] < 0.25; // la cadera también se cubre
      return torso(v) && y > hemY && neckT(v) < -neckDrop + (g.collar === "alzado" ? 0.04 : 0);
    };
    const geo = shell(ctl, D, pred, v => off * ease(g) * (armW[v] > 0.5 ? 0.8 : 1), smooth);
    if (geo) skinned(geo, g);
  };
  for (const g of clothes) {
    if (g.type === "piel") continue;
    if (g.type === "camisa") top(g, L.pelvisY - 0.07, 0.0045);
    else if (g.type === "saco") top(g, L.pelvisY - 0.17, 0.012, -0.005);
    else if (g.type === "rebozo") top({ ...g, sleeve: 0.4 }, L.chestY - 0.16, 0.016, 0.0, 0.4, 10);
    else if (g.type === "gabardina") { top(g, L.pelvisY - 0.05, 0.019, -0.01); const yb = L.pelvisY - (L.pelvisY - L.ankleY) * (g.length ?? 0.72) * 1.1; skinned(tube(ctl, D, L.pelvisY + 0.02, yb, 0.03 * ease(g), 0.5), g, "ropa", true); }
    else if (g.type === "vestido") { top(g, L.pelvisY + 0.02, 0.004); const yb = L.pelvisY - (L.pelvisY - L.ankleY) * (g.length ?? 0.55) * 1.15; skinned(tube(ctl, D, L.pelvisY + 0.06, yb, 0.012 * ease(g), 0.7), g, "ropa", true); }
    else if (g.type === "falda") { const yb = L.pelvisY - (L.pelvisY - L.ankleY) * (g.length ?? 0.5) * 1.15; skinned(tube(ctl, D, L.pelvisY + 0.06, yb, 0.012 * ease(g), 0.6), g, "ropa", true); }
    else if (g.type === "pantalon") {
      const len = g.length ?? 1;
      const pred = v => legW[v] >= 0.5 ? legU[v] <= 0.15 + 0.85 * len : (torso(v) && P[v * 3 + 1] < L.pelvisY + 0.06);
      const geo = shell(ctl, D, pred, v => 0.0065 * ease(g), 4); if (geo) skinned(geo, g);
    } else if (g.type === "capa") skinned(cape(ctl, D, g.length ?? 0.8, 0.02), g, "ropa", true);
  }
  // calzado
  const fw = opts.footwear;
  if (fw && fw !== "descalzo") {
    const g = { id: "calzado", type: "calzado", color: opts.footColor || (fw === "botas" ? "#3b2a20" : "#2a2522"), tex: fw === "botas" ? "cuero" : null };
    const lim = fw === "botas" ? 0.82 : 0.985;
    const pred = v => legW[v] >= 0.5 && legU[v] > lim && (fw !== "sandalias" || P[v * 3 + 1] < 0.03);
    const geo = shell(ctl, D, pred, v => fw === "sandalias" ? 0.004 : 0.008); if (geo) skinned(geo, g);
  }
  // guantes
  if (opts.gloves) {
    const g = { id: "guantes", type: "guantes", color: opts.gloves.color || "#2a2422", tex: "cuero" };
    const geo = shell(ctl, D, v => armW[v] >= 0.5 && armU[v] > 0.97, () => 0.0025); if (geo) skinned(geo, g);
  }
  const hairColor = grayed(opts.hair?.color || "#2b2522", opts.hair?.gray || 0);
  // barba y bigote con volumen
  const fac = opts.facial || {};
  if (["corta", "completa", "candado"].includes(fac.barba) || (fac.bigote && fac.bigote !== "ninguno")) {
    const g = { id: "barba", type: "barba", color: hairColor, tex: null }, F = D.L, eyeX = F.hc.x;
    let mouthY = F.eyeY - 0.07; { let my = 0, n = 0; for (let v = 0; v < 13380; v++) if (D.H.lips[v] > 200) { my += P[v * 3 + 1]; n++; } if (n) mouthY = my / n; }
    const face = v => D.hW[v] > 0.6 && P[v * 3 + 2] > F.eyeZ - 0.06 && P[v * 3 + 1] > F.headY - 0.01;
    if (["corta", "completa", "candado"].includes(fac.barba)) {
      const full = fac.barba === "completa", cand = fac.barba === "candado";
      const pred = v => face(v) && D.H.lips[v] < 90 && (cand ? Math.abs(P[v * 3] - eyeX) < 0.032 && P[v * 3 + 1] < mouthY - 0.005 : P[v * 3 + 1] < mouthY + 0.004 || (Math.abs(P[v * 3] - eyeX) > 0.048 && P[v * 3 + 1] < F.eyeY - 0.04));
      const geo = shell(ctl, D, pred, v => (full ? 0.012 : 0.004) * (1 + (P[v * 3 + 1] < mouthY - 0.03 ? 0.6 : 0))); if (geo) skinned(geo, g);
    }
    if (fac.bigote && fac.bigote !== "ninguno") {
      const w = fac.bigote === "grueso" ? 0.034 : 0.026;
      const pred = v => face(v) && Math.abs(P[v * 3] - eyeX) < w && P[v * 3 + 1] > mouthY + 0.004 && P[v * 3 + 1] < mouthY + (fac.bigote === "grueso" ? 0.022 : 0.015) && D.H.lips[v] < 140;
      const geo = shell(ctl, D, pred, () => fac.bigote === "grueso" ? 0.006 : 0.0035); if (geo) skinned(geo, g);
    }
  }
  // cabello
  if (opts.hair && opts.hair.style && opts.hair.style !== "ninguno") {
    const hg = { id: "cabello", type: "cabello", color: hairColor, tex: null };
    for (const part of hairParts(ctl, D, opts.hair)) {
      if (part.rigid !== undefined) {
        const m = new THREE.Mesh(part.geo, material(hg.color, null, useColor)); m.castShadow = m.receiveShadow = true; m.userData.cloth = true; m.userData.human = true;
        const bone = ctl.bones[part.rigid];
        m.position.copy(part.abs ? new THREE.Vector3() : part.at).sub(ctl.J[part.rigid].head);
        bone.add(m); items.push({ m, g: hg, rigid: true });
      } else skinned(part.geo, hg, "pelo", part.double);
    }
  }
  fig.root.add(group);
  const setStyle = ({ color } = {}) => {
    if (color !== undefined) useColor = color;
    for (const it of items) { it.m.material = material(it.g.color, it.g.tex, useColor, it.double ? THREE.DoubleSide : THREE.FrontSide); }
  };
  return {
    group, update() {}, tick: () => false, setStyle, setWind() {}, labels: () => [], touch() {},
    dispose() { for (const it of items) { it.m.removeFromParent(); it.m.geometry.dispose?.(); } group.removeFromParent(); },
  };
}

// canas: mezcla el color del cabello hacia gris claro
export function grayed(hex, k) { if (!k) return hex; const c = new THREE.Color(hex).lerp(new THREE.Color("#c9c6c0"), Math.min(1, k)); return "#" + c.getHexString(); }
// Medidas de la cabeza para acomodar sombreros y lentes del catálogo de accesorios
export function headFit(fig) {
  const D = prep(fig.human), L = D.L, J = fig.human.J, hb = D.H.boneIndex.head, head = J[hb].head, P = D.P;
  let x0 = 1, x1 = -1;
  for (let v = 0; v < 13380; v++) if (D.hW[v] > 0.9 && Math.abs(P[v * 3 + 1] - (L.eyeY + 0.03)) < 0.01 && P[v * 3 + 2] > L.hc.z - 0.03) { x0 = Math.min(x0, P[v * 3]); x1 = Math.max(x1, P[v * 3]); }
  const half = (x1 - x0) / 2, hh = half / 0.335;
  // centro de cráneo tal que la coronilla quede donde la supone el catálogo (centro + 0.48·hh)
  return { hh, skull: new THREE.Vector3(L.hc.x, L.top - 0.48 * hh + 0.004, L.hc.z).sub(head), eyes: new THREE.Vector3(L.hc.x, L.eyeY, L.eyeZ).sub(head) };
}

// Accesorios del catálogo sobre el cuerpo realista: guantes y calzado son capas de piel; lo demás se acomoda a su cabeza
const SHELL_ACC = ["guantes", "zapatos", "botas", "tenis"];
export function humanShellAcc(list) {
  const out = {};
  for (const a of list || []) {
    if (a.type === "guantes") out.gloves = { color: a.color };
    if (["zapatos", "botas", "tenis"].includes(a.type)) { out.footwear = a.type === "tenis" ? "zapatos" : a.type; out.footColor = a.color; }
  }
  return out;
}
export function equipHuman(fig, list, opts, equipFn) {
  const fit = headFit(fig), d0 = fig.d, hh = fit.hh, head = fig.joints.head;
  const handles = [];
  fig.d = { ...d0, hh };
  try {
    for (const a of list || []) {
      if (SHELL_ACC.includes(a.type)) continue;
      const before = new Set(head.children);
      handles.push(equipFn(fig, [a], opts));
      const glasses = a.type === "lentes" || a.type === "lentes_sol";
      const assumed = glasses ? new THREE.Vector3(0, hh * 0.52 - hh * 0.48 * 0.02, -0.01 * hh + hh * 0.41 * 0.98) : new THREE.Vector3(0, 0.52 * hh, -0.01 * hh);
      const real = glasses ? fit.eyes.clone().add(new THREE.Vector3(0, 0.004, 0.016)) : fit.skull;
      for (const c of head.children) if (!before.has(c)) c.position.add(real.clone().sub(assumed));
    }
  } finally { fig.d = d0; }
  return { dispose() { for (const h of handles) h.dispose(); }, setStyle(u) { for (const h of handles) h.setStyle(u); } };
}
