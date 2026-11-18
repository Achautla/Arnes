// Luces de la escena y sus presets
import * as THREE from "three";
import { kelvinToColor, uid } from "./util.js";

export const LIGHT_TYPES = {
  punto: { label: "Punto (foco desnudo, lámpara)", max: 40, def: 6 },
  foco: { label: "Foco dirigido", max: 60, def: 10 },
  sol: { label: "Sol", max: 6, def: 2.5 },
  ambiente: { label: "Ambiente", max: 3, def: 0.6 },
};

export function newLight(type, extra = {}) {
  return {
    id: uid("l"), type, name: LIGHT_TYPES[type].label.split(" (")[0],
    pos: type === "sol" ? [3, 6, 4] : [0.6, 1.8, 1], target: [0, 0.9, 0],
    intensity: LIGHT_TYPES[type].def, kelvin: type === "sol" ? 5600 : 3200,
    softness: 0.3, shadow: type !== "ambiente", ...extra,
  };
}

// Gobos: patrones que una luz de foco proyecta (sombras de persiana, ventana, rejas, hojas)
export const GOBOS = { ninguno: "Ninguno", persiana: "Persiana", ventana: "Ventana", rejas: "Rejas", hojas: "Hojas" };
const goboCache = {};
export function goboTexture(kind) {
  if (!kind || kind === "ninguno") return null;
  if (goboCache[kind]) return goboCache[kind];
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, 256, 256); g.fillStyle = "#000";
  if (kind === "persiana") for (let y = 0; y < 256; y += 22) g.fillRect(0, y, 256, 9);
  else if (kind === "ventana") { g.fillRect(0, 0, 256, 18); g.fillRect(0, 238, 256, 18); g.fillRect(0, 0, 18, 256); g.fillRect(238, 0, 18, 256); g.fillRect(120, 0, 16, 256); g.fillRect(0, 120, 256, 16); }
  else if (kind === "rejas") for (let x = 6; x < 256; x += 34) g.fillRect(x, 0, 10, 256);
  else if (kind === "hojas") {
    let s = 17; const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 70; i++) { g.beginPath(); g.ellipse(R() * 256, R() * 256, 8 + R() * 20, 4 + R() * 10, R() * 3, 0, Math.PI * 2); g.fill(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  goboCache[kind] = t; return t;
}

export function buildLight(def, lowEnd) {
  const color = def.color ? new THREE.Color(def.color) : kelvinToColor(def.kelvin);
  let light;
  const size = lowEnd ? 512 : 1024;
  switch (def.type) {
    case "punto":
      light = new THREE.PointLight(color, def.intensity, 0, 2);
      light.shadow.mapSize.set(size, size);
      light.shadow.camera.near = 0.05;
      break;
    case "foco":
      light = new THREE.SpotLight(color, def.intensity, 0, 35 * Math.PI / 180, 0.15 + def.softness * 0.7, 2);
      light.shadow.mapSize.set(size, size);
      light.shadow.camera.near = 0.05;
      break;
    case "sol":
      light = new THREE.DirectionalLight(color, def.intensity);
      light.shadow.mapSize.set(size * 2, size * 2);
      Object.assign(light.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 25 });
      break;
    default:
      light = new THREE.HemisphereLight(color, new THREE.Color(0x6b665f), def.intensity);
  }
  light.position.fromArray(def.pos);
  if (light.shadow && def.type !== "ambiente") {
    light.castShadow = !!def.shadow;
    light.shadow.radius = 1 + def.softness * 9;
    light.shadow.bias = -0.0006;
    light.shadow.normalBias = 0.02;
  }
  if (light.target) light.target.position.fromArray(def.target);
  if (light.isSpotLight && def.gobo && def.gobo !== "ninguno") { light.map = goboTexture(def.gobo); light.castShadow = true; }
  light.userData.lightId = def.id;
  return light;
}

// Icono pickable de la luz (se dibuja encima de todo, en la escena de ayudas)
export function buildLightIcon(def) {
  const g = new THREE.Group();
  const col = new THREE.Color(0xffc861);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), new THREE.MeshBasicMaterial({ color: col, depthTest: false, transparent: true }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.008, 8, 32), new THREE.MeshBasicMaterial({ color: 0x1d2023, depthTest: false, transparent: true }));
  g.add(core, ring);
  g.position.fromArray(def.pos);
  g.renderOrder = 10;
  g.traverse(o => { o.userData.lightId = def.id; o.renderOrder = 10; });
  g.userData.lightId = def.id;
  g.userData.ring = ring;
  return g;
}

