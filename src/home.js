// Pantalla de inicio: entrar (nube) → mis proyectos → área de diseño
import * as cloud from "./cloud.js";
import { escapeHtml as esc, uid } from "./util.js";

export function createHome({ store, onOpen, makeExample, makeBlank, onLogin }) {
  const el = document.createElement("div");
  el.id = "home"; el.hidden = true; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Mis proyectos");
  document.body.appendChild(el);
  let screen = "projects", busy = false, msg = "", confirmDel = null, confirmAcct = false, remote = [], lastEmail = "";
  const skipped = () => sessionStorage.getItem("arnes-offline") === "1";

  async function show(note = "") {
    if (note) msg = note;
    el.hidden = false; document.body.classList.add("home-open");
    screen = cloud.configured() && !cloud.user() && !skipped() ? "login" : "projects";
    if (note && !cloud.user() && cloud.configured()) screen = "login";
    await draw();
  }
  function hide() { el.hidden = true; document.body.classList.remove("home-open"); }

  const when = t => {
    const d = (Date.now() - t) / 60000;
    if (d < 1) return "hace un momento"; if (d < 60) return `hace ${Math.round(d)} min`;
    if (d < 1440) return `hace ${Math.round(d / 60)} h`;
    return new Date(t).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  };

  async function draw() {
    const head = `<div class="home-h"><span class="wordmark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="4.5" r="2.5"/><path d="M12 7v7M12 14l-4 7M12 14l4 7M5 10l7-1 7 1"/></svg><span>ARNÉS</span></span></div>`;
    if (screen === "login") {
      el.innerHTML = `<div class="home-in">${head}
        <h2>Entra para guardar en la nube</h2>
        <p class="sub">Tus proyectos se sincronizan entre teléfono, tableta y computadora.</p>
        <form id="h-login" class="hform">
          <label class="fld"><span>Correo</span><input type="email" id="h-email" autocomplete="email" required value="${esc(lastEmail)}"></label>
          <label class="fld"><span>Contraseña</span><input type="password" id="h-pw" autocomplete="current-password" minlength="6" required></label>
          <p class="hmsg" role="status">${esc(msg)}</p>
          <div class="row"><button class="btn accent" type="submit" data-h="in" ${busy ? "disabled" : ""}>Entrar</button><button class="btn" type="button" data-h="up" ${busy ? "disabled" : ""}>Crear cuenta</button></div>
        </form>
        <div class="oauth"><span class="sub">o</span><button class="btn fb" data-h="fb" ${busy ? "disabled" : ""}><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5H16.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21z"/></svg>Entrar con Facebook</button></div>
        <button class="linkbtn" data-h="offline">Usar sin cuenta, solo en este dispositivo</button></div>`;
      return;
    }
    const list = await store.list();
    const u = cloud.user();
    if (u && !busy) { try { remote = await cloud.listRemote() || []; } catch { remote = []; } }
    const localIds = new Set(list.map(e => e.id));
    const onlyCloud = remote.filter(r => !localIds.has(r.id));
    const cur = store.project?.id;
    el.innerHTML = `<div class="home-in">${head}
      <div class="home-bar"><h2>Mis proyectos</h2>
        <span class="acct">${cloud.configured() ? (u ? `${esc(u.email)} · <button class="linkbtn" data-h="out">Salir</button> · <button class="linkbtn" data-h="delacct">Borrar mi cuenta</button>` : `<button class="linkbtn" data-h="login">Entrar a la nube</button>`) : `<small>Guardado en este dispositivo${cloud.reachable() ? "" : " · la nube funciona en la versión de GitHub Pages"}</small>`}</span></div>
      <div class="row"><button class="btn accent" data-h="new">Nuevo proyecto</button><button class="btn" data-h="example">Abrir el ejemplo</button>${cur ? `<button class="btn" data-h="back">Volver al que tenía abierto</button>` : ""}</div>
      ${confirmAcct ? `<p class="pconf">¿Borrar tu cuenta y todo lo que guardaste en la nube (proyectos, poses, personajes y estilos)? Lo guardado en este dispositivo se queda. <button class="btn danger" data-h="delacct-yes">Borrar mi cuenta</button><button class="btn" data-h="delacct-no">Conservar mi cuenta</button></p>` : ""}
      <p class="hmsg" role="status">${esc(msg)}</p>
      <ul class="plist">${list.map(e => `<li class="pcard${e.id === cur ? " cur" : ""}">
        <button class="pmain" data-h="open" data-id="${e.id}"><strong>${esc(e.name)}</strong><small>${e.vinetas} viñeta${e.vinetas === 1 ? "" : "s"}${e.pages ? ` · ${e.pages} página${e.pages === 1 ? "" : "s"}` : ""} · ${when(e.updated)}${(() => { const r = remote.find(x => x.id === e.id); return !u ? "" : !r ? " · solo en este dispositivo" : Date.parse(r.updated_at) > e.updated + 2000 ? " · hay una versión más nueva en la nube" : " · en la nube"; })()}</small></button>
        ${confirmDel === e.id
          ? `<span class="pconf">¿Borrar «${esc(e.name)}»? <button class="btn danger" data-h="del-yes" data-id="${e.id}">Borrar «${esc(e.name)}»</button><button class="btn" data-h="del-no">Conservar</button></span>`
          : `<span class="pacts"><button class="btn" data-h="rename" data-id="${e.id}">Renombrar</button><button class="btn" data-h="dup" data-id="${e.id}">Duplicar</button><button class="btn" data-h="del" data-id="${e.id}">Borrar</button></span>`}
      </li>`).join("")}${onlyCloud.map(r => `<li class="pcard cloud"><button class="pmain" data-h="pull" data-id="${esc(r.id)}"><strong>${esc(r.name)}</strong><small>En la nube · ${r.vinetas} viñetas · ${when(Date.parse(r.updated_at))}</small></button></li>`).join("")}</ul>
      ${list.length || onlyCloud.length ? "" : `<p class="empty">Todavía no tienes proyectos. Empieza uno nuevo o abre el ejemplo para ver cómo funciona.</p>`}
    </div>`;
  }

  async function open(p) { hide(); msg = ""; await onOpen(p); }

  el.addEventListener("submit", e => { e.preventDefault(); act("in"); });
  el.addEventListener("click", e => { const b = e.target.closest("[data-h]"); if (b && b.dataset.h !== "in") act(b.dataset.h, b.dataset.id); });

  async function act(a, id) {
    msg = "";
    try {
      if (a === "in" || a === "up") {
        const email = el.querySelector("#h-email").value.trim(), pw = el.querySelector("#h-pw").value;
        lastEmail = email; // si algo falla, el correo no se borra
        if (!email || pw.length < 6) { msg = "Escribe tu correo y una contraseña de al menos 6 caracteres."; return draw(); }
        busy = true; draw();
        const u = a === "in" ? await cloud.signIn(email, pw) : await cloud.signUp(email, pw);
        busy = false;
        if (!u) { msg = "Te enviamos un correo para confirmar la cuenta. Ábrelo y luego entra aquí."; return draw(); }
        screen = "projects"; onLogin?.(); return draw();
      }
      if (a === "fb") { busy = true; draw(); location.href = cloud.oauthUrl("facebook"); return; }
      if (a === "offline") { sessionStorage.setItem("arnes-offline", "1"); screen = "projects"; return draw(); }
      if (a === "login") { screen = "login"; return draw(); }
      if (a === "delacct") { confirmAcct = true; return draw(); }
      if (a === "delacct-no") { confirmAcct = false; return draw(); }
      if (a === "delacct-yes") { confirmAcct = false; await cloud.deleteAccount(); remote = []; msg = "Tu cuenta y tus datos de la nube se borraron."; return draw(); }
      if (a === "out") { cloud.signOut(); remote = []; return draw(); }
      if (a === "back") return open(null);
      if (a === "new") return open(makeBlank());
      if (a === "example") return open(makeExample());
      if (a === "open") {
        if (id === store.project?.id) return open(null);
        let p = await store.readProject(id);
        const r = remote.find(x => x.id === id), local = (await store.list()).find(e => e.id === id);
        if (r && local && Date.parse(r.updated_at) > local.updated + 2000) {
          const newer = await cloud.pull(id).catch(() => null);
          if (newer) { p = newer; await store.writeProject(p); }
        }
        return open(p);
      }
      if (a === "pull") { const p = await cloud.pull(id); if (p) { await store.writeProject(p); return open(p); } }
      if (a === "dup") {
        const p = await store.readProject(id); p.id = uid("p"); p.name = p.name + " (copia)"; delete p.cloud;
        await store.writeProject(p); return draw();
      }
      if (a === "rename") {
        const p = id === store.project?.id ? store.project : await store.readProject(id);
        const name = prompt("Nombre del proyecto", p.name);
        if (name && name.trim()) { p.name = name.trim(); await store.writeProject(p); if (cloud.user()) cloud.push(p).catch(() => {}); }
        return draw();
      }
      if (a === "del") { confirmDel = id; return draw(); }
      if (a === "del-no") { confirmDel = null; return draw(); }
      if (a === "del-yes") {
        confirmDel = null; await store.removeProject(id);
        if (cloud.user()) cloud.removeRemote(id).catch(() => {});
        if (id === store.project?.id) { clearTimeout(store.saveTimer); store.project = null; } // no volver a guardarlo
        return draw();
      }
    } catch (e) { busy = false; msg = e.message || String(e); draw(); }
  }

  // Sincroniza en segundo plano después de cada guardado local
  let syncTimer = null;
  store.on(kind => {
    if (kind !== "saved" || !cloud.user()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => cloud.push(store.project).then(() => store.emit("synced")).catch(() => store.emit("sync-failed")), 2500);
  });

  return { show, hide };
}
