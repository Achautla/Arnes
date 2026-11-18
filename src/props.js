// Primitivas y utilería, todo en metros y construido con volúmenes simples
import * as THREE from "three";
import { clay } from "./util.js";
import { EXTRA_PROPS, TERRAIN, buildExtra } from "./props2.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

// Modelos importados (.glb): se guardan en el proyecto como data URL y se convierten a arcilla
const models = new Map(); // src → Promise<Group>
function loadModel(src) {
  if (!models.has(src)) models.set(src, new Promise((res, rej) => {
    new GLTFLoader().load(src, gltf => {
      const root = gltf.scene;
      const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      root.position.set(-c.x, -box.min.y, -c.z); // centrado y apoyado en el piso
      root.traverse(m => { if (m.isMesh) { m.material = clay; m.castShadow = m.receiveShadow = true; } });
      const wrap = new THREE.Group(); wrap.add(root); wrap.userData.size = size; res(wrap);
    }, undefined, rej);
  }));
  return models.get(src);
}
export const modelReady = src => models.has(src);
export { EXTRA_PROPS, TERRAIN, TERRAIN_TYPES } from "./props2.js";

export const PRIMITIVES = {
  caja: { label: "Caja", params: { ancho: 50, alto: 50, fondo: 50 } },
  cilindro: { label: "Cilindro", params: { radio: 25, alto: 50 } },
  esfera: { label: "Esfera", params: { radio: 25 } },
  plano: { label: "Plano", params: { ancho: 100, fondo: 100 } },
};

export const PROPS = {
  mesa: { label: "Mesa", params: { ancho: 120, fondo: 70, alto: 74 } },
  silla: { label: "Silla", params: { asiento: 46 } },
  lampara: { label: "Lámpara de escritorio", params: {} },
  puerta: { label: "Puerta", params: { ancho: 90, alto: 210 } },
  pared: { label: "Pared", params: { ancho: 400, alto: 260 } },
  ventana: { label: "Ventana", params: { ancho: 120, alto: 120 } },
  escalera: { label: "Escalera", params: { escalones: 6, ancho: 100 } },
  vaso: { label: "Vaso", params: {} },
  baul: { label: "Baúl", params: { ancho: 90 } },
  estante: { label: "Estante", params: { ancho: 90, alto: 180 } },
};

const cm = v => v / 100;
function box(g, w, h, d, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), clay);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  g.add(m); return m;
}
function cyl(g, r1, r2, h, x, y, z, seg = 28) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, seg), clay);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  g.add(m); return m;
}

