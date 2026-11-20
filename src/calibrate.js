import { askJSON, askImage } from "./ai.js";
// Calibrar un estilo de artista desde una página suya: primero un análisis local (gratis, sin internet)
// y, si el artista puso su clave de Gemini, una lectura con IA que afina los parámetros.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const hex = ([r, g, b]) => "#" + [r, g, b].map(x => Math.round(clamp(x, 0, 255)).toString(16).padStart(2, "0")).join("");

async function loadImage(file, max) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally { URL.revokeObjectURL(url); }
}

// Lectura local: color del papel y de la tinta, cuánta mancha de negro, separación del rayado, grano y saturación
export async function analyzeLocal(file) {
  const c = await loadImage(file, 1400), w = c.width, h = c.height;
  const d = c.getContext("2d").getImageData(0, 0, w, h).data;
  const n = w * h, L = new Float32Array(n), S = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
    L[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const mx = Math.max(r, g, b); S[i] = mx > 30 ? (mx - Math.min(r, g, b)) / mx : 0; // saturación HSV: también ve el color en las sombras
  }
  const sorted = Float32Array.from(L).sort();
  const pct = p => sorted[Math.floor(clamp(p, 0, 0.999) * n)];
  const hi = pct(0.85), lo = pct(0.05), mid = (pct(0.9) + pct(0.08)) / 2;
  const paper = [0, 0, 0], ink = [0, 0, 0]; let np = 0, ni = 0, dark = 0, satSum = 0, gSum = 0, gSq = 0;
  for (let i = 0; i < n; i++) {
    if (L[i] >= hi) { paper[0] += d[i * 4]; paper[1] += d[i * 4 + 1]; paper[2] += d[i * 4 + 2]; np++; gSum += L[i]; gSq += L[i] * L[i]; }
    if (L[i] <= lo) { ink[0] += d[i * 4]; ink[1] += d[i * 4 + 1]; ink[2] += d[i * 4 + 2]; ni++; }
    if (L[i] < mid) dark++;
    satSum += S[i];
  }
  paper.forEach((_, k) => (paper[k] /= Math.max(np, 1))); ink.forEach((_, k) => (ink[k] /= Math.max(ni, 1)));
  const darkFrac = dark / n, meanSat = satSum / n;
  const gMean = gSum / Math.max(np, 1), grainStd = Math.sqrt(Math.max(0, gSq / Math.max(np, 1) - gMean * gMean));
  // Separación del rayado: largo medio de los tramos claro/oscuro en filas de tonos medios
  let runs = 0, runLen = 0;
  for (let y = 2; y < h - 2; y += 5) {
    let prev = L[y * w] < mid, len = 0;
    for (let x = 1; x < w; x++) {
      const v = L[y * w + x], cur = v < mid; len++;
      if (cur !== prev) { if (len >= 1 && len <= 8 && v > lo + 0.05 && v < hi - 0.05) { runs++; runLen += len; } prev = cur; len = 0; }
    }
  }
  const period = runs ? (runLen / runs) * 2 : 8;
  // una viñeta ocupa cerca de la mitad del alto de la página; el visor muestra una viñeta en ~900 px
  const hatch = clamp(period * (900 / (h * 0.45)) * 0.6, 3, 7);
  const color = meanSat > 0.22;
  // los negros del cómic de color plano son neutros; en una ilustración pintada las sombras llevan color
  let ds = 0, dn = 0; for (let i = 0; i < n; i += 2) if (L[i] < 0.3 && L[i] > 0.03) { ds += S[i]; dn++; }
  const darkTint = dn ? ds / dn : 0;
  const painted = color && darkTint > 0.3;
  const report = [];
  report.push(`Papel ${hex(paper)} y tinta ${hex(ink)}.`);
  report.push(`Mancha oscura en el ${Math.round(darkFrac * 100)} % de la página.`);
  report.push(painted ? "Imagen pintada a color: se calibra como pintura, con tus tintes de sombra y de luz." : color ? "Página de color plano: se calibra como color dinámico." : `Página monocroma, rayado cada ${hatch.toFixed(1)} px a tamaño de pantalla.`);
  const th = clamp(0.3 + darkFrac * 0.4, 0.25, 0.75);
  let view;
  if (painted) {
    const tint = (from, to) => { const s = [0, 0, 0]; let k = 0; for (let i = 0; i < n; i += 3) if (L[i] >= from && L[i] <= to) { s[0] += d[i * 4]; s[1] += d[i * 4 + 1]; s[2] += d[i * 4 + 2]; k++; } return s.map(v => v / Math.max(k, 1)); };
    const norm = (c, target) => { const l = (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255 || 0.01; return c.map(v => v * target / l); };
    view = { mode: "pintura", th, thick: 1, outline: true, lineVar: 0.5, detail: 0.5, grain: +clamp(grainStd * 10 + 0.3, 0.2, 1).toFixed(2), shadeTint: hex(norm(tint(pct(0.05), pct(0.35)), 0.3)), lightTint: hex(norm(tint(pct(0.85), 1), 0.88)) };
  } else if (color) {
    const sat = []; for (let i = 0; i < n; i += 2) if (S[i] > 0.35) sat.push(i);
    sat.sort((a, b) => L[b] - L[a]);
    const avg = arr => { const s = [0, 0, 0]; arr.forEach(i => { s[0] += d[i * 4]; s[1] += d[i * 4 + 1]; s[2] += d[i * 4 + 2]; }); return s.map(v => v / Math.max(arr.length, 1)); };
    const third = Math.max(1, Math.floor(sat.length / 3));
    view = { mode: "dinamico", th, thick: 1.75, outline: true, lineVar: 0.6, burst: true, burstA: sat.length ? hex(avg(sat.slice(0, third))) : "#ffb36b", burstB: sat.length ? hex(avg(sat.slice(-third))) : "#d23c35" };
  } else {
    view = { mode: "grabado", th, thick: clamp(0.8 + darkFrac * 1.2, 0.75, 2.5), outline: true, hatch: +hatch.toFixed(1), grain: +clamp(grainStd * 14, 0.1, 1).toFixed(2), lineVar: 0.7, paper: hex(paper), sepia: hex(ink), background: "papel" };
  }
  return { view, report, canvas: c };
}

// Lectura con Gemini: devuelve los mismos parámetros, ajustados por un modelo que ve la página
const PROMPT = `Eres un asistente de entintado para cómic. Mira esta página de un artista y propone parámetros para que un render 3D imite su estilo.
Responde SOLO un JSON con estas claves:
- "mode": "grabado" (blanco y negro o sepia, con plumilla y rayado), "dinamico" (color plano saturado con negros de sombra, estilo cómic) o "pintura" (ilustración pintada a color, con degradados, atmósfera, noche o niebla)
- "th": 0.2 a 0.85, cuánta sombra hay (más alto = más negro)
- "thick": 0.75 a 3, grosor base de la línea en píxeles
- "lineVar": 0 a 1, cuánto varía el grosor de la línea (0 = línea técnica pareja, 1 = pincel muy vivo)
- "hatch": 3 a 12, separación del rayado en píxeles a tamaño de pantalla (solo grabado)
- "grain": 0 a 1, textura y envejecido del papel (solo grabado)
- "paper": color del papel en #rrggbb, "sepia": color de la tinta en #rrggbb (solo grabado)
- "burstA": color claro dominante en #rrggbb, "burstB": color oscuro o de orilla en #rrggbb (solo dinamico)
- "shadeTint": color de las sombras en #rrggbb, "lightTint": color de las luces en #rrggbb (solo pintura)
- "grain": también vale para pintura: cuánta textura de pincel se nota
- "nombre": un nombre corto para el estilo, en español
- "notas": dos frases en español sobre lo que caracteriza el trazo (línea, negros, rayado, textura)`;

export const AI_DEFAULT_MODEL = "gemini-3.5-flash-lite";

export async function analyzeAI(canvas, { key, model }, local) {
  const big = document.createElement("canvas"), k = Math.min(1, 1024 / Math.max(canvas.width, canvas.height));
  big.width = Math.round(canvas.width * k); big.height = Math.round(canvas.height * k);
  big.getContext("2d").drawImage(canvas, 0, 0, big.width, big.height);
  let o, via;
  try { ({ json: o, via } = await askJSON([big.toDataURL("image/jpeg", 0.85)], PROMPT + `\nLa lectura automática local propuso: ${JSON.stringify(local)}. Corrígela si no coincide con la página.`)); }
  catch (e) { throw new Error(e.message + " Se usó solo la lectura local."); }
  const isHex = v => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
  const num = (v, a, b, def) => (typeof v === "number" && isFinite(v) ? clamp(v, a, b) : def);
  const mode = ["dinamico", "grabado", "pintura"].includes(o.mode) ? o.mode : local.mode;
  const view = { ...local, mode, th: num(o.th, 0.2, 0.85, local.th), thick: num(o.thick, 0.75, 3, local.thick), lineVar: num(o.lineVar, 0, 1, local.lineVar ?? 0.6) };
  if (mode === "grabado") Object.assign(view, { hatch: num(o.hatch, 3, 12, local.hatch ?? 5), grain: num(o.grain, 0, 1, local.grain ?? 0.6), paper: isHex(o.paper) ? o.paper : local.paper || "#e6d3ae", sepia: isHex(o.sepia) ? o.sepia : local.sepia || "#2a1d12", background: "papel" });
  else if (mode === "pintura") Object.assign(view, { grain: num(o.grain, 0, 1, local.grain ?? 0.6), detail: local.detail ?? 0.5, shadeTint: isHex(o.shadeTint) ? o.shadeTint : local.shadeTint || "#1f3550", lightTint: isHex(o.lightTint) ? o.lightTint : local.lightTint || "#d8ecff" });
  else Object.assign(view, { burst: true, burstA: isHex(o.burstA) ? o.burstA : local.burstA || "#ffb36b", burstB: isHex(o.burstB) ? o.burstB : local.burstB || "#d23c35" });
  return { view, via, name: typeof o.nombre === "string" ? o.nombre.slice(0, 40) : "", notes: typeof o.notas === "string" ? o.notas.slice(0, 400) : "" };
}
