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

export function buildLight(def, lowEnd) {
  const color = kelvinToColor(def.kelvin);
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
export function presetDay() {
  return {
    background: "papel",
    lights: [
      newLight("ambiente", { name: "Cielo", intensity: 1.0, kelvin: 7000 }),
      newLight("sol", { name: "Sol", pos: [3, 6, 4], intensity: 2.2, kelvin: 5600, softness: 0.4 }),
    ],
  };
}
