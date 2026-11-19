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

export async function drawStrokes(base, tone, { ink = "#2a1d12", spacing = 6, lineVar = 0.7, seed = 7, onProgress } = {}) {
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
export async function aiFinish(render, refDataUrl, { key, imageModel }, notes = "") {
  const toB64 = c => { const k = Math.min(1, 1280 / Math.max(c.width, c.height)); const t = document.createElement("canvas"); t.width = Math.round(c.width * k); t.height = Math.round(c.height * k); t.getContext("2d").drawImage(c, 0, 0, t.width, t.height); return t.toDataURL("image/jpeg", 0.9).split(",")[1]; };
  const parts = [{ text: "Imagen 1: render 3D de una viñeta de cómic (composición, cámara, poses, luz y sombras ya decididas por el artista)." }, { inline_data: { mime_type: "image/jpeg", data: toB64(render) } }];
  if (refDataUrl) parts.push({ text: "Imagen 2: página dibujada por el mismo artista, referencia de su estilo." }, { inline_data: { mime_type: "image/jpeg", data: refDataUrl.split(",")[1] } });
  parts.push({ text: `Redibuja la imagen 1 como una viñeta terminada a mano${refDataUrl ? " con el estilo exacto de la imagen 2 (tipo de trazo, rayado, manejo de negros, textura del papel y paleta)" : ", con plumilla y tinta"}. Conserva exactamente la composición, el encuadre, la cantidad de personajes, sus poses, la dirección de la luz y las sombras. Convierte los maniquíes en personas con piel, rasgos y ropa coherentes con la escena. No agregues texto, globos, firmas ni marcos. ${notes}` });
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(imageModel || AI_IMAGE_MODEL)}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["TEXT", "IMAGE"] } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 400 && /api key/i.test(j.error?.message || "")) throw new Error("Gemini no aceptó la clave. Revísala en Google AI Studio.");
    if (r.status === 404) throw new Error(`Gemini no encontró el modelo de imagen «${imageModel}». Prueba con ${AI_IMAGE_MODEL}.`);
    if (r.status === 429) throw new Error("Se acabó tu cuota de imágenes de Gemini por ahora. Espera o revisa tu plan.");
    throw new Error("Gemini no pudo hacer el acabado. Intenta de nuevo en un momento.");
  }
  const img = j.candidates?.[0]?.content?.parts?.find(p => p.inline_data || p.inlineData);
  const data = img && (img.inline_data || img.inlineData);
  if (!data) throw new Error("Gemini respondió sin imagen. Prueba otra vez o cambia la referencia.");
  return `data:${data.mime_type || data.mimeType || "image/png"};base64,${data.data}`;
}
