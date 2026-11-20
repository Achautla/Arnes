// Utilería de la Fase 2 y terreno irregular (campo, bosque, abismo, cueva, orilla de río)
import * as THREE from "three";
import { clay } from "./util.js";
import { buildPlant, PLANT_DEFAULT } from "./plants.js";
import { buildCompound } from "./objects.js";

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
  humo: { label: "Humo o vapor", params: { alto: 80, ancho: 40, densidad: 60, semilla: 3, tono: "claro" } },
  // Fase 6 · bloque 2: piezas de exteriores
  planta: { label: "Planta (árboles, palmas, mangle, arbustos…)", params: { ...PLANT_DEFAULT } },
  edificio: { label: "Edificio con ventanas", params: { ancho: 1200, pisos: 6, fondo: 1000, semilla: 2 } },
  casa: { label: "Casa de pueblo", params: { ancho: 700, fondo: 600, alto: 300, semilla: 4 } },
  carretera: { label: "Carretera o calle", params: { ancho: 800, largo: 6000 } },
  banqueta: { label: "Banqueta con guarnición", params: { ancho: 300, largo: 3000 } },
  agua: { label: "Agua (río, lago, charco)", params: { ancho: 600, fondo: 600 } },
  cerca: { label: "Cerca de madera o alambre", params: { ancho: 600, alto: 120, semilla: 1 } },
  poste_luz: { label: "Poste con cables", params: { alto: 800 } },
  compuesto: { label: "Objeto propio (editor)", params: {}, hidden: true },
};
export const SET_PIECES = ["planta", "edificio", "casa", "carretera", "banqueta", "agua", "cerca", "poste_luz"];

