// Servicios de IA intercambiables. Cada artista guarda sus claves (solo en su dispositivo) y elige quién lee
// (páginas, viñetas, calibrar) y quién dibuja (acabado). Si uno falla o se le acaba la cuota, se prueba el siguiente.
// Todo lo que usa IA en Arnés tiene también un camino sin IA.

export const PROVIDERS = {
  gemini: { label: "Google Gemini", kind: "gemini", keyUrl: "https://aistudio.google.com/apikey", read: "gemini-3.5-flash-lite", image: "gemini-3.1-flash-image", note: "Lee gratis con límite diario. Dibujar (acabado) pide activar la facturación." },
  openrouter: { label: "OpenRouter", kind: "openai", base: "https://openrouter.ai/api/v1", keyUrl: "https://openrouter.ai/keys", read: "google/gemini-2.5-flash", image: "google/gemini-2.5-flash-image", note: "Una sola clave para cientos de modelos (Gemini, Claude, GPT, Llama…). Tiene modelos gratis marcados «:free» para leer." },
  openai: { label: "OpenAI", kind: "openai", base: "https://api.openai.com/v1", keyUrl: "https://platform.openai.com/api-keys", read: "gpt-4.1-mini", image: "gpt-image-1", note: "Lee y dibuja. Se paga por uso." },
  anthropic: { label: "Anthropic Claude", kind: "anthropic", keyUrl: "https://console.anthropic.com/settings/keys", read: "claude-sonnet-5-5", image: "", note: "Lee páginas y viñetas con mucho detalle. No dibuja imágenes." },
  groq: { label: "Groq", kind: "openai", base: "https://api.groq.com/openai/v1", keyUrl: "https://console.groq.com/keys", read: "meta-llama/llama-4-scout-17b-16e-instruct", image: "", note: "Muy rápido, con nivel gratis. Solo lee." },
  mistral: { label: "Mistral", kind: "openai", base: "https://api.mistral.ai/v1", keyUrl: "https://console.mistral.ai/api-keys", read: "pixtral-large-latest", image: "", note: "Lee imágenes. Tiene nivel gratis para pruebas." },
  xai: { label: "xAI Grok", kind: "openai", base: "https://api.x.ai/v1", keyUrl: "https://console.x.ai", read: "grok-4", image: "", note: "Lee imágenes. Se paga por uso." },
  propio: { label: "Otro compatible con OpenAI", kind: "openai", base: "http://localhost:1234/v1", keyUrl: "", read: "", image: "", note: "Cualquier servicio con la API de OpenAI: LM Studio u Ollama en tu computadora, Together, DeepSeek… Escribe su dirección y el modelo." },
};
export const ROLES = { leer: "Leer (páginas, viñetas, calibrar)", dibujar: "Dibujar (acabado con IA)" };

const KEY = "arnes-ai2";
export function aiConfig() {
  let c = null;
  try { c = JSON.parse(localStorage.getItem(KEY) || "null"); } catch {}
  if (!c) {
    c = { services: [], order: { leer: [], dibujar: [] } };
    try { // lo que ya tenías de Gemini se conserva
      const old = JSON.parse(localStorage.getItem("arnes-ai") || "{}");
      if (old.key) { c.services.push({ id: "gemini", provider: "gemini", key: old.key, read: old.model || PROVIDERS.gemini.read, image: old.imageModel || PROVIDERS.gemini.image, on: { leer: true, dibujar: true } }); c.order = { leer: ["gemini"], dibujar: ["gemini"] }; }
    } catch {}
  }
  return c;
}
export function saveAiConfig(c) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch {} }
export function service(c, id) { return c.services.find(s => s.id === id); }
export function upsertService(c, provider) {
  let s = service(c, provider);
  if (!s) { const P = PROVIDERS[provider]; s = { id: provider, provider, key: "", base: P.base || "", read: P.read, image: P.image, on: { leer: !!P.read, dibujar: !!P.image } }; c.services.push(s); for (const r of Object.keys(ROLES)) if (s.on[r] && !c.order[r].includes(s.id)) c.order[r].push(s.id); }
  return s;
}
// Servicios listos para un papel, en el orden elegido
export function chain(role, c = aiConfig()) {
  const ids = [...c.order[role], ...c.services.map(s => s.id).filter(id => !c.order[role].includes(id))];
  return ids.map(id => service(c, id)).filter(s => s && s.on?.[role] && (s.key || s.provider === "propio") && (role === "leer" ? s.read : s.image));
}
export const aiReady = role => chain(role).length > 0;

