// Utilería de la Fase 2 y terreno irregular (campo, bosque, abismo, cueva, orilla de río)
import * as THREE from "three";
import { clay } from "./util.js";

export const EXTRA_PROPS = {
  auto: { label: "Auto", params: {} },
  farol: { label: "Farol de calle", params: { alto: 380 } },
  sofa: { label: "Sofá", params: { ancho: 200 } },
  cama: { label: "Cama", params: { ancho: 140 } },
  bote: { label: "Bote de basura", params: {} },
  escritorio: { label: "Escritorio con cajones", params: { ancho: 140 } },
  baston: { label: "Bastón", params: {} },
  colgante: { label: "Lámpara colgante", params: { altura: 220 } },
  pizarron: { label: "Pizarrón", params: { ancho: 220 } },
  maqueta: { label: "Maqueta de edificios", params: {} },
  espejo: { label: "Espejo de pie", params: {} },
  arbusto: { label: "Arbusto", params: { ancho: 120 } },
  arbol: { label: "Árbol", params: { alto: 600 } },
  roca: { label: "Roca", params: { ancho: 80 } },
  grua: { label: "Grúa", params: { alto: 1800 } },
  ave: { label: "Ave posada", params: {} },
  barandal: { label: "Barandal", params: { ancho: 300, alto: 95 } },
  caracol: { label: "Escalera de caracol", params: { alto: 300 } },
  andamio: { label: "Andamio", params: { ancho: 300, pisos: 2 } },
  columna: { label: "Columna", params: { alto: 300 } },
  losa: { label: "Losa o plataforma", params: { ancho: 400, fondo: 300, alto: 20 } },
};
export const TERRAIN_TYPES = { campo: "Campo", bosque: "Bosque", abismo: "Precipicio o abismo", cueva: "Cueva", rio: "Orilla de río" };
export const TERRAIN = { terreno: { label: "Terreno irregular", params: { tipo: "campo", ancho: 3000, relieve: 120, semilla: 7 } } };

const cm = v => v / 100;
const mesh = (g, geo, x, y, z, mat = clay) => {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
};
const box = (g, w, h, d, x, y, z) => mesh(g, new THREE.BoxGeometry(w, h, d), x, y, z);
const cyl = (g, r1, r2, h, x, y, z, seg = 20) => mesh(g, new THREE.CylinderGeometry(r1, r2, h, seg), x, y, z);
const sph = (g, r, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = mesh(g, new THREE.SphereGeometry(r, 20, 14), x, y, z); m.scale.set(sx, sy, sz); return m; };
// Ruido determinista (valor suave) para terreno y vegetación
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function noise2(seed) {
  const R = rng(seed), P = Array.from({ length: 256 }, () => R());
  const h = (x, y) => P[((x * 73856093) ^ (y * 19349663)) & 255];
  const s = t => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = s(x - xi), yf = s(y - yi);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return (a + (b - a) * xf) + ((c + (d - c) * xf) - (a + (b - a) * xf)) * yf;
  };
}

