// Taller de personajes: la ficha de cada personaje (cuerpo, rostro, extremidades, manos, piel, cabello y vestuario)
import { DEFAULT_HUMAN, LIMB_LEVELS, PROSTHESES, MARKS, BEARDS, MOUSTACHES, SCULPT_TOOLS, ageToYears, yearsToAge, humanData } from "./human.js";
import { HUMAN_HAIR, FOOTWEAR } from "./humandress.js";

export const SECTIONS = { personajes: "Personajes", cuerpo: "Cuerpo", cara: "Rostro", escultura: "Esculpir", extremidades: "Extremidades", manos: "Manos", piel: "Piel", cabello: "Cabello", vestuario: "Vestuario", ficha: "Ficha" };

// Controles de forma (MakeHuman). Cada uno va de −1 a 1
export const BODY_GROUPS = {
  "Torso": [["hombros", "Ancho de hombros"], ["torso_ancho", "Ancho del torso"], ["torso_v", "Forma en V"], ["pectorales", "Pectorales"], ["dorsales", "Dorsales"], ["torso_fondo", "Fondo del torso"], ["torso_largo", "Largo del torso"], ["busto", "Busto"], ["panza", "Vientre"], ["abdomen_tono", "Abdomen marcado"], ["cintura", "Altura de la cintura"], ["cintura_medida", "Cintura"]],
  "Cadera y piernas": [["cadera_ancho", "Ancho de cadera"], ["cadera_medida", "Contorno de cadera"], ["gluteos", "Glúteos"], ["muslo_largo", "Largo del muslo"], ["pierna_largo", "Largo de la pierna"], ["muslo_grosor", "Grosor del muslo"], ["muslo_musculo", "Músculo del muslo"], ["muslo_grasa", "Grasa del muslo"], ["pantorrilla", "Pantorrilla"], ["pantorrilla_musculo", "Músculo de la pantorrilla"], ["pies_tamano", "Tamaño de pies"]],
  "Brazos": [["brazo_largo", "Largo del brazo"], ["antebrazo_largo", "Largo del antebrazo"], ["brazo_grosor", "Grosor del brazo"], ["biceps", "Bíceps"], ["deltoides", "Deltoides"], ["brazo_grasa", "Grasa del brazo"], ["antebrazo_musculo", "Antebrazo"], ["munecas", "Muñecas"]],
  "Cuello": [["cuello_largo", "Largo"], ["cuello_ancho", "Ancho"], ["cuello_grosor", "Grosor"], ["cuello_fondo", "Fondo"], ["cuello_papada", "Papada"]],
};
export const FACE_GROUPS = {
  "Cráneo": [["cabeza_alto", "Alto"], ["cabeza_ancho", "Ancho"], ["cabeza_fondo", "Fondo"], ["cabeza_gordura", "Carne de la cara"], ["cabeza_edad", "Edad de la cara"], ["cabeza_square", "Cuadrada"], ["cabeza_oval", "Ovalada"], ["cabeza_round", "Redonda"], ["cabeza_triangular", "Triangular"], ["cabeza_diamond", "Diamante"], ["cabeza_rectangular", "Rectangular"]],
  "Frente y cejas": [["frente_alto", "Alto de la frente"], ["frente_nubia", "Frente abombada"], ["frente_sienes", "Sienes"], ["cejas_altura", "Altura de las cejas"], ["cejas_angulo", "Ángulo de las cejas"], ["cejas_hueso", "Hueso de las cejas"]],
  "Ojos": [["ojos_tamano", "Tamaño"], ["ojos_separacion", "Separación"], ["ojos_altura", "Altura"], ["ojos_abertura", "Abertura"], ["ojos_inclinacion", "Inclinación"], ["ojos_pliegue", "Pliegue del párpado"], ["ojos_bolsas", "Bolsas"], ["ojos_epicanto", "Epicanto"]],
  "Nariz": [["nariz_ancho", "Ancho"], ["nariz_largo", "Largo"], ["nariz_fondo", "Salida"], ["nariz_giba", "Giba"], ["nariz_curva", "Cóncava ↔ convexa"], ["nariz_punta", "Punta abajo ↔ arriba"], ["nariz_punta_ancho", "Ancho de la punta"], ["nariz_aletas", "Aletas"], ["nariz_fosas", "Fosas"], ["nariz_volumen", "Volumen"], ["nariz_griega", "Perfil recto"]],
  "Boca": [["boca_ancho", "Ancho"], ["labio_sup", "Labio superior"], ["labio_inf", "Labio inferior"], ["boca_arco", "Arco de cupido"], ["boca_comisuras", "Comisuras"], ["boca_adelante", "Boca hacia adelante"], ["boca_surcos", "Surcos de la risa"], ["boca_hoyuelos", "Hoyuelos"]],
  "Mandíbula y mejillas": [["mandibula_hueso", "Ángulo de la mandíbula"], ["mandibula_adelante", "Mandíbula adelantada"], ["mandibula_caida", "Mandíbula caída"], ["menton_ancho", "Ancho del mentón"], ["menton_alto", "Alto del mentón"], ["menton_prominente", "Mentón prominente"], ["menton_hendido", "Mentón partido"], ["pomulos", "Pómulos"], ["mejillas", "Mejillas"], ["mejilla_interna", "Mejilla hundida ↔ llena"]],
  "Orejas": [["orejas_tamano", "Tamaño"], ["orejas_abiertas", "Abiertas"], ["orejas_lobulo", "Lóbulo"], ["orejas_giro", "Giro"], ["orejas_puntiagudas", "Puntiagudas"]],
  "Asimetrías (izquierda ↔ derecha)": [["asim_nariz_1", "Nariz torcida"], ["asim_nariz_2", "Tabique"], ["asim_nariz_3", "Punta de la nariz"], ["asim_nariz_4", "Aleta de la nariz"], ["nariz_lado", "Nariz hacia un lado"], ["asim_boca_1", "Boca"], ["asim_boca_2", "Comisura"], ["asim_mandibula_1", "Mandíbula"], ["asim_mandibula_2", "Quijada"], ["asim_mandibula_3", "Mentón"], ["asim_ojo_1", "Ojo: altura"], ["asim_ojo_2", "Ojo: tamaño"], ["asim_ojo_3", "Ojo: párpado"], ["asim_ojo_4", "Ojo: inclinación"], ["asim_ceja_1", "Ceja"], ["asim_ceja_2", "Hueso de la ceja"], ["asim_mejilla_1", "Pómulo"], ["asim_mejilla_2", "Mejilla"], ["asim_oreja_1", "Oreja: altura"], ["asim_oreja_2", "Oreja: forma"], ["asim_sien_1", "Sien"], ["asim_craneo_1", "Cráneo"], ["asim_tronco", "Tronco"]],
};
export const HAND_GROUP = [["manos_tamano", "Tamaño de manos"], ["dedos_largo", "Largo de dedos"], ["dedos_grosor", "Grosor de dedos"]];