// Humo: una lámina que siempre mira a la cámara, con volutas de ruido. No genera contorno ni sombra,
// así que cada estilo lo lee como valor: en el grabado se vuelve volutas claras entre el rayado.
const smokeVert = `varying vec2 vUv; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  vec2 sc = vec2(length(modelMatrix[0].xyz), length(modelMatrix[1].xyz)); mv.xy += position.xy * sc; gl_Position = projectionMatrix * mv; }`;
const smokeFrag = `precision highp float; varying vec2 vUv; uniform float dens, seed, dark;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)) + seed * 17.0) * 43758.5453); }
float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * n(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
void main(){
  vec2 p = vUv; float y = p.y;
  // la columna se ensancha y serpentea al subir
  float sway = (fbm(vec2(y * 2.5, seed)) - 0.5) * 0.6 * y;
  float x = (p.x - 0.5 - sway) / (0.16 + 0.34 * y);
  float body = exp(-x * x * 2.2);
  float curl = fbm(vec2(x * 1.5 + y * 3.0, y * 4.0 - seed));
  float wisps = smoothstep(0.32, 0.7, curl) * 0.9 + smoothstep(0.25, 0.8, fbm(p * vec2(3.0, 6.0) + curl)) * 0.5;
  float a = body * wisps * smoothstep(0.0, 0.12, y) * smoothstep(1.0, 0.7, y) * dens * 1.5;
  gl_FragColor = vec4(mix(vec3(1.0, 0.98, 0.95), vec3(0.08, 0.07, 0.07), dark), clamp(a, 0.0, 0.95));
}`;
export function buildSmoke(p, g) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0), new THREE.ShaderMaterial({
    vertexShader: smokeVert, fragmentShader: smokeFrag, transparent: true, depthWrite: false,
    uniforms: { dens: { value: (p.densidad ?? 60) / 60 }, seed: { value: p.semilla ?? 3 }, dark: { value: p.tono === "oscuro" ? 1 : 0 } },
  }));
  m.scale.set((p.ancho ?? 40) / 100, (p.alto ?? 80) / 100, 1);
  m.userData.noLines = true; m.userData.noContact = true; m.castShadow = false; m.receiveShadow = false; m.renderOrder = 5; m.frustumCulled = false;
  g.add(m);
}
export const TERRAIN_TYPES = { campo: "Campo", bosque: "Bosque", selva: "Selva", abismo: "Precipicio o abismo", acantilado: "Acantilado sobre el mar", cueva: "Cueva", rio: "Orilla de río", rio_pendiente: "Río en pendiente (rápidos)", lago: "Lago", manglar: "Manglar", desierto: "Desierto (dunas)" };
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
    case "humo": buildSmoke(p, g); return true;
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
    case "planta": { buildPlant(p, g); return true; }
    case "compuesto": { buildCompound(p, g); return true; }
    case "edificio": { buildBuilding(g, p); return true; }
    case "casa": { buildHouse(g, p); return true; }
    case "carretera": {
      const w = cm(p.ancho), L = cm(p.largo);
      const road = box(g, w, 0.02, L, 0, 0.01, 0); road.userData.part = { color: "#3c3d3f", tex: "piedra" };
      for (let z = -L / 2 + 1.5; z < L / 2 - 1; z += 6) { const d = box(g, 0.14, 0.004, 3, 0, 0.022, z); d.userData.part = { color: "#e8e2c8" }; d.castShadow = false; }
      for (const s of [-1, 1]) { const e = box(g, 0.1, 0.004, L, s * (w / 2 - 0.25), 0.022, 0); e.userData.part = { color: "#e8e2c8" }; e.castShadow = false; }
      g.userData.parts = true; return true;
    }
    case "banqueta": {
      const w = cm(p.ancho), L = cm(p.largo);
      const walk = box(g, w, 0.15, L, 0, 0.075, 0); walk.userData.part = { color: "#a7a39a", tex: "piedra" };
      const curb = box(g, 0.15, 0.18, L, w / 2, 0.09, 0); curb.userData.part = { color: "#8d8a83" };
      for (let z = -L / 2; z < L / 2; z += 1.2) { const j = box(g, w, 0.153, 0.01, 0, 0.076, z); j.userData.part = { color: "#8d8a83" }; j.castShadow = false; }
      g.userData.parts = true; return true;
    }
    case "agua": {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(cm(p.ancho), cm(p.fondo), 24, 24), clay);
      const pp = m.geometry.getAttribute("position"); for (let i = 0; i < pp.count; i++) pp.setZ(i, Math.sin(pp.getX(i) * 3.1) * Math.cos(pp.getY(i) * 2.3) * 0.015); m.geometry.computeVertexNormals();
      m.rotation.x = -Math.PI / 2; m.position.y = 0.02; m.receiveShadow = true; m.userData.part = { color: "#6f8f9c", tex: "lisa" }; m.userData.water = true;
      g.add(m); g.userData.parts = true; return true;
    }
    case "cerca": {
      const w = cm(p.ancho), h = cm(p.alto), n = Math.max(2, Math.round(w / 1.8)), R = rng(p.semilla || 1);
      for (let i = 0; i <= n; i++) { const x = -w / 2 + i * w / n, post = cyl(g, 0.05, 0.06, h, x + (R() - 0.5) * 0.06, h / 2, 0, 7); post.rotation.z = (R() - 0.5) * 0.08; post.userData.part = { color: "#6f5640", tex: "madera" }; }
      for (const y of [h * 0.35, h * 0.8]) { const rail = box(g, w, 0.07, 0.03, 0, y, 0.05); rail.rotation.z = (R() - 0.5) * 0.02; rail.userData.part = { color: "#7a6048", tex: "madera" }; }
      g.userData.parts = true; return true;
    }
    case "poste_luz": {
      const h = cm(p.alto); const post = cyl(g, 0.11, 0.14, h, 0, h / 2, 0, 9); post.userData.part = { color: "#6f5640", tex: "madera" };
      const arm = box(g, 1.6, 0.1, 0.1, 0, h - 0.6, 0); arm.userData.part = { color: "#6f5640", tex: "madera" };
      for (const x of [-0.65, 0, 0.65]) { const ins = cyl(g, 0.04, 0.05, 0.14, x, h - 0.48, 0, 8); ins.userData.part = { color: "#d8d8d0" }; }
      // cables que cuelgan hacia el siguiente poste
      for (const x of [-0.65, 0, 0.65]) { const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(x, h - 0.42 - Math.sin(t * Math.PI) * 0.6, t * 12)); } const c = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.008, 4), clay); c.userData.part = { color: "#222222" }; c.castShadow = true; g.add(c); }
      g.userData.parts = true; return true;
    }
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
    if (tipo === "rio_pendiente") { y += -z * A * 0.35 * flat; const dx = Math.abs(x - (n(z * 0.15, 2) - 0.5) * 4); if (dx < 1.8) y -= (1 - dx / 1.8) * Math.max(0.5, A * 0.5); }
    if (tipo === "lago") { const r2 = Math.hypot(x, z - 7), edge = 5 + (n(Math.atan2(z - 7, x) * 2, 4) - 0.5) * 2.5; if (r2 < edge + 2) y -= Math.max(0, 1 - (r2 - edge) / 2) * Math.max(0.8, A * 0.8); }
    if (tipo === "manglar") y = y * 0.15 - 0.05;
    if (tipo === "desierto") { const r = Math.hypot(x, z), f2 = Math.min(1, Math.max(0, (r - 3) / 5)); y = (Math.pow(Math.abs(Math.sin(x * 0.18 + n(x * 0.05, z * 0.05) * 4)), 1.6) * 1.8 + (n(x * 0.1, z * 0.1) - 0.5) * 1.5) * A * f2; }
    if (tipo === "acantilado") { const e = z + 3 + (n(x * 0.3, 7) - 0.5) * 2.5; if (e < 0) y = -A * 14 - Math.max(0, y); else y += Math.min(1, e / 3) * A * 0.3; }
    return y;
  };
  const geo = new THREE.PlaneGeometry(W, W, N, N); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, clay); m.receiveShadow = true; m.castShadow = true; m.userData.terrain = true; g.add(m);
  const waterMesh = (w, d, x, y, z, rx = -Math.PI / 2) => { const wm = new THREE.Mesh(new THREE.PlaneGeometry(w, d, 8, 8), clay); wm.rotation.x = rx; wm.position.set(x, y, z); wm.receiveShadow = true; wm.userData.part = { color: "#6f8f9c" }; wm.userData.water = true; g.add(wm); g.userData.parts = true; return wm; };
  if (tipo === "rio") waterMesh(W, 3.2, 0, -Math.max(0.6, A * 0.6) * 0.55, 3.2);
  if (tipo === "lago") waterMesh(15, 15, 0, -Math.max(0.8, A * 0.8) * 0.5, 7);
  if (tipo === "manglar") waterMesh(W, W, 0, 0.02, 0);
  if (tipo === "acantilado") waterMesh(W, W / 2, 0, -A * 13, -W / 4);
  if (tipo === "rio_pendiente") {
    // el agua baja en escalones con rocas que forman los rápidos
    const R2 = rng(31), d = Math.max(0.5, A * 0.5);
    for (let zz = -W * 0.3; zz < W * 0.3; zz += 2) { const xc = (n(zz * 0.15, 2) - 0.5) * 4; waterMesh(3.2, 2.2, xc, heightAt(xc + 3, zz) * 0 + (-zz * A * 0.35) - d * 0.55, zz, -Math.PI / 2 + 0.35 * A * 0.3); if (R2() < 0.6) { const t = new THREE.Group(); t.position.set(xc + (R2() - 0.5) * 2.4, -zz * A * 0.35 - d * 0.6, zz); g.add(t); buildExtra("roca", { ancho: 40 + R2() * 60 }, t); } }
  }
  // vegetación propia de cada terreno (especies y densidad); se apoya sobre el relieve
  const FLORA = {
    bosque: { n: 26, mix: [["roble", 0.45], ["pino", 0.35], ["arbusto", 0.2]] },
    abismo: { n: 8, mix: [["pino", 0.7], ["arbusto", 0.3]] },
    selva: { n: 46, mix: [["ceiba", 0.22], ["palmera", 0.18], ["platanera", 0.2], ["helecho", 0.25], ["arbusto", 0.15]] },
    manglar: { n: 30, mix: [["mangle", 0.85], ["helecho", 0.15]] },
    desierto: { n: 12, mix: [["cactus", 0.7], ["seco", 0.15], ["arbusto", 0.15]] },
    campo: { n: 14, mix: [["pasto", 0.55], ["roble", 0.15], ["flores", 0.3]] },
    rio: { n: 14, mix: [["sauce", 0.3], ["pasto", 0.4], ["helecho", 0.3]] },
    rio_pendiente: { n: 18, mix: [["pino", 0.5], ["helecho", 0.3], ["arbusto", 0.2]] },
    lago: { n: 16, mix: [["sauce", 0.3], ["pasto", 0.4], ["roble", 0.3]] },
    acantilado: { n: 8, mix: [["pasto", 0.6], ["arbusto", 0.4]] },
  }[tipo];
  if (FLORA) {
    const R = rng((p.semilla || 7) + 1);
    for (let i = 0; i < FLORA.n; i++) {
      const x = (R() - 0.5) * W * 0.6, z = (R() - 0.5) * W * 0.6;
      if (Math.hypot(x, z) < 3.5 || (tipo === "abismo" && z < -1.5) || (tipo === "acantilado" && z < -2.5) || (tipo === "lago" && Math.hypot(x, z - 7) < 6)) continue;
      let r = R(), sp = FLORA.mix[0][0]; for (const [k, w] of FLORA.mix) { if (r < w) { sp = k; break; } r -= w; }
      const t = new THREE.Group(); t.position.set(x, 0, z); g.add(t);
      buildPlant({ especie: sp, semilla: Math.floor(R() * 999), alto: null, follaje: null, grosor: null }, t);
      t.scale.setScalar(0.7 + R() * 0.6); t.rotation.y = R() * 6.28;
      t.position.y = heightAt(x, z) - 0.05;
    }
  }
  if (tipo === "abismo") {
    const R = rng(21);
    for (let i = 0; i < 6; i++) { const t = new THREE.Group(); t.position.set((R() - 0.5) * 10, 0, -1 + R() * 0.8); g.add(t); buildExtra("roca", { ancho: 40 + R() * 70 }, t); }
  }
  g.userData.hidesFloor = true; // el terreno reemplaza al piso
}

