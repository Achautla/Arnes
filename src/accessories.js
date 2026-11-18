// Accesorios y joyería (Fase 3 · entrega 6). Cada pieza es rígida y va anclada a una articulación.
// El catálogo es de datos: en la Fase 6 se podrá modificar y crear piezas propias.
import * as THREE from "three";

export const MATERIALS = {
  metal: { label: "Metal", metalness: 0.85, roughness: 0.3 },
  cuero: { label: "Cuero", metalness: 0, roughness: 0.62 },
  tela: { label: "Tela", metalness: 0, roughness: 0.95 },
  hilo: { label: "Hilo", metalness: 0, roughness: 1 },
  piedra: { label: "Piedra o gema", metalness: 0.1, roughness: 0.12 },
  plastico: { label: "Plástico", metalness: 0, roughness: 0.45 },
};
// zona: dónde se ancla · lado: si existe para izquierda y derecha
export const ACCESSORIES = {
  fedora: { label: "Fedora", cat: "Cabeza", color: "#3a332d", mat: "tela" },
  bombin: { label: "Bombín", cat: "Cabeza", color: "#232325", mat: "tela" },
  gorra: { label: "Gorra", cat: "Cabeza", color: "#5a2b2b", mat: "tela" },
  ala: { label: "Sombrero de ala ancha", cat: "Cabeza", color: "#7a6347", mat: "tela" },
  boina: { label: "Boina", cat: "Cabeza", color: "#45404a", mat: "tela" },
  lentes: { label: "Lentes", cat: "Cabeza", color: "#202022", mat: "plastico" },
  lentes_sol: { label: "Lentes de sol", cat: "Cabeza", color: "#151515", mat: "plastico" },
  arete_aro: { label: "Arete de aro", cat: "Orejas", color: "#d4b25a", mat: "metal", side: true },
  arete_boton: { label: "Arete de botón", cat: "Orejas", color: "#e8e6e2", mat: "piedra", side: true },
  arete_colgante: { label: "Arete colgante", cat: "Orejas", color: "#c9c9cc", mat: "metal", side: true },
  cadena: { label: "Cadena", cat: "Cuello", color: "#d4b25a", mat: "metal" },
  collar_dije: { label: "Collar con dije", cat: "Cuello", color: "#c9c9cc", mat: "metal" },
  gargantilla: { label: "Gargantilla", cat: "Cuello", color: "#1d1d1f", mat: "cuero" },
  bufanda: { label: "Bufanda", cat: "Cuello", color: "#7d2f2f", mat: "tela" },
  corbata: { label: "Corbata", cat: "Cuello", color: "#2f3b55", mat: "tela" },
  mono: { label: "Moño", cat: "Cuello", color: "#151517", mat: "tela" },
  reloj: { label: "Reloj", cat: "Muñecas", color: "#bfbfc4", mat: "metal", side: true, def: "L" },
  pulsera_cuero: { label: "Pulsera de cuero", cat: "Muñecas", color: "#5b3a22", mat: "cuero", side: true },
  pulsera_hilo: { label: "Pulsera de hilo", cat: "Muñecas", color: "#b5432f", mat: "hilo", side: true },
  brazalete: { label: "Brazalete de metal", cat: "Muñecas", color: "#d4b25a", mat: "metal", side: true },
  pulso: { label: "Pulso (muñequera)", cat: "Muñecas", color: "#2a2a2c", mat: "cuero", side: true },
  anillo: { label: "Anillo", cat: "Dedos", color: "#d4b25a", mat: "metal", side: true, finger: true },
  solitario: { label: "Solitario", cat: "Dedos", color: "#d9d9de", mat: "metal", side: true, finger: true },
  sello: { label: "Anillo de sello", cat: "Dedos", color: "#c4a24c", mat: "metal", side: true, finger: true },
  guantes: { label: "Guantes", cat: "Manos", color: "#2a2422", mat: "cuero" },
  zapatos: { label: "Zapatos", cat: "Pies", color: "#1e1b19", mat: "cuero" },
  botas: { label: "Botas", cat: "Pies", color: "#3b2a1d", mat: "cuero" },
  tenis: { label: "Tenis", cat: "Pies", color: "#e8e6e1", mat: "tela" },
  cinturon: { label: "Cinturón", cat: "Cintura", color: "#2b1f17", mat: "cuero" },
};
export const FINGER_NAMES = { index: "Índice", middle: "Medio", ring: "Anular", pinky: "Meñique" };

let aid = 0;
export function newAccessory(type) {
  const d = ACCESSORIES[type];
  const a = { id: "a" + Date.now().toString(36) + (aid++), type, color: d.color, mat: d.mat, size: 1 };
  if (d.side) a.side = d.def || "ambos";
  if (d.finger) a.finger = "ring";
  return a;
}

