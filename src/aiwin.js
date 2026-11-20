// Ventana «Servicios de IA»: una ficha por servicio con el enlace para sacar la clave, qué hace cada uno,
// sus modelos, y el orden en que Arnés los prueba para leer y para dibujar.
import { PROVIDERS, ROLES, aiConfig, saveAiConfig, upsertService, service, testService } from "./ai.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
let root = null, status = {};
export function openAiWindow(onChange) {
  root ??= Object.assign(document.createElement("div"), { id: "aiwin", className: "modal" });
  if (!root.isConnected) document.body.appendChild(root);
  const draw = () => {
    const c = aiConfig();
    const order = role => c.order[role].map(id => service(c, id)).filter(s => s && s.on?.[role]);
    root.innerHTML = `<div class="sheetbox" role="dialog" aria-modal="true" aria-label="Servicios de IA">
      <div class="row between"><h2>Servicios de IA</h2><button class="btn" data-w="close">Listo</button></div>
      <p class="sub">Elige quién lee tus páginas y viñetas, y quién dibuja el acabado. Las claves se guardan solo en este dispositivo y cada uso lo paga la cuenta de ese servicio. Si uno falla o se queda sin cuota, Arnés prueba el siguiente. Todo lo de IA tiene también un camino sin IA.</p>
      ${Object.entries(ROLES).map(([r, l]) => `<h3>${l}</h3>${order(r).length ? `<ol class="ailist">${order(r).map((s, i) => `<li>${esc(PROVIDERS[s.provider].label)} · <code>${esc(r === "leer" ? s.read : s.image)}</code> <span class="row">${i ? `<button class="btn" data-w="up" data-r="${r}" data-id="${s.id}" aria-label="Subir">↑</button>` : ""}</span></li>`).join("")}</ol>` : `<p class="sub">Ninguno todavía.</p>`}`).join("")}
      <h3>Servicios</h3>
      ${Object.entries(PROVIDERS).map(([pid, P]) => {
        const s = service(c, pid), st = status[pid];
        return `<details class="card"${s ? " open" : ""}><summary><b>${esc(P.label)}</b>${s?.key || (s && pid === "propio") ? " · listo" : ""}</summary>
          <p class="sub">${esc(P.note)}${P.keyUrl ? ` <a href="${P.keyUrl}" target="_blank" rel="noopener">Sacar la clave aquí</a>.` : ""}</p>
          <label class="fld"><span>Clave</span><input class="text" type="password" autocomplete="off" data-w="key" data-id="${pid}" value="${esc(s?.key || "")}" placeholder="${pid === "propio" ? "Si tu servicio la pide" : "Pégala aquí"}"></label>
          ${P.kind === "openai" ? `<label class="fld"><span>Dirección de la API</span><input class="text" data-w="base" data-id="${pid}" value="${esc(s?.base || P.base || "")}"></label>` : ""}
          <label class="fld"><span>Modelo para leer</span><input class="text" data-w="read" data-id="${pid}" value="${esc(s?.read ?? P.read)}" placeholder="${P.read ? "" : "Sin lectura"}"></label>
          <label class="fld"><span>Modelo para dibujar</span><input class="text" data-w="image" data-id="${pid}" value="${esc(s?.image ?? P.image)}" placeholder="${P.image ? "" : "Este servicio no dibuja"}"></label>
          ${s ? `<div class="row"><label class="sel"><input type="checkbox" data-w="on" data-r="leer" data-id="${pid}" ${s.on?.leer ? "checked" : ""}> Usar para leer</label><label class="sel"><input type="checkbox" data-w="on" data-r="dibujar" data-id="${pid}" ${s.on?.dibujar ? "checked" : ""}> Usar para dibujar</label></div>
          <div class="row"><button class="btn" data-w="test" data-id="${pid}">Probar</button><button class="btn danger" data-w="del" data-id="${pid}">Quitar</button>${st ? `<span class="sub">${esc(st)}</span>` : ""}</div>` : ""}
          <p class="sub">Los nombres de modelo cambian con el tiempo: si el servicio dice que no existe, copia el nombre actual de su página.</p>
        </details>`;
      }).join("")}
    </div>`;
  };
  const save = c => { saveAiConfig(c); onChange?.(); };
  root.onclick = async e => {
    if (e.target === root) { close(); return; }
    const b = e.target.closest("[data-w]"); if (!b || b.tagName === "INPUT") return;
    const c = aiConfig(), id = b.dataset.id;
    if (b.dataset.w === "close") { close(); return; }
    if (b.dataset.w === "up") { const L = c.order[b.dataset.r], i = L.indexOf(id); if (i > 0) { [L[i - 1], L[i]] = [L[i], L[i - 1]]; save(c); } }
    if (b.dataset.w === "del") { c.services = c.services.filter(s => s.id !== id); for (const r of Object.keys(ROLES)) c.order[r] = c.order[r].filter(x => x !== id); save(c); delete status[id]; }
    if (b.dataset.w === "test") { status[id] = "Probando…"; draw(); try { await testService(service(c, id)); status[id] = "Funciona."; } catch (err) { status[id] = err.message; } }
    draw();
  };
  root.onchange = e => {
    const el = e.target, w = el.dataset.w, id = el.dataset.id; if (!w) return;
    const c = aiConfig(), s = upsertService(c, id);
    if (w === "on") { s.on[el.dataset.r] = el.checked; const L = c.order[el.dataset.r]; if (el.checked && !L.includes(id)) L.push(id); if (!el.checked) c.order[el.dataset.r] = L.filter(x => x !== id); }
    else s[w] = el.value.trim();
    save(c); draw();
  };
  const close = () => { root.remove(); onChange?.(); };
  draw();
}