// Edificio de ciudad: volumen con hileras de ventanas hundidas, cornisa y planta baja con cortinas
function buildBuilding(g, p) {
  const w = cm(p.ancho), d = cm(p.fondo), floors = Math.max(1, Math.round(p.pisos)), fh = 3.1, h = floors * fh + 1.2, R = rng(p.semilla || 2);
  const tone = ["#9c8a78", "#a9a294", "#8f7f72", "#b2a48e", "#7e7468"][Math.floor(R() * 5)];
  const body = box(g, w, h, d, 0, h / 2, 0); body.userData.part = { color: tone, tex: R() < 0.5 ? "ladrillo" : "piedra" };
  const cornice = box(g, w + 0.3, 0.35, d + 0.3, 0, h + 0.17, 0); cornice.userData.part = { color: "#8d8a83" };
  const cols = Math.max(1, Math.round(w / 2.2)), win = Math.min(1.2, w / cols * 0.55);
  for (const face of [0, 1, 2, 3]) {
    const along = face % 2 ? d : w, nc = Math.max(1, Math.round(along / 2.2));
    for (let f = 0; f < floors; f++) for (let c = 0; c < nc; c++) {
      const u = -along / 2 + (c + 0.5) * along / nc, y = 1.2 + f * fh + fh * 0.5;
      const lit = R() < 0.25;
      const m = new THREE.Mesh(new THREE.BoxGeometry(win, fh * 0.5, 0.08), clay); m.userData.part = { color: lit ? "#e8c97a" : "#2f3438" };
      const sill = new THREE.Mesh(new THREE.BoxGeometry(win + 0.15, 0.08, 0.16), clay); sill.userData.part = { color: "#8d8a83" };
      const off = (face % 2 ? w : d) / 2 + 0.01, rot = [0, Math.PI / 2, Math.PI, -Math.PI / 2][face];
      for (const [mm, dy, dz] of [[m, 0, -0.02], [sill, -fh * 0.27, 0.04]]) { mm.position.set(Math.sin(rot) * (off + dz) + Math.cos(rot) * u, y + dy, Math.cos(rot) * (off + dz) - Math.sin(rot) * u); mm.rotation.y = rot; mm.castShadow = false; mm.receiveShadow = true; g.add(mm); }
    }
  }
  void cols;
  g.userData.parts = true;
}
// Casa de pueblo: muros, techo de dos aguas con teja, puerta y ventanas con marco
function buildHouse(g, p) {
  const w = cm(p.ancho), d = cm(p.fondo), h = cm(p.alto), R = rng(p.semilla || 4);
  const wall = box(g, w, h, d, 0, h / 2, 0); wall.userData.part = { color: ["#d9c7a8", "#c98f6a", "#e0d6c2", "#9fb3a8", "#d4a24c"][Math.floor(R() * 5)], tex: "piedra" };
  const roofH = Math.min(w, d) * 0.32, sh = new THREE.Shape(); sh.moveTo(-w / 2 - 0.35, 0); sh.lineTo(w / 2 + 0.35, 0); sh.lineTo(0, roofH); sh.closePath();
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: d + 0.6, bevelEnabled: false }), clay); roof.position.set(0, h, -d / 2 - 0.3); roof.castShadow = roof.receiveShadow = true; roof.userData.part = { color: "#9a4a32", tex: "ladrillo" }; g.add(roof);
  const door = box(g, 0.95, 2.1, 0.06, -w * 0.2, 1.05, d / 2 + 0.02); door.userData.part = { color: "#5a3a26", tex: "madera" };
  for (const x of [w * 0.15, w * 0.36]) { if (Math.abs(x + w * 0.2) < 1) continue; const fr = box(g, 1.05, 1.15, 0.08, x, 1.55, d / 2 + 0.03); fr.userData.part = { color: "#f0ebe0" }; const gl = box(g, 0.85, 0.95, 0.1, x, 1.55, d / 2 + 0.03); gl.userData.part = { color: "#2f3438" }; }
  for (const x of [-w * 0.3, w * 0.3]) { const fr = box(g, 1.05, 1.15, 0.08, x, 1.55, -d / 2 - 0.03); fr.userData.part = { color: "#f0ebe0" }; }
  const step = box(g, 1.4, 0.18, 0.5, -w * 0.2, 0.09, d / 2 + 0.25); step.userData.part = { color: "#a7a39a" };
  g.userData.parts = true;
}
