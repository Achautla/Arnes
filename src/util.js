// Utilidades compartidas
import * as THREE from "three";

export const DEG = THREE.MathUtils.DEG2RAD;
export const RAD = THREE.MathUtils.RAD2DEG;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const uid = (p = "o") => p + Math.random().toString(36).slice(2, 9);
export const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;
export const clone = o => JSON.parse(JSON.stringify(o));

// Material de arcilla compartido: gris cálido mate, el aspecto del semirender
export const clay = new THREE.MeshStandardMaterial({ color: 0xbdb6ac, roughness: 0.86, metalness: 0 });
export const clayDark = new THREE.MeshStandardMaterial({ color: 0x8a837a, roughness: 0.75, metalness: 0 });

// Temperatura de color (Kelvin) a RGB, aproximación de Tanner Helland
export function kelvinToColor(k) {
  const t = k / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); }
  if (t >= 66) b = 255; else if (t <= 19) b = 0; else b = 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = new THREE.Color(clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255);
  return c.convertSRGBToLinear();
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Descarga: dentro de claude.ai usa la capacidad "downloads"; fuera (GitHub Pages), un enlace normal
let downloadsNs;
export async function saveFile(filename, data) {
  if (downloadsNs === undefined && window.claude?.use) {
    try { downloadsNs = await window.claude.use("downloads"); } catch { downloadsNs = null; }
  }
  if (downloadsNs) {
    try { await downloadsNs.save({ filename, data }); return "ok"; }
    catch (e) { return e?.code === "declined" ? "declined" : "error"; }
  }
  const blob = data instanceof Blob ? data : new Blob([data]);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "ok";
}