export function buildProp(type, p = {}) {
  const def = PRIMITIVES[type] || PROPS[type] || EXTRA_PROPS[type] || TERRAIN[type];
  p = { ...(def?.params || {}), ...p };
  const g = new THREE.Group();
  switch (type) {
    case "modelo": {
      const ph = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), clay); ph.position.y = 0.15; g.add(ph);
      if (p.src) loadModel(p.src).then(m => {
        g.remove(ph); const c = m.clone(true);
        c.traverse(x => { x.userData.objId = g.userData.objId; }); g.add(c);
        dispatchEvent(new CustomEvent("arnes-model", { detail: g.userData.objId }));
      }).catch(() => dispatchEvent(new CustomEvent("arnes-model-failed")));
      break;
    }
    case "caja": box(g, cm(p.ancho), cm(p.alto), cm(p.fondo), 0, cm(p.alto) / 2, 0); break;
    case "cilindro": cyl(g, cm(p.radio), cm(p.radio), cm(p.alto), 0, cm(p.alto) / 2, 0, 40); break;
    case "esfera": {
      const m = new THREE.Mesh(new THREE.SphereGeometry(cm(p.radio), 40, 24), clay);
      m.position.y = cm(p.radio); m.castShadow = m.receiveShadow = true; g.add(m); break;
    }
    case "plano": box(g, cm(p.ancho), 0.01, cm(p.fondo), 0, 0.005, 0); break;
    case "mesa": {
      const w = cm(p.ancho), d = cm(p.fondo), h = cm(p.alto), t = 0.04, l = 0.05;
      box(g, w, t, d, 0, h - t / 2, 0);
      box(g, w - 0.1, 0.08, 0.02, 0, h - t - 0.04, d / 2 - 0.06);
      box(g, w - 0.1, 0.08, 0.02, 0, h - t - 0.04, -d / 2 + 0.06);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, l, h - t, l, sx * (w / 2 - 0.06), (h - t) / 2, sz * (d / 2 - 0.06));
      break;
    }
    case "silla": {
      const s = cm(p.asiento), w = 0.44, t = 0.04;
      box(g, w, t, w, 0, s - t / 2, 0);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.035, s - t, 0.035, sx * (w / 2 - 0.03), (s - t) / 2, sz * (w / 2 - 0.03));
      for (const sx of [-1, 1]) box(g, 0.035, 0.46, 0.035, sx * (w / 2 - 0.03), s + 0.23, -w / 2 + 0.03);
      box(g, w, 0.16, 0.025, 0, s + 0.36, -w / 2 + 0.03);
      break;
    }
    case "lampara": {
      cyl(g, 0.08, 0.09, 0.02, 0, 0.01, 0);
      const arm = cyl(g, 0.012, 0.012, 0.34, 0, 0.18, 0, 12); arm.rotation.z = 0.25; arm.position.x = -0.04;
      const arm2 = cyl(g, 0.01, 0.01, 0.2, 0.03, 0.4, 0, 12); arm2.rotation.z = -1.1; arm2.position.set(0.0, 0.38, 0);
      const shade = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.13, 28, 1, true), clay);
      shade.material = clay; shade.position.set(0.1, 0.37, 0); shade.rotation.z = 0.5;
      shade.castShadow = false; shade.receiveShadow = true;
      const inner = shade.clone(); inner.material = clay.clone(); inner.material.side = THREE.BackSide;
      inner.castShadow = false;
      g.add(shade, inner);
      g.traverse(c => { if (c.isMesh) c.castShadow = false; }); // la lámpara no tapa su propia luz
      g.userData.lightOffset = [0.13, 0.33, 0];
      break;
    }
    case "puerta": {
      const w = cm(p.ancho), h = cm(p.alto);
      box(g, 0.06, h + 0.06, 0.12, -w / 2 - 0.03, (h + 0.06) / 2, 0);
      box(g, 0.06, h + 0.06, 0.12, w / 2 + 0.03, (h + 0.06) / 2, 0);
      box(g, w + 0.12, 0.06, 0.12, 0, h + 0.03, 0);
      box(g, w, h, 0.04, 0, h / 2, 0);
      const k = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), clay);
      k.position.set(w / 2 - 0.09, 1.0, 0.04); k.castShadow = true; g.add(k);
      break;
    }
    case "pared": box(g, cm(p.ancho), cm(p.alto), 0.12, 0, cm(p.alto) / 2, 0); break;
    case "ventana": {
      const w = cm(p.ancho), h = cm(p.alto), y0 = 0.9, f = 0.06;
      box(g, w + f * 2, f, 0.1, 0, y0 - f / 2, 0);
      box(g, w + f * 2, f, 0.1, 0, y0 + h + f / 2, 0);
      box(g, f, h, 0.1, -w / 2 - f / 2, y0 + h / 2, 0);
      box(g, f, h, 0.1, w / 2 + f / 2, y0 + h / 2, 0);
      box(g, 0.03, h, 0.05, 0, y0 + h / 2, 0);
      box(g, w, 0.03, 0.05, 0, y0 + h / 2, 0);
      break;
    }
    case "escalera": {
      const n = Math.max(1, Math.round(p.escalones)), w = cm(p.ancho), rise = 0.18, run = 0.28;
      for (let i = 0; i < n; i++) box(g, w, rise * (i + 1), run, 0, rise * (i + 1) / 2, -i * run);
      break;
    }
    case "vaso": {
      const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(0.032, 0), new THREE.Vector2(0.04, 0.1), new THREE.Vector2(0.036, 0.1), new THREE.Vector2(0.029, 0.008), new THREE.Vector2(0, 0.008)];
      const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 32), clay);
      m.castShadow = true; m.receiveShadow = true; g.add(m);
      break;
    }
    case "baul": {
      const w = cm(p.ancho), d = 0.5, h = 0.42;
      box(g, w, h, d, 0, h / 2, 0);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(d / 2, d / 2, w, 28, 1, false, 0, Math.PI), clay);
      lid.rotation.z = Math.PI / 2; lid.rotation.y = 0; lid.position.y = h;
      lid.rotation.x = Math.PI / 2; lid.rotation.set(0, 0, Math.PI / 2);
      lid.castShadow = true; lid.receiveShadow = true; g.add(lid);
      box(g, w + 0.02, 0.04, d + 0.02, 0, h, 0);
      break;
    }
    case "estante": {
      const w = cm(p.ancho), h = cm(p.alto), d = 0.3, t = 0.025;
      box(g, t, h, d, -w / 2 + t / 2, h / 2, 0);
      box(g, t, h, d, w / 2 - t / 2, h / 2, 0);
      box(g, w, h, 0.01, 0, h / 2, -d / 2 + 0.005);
      const n = 5;
      for (let i = 0; i < n; i++) box(g, w - 2 * t, t, d, 0, 0.05 + i * ((h - 0.08) / (n - 1)), 0);
      break;
    }
    default: if (!buildExtra(type, p, g)) box(g, 0.3, 0.3, 0.3, 0, 0.15, 0);
  }
  return g;
}

export const ALL_PROPS = () => ({ ...PRIMITIVES, ...PROPS, ...EXTRA_PROPS, ...TERRAIN });
