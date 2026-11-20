// Editor de objetos y accesorios: un objeto propio es una lista de piezas simples (caja, cilindro, cono,
// esfera, cápsula, toro, cuña, tubo, pirámide, media esfera) con posición, giro, tamaño, color y textura.
// Se guarda como datos (pesa casi nada), viaja en el proyecto y se comparte. Se puede sostener con la mano.
import * as THREE from "three";
import { clay, uid } from "./util.js";

export const SHAPES = { caja: "Caja", cilindro: "Cilindro", cono: "Cono", esfera: "Esfera", media: "Media esfera", capsula: "Cápsula", toro: "Aro (toro)", cuna: "Cuña", tubo: "Tubo hueco", piramide: "Pirámide" };
const D = (shape, pos, size, rot = [0, 0, 0], color = "#9a8f80", tex = "lisa", mirror = false) => ({ id: uid("q"), shape, pos, size, rot, color, tex, mirror });
// tamaños en metros: [ancho, alto, fondo]
export const OBJECT_PRESETS = {
  espada: { label: "Espada", parts: () => [D("caja", [0, 0.55, 0], [0.05, 0.8, 0.008], [0, 0, 0], "#c8ccd0", "metal"), D("piramide", [0, 0.98, 0], [0.05, 0.07, 0.008], [0, 45, 0], "#c8ccd0", "metal"), D("caja", [0, 0.14, 0], [0.22, 0.025, 0.035], [0, 0, 0], "#8a6a2a", "metal"), D("cilindro", [0, 0.05, 0], [0.03, 0.16, 0.03], [0, 0, 0], "#3a2a20", "cuero"), D("esfera", [0, -0.04, 0], [0.045, 0.045, 0.045], [0, 0, 0], "#8a6a2a", "metal")] },
  lanza: { label: "Lanza", parts: () => [D("cilindro", [0, 0.9, 0], [0.03, 1.8, 0.03], [0, 0, 0], "#6f5640", "madera"), D("cono", [0, 1.9, 0], [0.06, 0.22, 0.02], [0, 0, 0], "#c8ccd0", "metal")] },
  escudo: { label: "Escudo redondo", parts: () => [D("cilindro", [0, 0.35, 0], [0.62, 0.04, 0.62], [90, 0, 0], "#7a5a3a", "madera"), D("media", [0, 0.35, 0.02], [0.14, 0.14, 0.07], [90, 0, 0], "#9aa0a6", "metal"), D("toro", [0, 0.35, 0], [0.62, 0.62, 0.03], [0, 0, 0], "#9aa0a6", "metal")] },
  pistola: { label: "Pistola", parts: () => [D("caja", [0, 0.1, 0.06], [0.03, 0.035, 0.16], [0, 0, 0], "#2a2c2e", "metal"), D("caja", [0, 0.04, 0], [0.028, 0.1, 0.035], [-15, 0, 0], "#3a2a20", "madera"), D("cilindro", [0, 0.105, 0.16], [0.012, 0.06, 0.012], [90, 0, 0], "#2a2c2e", "metal")] },
  baston_mago: { label: "Bastón de mago", parts: () => [D("cilindro", [0, 0.75, 0], [0.035, 1.5, 0.035], [0, 0, 0], "#5a4430", "madera"), D("toro", [0, 1.55, 0], [0.12, 0.12, 0.025], [0, 0, 0], "#5a4430", "madera"), D("esfera", [0, 1.55, 0], [0.08, 0.08, 0.08], [0, 0, 0], "#6aa8d8")] },
  linterna: { label: "Linterna de mano", parts: () => [D("cilindro", [0, 0.06, 0], [0.12, 0.02, 0.12], [0, 0, 0], "#3a3a3a", "metal"), D("cilindro", [0, 0.16, 0], [0.1, 0.18, 0.1], [0, 0, 0], "#e8d9a0"), D("cono", [0, 0.29, 0], [0.13, 0.08, 0.13], [0, 0, 0], "#3a3a3a", "metal"), D("toro", [0, 0.36, 0], [0.07, 0.07, 0.012], [90, 0, 0], "#3a3a3a", "metal")] },
  barril: { label: "Barril", parts: () => [D("cilindro", [0, 0.45, 0], [0.56, 0.9, 0.56], [0, 0, 0], "#7a5a3a", "madera"), D("toro", [0, 0.15, 0], [0.57, 0.57, 0.02], [90, 0, 0], "#4a4a4a", "metal"), D("toro", [0, 0.75, 0], [0.57, 0.57, 0.02], [90, 0, 0], "#4a4a4a", "metal")] },
  maceta: { label: "Maceta", parts: () => [D("cono", [0, 0.17, 0], [0.4, 0.34, 0.4], [180, 0, 0], "#a8583a", "ladrillo"), D("cilindro", [0, 0.33, 0], [0.36, 0.02, 0.36], [0, 0, 0], "#4a3a2a")] },
  banca: { label: "Banca de parque", parts: () => [D("caja", [0, 0.45, 0], [1.6, 0.04, 0.42], [0, 0, 0], "#7a5a3a", "madera"), D("caja", [0, 0.72, -0.2], [1.6, 0.3, 0.04], [-12, 0, 0], "#7a5a3a", "madera"), D("caja", [0.7, 0.36, 0], [0.05, 0.72, 0.46], [0, 0, 0], "#2a2c2e", "metal", true)] },
  poste: { label: "Poste de luz con cables", parts: () => [D("cilindro", [0, 4, 0], [0.22, 8, 0.22], [0, 0, 0], "#6f5640", "madera"), D("caja", [0, 7.4, 0], [1.6, 0.1, 0.1], [0, 0, 0], "#6f5640", "madera"), D("cilindro", [0.6, 7.5, 0], [0.06, 0.12, 0.06], [0, 0, 0], "#d8d8d0", "lisa", true)] },
  machete: { label: "Machete", parts: () => [D("cuna", [0, 0.4, 0], [0.06, 0.5, 0.006], [0, 0, 0], "#c8ccd0", "metal"), D("caja", [0, 0.08, 0], [0.035, 0.14, 0.025], [0, 0, 0], "#3a2a20", "madera")] },
  libro: { label: "Libro abierto", parts: () => [D("caja", [-0.085, 0.01, 0], [0.16, 0.015, 0.23], [0, 0, 6], "#e8e2d0", "lisa", false), D("caja", [0.085, 0.01, 0], [0.16, 0.015, 0.23], [0, 0, -6], "#e8e2d0"), D("caja", [0, 0.002, 0], [0.34, 0.004, 0.24], [0, 0, 0], "#6a2a2a", "cuero")] },
};
export const newPart = (shape = "caja") => D(shape, [0, 0.25, 0], [0.3, 0.3, 0.3]);

