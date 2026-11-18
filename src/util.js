// Utilidades compartidas
import * as THREE from "three";

export const DEG = THREE.MathUtils.DEG2RAD;
export const RAD = THREE.MathUtils.RAD2DEG;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const uid = (p = "o") => p + Math.random().toString(36).slice(2, 9);
export const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
export const clone = o => JSON.parse(JSON.stringify(o));

// Material de arcilla compartido: gris cálido mate, el aspecto del semirender
export const clay = new THREE.MeshStandardMaterial({ color: 0xbdb6ac, roughness: 0.86, metalness: 0 });
export const clayDark = new THREE.MeshStandardMaterial({ color: 0x8a837a, roughness: 0.75, metalness: 0 });

// Temperatura de color (Kelvin) a RGB, aproximación de Tanner Helland
export function kelvinToColor(k) {
  const t = k / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
  if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = new THREE.Color(clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255);
  return c.convertSRGBToLinear();
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Descarga: dentro de claude.ai usa la capacidad "downloads"; fuera (GitHub Pages), un enlace normal
let downloadsNs;
export async function saveFile(filename, data) {
  if (downloadsNs === undefined && window.claude?.use) {
    try { downloadsNs = await window.claude.use("downloads"); } catch { downloadsNs = null; }
  }
  if (downloadsNs) {
    try { await downloadsNs.save({ filename, data }); return "ok"; }
    catch (e) { return e?.code === "declined" ? "declined" : "error"; }
  }
  const blob = data instanceof Blob ? data : new Blob([data]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "ok";
}
