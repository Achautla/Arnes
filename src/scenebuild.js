// Viñeta → escena: Gemini lee el dibujo de una viñeta y devuelve una lista estructurada de lo que hay,
// usando solo piezas del catálogo de Arnés. La app la muestra para revisar y después arma la escena.
// Además pide los puntos del esqueleto de cada personaje sobre el dibujo, para afinar la pose.

const KP = ["cabeza", "cuello", "hombro_i", "hombro_d", "codo_i", "codo_d", "muneca_i", "muneca_d", "cadera", "rodilla_i", "rodilla_d", "tobillo_i", "tobillo_d"];
export const KP_LABELS = { cabeza: "Cabeza", cuello: "Cuello", hombro_i: "Hombro izq.", hombro_d: "Hombro der.", codo_i: "Codo izq.", codo_d: "Codo der.", muneca_i: "Muñeca izq.", muneca_d: "Muñeca der.", cadera: "Cadera", rodilla_i: "Rodilla izq.", rodilla_d: "Rodilla der.", tobillo_i: "Tobillo izq.", tobillo_d: "Tobillo der." };

export async function readPanel(dataUrl, { key, model }, cat) {
  const list = o => Object.entries(o).map(([k, v]) => `${k} (${typeof v === "string" ? v : v.label})`).join(", ");
  const prompt = `Eres asistente de un dibujante de cómic. Esta imagen es UNA viñeta dibujada por él. Tradúcela a una escena 3D usando SOLO estas piezas:
- poses: ${list(cat.poses)}
- expresiones: ${list(cat.expressions)}
- cuerpos: ${list(cat.bodies)}
- tonos de piel: ${list(cat.skins)}
- ropa: ${list(cat.garments)}
- objetos: ${list(cat.props)}
- escenarios: ${list(cat.scenarios)}
- luces: ${list(cat.lights)}
Responde SOLO un JSON con esta forma:
{"plano": "detalle|primer|medio|americano|general", "angulo": "normal|picado|contrapicado|ras", "lente_mm": 14 a 135, "inclinacion": grados de cámara holandesa (0 si no hay),
 "escenario": clave o null, "luz": clave, "efecto": "ninguno|velocidad|enfoque|impacto|lluvia",
 "personajes": [{"nombre": texto corto, "principal": true/false, "x": 0 a 1 posición horizontal de los pies, "pies_y": 0 a 1 altura de los pies en la viñeta (puede pasar de 1 si están fuera de cuadro),
   "giro": grados (0 = de frente a la cámara, 90 = mira hacia la derecha de la viñeta, -90 = hacia la izquierda, 180 = de espaldas),
   "pose": clave, "expresion": clave, "cuerpo": clave, "piel": clave, "ropa": [{"tipo": clave, "color": "#rrggbb"}],
   "puntos": {${KP.map(k => `"${k}": [x, y]`).join(", ")}} en 0 a 1 sobre la viñeta (x a la derecha, y hacia abajo; izquierda y derecha son las del personaje; omite los que no se ven)}],
 "objetos": [{"tipo": clave, "x": 0 a 1, "base_y": 0 a 1 donde toca el piso, "escala": 0.5 a 2}],
 "notas": una frase en español con lo que no se pudo representar con el catálogo}`;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ inline_data: { mime_type: "image/jpeg", data: dataUrl.split(",")[1] } }, { text: prompt }] }], generationConfig: { responseMimeType: "application/json" } }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(r.status === 429 ? "Se acabó tu cuota de Gemini por ahora." : r.status === 400 ? "Gemini no aceptó la clave." : r.status === 404 ? `Gemini no encontró el modelo «${model}».` : "Gemini no respondió. Intenta de nuevo.");
  const txt = j.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  let o; try { o = JSON.parse(txt.replace(/^```(json)?|```$/g, "").trim()); } catch { throw new Error("Gemini respondió algo que no se pudo leer. Intenta de nuevo."); }
  return sanitize(o, cat);
}

const num = (v, a, b, d) => (typeof v === "number" && isFinite(v) ? Math.min(b, Math.max(a, v)) : d);
const pick = (v, obj, d) => (typeof v === "string" && v in obj ? v : d);
export function sanitize(o, cat) {
  const out = {
    plano: pick(o.plano, { detalle: 1, primer: 1, medio: 1, americano: 1, general: 1 }, "medio"),
    angulo: pick(o.angulo, { normal: 1, picado: 1, contrapicado: 1, ras: 1 }, "normal"),
    lente: num(o.lente_mm, 8, 200, 35), roll: num(o.inclinacion, -45, 45, 0),
    escenario: pick(o.escenario, cat.scenarios, null), luz: pick(o.luz, cat.lights, null),
    efecto: pick(o.efecto, { ninguno: 1, velocidad: 1, enfoque: 1, impacto: 1, lluvia: 1 }, "ninguno"),
    notas: typeof o.notas === "string" ? o.notas.slice(0, 300) : "",
    personajes: [], objetos: [],
  };
  for (const p of (Array.isArray(o.personajes) ? o.personajes : []).slice(0, 6)) {
    const pts = {};
    for (const k of KP) { const v = p.puntos?.[k]; if (Array.isArray(v) && v.length === 2 && v.every(n => typeof n === "number")) pts[k] = [num(v[0], -0.2, 1.2, 0.5), num(v[1], -0.2, 1.5, 0.5)]; }
    out.personajes.push({
      nombre: typeof p.nombre === "string" ? p.nombre.slice(0, 30) : "Personaje", principal: !!p.principal,
      x: num(p.x, -0.2, 1.2, 0.5), piesY: num(p.pies_y, -0.2, 2, 0.95), giro: num(p.giro, -180, 180, 0),
      pose: pick(p.pose, cat.poses, "de_pie"), expresion: pick(p.expresion, cat.expressions, "neutral"),
      cuerpo: pick(p.cuerpo, cat.bodies, "adulto"), piel: pick(p.piel, cat.skins, null),
      ropa: (Array.isArray(p.ropa) ? p.ropa : []).filter(g => g && g.tipo in cat.garments).slice(0, 5).map(g => ({ tipo: g.tipo, color: /^#[0-9a-f]{6}$/i.test(g.color || "") ? g.color : null })),
      puntos: pts,
    });
  }
  for (const b of (Array.isArray(o.objetos) ? o.objetos : []).slice(0, 12)) {
    if (!(b?.tipo in cat.props)) continue;
    out.objetos.push({ tipo: b.tipo, x: num(b.x, -0.2, 1.2, 0.5), baseY: num(b.base_y, -0.2, 2, 0.9), escala: num(b.escala, 0.3, 3, 1) });
  }
  if (out.personajes.length && !out.personajes.some(p => p.principal)) out.personajes[0].principal = true;
  return out;
}