function shapeGeo(s) {
  switch (s) {
    case "cilindro": return new THREE.CylinderGeometry(0.5, 0.5, 1, 28);
    case "cono": return new THREE.ConeGeometry(0.5, 1, 28);
    case "esfera": return new THREE.SphereGeometry(0.5, 28, 18);
    case "media": { const g = new THREE.SphereGeometry(0.5, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2); g.translate(0, -0.25, 0); g.scale(1, 2, 1); return g; }
    case "capsula": return new THREE.CapsuleGeometry(0.5, 1, 6, 18).scale(1, 0.5, 1);
    case "toro": return new THREE.TorusGeometry(0.5, 0.08, 10, 40).scale(1, 1, 6);
    case "cuna": { const g = new THREE.BoxGeometry(1, 1, 1, 1, 1, 1), p = g.getAttribute("position"); for (let i = 0; i < p.count; i++) if (p.getY(i) > 0 && p.getX(i) > 0) p.setX(i, -0.5); g.computeVertexNormals(); return g; }
    case "tubo": { const shape = new THREE.Shape(); shape.absarc(0, 0, 0.5, 0, Math.PI * 2); const hole = new THREE.Path(); hole.absarc(0, 0, 0.38, 0, Math.PI * 2, true); shape.holes.push(hole); const g = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, curveSegments: 28 }); g.translate(0, 0, -0.5); g.rotateX(Math.PI / 2); return g; }
    case "piramide": return new THREE.ConeGeometry(0.71, 1, 4).rotateY(Math.PI / 4);
    default: return new THREE.BoxGeometry(1, 1, 1);
  }
}
export function buildCompound(p, g) {
  for (const part of p.parts || []) {
    const copies = part.mirror ? [1, -1] : [1];
    for (const sx of copies) {
      const m = new THREE.Mesh(shapeGeo(part.shape), clay);
      m.position.set(part.pos[0] * sx, part.pos[1], part.pos[2]);
      m.rotation.set(...part.rot.map((d, i) => d * Math.PI / 180 * (sx < 0 && i > 0 ? -1 : 1)));
      m.scale.set(Math.max(0.002, part.size[0]), Math.max(0.002, part.size[1]), Math.max(0.002, part.size[2]));
      m.castShadow = m.receiveShadow = true;
      m.userData.part = { color: part.color, tex: part.tex };
      m.userData.partId = part.id;
      g.add(m);
    }
  }
  g.userData.parts = true;
}
// Mis objetos: la biblioteca del dispositivo (viaja con la cuenta en el perfil)
export function myObjects() { try { return JSON.parse(localStorage.getItem("arnes-objects") || "[]"); } catch { return []; } }
export function writeMyObjects(a) { try { localStorage.setItem("arnes-objects", JSON.stringify(a)); return true; } catch { return false; } }
