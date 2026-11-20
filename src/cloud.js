// Sincronización con Supabase por REST (sin dependencias). Solo funciona fuera de claude.ai.
import { CLOUD } from "./cloud-config.js";

const KEY = "arnes-session";
const base = () => CLOUD.url.replace(/\/$/, "");
// Dentro de claude.ai la app no puede hablar con otros servidores: la nube solo vive en GitHub Pages (y en pruebas locales)
export const reachable = () => /github\.io$|^localhost$|^127\.0\.0\.1$/.test(location.hostname);
export const configured = () => !!(CLOUD.url && CLOUD.anonKey) && reachable();

let session = null;
try { session = JSON.parse(localStorage.getItem(KEY) || "null"); } catch {}
const keep = s => { session = s; try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch {} };
export const user = () => session?.user || null;

class CloudError extends Error { constructor(msg, status) { super(msg); this.status = status; } }
async function auth(path, body, method = "POST", bearer = null) {
  let r;
  try { r = await fetch(base() + "/auth/v1/" + path, { method, headers: { apikey: CLOUD.anonKey, "Content-Type": "application/json", ...(bearer ? { Authorization: "Bearer " + bearer } : {}) }, body: JSON.stringify(body) }); }
  catch { throw new CloudError("No se pudo conectar con la nube. Revisa tu conexión e intenta de nuevo.", 0); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new CloudError(message(j, r.status), r.status);
  return j;
}
function message(j, status) {
  const m = (j.error_description || j.msg || j.message || j.error_code || "").toLowerCase();
  if (status === 429 || m.includes("rate limit") || m.includes("security purposes")) return "Ya se enviaron varios correos hace poco. Espera unos minutos y vuelve a intentar.";
  if (m.includes("same_password") || m.includes("different from the old")) return "La contraseña nueva debe ser distinta de la anterior.";
  if (m.includes("weak")) return "Esa contraseña es muy débil: usa al menos 8 caracteres, con letras y números.";
  if (m.includes("invalid login")) return "El correo o la contraseña no coinciden.";
  if (m.includes("already registered")) return "Ese correo ya tiene cuenta: entra con tu contraseña.";
  if (m.includes("password")) return "La contraseña debe tener al menos 6 caracteres.";
  if (m.includes("not confirmed")) return "Confirma tu correo con el enlace que te enviamos y vuelve a entrar.";
  return "No se pudo conectar con la nube. Revisa tu conexión e intenta de nuevo.";
}
const sess = j => ({ access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + (j.expires_in || 3600) * 1000, user: { id: j.user.id, email: j.user.email } });

export async function signIn(email, password) { keep(sess(await auth("token?grant_type=password", { email, password }))); return user(); }
export async function signUp(email, password) {
  const j = await auth("signup", { email, password });
  if (j.access_token) { keep(sess(j)); return user(); }
  return null; // requiere confirmar el correo
}
export function signOut() { keep(null); }

// Recuperar la cuenta: Supabase manda un correo con un enlace que regresa a Arnés con una sesión de
// recuperación (#…type=recovery). Con esa sesión se escribe la contraseña nueva.
export async function recover(email) {
  const back = location.origin + location.pathname;
  await auth("recover?redirect_to=" + encodeURIComponent(back), { email });
}
export async function setPassword(password) {
  const t = await token();
  await auth("user", { password }, "PUT", t);
}

// Entrar con Facebook (o Google): Supabase devuelve la sesión en el # de la dirección al volver
export function oauthUrl(provider) {
  const back = location.origin + location.pathname;
  return `${base()}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(back)}`;
}
export async function consumeOAuth() {
  const h = new URLSearchParams(location.hash.slice(1)), q = new URLSearchParams(location.search);
  const err = h.get("error_description") || q.get("error_description") || h.get("error") || q.get("error");
  if (!h.get("access_token") && !err) return null;
  history.replaceState(null, "", location.pathname);
  if (err) throw new Error(/email/i.test(err) ? "Facebook no compartió tu correo. Revisa los permisos de la app en Facebook e intenta de nuevo." : "No se pudo entrar. Si usaste un enlace de confirmación, ya no sirve otra vez: entra con tu correo y contraseña.");
  const at = h.get("access_token"), recovery = h.get("type") === "recovery";
  const r = await fetch(base() + "/auth/v1/user", { headers: { apikey: CLOUD.anonKey, Authorization: "Bearer " + at } });
  const u = await r.json().catch(() => ({}));
  if (!r.ok || !u.id) throw new Error("No se pudo entrar. Si usaste un enlace de confirmación, ya no sirve otra vez: entra con tu correo y contraseña.");
  const md = u.user_metadata || {};
  keep({ access_token: at, refresh_token: h.get("refresh_token"), expires_at: Date.now() + (+h.get("expires_in") || 3600) * 1000, user: { id: u.id, email: u.email || md.full_name || md.name || "Cuenta de Facebook" } });
  return recovery ? { ...user(), recovery: true } : user();
}

async function token() {
  if (!session) throw new Error("Sin sesión");
  if (Date.now() > session.expires_at - 60000) {
    // sin internet la sesión se conserva; solo se cierra si la nube dice que ya no vale
    try { keep(sess(await auth("token?grant_type=refresh_token", { refresh_token: session.refresh_token }))); }
    catch (e) { if (e.status >= 400 && e.status < 500) keep(null); throw e; }
  }
  return session.access_token;
}
async function rest(path, opt = {}, anon = false) {
  const bearer = anon && !session ? CLOUD.anonKey : await token();
  const r = await fetch(base() + "/rest/v1/" + path, { ...opt, headers: { apikey: CLOUD.anonKey, Authorization: "Bearer " + bearer, "Content-Type": "application/json", ...(opt.headers || {}) } });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    if (r.status === 404 && /relation|does not exist|schema cache/i.test(j.message || "")) throw new CloudError("La galería todavía no está activada en la nube: corre data/supabase-social.sql en Supabase.", 404);
    if (j.code === "23505") throw new CloudError("Ese nombre de usuario ya lo tiene alguien más.", 409);
    if (j.code === "23514") throw new CloudError("Algún dato no cumple las reglas (nombre de usuario de 3 a 24 letras, números, punto o guion bajo; textos más cortos).", 400);
    throw new CloudError("No se pudo sincronizar con la nube (" + r.status + ").", r.status);
  }
  return r.status === 204 || r.status === 201 && !(opt.headers?.Prefer || "").includes("representation") ? null : r.json().catch(() => null);
}