// Presets: devuelven la lista de luces y el fondo
export function presetNoir(lampWorldPos) {
  const p = lampWorldPos || [0.1, 1.15, -0.1];
  return {
    background: "oscuro",
    lights: [
      newLight("punto", { name: "Lámpara noir", pos: p, intensity: 1.1, kelvin: 2700, softness: 0.05, shadow: true }),
      newLight("ambiente", { name: "Rebote mínimo", intensity: 0.14, kelvin: 6500 }),
    ],
  };
}
export function presetSunset() {
  return { background: "papel", fog: 0.25, lights: [
    newLight("ambiente", { name: "Cielo del atardecer", intensity: 0.45, kelvin: 4500, color: "#b9a6c9" }),
    newLight("sol", { name: "Sol bajo", pos: [6, 1.6, 2], intensity: 2.6, kelvin: 2400, softness: 0.25 }),
  ] };
}
export function presetMoon() {
  return { background: "oscuro", fog: 0.35, lights: [
    newLight("ambiente", { name: "Noche", intensity: 0.12, kelvin: 9000 }),
    newLight("sol", { name: "Luna", pos: [-3, 6, 2], intensity: 0.7, kelvin: 9500, softness: 0.5 }),
  ] };
}
export function presetNeon() {
  return { background: "oscuro", fog: 0.3, lights: [
    newLight("ambiente", { name: "Rebote", intensity: 0.08, kelvin: 6500 }),
    newLight("punto", { name: "Neón magenta", pos: [-1.2, 2.0, 0.6], intensity: 4, color: "#ff3fa4", softness: 0.4 }),
    newLight("punto", { name: "Neón cian", pos: [1.3, 1.6, 0.8], intensity: 4, color: "#38d6ff", softness: 0.4 }),
  ] };
}
export function presetFire() {
  return { background: "oscuro", fog: 0.2, lights: [
    newLight("ambiente", { name: "Rebote", intensity: 0.05, kelvin: 3000 }),
    newLight("punto", { name: "Fogata", pos: [0.6, 0.35, 0.8], intensity: 3.5, kelvin: 1900, softness: 0.35 }),
  ] };
}
export function presetBacklight() {
  return { background: "papel", fog: 0, lights: [
    newLight("ambiente", { name: "Relleno", intensity: 0.25, kelvin: 6500 }),
    newLight("foco", { name: "Contraluz", pos: [0, 2.4, -2.4], target: [0, 1.2, 0], intensity: 30, kelvin: 6000, softness: 0.3 }),
    newLight("punto", { name: "Relleno frontal", pos: [1.2, 1.4, 2.2], intensity: 1.2, kelvin: 4500, softness: 0.8, shadow: false }),
  ] };
}
export function presetUnder() {
  return { background: "oscuro", fog: 0, lights: [
    newLight("ambiente", { name: "Rebote", intensity: 0.06, kelvin: 5000 }),
    newLight("punto", { name: "Luz desde abajo", pos: [0.1, 0.25, 0.7], intensity: 2.2, kelvin: 3500, softness: 0.2 }),
  ] };
}
export function presetBlinds() {
  return { background: "oscuro", fog: 0.25, lights: [
    newLight("ambiente", { name: "Rebote", intensity: 0.08, kelvin: 6000 }),
    newLight("foco", { name: "Sol por la persiana", pos: [2.6, 2.6, 1.4], target: [0, 1.0, 0], intensity: 45, kelvin: 4800, softness: 0.1, gobo: "persiana" }),
  ] };
}
export const PRESETS = {
  noir: "Lámpara noir", day: "Luz de día", sunset: "Atardecer", moon: "Luz de luna", neon: "Neón",
  fire: "Fogata", back: "Contraluz", under: "Luz desde abajo", blinds: "Persiana (noir)",
};
export function presetDay() {
  return {
    background: "papel",
    lights: [
      newLight("ambiente", { name: "Cielo", intensity: 1.0, kelvin: 7000 }),
      newLight("sol", { name: "Sol", pos: [3, 6, 4], intensity: 2.2, kelvin: 5600, softness: 0.4 }),
    ],
  };
}
