// Editor de página: formatos, viñetas de forma libre, insertos, globos, recorrido de lectura,
// aviso de cruce del eje, miniaturas del semirender y exportación de la página completa.
import * as THREE from "three";
import { uid, round, escapeHtml as esc } from "./util.js";
import { sceneFor, disposeScene, aspectOf } from "./scenes.js";
import { renderToBlob } from "./render.js";

export const FORMATS = {
  americano: { label: "Cómic americano", w: 168.3, h: 260.4 },
  carta: { label: "Carta", w: 215.9, h: 279.4 },
  a4: { label: "A4 (europeo)", w: 210, h: 297 },
  b5: { label: "Manga B5", w: 182, h: 257 },
};
// Plantillas: filas con alturas relativas, columnas e inclinación de las calles
export const TEMPLATES = {
  una: { label: "1 viñeta", rows: [[1, [1]]] },
  dos: { label: "2 filas", rows: [[1, [1]], [1, [1]]] },
  tres: { label: "3 filas", rows: [[1, [1]], [1, [1]], [1, [1]]] },
  cuatro: { label: "2 × 2", rows: [[1, [1, 1]], [1, [1, 1]]] },
  seis: { label: "3 × 2", rows: [[1, [1, 1]], [1, [1, 1]], [1, [1, 1]]] },
  referencia: { label: "Como tus páginas (5)", rows: [[0.85, [1]], [1, [1.1, 0.9]], [1, [0.9, 1.1]]], tilt: 14, split: 18 },
  diagonal: { label: "Diagonal (4)", rows: [[1, [1]], [1.1, [1, 1]], [0.9, [1]]], tilt: 22, split: 26 },
  tiras: { label: "Tiras verticales (3)", rows: [[1, [1, 1, 1]]], split: 10 },
};
export const BALLOONS = { globo: "Diálogo", pensamiento: "Pensamiento", grito: "Grito", caja: "Narración" };

export function newPage(n = 1, format = "americano") {
  const f = FORMATS[format];
  return { id: uid("pg"), name: `Página ${n}`, format, margin: 12, gutter: 4, tilt: 0, read: "occidental", panels: buildTemplate("tres", f.w, f.h, 12, 4, 0), balloons: [], guides: { order: true, thirds: false, axis: true } };
}

export function buildTemplate(key, W, H, m, g, tiltOverride) {
  const T = TEMPLATES[key];
  const tilt = tiltOverride ?? T.tilt ?? 0, split = T.split ?? 0;
  const x0 = m, x1 = W - m, y0 = m, y1 = H - m;
  const totalH = T.rows.reduce((a, r) => a + r[0], 0);
  // Líneas horizontales (con inclinación) entre filas: y = a + b·x
  const lines = [{ a: y0, b: 0 }];
  let acc = 0;
  T.rows.forEach((r, i) => {
    acc += r[0];
    if (i < T.rows.length - 1) {
      const yMid = y0 + (y1 - y0) * (acc / totalH), sl = (i % 2 ? -1 : 1) * tilt / (x1 - x0);
      lines.push({ a: yMid - sl * (x0 + x1) / 2, b: sl });
    }
  });
  lines.push({ a: y1, b: 0 });
  const yAt = (L, x) => L.a + L.b * x;
  const panels = [];
  T.rows.forEach((r, i) => {
    const top = lines[i], bot = lines[i + 1];
    const cols = r[1], tot = cols.reduce((a, c) => a + c, 0);
    let cx = 0;
    const edges = [x0];
    cols.forEach((c, k) => { cx += c; if (k < cols.length - 1) edges.push(x0 + (x1 - x0) * cx / tot); });
    edges.push(x1);
    for (let k = 0; k < cols.length; k++) {
      // Bordes verticales: inclinados si hay "split"
      const lx = edges[k], rx = edges[k + 1];
      const lt = k === 0 ? lx : lx + split / 2 + g / 2, lb = k === 0 ? lx : lx - split / 2 + g / 2;
      const rt = k === cols.length - 1 ? rx : rx + split / 2 - g / 2, rb = k === cols.length - 1 ? rx : rx - split / 2 - g / 2;
      const tg = i === 0 ? 0 : g / 2, bg = i === T.rows.length - 1 ? 0 : g / 2;
      panels.push({ id: uid("pn"), v: null, border: true, pts: [
        [round(lt, 2), round(yAt(top, lt) + tg, 2)], [round(rt, 2), round(yAt(top, rt) + tg, 2)],
        [round(rb, 2), round(yAt(bot, rb) - bg, 2)], [round(lb, 2), round(yAt(bot, lb) - bg, 2)],
      ] });
    }
  });
  return panels;
}

