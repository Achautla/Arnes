// Modelos .glb importados: el archivo se guarda aparte (IndexedDB y, con cuenta, en la nube).
// El proyecto solo guarda «glb:<huella>», así deshacer, guardar y sincronizar no cargan megas cada vez.
import * as cloud from "./cloud.js";

export const MAX_MODEL = 50e6;
let dbp = null;
function db() {
  return dbp ??= new Promise((res, rej) => {
    const r = indexedDB.open("arnes-models", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("glb");
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction("glb", mode), q = fn(t.objectStore("glb")); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); }); };

export async function hashOf(blob) {
  const h = new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer()));
  return [...h.slice(0, 12)].map(b => b.toString(16).padStart(2, "0")).join("");
}
// Guarda el archivo en el dispositivo y devuelve su huella
export async function putModel(blob) {
  const id = await hashOf(blob);
  await tx("readwrite", s => s.put(blob, id));
  return id;
}
// Sube el modelo a la carpeta del usuario si hay sesión. Devuelve true si quedó en la nube
export async function syncUp(id) {
  if (!cloud.configured() || !cloud.user()) return false;
  const blob = await tx("readonly", s => s.get(id)); if (!blob) return false;
  await cloud.uploadModel(id, blob); return true;
}
// Lo busca en el dispositivo; si no está (otro teléfono), lo baja de la nube del dueño
const pending = new Map();
export function getModel(id, owner) {
  if (!pending.has(id)) pending.set(id, (async () => {
    const local = await tx("readonly", s => s.get(id)).catch(() => null);
    if (local) return local;
    if (!owner || !cloud.configured() || !cloud.user()) throw new Error("Este modelo no está en este dispositivo.");
    const blob = await cloud.downloadModel(owner, id);
    await tx("readwrite", s => s.put(blob, id)).catch(() => {});
    return blob;
  })().catch(e => { pending.delete(id); throw e; }));
  return pending.get(id);
}

const eachModel = (p, fn) => { for (const v of [...(p.vinetas || []), ...(p.pages || []).flatMap(pg => pg.panels || [])]) for (const o of v?.objects || []) if (o.type === "modelo" && o.params?.src) fn(o); };
// Proyectos viejos (o abiertos de archivo) traen el .glb como data URL: lo pasa a IndexedDB y deja la huella
export async function externalizeModels(project) {
  const jobs = []; eachModel(project, o => { if (o.params.src.startsWith("data:")) jobs.push(o); });
  for (const o of jobs) { const id = await putModel(await (await fetch(o.params.src)).blob()); o.params.src = "glb:" + id; o.params.owner ??= cloud.user()?.id || null; syncUp(id).catch(() => {}); }
  return jobs.length;
}
// Para «Guardar proyecto» en archivo: el archivo lleva sus modelos dentro y abre en cualquier lado
export async function inlineModels(project) {
  const p = JSON.parse(JSON.stringify(project)), cache = new Map(); let missing = 0;
  const jobs = []; eachModel(p, o => { if (o.params.src.startsWith("glb:")) jobs.push(o); });
  for (const o of jobs) {
    const id = o.params.src.slice(4);
    try {
      if (!cache.has(id)) { const b = await getModel(id, o.params.owner); cache.set(id, await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); })); }
      o.params.src = cache.get(id);
    } catch { missing++; }
  }
  return { project: p, missing };
}