const split = u => { const m = /^data:([^;]+);base64,(.*)$/.exec(u); return m ? { mime: m[1], data: m[2] } : { mime: "image/jpeg", data: u }; };
const parseJSON = txt => { try { return JSON.parse(String(txt).replace(/^[\s\S]*?```(json)?|```[\s\S]*$/g, "").trim() || txt); } catch { try { const a = txt.indexOf("{"), b = txt.lastIndexOf("}"); return JSON.parse(txt.slice(a, b + 1)); } catch { return null; } } };
class AiError extends Error { constructor(msg, kind) { super(msg); this.kind = kind; } }
function fail(s, r, j) {
  const name = PROVIDERS[s.provider]?.label || s.provider, raw = (j?.error?.message || j?.error || j?.message || "").toString().slice(0, 160);
  if (r.status === 401 || r.status === 403 || (r.status === 400 && /api.?key|auth/i.test(raw))) return new AiError(`${name} no aceptó la clave.`, "clave");
  if (r.status === 402 || r.status === 429 || /quota|limit: 0|credits|billing/i.test(raw)) return new AiError(`${name}: sin cuota o sin saldo por ahora${raw ? " (" + raw + ")" : ""}.`, "cuota");
  if (r.status === 404) return new AiError(`${name} no encontró el modelo. Revísalo en Servicios de IA.`, "modelo");
  return new AiError(`${name} no respondió${raw ? ": " + raw : " (" + r.status + ")"}.`, "otro");
}

async function readOne(s, images, prompt) {
  const P = PROVIDERS[s.provider];
  if (P.kind === "gemini") {
    const parts = [...images.map(u => { const x = split(u); return { inline_data: { mime_type: x.mime, data: x.data } }; }), { text: prompt }];
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.read)}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": s.key }, body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseMimeType: "application/json" } }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw fail(s, r, j);
    return j.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  }
  if (P.kind === "anthropic") {
    const content = [...images.map(u => { const x = split(u); return { type: "image", source: { type: "base64", media_type: x.mime, data: x.data } }; }), { type: "text", text: prompt + "\nResponde únicamente con el JSON." }];
    const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": s.key, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" }, body: JSON.stringify({ model: s.read, max_tokens: 4096, messages: [{ role: "user", content }] }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw fail(s, r, j);
    return (j.content || []).map(p => p.text || "").join("");
  }
  // compatible con OpenAI
  const base = (s.base || P.base).replace(/\/$/, "");
  const content = [{ type: "text", text: prompt }, ...images.map(u => ({ type: "image_url", image_url: { url: u } }))];
  const body = { model: s.read, messages: [{ role: "user", content }], response_format: { type: "json_object" } };
  const headers = { "Content-Type": "application/json", ...(s.key ? { Authorization: "Bearer " + s.key } : {}), ...(s.provider === "openrouter" ? { "HTTP-Referer": location.origin, "X-Title": "Arnes" } : {}) };
  let r = await fetch(base + "/chat/completions", { method: "POST", headers, body: JSON.stringify(body) });
  let j = await r.json().catch(() => ({}));
  if (r.status === 400 && /response_format|json/i.test(JSON.stringify(j))) { delete body.response_format; r = await fetch(base + "/chat/completions", { method: "POST", headers, body: JSON.stringify(body) }); j = await r.json().catch(() => ({})); }
  if (!r.ok) throw fail(s, r, j);
  const c = j.choices?.[0]?.message?.content; return Array.isArray(c) ? c.map(p => p.text || "").join("") : c || "";
}

