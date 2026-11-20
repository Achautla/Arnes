// Enlace de solo lectura sin servidor: el proyecto viaja comprimido dentro del propio enlace (#ver=…)
export const PAGES_URL = "https://achautla.github.io/Arnes/";

const b64url = buf => { let s = ""; const b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const unb64url = s => { const t = atob(s.replace(/-/g, "+").replace(/_/g, "/")); const b = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) b[i] = t.charCodeAt(i); return b; };

// Los modelos .glb importados pesan demasiado para un enlace: se quitan y se avisa cuántos
export function strip(p) {
  const c = JSON.parse(JSON.stringify(p)); let models = 0;
  for (const v of c.vinetas || []) v.objects = (v.objects || []).filter(o => (o.type === "modelo" ? (models++, false) : true));
  delete c.cloud; delete c.id;
  return { project: c, models };
}
export async function encode(p) {
  const { project, models } = strip(p);
  const stream = new Blob([JSON.stringify(project)]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return { code: b64url(await new Response(stream).arrayBuffer()), models };
}
export async function decode(code) {
  const stream = new Blob([unb64url(code)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return JSON.parse(await new Response(stream).text());
}
export function shareBase() {
  return /github\.io$/.test(location.hostname) || location.hostname === "localhost" ? location.origin + location.pathname : PAGES_URL;
}
export async function makeLink(p) { const { code, models } = await encode(p); return { url: shareBase() + "#ver=" + code, models }; }
// Enlace de una sola pieza (estilo, personaje, criatura, objeto, escenario…) sin cuenta: #pieza=…
export async function encodeItem(item) {
  const stream = new Blob([JSON.stringify(item)]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  return shareBase() + "#pieza=" + b64url(await new Response(stream).arrayBuffer());
}
export const decodeItem = decode;
