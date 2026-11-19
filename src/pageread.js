// Leer una página desde una foto: encontrar los recuadros de las viñetas y su orden de lectura.
// Primero en el teléfono (cortes por calles blancas, gratis y sin internet); si la página tiene viñetas
// inclinadas, sin marco o encimadas, Gemini corrige los recuadros y describe cada viñeta.

async function loadCanvas(file, max) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}

// Corte recursivo por calles (XY-cut): busca franjas sin tinta que atraviesan toda la región
function xyCut(ink, w, h) {
  const out = [];
  const rowInk = (x0, x1, y) => { let s = 0; for (let x = x0; x < x1; x++) s += ink[y * w + x]; return s / Math.max(1, x1 - x0); };
  const colInk = (y0, y1, x) => { let s = 0; for (let y = y0; y < y1; y++) s += ink[y * w + x]; return s / Math.max(1, y1 - y0); };
  const bands = (n, at, minGap) => {
    const res = []; let start = null, gap = 0;
    for (let i = 0; i < n; i++) {
      const empty = at(i) < 0.012;
      if (!empty) { if (start === null) start = i; gap = 0; }
      else if (start !== null) { gap++; if (gap >= minGap) { res.push([start, i - gap + 1]); start = null; gap = 0; } }
    }
    if (start !== null) res.push([start, n - gap]);
    return res;
  };
  const rec = (x0, y0, x1, y1, depth, horiz) => {
    if (depth > 6 || x1 - x0 < 20 || y1 - y0 < 20) { out.push([x0, y0, x1, y1]); return; }
    for (const dir of horiz ? ["h", "v"] : ["v", "h"]) {
      const b = dir === "h"
        ? bands(y1 - y0, i => rowInk(x0, x1, y0 + i), Math.max(3, Math.round(h * 0.008))).map(([a, c]) => [x0, y0 + a, x1, y0 + c])
        : bands(x1 - x0, i => colInk(y0, y1, x0 + i), Math.max(3, Math.round(w * 0.008))).map(([a, c]) => [x0 + a, y0, x0 + c, y1]);
      const real = b.filter(([a, bb, c, d]) => (c - a) > w * 0.05 && (d - bb) > h * 0.04);
      if (real.length >= 2) { for (const r of real) rec(...r, depth + 1, dir !== "h"); return; }
      if (real.length === 1 && (real[0][0] !== x0 || real[0][1] !== y0 || real[0][2] !== x1 || real[0][3] !== y1)) { rec(...real[0], depth + 1, horiz); return; }
    }
    out.push([x0, y0, x1, y1]);
  };
  rec(0, 0, w, h, 0, true);
  return out;
}

// Las calles son el papel que llega hasta la orilla de la hoja: se inunda el papel desde el borde y
// lo que queda encerrado son las viñetas, aunque estén inclinadas. Cada viñeta se reduce a un
// cuadrilátero con sus cuatro esquinas extremas, que Arnés ya sabe usar como viñeta de forma libre.
export async function detectLocal(file) {
  const c = await loadCanvas(file, 700), w = c.width, h = c.height, n = w * h;
  const d = c.getContext("2d").getImageData(0, 0, w, h).data;
  const R = new Float32Array(n), G = new Float32Array(n), B = new Float32Array(n);
  for (let i = 0; i < n; i++) { R[i] = d[i * 4]; G[i] = d[i * 4 + 1]; B[i] = d[i * 4 + 2]; }
  // color del papel: mediana de una franja delgada en la orilla
  const edge = [];
  for (let x = 0; x < w; x += 2) for (const y of [2, h - 3]) edge.push(y * w + x);
  for (let y = 0; y < h; y += 2) for (const x of [2, w - 3]) edge.push(y * w + x);
  const med = arr => { const s2 = arr.slice().sort((a2, b2) => a2 - b2); return s2[s2.length >> 1]; };
  const pr = med(edge.map(i => R[i])), pgc = med(edge.map(i => G[i])), pb = med(edge.map(i => B[i]));
  const paperL = 0.299 * pr + 0.587 * pgc + 0.114 * pb;
  const isPaper = i => { const dr = R[i] - pr, dg = G[i] - pgc, db = B[i] - pb; return Math.sqrt(dr * dr + dg * dg + db * db) < 46 || (0.299 * R[i] + 0.587 * G[i] + 0.114 * B[i]) > paperL + 8; };
  const flood = new Uint8Array(n), stack = [];
  const push = i => { if (!flood[i] && isPaper(i)) { flood[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop(), x = i % w, y = (i / w) | 0;
    if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
  }
  // engrosar la calle 3 px corta los puentes finos (un globo o un trazo que cruza la calle)
  for (let pass = 0; pass < 3; pass++) {
    const f2 = flood.slice();
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (!flood[i] && (flood[i - 1] || flood[i + 1] || flood[i - w] || flood[i + w])) f2[i] = 1; }
    flood.set(f2);
  }
  // componentes encerradas (lo que no es calle)
  const lab = new Int32Array(n), comps = [];
  let id = 0;
  for (let i0 = 0; i0 < n; i0++) {
    if (flood[i0] || lab[i0]) continue;
    id++; let area = 0, tl = [0, 0, Infinity], tr = [0, 0, -Infinity], br = [0, 0, -Infinity], bl = [0, 0, Infinity];
    let minX = w, minY = h, maxX = 0, maxY = 0;
    lab[i0] = id; stack.push(i0);
    while (stack.length) {
      const i = stack.pop(), x = i % w, y = (i / w) | 0; area++;
      if (x + y < tl[2]) tl = [x, y, x + y]; if (x - y > tr[2]) tr = [x, y, x - y]; if (x + y > br[2]) br = [x, y, x + y]; if (x - y < bl[2]) bl = [x, y, x - y];
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of nb) if (j >= 0 && !flood[j] && !lab[j]) { lab[j] = id; stack.push(j); }
    }
    const bw = maxX - minX, bh = maxY - minY;
    // fuera: letras del título, manchas y basura (muy chicas o muy delgadas)
    if (area > n * 0.012 && bw > w * 0.08 && bh > h * 0.05 && area > bw * bh * 0.45) {
      comps.push({ quad: [tl, tr, br, bl].map(([x, y]) => [x / w, y / h]), rect: [minX / w, minY / h, bw / w, bh / h] });
    }
  }
  return { panels: comps, canvas: c, aspect: w / h };
}