// Color por objeto: material de arcilla teñido (uno por color)
const colorCache = new Map();
export function colorMat(hex) {
  if (!colorCache.has(hex)) colorCache.set(hex, new THREE.MeshStandardMaterial({ color: new THREE.Color(hex), roughness: 0.82, metalness: 0 }));
  return colorCache.get(hex);
}
// Texturas de superficie: dibujan detalle en el valor (vetas, juntas, hojas, grietas) para que cada
// estilo lo interprete: el grabado lo convierte en rayado, el color dinámico en manchas planas.
export const TEXTURES = { lisa: "Lisa", madera: "Madera", ladrillo: "Ladrillo", follaje: "Follaje", piedra: "Piedra", tejido: "Tela o tejido", metal: "Metal gastado" };
const TEX_ID = { madera: 1, ladrillo: 2, follaje: 3, piedra: 4, tejido: 5, metal: 6, piel: 7, mezclilla: 8, lana: 9, cuero: 10, seda: 11 };
export const SKIN_TONES = { "#f0d0b8": "Muy clara", "#e2b593": "Clara", "#c99a76": "Media", "#a6744f": "Morena", "#7a5038": "Oscura", "#563628": "Muy oscura" };
const texGLSL = `
varying vec3 vWPos; varying vec3 vWN; uniform int texKind; uniform float texScale;
float th(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float tn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(th(i), th(i + vec2(1, 0)), f.x), mix(th(i + vec2(0, 1)), th(i + vec2(1, 1)), f.x), f.y); }
float tf(vec2 p){ return tn(p) * 0.5 + tn(p * 2.1 + 3.7) * 0.3 + tn(p * 4.3 + 9.1) * 0.2; }
float texPattern(){
  vec3 n = abs(normalize(vWN));
  vec2 uv = n.y > max(n.x, n.z) ? vWPos.xz : (n.x > n.z ? vWPos.zy : vWPos.xy);
  uv /= texScale;
  if (texKind == 1) { // madera: tablas con juntas y vetas
    float pl = uv.y / 0.14, id = floor(pl);
    float gap = smoothstep(0.0, 0.05, fract(pl)) * smoothstep(1.0, 0.95, fract(pl));
    float grain = sin((uv.x + th(vec2(id, 1.0)) * 5.0) * 26.0 + tf(vec2(uv.x * 3.0, pl * 4.0)) * 9.0) * 0.5 + 0.5;
    return mix(0.45, 1.0, gap) * mix(0.78, 1.0, grain) * mix(0.88, 1.0, th(vec2(id, 2.0)));
  }
  if (texKind == 2) { // ladrillo: hileras desfasadas con mortero
    float row = floor(uv.y / 0.075); vec2 b = vec2(uv.x / 0.22 + mod(row, 2.0) * 0.5, uv.y / 0.075);
    vec2 f = fract(b);
    float mortar = smoothstep(0.0, 0.07, f.y) * smoothstep(1.0, 0.93, f.y) * smoothstep(0.0, 0.035, f.x) * smoothstep(1.0, 0.965, f.x);
    return mix(0.4, 1.0, mortar) * mix(0.75, 1.0, th(floor(b))) * mix(0.85, 1.0, tn(uv * 40.0));
  }
  if (texKind == 3) { // follaje: hojas en manchas de alto contraste
    float l = tf(uv * 16.0); float l2 = tf(uv * 34.0 + 5.0);
    return mix(0.3, 1.0, smoothstep(0.42, 0.62, l)) * mix(0.7, 1.0, smoothstep(0.35, 0.7, l2));
  }
  if (texKind == 4) { // piedra: celdas con grietas
    vec2 g = uv * 6.0, i = floor(g), f = fract(g); float d1 = 9.0, d2 = 9.0;
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(x, y); vec2 r = o + vec2(th(i + o), th(i + o + 7.0)) - f; float d = dot(r, r); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    float crack = smoothstep(0.0, 0.08, sqrt(d2) - sqrt(d1));
    return mix(0.45, 1.0, crack) * mix(0.8, 1.0, tf(uv * 10.0));
  }
  if (texKind == 5) { // tejido: trama cruzada fina
    vec2 w = uv * 90.0; float a = sin(w.x) * sin(w.y);
    return mix(0.82, 1.0, a * 0.5 + 0.5) * mix(0.9, 1.0, tn(uv * 12.0));
  }
  if (texKind == 6) { // metal gastado: rayones y manchas
    float sc = smoothstep(0.92, 1.0, tn(vec2(uv.x * 200.0, uv.y * 4.0)));
    return mix(0.75, 1.0, tf(uv * 5.0)) * (1.0 - sc * 0.35);
  }
  if (texKind == 8) { // mezclilla: sarga diagonal con hilo claro
    float tw = sin((uv.x + uv.y) * 420.0) * 0.5 + 0.5, sl = tn(vec2(uv.x * 30.0, uv.y * 600.0));
    return mix(0.78, 1.0, tw) * mix(0.85, 1.0, sl) * mix(0.9, 1.0, tf(uv * 6.0));
  }
  if (texKind == 9) { // lana: punto en espiga
    vec2 k = uv * vec2(110.0, 70.0); float v = abs(fract(k.x) - 0.5) * 2.0; float chev = abs(fract(k.y + v * 0.5) - 0.5) * 2.0;
    return mix(0.75, 1.0, smoothstep(0.1, 0.6, chev)) * mix(0.88, 1.0, tn(uv * 220.0));
  }
  if (texKind == 10) { // cuero: grano fino y arrugas
    float gr = tn(uv * 520.0), cr = smoothstep(0.48, 0.5, abs(tf(uv * 7.0) - 0.5) + 0.48);
    return mix(0.88, 1.0, gr) * (1.0 - (1.0 - cr) * 0.25) * mix(0.82, 1.0, tf(uv * 3.0));
  }
  if (texKind == 11) { // seda: brillo suave en franjas largas
    return mix(0.9, 1.05, sin(uv.y * 40.0 + tf(uv * 4.0) * 6.0) * 0.5 + 0.5);
  }
  if (texKind == 7) { // piel: manchas suaves y poro fino, sin vetas de madera
    float mott = tf(uv * 9.0), pore = tn(uv * 380.0);
    return mix(0.92, 1.0, mott) * (1.0 - pore * 0.05);
  }
  return 1.0;
}`;
const texCache = new Map();
export function texturedMat(hex, kind, side = THREE.FrontSide) {
  const key = (hex || "clay") + "|" + kind + "|" + side;
  if (texCache.has(key)) return texCache.get(key);
  const m = kind === "piel"
    ? new THREE.MeshPhysicalMaterial({ side, color: new THREE.Color(hex || 0xc99a76), roughness: 0.55, metalness: 0, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0xff9a80), clearcoat: 0.06, clearcoatRoughness: 0.6 })
    : new THREE.MeshStandardMaterial({ side, color: new THREE.Color(hex || 0xbdb6ac), roughness: kind === "metal" ? 0.5 : kind === "cuero" ? 0.55 : kind === "seda" ? 0.45 : 0.86, metalness: kind === "metal" ? 0.25 : 0 });
  m.onBeforeCompile = sh => {
    sh.uniforms.texKind = { value: TEX_ID[kind] || 0 }; sh.uniforms.texScale = { value: 1 };
    sh.vertexShader = "varying vec3 vWPos; varying vec3 vWN;\n" + sh.vertexShader.replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\n vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = mat3(modelMatrix) * objectNormal;");
    sh.fragmentShader = texGLSL + "\n" + sh.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n diffuseColor.rgb *= texPattern();");
  };
  m.customProgramCacheKey = () => "tex-" + kind + side;
  texCache.set(key, m); return m;
}
// Pinta un objeto con su color y su textura (o lo regresa a arcilla). Solo toca las piezas de arcilla
export function paint(root, hex, useColor = true, tex = null) {
  const t = tex && tex !== "lisa" ? tex : null;
  root.userData.paintArgs = [hex, useColor, tex];
  root.traverse(m => {
    if (!m.isMesh) return;
    if (m.userData.origMat) { // modelo importado: su propio material salvo que pidan color, textura o arcilla
      const c = hex && useColor ? hex : null;
      m.material = t ? texturedMat(t === "piel" ? hex : c, t) : c ? colorMat(c) : m.userData.look === "arcilla" ? clay : m.userData.origMat;
      return;
    }
    if (m.userData.baseMat === undefined) { if (m.material !== clay) return; m.userData.baseMat = clay; }
    const c = hex && useColor ? hex : null;
    m.material = t ? texturedMat(t === "piel" ? hex : c, t) : c ? colorMat(c) : m.userData.baseMat;
  });
}
