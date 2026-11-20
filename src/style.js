// Estilo aprendido: Arnés mide los dibujos de un artista (color de tinta y papel, grosor del trazo, cuánto
// raya y en qué dirección, separación, largo de los trazos, qué tan suelto es el contorno) y con esas medidas
// vuelve a dibujar la viñeta 3D: contornos vectorizados con su temblor y rayado con su ritmo.
// Funciona sin IA y en el teléfono; sirve para cualquier artista que suba sus páginas.

function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const lum = (r, g, b) => (0.299 * r + 0.587 * g + 0.114 * b) / 255;
const hex = c => "#" + c.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const median = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[(s.length / 2) | 0]; };
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, (s.length * p) | 0)]; };

async function toImageData(src, maxW = 1200) {
  const bmp = src instanceof Blob ? await createImageBitmap(src) : src;
  const k = Math.min(1, maxW / bmp.width), w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.drawImage(bmp, 0, 0, w, h);
  return g.getImageData(0, 0, w, h);
}
function blurF(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h), n = 2 * r + 1;
  for (let y = 0; y < h; y++) { let a = 0; for (let x = -r; x <= r; x++) a += src[y * w + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { tmp[y * w + x] = a / n; a += src[y * w + Math.min(w - 1, x + r + 1)] - src[y * w + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let a = 0; for (let y = -r; y <= r; y++) a += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { out[y * w + x] = a / n; a += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
  return out;
}

// ------------------------------------------------------------------ aprender
export async function analyzeDrawing(src) {
  const im = await toImageData(src), w = im.width, h = im.height, d = im.data, N = w * h;
  const L = new Float32Array(N);
  for (let i = 0; i < N; i++) L[i] = lum(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
  // el papel cambia de luz en la foto: se compara cada pixel con su papel local
  const bg = blurF(L, w, h, Math.max(8, (w / 40) | 0));
  const rel = new Float32Array(N); for (let i = 0; i < N; i++) rel[i] = Math.max(0, bg[i] - L[i]) / Math.max(0.05, bg[i]);
  const thr = Math.max(0.16, pct(Array.from(rel.filter((_, i) => i % 7 === 0)), 0.93) * 0.55);
  let mask = new Uint8Array(N); for (let i = 0; i < N; i++) mask[i] = rel[i] > thr ? 1 : 0;
  // renglones del cuaderno: filas con línea fina casi de lado a lado se borran
  for (let y = 1; y < h - 1; y++) {
    let c = 0; for (let x = 0; x < w; x++) c += mask[y * w + x];
    if (c > w * 0.28) for (let x = 0; x < w; x++) { const i = y * w + x; if (rel[i] < thr * 1.9 && !(mask[i - w] && mask[i + w])) mask[i] = 0; }
  }
  // limpiar puntos sueltos
  const clean = new Uint8Array(N);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (!mask[i]) continue; let n = 0; for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) n += mask[i + k * w + j]; if (n >= 3) clean[i] = 1; }
  mask = clean;
  let ink = [0, 0, 0], nInk = 0, paper = [0, 0, 0], nP = 0;
  const strong = pct(Array.from(rel.filter((_, i) => mask[i] && i % 3 === 0)), 0.6);
  for (let i = 0; i < N; i += 3) {
    if (mask[i] && rel[i] >= strong) { ink[0] += d[i * 4]; ink[1] += d[i * 4 + 1]; ink[2] += d[i * 4 + 2]; nInk++; }
    else if (!mask[i] && rel[i] < thr * 0.3) { paper[0] += d[i * 4]; paper[1] += d[i * 4 + 1]; paper[2] += d[i * 4 + 2]; nP++; }
  }
  ink = ink.map(v => v / Math.max(1, nInk)); paper = paper.map(v => v / Math.max(1, nP));
  // la foto oscurece el papel: se lleva a su luz real conservando el matiz; la tinta se satura un poco
  const pl = lum(...paper); if (pl > 0.05 && pl < 0.9) paper = paper.map(v => v * 0.93 / pl);
  { const m = (ink[0] + ink[1] + ink[2]) / 3; ink = ink.map(v => m + (v - m) * 1.6).map(v => v * 0.85); }
  // grosor: distancia al borde dentro de la tinta (chaflán) en los centros de los trazos
  const dist = new Float32Array(N); for (let i = 0; i < N; i++) dist[i] = mask[i] ? 1e9 : 0;
  for (let y = 1; y < h; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (dist[i]) dist[i] = Math.min(dist[i], dist[i - 1] + 1, dist[i - w] + 1, dist[i - w - 1] + 1.414, dist[i - w + 1] + 1.414); }
  for (let y = h - 2; y >= 0; y--) for (let x = w - 2; x > 0; x--) { const i = y * w + x; if (dist[i]) dist[i] = Math.min(dist[i], dist[i + 1] + 1, dist[i + w] + 1, dist[i + w + 1] + 1.414, dist[i + w - 1] + 1.414); }
  const widths = [];
  for (let y = 1; y < h - 1; y += 2) for (let x = 1; x < w - 1; x += 2) { const i = y * w + x, v = dist[i]; if (v > 0 && v >= dist[i - 1] && v >= dist[i + 1] && v >= dist[i - w] && v >= dist[i + w]) widths.push(v * 2 - 1); }
  // ventanas: orientación (tensor de estructura), cobertura, separación y largo de trazo
  const M = Float32Array.from(mask), gx = new Float32Array(N), gy = new Float32Array(N);
  const Mb = blurF(M, w, h, 1);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; gx[i] = Mb[i + 1] - Mb[i - 1]; gy[i] = Mb[i + w] - Mb[i - w]; }
  const win = Math.max(14, (w / 60) | 0);
  const hatch = [], contourWins = [];
  let hatchInk = 0, totalInk = 0, fills = 0, fillInk = 0;
  for (let y0 = 0; y0 + win < h; y0 += win) for (let x0 = 0; x0 + win < w; x0 += win) {
    let cov = 0, jxx = 0, jyy = 0, jxy = 0;
    for (let y = y0; y < y0 + win; y++) for (let x = x0; x < x0 + win; x++) { const i = y * w + x; cov += mask[i]; jxx += gx[i] * gx[i]; jyy += gy[i] * gy[i]; jxy += gx[i] * gy[i]; }
    cov /= win * win; totalInk += cov;
    if (cov < 0.02) continue;
    const tr = jxx + jyy, det = Math.sqrt((jxx - jyy) ** 2 + 4 * jxy * jxy), coh = tr > 1e-6 ? det / tr : 0;
    const ang = 0.5 * Math.atan2(2 * jxy, jxx - jyy) + Math.PI / 2; // dirección del trazo (perpendicular al gradiente)
    // cuántos trazos cruza una línea perpendicular al trazo, por el centro
    const nx = Math.cos(ang + Math.PI / 2), ny = Math.sin(ang + Math.PI / 2), cx = x0 + win / 2, cy = y0 + win / 2;
    let runs = 0, prev = 0;
    for (let t = -win / 2; t < win / 2; t++) { const x = (cx + nx * t) | 0, y = (cy + ny * t) | 0, m = mask[y * w + x] || 0; if (m && !prev) runs++; prev = m; }
    // largo de los trazos: carrera de tinta a lo largo de la dirección
    const tx = Math.cos(ang), ty = Math.sin(ang); let best = 0, cur = 0;
    for (let t = -win; t < win; t++) { const x = (cx + tx * t) | 0, y = (cy + ty * t) | 0; if (x < 0 || y < 0 || x >= w || y >= h) continue; if (mask[y * w + x]) { cur++; best = Math.max(best, cur); } else cur = 0; }
    const rec = { cov, coh, ang, runs, len: best, x: cx / w, y: cy / h };
    if (cov > 0.72) { fills++; fillInk += cov; }
    else if (runs >= 3 && cov > 0.07 && coh > 0.35) { hatch.push(rec); hatchInk += cov; } else contourWins.push(rec);
  }
  // ángulo dominante del rayado (promedio circular del doble ángulo)
  let sx = 0, sy = 0; for (const r of hatch) { sx += Math.cos(2 * r.ang) * r.cov; sy += Math.sin(2 * r.ang) * r.cov; }
  const domAng = 0.5 * Math.atan2(sy, sx), R = hatch.length ? Math.hypot(sx, sy) / hatch.reduce((a, r) => a + r.cov, 0) : 0;
  const wMed = pct(widths, 0.75), wSpread = widths.length ? (pct(widths, 0.85) - pct(widths, 0.15)) / Math.max(1, wMed) : 0.5;
  const spacing = hatch.length ? median(hatch.map(r => win / Math.max(1, r.runs))) : win / 3;
  // tono de medio gris (aguadas, rayado fino que la foto funde): decide si el artista pinta el tono o solo lo sugiere
  let mid = 0, dsum = 0, nS = 0;
  for (let i = 0; i < N; i += 5) { const r = rel[i]; dsum += Math.min(1, r / Math.max(0.05, thr * 2)); if (r > 0.05 && r < thr) mid++; nS++; }
  return {
    midTone: mid / nS, darkMean: dsum / nS,
    w, h, ink, paper, coverage: M.reduce((a, b) => a + b, 0) / N,
    widthRel: Math.max(0.8, wMed) / w, widthVar: Math.min(1.5, wSpread),
    hatchFrac: totalInk > 0 ? hatchInk / totalInk : 0, fillFrac: totalInk > 0 ? fillInk / totalInk : 0, hatchAngle: domAng, angleConsistency: R,
    spacingRel: spacing / w, lenRel: median(hatch.map(r => r.len)) / w || 0.03, hatchCov: pct(hatch.map(r => r.cov), 0.9) || 0.3,
    contourCoh: median(contourWins.map(r => r.coh)) || 0.5, samples: hatch.length + contourWins.length,
  };
}
// Varias páginas del mismo artista → un perfil (promedios ponderados por cuánta tinta mide cada una)
export async function learnStyle(files, name = "Mi estilo") {
  const parts = [];
  for (const f of files) parts.push(await analyzeDrawing(f));
  const W = parts.map(p => Math.max(1, p.samples)), S = W.reduce((a, b) => a + b, 0);
  const avg = k => parts.reduce((a, p, i) => a + p[k] * W[i], 0) / S;
  const avgC = k => [0, 1, 2].map(j => parts.reduce((a, p, i) => a + p[k][j] * W[i], 0) / S);
  let sx = 0, sy = 0; parts.forEach((p, i) => { sx += Math.cos(2 * p.hatchAngle) * p.angleConsistency * W[i]; sy += Math.sin(2 * p.hatchAngle) * p.angleConsistency * W[i]; });
  const consistency = Math.hypot(sx, sy) / S;
  const coh = avg("contourCoh");
  return {
    name, learned: true, pages: parts.length, at: Date.now(),
    ink: hex(avgC("ink")), paper: hex(avgC("paper")),
    widthRel: avg("widthRel"), widthVar: avg("widthVar"),
    hatchFrac: avg("hatchFrac"), fillFrac: avg("fillFrac"), hatchAngle: 0.5 * Math.atan2(sy, sx), follow: consistency < 0.35, angleConsistency: consistency,
    spacingRel: avg("spacingRel"), lenRel: avg("lenRel"), hatchCov: avg("hatchCov"), coverage: avg("coverage"),
    // un contorno poco coherente (muchas líneas que se cruzan) es un contorno suelto, con varias pasadas
    midTone: avg("midTone"), darkMean: avg("darkMean"), engine: avg("midTone") > 0.14 || avg("darkMean") > 0.2 ? "grabado" : "pluma",
    jitter: Math.max(0.15, Math.min(1, (0.75 - coh) * 2)), passes: 1 + Math.max(0, Math.min(1.5, (0.7 - coh) * 3)),
  };
}
export function describeStyle(p) {
  const deg = Math.round(((p.hatchAngle * 180 / Math.PI) % 180 + 180) % 180);
  const out = [];
  out.push(`Tinta ${p.ink} sobre papel ${p.paper}.`);
  out.push(`Trazo de ${(p.widthRel * 1000).toFixed(1)} milésimas del ancho de la página${p.widthVar > 0.7 ? ", con mucha presión variable" : ""}.`);
  const tonal = p.hatchFrac + (p.fillFrac || 0);
  out.push(tonal < 0.25 ? "Dibuja sobre todo con contorno y raya poco." : (p.fillFrac || 0) > 0.3 ? "Usa negros grandes y rayado para el tono." : tonal < 0.55 ? "Combina contorno y rayado." : "Construye el tono con mucho rayado.");
  out.push(p.follow ? "El rayado sigue la forma." : `El rayado va casi siempre a ${deg}°.`);
  out.push(p.passes > 1.6 ? "Contorno suelto, con varias pasadas." : "Contorno de una pasada, firme.");
  out.push(p.engine === "grabado" ? "Construye el tono como grabado: Arnés usa el grabado con tu papel y tu tinta, y encima tu contorno." : "Arnés dibuja el tono con tu rayado, sin grabado debajo.");
  return out;
}

// ------------------------------------------------------------------ dibujar con el estilo
// Adelgaza la máscara de líneas (Zhang-Suen) y la recorre en cadenas de puntos
function thin(m, w, h) {
  let changed = true; const del = [];
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : m[y * w + x]);
  for (let it = 0; changed && it < 20; it++) {
    changed = false;
    for (const step of [0, 1]) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        if (!m[y * w + x]) continue;
        const p = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)];
        const B = p.reduce((a, b) => a + b, 0); if (B < 2 || B > 6) continue;
        let A = 0; for (let k = 0; k < 8; k++) if (!p[k] && p[(k + 1) % 8]) A++;
        if (A !== 1) continue;
        if (step === 0 ? (p[0] * p[2] * p[4] || p[2] * p[4] * p[6]) : (p[0] * p[2] * p[6] || p[0] * p[4] * p[6])) continue;
        del.push(y * w + x);
      }
      if (del.length) changed = true;
      for (const i of del) m[i] = 0;
    }
  }
  return m;
}
function trace(m, w, h, minLen) {
  const seen = new Uint8Array(w * h), chains = [];
  const nb = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const deg = (x, y) => { let n = 0; for (const [dx, dy] of nb) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && m[Y * w + X]) n++; } return n; };
  const walk = (x, y) => {
    const pts = [[x, y]]; seen[y * w + x] = 1;
    for (;;) {
      let nx = -1, ny = -1;
      for (const [dx, dy] of nb) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && m[Y * w + X] && !seen[Y * w + X]) { nx = X; ny = Y; break; } }
      if (nx < 0) break; x = nx; y = ny; seen[y * w + x] = 1; pts.push([x, y]);
    }
    return pts;
  };
  // primero desde las puntas, luego lo que quede (lazos)
  for (const ends of [true, false]) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (!m[i] || seen[i]) continue;
    if (ends && deg(x, y) !== 1) continue;
    const c = walk(x, y); if (c.length >= minLen) chains.push(c);
  }
  return chains;
}
function smoothChain(c, k = 2) {
  const out = c.map(p => p.slice());
  for (let it = 0; it < k; it++) for (let i = 1; i < out.length - 1; i++) { out[i][0] = (out[i - 1][0] + out[i][0] * 2 + out[i + 1][0]) / 4; out[i][1] = (out[i - 1][1] + out[i][1] * 2 + out[i + 1][1]) / 4; }
  // menos puntos: uno cada ~3 px
  const res = [out[0]]; let acc = 0;
  for (let i = 1; i < out.length; i++) { acc += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1]); if (acc >= 3 || i === out.length - 1) { res.push(out[i]); acc = 0; } }
  return res;
}
// Un trazo de tinta: polígono con presión (afinado en las puntas) y temblor de mano
function strokePoly(g, pts, width, rand, wobble) {
  if (pts.length < 2) return;
  const left = [], right = [], n = pts.length, ph = rand() * 6.28, fr = 0.05 + rand() * 0.08;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const tm = Math.hypot(tx, ty) || 1; tx /= tm; ty /= tm;
    const t = n > 1 ? i / (n - 1) : 0.5;
    const press = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, t * 0.9 + 0.05))), 0.45);
    const wi = width * press * (0.85 + 0.3 * Math.sin(i * 0.7 + ph));
    const off = Math.sin(i * fr * 6 + ph) * wobble;
    const px = pts[i][0] - ty * off, py = pts[i][1] + tx * off;
    left.push([px - ty * wi / 2, py + tx * wi / 2]); right.push([px + ty * wi / 2, py - tx * wi / 2]);
  }
  g.beginPath(); g.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < n; i++) g.lineTo(left[i][0], left[i][1]);
  for (let i = n - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]);
  g.closePath(); g.fill();
}
function toneOf(canvas, w, h) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d"); g.drawImage(canvas, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data, L = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) L[i] = lum(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
  return L;
}
// line: imagen de contornos (líneas oscuras sobre blanco). tone: render sombreado. Devuelve un canvas
export async function drawInStyle(line, tone, p, { seed = 7, mask = null, onProgress, features = null, under = null } = {}) {
  const W = line.width, Hh = line.height, rand = rng(seed);
  const out = document.createElement("canvas"); out.width = W; out.height = Hh;
  const g = out.getContext("2d");
  g.fillStyle = p.paper || "#f3efe6"; g.fillRect(0, 0, W, Hh);
  if (under) g.drawImage(under, 0, 0, W, Hh);
  // grano del papel
  const grain = g.getImageData(0, 0, W, Hh);
  if (!under)
  for (let i = 0; i < grain.data.length; i += 4) { const n = (rand() - 0.5) * 10; grain.data[i] += n; grain.data[i + 1] += n; grain.data[i + 2] += n; }
  g.putImageData(grain, 0, 0);
  g.fillStyle = p.ink || "#2a2a6a";
  const width = Math.max(1.3, p.widthRel * W * 1.15);
  // --- rayado
  const sc = 2, w = Math.round(W / sc), h = Math.round(Hh / sc);
  const L = toneOf(tone, w, h);
  const S = blurF(L, w, h, Math.max(2, (w / 200) | 0));
  // el fondo vacío no se raya: zona de objetos = donde el tono no es el papel del render
  const bgL = pct(Array.from(L.filter((_, i) => i % 11 === 0)), 0.98);
  const amount = Math.min(1, 0.25 + p.hatchFrac * 1.6);          // cuánto raya este artista
  const startT = 0.38 + amount * 0.32;                              // desde qué tono empieza a rayar
  const spacing = Math.max(2.2, p.spacingRel * W / sc);
  const len = Math.max(spacing * 3, p.lenRel * W / sc * 1.1);
  const baseAng = p.hatchAngle ?? 1.0;
  const layers = [{ t: startT, rot: 0 }, { t: startT * 0.62, rot: p.follow ? 0.9 : 0.55 }, { t: startT * 0.36, rot: p.follow ? -0.8 : -0.5 }];
  let count = 0;
  for (const [li, layer] of (under ? [] : layers).entries()) {
    const s = spacing * (1.15 - li * 0.12);
    for (let gy = 0; gy < h; gy += s) for (let gx = 0; gx < w; gx += s * 0.9) {
      const x0 = gx + (rand() - 0.5) * s, y0 = gy + (rand() - 0.5) * s;
      const i0 = (Math.min(h - 1, y0 | 0)) * w + Math.min(w - 1, Math.max(0, x0 | 0)), t0 = L[i0];
      if (t0 > layer.t || t0 >= bgL - 0.01) continue;
      if (mask && !mask(x0 * sc, y0 * sc)) continue;
      const dark = (layer.t - t0) / layer.t;
      if (rand() > 0.15 + dark * 0.85) continue;
      // dirección: fija con temblor (la del artista) o siguiendo la forma
      let ang;
      if (p.follow) {
        const xi = Math.min(w - 2, Math.max(1, x0 | 0)), yi = Math.min(h - 2, Math.max(1, y0 | 0));
        const gxv = S[yi * w + xi + 1] - S[yi * w + xi - 1], gyv = S[(yi + 1) * w + xi] - S[(yi - 1) * w + xi];
        ang = Math.atan2(gyv, gxv) + Math.PI / 2 + layer.rot;
      } else ang = baseAng + layer.rot + (rand() - 0.5) * (1 - (p.angleConsistency || 0.5)) * 0.9;
      const l = len * (0.55 + rand() * 0.7) * (0.7 + dark * 0.5);
      const ca = Math.cos(ang), sa = Math.sin(ang), pts = [];
      for (let d = -l / 2; d <= l / 2; d += 1.5) {
        const x = x0 + ca * d, y = y0 + sa * d; if (x < 0 || y < 0 || x >= w || y >= h) continue;
        if (L[(y | 0) * w + (x | 0)] > layer.t + 0.08) { if (pts.length > 2) break; else continue; }
        pts.push([x * sc, y * sc]);
      }
      if (pts.length < 3) continue;
      // rayado de bolígrafo: a veces cierra con un ganchito
      if (rand() < 0.25) { const e = pts.at(-1); pts.push([e[0] - sa * 2.5 + ca * 1.5, e[1] + ca * 2.5 + sa * 1.5]); }
      g.globalAlpha = 0.55 + rand() * 0.35;
      strokePoly(g, pts, width * (0.6 + dark * 0.35) * (1 + (rand() - 0.5) * p.widthVar * 0.5), rand, 0.4 * p.jitter);
      if (++count % 3000 === 0) { onProgress?.(0.5 * (li + gy / h) / layers.length); await new Promise(r => setTimeout(r, 0)); }
    }
  }
  // --- negros: si el artista los usa, las sombras más hondas se llenan de tinta con orilla irregular
  if (!under && (p.fillFrac || 0) > 0.08) {
    const fillT = 0.12 + p.fillFrac * 0.35, img = g.getImageData(0, 0, W, Hh), ink = hexRgb(p.ink);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const t = S[Math.min(h - 1, (y / sc) | 0) * w + Math.min(w - 1, (x / sc) | 0)];
      if (t >= fillT || t >= bgL - 0.02) continue;
      const a = Math.min(1, (fillT - t) / 0.06) * (0.85 + rand() * 0.15), i = (y * W + x) * 4;
      img.data[i] += (ink[0] - img.data[i]) * a; img.data[i + 1] += (ink[1] - img.data[i + 1]) * a; img.data[i + 2] += (ink[2] - img.data[i + 2]) * a;
    }
    g.putImageData(img, 0, 0);
  }
  // --- rasgos oscuros (ojos, cejas, cabello, barba): se rellenan con trazo corto que sigue su forma,
  // como hace un dibujante, en vez de dejarlos al contorno
  if (features) {
    const fw = Math.round(W / 2), fh = Math.round(Hh / 2), F = toneOf(features, fw, fh), Fb = blurF(F, fw, fh, 1);
    const fbg = pct(Array.from(F.filter((_, i) => i % 13 === 0)), 0.98);
    const inten = p.featureBold ?? Math.min(1, 0.45 + (p.fillFrac || 0) * 1.2 + (p.hatchFrac || 0) * 0.4);
    const step = Math.max(1.5, width * 0.7 / 2);
    for (let y = 1; y < fh - 1; y += step) for (let x = 1; x < fw - 1; x += step) {
      const xi = x | 0, yi = y | 0, i = yi * fw + xi, t = F[i];
      if (t > 0.24 || Math.abs(t - fbg) < 0.02) continue;
      if (rand() > inten * (1.1 - t * 2.5)) continue;
      const gx = Fb[i + 1] - Fb[i - 1], gy = Fb[i + fw] - Fb[i - fw];
      const a = Math.atan2(gy, gx) + Math.PI / 2 + (rand() - 0.5) * 0.5, l = (3 + rand() * 6) * (1 + (0.24 - t) * 3);
      const X = x * 2, Y = y * 2, ca = Math.cos(a), sa = Math.sin(a);
      g.globalAlpha = 0.6 + rand() * 0.35;
      strokePoly(g, [[X - ca * l, Y - sa * l], [X, Y], [X + ca * l, Y + sa * l]], width * (0.75 + (0.24 - t) * 2), rand, 0.3);
      if (t < 0.09 && rand() < 0.5) { g.beginPath(); g.arc(X, Y, width * 1.2, 0, 6.283); g.fill(); }
    }
    g.globalAlpha = 1;
  }
  // --- contorno: se vectoriza y se vuelve a trazar con la mano del artista
  const lc = line.getContext("2d").getImageData(0, 0, W, Hh).data, lm = new Uint8Array(W * Hh);
  for (let i = 0; i < W * Hh; i++) lm[i] = lc[i * 4 + 3] > 40 && lum(lc[i * 4], lc[i * 4 + 1], lc[i * 4 + 2]) < 0.55 ? 1 : 0;
  // rasgos que el contorno 3D no ve (cejas, párpados, labios): bordes fuertes del color
  if (features) {
    const F = toneOf(features, W, Hh), fb = blurF(F, W, Hh, 1);
    for (let y = 1; y < Hh - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x, gx = fb[i + 1] - fb[i - 1], gy = fb[i + W] - fb[i - W];
      if (Math.hypot(gx, gy) > 0.13) lm[i] = 1;
    }
  }
  thin(lm, W, Hh);
  const chains = trace(lm, W, Hh, Math.max(6, (W / 110) | 0));
  onProgress?.(0.6); await new Promise(r => setTimeout(r, 0));
  const jit = p.jitter * width * 1.4;
  for (const c of chains) {
    const sm = smoothChain(c, 2); if (sm.length < 2) continue;
    // trazos largos se parten en tramos, como una mano que levanta la pluma
    const seg = Math.max(8, Math.round((p.lenRel * W * 3.5) / 3));
    for (let a = 0; a < sm.length - 1; a += seg) {
      const part = sm.slice(Math.max(0, a - 1), Math.min(sm.length, a + seg + 2));
      if (part.length < 2) continue;
      const passes = Math.max(1, Math.round(p.passes + (rand() - 0.5)));
      for (let k = 0; k < passes; k++) {
        const ox = (rand() - 0.5) * jit * (k ? 1.6 : 0.6), oy = (rand() - 0.5) * jit * (k ? 1.6 : 0.6);
        // a veces se pasa de largo en la punta
        const pts = part.map(q => [q[0] + ox, q[1] + oy]);
        if (rand() < 0.35 && pts.length > 2) { const e = pts.at(-1), f = pts.at(-2), dx = e[0] - f[0], dy = e[1] - f[1], m = Math.hypot(dx, dy) || 1; pts.push([e[0] + dx / m * width * 3, e[1] + dy / m * width * 3]); }
        g.globalAlpha = k ? 0.45 + rand() * 0.3 : 0.8 + rand() * 0.2;
        strokePoly(g, pts, width * (k ? 0.7 : 1.05), rand, jit * 0.25);
      }
    }
  }
  g.globalAlpha = 1;
  onProgress?.(1);
  return out;
}