const g = (type, extra = {}) => ({ type, ...extra });
// Cuerpos de partida y los seis personajes de prueba (todos editables después)
export const PRESETS = {
  nino: { label: "Niño (11 años)", group: "Cuerpos", human: { gender: 1, age: yearsToAge(11), muscle: 0.45, weight: 0.45, height: 0.4 }, hair: { style: "corto", color: "#2b2522" }, clothes: [g("camisa", { color: "#5f7da1", sleeve: 0.3 }), g("pantalon", { color: "#3d4048", length: 0.6 })], acc: [g("tenis", { color: "#e8e6e1" })] },
  joven: { label: "Joven", group: "Cuerpos", human: { gender: 1, age: yearsToAge(19), muscle: 0.5, weight: 0.42, height: 0.55 }, hair: { style: "corto", color: "#2b2522" }, clothes: [g("camisa", { color: "#d9d3c7" }), g("pantalon", { color: "#3d4048" })], acc: [g("zapatos")] },
  adulto: { label: "Adulto", group: "Cuerpos", human: { gender: 1, age: 0.5, muscle: 0.55, weight: 0.5, height: 0.55 }, hair: { style: "corto", color: "#2b2522" }, clothes: [g("camisa", { color: "#e6e1d6" }), g("pantalon", { color: "#3d4048" }), g("saco", { color: "#4b4744" })], acc: [g("zapatos")] },
  mujer: { label: "Mujer", group: "Cuerpos", human: { gender: 0, age: yearsToAge(30), muscle: 0.5, weight: 0.48, height: 0.45 }, hair: { style: "melena", color: "#3a2418" }, clothes: [g("camisa", { color: "#d8cfc2" }), g("saco", { color: "#4b4744" }), g("pantalon", { color: "#2f3138" })], acc: [g("zapatos")] },
  viejo: { label: "Persona mayor", group: "Cuerpos", human: { gender: 1, age: yearsToAge(74), muscle: 0.35, weight: 0.5, height: 0.45 }, hair: { style: "calvo", color: "#2b2522", gray: 0.9 }, clothes: [g("camisa", { color: "#d8d2c4" }), g("pantalon", { color: "#4a4236" })], acc: [g("zapatos"), g("lentes")], posture: { spine2: [10, 0, 0], spine3: [8, 0, 0], neck1: [-6, 0, 0], head: [-6, 0, 0] } },
  heroico: { label: "Heroico (musculoso natural)", group: "Cuerpos", human: { gender: 1, age: yearsToAge(30), muscle: 0.92, weight: 0.55, height: 0.7, s: { hombros: 0.4, torso_v: 0.5, pectorales: 0.4, cuello_grosor: 0.4 } }, hair: { style: "corto", color: "#2b2522" }, clothes: [g("camisa", { color: "#3b4250", sleeve: 0.3 }), g("pantalon", { color: "#2b2d33" })], acc: [g("botas")] },
  joven_ap: { label: "El aprendiz, joven", group: "Tus variantes", human: { gender: 1, age: yearsToAge(20), muscle: 0.48, weight: 0.4, height: 0.55, s: { pomulos: 0.4, mejilla_interna: -0.3, menton_ancho: -0.2 } }, hair: { style: "mechon", color: "#2a211c" }, clothes: [g("camisa", { color: "#e4ded2" }), g("pantalon", { color: "#33353c" }), g("saco", { color: "#3d3a38" })], acc: [g("zapatos"), g("corbata", { color: "#2f3b55" })] },
  mayor_ap: { label: "El aprendiz, mayor (entradas y parche)", group: "Tus variantes", human: { gender: 1, age: yearsToAge(48), muscle: 0.5, weight: 0.56, height: 0.55, s: { pomulos: 0.4, mejilla_interna: -0.15, ojos_bolsas: 0.4, boca_surcos: 0.4 }, eyes: { R: "parche" }, facial: { barba: "tres_dias" }, marks: ["arrugas"] }, hair: { style: "corto", color: "#2a211c", recede: 0.8, gray: 0.35 }, clothes: [g("camisa", { color: "#e4ded2" }), g("pantalon", { color: "#33353c" }), g("gabardina", { color: "#6f644f", length: 0.72 })], acc: [g("zapatos"), g("fedora")] },
  mayor_vidrio: { label: "El aprendiz, mayor (ojo de vidrio)", group: "Tus variantes", human: { gender: 1, age: yearsToAge(48), muscle: 0.5, weight: 0.56, height: 0.55, s: { pomulos: 0.4, mejilla_interna: -0.15, ojos_bolsas: 0.4, boca_surcos: 0.4 }, eyes: { L: "vidrio" }, marks: ["cicatriz_ceja_L", "arrugas"] }, hair: { style: "corto", color: "#2a211c", recede: 0.8, gray: 0.35 }, clothes: [g("camisa", { color: "#e4ded2" }), g("pantalon", { color: "#33353c" }), g("saco", { color: "#3d3a38" })], acc: [g("zapatos")] },
  ismael: { label: "Ismael Gaona, «El Tuerto»", group: "Personajes de prueba", color: "#b07e5a", human: { gender: 1, age: yearsToAge(52), muscle: 0.68, weight: 0.68, height: 0.56, s: { hombros: 0.5, panza: 0.45, cuello_grosor: 0.5, nariz_giba: 0.7, nariz_ancho: 0.4, orejas_abiertas: 0.4, cejas_hueso: 0.6, mandibula_hueso: 0.5, ojos_bolsas: 0.6, boca_surcos: 0.5, cabeza_square: 0.5 }, eyes: { R: "parche" }, facial: { barba: "tres_dias" }, marks: ["cicatriz_mejilla", "arrugas"] }, hair: { style: "corto", color: "#3a3330", gray: 0.55, recede: 0.4 }, clothes: [g("camisa", { color: "#cfc6b4" }), g("pantalon", { color: "#3a3631" }), g("gabardina", { color: "#7d6f57", length: 0.72 })], acc: [g("fedora", { color: "#3a332d" }), g("zapatos", { color: "#2a2420" })], hands: { L: "relajada", R: "sujetar" } },
  remedios: { label: "Doña Remedios Pech", group: "Personajes de prueba", color: "#9a6a4a", human: { gender: 0, age: yearsToAge(74), muscle: 0.3, weight: 0.55, height: 0.12, race: [0.15, 0.55, 0.3], s: { nariz_giba: 0.4, nariz_largo: 0.3, pomulos: 0.5, mejilla_interna: -0.3, boca_surcos: 0.7, ojos_bolsas: 0.6, panza: 0.25 }, marks: ["manchas", "arrugas"], support: "baston", supportSide: "R" }, hair: { style: "trenza", color: "#dedad2", gray: 1, length: 0.6 }, clothes: [g("vestido", { color: "#5b4a3e", sleeve: 1, length: 0.9 }), g("rebozo", { color: "#7a3b33" })], acc: [g("lentes", { color: "#3a2a20" }), g("anillo", { side: "ambos" }), g("sello", { side: "R" }), g("zapatos", { color: "#2a2420" })], posture: { spine2: [14, 0, 0], spine3: [12, 0, 0], neck1: [-10, 0, 0], head: [-8, 0, 0], knee_L: [8, 0, 0], knee_R: [8, 0, 0] } },
  teo: { label: "Teo Alcázar", group: "Personajes de prueba", color: "#c69a76", human: { gender: 1, age: yearsToAge(16), muscle: 0.4, weight: 0.3, height: 0.58, s: { dedos_largo: 0.2 }, limbs: { pierna_L: "pantorrilla" }, prosthesis: { pierna_L: "lamina" }, marks: ["cicatriz_ceja_R"] }, hair: { style: "rizado", color: "#1f1914", volume: 0.6 }, clothes: [g("camisa", { color: "#6b7a5a", sleeve: 1, ease: 1.6 }), g("pantalon", { color: "#40444c", length: 0.42, ease: 1.4 })], acc: [g("tenis", { color: "#e8e6e1" })] },
  iris: { label: "Capitana Iris Montejo", group: "Personajes de prueba", color: "#b5865f", human: { gender: 0, age: yearsToAge(38), muscle: 0.72, weight: 0.45, height: 0.6, s: { hombros: 0.2, menton_ancho: 0.2 }, limbs: { brazo_R: "brazo" }, prosthesis: { brazo_R: "mano" }, marks: ["quemadura_cuello_R"] }, hair: { style: "rapado", color: "#2a211c" }, clothes: [g("camisa", { color: "#2f3a4d", sleeve: 1 }), g("pantalon", { color: "#232a38" })], acc: [g("botas", { color: "#1b1a1a" }), g("reloj", { side: "L" }), g("cinturon")] },
  marcelino: { label: "Marcelino Uc, «El Sastre»", group: "Personajes de prueba", color: "#c49e7e", human: { gender: 1, age: yearsToAge(45), muscle: 0.35, weight: 0.12, height: 0.62, headScale: 0.9, s: { dedos_largo: 1, manos_tamano: 0.3, pomulos: 0.9, mejilla_interna: -0.7, mandibula_hueso: 0.6, cejas_hueso: 0.3, menton_alto: 0.4, nariz_largo: 0.4, cuello_largo: 0.6, muslo_largo: 0.25, pierna_largo: 0.25, brazo_largo: 0.2 }, facial: { bigote: "delgado" }, support: "baston_plata", supportSide: "R" }, hair: { style: "corto", color: "#111010" }, clothes: [g("camisa", { color: "#ece8df" }), g("pantalon", { color: "#25232a", tex: "lana" }), g("saco", { color: "#25232a", tex: "lana" })], acc: [g("corbata", { color: "#5a1f24" }), g("zapatos", { color: "#141313" })] },
  lupe: { label: "Lupe Carrasco, «La Grúa»", group: "Personajes de prueba", color: "#a87552", human: { gender: 0, age: yearsToAge(33), muscle: 0.8, weight: 0.68, height: 0.4, s: { hombros: 0.5, brazo_grosor: 0.4, antebrazo_musculo: 0.6, cuello_grosor: 0.3, menton_ancho: 0.3 }, marks: ["tatuaje_antebrazos", "cicatriz_barbilla"] }, hair: { style: "cola", color: "#22170f", length: 0.3 }, clothes: [g("camisa", { color: "#d9d2c3", sleeve: 0.3 }), g("pantalon", { color: "#4b5560", tex: "mezclilla", ease: 1.4 })], acc: [g("guantes", { color: "#5b4632" }), g("botas", { color: "#3b2a1d" }), g("bufanda", { color: "#a5362f" })] },
};