export function buildExtra(type, p, g) {
  switch (type) {
    case "auto": {
      box(g, 1.8, 0.7, 4.3, 0, 0.6, 0); box(g, 1.6, 0.55, 2.2, 0, 1.2, -0.2);
      for (const sx of [-0.85, 0.85]) for (const sz of [-1.35, 1.35]) { const w = cyl(g, 0.34, 0.34, 0.24, sx, 0.34, sz, 24); w.rotation.z = Math.PI / 2; }
      return true;
    }
    case "farol": {
      const h = cm(p.alto); cyl(g, 0.06, 0.09, h, 0, h / 2, 0);
      const arm = box(g, 0.05, 0.05, 0.6, 0, h - 0.05, 0.3); void arm;
      cyl(g, 0.12, 0.2, 0.3, 0, h - 0.2, 0.58, 8);
      g.userData.lightOffset = [0, h - 0.4, 0.58];
      return true;
    }
    case "sofa": {
      const w = cm(p.ancho); box(g, w, 0.42, 0.9, 0, 0.21, 0); box(g, w, 0.45, 0.2, 0, 0.62, -0.35);
      for (const s of [-1, 1]) box(g, 0.2, 0.25, 0.9, s * (w / 2 - 0.1), 0.55, 0);
      return true;
    }
    case "cama": {
      const w = cm(p.ancho); box(g, w, 0.3, 2.0, 0, 0.15, 0); box(g, w - 0.06, 0.22, 1.94, 0, 0.41, 0);
      box(g, w, 0.9, 0.08, 0, 0.45, -1.0); box(g, w * 0.7, 0.12, 0.4, 0, 0.58, -0.75);
      return true;
    }
    case "bote": { cyl(g, 0.24, 0.2, 0.7, 0, 0.35, 0); cyl(g, 0.26, 0.26, 0.04, 0, 0.72, 0); return true; }
    case "escritorio": {
      const w = cm(p.ancho); box(g, w, 0.04, 0.7, 0, 0.74, 0);
      box(g, 0.45, 0.7, 0.66, w / 2 - 0.25, 0.37, 0); box(g, 0.04, 0.7, 0.66, -w / 2 + 0.04, 0.37, 0);
      for (let i = 0; i < 3; i++) box(g, 0.4, 0.02, 0.01, w / 2 - 0.25, 0.18 + i * 0.22, 0.335);
      return true;
    }
    case "baston": {
      cyl(g, 0.012, 0.012, 0.86, 0, 0.43, 0, 10);
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 16, Math.PI), clay);
      t.position.set(0.06, 0.86, 0); t.castShadow = true; g.add(t);
      return true;
    }
    case "colgante": {
      const h = cm(p.altura); cyl(g, 0.005, 0.005, 2.8 - h + 0.4, 0, h + (2.8 - h + 0.4) / 2, 0, 6);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.22, 24, 1, true), clay);
      shade.position.set(0, h + 0.1, 0); shade.castShadow = false; g.add(shade);
      const inner = shade.clone(); inner.material = clay.clone(); inner.material.side = THREE.BackSide; g.add(inner);
      g.userData.lightOffset = [0, h + 0.02, 0];
      return true;
    }
    case "pizarron": { const w = cm(p.ancho); box(g, w, 1.1, 0.04, 0, 1.45, 0); box(g, w, 0.04, 0.1, 0, 0.88, 0.04); return true; }
    case "maqueta": {
      box(g, 0.9, 0.04, 0.6, 0, 0.02, 0);
      const R = rng(11);
      for (let i = 0; i < 9; i++) { const h = 0.08 + R() * 0.45; box(g, 0.1 + R() * 0.08, h, 0.1 + R() * 0.08, -0.35 + (i % 3) * 0.32, 0.04 + h / 2, -0.2 + Math.floor(i / 3) * 0.2); }
      return true;
    }
    case "espejo": {
      const fr = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 10, 40), clay);
      fr.scale.set(1, 1.6, 1); fr.position.set(0, 1.1, 0); fr.castShadow = true; g.add(fr);
      box(g, 0.56, 0.92, 0.01, 0, 1.1, -0.01);
      for (const s of [-1, 1]) { const l = cyl(g, 0.015, 0.015, 1.2, s * 0.25, 0.6, -0.15, 8); l.rotation.x = 0.2; }
      return true;
    }
    case "arbusto": {
      const w = cm(p.ancho), R = rng(5);
      for (let i = 0; i < 9; i++) sph(g, w * (0.18 + R() * 0.12), (R() - 0.5) * w * 0.7, w * (0.2 + R() * 0.25), (R() - 0.5) * w * 0.5);
      return true;
    }
    case "arbol": {
      const h = cm(p.alto), R = rng(3);
      cyl(g, 0.12, 0.22, h * 0.55, 0, h * 0.275, 0, 12);
      for (let i = 0; i < 7; i++) sph(g, h * (0.13 + R() * 0.08), (R() - 0.5) * h * 0.35, h * (0.6 + R() * 0.3), (R() - 0.5) * h * 0.35);
      return true;
    }
    case "roca": {
      const w = cm(p.ancho);
      const m = mesh(g, new THREE.DodecahedronGeometry(w / 2, 0), 0, w * 0.3, 0); m.scale.set(1, 0.65, 0.85); m.rotation.y = 0.6;
      return true;
    }
    case "grua": {
      const h = cm(p.alto); box(g, 1.5, h, 1.5, 0, h / 2, 0); box(g, 1, 1, 22, 0, h + 0.5, 6); box(g, 2.5, 2, 2.5, 0, h + 1.8, -2);
      cyl(g, 0.02, 0.02, h * 0.6, 0, h - h * 0.3, 14, 6);
      return true;
    }
    case "ave": {
      sph(g, 0.08, 0, 0.1, 0, 1, 0.8, 1.5); sph(g, 0.05, 0, 0.2, 0.09);
      const beak = mesh(g, new THREE.ConeGeometry(0.018, 0.07, 8), 0, 0.2, 0.16); beak.rotation.x = Math.PI / 2;
      const tail = box(g, 0.06, 0.015, 0.14, 0, 0.07, -0.15); tail.rotation.x = -0.4;
      for (const s of [-1, 1]) cyl(g, 0.005, 0.005, 0.06, s * 0.03, 0.03, 0, 6);
      return true;
    }
    case "barandal": {
      const w = cm(p.ancho), h = cm(p.alto), n = Math.max(2, Math.round(w / 0.12));
      box(g, w, 0.06, 0.08, 0, h, 0); box(g, w, 0.05, 0.06, 0, 0.1, 0);
      for (let i = 0; i <= n; i++) box(g, 0.035, h - 0.1, 0.035, -w / 2 + (i * w) / n, h / 2 + 0.03, 0);
      for (const s of [-1, 1]) box(g, 0.09, h + 0.08, 0.09, s * w / 2, (h + 0.08) / 2, 0);
      return true;
    }
    case "caracol": {
      const H = cm(p.alto), n = Math.round(H / 0.19), turn = Math.PI * 2 * (H / 3.2);
      cyl(g, 0.08, 0.08, H + 1, 0, (H + 1) / 2, 0, 16);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * turn, st = new THREE.Group();
        st.position.y = (i + 1) * (H / n); st.rotation.y = a; g.add(st);
        box(st, 0.9, 0.05, 0.32, 0.5, -0.025, 0);
        cyl(st, 0.015, 0.015, 0.95, 0.92, 0.47, 0, 6);
      }
      return true;
    }
    case "andamio": {
      const w = cm(p.ancho), n = Math.max(1, Math.round(p.pisos)), lvl = 2.0, d = 1.2;
      for (let k = 0; k <= n; k++) {
        if (k > 0) { box(g, w, 0.05, d, 0, k * lvl, 0); box(g, w, 0.04, 0.04, 0, k * lvl + 1.0, d / 2); box(g, w, 0.04, 0.04, 0, k * lvl + 0.5, d / 2); }
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(g, 0.025, 0.025, n * lvl + 1.1, sx * w / 2, (n * lvl + 1.1) / 2, sz * d / 2, 8);
      return true;
    }
    case "columna": { const h = cm(p.alto); cyl(g, 0.22, 0.22, h, 0, h / 2, 0, 24); box(g, 0.55, 0.12, 0.55, 0, 0.06, 0); box(g, 0.55, 0.12, 0.55, 0, h - 0.06, 0); return true; }
    case "losa": { box(g, cm(p.ancho), cm(p.alto), cm(p.fondo), 0, cm(p.alto) / 2, 0); return true; }
    case "terreno": { buildTerrain(g, p); return true; }
  }
  return false;
}