function hexRgb(h) { const n = parseInt((h || "#222").slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }

// ------------------------------------------------------------------ parámetros abiertos
// Cada valor del estilo se puede mover a mano; también se mezclan dos estilos
export const STYLE_PARAMS = [
  ["widthRel", "Grosor del trazo", 0.0004, 0.006, 0.0001], ["widthVar", "Presión variable", 0, 1.5, 0.05],
  ["passes", "Pasadas del contorno", 1, 3, 0.1], ["jitter", "Temblor de la mano", 0, 1, 0.05],
  ["hatchFrac", "Cuánto raya", 0, 1, 0.02], ["fillFrac", "Negros (manchas)", 0, 1, 0.02],
  ["hatchAngleDeg", "Ángulo del rayado", 0, 180, 1], ["angleConsistency", "Rayado parejo ↔ libre", 0, 1, 0.05],
  ["spacingRel", "Separación del rayado", 0.002, 0.03, 0.0005], ["lenRel", "Largo de los trazos", 0.005, 0.1, 0.001],
  ["featureBold", "Ojos, cejas y cabello oscuros", 0, 1, 0.05],
];
export function getParam(p, k) { if (k === "hatchAngleDeg") return Math.round((((p.hatchAngle ?? 1) * 180 / Math.PI) % 180 + 180) % 180); if (k === "featureBold") return p.featureBold ?? Math.min(1, 0.45 + (p.fillFrac || 0) * 1.2 + (p.hatchFrac || 0) * 0.4); return p[k]; }
export function setParam(p, k, v) { if (k === "hatchAngleDeg") p.hatchAngle = v * Math.PI / 180; else p[k] = v; }
export function mixStyles(a, b, t = 0.5, name) {
  const out = { ...a, name: name || `${a.name} + ${b.name}`, pages: (a.pages || 0) + (b.pages || 0), at: Date.now(), mix: [a.name, b.name, t] };
  for (const [k] of STYLE_PARAMS) { const va = getParam(a, k), vb = getParam(b, k); if (typeof va === "number" && typeof vb === "number") setParam(out, k, va * (1 - t) + vb * t); }
  const lerpHex = (x, y) => { const A = hexRgb(x), B = hexRgb(y); return "#" + A.map((v, i) => Math.round(v * (1 - t) + B[i] * t).toString(16).padStart(2, "0")).join(""); };
  out.ink = lerpHex(a.ink, b.ink); out.paper = lerpHex(a.paper, b.paper);
  out.engine = t < 0.5 ? a.engine : b.engine; out.follow = t < 0.5 ? a.follow : b.follow;
  return out;
}