export const listRemote = () => rest("projects?select=id,name,vinetas,updated_at&order=updated_at.desc");
export async function pull(id) { const r = await rest(`projects?id=eq.${encodeURIComponent(id)}&select=data`); return r?.[0]?.data || null; }
export function push(p) {
  return rest("projects?on_conflict=id", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: p.id, name: p.name || "Mi proyecto", vinetas: p.vinetas.length, data: p, updated_at: new Date().toISOString() }),
  });
}
// Borra la cuenta y todo lo guardado en la nube (proyectos y perfil). Lo del dispositivo se queda.
export async function deleteAccount() {
  // primero los modelos .glb de su carpeta (Storage no se borra solo con la cuenta)
  try {
    const t = await token(), uid = user().id, H = { apikey: CLOUD.anonKey, Authorization: "Bearer " + t, "Content-Type": "application/json" };
    const r = await fetch(base() + "/storage/v1/object/list/modelos", { method: "POST", headers: H, body: JSON.stringify({ prefix: uid + "/", limit: 1000 }) });
    const files = r.ok ? await r.json() : [];
    if (files.length) await fetch(base() + "/storage/v1/object/modelos", { method: "DELETE", headers: H, body: JSON.stringify({ prefixes: files.map(f => `${uid}/${f.name}`) }) });
  } catch {}
  await rest("rpc/delete_my_account", { method: "POST", body: "{}" }); keep(null);
}
export const removeRemote = id => rest(`projects?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });

// Perfil: expresiones y poses guardadas viajan con la cuenta
export async function pullProfile() { const r = await rest("profiles?select=data"); return r?.[0]?.data || null; }
export const pushProfile = data => rest("profiles?on_conflict=user_id", {
  method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify({ user_id: user().id, data, updated_at: new Date().toISOString() }),
});

// Modelos .glb: viven en Storage (carpeta del usuario), no dentro del proyecto
const MODEL_PATH = (owner, id) => `modelos/${encodeURIComponent(owner)}/${encodeURIComponent(id)}.glb`;
export async function uploadModel(id, blob) {
  const r = await fetch(base() + "/storage/v1/object/" + MODEL_PATH(user().id, id), { method: "POST", headers: { apikey: CLOUD.anonKey, Authorization: "Bearer " + await token(), "x-upsert": "true", "Content-Type": "model/gltf-binary" }, body: blob });
  if (!r.ok) throw new Error("No se pudo subir el modelo a la nube (" + r.status + ").");
}
export async function downloadModel(owner, id) {
  const r = await fetch(base() + "/storage/v1/object/authenticated/" + MODEL_PATH(owner, id), { headers: { apikey: CLOUD.anonKey, Authorization: "Bearer " + await token() } });
  if (!r.ok) throw new Error("No se pudo bajar el modelo de la nube (" + r.status + ").");
  return r.blob();
}

// ---------------------------------------------------------------- Comunidad (Fase 6, bloque 3)
// Perfil público (usuario, nombre, foto, biografía) y publicaciones: estilos, personajes, criaturas,
// objetos, escenarios, viñetas y páginas. Leer la galería no pide cuenta; publicar, dar «me gusta» y reportar sí.
export const PUB_KINDS = { estilo: "Estilos", personaje: "Personajes", criatura: "Criaturas", objeto: "Objetos", escenario: "Escenarios", vineta: "Viñetas", pagina: "Páginas" };
const enc = encodeURIComponent;
export async function myPublic() { if (!user()) return null; const r = await rest(`perfil_publico?user_id=eq.${user().id}&select=*`); return r?.[0] || null; }
export async function savePublic(p) {
  const body = { user_id: user().id, username: String(p.username || "").trim().toLowerCase(), display_name: (p.display_name || "").trim().slice(0, 60), bio: (p.bio || "").trim().slice(0, 400), avatar: p.avatar || null, updated_at: new Date().toISOString() };
  await rest("perfil_publico?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(body) });
  return body;
}
export async function usernameFree(name) { const r = await rest(`perfil_publico?username=eq.${enc(name.toLowerCase())}&select=user_id`, {}, true); return !r?.length || r[0].user_id === user()?.id; }
export async function profilesByIds(ids) { if (!ids.length) return {}; const r = await rest(`perfil_publico?user_id=in.(${ids.map(enc).join(",")})&select=user_id,username,display_name,avatar`, {}, true); return Object.fromEntries((r || []).map(x => [x.user_id, x])); }
export async function profileByName(username) { const r = await rest(`perfil_publico?username=eq.${enc(username.toLowerCase())}&select=*`, {}, true); return r?.[0] || null; }
export async function publish(item) {
  const body = { user_id: user().id, kind: item.kind, title: item.title.trim().slice(0, 80), description: (item.description || "").slice(0, 600), data: item.data, thumb: item.thumb || null, visibility: item.visibility || "publico", remix: item.remix ? "si" : "no", remix_of: item.remix_of || null };
  const r = await rest("publicaciones?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify(body) });
  return r?.[0]?.id;
}
export async function updatePublication(id, patch) { await rest(`publicaciones?id=eq.${enc(id)}`, { method: "PATCH", body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }) }); }
export const deletePublication = id => rest(`publicaciones?id=eq.${enc(id)}`, { method: "DELETE" });
const LIST = "id,user_id,kind,title,description,thumb,remix,remix_of,likes,created_at,visibility";
export async function gallery({ kind = "", q = "", order = "nuevo", author = "", limit = 30, offset = 0 } = {}) {
  let path = `publicaciones?select=${LIST}&limit=${limit}&offset=${offset}`;
  path += author ? `&user_id=eq.${enc(author)}` : "&visibility=eq.publico";
  if (kind) path += `&kind=eq.${enc(kind)}`;
  if (q) path += `&title=ilike.*${enc(q.replace(/[*,()]/g, " "))}*`;
  path += order === "popular" ? "&order=likes.desc,created_at.desc" : "&order=created_at.desc";
  return await rest(path, {}, true) || [];
}
export async function publication(id) { const r = await rest(`publicaciones?id=eq.${enc(id)}&select=*`, {}, true); return r?.[0] || null; }
export async function myLikes(ids) { if (!user() || !ids.length) return new Set(); const r = await rest(`me_gusta?user_id=eq.${user().id}&pub_id=in.(${ids.map(enc).join(",")})&select=pub_id`); return new Set((r || []).map(x => x.pub_id)); }
export async function like(id, on) {
  if (on) await rest("me_gusta", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ pub_id: id, user_id: user().id }) });
  else await rest(`me_gusta?pub_id=eq.${enc(id)}&user_id=eq.${user().id}`, { method: "DELETE" });
}
export async function report(id, reason) { await rest("reportes", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ pub_id: id, user_id: user().id, reason: String(reason || "").slice(0, 500) }) }); }