async function drawOne(s, parts) {
  const P = PROVIDERS[s.provider], images = parts.filter(p => p.image).map(p => p.image), text = parts.filter(p => p.text).map(p => p.text).join("\n");
  if (P.kind === "gemini") {
    const gp = parts.map(p => p.image ? (x => ({ inline_data: { mime_type: x.mime, data: x.data } }))(split(p.image)) : { text: p.text });
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(s.image)}:generateContent`, { method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": s.key }, body: JSON.stringify({ contents: [{ role: "user", parts: gp }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }) });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw fail(s, r, j);
    const img = j.candidates?.[0]?.content?.parts?.find(p => p.inline_data || p.inlineData), d = img && (img.inline_data || img.inlineData);
    if (!d) throw new AiError("Gemini respondió sin imagen.", "otro");
    return `data:${d.mime_type || d.mimeType || "image/png"};base64,${d.data}`;
  }
  const base = (s.base || P.base).replace(/\/$/, ""), auth = s.key ? { Authorization: "Bearer " + s.key } : {};
  if (s.provider === "openai") { // edición de imagen con referencias
    const fd = new FormData(); fd.append("model", s.image); fd.append("prompt", text); fd.append("size", "auto");
    for (const [i, u] of images.entries()) fd.append("image[]", await (await fetch(u)).blob(), `ref${i}.png`);
    const r = await fetch(base + "/images/edits", { method: "POST", headers: auth, body: fd });
    const j = await r.json().catch(() => ({})); if (!r.ok) throw fail(s, r, j);
    const b = j.data?.[0]?.b64_json; if (!b) throw new AiError("OpenAI respondió sin imagen.", "otro");
    return "data:image/png;base64," + b;
  }
  // OpenRouter y otros: chat con salida de imagen
  const content = parts.map(p => p.image ? { type: "image_url", image_url: { url: p.image } } : { type: "text", text: p.text });
  const r = await fetch(base + "/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", ...auth, ...(s.provider === "openrouter" ? { "HTTP-Referer": location.origin, "X-Title": "Arnes" } : {}) }, body: JSON.stringify({ model: s.image, modalities: ["image", "text"], messages: [{ role: "user", content }] }) });
  const j = await r.json().catch(() => ({})); if (!r.ok) throw fail(s, r, j);
  const url = j.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new AiError(`${PROVIDERS[s.provider].label} respondió sin imagen; ese modelo quizá no dibuja.`, "otro");
  return url;
}

// Pregunta con imágenes y espera JSON. Prueba la cadena de servicios en orden
export async function askJSON(images, prompt, { role = "leer", onTry } = {}) {
  const list = chain(role), errs = [];
  if (!list.length) throw new AiError("No hay servicio de IA para leer. Ábrelo en «Servicios de IA».", "sin");
  for (const s of list) {
    onTry?.(PROVIDERS[s.provider].label);
    try { const txt = await readOne(s, images, prompt), o = parseJSON(txt); if (o) return { json: o, via: PROVIDERS[s.provider].label }; errs.push(`${PROVIDERS[s.provider].label} respondió algo que no se pudo leer.`); }
    catch (e) { errs.push(e.message || String(e)); }
  }
  throw new AiError(errs.join(" "), "todos");
}
export async function askImage(parts, { onTry } = {}) {
  const list = chain("dibujar"), errs = [];
  if (!list.length) throw new AiError("No hay servicio de IA que dibuje. Ábrelo en «Servicios de IA».", "sin");
  for (const s of list) {
    onTry?.(PROVIDERS[s.provider].label);
    try { return { url: await drawOne(s, parts), via: PROVIDERS[s.provider].label }; }
    catch (e) { errs.push(e.message || String(e)); }
  }
  throw new AiError(errs.join(" "), "todos");
}
// Prueba corta de un servicio (sin imagen)
export async function testService(s) {
  const txt = await readOne(s, [], 'Responde solo este JSON: {"ok": true}');
  if (!parseJSON(txt)?.ok) throw new Error("Respondió, pero no con el formato esperado.");
  return true;
}
