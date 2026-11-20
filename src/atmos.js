// Atmósferas: luz, cielo, niebla y partículas juntas. Se eligen de una vez y después todo se ajusta a mano.
import * as THREE from "three";
import { newLight } from "./lights.js";

export const ATMOS = {
  ninguna: { label: "Sin atmósfera" },
  niebla: { label: "Niebla", fog: 0.55, fogColor: "#c9cdd0", lights: () => [newLight("ambiente", { name: "Cielo nublado", intensity: 1.1, kelvin: 7500 }), newLight("sol", { name: "Sol tras la niebla", pos: [2, 6, 3], intensity: 0.9, kelvin: 6500, softness: 0.9 })] },
  lluvia: { label: "Lluvia", fog: 0.45, fogColor: "#7d858b", fx: "lluvia", fxAmt: 0.6, particles: "lluvia", lights: () => [newLight("ambiente", { name: "Cielo de lluvia", intensity: 0.7, kelvin: 8000 }), newLight("sol", { name: "Luz difusa", pos: [-2, 6, 2], intensity: 0.8, kelvin: 7000, softness: 0.9 })] },
  polvo: { label: "Polvo en el aire", fog: 0.45, fogColor: "#c8b28c", particles: "polvo", lights: () => [newLight("ambiente", { name: "Cielo con polvo", intensity: 0.8, kelvin: 4200, color: "#d9c6a2" }), newLight("sol", { name: "Sol entre el polvo", pos: [5, 4, 2], intensity: 2.2, kelvin: 3800, softness: 0.5 })] },
  humo: { label: "Humo", fog: 0.6, fogColor: "#8e8a86", particles: "humo", lights: () => [newLight("ambiente", { name: "Rebote gris", intensity: 0.5, kelvin: 5500 }), newLight("sol", { name: "Luz entre el humo", pos: [3, 5, -2], intensity: 1.4, kelvin: 3600, softness: 0.6 })] },
  calor: { label: "Calor del mediodía", fog: 0.3, fogColor: "#efe4c9", particles: "calor", lights: () => [newLight("ambiente", { name: "Cielo blanco", intensity: 1.2, kelvin: 6200, color: "#fff4dc" }), newLight("sol", { name: "Sol de mediodía", pos: [0.5, 9, 0.8], intensity: 3.4, kelvin: 5200, softness: 0.15 })] },
  luna: { label: "Noche de luna", background: "oscuro", fog: 0.4, fogColor: "#1c2433", lights: () => [newLight("ambiente", { name: "Noche", intensity: 0.12, kelvin: 9500 }), newLight("sol", { name: "Luna llena", pos: [-4, 7, 2], intensity: 0.85, kelvin: 10000, softness: 0.4 })] },
  amanecer: { label: "Amanecer", fog: 0.4, fogColor: "#e9c4b4", lights: () => [newLight("ambiente", { name: "Cielo rosado", intensity: 0.55, kelvin: 5000, color: "#d8b8c8" }), newLight("sol", { name: "Sol que sale", pos: [-7, 0.9, 1], intensity: 2.4, kelvin: 2600, softness: 0.3 })] },
  tormenta: { label: "Tormenta", background: "oscuro", fog: 0.55, fogColor: "#2a2f36", fx: "lluvia", fxAmt: 0.85, particles: "lluvia", lights: () => [newLight("ambiente", { name: "Cielo de tormenta", intensity: 0.25, kelvin: 9000 }), newLight("sol", { name: "Relámpago", pos: [-3, 9, -4], intensity: 3.2, kelvin: 12000, softness: 0.05 }), newLight("punto", { name: "Rebote frío", pos: [1.5, 1.2, 2], intensity: 0.6, kelvin: 9000, softness: 0.8, shadow: false })] },
};

// Aplica la atmósfera a la vista y devuelve las luces nuevas (o null si no cambia las luces)
export function applyAtmo(view, key) {
  const A = ATMOS[key] || ATMOS.ninguna;
  view.atmo = key;
  if (key === "ninguna") { delete view.fogColor; view.fog = 0; if (view.fx === "lluvia") view.fx = "ninguno"; return null; }
  view.fog = A.fog ?? view.fog ?? 0; if (A.fogColor) view.fogColor = A.fogColor; else delete view.fogColor;
  view.background = A.background || "papel";
  if (A.fx) { view.fx = A.fx; view.fxAmt = A.fxAmt ?? 0.6; } else if (view.fx === "lluvia") view.fx = "ninguno";
  return A.lights ? A.lights() : null;
}

// Partículas en 3D: lluvia (trazos), polvo (motas), humo (manchas grandes), calor (ondas cerca del piso)
const SPRITE = (() => { const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d"), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,1)"); r.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = r; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
export function atmoParticles(view, span = 1) {
  const kind = ATMOS[view.atmo]?.particles; if (!kind) return null;
  const amt = view.atmoAmt ?? 0.6, S = 12 * span, rnd = (() => { let s = 7; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); })();
  let obj;
  if (kind === "lluvia") {
    const n = Math.round(2500 * amt * Math.min(4, span)), pos = new Float32Array(n * 6), lean = (view.fxAng || 0) * Math.PI / 180;
    for (let i = 0; i < n; i++) { const x = (rnd() - 0.5) * S * 2, y = rnd() * S * 0.8, z = (rnd() - 0.5) * S * 2, L = 0.25 + rnd() * 0.25; pos.set([x, y, z, x + Math.sin(lean) * L, y - L, z], i * 6); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    obj = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: view.background === "oscuro" ? 0x9fb2c4 : 0x6f7b85, transparent: true, opacity: 0.55, depthWrite: false }));
  } else {
    const P = { polvo: [1800, 0.05, 0xd8c39a, 0.55, 3], humo: [160, 2.2, 0x9a9590, 0.16, 2.5], calor: [300, 0.9, 0xfff3d8, 0.12, 0.8] }[kind];
    const n = Math.round(P[0] * amt * Math.min(3, span)), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([(rnd() - 0.5) * S * 2, rnd() * P[4] * span, (rnd() - 0.5) * S * 2], i * 3);
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    obj = new THREE.Points(g, new THREE.PointsMaterial({ size: P[1] * Math.sqrt(span), map: SPRITE, color: P[2], transparent: true, opacity: P[3], depthWrite: false, sizeAttenuation: true }));
  }
  obj.userData.atmo = true; obj.userData.noLines = true; obj.renderOrder = 4; obj.frustumCulled = false; obj.raycast = () => {};
  return obj;
}
