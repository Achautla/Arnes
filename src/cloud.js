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

async function auth(path, body) {
  const r = await fetch(base() + "/auth/v1/" + path, { method: "POST", headers: { apikey: CLOUD.anonKey, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(message(j));
  return j;
}
function message(j) {
  const m = (j.error_description || j.msg || j.message || "").toLowerCase();
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
  if (err) throw new Error(/email/i.test(err) ? "Facebook no compartió tu correo. Revisa los permisos de la app en Facebook e intenta de nuevo." : "No se pudo entrar con Facebook. Intenta de nuevo o entra con tu correo.");
  const at = h.get("access_token");
  const r = await fetch(base() + "/auth/v1/user", { headers: { apikey: CLOUD.anonKey, Authorization: "Bearer " + at } });
  const u = await r.json().catch(() => ({}));
  if (!r.ok || !u.id) throw new Error("No se pudo entrar con Facebook. Intenta de nuevo o entra con tu correo.");
  const md = u.user_metadata || {};
  keep({ access_token: at, refresh_token: h.get("refresh_token"), expires_at: Date.now() + (+h.get("expires_in") || 3600) * 1000, user: { id: u.id, email: u.email || md.full_name || md.name || "Cuenta de Facebook" } });
  return user();
}

async function token() {
  if (!session) throw new Error("Sin sesión");
  if (Date.now() > session.expires_at - 60000) {
    try { keep(sess(await auth("token?grant_type=refresh_token", { refresh_token: session.refresh_token }))); }
    catch (e) { keep(null); throw e; }
  }
  return session.access_token;
}
async function rest(path, opt = {}) {
  const r = await fetch(base() + "/rest/v1/" + path, { ...opt, headers: { apikey: CLOUD.anonKey, Authorization: "Bearer " + await token(), "Content-Type": "application/json", ...(opt.headers || {}) } });
  if (!r.ok) throw new Error("No se pudo sincronizar con la nube (" + r.status + ").");
  return r.status === 204 ? null : r.json().catch(() => null);
}

export const listRemote = () => rest("projects?select=id,name,vinetas,updated_at&order=updated_at.desc");
export async function pull(id) { const r = await rest(`projects?id=eq.${encodeURIComponent(id)}&select=data`); return r?.[0]?.data || null; }
export function push(p) {
  return rest("projects?on_conflict=id", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ id: p.id, name: p.name || "Mi proyecto", vinetas: p.vinetas.length, data: p, updated_at: new Date().toISOString() }),
  });
}
export const removeRemote = id => rest(`projects?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });

// Perfil: expresiones y poses guardadas viajan con la cuenta
export async function pullProfile() { const r = await rest("profiles?select=data"); return r?.[0]?.data || null; }
export const pushProfile = data => rest("profiles?on_conflict=user_id", {
  method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify({ user_id: user().id, data, updated_at: new Date().toISOString() }),
});
