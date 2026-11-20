import { askJSON, askImage } from "./ai.js";
// Render de trazos: dibuja la viñeta con trazos sueltos de plumilla, uno por uno, en lugar de un patrón.
// Cada trazo sigue el flujo de la forma (las curvas de igual luz), se afina en las puntas, cambia de
// presión y tiembla un poco, como una mano. Las capas de rayado cruzado se suman según la sombra.
// Es un render final (tarda unos segundos), no la vista en vivo.

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// Tono suavizado y su gradiente: de ahí sale hacia dónde corre cada trazo
function toneField(canvas) {
  const w = canvas.width, h = canvas.height;
  const d = canvas.getContext("2d").getImageData(0, 0, w, h).data;
  const L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
  // niveles automáticos: estira el tono entre el 3 % y el 97 % y lo aclara un poco, para que una escena
  // oscura no se llene de trazos y conserve sus luces
  const srt = Float32Array.from(L).sort(), lo = srt[Math.floor(L.length * 0.03)], hi = srt[Math.floor(L.length * 0.97)];
  const span = Math.max(0.05, hi - lo);
  for (let i = 0; i < L.length; i++) L[i] = Math.pow(Math.min(1, Math.max(0, (L[i] - lo) / span)), 0.75);
  // desenfoque de caja en dos pasadas para que la dirección no tiemble con el ruido
  const blur = (src, r) => {
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) { let acc = 0; for (let x = -r; x <= r; x++) acc += src[y * w + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) { tmp[y * w + x] = acc / (2 * r + 1); acc += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)]; } }
    for (let x = 0; x < w; x++) { let acc = 0; for (let y = -r; y <= r; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) { out[y * w + x] = acc / (2 * r + 1); acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
    return out;
  };
  const S = blur(L, Math.max(2, Math.round(w / 260)));
  return { w, h, L: blur(L, 1), S };
}

function dirAt(f, x, y) {
  const xi = Math.min(f.w - 2, Math.max(1, x | 0)), yi = Math.min(f.h - 2, Math.max(1, y | 0)), S = f.S, w = f.w;
  const gx = S[yi * w + xi + 1] - S[yi * w + xi - 1], gy = S[(yi + 1) * w + xi] - S[(yi - 1) * w + xi];
  const m = Math.hypot(gx, gy);
  if (m < 1e-4) return null;
  return [-gy / m, gx / m]; // perpendicular al gradiente: corre a lo largo de la forma
}

const LAYERS = [ // umbral de tono, giro respecto al flujo, peso
  { t: 0.72, rot: 0, w: 0.75 },
  { t: 0.52, rot: 0.95, w: 0.85 },
  { t: 0.34, rot: -0.75, w: 0.95 },
  { t: 0.18, rot: 1.57, w: 1.05 },
];