// Terreno: plano con relieve; cerca del centro queda plano para apoyar a los personajes
function buildTerrain(g, p) {
  const W = cm(p.ancho), A = cm(p.relieve), N = 96, n = noise2(p.semilla || 7);
  const tipo = p.tipo || "campo";
  if (tipo === "cueva") {
    const shell = new THREE.Mesh(new THREE.SphereGeometry(Math.max(3, A * 2.5), 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.55), clay.clone());
    shell.material.side = THREE.BackSide;
    const pos = shell.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(pos, i);
      const k = 1 + (n(v.x * 0.6 + 50, v.z * 0.6 + v.y) - 0.5) * 0.35;
      pos.setXYZ(i, v.x * k, v.y * k * 0.75, v.z * k);
    }
    shell.geometry.computeVertexNormals(); shell.castShadow = true; shell.receiveShadow = true;
    g.add(shell);
  }
  const heightAt = (x, z) => {
    const r = Math.hypot(x, z), flat = Math.min(1, Math.max(0, (r - 2.5) / 6));
    let y = ((n(x * 0.12, z * 0.12) - 0.5) * 1.6 + (n(x * 0.5 + 9, z * 0.5) - 0.5) * 0.35) * A * flat;
    if (tipo === "abismo") { const e = z + 1.5 + (n(x * 0.4, 3) - 0.5) * 1.2; if (e < 0) y = -Math.min(A * 8, -e * A * 6) - Math.max(0, y); }
    if (tipo === "rio") { const dz = Math.abs(z - 3.2 - (n(x * 0.15, 1) - 0.5) * 3); if (dz < 1.6) y -= (1 - dz / 1.6) * Math.max(0.6, A * 0.6); }
    if (tipo === "cueva") y *= 0.25;
    return y;
  };
  const geo = new THREE.PlaneGeometry(W, W, N, N); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, clay); m.receiveShadow = true; m.castShadow = true; m.userData.terrain = true; g.add(m);
  if (tipo === "rio") {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(W, 3.2), new THREE.MeshStandardMaterial({ color: 0x8fa3ad, roughness: 0.15, metalness: 0.1 }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, -Math.max(0.6, A * 0.6) * 0.55, 3.2); water.receiveShadow = true; g.add(water);
  }
  if (tipo === "bosque" || tipo === "abismo") {
    const R = rng((p.semilla || 7) + 1), count = tipo === "bosque" ? 26 : 8;
    for (let i = 0; i < count; i++) {
      const x = (R() - 0.5) * W * 0.6, z = (R() - 0.5) * W * 0.6;
      if (Math.hypot(x, z) < 3.5 || (tipo === "abismo" && z < -1.5)) continue;
      const t = new THREE.Group(); t.position.set(x, 0, z); g.add(t);
      buildExtra(R() < 0.75 ? "arbol" : "arbusto", { alto: 400 + R() * 500, ancho: 100 + R() * 80 }, t);
      t.position.y = heightAt(x, z) - 0.05;
    }
  }
  if (tipo === "abismo") {
    const R = rng(21);
    for (let i = 0; i < 6; i++) { const t = new THREE.Group(); t.position.set((R() - 0.5) * 10, 0, -1 + R() * 0.8); g.add(t); buildExtra("roca", { ancho: 40 + R() * 70 }, t); }
  }
  g.userData.hidesFloor = true; // el terreno reemplaza al piso
}