const cache = new Map();
function material(hex, matKey, useColor) {
  const m = MATERIALS[matKey] || MATERIALS.tela, key = (useColor ? hex : "clay") + matKey;
  if (!cache.has(key)) cache.set(key, new THREE.MeshStandardMaterial({ color: useColor ? hex : (matKey === "metal" ? 0xd0cdc6 : 0xbdb6ac), metalness: m.metalness, roughness: m.roughness }));
  return cache.get(key);
}

// Construye una pieza en el espacio local de su articulación
function piece(a, fig, side) {
  const d = fig.d, H = d.H, hh = d.hh, t = d.t, k = a.size || 1, g = new THREE.Group();
  const rx = hh * 0.335, ry = hh * 0.48, rz = hh * 0.41, cy = hh * 0.52, cz = -0.01 * hh;
  const M = (geo, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, null); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const ring = (r, tube, x, y, z, seg = 28) => { const m = M(new THREE.TorusGeometry(r, tube, 8, seg), x, y, z); m.rotation.x = Math.PI / 2; return m; };
  const sx = side === "L" ? 1 : -1;
  let joint = "head";
  switch (a.type) {
    case "fedora": {
      const top = cy + ry * 0.62;
      const crown = M(new THREE.CylinderGeometry(rx * 0.92 * k, rx * 1.04 * k, hh * 0.32 * k, 28), 0, top + hh * 0.12 * k, cz);
      crown.scale.z = 1.12;
      M(new THREE.CylinderGeometry(rx * 1.75 * k, rx * 1.75 * k, hh * 0.022, 36), 0, top - 0.004, cz).scale.z = 1.12;
      M(new THREE.CylinderGeometry(rx * 1.06 * k, rx * 1.06 * k, hh * 0.06, 28), 0, top + 0.004, cz).scale.z = 1.12; // cinta
      g.rotation.x = -0.08; break;
    }
    case "bombin": {
      const top = cy + ry * 0.6;
      const crown = M(new THREE.SphereGeometry(rx * 1.05 * k, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), 0, top - 0.005, cz); crown.scale.set(1, 1.15, 1.12);
      M(new THREE.CylinderGeometry(rx * 1.42 * k, rx * 1.42 * k, hh * 0.02, 32), 0, top - 0.006, cz).scale.z = 1.12; break;
    }
    case "gorra": {
      const top = cy + ry * 0.6;
      const cap = M(new THREE.SphereGeometry(rx * 1.1 * k, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), 0, top, cz); cap.scale.set(1, 0.85, 1.12);
      const visor = M(new THREE.CylinderGeometry(rx * 0.95 * k, rx * 0.95 * k, hh * 0.018, 24, 1, false, -Math.PI / 2, Math.PI), 0, top + 0.002, cz + rz * 0.78);
      visor.scale.set(1, 1, 0.9); visor.rotation.x = 0.12; break;
    }
    case "ala": {
      const top = cy + ry * 0.62;
      M(new THREE.CylinderGeometry(rx * 0.95 * k, rx * 1.05 * k, hh * 0.28 * k, 28), 0, top + hh * 0.1 * k, cz).scale.z = 1.1;
      const brim = M(new THREE.CylinderGeometry(rx * 2.4 * k, rx * 2.4 * k, hh * 0.018, 40), 0, top - 0.004, cz); brim.scale.z = 1.05; break;
    }
    case "boina": {
      const b = M(new THREE.SphereGeometry(rx * 1.2 * k, 24, 12), rx * 0.18, cy + ry * 0.72, cz - rz * 0.05); b.scale.set(1.05, 0.32, 1.05); b.rotation.z = -0.25; break;
    }
    case "lentes": case "lentes_sol": {
      const y = cy - ry * 0.02, z = cz + rz * 0.98, lr = hh * 0.075 * k, sep = rx * 0.42;
      for (const s of [1, -1]) {
        const fr = M(new THREE.TorusGeometry(lr, hh * 0.008, 6, 24), sep * s, y, z);
        if (a.type === "lentes_sol") M(new THREE.CircleGeometry(lr, 20), sep * s, y, z - 0.001);
        const arm = M(new THREE.BoxGeometry(hh * 0.01, hh * 0.01, rz * 0.95), rx * 0.98 * s, y + hh * 0.01, cz + rz * 0.5); void fr; void arm;
      }
      M(new THREE.BoxGeometry(sep * 0.7, hh * 0.01, hh * 0.01), 0, y + lr * 0.3, z); break;
    }
    case "arete_aro": case "arete_boton": case "arete_colgante": {
      const x = rx * 0.98 * sx, y = cy - ry * 0.32, z = cz - rz * 0.02;
      if (a.type === "arete_aro") { const r = M(new THREE.TorusGeometry(hh * 0.03 * k, hh * 0.004, 6, 20), x, y - hh * 0.03 * k, z); r.rotation.y = Math.PI / 2; }
      else if (a.type === "arete_boton") M(new THREE.SphereGeometry(hh * 0.012 * k, 12, 8), x + 0.002 * sx, y, z);
      else { M(new THREE.CylinderGeometry(0.0008, 0.0008, hh * 0.05 * k, 6), x, y - hh * 0.025 * k, z); M(new THREE.OctahedronGeometry(hh * 0.016 * k), x, y - hh * 0.06 * k, z).scale.y = 1.6; }
      break;
    }
    case "cadena": case "collar_dije": case "gargantilla": case "bufanda": case "corbata": case "mono": {
      joint = "neck1";
      const nr = 0.036 * H * t, yb = 0.0;
      if (a.type === "cadena" || a.type === "collar_dije") {
        const r = ring(nr * 1.55 * k, H * 0.0012, 0, yb - 0.012, 0.012, 40); r.scale.set(1, 1.25, 1); r.rotation.x = Math.PI / 2 - 0.55;
        if (a.type === "collar_dije") M(new THREE.OctahedronGeometry(H * 0.006 * k), 0, yb - 0.05 * k, nr * 1.55 * 1.05 + 0.012).scale.y = 1.5;
      } else if (a.type === "gargantilla") ring(nr * 1.02, H * 0.0035, 0, 0.03, 0, 32).scale.set(1, 1, 0.92);
      else if (a.type === "bufanda") {
        joint = "chest";
        const ny = (fig.joints.neck1.position.y); // altura del cuello sobre el pecho
        const r = ring(nr * 1.35 * k, H * 0.014 * k, 0, ny - 0.01, 0.005, 28); r.scale.set(1, 1.1, 1);
        const tail = M(new THREE.BoxGeometry(H * 0.05, H * 0.2 * k, H * 0.012), nr * 0.5, ny - H * 0.1 * k, nr * 1.4); tail.rotation.z = 0.08;
        M(new THREE.BoxGeometry(H * 0.045, H * 0.15 * k, H * 0.012), -nr * 0.2, ny - H * 0.09 * k, nr * 1.5).rotation.z = -0.05;
      } else if (a.type === "corbata") {
        joint = "chest";
        const ny = fig.joints.neck1.position.y, z = 0.064 * H * t + 0.014;
        M(new THREE.BoxGeometry(H * 0.018, H * 0.016, H * 0.012), 0, ny - 0.012, z);
        const blade = M(new THREE.CylinderGeometry(H * 0.012, H * 0.026, H * 0.26 * k, 4), 0, ny - 0.02 - H * 0.13 * k, z + 0.004);
        blade.rotation.y = Math.PI / 4; blade.scale.z = 0.25;
      } else {
        joint = "chest";
        const ny = fig.joints.neck1.position.y, z = 0.05 * H * t + 0.02;
        for (const s of [1, -1]) { const c = M(new THREE.ConeGeometry(H * 0.012, H * 0.03, 4), s * H * 0.015, ny - 0.008, z); c.rotation.z = -s * Math.PI / 2; }
        M(new THREE.SphereGeometry(H * 0.006, 8, 6), 0, ny - 0.008, z);
      }
      break;
    }
    case "reloj": case "pulsera_cuero": case "pulsera_hilo": case "brazalete": case "pulso": {
      joint = "elbow_" + side;
      const fore = fig.joints["wrist_" + side].position.y; // la muñeca cuelga en -y del codo
      const r = 0.021 * H * t, y = fore + (a.type === "pulso" ? 0.03 : 0.022);
      if (a.type === "reloj") { ring(r * 1.08, H * 0.004, 0, y, 0, 24); M(new THREE.CylinderGeometry(H * 0.011, H * 0.011, H * 0.006, 20), r * 1.12 * sx, y, 0).rotation.z = Math.PI / 2; }
      else if (a.type === "pulso") { M(new THREE.CylinderGeometry(r * 1.12, r * 1.12, H * 0.035 * k, 22, 1, true), 0, y, 0); }
      else if (a.type === "brazalete") M(new THREE.CylinderGeometry(r * 1.15, r * 1.15, H * 0.01 * k, 22, 1, true), 0, y, 0);
      else ring(r * 1.1, H * (a.type === "pulsera_hilo" ? 0.0018 : 0.003) * k, 0, y, 0, 20);
      break;
    }
    case "anillo": case "solitario": case "sello": {
      const f = a.finger || "ring";
      joint = f + "1_" + side;
      const seg = fig.joints[f + "2_" + side].position.y; // la falange cuelga en -y
      const r = H * 0.0072, y = seg * 0.55;
      ring(r, H * 0.0013, 0, y, 0, 18);
      if (a.type === "solitario") M(new THREE.OctahedronGeometry(H * 0.0028 * k), -r * sx * 1.1, y, 0);
      if (a.type === "sello") M(new THREE.BoxGeometry(H * 0.002, H * 0.006 * k, H * 0.006 * k), -r * sx * 1.05, y, 0);
      break;
    }
  }
  return { g, joint };
}