export async function detectAI(canvas, { key, model }, reading = "occidental") {
  const k = Math.min(1, 1280 / Math.max(canvas.width, canvas.height)), t = document.createElement("canvas");
  t.width = Math.round(canvas.width * k); t.height = Math.round(canvas.height * k); t.getContext("2d").drawImage(canvas, 0, 0, t.width, t.height);
  const prompt = `Esta es la foto de una página de cómic. Encuentra cada viñeta (recuadro con dibujo), incluso si está inclinada o no tiene marco.
Responde SOLO un JSON: {"lectura": "occidental" o "manga", "vinetas": [{"box_2d": [ymin, xmin, ymax, xmax] normalizado de 0 a 1000, "orden": número de lectura empezando en 1, "plano": "general|conjunto|americano|medio|primer plano|detalle", "angulo": "normal|picado|contrapicado|cenital|holandés", "personajes": número de personajes, "descripcion": una frase en español de lo que pasa}]}.
Si la página se lee de derecha a izquierda, usa "manga". La lectura que eligió el artista es: ${reading}.`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ inline_data: { mime_type: "image/jpeg", data: t.toDataURL("image/jpeg", 0.85).split(",")[1] } }, { text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j.error?.message ? "Gemini dice: " + j.error.message.slice(0, 160) + " — " : "") + (r.status === 429 ? "Se acabó tu cuota gratuita de Gemini por hoy o por minuto; espera un poco." : r.status === 400 ? "Gemini no aceptó la clave." : "Gemini no respondió; se usó la lectura local.");
  const txt = j.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  let o; try { o = JSON.parse(txt.replace(/^```(json)?|```$/g, "").trim()); } catch { throw new Error("Gemini respondió algo que no se pudo leer; se usó la lectura local."); }
  const list = (o.vinetas || []).filter(v => Array.isArray(v.box_2d) && v.box_2d.length === 4)
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map(v => { const [y0, x0, y1, x1] = v.box_2d.map(n => Math.min(1000, Math.max(0, +n)) / 1000); const rw = Math.max(0.02, x1 - x0), rh = Math.max(0.02, y1 - y0); return { rect: [x0, y0, rw, rh], quad: [[x0, y0], [x0 + rw, y0], [x0 + rw, y0 + rh], [x0, y0 + rh]], plano: v.plano, angulo: v.angulo, personajes: v.personajes, descripcion: v.descripcion }; });
  if (!list.length) throw new Error("Gemini no encontró viñetas; se usó la lectura local.");
  return { panels: list, reading: o.lectura === "manga" ? "manga" : "occidental" };
}

// Orden de lectura: por filas (con tolerancia) y dentro de cada fila de izquierda a derecha (o al revés en manga)
export function readingOrder(rects, reading = "occidental") {
  const items = rects.map((r, i) => ({ r, i, cy: r[1] + r[3] / 2 }));
  items.sort((a, b) => a.r[1] - b.r[1]);
  const rows = [];
  for (const it of items) {
    const row = rows.find(rw => Math.abs(rw.cy - it.cy) < Math.min(rw.h, it.r[3]) * 0.45);
    if (row) { row.items.push(it); } else rows.push({ cy: it.cy, h: it.r[3], items: [it] });
  }
  rows.sort((a, b) => a.cy - b.cy);
  return rows.flatMap(rw => rw.items.sort((a, b) => reading === "manga" ? b.r[0] - a.r[0] : a.r[0] - b.r[0]).map(x => x.i));
}

// Lleva las viñetas (fracción de la foto) a la página en mm: la foto entera ocupa la hoja
export function toPagePanels(quads, F) {
  const r2 = v => Math.round(v * 100) / 100;
  return quads.map(q => q.map(([x, y]) => [r2(x * F.w), r2(y * F.h)]));
}