const bbox = pts => {
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
};
const centroid = pts => [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return h >>> 0; }

export function readingOrder(page) {
  const items = page.panels.map(p => ({ p, c: centroid(p.pts), b: bbox(p.pts) }));
  items.sort((a, b) => {
    const rowA = a.b.y + a.b.h * 0.35, rowB = b.b.y + b.b.h * 0.35;
    if (Math.abs(a.c[1] - b.c[1]) > Math.min(a.b.h, b.b.h) * 0.45) return rowA - rowB;
    return page.read === "manga" ? b.c[0] - a.c[0] : a.c[0] - b.c[0];
  });
  return items.map(i => i.p);
}

// Lado de la cámara respecto a la línea entre los dos primeros personajes (regla de los 180°)
function axisSide(v, ids) {
  const a = v.objects.find(o => o.id === ids[0]), b = v.objects.find(o => o.id === ids[1]);
  if (!a || !b) return 0;
  const ax = b.pos[0] - a.pos[0], az = b.pos[2] - a.pos[2];
  const cx = v.camera.pos[0] - a.pos[0], cz = v.camera.pos[2] - a.pos[2];
  return Math.sign(ax * cz - az * cx);
}
export function axisWarnings(page, vinetas) {
  const order = readingOrder(page), out = new Set();
  for (let i = 1; i < order.length; i++) {
    const A = vinetas.find(v => v.id === order[i - 1].v), B = vinetas.find(v => v.id === order[i].v);
    if (!A || !B) continue;
    const figA = A.objects.filter(o => o.kind === "figure").map(o => o.id);
    const common = figA.filter(id => B.objects.some(o => o.id === id));
    if (common.length < 2) continue;
    const sa = axisSide(A, common), sb = axisSide(B, common);
    if (sa && sb && sa !== sb) out.add(order[i].id);
  }
  return out;
}