export async function drawStrokes(base, tone, { ink = "#2a1d12", spacing = 6, lineVar = 0.7, seed = 7, onProgress, brushes = null } = {}) {
  const f = toneField(tone);
  const out = document.createElement("canvas"); out.width = base.width; out.height = base.height;
  const g = out.getContext("2d");
  g.drawImage(base, 0, 0);
  g.fillStyle = ink; g.lineJoin = "round";
  const scale = out.width / tone.width;
  const rand = rng(seed);
  const total = LAYERS.length;
  let count = 0;
  for (let li = 0; li < total; li++) {
    const layer = LAYERS[li];
    const s = spacing * (1 - li * 0.08);
    const cos = Math.cos(layer.rot), sin = Math.sin(layer.rot);
    for (let gy = 0; gy < f.h; gy += s) {
      for (let gx = 0; gx < f.w; gx += s) {
        const x0 = gx + (rand() - 0.5) * s, y0 = gy + (rand() - 0.5) * s;
        const L0 = f.L[(Math.min(f.h - 1, y0 | 0)) * f.w + Math.min(f.w - 1, Math.max(0, x0 | 0))];
        if (L0 > layer.t) continue;
        // más oscuro → más probable y más largo
        const dark = (layer.t - L0) / layer.t;
        if (rand() > 0.2 + dark * 0.8) continue;
        const len = s * (2.2 + rand() * 2.4) * (0.8 + dark * 0.6);
        const pts = [];
        for (const sign of [-1, 1]) {
          let x = x0, y = y0, prev = null; const half = [];
          for (let d = 0; d < len / 2; d += 1.5) {
            let v = dirAt(f, x, y) || prev || [1, 0];
            if (prev && v[0] * prev[0] + v[1] * prev[1] < 0) v = [-v[0], -v[1]];
            prev = v;
            const vx = v[0] * cos - v[1] * sin, vy = v[0] * sin + v[1] * cos;
            x += vx * 1.5 * sign; y += vy * 1.5 * sign;
            if (x < 0 || y < 0 || x >= f.w || y >= f.h) break;
            if (f.L[(y | 0) * f.w + (x | 0)] > layer.t + 0.1) break; // el trazo se levanta al llegar a la luz
            half.push([x, y]);
          }
          if (sign < 0) pts.push(...half.reverse()); else { pts.push([x0, y0]); pts.push(...half); }
        }
        if (pts.length < 3) continue;
        // ancho con presión: delgado en las puntas, más grueso en el centro y en la sombra
        const wmax = (0.45 + dark * 0.75) * layer.w * (1 + (rand() - 0.5) * lineVar * 0.8) * scale;
        const wob = (rand() - 0.5) * 0.6 * lineVar;
        const left = [], right = [];
        for (let i = 0; i < pts.length; i++) {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
          let tx = b[0] - a[0], ty = b[1] - a[1]; const tm = Math.hypot(tx, ty) || 1; tx /= tm; ty /= tm;
          const t = i / (pts.length - 1);
          const wi = wmax * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t * 0.92 + 0.04))), 0.55);
          const off = Math.sin(t * Math.PI * 2 + wob * 9) * wob * scale;
          const px = pts[i][0] * scale - ty * off, py = pts[i][1] * scale + tx * off;
          left.push([px - ty * wi / 2, py + tx * wi / 2]); right.push([px + ty * wi / 2, py - tx * wi / 2]);
        }
        g.globalAlpha = 0.78 + rand() * 0.22;
        if (brushes?.length) {
          // tu trazo: la máscara se estira por tramos a lo largo del camino
          const br = brushes[(rand() * brushes.length) | 0], segs = pts.length - 1;
          for (let i = 0; i < segs; i++) {
            const a = pts[i], b = pts[i + 1], ax = a[0] * scale, ay = a[1] * scale, bx = b[0] * scale, by = b[1] * scale;
            const sl = Math.hypot(bx - ax, by - ay); if (sl < 0.01) continue;
            const sx = (i / segs) * br.width, sw = Math.max(1, br.width / segs);
            g.save(); g.translate(ax, ay); g.rotate(Math.atan2(by - ay, bx - ax));
            g.drawImage(br, sx, 0, sw, br.height, 0, -wmax * 1.2, sl + 0.6, wmax * 2.4);
            g.restore();
          }
          if (++count % 4000 === 0) { onProgress?.((li + gy / f.h) / total); await new Promise(r => setTimeout(r, 0)); }
          continue;
        }
        g.beginPath(); g.moveTo(left[0][0], left[0][1]);
        for (let i = 1; i < left.length; i++) g.lineTo(left[i][0], left[i][1]);
        for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
        g.closePath(); g.fill();
        if (++count % 4000 === 0) { onProgress?.((li + gy / f.h) / total); await new Promise(r => setTimeout(r, 0)); }
      }
    }
  }
  g.globalAlpha = 1;
  onProgress?.(1);
  return { canvas: out, strokes: count };
}

// Acabado con IA: el render se manda junto con una referencia del artista a un modelo de imagen de Gemini
export const AI_IMAGE_MODEL = "gemini-3.1-flash-image";
export async function aiFinish(render, refDataUrl, { key, imageModel }, notes = "", sheets = []) {
  const toB64 = c => { const k = Math.min(1, 1280 / Math.max(c.width, c.height)); const t = document.createElement("canvas"); t.width = Math.round(c.width * k); t.height = Math.round(c.height * k); t.getContext("2d").drawImage(c, 0, 0, t.width, t.height); return t.toDataURL("image/jpeg", 0.9).split(",")[1]; };
  const jpg = c => "data:image/jpeg;base64," + toB64(c);
  const parts = [{ text: "Imagen 1: render 3D de una viñeta de cómic (composición, cámara, poses, luz y sombras ya decididas por el artista)." }, { image: jpg(render) }];
  if (refDataUrl) parts.push({ text: "Imagen 2: página dibujada por el mismo artista, referencia de su estilo." }, { image: refDataUrl });
  for (const sh of sheets.slice(0, 4)) for (const u of sh.urls.slice(0, 2)) parts.push({ text: `Hoja de modelo del personaje «${sh.name}»: mantén su cara, peinado, complexión y ropa iguales.` }, { image: u });
  parts.push({ text: `Redibuja la imagen 1 como una viñeta terminada a mano${refDataUrl ? " con el estilo exacto de la imagen 2 (tipo de trazo, rayado, manejo de negros, textura del papel y paleta)" : ", con plumilla y tinta"}. Conserva exactamente la composición, el encuadre, la cantidad de personajes, sus poses, la dirección de la luz y las sombras. Convierte los maniquíes en personas con piel, rasgos y ropa coherentes con la escena. No agregues texto, globos, firmas ni marcos. ${notes}` });
  try { return (await askImage(parts)).url; }
  catch (e) { if (/limit: 0|free_tier/i.test(e.message)) throw new Error("Tu clave de Gemini está en el nivel gratuito, y dibujar imágenes no tiene cuota gratis. Activa la facturación o agrega otro servicio que dibuje (OpenRouter u OpenAI) en «Servicios de IA»."); throw e; }
}