export function isReal(o) { return !!o?.human; }
const fmt = v => (Math.round(v * 100) / 100).toString();

// HTML del panel. helpers: { pill, esc, slider }
export function panelHtml(o, ui, H) {
  const { pill, esc } = H;
  ui.tsec ??= "personajes";
  let h = `<h2>Taller · ${esc(o?.name || "personajes")}</h2>`;
  if (!o || o.kind !== "figure") {
    return h + `<p class="empty">Toca un personaje en el visor para abrir su ficha, o agrega uno desde aquí.</p>
      <h3>Agregar personaje</h3><div class="lib">${Object.entries(PRESETS).map(([k, p]) => `<button class="btn" data-act="t-add" data-val="${k}">${esc(p.label)}</button>`).join("")}</div>`;
  }
  if (!o.human) {
    return h + `<p class="sub">Este personaje es el maniquí de madera. Pásalo a cuerpo realista para moldear el cuerpo, el rostro y todo lo que lleva.</p>
      <div class="row"><button class="btn accent" data-act="t-real" data-val="on">Usar cuerpo realista</button></div>
      <h3>O empieza desde un personaje</h3><div class="lib">${Object.entries(PRESETS).map(([k, p]) => `<button class="btn" data-act="t-preset" data-val="${k}">${esc(p.label)}</button>`).join("")}</div>`;
  }
  h += `<div class="pills tsec">${Object.entries(SECTIONS).map(([k, l]) => pill(k, ui.tsec, l, "t-sec")).join("")}</div>`;
  const hu = o.human, s = hu.s || {};
  const sl = (key, label, val, min = -1, max = 1, step = 0.05, act = "t-s") => H.slider(`t:${act}:${key}`, label, val, min, max, step, "", act).replace(`data-key="t:${act}:${key}"`, `data-key="${key}"`);
  const known = new Set(humanData()?.sliders || []);
  const row = (k, l) => {
    const min = k.startsWith("cabeza_") && !/alto|ancho|fondo|gordura|edad/.test(k) ? 0 : -1;
    // por lado: cuando la simetría está apagada y hay versión izquierda/derecha
    if (ui.tLR && known.has(k + "_L")) return sl(k + "_L", l + " · izq.", s[k + "_L"] || 0, min) + sl(k + "_R", l + " · der.", s[k + "_R"] || 0, min);
    return sl(k, l, s[k] || 0, min);
  };
  const groups = G => `<div class="toggles">${H.toggle("tLR", "Lados por separado", "Brazos, piernas, ojos, orejas y mejillas con control izquierdo y derecho", !!ui.tLR, "t-lr")}</div>` +
    Object.entries(G).map(([name, list]) => `<details class="more"${ui.topen === name ? " open" : ""}><summary data-act="t-open" data-val="${esc(name)}">${esc(name)}</summary>${list.map(([k, l]) => row(k, l)).join("")}</details>`).join("");
  const sec = ui.tsec;
  if (sec === "personajes") {
    const byGroup = {};
    for (const [k, p] of Object.entries(PRESETS)) (byGroup[p.group] ??= []).push([k, p]);
    h += `<p class="sub">Elegir uno reemplaza el cuerpo, el cabello y el vestuario de esta ficha. La pose se queda. Después todo se puede editar.</p>`;
    for (const [grp, list] of Object.entries(byGroup)) h += `<h3>${esc(grp)}</h3><div class="lib">${list.map(([k, p]) => `<button class="btn" data-act="t-preset" data-val="${k}">${esc(p.label)}</button>`).join("")}</div>`;
    h += `<div class="row"><button class="btn" data-act="t-real" data-val="off">Volver al maniquí de madera</button></div>`;
  } else if (sec === "cuerpo") {
    h += `<h3>Base</h3>${sl("gender", "Mujer ↔ hombre", hu.gender ?? 1, 0, 1, 0.01, "t-m")}${sl("age", `Edad · ${Math.round(ageToYears(Math.max(0.1875, hu.age ?? 0.5)))} años`, hu.age ?? 0.5, 0.1875, 1, 0.005, "t-m")}
      ${sl("muscle", "Músculo", hu.muscle ?? 0.5, 0, 1, 0.01, "t-m")}${sl("weight", "Peso", hu.weight ?? 0.5, 0, 1, 0.01, "t-m")}${sl("height", "Estatura", hu.height ?? 0.5, 0, 1, 0.01, "t-m")}
      ${sl("headScale", "Tamaño de la cabeza (estilizado)", hu.headScale ?? 1, 0.7, 1.3, 0.01, "t-m")}
      <p class="sub">Cabeza más chica da proporciones de héroe o de JoJo; más grande, de caricatura o de niño.</p>${groups(BODY_GROUPS)}`;
  } else if (sec === "cara") {
    const r = hu.race || DEFAULT_HUMAN.race;
    h += groups(FACE_GROUPS) + `<details class="more"><summary>Mezcla de partida</summary><p class="sub">MakeHuman trae tres promedios de rasgos para empezar (africano, asiático y europeo). Son solo un punto de partida: cada rostro lo terminas con los controles de arriba.</p>
      ${["Africano", "Asiático", "Europeo"].map((l, i) => sl("race" + i, l, r[i], 0, 1, 0.01, "t-race")).join("")}</details>`;
  } else if (sec === "escultura") {
    const sc = ui.sculpt ??= { tool: "inflar", radius: 0.03, strength: 0.5, sym: true };
    h += `<p class="sub">Toca y arrastra sobre el cuerpo en el visor. Lo esculpido se guarda en la ficha y la ropa se vuelve a ajustar al soltar. Para girar la vista, cambia a otra sección.</p>
      <div class="pills">${Object.entries(SCULPT_TOOLS).map(([k, l]) => pill(k, sc.tool, l, "t-tool")).join("")}</div>
      ${H.slider("t-rad", "Tamaño del pincel (cm)", Math.round(sc.radius * 100), 1, 15, 0.5, "", "t-sc").replace('data-key="t-rad"', 'data-key="radius"')}
      ${H.slider("t-str", "Fuerza", sc.strength, 0.05, 1, 0.05, "", "t-sc").replace('data-key="t-str"', 'data-key="strength"')}
      <div class="toggles">${H.toggle("sym", "Simetría", "Lo que haces en un lado se repite en el otro", sc.sym, "t-sym")}</div>
      <div class="row">${hu.sculpt ? `<button class="btn danger" data-act="t-unsculpt">Borrar lo esculpido</button>` : `<span class="sub">Aún no hay nada esculpido.</span>`}</div>`;
  } else if (sec === "extremidades") {
    for (const [kind, sides] of [["brazo", ["L", "R"]], ["pierna", ["L", "R"]]]) for (const S of sides) {
      const key = `${kind}_${S}`, cur = hu.limbs?.[key] || "completo", pr = hu.prosthesis?.[key] || "ninguna";
      h += `<h3>${kind === "brazo" ? "Brazo" : "Pierna"} ${S === "L" ? "izquierdo" : "derecho"}${kind === "pierna" ? "a" : ""}`.replace("Piernaa", "Pierna").replace("izquierdoa", "izquierda").replace("derechoa", "derecha") + `</h3>
        <div class="pills">${Object.entries(LIMB_LEVELS[kind]).map(([k, l]) => pill(k, cur, l, "t-limb", `data-key="${key}"`)).join("")}</div>`;
      if (cur !== "completo" && cur !== "completa") h += `<div class="pills"><span class="pl">Prótesis</span>${Object.entries(PROSTHESES[kind]).map(([k, l]) => pill(k, pr, l, "t-prot", `data-key="${key}"`)).join("")}</div>`;
      if (kind === "brazo" && cur !== "completo") h += `<div class="pills"><span class="pl">Manga</span>${[["vacia", "Vacía"], ["doblada", "Doblada y prendida"], ["recortada", "Recortada"]].map(([k, l]) => pill(k, hu.sleeves?.[key] || (pr !== "ninguna" ? "recortada" : "vacia"), l, "t-sleeve", `data-key="${key}"`)).join("")}</div>`;
    }
    h += `<h3>Ojos</h3>${["L", "R"].map(S => `<div class="pills"><span class="pl">${S === "L" ? "Izquierdo" : "Derecho"}</span>${[["normal", "Normal"], ["cerrado", "Cerrado"], ["parche", "Parche"], ["vidrio", "De vidrio"]].map(([k, l]) => pill(k, hu.eyes?.[S] || "normal", l, "t-eye", `data-key="${S}"`)).join("")}</div>`).join("")}
      <h3>Apoyo</h3><div class="pills">${[["ninguno", "Ninguno"], ["baston", "Bastón"], ["baston_plata", "Bastón con puño de plata"], ["muleta", "Muleta"]].map(([k, l]) => pill(k, hu.support || "ninguno", l, "t-support")).join("")}</div>
      <div class="pills"><span class="pl">En la mano</span>${pill("R", hu.supportSide || "R", "Derecha", "t-support-side")}${pill("L", hu.supportSide || "R", "Izquierda", "t-support-side")}</div>
      <p class="sub">El muñón se redondea y la ropa lo sigue. Las poses se siguen aplicando a todo el esqueleto: si falta una pierna, elige una pose con apoyo o con la otra pierna.</p>`;
  } else if (sec === "manos") {
    h += `<h3>Forma</h3>${HAND_GROUP.map(([k, l]) => sl(k, l, s[k] || 0)).join("")}
      <h3>Pose de reposo</h3>${["L", "R"].map(S => `<div class="pills"><span class="pl">${S === "L" ? "Izquierda" : "Derecha"}</span>${Object.entries(H.HAND_POSES).map(([k, p]) => pill(k, o.hands?.[S] || "relajada", p.label, "t-hand", `data-key="${S}"`)).join("")}</div>`).join("")}`;
  } else if (sec === "piel") {
    h += `<h3>Tono</h3><div class="pills">${Object.entries(H.SKIN_TONES).map(([k, l]) => `<button class="pill${o.color === k ? " on" : ""}" data-act="t-tone" data-val="${k}"><span class="sw" style="background:${k}"></span>${l}</button>`).join("")}</div>
      <div class="row colorrow"><label class="sel"><span>Otro tono</span><input type="color" data-act="t-tone-c" value="${o.color || "#c99a76"}"></label></div>
      <h3>Marcas</h3><div class="pills">${Object.entries(MARKS).map(([k, l]) => pill(k, (hu.marks || []).includes(k) ? k : "", l, "t-mark")).join("")}</div>
      <h3>Vello facial</h3><div class="pills">${Object.entries(BEARDS).map(([k, l]) => pill(k, hu.facial?.barba || "ninguna", l, "t-beard")).join("")}</div>
      <div class="pills">${Object.entries(MOUSTACHES).map(([k, l]) => pill(k, hu.facial?.bigote || "ninguno", l, "t-moust")).join("")}</div>`;
  } else if (sec === "cabello") {
    const hr = o.hair || {};
    h += `<div class="pills">${Object.entries(HUMAN_HAIR).map(([k, l]) => pill(k, hr.style || "ninguno", l, "t-hair")).join("")}</div>
      <div class="row colorrow"><label class="sel"><span>Color</span><input type="color" data-act="t-hair-c" value="${hr.color || "#2b2522"}"></label></div>
      ${sl("gray", "Canas", hr.gray || 0, 0, 1, 0.05, "t-hr")}${sl("recede", "Entradas", hr.recede || 0, 0, 1, 0.05, "t-hr")}${sl("volume", "Volumen", hr.volume ?? 0.5, 0, 1, 0.05, "t-hr")}${sl("length", "Largo", hr.length ?? 0.5, 0, 1, 0.05, "t-hr")}`;
  } else if (sec === "vestuario") {
    const types = ["camisa", "pantalon", "saco", "gabardina", "vestido", "falda", "rebozo", "capa"];
    h += `<h3>Ropa</h3><div class="adds">${types.map(t => `<button class="btn" data-act="t-gadd" data-val="${t}">+ ${H.GARMENTS[t].label}</button>`).join("")}</div>`;
    for (const gm of o.clothes || []) {
      h += `<div class="card"><div class="row"><b>${esc(H.GARMENTS[gm.type]?.label || gm.type)}</b><input type="color" data-act="t-gcolor" data-key="${gm.id}" value="${gm.color}"><button class="btn danger" data-act="t-gdel" data-val="${gm.id}">Quitar</button></div>
        <div class="pills">${Object.entries(H.CLOTH_TEX).map(([k, l]) => pill(k, gm.tex || "lisa", l, "t-gtex", `data-key="${gm.id}"`)).join("")}</div>
        ${gm.sleeve !== undefined ? H.slider(`ts-${gm.id}`, "Manga", gm.sleeve, 0, 1, 0.05, "", "t-gnum").replace(`data-key="ts-${gm.id}"`, `data-key="${gm.id}|sleeve"`) : ""}
        ${gm.length !== undefined ? H.slider(`tl-${gm.id}`, "Largo", gm.length, 0.1, 1, 0.05, "", "t-gnum").replace(`data-key="tl-${gm.id}"`, `data-key="${gm.id}|length"`) : ""}
        ${H.slider(`te-${gm.id}`, "Holgura", gm.ease ?? 0.9, 0.2, 2, 0.05, "", "t-gnum").replace(`data-key="te-${gm.id}"`, `data-key="${gm.id}|ease"`)}</div>`;
    }
    h += `<h3>Accesorios y equipo</h3><div class="adds">${Object.entries(H.ACCESSORIES).map(([k, a]) => `<button class="btn" data-act="t-aadd" data-val="${k}">+ ${esc(a.label)}</button>`).join("")}</div>
      ${(o.accessories || []).length ? `<div class="pills">${o.accessories.map(a => `<button class="pill on" data-act="t-adel" data-val="${a.id}">${esc(H.ACCESSORIES[a.type]?.label || a.type)} ×</button>`).join("")}</div>` : ""}`;
  } else if (sec === "ficha") {
    h += `<div class="row"><input class="text" id="tname" value="${esc(o.name)}" aria-label="Nombre"><button class="btn" data-act="t-rename">Renombrar</button></div>
      <div class="toggles">${H.toggle("localChar", "Solo en esta viñeta", "Los cambios del Taller no se copian a las otras viñetas (una herida, la ropa mojada)", !!o.localChar, "t-local")}</div>
      <p class="sub">${o.charId ? "Ficha enlazada: lo que cambies aquí se aplica a este personaje en todas las viñetas del proyecto." : "Esta ficha todavía no está enlazada."} La pose y la posición son de cada viñeta.</p>
      <div class="row"><button class="btn accent" data-act="t-save">Guardar en mis personajes</button><button class="btn" data-act="t-dup">Duplicar como variante</button><button class="btn" data-act="share-sel">Compartir o publicar</button></div>`;
  }
  return h;
}