export function createPageEditor(deps) {
  const { store, renderer, composer, toast, onChange, editVineta, renderPanel } = deps;
  const host = document.getElementById("pageview");
  const thumbs = new Map(); // clave → dataURL
  const pending = new Set();
  let sel = null, selBalloon = null, drag = null, zoom = 1;

  const page = () => {
    const P = store.project;
    if (!P.pages) { const pg = newPage(1); pg.panels.forEach((q, i) => { q.v = P.vinetas[i]?.id || null; }); P.pages = [pg]; }
    P.curPage = Math.min(P.curPage ?? 0, P.pages.length - 1);
    return P.pages[P.curPage];
  };
  const vin = id => store.project.vinetas.find(v => v.id === id);

  // ---- Miniaturas: el semirender de cada viñeta en su recuadro
  function thumbKey(v, w, h) { return hash(JSON.stringify([v.objects, v.lights, v.camera, v.view])) + ":" + w + "x" + h; }
  async function makeThumb(v, w, h, key) {
    if (pending.has(key)) return;
    pending.add(key);
    await new Promise(r => setTimeout(r, 0));
    try {
      const { scene, camera } = sceneFor({ ...v, camera: { ...v.camera, aspect: w / h } });
      const { canvas } = await renderToBlob(renderer, composer, scene, camera, v.view, w, h, {});
      disposeScene(scene);
      thumbs.set(key, canvas.toDataURL("image/jpeg", 0.85));
      if (thumbs.size > 60) thumbs.delete(thumbs.keys().next().value);
    } catch (e) { console.error(e); }
    pending.delete(key);
    draw();
  }

  function draw() {
    if (!host || host.hidden) return;
    const pg = page(), F = FORMATS[pg.format];
    const order = readingOrder(pg);
    const warn = pg.guides?.axis ? axisWarnings(pg, store.project.vinetas) : new Set();
    let defs = "", body = "";
    const PX = 3.2; // px por mm para miniaturas
    for (const p of pg.panels) {
      const b = bbox(p.pts), pts = p.pts.map(q => q.join(",")).join(" ");
      defs += `<clipPath id="cp-${p.id}"><polygon points="${pts}"/></clipPath>`;
      const v = vin(p.v);
      if (v) {
        const w = Math.max(40, Math.round(b.w * PX)), h = Math.max(40, Math.round(b.h * PX));
        const key = thumbKey(v, w, h);
        const url = thumbs.get(key);
        if (url) body += `<image href="${url}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#cp-${p.id})"/>`;
        else { body += `<polygon points="${pts}" class="pv-load"/>`; makeThumb(v, w, h, key); }
      } else {
        body += `<polygon points="${pts}" class="pv-empty"/><text x="${b.x + b.w / 2}" y="${b.y + b.h / 2}" class="pv-hint">Toca y asigna una viñeta</text>`;
      }
      if (pg.guides?.thirds) for (const k of [1, 2]) body += `<g clip-path="url(#cp-${p.id})" class="pv-third"><line x1="${b.x + b.w * k / 3}" y1="${b.y}" x2="${b.x + b.w * k / 3}" y2="${b.y + b.h}"/><line x1="${b.x}" y1="${b.y + b.h * k / 3}" x2="${b.x + b.w}" y2="${b.y + b.h * k / 3}"/></g>`;
      body += `<polygon points="${pts}" class="pv-panel${p.border ? "" : " noborder"}${p.id === sel ? " sel" : ""}" data-panel="${p.id}"/>`;
      if (warn.has(p.id)) { const c = centroid(p.pts); body += `<g class="pv-warn"><circle cx="${b.x + 6}" cy="${b.y + 6}" r="4.2"/><text x="${b.x + 6}" y="${b.y + 7.6}">!</text></g>`; void c; }
    }
    // Recorrido de lectura
    if (pg.guides?.order && order.length > 1) {
      const pts = order.map(p => centroid(p.pts));
      body += `<polyline points="${pts.map(c => c.join(",")).join(" ")}" class="pv-path"/>`;
      order.forEach((p, i) => { const c = centroid(p.pts); body += `<circle cx="${c[0]}" cy="${c[1]}" r="4" class="pv-num"/><text x="${c[0]}" y="${c[1] + 1.5}" class="pv-numt">${i + 1}</text>`; });
    }
    // Globos
    for (const bl of pg.balloons) body += balloonSvg(bl, bl.id === selBalloon);
    // Puntos editables de la viñeta seleccionada
    const sp = pg.panels.find(p => p.id === sel);
    if (sp) {
      sp.pts.forEach((q, i) => {
        const n = sp.pts[(i + 1) % sp.pts.length];
        body += `<circle cx="${(q[0] + n[0]) / 2}" cy="${(q[1] + n[1]) / 2}" r="2" class="pv-mid" data-mid="${i}"/>`;
      });
      sp.pts.forEach((q, i) => { body += `<circle cx="${q[0]}" cy="${q[1]}" r="2.8" class="pv-vtx" data-vtx="${i}"/>`; });
    }
    const pad = 6;
    host.innerHTML = `<div class="pv-wrap" style="--z:${zoom}"><svg class="pv-svg" viewBox="${-pad} ${-pad} ${F.w + pad * 2} ${F.h + pad * 2}" style="aspect-ratio:${(F.w + pad * 2) / (F.h + pad * 2)}">
      <defs>${defs}</defs><rect x="0" y="0" width="${F.w}" height="${F.h}" class="pv-paper"/>
      <rect x="${pg.margin}" y="${pg.margin}" width="${F.w - pg.margin * 2}" height="${F.h - pg.margin * 2}" class="pv-margin"/>${body}</svg></div>
      <div class="pv-tools"><button data-pz="-">−</button><span>${Math.round(zoom * 100)} %</span><button data-pz="+">+</button></div>`;
  }

  function balloonSvg(b, on) {
    const { x, y, w, h } = b, t = b.tail || [x, y + h];
    let shape;
    if (b.shape === "caja") shape = `<rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" class="pv-bl"/>`;
    else if (b.shape === "grito") {
      const pts = Array.from({ length: 18 }, (_, i) => { const a = (i / 18) * Math.PI * 2, r = i % 2 ? 0.78 : 1.12; return [x + Math.cos(a) * w / 2 * r, y + Math.sin(a) * h / 2 * r]; });
      shape = `<polygon points="${pts.map(p => p.join(",")).join(" ")}" class="pv-bl"/>`;
    } else if (b.shape === "pensamiento") {
      shape = Array.from({ length: 9 }, (_, i) => { const a = (i / 9) * Math.PI * 2; return `<circle cx="${x + Math.cos(a) * w * 0.36}" cy="${y + Math.sin(a) * h * 0.32}" r="${Math.min(w, h) * 0.3}" class="pv-bl"/>`; }).join("") +
        `<ellipse cx="${x}" cy="${y}" rx="${w * 0.42}" ry="${h * 0.38}" class="pv-bl noline"/>` +
        `<circle cx="${(x + t[0]) / 2}" cy="${(y + h / 2 + t[1]) / 2}" r="1.6" class="pv-bl"/><circle cx="${t[0]}" cy="${t[1]}" r="1" class="pv-bl"/>`;
    } else shape = `<ellipse cx="${x}" cy="${y}" rx="${w / 2}" ry="${h / 2}" class="pv-bl"/>`;
    const tail = b.shape === "globo" || b.shape === "grito" ? (() => {
      const ang = Math.atan2(t[1] - y, t[0] - x), s = Math.min(w, h) * 0.16;
      const bx = x + Math.cos(ang) * w * 0.38, by = y + Math.sin(ang) * h * 0.38;
      const nx = -Math.sin(ang) * s, ny = Math.cos(ang) * s;
      return `<polygon points="${bx + nx},${by + ny} ${bx - nx},${by - ny} ${t[0]},${t[1]}" class="pv-bl"/><polygon points="${bx + nx * 0.7},${by + ny * 0.7} ${bx - nx * 0.7},${by - ny * 0.7} ${bx + Math.cos(ang) * 2},${by + Math.sin(ang) * 2}" class="pv-bl noline"/>`;
    })() : "";
    const lines = String(b.text || "").toUpperCase().split("\n").slice(0, 4);
    const fs = Math.min(4.2, h / (lines.length + 1.2));
    const txt = lines.map((l, i) => `<text x="${x}" y="${y + (i - (lines.length - 1) / 2) * fs * 1.15 + fs * 0.35}" class="pv-blt" style="font-size:${fs}px">${esc(l)}</text>`).join("");
    return `<g class="pv-balloon${on ? " sel" : ""}" data-balloon="${b.id}">${tail}${shape}${txt}</g>` + (on ? `<circle cx="${t[0]}" cy="${t[1]}" r="2.4" class="pv-tail" data-tail="${b.id}"/><circle cx="${x + w / 2}" cy="${y + h / 2}" r="2.2" class="pv-size" data-size="${b.id}"/>` : "");
  }

  // ---- Interacción en la página
  function toMM(e) {
    const svg = host.querySelector("svg"); const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    return [round(p.x, 2), round(p.y, 2)];
  }
  host?.addEventListener("pointerdown", e => {
    const t = e.target, pg = page();
    if (t.dataset?.pz) { zoom = Math.min(3, Math.max(0.5, zoom + (t.dataset.pz === "+" ? 0.25 : -0.25))); draw(); return; }
    if (!host.querySelector("svg")?.contains(t)) return;
    const m = toMM(e);
    const sp = pg.panels.find(p => p.id === sel);
    if (t.dataset.vtx !== undefined && sp) drag = { kind: "vtx", p: sp, i: +t.dataset.vtx };
    else if (t.dataset.mid !== undefined && sp) { const i = +t.dataset.mid; sp.pts.splice(i + 1, 0, m); drag = { kind: "vtx", p: sp, i: i + 1 }; }
    else if (t.dataset.tail) drag = { kind: "tail", b: pg.balloons.find(b => b.id === t.dataset.tail) };
    else if (t.dataset.size) drag = { kind: "size", b: pg.balloons.find(b => b.id === t.dataset.size) };
    else if (t.closest("[data-balloon]")) { const id = t.closest("[data-balloon]").dataset.balloon; selBalloon = id; sel = null; drag = { kind: "balloon", b: pg.balloons.find(b => b.id === id), last: m }; renderPanel(); }
    else if (t.dataset.panel) {
      const id = t.dataset.panel;
      if (sel === id) drag = { kind: "panel", p: pg.panels.find(p => p.id === id), last: m };
      sel = id; selBalloon = null; renderPanel();
    } else { sel = null; selBalloon = null; renderPanel(); }
    if (drag) { host.setPointerCapture(e.pointerId); e.preventDefault(); }
    draw();
  });
  host?.addEventListener("pointermove", e => {
    if (!drag) return;
    const m = toMM(e);
    if (drag.kind === "vtx") drag.p.pts[drag.i] = m;
    else if (drag.kind === "panel") { const dx = m[0] - drag.last[0], dy = m[1] - drag.last[1]; drag.p.pts = drag.p.pts.map(q => [round(q[0] + dx, 2), round(q[1] + dy, 2)]); drag.last = m; }
    else if (drag.kind === "balloon") { const dx = m[0] - drag.last[0], dy = m[1] - drag.last[1]; drag.b.x += dx; drag.b.y += dy; if (drag.b.tail) { drag.b.tail[0] += dx; drag.b.tail[1] += dy; } drag.last = m; }
    else if (drag.kind === "tail") drag.b.tail = m;
    else if (drag.kind === "size") { drag.b.w = Math.max(14, Math.abs(m[0] - drag.b.x) * 2); drag.b.h = Math.max(8, Math.abs(m[1] - drag.b.y) * 2); }
    draw();
  });
  host?.addEventListener("pointerup", () => {
    if (!drag) return;
    if (drag.p && drag.kind === "vtx") syncAspect(drag.p);
    drag = null; onChange(); draw();
  });
  host?.addEventListener("dblclick", e => {
    const t = e.target, sp = page().panels.find(p => p.id === sel);
    if (t.dataset.vtx !== undefined && sp && sp.pts.length > 3) { sp.pts.splice(+t.dataset.vtx, 1); onChange(); draw(); }
  });

  // La proporción de la cámara de la viñeta sigue al recuadro
  function syncAspect(p) {
    const v = vin(p.v); if (!v) return;
    const b = bbox(p.pts); v.camera.aspect = round(b.w / b.h, 4);
  }

  // ---- Panel lateral
  function panelHtml(pill) {
    const P = store.project, pg = page(), F = FORMATS[pg.format];
    const sp = pg.panels.find(p => p.id === sel), sb = pg.balloons.find(b => b.id === selBalloon);
    let h = `<h2>Página</h2><div class="vlist">${P.pages.map((x, i) => `<button class="vitem${i === P.curPage ? " on" : ""}" data-act="pg-sel" data-val="${i}"><b>${i + 1}</b><span>${esc(x.name)}</span></button>`).join("")}</div>
      <div class="row"><button class="btn" data-act="pg-new">Nueva página</button><button class="btn" data-act="pg-dup">Duplicar</button><button class="btn danger" data-act="pg-del" ${P.pages.length < 2 ? "disabled" : ""}>Borrar</button></div>
      <h3>Formato</h3><div class="pills">${Object.entries(FORMATS).map(([k, f]) => pill(k, pg.format, f.label, "pg-format")).join("")}</div>
      <p class="sub">${round(F.w / 10, 1)} × ${round(F.h / 10, 1)} cm · margen ${pg.margin} mm · calle ${pg.gutter} mm</p>
      <h3>Distribución</h3><div class="pills">${Object.entries(TEMPLATES).map(([k, t]) => pill(k, "", t.label, "pg-tpl")).join("")}</div>
      ${rng("pg-margin", "Margen", pg.margin, 0, 25, 1, " mm")}${rng("pg-gutter", "Calle entre viñetas", pg.gutter, 0, 12, 0.5, " mm")}${rng("pg-tilt", "Inclinación de las calles", pg.tilt || 0, -30, 30, 1, " mm")}
      <h3>Lectura y guías</h3><div class="pills">${pill("occidental", pg.read, "Occidental (→)", "pg-read")}${pill("manga", pg.read, "Manga (←)", "pg-read")}</div>
      <div class="pills">${pill("order", pg.guides?.order ? "order" : "", "Recorrido de lectura", "pg-guide")}${pill("thirds", pg.guides?.thirds ? "thirds" : "", "Tercios", "pg-guide")}${pill("axis", pg.guides?.axis ? "axis" : "", "Aviso de eje", "pg-guide")}</div>`;
    const warn = axisWarnings(pg, P.vinetas);
    if (warn.size) h += `<p class="warnbox">${warn.size} viñeta${warn.size > 1 ? "s cruzan" : " cruza"} el eje respecto a la anterior (marcada con !). Puede ser intencional; si no, mueve la cámara al mismo lado de los personajes.</p>`;
    if (sp) {
      const b = bbox(sp.pts);
      h += `<div class="card"><h3>Viñeta seleccionada</h3><p class="sub">${round(b.w / 10, 1)} × ${round(b.h / 10, 1)} cm · ${sp.pts.length} vértices. Arrastra los puntos para cambiar la forma; los puntos chicos agregan vértices; doble toque en un vértice lo quita. Toca de nuevo y arrastra para moverla.</p>
        <label class="sel"><span>Escena de esta viñeta</span><select data-act="pn-v">${`<option value="">Sin asignar</option>` + P.vinetas.map(v => `<option value="${v.id}" ${v.id === sp.v ? "selected" : ""}>${esc(v.name)}</option>`).join("")}</select></label>
        <div class="row"><button class="btn" data-act="pn-newv">Escena nueva para este recuadro</button>${sp.v ? `<button class="btn accent" data-act="pn-edit">Editar en 3D</button>` : ""}</div>
        <div class="row"><button class="btn" data-act="pn-split" data-val="h">Dividir ↔</button><button class="btn" data-act="pn-split" data-val="v">Dividir ↕</button><button class="btn" data-act="pn-inset">Inserto encima</button></div>
        <div class="row"><button class="btn${sp.border ? " on" : ""}" data-act="pn-border">${sp.border ? "Con borde" : "Sin borde"}</button><button class="btn" data-act="pn-bleed">Llevar al borde del papel</button><button class="btn danger" data-act="pn-del">Borrar</button></div></div>`;
    }
    h += `<h3>Globos y textos</h3><div class="pills">${Object.entries(BALLOONS).map(([k, l]) => pill(k, "", "+ " + l, "bl-add")).join("")}</div>`;
    if (sb) h += `<div class="card"><textarea class="text" data-act="bl-text" rows="3" aria-label="Texto del globo">${esc(sb.text || "")}</textarea>
      <div class="pills">${Object.entries(BALLOONS).map(([k, l]) => pill(k, sb.shape, l, "bl-shape")).join("")}</div>
      <p class="sub">Arrastra el globo para moverlo, el punto azul para la cola y el gris para el tamaño.</p><button class="btn danger" data-act="bl-del">Borrar globo</button></div>`;
    h += `<div class="row"><button class="btn accent" data-act="pg-export">Exportar esta página</button></div>`;
    return h;
  }
  const rng = (id, label, val, min, max, step, unit) => `<div class="field"><label for="${id}">${label} <output id="${id}-o">${val}${unit}</output></label><input type="range" id="${id}" data-act="pg-range" data-key="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;

  function onClick(act, val) {
    const P = store.project, pg = page(), F = FORMATS[pg.format];
    const sp = pg.panels.find(p => p.id === sel), sb = pg.balloons.find(b => b.id === selBalloon);
    switch (act) {
      case "pg-sel": P.curPage = +val; sel = selBalloon = null; break;
      case "pg-new": P.pages.push(newPage(P.pages.length + 1, pg.format)); P.curPage = P.pages.length - 1; break;
      case "pg-dup": { const c = JSON.parse(JSON.stringify(pg)); c.id = uid("pg"); c.name = pg.name + " (copia)"; c.panels.forEach(p => (p.id = uid("pn"))); c.balloons.forEach(b => (b.id = uid("bl"))); P.pages.splice(P.curPage + 1, 0, c); P.curPage++; break; }
      case "pg-del": if (P.pages.length > 1) { P.pages.splice(P.curPage, 1); P.curPage = Math.max(0, P.curPage - 1); } break;
      case "pg-format": { pg.format = val; const f = FORMATS[val]; const keep = pg.panels.map(p => p.v); pg.panels = buildTemplate(pg.lastTpl || "tres", f.w, f.h, pg.margin, pg.gutter, pg.tilt || undefined); pg.panels.forEach((p, i) => { p.v = keep[i] ?? null; syncAspect(p); }); break; }
      case "pg-tpl": { const keep = readingOrder(pg).map(p => p.v); pg.lastTpl = val; pg.tilt = TEMPLATES[val].tilt || 0; pg.panels = buildTemplate(val, F.w, F.h, pg.margin, pg.gutter); pg.panels.forEach((p, i) => { p.v = keep[i] ?? null; syncAspect(p); }); sel = null; break; }
      case "pg-read": pg.read = val; break;
      case "pg-guide": pg.guides = { ...(pg.guides || {}), [val]: !pg.guides?.[val] }; break;
      case "pn-newv": if (sp) { const v = deps.newVinetaFor(); sp.v = v.id; syncAspect(sp); } break;
      case "pn-edit": if (sp?.v) { syncAspect(sp); editVineta(sp.v); return; } break;
      case "pn-split": if (sp) {
        const b = bbox(sp.pts), g = pg.gutter / 2;
        const A = { ...sp, id: uid("pn"), pts: [] }, B = { ...sp, id: uid("pn"), v: null, pts: [] };
        if (val === "h") { const mx = b.x + b.w / 2; A.pts = clipX(sp.pts, -Infinity, mx - g); B.pts = clipX(sp.pts, mx + g, Infinity); }
        else { const my = b.y + b.h / 2; A.pts = clipY(sp.pts, -Infinity, my - g); B.pts = clipY(sp.pts, my + g, Infinity); }
        if (A.pts.length >= 3 && B.pts.length >= 3) { pg.panels.splice(pg.panels.indexOf(sp), 1, A, B); sel = A.id; syncAspect(A); }
      } break;
      case "pn-inset": if (sp) { const b = bbox(sp.pts), w = b.w * 0.36, h = b.h * 0.36, x = b.x + b.w - w - 4, y = b.y + 4; const n = { id: uid("pn"), v: null, border: true, pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]] }; pg.panels.push(n); sel = n.id; } break;
      case "pn-border": if (sp) sp.border = !sp.border; break;
      case "pn-bleed": if (sp) { sp.pts = sp.pts.map(([x, y]) => [x <= pg.margin + 1 ? -3 : x >= F.w - pg.margin - 1 ? F.w + 3 : x, y <= pg.margin + 1 ? -3 : y >= F.h - pg.margin - 1 ? F.h + 3 : y]); syncAspect(sp); } break;
      case "pn-del": if (sp) { pg.panels.splice(pg.panels.indexOf(sp), 1); sel = null; } break;
      case "bl-add": { const b = { id: uid("bl"), shape: val, x: F.w / 2, y: F.h * 0.3, w: 46, h: 22, tail: [F.w / 2 + 8, F.h * 0.3 + 22], text: val === "caja" ? "Mientras tanto…" : "Texto" }; pg.balloons.push(b); selBalloon = b.id; sel = null; break; }
      case "bl-shape": if (sb) sb.shape = val; break;
      case "bl-del": if (sb) { pg.balloons.splice(pg.balloons.indexOf(sb), 1); selBalloon = null; } break;
      case "pg-export": deps.openExport(); return;
      default: return false;
    }
    onChange(); draw(); renderPanel();
    return true;
  }
  function onInput(act, key, val, el) {
    const pg = page(), F = FORMATS[pg.format];
    if (act === "pg-range") {
      if (key === "pg-margin") pg.margin = val; if (key === "pg-gutter") pg.gutter = val; if (key === "pg-tilt") pg.tilt = val;
      const keep = readingOrder(pg).map(p => p.v);
      pg.panels = buildTemplate(pg.lastTpl || "tres", F.w, F.h, pg.margin, pg.gutter, key === "pg-tilt" || pg.tilt ? pg.tilt : undefined);
      pg.panels.forEach((p, i) => { p.v = keep[i] ?? null; syncAspect(p); });
      const out = document.getElementById(key + "-o"); if (out) out.textContent = val + " mm";
      draw(); return true;
    }
    if (act === "bl-text") { const sb = pg.balloons.find(b => b.id === selBalloon); if (sb) { sb.text = el.value; draw(); } return true; }
    return false;
  }
  function onChangeEl(act, el) {
    const pg = page(), sp = pg.panels.find(p => p.id === sel);
    if (act === "pn-v" && sp) { sp.v = el.value || null; syncAspect(sp); onChange(); draw(); renderPanel(); return true; }
    if (act === "pg-range" || act === "bl-text") { onChange(); return true; }
    return false;
  }

  // ---- Exportar la página completa
  async function exportCanvas({ dpi = 300, style = "actual", outline = null, blue = false }) {
    const pg = page(), F = FORMATS[pg.format];
    const k = dpi / 25.4, W = Math.round(F.w * k), H = Math.round(F.h * k);
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, W, H);
    const ink = blue ? "#5aa9e0" : "#111";
    for (const p of pg.panels) {
      const b = bbox(p.pts), v = vin(p.v);
      g.save(); g.beginPath(); p.pts.forEach(([x, y], i) => (i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k))); g.closePath(); g.clip();
      if (v) {
        const w = Math.max(16, Math.round(b.w * k)), h = Math.max(16, Math.round(b.h * k));
        const view = styleView(v.view, style, outline);
        const { scene, camera } = sceneFor({ ...v, camera: { ...v.camera, aspect: w / h } }, { mode: view.mode });
        if (blue) composer.mat.uniforms.blueInk.value.set(0x5aa9e0);
        const { canvas } = await renderToBlob(renderer, composer, scene, camera, view, w, h, { blue });
        if (blue) composer.mat.uniforms.blueInk.value.setRGB(0.25, 0.55, 0.85);
        disposeScene(scene);
        g.drawImage(canvas, b.x * k, b.y * k);
      }
      g.restore();
      if (p.border) { g.beginPath(); p.pts.forEach(([x, y], i) => (i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k))); g.closePath(); g.lineWidth = 0.7 * k; g.strokeStyle = ink; g.stroke(); }
    }
    // Globos: se dibujan desde su SVG para que salgan iguales a la pantalla
    if (pg.balloons.length) {
      const svgTxt = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${F.w} ${F.h}" width="${W}" height="${H}"><style>.pv-bl{fill:#fff;stroke:${ink};stroke-width:0.5}.noline{stroke:none}.pv-blt{font:700 4px Figtree,sans-serif;text-anchor:middle;fill:${ink}}</style>${pg.balloons.map(b => balloonSvg(b, false)).join("")}</svg>`;
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgTxt); });
      g.drawImage(img, 0, 0, W, H);
    }
    return { canvas: c, F };
  }

  return {
    show(on) { if (host) host.hidden = !on; if (on) draw(); },
    draw, panelHtml, onClick, onInput, onChangeEl, exportCanvas, page,
    invalidate() { draw(); },
    get selected() { return sel; },
  };
}