// Guantes y calzado: cubren las manos o los pies con una capa un poco más grande
function shellsFor(fig, a, mat) {
  const out = [];
  const isHand = j => /^(wrist|index|middle|ring|pinky|thumb)\d?_/.test(j);
  fig.root.traverse(m => {
    if (!m.isMesh || m.userData.cloth || m.userData.acc) return;
    const j = m.userData.joint || "";
    if (a.type === "guantes" ? isHand(j) : m.userData.foot) {
      const s = m.clone(); s.material = mat; s.userData = { acc: true, joint: j };
      const sc = a.type === "guantes" ? 1.1 : a.type === "tenis" ? 1.16 : 1.12;
      s.scale.multiplyScalar(sc); if (a.type !== "guantes") s.scale.y *= 1.08;
      m.parent.add(s); out.push(s);
      if (a.type !== "guantes") { m.visible = false; out.push({ restore: m }); }
    }
  });
  if (a.type === "botas") for (const s of ["L", "R"]) {
    const an = fig.joints["ankle_" + s], H = fig.d.H, r = 0.032 * H * fig.d.t;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.2, r * 1.15, H * 0.13, 20), mat);
    shaft.position.set(0, H * 0.05, 0); shaft.castShadow = true; shaft.userData = { acc: true, joint: "ankle_" + s };
    an.add(shaft); out.push(shaft);
  }
  if (a.type === "zapatos" || a.type === "botas" || a.type === "tenis") for (const s of ["L", "R"]) {
    const an = fig.joints["ankle_" + s], H = fig.d.H, fw = 0.05 * H * fig.d.t;
    const sole = new THREE.Mesh(new THREE.BoxGeometry(fw * 1.22, H * 0.012, 0.145 * H * 0.75), material(a.type === "tenis" ? "#f2f0ea" : "#141312", "plastico", true));
    sole.position.set(0, -fig.d.ankleY + H * 0.004, 0.145 * H * 0.72 / 2 - 0.035 * H + 0.01); sole.userData = { acc: true, sole: true, joint: "ankle_" + s };
    an.add(sole); out.push(sole);
  }
  return out;
}