// ------------------------------------------------------------------ biblioteca de tus trazos
// De una foto con trazos sueltos (rayados, líneas, criaturas) se recortan los trazos alargados uno por uno,
// se enderezan con su eje principal y se guardan como máscaras. El render de trazos los estira a lo largo
// de cada trazo, así la textura, la presión y las puntas son las de tu mano.
export async function extractStrokes(file, max = 48) {
  const url = URL.createObjectURL(file);
  let img;
  try { img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); }
  finally { URL.revokeObjectURL(url); }
  const k = Math.min(1, 1600 / Math.max(img.width, img.height)), w = Math.round(img.width * k), h = Math.round(img.height * k);
  const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, n = w * h, L = new Float32Array(n);
  for (let i = 0; i < n; i++) L[i] = (0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]) / 255;
  const srt = Float32Array.from(L).sort(), paper = srt[Math.floor(n * 0.8)], ink = srt[Math.floor(n * 0.02)];
  const thr = (paper + ink) / 2, lab = new Int32Array(n), out = [];
  const stack = [];
  let id = 0;
  for (let i0 = 0; i0 < n && out.length < max * 3; i0++) {
    if (L[i0] >= thr || lab[i0]) continue;
    id++; lab[i0] = id; stack.push(i0); const pix = [];
    while (stack.length) {
      const i = stack.pop(); pix.push(i); const x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1, x > 0 && y > 0 ? i - w - 1 : -1, x < w - 1 && y < h - 1 ? i + w + 1 : -1])
        if (j >= 0 && !lab[j] && L[j] < thr) { lab[j] = id; stack.push(j); }
      if (pix.length > 20000) break;
    }
    if (pix.length < 25 || pix.length > 20000) continue;
    // eje principal (PCA): largo y ancho del trazo
    let mx = 0, my = 0; for (const i of pix) { mx += i % w; my += (i / w) | 0; } mx /= pix.length; my /= pix.length;
    let sxx = 0, syy = 0, sxy = 0; for (const i of pix) { const dx = i % w - mx, dy = ((i / w) | 0) - my; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
    const ang = 0.5 * Math.atan2(2 * sxy, sxx - syy), ca = Math.cos(ang), sa = Math.sin(ang);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const i of pix) { const dx = i % w - mx, dy = ((i / w) | 0) - my, u = dx * ca + dy * sa, v = -dx * sa + dy * ca; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const len = u1 - u0, wid = v1 - v0 + 1;
    if (len < 18 || len / wid < 4) continue; // solo trazos alargados
    // máscara enderezada: 160 × 24 px, con la tinta como opacidad
    const S = document.createElement("canvas"); S.width = 160; S.height = 24;
    const sg = S.getContext("2d"), sd = sg.createImageData(160, 24);
    for (let yy = 0; yy < 24; yy++) for (let xx = 0; xx < 160; xx++) {
      const u = u0 + (xx / 159) * len, v = (yy / 23 - 0.5) * Math.max(wid * 1.4, 3);
      const px = Math.round(mx + u * ca - v * sa), py = Math.round(my + u * sa + v * ca);
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      const a = Math.max(0, Math.min(1, (thr - L[py * w + px]) / Math.max(0.05, thr - ink)));
      sd.data[(yy * 160 + xx) * 4 + 3] = Math.round(a * 255);
    }
    sg.putImageData(sd, 0, 0);
    out.push({ url: S.toDataURL("image/png"), ratio: len / wid });
  }
  // los más alargados primero
  return out.sort((a, b) => b.ratio - a.ratio).slice(0, max).map(o => o.url);
}

export async function loadBrushes(urls, ink) {
  return Promise.all(urls.map(u => new Promise(res => {
    const i = new Image(); i.onload = () => {
      const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d");
      g.drawImage(i, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = ink; g.fillRect(0, 0, c.width, c.height); res(c);
    }; i.onerror = () => res(null); i.src = u;
  }))).then(a => a.filter(Boolean));
}