// Recorta un polígono a una franja vertical o horizontal (Sutherland–Hodgman)
function clipBy(pts, inside, cut) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) out.push(cut(a, b));
  }
  return out.map(p => [round(p[0], 2), round(p[1], 2)]);
}
function clipX(pts, lo, hi) {
  let r = pts;
  if (lo > -Infinity) r = clipBy(r, p => p[0] >= lo, (a, b) => { const t = (lo - a[0]) / (b[0] - a[0]); return [lo, a[1] + t * (b[1] - a[1])]; });
  if (hi < Infinity) r = clipBy(r, p => p[0] <= hi, (a, b) => { const t = (hi - a[0]) / (b[0] - a[0]); return [hi, a[1] + t * (b[1] - a[1])]; });
  return r;
}
function clipY(pts, lo, hi) {
  let r = pts;
  if (lo > -Infinity) r = clipBy(r, p => p[1] >= lo, (a, b) => { const t = (lo - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), lo]; });
  if (hi < Infinity) r = clipBy(r, p => p[1] <= hi, (a, b) => { const t = (hi - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), hi]; });
  return r;
}

// Vista para exportar según el estilo elegido
export function styleView(view, style, outline) {
  const v = { ...view };
  if (style && style !== "actual" && style !== "lineas") v.mode = style;
  if (outline !== null && outline !== undefined) v.outline = outline;
  return v;
}
void THREE; void aspectOf;