export function equip(fig, list, { useColor = false } = {}) {
  const made = [];
  for (const a of list || []) {
    const d = ACCESSORIES[a.type]; if (!d) continue;
    const mat = material(a.color, a.mat, useColor);
    if (["guantes", "zapatos", "botas", "tenis"].includes(a.type)) { made.push(...shellsFor(fig, a, mat).map(x => ({ ...(x.restore ? x : { obj: x }), a }))); continue; }
    if (a.type === "cinturon") {
      const H = fig.d.H, t = fig.d.t, r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 8, 40), mat);
      r.rotation.x = Math.PI / 2;
      r.scale.set(fig.d.hw * 1.6 + 0.012, 0.06 * H * t + 0.012, 0.25); r.position.y = fig.joints.spine1.position.y * 0.4;
      r.userData = { acc: true, joint: "hips" }; r.castShadow = true;
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(H * 0.03, H * 0.022, H * 0.006), material("#c9b26a", "metal", useColor));
      buckle.position.set(0, r.position.y, 0.06 * H * t + 0.014); buckle.userData = { acc: true, joint: "hips" };
      fig.joints.hips.add(r, buckle); made.push({ obj: r, a }, { obj: buckle, a }); continue;
    }
    const sides = d.side ? (a.side === "ambos" ? ["L", "R"] : [a.side || "L"]) : [null];
    for (const s of sides) {
      const { g, joint } = piece(a, fig, s || "L");
      g.traverse(m => { if (m.isMesh) { m.material = mat; m.userData = { acc: true, joint }; m.raycast = () => {}; } });
      const J = fig.joints[joint]; if (!J) continue;
      J.add(g); made.push({ obj: g, a });
    }
  }
  return {
    dispose() { for (const x of made) { if (x.restore) x.restore.visible = true; else x.obj?.parent?.remove(x.obj); } },
    setStyle(useC) { for (const x of made) if (x.obj) x.obj.traverse(m => { if (m.isMesh && m.userData.acc && !m.userData.sole) m.material = material(x.a.color, x.a.mat, useC); }); },
  };
}