// Aplica un preset a la ficha. Devuelve true si hay que reconstruir
export function applyPreset(o, key, deps) {
  const p = PRESETS[key]; if (!p) return false;
  o.human = JSON.parse(JSON.stringify({ ...DEFAULT_HUMAN, ...p.human }));
  o.hair = { volume: 0.5, length: 0.5, ...JSON.parse(JSON.stringify(p.hair || { style: "ninguno" })) };
  o.clothes = (p.clothes || []).map(c => ({ ...deps.newGarment(c.type), ...c }));
  o.accessories = (p.acc || []).map(a => ({ ...deps.newAccessory(a.type), ...a }));
  o.color = p.color || o.color || "#c99a76";
  if (p.hands) { o.hands = { ...p.hands }; }
  if (p.posture) { o.pose.rot ??= {}; for (const [j, r] of Object.entries(p.posture)) o.pose.rot[j] = r.slice(); }
  o.bodyType = key;
  if (/^Personaje \d+$/.test(o.name) || PRESETS[o.presetKey]?.label === o.name) o.name = p.label.replace(/,.*$/, "").replace(/ \(.*\)$/, "");
  o.presetKey = key;
  return true;
}

// Clics del panel. Devuelve { rebuild, render, toast }
export function click(o, act, val, el, ui, deps) {
  const hu = o?.human;
  const r = { rebuild: false, render: true };
  switch (act) {
    case "t-sec": ui.tsec = val; return { render: true };
    case "t-open": ui.topen = ui.topen === val ? null : val; return { render: false };
    case "t-real":
      if (val === "on") { o.human = JSON.parse(JSON.stringify(DEFAULT_HUMAN)); o.hair ??= { style: "corto", color: "#2b2522" }; o.color ??= "#c99a76"; }
      else delete o.human;
      return { rebuild: true, render: true };
    case "t-preset": applyPreset(o, val, deps); return { rebuild: true, render: true, ground: true, toast: `Ficha «${PRESETS[val].label}». Todo se puede editar en las otras secciones.` };
    case "t-limb": hu.limbs ??= {}; if (val === "completo" || val === "completa") { delete hu.limbs[el.dataset.key]; delete hu.prosthesis?.[el.dataset.key]; } else hu.limbs[el.dataset.key] = val; return { rebuild: true, render: true };
    case "t-prot": hu.prosthesis ??= {}; hu.prosthesis[el.dataset.key] = val; return { rebuild: true, render: true };
    case "t-eye": hu.eyes ??= {}; hu.eyes[el.dataset.key] = val; return { rebuild: true, render: true };
    case "t-support": hu.support = val; return { rebuild: true, render: true };
    case "t-support-side": hu.supportSide = val; return { rebuild: true, render: true };
    case "t-tool": ui.sculpt.tool = val; return { render: true };
    case "t-unsculpt": delete hu.sculpt; return { rebuild: true, render: true };
    case "t-sleeve": hu.sleeves ??= {}; hu.sleeves[el.dataset.key] = val; return { rebuild: true, render: true };
    case "t-hand": o.hands ??= {}; o.hands[el.dataset.key] = val; Object.assign(o.pose.rot, deps.handPoseRot(val, el.dataset.key)); return { rebuild: true, render: true };
    case "t-tone": o.color = val; return { rebuild: true, render: true };
    case "t-mark": { hu.marks ??= []; const i = hu.marks.indexOf(val); if (i >= 0) hu.marks.splice(i, 1); else hu.marks.push(val); return { rebuild: true, render: true }; }
    case "t-beard": hu.facial ??= {}; hu.facial.barba = val; return { rebuild: true, render: true };
    case "t-moust": hu.facial ??= {}; hu.facial.bigote = val; return { rebuild: true, render: true };
    case "t-hair": o.hair ??= { color: "#2b2522", volume: 0.5, length: 0.5 }; o.hair.style = val; return { rebuild: true, render: true };
    case "t-gadd": o.clothes ??= []; o.clothes.push(deps.newGarment(val)); return { rebuild: true, render: true };
    case "t-gdel": o.clothes = (o.clothes || []).filter(x => x.id !== val); return { rebuild: true, render: true };
    case "t-gtex": { const gm = o.clothes.find(x => x.id === el.dataset.key); if (gm) { if (val === "lisa") delete gm.tex; else gm.tex = val; } return { rebuild: true, render: true }; }
    case "t-aadd": o.accessories ??= []; o.accessories.push(deps.newAccessory(val)); return { rebuild: true, render: true };
    case "t-adel": o.accessories = (o.accessories || []).filter(x => x.id !== val); return { rebuild: true, render: true };
    case "t-rename": { const n = document.getElementById("tname")?.value.trim(); if (n) o.name = n; return { render: true, sync: true }; }
    case "t-save": return { render: false, save: true };
    case "t-dup": return { render: true, dup: true };
    case "t-add": return { render: true, add: val };
  }
  return r;
}
// Deslizadores: devuelve true si cambió la forma
export function input(o, act, key, value) {
  const hu = o.human; if (!hu && act !== "t-gnum") return false;
  if (act === "t-s") { hu.s ??= {}; if (Math.abs(value) < 0.01) delete hu.s[key]; else hu.s[key] = value; return true; }
  if (act === "t-m") { hu[key] = value; return true; }
  if (act === "t-race") { const r = [...(hu.race || DEFAULT_HUMAN.race)]; r[+key.slice(4)] = value; hu.race = r; return true; }
  if (act === "t-hr") { o.hair ??= { style: "corto", color: "#2b2522" }; o.hair[key] = value; return true; }
  if (act === "t-sc") { return false; }
  if (act === "t-gnum") { const [id, f] = key.split("|"), gm = o.clothes?.find(x => x.id === id); if (gm) gm[f] = value; return true; }
  return false;
}
export { fmt };
