// Comunidad (Fase 6, bloque 3): galería, perfil público, publicaciones de cada artista,
// «me gusta», reportes y «usar en Arnés» o «mezclar» (solo si el autor lo permite).
const KIND_ONE = { estilo: "Estilo", personaje: "Personaje", criatura: "Criatura", objeto: "Objeto", escenario: "Escenario", vineta: "Viñeta", pagina: "Página" };
const USE_LABEL = { estilo: "Agregar a mis estilos", personaje: "Agregar a mis personajes", criatura: "Poner en mi viñeta", objeto: "Poner en mi viñeta", escenario: "Poner en mi viñeta", vineta: "Agregar a mi proyecto", pagina: "Abrir como proyecto nuevo" };

export function createCommunity({ el, cloud, esc, back, toLogin, importItem }) {
  let active = false, view = "galeria", msg = "", busy = false;
  let filt = { kind: "", q: "", order: "nuevo" }, items = [], authors = {}, liked = new Set(), more = false;
  let cur = null, curAuthor = null, me = null, mine = [], reporting = false, delAsk = null;
  const when = t => new Date(t).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" });
  const head = `<div class="home-h"><span class="wordmark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="4.5" r="2.5"/><path d="M12 7v7M12 14l-4 7M12 14l4 7M5 10l7-1 7 1"/></svg><span>ARNÉS</span></span></div>`;
  const avatar = (a, size = 36) => a?.avatar ? `<img class="cav" src="${esc(a.avatar)}" alt="" width="${size}" height="${size}">` : `<span class="cav cav-0" style="width:${size}px;height:${size}px">${esc((a?.display_name || a?.username || "?").slice(0, 1).toUpperCase())}</span>`;
  const byline = a => a ? `<button class="linkbtn" data-c="author" data-id="${esc(a.username)}">@${esc(a.username)}</button>` : `<span class="sub">artista sin perfil</span>`;

  async function open(go) {
    active = true; msg = ""; reporting = false; delAsk = null;
    if (go === "perfil") { view = "perfil"; await loadMine(); }
    else if (go?.pub) { view = "detalle"; await loadPub(go.pub); }
    else if (go?.user) { view = "autor"; await loadAuthor(go.user); }
    else { view = "galeria"; await loadGallery(); }
    draw();
  }
  async function loadGallery(append = false) {
    busy = true; if (!append) { items = []; draw(); }
    try {
      const page = await cloud.gallery({ ...filt, offset: append ? items.length : 0, limit: 24, author: view === "autor" ? curAuthor?.user_id : "" });
      items = append ? [...items, ...page] : page; more = page.length === 24;
      Object.assign(authors, await cloud.profilesByIds([...new Set(page.map(x => x.user_id))].filter(id => !authors[id])));
      liked = await cloud.myLikes(items.map(x => x.id)).catch(() => new Set());
    } catch (e) { msg = e.message; }
    busy = false;
  }
  async function loadPub(id) {
    cur = null;
    try { cur = await cloud.publication(id); if (!cur) msg = "Esa publicación ya no existe o la ocultaron por reportes."; else { Object.assign(authors, await cloud.profilesByIds([cur.user_id])); liked = await cloud.myLikes([cur.id]).catch(() => new Set()); } }
    catch (e) { msg = e.message; }
  }
  async function loadAuthor(name) {
    try { curAuthor = await cloud.profileByName(name); if (!curAuthor) { msg = "No hay ningún artista con ese nombre de usuario."; items = []; return; } authors[curAuthor.user_id] = curAuthor; await loadGallery(); }
    catch (e) { msg = e.message; }
  }
  async function loadMine() {
    if (!cloud.user()) { msg = "Entra a tu cuenta para tener perfil y publicar."; me = null; mine = []; return; }
    try { me = await cloud.myPublic(); mine = await cloud.gallery({ author: cloud.user().id, limit: 100 }); } catch (e) { msg = e.message; }
  }

  function cards(list) {
    if (!list.length) return `<p class="empty">${busy ? "Cargando…" : "Todavía no hay publicaciones aquí."}</p>`;
    return `<ul class="cgrid">${list.map(x => { const a = authors[x.user_id]; return `<li class="ccard"><button class="cmain" data-c="open" data-id="${x.id}">
      ${x.thumb ? `<img src="${esc(x.thumb)}" alt="" loading="lazy">` : `<span class="cnothumb">${KIND_ONE[x.kind]}</span>`}
      <strong>${esc(x.title)}</strong><small>${KIND_ONE[x.kind]} · ${a ? "@" + esc(a.username) : "—"} · ♥ ${x.likes}${x.remix === "si" ? " · se puede mezclar" : ""}${x.visibility === "enlace" ? " · solo con enlace" : ""}</small></button></li>`; }).join("")}</ul>`;
  }
  function draw() {
    if (!active) return;
    const top = `<div class="row"><button class="btn" data-c="back">← Mis proyectos</button>${view !== "galeria" ? `<button class="btn" data-c="gallery">Galería</button>` : ""}${cloud.user() && view !== "perfil" ? `<button class="btn" data-c="profile">Mi perfil</button>` : ""}${!cloud.user() ? `<button class="btn accent" data-c="login">Entrar para publicar</button>` : ""}</div>`;
    let h = `<div class="home-in">${head}${top}`;
    if (view === "galeria") {
      h += `<h2>Galería</h2><p class="sub">Estilos, personajes, criaturas, objetos, escenarios, viñetas y páginas que otros artistas compartieron. Úsalos en tus viñetas; si el autor lo permite, también puedes mezclarlos y publicar tu versión con su crédito.</p>
        <div class="pills"><button class="pill${!filt.kind ? " on" : ""}" data-c="kind" data-id="">Todo</button>${Object.entries(cloud.PUB_KINDS).map(([k, l]) => `<button class="pill${filt.kind === k ? " on" : ""}" data-c="kind" data-id="${k}">${l}</button>`).join("")}</div>
        <form class="row" data-c="search"><input class="text" id="c-q" placeholder="Buscar por título" value="${esc(filt.q)}" aria-label="Buscar"><button class="btn" type="submit">Buscar</button></form>
        <div class="pills"><span class="pl">Orden</span><button class="pill${filt.order === "nuevo" ? " on" : ""}" data-c="order" data-id="nuevo">Lo más nuevo</button><button class="pill${filt.order === "popular" ? " on" : ""}" data-c="order" data-id="popular">Lo que más gusta</button></div>
        <p class="hmsg" role="status">${esc(msg)}</p>${cards(items)}${more ? `<div class="row"><button class="btn" data-c="more">Ver más</button></div>` : ""}`;
    } else if (view === "autor") {
      const a = curAuthor;
      h += a ? `<div class="cprof">${avatar(a, 72)}<div><h2>${esc(a.display_name || a.username)}</h2><p class="sub">@${esc(a.username)} · en Arnés desde ${when(a.created_at)}</p>${a.bio ? `<p>${esc(a.bio)}</p>` : ""}<button class="btn" data-c="copy" data-id="${esc(location.origin + location.pathname)}#u=${esc(a.username)}">Copiar enlace a su perfil</button></div></div>` : "";
      h += `<p class="hmsg" role="status">${esc(msg)}</p>${a ? cards(items) : ""}`;
    } else if (view === "detalle") {
      const x = cur, a = x && authors[x.user_id], own = x && cloud.user()?.id === x.user_id;
      h += `<p class="hmsg" role="status">${esc(msg)}</p>`;
      if (x) h += `<article class="cdet">${x.thumb ? `<img src="${esc(x.thumb)}" alt="">` : ""}
        <h2>${esc(x.title)}</h2><p class="sub">${KIND_ONE[x.kind]} · ${when(x.created_at)} · ♥ ${x.likes}${x.hidden ? " · oculta por reportes (solo tú la ves)" : ""}</p>
        <div class="cby">${avatar(a)}<span>${a ? esc(a.display_name || a.username) : ""} ${byline(a)}</span></div>
        ${x.description ? `<p>${esc(x.description)}</p>` : ""}
        ${x.remix_of ? `<p class="sub">Es una mezcla de <button class="linkbtn" data-c="open" data-id="${x.remix_of}">otra publicación</button>.</p>` : ""}
        <p class="sub">${x.remix === "si" ? "El autor permite mezclarla: puedes cambiarla y publicar tu versión; Arnés guarda el crédito." : "El autor permite usarla en tus viñetas, no publicar versiones propias."}</p>
        <div class="row"><button class="btn accent" data-c="use">${USE_LABEL[x.kind]}</button>${x.remix === "si" ? `<button class="btn" data-c="remix">Mezclar y publicar mi versión</button>` : ""}</div>
        <div class="row"><button class="btn" data-c="like">${liked.has(x.id) ? "♥ Te gusta" : "♡ Me gusta"}</button><button class="btn" data-c="copy" data-id="${esc(location.origin + location.pathname)}#pub=${x.id}">Copiar enlace</button>${!own && cloud.user() ? `<button class="btn" data-c="report">Reportar</button>` : ""}</div>
        ${reporting ? `<form class="hform" data-c="report-send"><label class="fld"><span>¿Qué está mal? (lo revisa el administrador)</span><textarea class="text" id="c-reason" maxlength="500" required></textarea></label><div class="row"><button class="btn danger" type="submit">Enviar reporte</button><button class="btn" type="button" data-c="report-no">Cancelar</button></div></form>` : ""}
      </article>`;
    } else if (view === "perfil") {
      h += `<h2>Mi perfil</h2><p class="hmsg" role="status">${esc(msg)}</p>`;
      if (cloud.user()) {
        h += `<form class="hform" data-c="save-profile">
          <div class="cby">${avatar(me, 64)}<label class="btn filebtn">Cambiar foto<input type="file" id="c-avatar" accept="image/*" hidden></label></div>
          <label class="fld"><span>Nombre de usuario (3 a 24: letras minúsculas, números, punto o guion bajo)</span><input id="c-user" required pattern="[a-z0-9_.]{3,24}" value="${esc(me?.username || "")}" autocomplete="username"></label>
          <label class="fld"><span>Nombre que se muestra</span><input id="c-name" maxlength="60" value="${esc(me?.display_name || "")}"></label>
          <label class="fld"><span>Sobre ti</span><textarea class="text" id="c-bio" maxlength="400">${esc(me?.bio || "")}</textarea></label>
          <p class="sub">Tu correo (${esc(cloud.user().email)}) no se muestra a nadie.</p>
          <div class="row"><button class="btn accent" type="submit" ${busy ? "disabled" : ""}>Guardar perfil</button>${me ? `<button class="btn" type="button" data-c="author" data-id="${esc(me.username)}">Ver mi página pública</button>` : ""}</div></form>
          <h3>Mis publicaciones (${mine.length})</h3><p class="sub">Para publicar, usa «Compartir» en un estilo, personaje, criatura, objeto, escenario, viñeta o página dentro de Arnés.</p>
          <ul class="plist">${mine.map(x => `<li class="pcard"><button class="pmain" data-c="open" data-id="${x.id}"><strong>${esc(x.title)}</strong><small>${KIND_ONE[x.kind]} · ♥ ${x.likes} · ${x.visibility === "publico" ? "en la galería" : "solo con enlace"} · ${x.remix === "si" ? "se puede mezclar" : "sin mezclas"}</small></button>
            ${delAsk === x.id ? `<span class="pconf">¿Borrar «${esc(x.title)}»? <button class="btn danger" data-c="del-yes" data-id="${x.id}">Borrar</button><button class="btn" data-c="del-no">Conservar</button></span>`
              : `<span class="pacts"><button class="btn" data-c="vis" data-id="${x.id}">${x.visibility === "publico" ? "Solo con enlace" : "Mostrar en la galería"}</button><button class="btn" data-c="remixok" data-id="${x.id}">${x.remix === "si" ? "No permitir mezclas" : "Permitir mezclas"}</button><button class="btn" data-c="del" data-id="${x.id}">Borrar</button></span>`}</li>`).join("")}</ul>`;
      }
    }
    el.innerHTML = h + `</div>`;
  }

  async function act(c, id, form) {
    msg = "";
    try {
      if (c === "back") { active = false; return back(); }
      if (c === "login") { active = false; return toLogin(); }
      if (c === "gallery") { view = "galeria"; await loadGallery(); return draw(); }
      if (c === "profile") { view = "perfil"; await loadMine(); return draw(); }
      if (c === "kind") { filt.kind = id; await loadGallery(); return draw(); }
      if (c === "order") { filt.order = id; await loadGallery(); return draw(); }
      if (c === "search") { filt.q = el.querySelector("#c-q").value.trim(); await loadGallery(); return draw(); }
      if (c === "more") { await loadGallery(true); return draw(); }
      if (c === "open") { view = "detalle"; reporting = false; await loadPub(id); return draw(); }
      if (c === "author") { view = "autor"; await loadAuthor(id); return draw(); }
      if (c === "copy") { try { await navigator.clipboard.writeText(id); msg = "Enlace copiado."; } catch { msg = id; } return draw(); }
      if (c === "like") {
        if (!cloud.user()) { msg = "Entra a tu cuenta para dar «me gusta»."; return draw(); }
        const on = !liked.has(cur.id); await cloud.like(cur.id, on); if (on) liked.add(cur.id); else liked.delete(cur.id); cur.likes = Math.max(0, cur.likes + (on ? 1 : -1)); return draw();
      }
      if (c === "report") { reporting = true; return draw(); }
      if (c === "report-no") { reporting = false; return draw(); }
      if (c === "report-send") { await cloud.report(cur.id, el.querySelector("#c-reason").value); reporting = false; msg = "Gracias: tu reporte quedó enviado."; return draw(); }
      if (c === "use" || c === "remix") { active = false; return importItem(cur, c); }
      if (c === "save-profile") {
        const username = el.querySelector("#c-user").value.trim().toLowerCase();
        if (!/^[a-z0-9_.]{3,24}$/.test(username)) { msg = "El nombre de usuario lleva de 3 a 24 letras minúsculas, números, punto o guion bajo."; return draw(); }
        if (!(await cloud.usernameFree(username))) { msg = "Ese nombre de usuario ya lo tiene alguien más."; return draw(); }
        me = await cloud.savePublic({ ...(me || {}), username, display_name: el.querySelector("#c-name").value, bio: el.querySelector("#c-bio").value });
        msg = "Perfil guardado."; return draw();
      }
      if (c === "vis" || c === "remixok") {
        const x = mine.find(m => m.id === id); if (!x) return;
        const patch = c === "vis" ? { visibility: x.visibility === "publico" ? "enlace" : "publico" } : { remix: x.remix === "si" ? "no" : "si" };
        await cloud.updatePublication(id, patch); Object.assign(x, patch); return draw();
      }
      if (c === "del") { delAsk = id; return draw(); }
      if (c === "del-no") { delAsk = null; return draw(); }
      if (c === "del-yes") { await cloud.deletePublication(id); mine = mine.filter(m => m.id !== id); delAsk = null; msg = "Publicación borrada."; return draw(); }
    } catch (e) { busy = false; msg = e.message || String(e); draw(); }
  }
  el.addEventListener("click", e => { if (!active) return; const b = e.target.closest("[data-c]"); if (!b || b.tagName === "FORM") return; e.preventDefault(); act(b.dataset.c, b.dataset.id); });
  el.addEventListener("submit", e => { if (!active) return; e.preventDefault(); act(e.target.dataset.c); });
  el.addEventListener("change", async e => {
    if (!active || e.target.id !== "c-avatar") return;
    const f = e.target.files[0]; if (!f) return;
    try {
      const bmp = await createImageBitmap(f), k = 256 / Math.min(bmp.width, bmp.height), c = document.createElement("canvas"); c.width = c.height = 256;
      c.getContext("2d").drawImage(bmp, (256 - bmp.width * k) / 2, (256 - bmp.height * k) / 2, bmp.width * k, bmp.height * k);
      me = { ...(me || {}), avatar: c.toDataURL("image/jpeg", 0.82) };
      if (me.username) { me = await cloud.savePublic(me); msg = "Foto guardada."; } else msg = "Escribe tu nombre de usuario y guarda el perfil para conservar la foto.";
    } catch (err) { msg = err.message || "No se pudo abrir esa imagen."; }
    draw();
  });
  return { open, draw, get active() { return active; } };
}
