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
  // ángulo alrededor del brazo, la pierna o el tronco (para pliegues que rodean el miembro)
  const theta = new Float32Array(N), kind = new Int8Array(N);
  const frameOf = (a, b) => { const ax = b.clone().sub(a).normalize(), ref = Math.abs(ax.z) < 0.9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0); const b1 = ref.addScaledVector(ax, -ref.dot(ax)).normalize(), b2 = new THREE.Vector3().crossVectors(ax, b1); return { a, ax, b1, b2 }; };
  const fr = {
    armL: frameOf(B("upperarm_l").head, B("hand_l").head), armR: frameOf(B("upperarm_r").head, B("hand_r").head),
    legL: frameOf(B("thigh_l").head, B("foot_l").head), legR: frameOf(B("thigh_r").head, B("foot_r").head),
  };
  const pz = B("pelvis").head.z;
  for (let v = 0; v < N; v++) {
    p.set(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]);
    let f = null, k = 0;
    if (armW[v] >= 0.5) { f = side[v] > 0 ? fr.armL : fr.armR; k = side[v] > 0 ? 1 : 2; }
    else if (legW[v] >= 0.5) { f = side[v] > 0 ? fr.legL : fr.legR; k = side[v] > 0 ? 3 : 4; }
    kind[v] = k;
    if (f) { const r = p.clone().sub(f.a); theta[v] = Math.atan2(r.dot(f.b2), r.dot(f.b1)); }
    else theta[v] = Math.atan2(p.x, p.z - pz);
  }
  const armLen = B("upperarm_l").head.distanceTo(B("hand_l").head), legLen = B("thigh_l").head.distanceTo(B("foot_l").head);
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
  return ctl._prep = { H, N, P, nrm, armW, legW, headW, hW, armU, legU, side, L, theta, kind, armLen, legLen };
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
  // mechones: cintas finas que salen del cuero cabelludo siguiendo el remolino de la coronilla
  if (st !== "rapado" && st !== "calvo") {
    const crown = new THREE.Vector3(c.x, L.top - 0.01, c.z - 0.035), roots = [];
    const rnd = rng(7 + Math.round(vol * 100));
    const scalp = []; for (let v = 0; v < 13380; v++) if (pred(v)) scalp.push(v);
    const count = { corto: 700, mechon: 800, rizado: 900, afro: 1300, chongo: 600, cola: 600, trenza: 600, largo: 900, melena: 900 }[st] || 600;
    const len0 = { corto: 0.022, mechon: 0.045, rizado: 0.03, afro: 0.045, chongo: 0.04, cola: 0.04, trenza: 0.04, largo: 0.06, melena: 0.05 }[st] || 0.04;
    for (let i = 0; i < count && scalp.length; i++) {
      const v = scalp[(rnd() * scalp.length) | 0];
      const pnt = new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]), n = new THREE.Vector3(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]);
      const out0 = pnt.clone().sub(crown); out0.addScaledVector(n, -out0.dot(n));
      const dir = out0.lengthSq() < 1e-6 ? new THREE.Vector3(0, 0, 1) : out0.normalize();
      dir.y -= 0.35; dir.addScaledVector(n, -dir.dot(n)).normalize();
      const fr = Math.cos(Math.atan2(pnt.x - c.x, pnt.z - c.z));
      if (st === "mechon" && fr > 0.6) dir.lerp(new THREE.Vector3(0.6, -0.3, 0.6), 0.4).normalize();
      // pelo corto: al frente va peinado hacia atrás y arriba, no cae sobre la frente
      if ((st === "corto" || st === "rizado" || st === "afro") && fr > 0.2) { dir.lerp(new THREE.Vector3(0, 0.35, -0.9), 0.75); dir.addScaledVector(n, -dir.dot(n)).normalize(); }
      roots.push({ p: pnt.addScaledVector(n, thick * 0.6), n, dir, len: len0 * (0.6 + rnd() * 0.8) * (0.7 + 0.6 * vol) });
    }
    const geo = strands(roots, { width: st === "afro" ? 0.007 : 0.0045, curl: st === "rizado" || st === "afro" ? 0.6 : 0.08, lift: st === "afro" ? 0.5 : 0.1, gravity: ["largo", "melena", "mechon"].includes(st) ? 0.3 : 0.05, seed: 11 });
    out.push({ geo, rigid: headB, abs: true, double: true });
  }
  return out;
}
const rng = seed => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
// Cintas de pelo o pelaje: cada raíz da una cinta afilada de pocos segmentos que sigue su dirección,
// se despega de la superficie (lift), se riza (curl) y cae un poco por su peso. Sirve para cabello, barba y criaturas.
export function strands(roots, { width = 0.004, segs = 5, curl = 0.1, lift = 0.15, gravity = 0.25, seed = 1 } = {}) {
  const rnd = rng(seed), pos = [], idx = [];
  for (const r of roots) {
    const side = new THREE.Vector3().crossVectors(r.n, r.dir).normalize(), ph = rnd() * 6.28, base = pos.length / 3;
    let p = r.p.clone(), d = r.dir.clone().addScaledVector(r.n, lift).normalize();
    for (let k = 0; k <= segs; k++) {
      const t = k / segs, w = width * (1 - t * 0.85) * (0.7 + rnd() * 0.6);
      const c = side.clone().multiplyScalar(Math.sin(ph + t * 9) * curl * r.len * 0.25).addScaledVector(r.n, Math.cos(ph + t * 9) * curl * r.len * 0.15);
      const q = p.clone().add(c);
      pos.push(q.x - side.x * w / 2, q.y - side.y * w / 2, q.z - side.z * w / 2, q.x + side.x * w / 2, q.y + side.y * w / 2, q.z + side.z * w / 2);
      p.addScaledVector(d, r.len / segs);
      d.y -= gravity / segs; d.normalize();
      if (k < segs) { const i = base + k * 2; idx.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ vestir
export const FOOTWEAR = { descalzo: "Descalzo", zapatos: "Zapatos", botas: "Botas", sandalias: "Sandalias" };
export function dressHuman(fig, clothes, opts = {}) {
  const ctl = fig.human, D = prep(ctl), { armW, legW, headW, armU, legU, P, L } = D;
  const group = new THREE.Group(); group.name = "ropa"; group.userData.clothRoot = true;
  const items = [];
  let useColor = !!opts.useColor;
  const skinned = (geo, g, kind = "ropa", double = false, folds = false) => {
    const m = new THREE.SkinnedMesh(geo, material(g.color, g.tex, useColor, double ? THREE.DoubleSide : THREE.FrontSide));
    m.bind(ctl.mesh.skeleton, ctl.mesh.bindMatrix); m.castShadow = m.receiveShadow = true; m.frustumCulled = false;
    m.userData.cloth = true; m.userData.garment = g.id; m.userData.human = true;
    m.userData.jointAt = ctl.mesh.userData.jointAt;
    group.add(m);
    const it = { m, g, double };
    if (folds) { it.base = Float32Array.from(geo.getAttribute("position").array); it.n = Float32Array.from(geo.getAttribute("normal").array); it.used = usedVerts(geo); }
    items.push(it);
  };
  const ease = g => 0.6 + (g.ease ?? 0.9) * 0.45;
  const torso = v => armW[v] < 0.5 && legW[v] < 0.5 && headW[v] < 0.35;
  const nk = ctl.J[D.H.boneIndex.neck_01], nDir = nk.tail.clone().sub(nk.head).normalize();
  const neckT = v => (P[v * 3] - nk.head.x) * nDir.x + (P[v * 3 + 1] - nk.head.y) * nDir.y + (P[v * 3 + 2] - nk.head.z) * nDir.z;
  // cuellos: se miden a lo largo del cuello, así el corte queda parejo
  const front = v => P[v * 3 + 2] > nk.head.z - 0.005;
  const collarOk = (v, style) => {
    const t = neckT(v), x = Math.abs(P[v * 3] - nk.head.x);
    switch (style) {
      case "alto": return t < 0.075;
      case "camisa": return t < 0.04;
      case "v": return t < 0.028 - (front(v) ? Math.max(0, 0.15 - x * 2.4) : 0);
      case "abierto": return t < 0.02 - (front(v) ? Math.max(0, 0.08 - x * 1.4) : 0);
      case "barco": return t < -0.01;
      default: return t < 0.024; // redondo
    }
  };
  const neckOk = v => D.hW[v] < 0.2;
  const COLLAR = { camisa: "camisa", saco: "v", gabardina: "alto", vestido: "redondo", rebozo: "abierto" };
  const stumps = (ctl.cut?.stumps || []).filter(st => st.kind === "brazo");
  const CUT_U = { mano: 0.99, antebrazo: 0.75, codo: 0.52, brazo: 0.26, hombro: 0.08 };
  const top = (g, hemY, off, upTo = 1, smooth = 6) => {
    const s = g.sleeve ?? 1, style = g.collar || COLLAR[g.type] || "redondo";
    const pred = v => {
      const y = P[v * 3 + 1];
      if (armW[v] >= 0.5) return armU[v] <= Math.max(0.07, Math.min(upTo, s) * 0.98);
      if (legW[v] >= 0.5) return y > hemY && legU[v] < 0.25; // la cadera también se cubre
      return (torso(v) || neckOk(v)) && y > hemY && collarOk(v, style);
    };
    const geo = shell(ctl, D, pred, v => off * ease(g) * (armW[v] > 0.5 ? 0.8 : 1), smooth);
    if (geo) skinned(geo, g, "ropa", false, true);
    // cuello de camisa: una banda un poco más separada
    if (style === "camisa" || style === "alto") {
      const band = shell(ctl, D, v => (torso(v) || neckOk(v)) && !(armW[v] >= 0.5) && neckT(v) > (style === "alto" ? 0.02 : -0.005) && collarOk(v, style), () => off * ease(g) * 1.9 + 0.004, 2);
      if (band) skinned(band, g);
    }
    // manga de un brazo que falta: vacía (cuelga), doblada y prendida, o recortada
    for (const st of stumps) {
      const mode = opts.sleeves?.[st.key] || (opts.prosthesis?.[st.key] && opts.prosthesis[st.key] !== "ninguna" ? "recortada" : "vacia"), cutU = CUT_U[st.level] ?? 0.5, end = Math.min(upTo, s) * 0.98;
      if (mode === "recortada" || end <= cutU + 0.02) continue;
      const sgn = st.side === "L" ? 1 : -1;
      const geo2 = emptySleeve(ctl, D, sgn, cutU, mode === "doblada" ? Math.min(end, cutU + 0.16) : end, off * ease(g) + 0.006, mode, st.bone);
      if (geo2) skinned(geo2, g, "ropa", true);
      if (mode === "doblada") {
        const pin = new THREE.Mesh(new THREE.SphereGeometry(0.006, 10, 8), new THREE.MeshStandardMaterial({ color: 0x9a9da3, metalness: 0.7, roughness: 0.3 }));
        const bone = ctl.bones[st.bone]; pin.position.copy(st.tip).addScaledVector(st.axis, -st.R * 2.2).add(new THREE.Vector3(sgn * st.R * 0.9, 0, 0)).sub(ctl.J[st.bone].head);
        pin.userData.human = true; bone.add(pin); items.push({ m: pin, g: { color: "#9a9da3" }, rigid: true, keepMat: true });
      }
    }
  };
  for (const g of clothes) {
    if (g.type === "piel") continue;
    if (g.type === "camisa") top(g, L.pelvisY - 0.07, 0.0045);
    else if (g.type === "saco") top(g, L.pelvisY - 0.17, 0.012);
    else if (g.type === "rebozo") top({ ...g, sleeve: 0.4 }, L.chestY - 0.16, 0.016, 0.4, 10);
    else if (g.type === "gabardina") { top(g, L.pelvisY - 0.05, 0.019); const yb = L.pelvisY - (L.pelvisY - L.ankleY) * (g.length ?? 0.72) * 1.1; skinned(tube(ctl, D, L.pelvisY + 0.02, yb, 0.03 * ease(g), 0.5), g, "ropa", true); }
    else if (g.type === "vestido") { top(g, L.pelvisY + 0.02, 0.004); const yb = L.pelvisY - (L.pelvisY - L.ankleY) * (g.length ?? 0.55) * 1.15; skinned(tube(ctl, D, L.pelvisY + 0.06, yb, 0.012 * ease(g), 0.7), g, "ropa", true); }
    else if (g.type === "falda") { const yb = L.pelvisY - (L.pelvisY - L.ankleY) * (g.length ?? 0.5) * 1.15; skinned(tube(ctl, D, L.pelvisY + 0.06, yb, 0.012 * ease(g), 0.6), g, "ropa", true); }
    else if (g.type === "pantalon") {
      const len = g.length ?? 1;
      const pred = v => legW[v] >= 0.5 ? legU[v] <= 0.15 + 0.85 * len : (torso(v) && P[v * 3 + 1] < L.pelvisY + 0.06);
      const geo = shell(ctl, D, pred, v => 0.0065 * ease(g), 4); if (geo) skinned(geo, g, "ropa", false, true);
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
      // pelo de barba: cintas cortas hacia abajo
      const rnd = rng(5), roots = [], pool = []; for (let v = 0; v < 13380; v++) if (pred(v)) pool.push(v);
      for (let i = 0; i < (full ? 500 : 250) && pool.length; i++) { const v = pool[(rnd() * pool.length) | 0], n = new THREE.Vector3(D.nrm[v * 3], D.nrm[v * 3 + 1], D.nrm[v * 3 + 2]); roots.push({ p: new THREE.Vector3(P[v * 3], P[v * 3 + 1], P[v * 3 + 2]).addScaledVector(n, full ? 0.01 : 0.003), n, dir: new THREE.Vector3(0, -1, 0.15).addScaledVector(n, -n.y).normalize(), len: full ? 0.025 : 0.01 }); }
      if (roots.length) { const m = new THREE.Mesh(strands(roots, { width: 0.003, curl: 0.3, lift: 0.2, seed: 3 }), material(hairColor, null, useColor, THREE.DoubleSide)); m.userData.human = true; m.position.copy(ctl.J[D.H.boneIndex.head].head).negate(); ctl.bones[D.H.boneIndex.head].add(m); items.push({ m, g, rigid: true, double: true }); }
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
        const m = new THREE.Mesh(part.geo, material(hg.color, null, useColor, part.double ? THREE.DoubleSide : THREE.FrontSide)); m.castShadow = m.receiveShadow = true; m.userData.cloth = true; m.userData.human = true;
        const bone = ctl.bones[part.rigid];
        m.position.copy(part.abs ? new THREE.Vector3() : part.at).sub(ctl.J[part.rigid].head);
        bone.add(m); items.push({ m, g: hg, rigid: true, double: part.double });
      } else skinned(part.geo, hg, "pelo", part.double);
    }
  }
  fig.root.add(group);
  const setStyle = ({ color } = {}) => {
    if (color !== undefined) useColor = color;
    for (const it of items) { if (!it.keepMat) it.m.material = material(it.g.color, it.g.tex, useColor, it.double ? THREE.DoubleSide : THREE.FrontSide); }
  };
  // pliegues: anillos en codos, rodillas y cintura según cuánto se doblan; caídas verticales cerca de los dobladillos
  let sig = "", pendingAt = 0;
  const poseSig = () => ["elbow_L", "elbow_R", "knee_L", "knee_R", "hip_L", "hip_R", "spine2", "shoulder_L", "shoulder_R"].map(j => fig.joints[j]?.quaternion.toArray().map(x => x.toFixed(3)).join(",")).join("|");
  const refold = () => { const fl = flexOf(fig); for (const it of items) if (it.base) applyFolds(it, D, fl); };
  refold(); sig = poseSig();
  return {
    group, setStyle, setWind() {}, labels: () => [], touch() {},
    update() { refold(); sig = poseSig(); },
    tick(now) { const s2 = poseSig(); if (s2 === sig) { if (pendingAt && now - pendingAt > 140) { pendingAt = 0; refold(); return true; } return false; } sig = s2; pendingAt = now; return false; },
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

// ------------------------------------------------------------------ pliegues y mangas vacías
function usedVerts(geo) { const idx = geo.index.array, u = new Uint8Array(geo.getAttribute("position").count); for (let i = 0; i < idx.length; i++) u[idx[i]] = 1; const out = []; for (let i = 0; i < u.length; i++) if (u[i]) out.push(i); return Uint32Array.from(out); }
const ang = (a, b, c) => { const u = b.clone().sub(a).normalize(), w = c.clone().sub(b).normalize(); return Math.acos(THREE.MathUtils.clamp(u.dot(w), -1, 1)); };
function flexOf(fig) {
  const J = n => new THREE.Vector3().setFromMatrixPosition(fig.joints[n].matrixWorld);
  fig.root.updateMatrixWorld(true);
  const f = {};
  for (const S of ["L", "R"]) {
    f["elbow" + S] = Math.min(1, ang(J(`shoulder_${S}`), J(`elbow_${S}`), J(`wrist_${S}`)) / 2.2);
    f["knee" + S] = Math.min(1, ang(J(`hip_${S}`), J(`knee_${S}`), J(`ankle_${S}`)) / 2.2);
    // cadera doblada: el muslo se acerca al tronco (sentado, en cuclillas)
    const up = J("spine3").sub(J("hips")).normalize(), th = J(`knee_${S}`).sub(J(`hip_${S}`)).normalize();
    f["hip" + S] = THREE.MathUtils.clamp((Math.acos(THREE.MathUtils.clamp(up.dot(th), -1, 1)) * -1 + Math.PI) / (Math.PI / 2), 0, 1.4) * 0.8;
    const down = new THREE.Vector3(0, -1, 0).applyQuaternion(fig.root.getWorldQuaternion(new THREE.Quaternion())), arm = J(`elbow_${S}`).sub(J(`shoulder_${S}`)).normalize();
    f["raise" + S] = THREE.MathUtils.clamp(Math.acos(THREE.MathUtils.clamp(arm.dot(down), -1, 1)) / 2.2, 0, 1);
  }
  f.spine = Math.min(1, ang(J("hips"), J("spine2"), J("neck1")) / 1.0);
  return f;
}
function applyFolds(it, D, fl) {
  const pos = it.m.geometry.getAttribute("position"), A = pos.array, B = it.base, Nn = it.n, e = 0.6 + (it.g.ease ?? 0.9) * 0.45;
  const { armU, legU, theta, kind, P, L, armLen, legLen } = D, TAU = Math.PI * 2;
  for (const v of it.used) {
    const k = kind[v], th = theta[v];
    let d = 0;
    if (k === 1 || k === 2) {
      const fx = k === 1 ? fl.elbowL : fl.elbowR, dist = (armU[v] - 0.5) * armLen;
      const g = Math.exp(-((dist / 0.075) ** 2));
      d += (0.0012 + 0.0065 * fx) * e * g * Math.sin(dist / 0.019 * TAU + 1.7 * Math.sin(th * 2)) * (0.65 + 0.35 * Math.cos(th));
      const rz = k === 1 ? fl.raiseL : fl.raiseR, sh = armU[v] * armLen;
      if (sh < 0.12) d += 0.0035 * rz * e * Math.exp(-((sh / 0.06) ** 2)) * Math.sin(th * 4);
      d += 0.0012 * e * Math.sin(th * 5 + armU[v] * 9) * Math.max(0, armU[v] - 0.7) * 3;
    } else if (k === 3 || k === 4) {
      const fx = k === 3 ? fl.kneeL : fl.kneeR, hp = k === 3 ? fl.hipL : fl.hipR, dist = (legU[v] - 0.5) * legLen;
      const g = Math.exp(-((dist / 0.09) ** 2));
      d += (0.0015 + 0.0075 * fx) * e * g * Math.sin(dist / 0.024 * TAU + 1.5 * Math.sin(th * 2)) * (0.6 + 0.4 * Math.cos(th + Math.PI));
      const lap = legU[v] * legLen;
      if (lap < 0.2) d += 0.006 * hp * e * Math.exp(-((lap / 0.09) ** 2)) * Math.sin(th * 3 + lap * 60) * Math.max(0, Math.cos(th));
      d += 0.0018 * e * Math.sin(th * 4 + legU[v] * 7) * Math.max(0, legU[v] - 0.75) * 4;
    } else {
      const y = P[v * 3 + 1], w = (y - (L.pelvisY + 0.12)) / 0.075;
      d += 0.0045 * fl.spine * e * Math.exp(-w * w) * Math.sin(y / 0.022 * TAU + Math.sin(th * 3)) * Math.max(0, Math.cos(th));
      if (y < L.chestY) d += 0.0016 * e * Math.sin(th * 7 + y * 28) * Math.min(1, (L.chestY - y) / 0.2);
    }
    const i = v * 3;
    A[i] = B[i] + Nn[i] * d; A[i + 1] = B[i + 1] + Nn[i + 1] * d; A[i + 2] = B[i + 2] + Nn[i + 2] * d;
  }
  pos.needsUpdate = true; it.m.geometry.computeVertexNormals();
}
// Manga sin brazo dentro: se arma con la forma del brazo completo, aplanada, y cuelga del muñón
function emptySleeve(ctl, D, sgn, u0, u1, off, mode, owner) {
  const { H, armW, armU, side } = D, P0 = ctl.shape0 || ctl.shape;
  const sel = new Uint8Array(H.N);
  for (let v = 0; v < 13380; v++) if (armW[v] >= 0.5 && side[v] === sgn && armU[v] >= u0 - 0.03 && armU[v] <= u1) sel[v] = 1;
  const idx = [];
  for (let f = 0; f < H.body.length; f += 3) { const a = H.body[f], b = H.body[f + 1], c = H.body[f + 2]; if (sel[a] && sel[b] && sel[c]) idx.push(a, b, c); }
  if (!idx.length) return null;
  const s = sgn > 0 ? "l" : "r", B = n => ctl.J[H.boneIndex[`${n}_${s}`]];
  const a = B("upperarm").head, ax = B("hand").head.clone().sub(a).normalize(), flatDir = new THREE.Vector3(0, 0, 1).addScaledVector(ax, -ax.z).normalize();
  const pos = new Float32Array(H.N * 3), p = new THREE.Vector3();
  const cutLen = u0 * a.distanceTo(B("hand").head) * 1.0;
  for (let v = 0; v < H.N; v++) {
    if (!sel[v]) continue;
    p.set(P0[v * 3], P0[v * 3 + 1], P0[v * 3 + 2]);
    const t = p.clone().sub(a).dot(ax), c = a.clone().addScaledVector(ax, t), r = p.clone().sub(c);
    const along = r.dot(flatDir); r.addScaledVector(flatDir, -along * 0.8); r.multiplyScalar(0.78); r.addScaledVector(r.clone().normalize(), off);
    let tt = t;
    if (mode === "doblada" && t > cutLen) { tt = cutLen - (t - cutLen) * 0.9; r.multiplyScalar(1.12); }
    const q = a.clone().addScaledVector(ax, tt).add(r);
    pos[v * 3] = q.x; pos[v * 3 + 1] = q.y; pos[v * 3 + 2] = q.z;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const si = new Uint16Array(H.N * 4), sw = new Float32Array(H.N * 4);
  for (let v = 0; v < H.N; v++) { si[v * 4] = owner; sw[v * 4] = 1; }
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute("skinWeight", new THREE.BufferAttribute(sw, 4));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
