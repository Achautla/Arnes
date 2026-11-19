// Semirender: arcilla, vista de valores, contorno y modo de líneas azules para imprimir
import * as THREE from "three";

const vert = `varying vec2 vUv0; void main(){ vUv0 = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const frag = `
precision highp float;
varying vec2 vUv0;
vec2 vUv; vec2 gUv; vec2 fres;
uniform vec4 tile;
uniform sampler2D tColor, tDepth, tNormal, tLit, tNdl;
uniform mat3 camRot;
uniform vec2 res;
uniform float near, far, thick;
uniform int mode, tones;
uniform vec4 th;
uniform bool outline, blue, clearBg, useNormal, contourOnly;
uniform float dotSize, hatch, grain, lineVar, detail;
uniform vec3 ink, blueInk, paper, sepia, burstA, burstB, shadeTint, lightTint;
uniform bool burst, noHatch;
uniform vec2 focus;
uniform int fxType;
uniform float fxAmt, fxAng, fisheye;
uniform vec3 fxInk;
float lin(float d){ float z = d * 2.0 - 1.0; return (2.0 * near * far) / (far + near - z * (far - near)); }
vec3 toSRGB(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y); }
// Bordes a un radio dado: profundidad (silueta) y normales (pliegues y cambios de plano)
float edgeAt(float r, float dc, out float sil){
  vec2 o = r / res;
  float dl = lin(texture2D(tDepth, vUv - vec2(o.x, 0.0)).x), dr = lin(texture2D(tDepth, vUv + vec2(o.x, 0.0)).x);
  float dd = lin(texture2D(tDepth, vUv - vec2(0.0, o.y)).x), du = lin(texture2D(tDepth, vUv + vec2(0.0, o.y)).x);
  float lap = (abs(dl + dr - 2.0 * dc) + abs(du + dd - 2.0 * dc)) / max(dc, 0.001);
  sil = smoothstep(0.015, 0.04, lap);
  vec3 nc = texture2D(tNormal, vUv).xyz;
  float nd = max(max(distance(nc, texture2D(tNormal, vUv - vec2(o.x, 0.0)).xyz), distance(nc, texture2D(tNormal, vUv + vec2(o.x, 0.0)).xyz)),
                 max(distance(nc, texture2D(tNormal, vUv - vec2(0.0, o.y)).xyz), distance(nc, texture2D(tNormal, vUv + vec2(0.0, o.y)).xyz)));
  return max(sil, smoothstep(0.35, 0.6, nd));
}
// Una capa de rayado: líneas perpendiculares a 'a', que se curvan con la forma (normal) y tiemblan como trazo a mano
float hatchLayer(vec2 px, vec3 n, float a, float s, float cover){
  if (cover <= 0.0) return 0.0;
  vec2 dir = vec2(cos(a), sin(a));
  float c = dot(px, vec2(-dir.y, dir.x));
  c += (n.x * 1.6 + n.y * 1.1) * s * 2.2;
  c += (vnoise(px * 0.035) - 0.5) * s * 0.9;
  float f = abs(fract(c / s) - 0.5) * s;
  float w = min(s * clamp(cover, 0.0, 0.5) * 0.75, s * 0.34) * (0.75 + 0.5 * vnoise(px * 0.11 + a));
  // los trazos se cortan a tramos, como plumilla
  float brk = smoothstep(0.18, 0.3, vnoise(vec2(dot(px, dir) * 0.045, floor(c / s) * 3.7)));
  return (1.0 - smoothstep(w * 0.5, w * 0.5 + 0.9, f)) * brk;
}
float quant(float l){
  if (tones == 2) return l < th.x ? 0.0 : 1.0;
  if (tones == 3) return l < th.x ? 0.0 : (l < th.y ? 0.5 : 1.0);
  return l < th.x ? 0.0 : l < th.y ? 0.25 : l < th.z ? 0.5 : l < th.w ? 0.75 : 1.0;
}
vec2 barrel(vec2 uv){ vec2 c = uv - 0.5; float a = fres.x / fres.y; c.x *= a; float k = fisheye * 2.4; float rm = 0.25 * (a * a + 1.0); c *= (1.0 + k * dot(c, c)) / (1.0 + k * rm); c.x /= a; return c + 0.5; }
// Efectos de viñeta encima del render: velocidad, enfoque e impacto
vec3 applyFx(vec3 col, float bg){
  if (fxType == 0 || fxAmt <= 0.0) return col;
  vec2 px = gUv * fres;
  vec2 q = (gUv - focus) * vec2(fres.x / fres.y, 1.0);
  float rad = length(q);
  if (fxType == 1) {
    vec2 dir = vec2(cos(fxAng), sin(fxAng));
    float across = dot(px, vec2(-dir.y, dir.x)), along = dot(px, dir);
    float id = floor(across / 3.0), h = hash(vec2(id, 7.0));
    float seg = fract(along / (fres.y * (0.25 + h * 0.5)) + h * 5.0);
    float on = step(1.0 - fxAmt * 0.45, h) * step(seg, 0.55) * smoothstep(0.08, 0.45, rad);
    float w = 1.0 - smoothstep(0.35, 1.1, abs(fract(across / 3.0) - 0.5) * 3.0 / (0.6 + h));
    return mix(col, fxInk, on * w * 0.9 * mix(0.3, 1.0, bg));
  }
  if (fxType == 4) {
    // lluvia: trazos cortos inclinados, más densos y largos con la intensidad
    vec2 dir = normalize(vec2(sin(fxAng) * 0.35 + 0.18, -1.0));
    vec2 rp = vec2(dot(px, vec2(-dir.y, dir.x)), dot(px, dir));
    float colId = floor(rp.x / 5.0), hh = hash(vec2(colId, 9.0));
    float len = 14.0 + 26.0 * fxAmt;
    float seg = fract((rp.y + hh * 997.0) / (len * (3.5 - 2.0 * fxAmt)));
    float on = step(seg, 0.28) * step(0.55 - fxAmt * 0.4, hh);
    float w = 1.0 - smoothstep(0.3, 0.9, abs(fract(rp.x / 5.0) - 0.5) * 5.0);
    vec3 rc = dot(col, vec3(0.333)) < 0.45 ? vec3(0.82, 0.84, 0.86) : fxInk;
    return mix(col, rc, on * w * 0.75);
  }
  float ang = atan(q.y, q.x), k = ang * 57.3 * 0.9;
  float id = floor(k), h = hash(vec2(id, 3.0));
  float r0 = mix(0.42, 0.16, fxAmt) + h * 0.12;
  float wedge = abs(fract(k) - 0.5) * 2.0;
  float wid = clamp((rad - r0) * 1.6, 0.0, 0.9);
  float on = step(0.5 - fxAmt * 0.35, h) * step(wedge, wid) * step(r0, rad);
  if (fxType == 2) return mix(col, fxInk, on * mix(0.3, 1.0, bg));
  // marco de impacto: se invierte en negro y blanco, con rayos blancos sobre negro
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  vec3 inv = vec3(step(l, 0.55));
  return mix(inv, vec3(1.0) - inv, on * 0.85);
}
void main(){
  fres = tile.zw; gUv = (vUv0 * res + tile.xy) / fres;
  vUv = fisheye > 0.0 ? (barrel(gUv) * fres - tile.xy) / res : vUv0;
  vec3 col = toSRGB(texture2D(tColor, vUv).rgb);
  float d = texture2D(tDepth, vUv).x;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float v = lum;
  if (mode == 1) { v = quant(lum); col = vec3(v); }
  else if (mode == 2) { v = lum < th.x ? 0.0 : 1.0; col = vec3(v); }
  else if (mode == 3) {
    vec2 px = gUv * fres;
    vec2 r = vec2(px.x + px.y, px.x - px.y) * 0.70710678;
    vec2 c = mod(r, dotSize) - 0.5 * dotSize;
    float lo = th.x * 0.55, hi = min(0.95, th.x + 0.35);
    float t = clamp((lum - lo) / max(hi - lo, 0.01), 0.0, 1.0);
    float rad = 0.5 * dotSize * 1.12 * sqrt(1.0 - t);
    v = lum < lo ? 0.0 : (lum > hi ? 1.0 : (length(c) < rad ? 0.0 : 1.0));
    col = vec3(v);
  }
  else if (mode == 5) {
    // Notas de luz: tColor = luz principal con sombras, tLit = la misma sin sombras, tNdl = (N·L, normal.y)
    vec4 nl = texture2D(tNdl, vUv);
    float ndl = nl.x * 2.0 - 1.0, ny = nl.y * 2.0 - 1.0;
    float shad = dot(texture2D(tColor, vUv).rgb, vec3(0.333)), full = dot(texture2D(tLit, vUv).rgb, vec3(0.333));
    vec3 cLit = vec3(0.96, 0.89, 0.71), cTerm = vec3(0.86, 0.55, 0.23), cOwn = vec3(0.37, 0.5, 0.66), cCast = vec3(0.29, 0.24, 0.42), cRefl = vec3(0.37, 0.66, 0.63);
    if (d >= 0.99999) col = vec3(0.93, 0.92, 0.89);
    else if (ndl < 0.0) col = ny < -0.3 ? cRefl : cOwn;
    else if (full < 0.004) col = vec3(0.55, 0.55, 0.57); // fuera del cono o del alcance de la luz
    else if (ndl < 0.08) col = cTerm;
    else if (shad < full * 0.55) col = cCast;
    else col = cLit;
    v = dot(col, vec3(0.333));
  }
  else if (mode == 6 || mode == 7 || mode == 8) {
    // estilos de artista: se resuelven completos abajo
  }
  else if (mode == 4) {
    float q = lum < th.x ? 0.28 : (lum < th.y ? 0.62 : 1.0);
    vec3 chroma = col / max(lum, 0.04);
    col = clamp(chroma * q, 0.0, 1.0); v = q;
  }
  if (mode == 6 || mode == 7 || mode == 8) {
    vec2 px = gUv * fres;
    vec3 n = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
    bool sky = d >= 0.99999;
    float L = clamp(pow(lum, 0.62) + (0.33 - th.x) * 1.2, 0.0, 1.0);
    float dc = lin(d), sil;
    // la línea engorda en la sombra y en la silueta, y respira con el pulso de la mano
    float wob = 0.75 + 0.5 * vnoise(px * 0.02);
    float r = thick * (1.0 + lineVar * (1.0 - L) * 1.2) * mix(1.0, wob, lineVar);
    float eIn = edgeAt(r, dc, sil);
    float eOut = 0.0; edgeAt(r * (1.0 + lineVar * 1.3), dc, eOut);
    float line = max(eIn * (outline ? 1.0 : 0.0), eOut);
    // detalle de superficie: juntas, vetas, hojas y grietas de la textura se entintan como línea fina
    if (detail > 0.0 && !sky) {
      vec2 o1 = 1.0 / res;
      float lx = dot(texture2D(tColor, vUv + vec2(o1.x, 0.0)).rgb - texture2D(tColor, vUv - vec2(o1.x, 0.0)).rgb, vec3(0.333));
      float ly = dot(texture2D(tColor, vUv + vec2(0.0, o1.y)).rgb - texture2D(tColor, vUv - vec2(0.0, o1.y)).rgb, vec3(0.333));
      float gmag = length(vec2(lx, ly)) / max(lum, 0.08);
      line = max(line, smoothstep(0.1, 0.35, gmag) * detail * (0.7 + 0.3 * vnoise(px * 0.3)));
    }
    if (mode == 6) {
      // Grabado sepia: papel envejecido, plumilla con rayado cruzado y negros sólidos
      float g = vnoise(px * 0.9) * 0.5 + vnoise(px * 0.08) * 0.5;
      float vig = smoothstep(1.25, 0.35, length((gUv - 0.5) * vec2(1.0, 1.15)) * 1.6);
      vec3 pp = paper; float pl = dot(pp, vec3(0.299, 0.587, 0.114)); if (pl < 0.6) pp = mix(pp, vec3(1.0), (0.6 - pl) / max(1.0 - pl, 0.01) + 0.1);
      vec3 pap = pp * (1.0 - grain * 0.16 * g) * mix(0.72, 1.0, vig);
      float s = hatch;
      float cov = 0.0;
      cov = max(cov, hatchLayer(px, n, 0.785, s, (0.74 - L) * 1.1));
      cov = max(cov, hatchLayer(px, n, -0.62, s * 0.92, (0.5 - L) * 1.3));
      cov = max(cov, hatchLayer(px, n, 0.12, s * 0.8, (0.3 - L) * 1.6));
      // punteado fino en los medios tonos claros: da la textura de grabado en rostros y telas
      float stip = sky ? 0.0 : step(hash(floor(px / 1.6)), clamp((0.86 - L) * 0.35, 0.0, 0.12)) * step(0.55, L);
      cov = max(cov, stip * 0.8);
      float solid = smoothstep(0.12, 0.06, L);
      if (noHatch) cov = 0.0;
      cov = max(cov, solid);
      if (sky) cov *= 0.85;
      float inkV = max(cov, line);
      inkV *= 0.82 + 0.18 * vnoise(px * 0.6);
      col = mix(pap, sepia, clamp(inkV, 0.0, 1.0));
      v = 1.0 - inkV;
    } else if (mode == 8) {
      // Pintura: conserva el color y la luz, agrupa los valores en manchas, tiñe sombras y luces
      // con la paleta del artista y deja una textura de pincel que sigue la forma
      float steps = 3.0 + (1.0 - th.x) * 4.0;
      float Lq = floor(L * steps + 0.5) / steps;
      vec3 c = col * mix(1.0, (Lq + 0.03) / max(L, 0.03), 0.6);
      float t = smoothstep(0.0, 0.85, L);
      vec3 grade = mix(shadeTint * 1.5, lightTint * 1.12, t);
      c = mix(c, c * grade, 0.75);
      float ang = atan(n.y, n.x);
      vec2 bp = vec2(dot(px, vec2(cos(ang), sin(ang))), dot(px, vec2(-sin(ang), cos(ang))));
      float br = vnoise(bp * vec2(0.05, 0.45)) * 0.6 + vnoise(px * 0.25) * 0.4;
      c *= 1.0 + (br - 0.5) * 0.35 * grain;
      float rim = smoothstep(0.42, 0.12, abs(n.z)) * (sky ? 0.0 : 1.0);
      c += lightTint * rim * 0.28;
      if (sky) c = mix(col, col * grade, 0.75) * (1.0 + (vnoise(px * 0.02) - 0.5) * 0.25 * grain);
      col = mix(clamp(c, 0.0, 1.0), ink, line * 0.85);
      v = dot(col, vec3(0.333));
    } else {
      // Color dinámico: color plano saturado, negros de sombra, luz de contorno y fondo de estallido
      vec3 base = mix(vec3(lum), col, 1.35);
      vec3 chroma = clamp(base / max(lum, 0.05), 0.0, 1.6);
      float spot = th.x * 0.6;
      vec3 c;
      if (L < spot) c = ink;
      else if (L < th.x + 0.18) c = mix(chroma * 0.55, vec3(0.22, 0.26, 0.45), 0.35);
      else c = chroma * 0.98;
      float rim = smoothstep(0.42, 0.12, abs(n.z)) * step(spot, L);
      c = mix(c, vec3(1.0, 0.86, 0.62), rim * 0.55);
      if (sky && burst) {
        vec2 q = (gUv - focus) * vec2(fres.x / fres.y, 1.0);
        float ang = atan(q.y, q.x), rad = length(q);
        float k = ang * 9.549;
        float ray = step(0.45 + 0.25 * hash(vec2(floor(k), 1.0)), fract(k + vnoise(vec2(rad * 3.0, floor(k))) * 0.3));
        c = mix(burstA, burstB, smoothstep(0.05, 0.9, rad));
        c = mix(c, c * 1.18 + 0.05, ray * smoothstep(0.02, 0.25, rad));
      } else if (sky) c = col;
      col = mix(clamp(c, 0.0, 1.0), ink, line);
      v = dot(col, vec3(0.333));
    }
    gl_FragColor = vec4(applyFx(col, sky ? 1.0 : 0.0), (clearBg && sky) ? line : 1.0);
    return;
  }
  float e = 0.0;
  if (outline) {
    vec2 o = thick / res;
    float dc = lin(d);
    float dl = lin(texture2D(tDepth, vUv - vec2(o.x, 0.0)).x), dr = lin(texture2D(tDepth, vUv + vec2(o.x, 0.0)).x);
    float dd = lin(texture2D(tDepth, vUv - vec2(0.0, o.y)).x), du = lin(texture2D(tDepth, vUv + vec2(0.0, o.y)).x);
    float lap = (abs(dl + dr - 2.0 * dc) + abs(du + dd - 2.0 * dc)) / max(dc, 0.001);
    float edge = smoothstep(0.015, 0.04, lap);
    if (useNormal) {
      vec3 nc = texture2D(tNormal, vUv).xyz;
      float nd = max(max(distance(nc, texture2D(tNormal, vUv - vec2(o.x, 0.0)).xyz), distance(nc, texture2D(tNormal, vUv + vec2(o.x, 0.0)).xyz)),
                     max(distance(nc, texture2D(tNormal, vUv - vec2(0.0, o.y)).xyz), distance(nc, texture2D(tNormal, vUv + vec2(0.0, o.y)).xyz)));
      edge = max(edge, smoothstep(0.35, 0.6, nd));
    }
    e = edge;
  }
  if (contourOnly) {
    col = mix(vec3(1.0), ink, e);
  } else if (blue) {
    float shade = 1.0 - v;
    col = mix(vec3(1.0), blueInk, shade * 0.3);
    col = mix(col, blueInk, e);
  } else {
    col = mix(col, ink, e);
  }
  float a = 1.0;
  if (clearBg && (d >= 0.99999 || contourOnly)) a = contourOnly ? e : (d >= 0.99999 ? e : 1.0);
  gl_FragColor = vec4(applyFx(col, d >= 0.99999 ? 1.0 : 0.0), a);
}`;

// Modos de semirender ("arcilla" y "color" no cuantizan)
export const MODE_INDEX = { clay: 0, color: 0, values: 1, noir: 2, manga: 3, cel: 4, luz: 5, grabado: 6, dinamico: 7, pintura: 8 };
export const MODES = { clay: "Arcilla", color: "Color", values: "Valores", noir: "Noir", manga: "Manga", cel: "Cel", luz: "Notas de luz", grabado: "Grabado sepia", dinamico: "Color dinámico", pintura: "Pintura" };
// Estilos de artista: parámetros que viajan con el perfil. Los dos de base salen de las referencias de Brayand
// (sus páginas de The Elder's Apprentice y los reels de viñeta animada).
export const FX_INDEX = { ninguno: 0, velocidad: 1, enfoque: 2, impacto: 3, lluvia: 4 };
export const FX = { ninguno: "Ninguno", velocidad: "Líneas de velocidad", enfoque: "Líneas de enfoque", impacto: "Marco de impacto", lluvia: "Lluvia" };
export const STYLE_KEYS = ["mode", "th", "thick", "outline", "detail", "hatch", "grain", "lineVar", "paper", "sepia", "burst", "burstA", "burstB", "shadeTint", "lightTint", "dot", "tones", "background"];
export const BASE_STYLES = [
  { name: "Grabado sepia · Brayand", base: true, view: { mode: "grabado", th: 0.5, thick: 1.1, outline: true, hatch: 5, grain: 0.6, lineVar: 0.7, paper: "#e6d3ae", sepia: "#2a1d12", background: "papel" } },
  { name: "Pintura nocturna", base: true, view: { mode: "pintura", th: 0.5, thick: 1, outline: true, lineVar: 0.5, detail: 0.5, grain: 0.6, shadeTint: "#1f3550", lightTint: "#d8ecff" } },
  { name: "Color dinámico", base: true, view: { mode: "dinamico", th: 0.45, thick: 1.75, outline: true, lineVar: 0.6, burst: true, burstA: "#ffb36b", burstB: "#d23c35" } },
];
export const LIGHT_NOTES = [["Zona iluminada", "#f5e3b5"], ["Terminador", "#db8c3a"], ["Sombra propia", "#5e80a8"], ["Sombra proyectada", "#4a3d6b"], ["Luz reflejada", "#5fa8a0"], ["Sin luz directa", "#8c8c91"]];

// Para las notas de luz: N·L de la luz principal y la normal hacia arriba, por píxel
const ndlMat = new THREE.ShaderMaterial({
  uniforms: { lpos: { value: new THREE.Vector3() }, ldir: { value: new THREE.Vector3(0, 1, 0) }, isDir: { value: true } },
  vertexShader: `varying vec3 wp; varying vec3 wn; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); wp = w.xyz; wn = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 lpos, ldir; uniform bool isDir; varying vec3 wp; varying vec3 wn;
    void main(){ vec3 n = normalize(wn); if (!gl_FrontFacing) n = -n; vec3 L = isDir ? normalize(ldir) : normalize(lpos - wp); gl_FragColor = vec4(dot(n, L) * 0.5 + 0.5, n.y * 0.5 + 0.5, 0.0, 1.0); }`,
  side: THREE.DoubleSide,
});
const whiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });

export class Composer {
  constructor(renderer) {
    this.renderer = renderer;
    this.rt = this.makeRT(1, 1);
    this.nrt = new THREE.WebGLRenderTarget(1, 1);
    this.litRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.ndlRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.normalMat = new THREE.MeshNormalMaterial();
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false, transparent: false, blending: THREE.NoBlending,
      uniforms: {
        tColor: { value: null }, tDepth: { value: null }, tNormal: { value: null }, tLit: { value: null }, tNdl: { value: null }, camRot: { value: new THREE.Matrix3() },
        res: { value: new THREE.Vector2(1, 1) }, tile: { value: new THREE.Vector4(0, 0, 1, 1) }, near: { value: 0.05 }, far: { value: 200 },
        thick: { value: 1.5 }, mode: { value: 0 }, dotSize: { value: 7 }, tones: { value: 3 }, th: { value: new THREE.Vector4(0.2, 0.45, 0.65, 0.85) },
        outline: { value: false }, contourOnly: { value: false }, blue: { value: false }, clearBg: { value: false }, useNormal: { value: true },
        ink: { value: new THREE.Color(0.11, 0.11, 0.12) }, blueInk: { value: new THREE.Color(0.25, 0.55, 0.85) },
        hatch: { value: 5 }, detail: { value: 0.6 }, grain: { value: 0.6 }, lineVar: { value: 0.7 }, paper: { value: new THREE.Color("#e6d3ae") }, sepia: { value: new THREE.Color("#2a1d12") },
        shadeTint: { value: new THREE.Color("#1f3550") }, lightTint: { value: new THREE.Color("#d8ecff") }, noHatch: { value: false }, burst: { value: true }, burstA: { value: new THREE.Color("#ffb36b") }, burstB: { value: new THREE.Color("#d23c35") }, focus: { value: new THREE.Vector2(0.5, 0.55) }, fxType: { value: 0 }, fxAmt: { value: 0 }, fxAng: { value: 0 }, fisheye: { value: 0 }, fxInk: { value: new THREE.Color(0.08, 0.07, 0.07) },
      },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene(); this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  makeRT(w, h) {
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
    rt.depthTexture = new THREE.DepthTexture(w, h);
    rt.depthTexture.type = THREE.UnsignedIntType;
    return rt;
  }
  setSize(w, h) {
    this.rt.setSize(w, h); this.nrt.setSize(w, h); this.litRT.setSize(w, h); this.ndlRT.setSize(w, h);
  }
  // view: {mode:'clay'|'values', tones, th:[4], outline, thick}; opts: {blue, clearBg, force, target}
  render(scene, camera, view, opts = {}, hideForNormals = []) {
    const r = this.renderer;
    const post = opts.force || (MODE_INDEX[view.mode] || 0) > 0 || view.outline || opts.blue || (view.fx && view.fx !== "ninguno") || view.fisheye > 0;
    if (!post) { r.setRenderTarget(opts.target || null); r.render(scene, camera); return; }
    const rt = opts.rt || this.rt, nrt = opts.nrt || this.nrt;
    if (view.mode === "luz") this.lightNotes(scene, camera, rt, opts);
    else { r.setRenderTarget(rt); r.render(scene, camera); }
    const artist = view.mode === "grabado" || view.mode === "dinamico" || view.mode === "pintura";
    const wantN = view.outline || opts.blue || artist;
    if (wantN) {
      const bg = scene.background, fog = scene.fog;
      scene.overrideMaterial = this.normalMat; scene.background = null; scene.fog = null;
      scene.traverse(o => { if (o.userData.noLines && !hideForNormals.includes(o)) hideForNormals = [...hideForNormals, o]; });
      const vis = hideForNormals.map(o => o.visible); hideForNormals.forEach(o => (o.visible = false));
      r.setRenderTarget(nrt); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, camera);
      hideForNormals.forEach((o, i) => (o.visible = vis[i]));
      scene.overrideMaterial = null; scene.background = bg; scene.fog = fog;
    }
    const u = this.mat.uniforms;
    u.tColor.value = rt.texture; u.tDepth.value = rt.depthTexture; u.tNormal.value = nrt.texture;
    u.res.value.set(rt.width, rt.height);
    if (opts.tile) u.tile.value.fromArray(opts.tile); else u.tile.value.set(0, 0, rt.width, rt.height);
    u.near.value = camera.near; u.far.value = camera.far;
    u.mode.value = MODE_INDEX[view.mode] ?? 0;
    u.tones.value = view.tones || 3;
    u.th.value.fromArray(thresholds(view));
    u.dotSize.value = (view.dot || 7) * (opts.scale || 1);
    u.outline.value = !!(view.outline || opts.blue);
    u.useNormal.value = wantN;
    u.thick.value = (view.thick || 1.5) * (opts.scale || 1);
    u.blue.value = !!opts.blue;
    u.contourOnly.value = !!view.contourOnly;
    u.clearBg.value = !!opts.clearBg;
    u.hatch.value = (view.hatch || 5) * (opts.scale || 1);
    u.grain.value = view.grain ?? 0.6; u.detail.value = view.detail ?? 0.6; u.lineVar.value = view.lineVar ?? 0.6;
    u.paper.value.set(view.paper || "#e6d3ae"); u.sepia.value.set(view.sepia || "#2a1d12");
    u.shadeTint.value.set(view.shadeTint || "#1f3550"); u.lightTint.value.set(view.lightTint || "#d8ecff");
    u.burst.value = view.burst !== false; u.noHatch.value = !!opts.noHatch; u.burstA.value.set(view.burstA || "#ffb36b"); u.burstB.value.set(view.burstB || "#d23c35");
    u.fxType.value = FX_INDEX[view.fx] || 0; u.fxAmt.value = view.fxAmt ?? 0.6; u.fxAng.value = (view.fxAng || 0) * Math.PI / 180;
    u.fisheye.value = view.fisheye || 0; u.focus.value.set(view.focusX ?? 0.5, view.focusY ?? 0.55);
    u.fxInk.value.set(view.mode === "grabado" ? (view.sepia || "#2a1d12") : "#141212");
    if (view.mode === "dinamico") u.ink.value.setRGB(0.05, 0.04, 0.06); else u.ink.value.setRGB(0.11, 0.11, 0.12);
    r.setRenderTarget(opts.target || null);
    r.render(this.qScene, this.qCam);
  }
}

// Tres pasadas con solo la luz principal: con sombras, sin sombras y N·L
Composer.prototype.lightNotes = function (scene, camera, rt, opts) {
  const r = this.renderer, lights = [];
  scene.traverse(o => { if (o.isLight) lights.push(o); });
  const key = lights.filter(l => !l.isAmbientLight && !l.isHemisphereLight && l.visible).sort((a, b) => b.intensity - a.intensity)[0];
  const litRT = opts.litRT || this.litRT, ndlRT = opts.ndlRT || this.ndlRT;
  if (litRT.width !== rt.width || litRT.height !== rt.height) { litRT.setSize(rt.width, rt.height); ndlRT.setSize(rt.width, rt.height); }
  const vis = lights.map(l => l.visible), bg = scene.background, fog = scene.fog;
  const cc = r.getClearColor(new THREE.Color()), ca = r.getClearAlpha();
  lights.forEach(l => (l.visible = l === key));
  const aux = []; scene.traverse(o => { if ((o.isLine || o.isPoints || o.isSprite || o.userData.noLines) && o.visible) { aux.push(o); o.visible = false; } });
  scene.background = null; scene.fog = null; scene.overrideMaterial = whiteMat;
  r.setClearColor(0x000000, 1);
  r.setRenderTarget(rt); r.clear(); r.render(scene, camera);
  const recv = []; scene.traverse(o => { if (o.isMesh && o.receiveShadow) { recv.push(o); o.receiveShadow = false; } });
  r.setRenderTarget(litRT); r.clear(); r.render(scene, camera);
  recv.forEach(o => (o.receiveShadow = true));
  if (key) {
    const u = ndlMat.uniforms;
    u.isDir.value = !!key.isDirectionalLight;
    key.getWorldPosition(u.lpos.value);
    if (key.isDirectionalLight) u.ldir.value.copy(u.lpos.value).sub(key.target.getWorldPosition(new THREE.Vector3()));
  }
  scene.overrideMaterial = ndlMat;
  r.setRenderTarget(ndlRT); r.setClearColor(0x808080, 1); r.clear(); r.render(scene, camera);
  scene.overrideMaterial = null; scene.background = bg; scene.fog = fog;
  lights.forEach((l, i) => (l.visible = vis[i]));
  aux.forEach(o => (o.visible = true));
  r.setClearColor(cc, ca);
  this.mat.uniforms.tLit.value = litRT.texture; this.mat.uniforms.tNdl.value = ndlRT.texture;
};

export function thresholds(view) {
  const m = view.mode;
  const t = m === "noir" || m === "manga" ? 2 : m === "cel" || m === "grabado" || m === "dinamico" || m === "pintura" ? 3 : view.tones || 3, k = view.th ?? 0.5;
  const shift = (k - 0.5) * 0.4;
  const base = t === 2 ? [0.5, 1, 1, 1] : t === 3 ? [0.33, 0.66, 1, 1] : [0.2, 0.4, 0.6, 0.8];
  if (m === "noir") base[0] = 0.32;
  return base.map(v => (v >= 1 ? 1.01 : Math.min(0.98, Math.max(0.02, v + shift))));
}

// Render a una imagen (Blob PNG) con la cámara dada
// La misma curva del shader (barrel), aplicada en la CPU a una imagen completa
function barrelCanvas(c, fisheye) {
  const w = c.width, h = c.height, g = c.getContext("2d");
  const src = g.getImageData(0, 0, w, h), dst = g.createImageData(w, h), S = src.data, D = dst.data;
  const a = w / h, k = fisheye * 2.4, rm = 0.25 * (a * a + 1);
  for (let y = 0; y < h; y++) {
    const v = 1 - (y + 0.5) / h; // como el uv del shader: de abajo hacia arriba
    for (let x = 0; x < w; x++) {
      let cx = ((x + 0.5) / w - 0.5) * a, cy = v - 0.5;
      const f = (1 + k * (cx * cx + cy * cy)) / (1 + k * rm);
      const sx = Math.min(w - 1, Math.max(0, Math.round((cx * f / a + 0.5) * w - 0.5)));
      const sy = Math.min(h - 1, Math.max(0, Math.round((1 - (cy * f + 0.5)) * h - 0.5)));
      const si = (sy * w + sx) * 4, di = (y * w + x) * 4;
      D[di] = S[si]; D[di + 1] = S[si + 1]; D[di + 2] = S[si + 2]; D[di + 3] = S[si + 3];
    }
  }
  g.putImageData(dst, 0, 0);
}
export async function renderToBlob(renderer, composer, scene, camera, view, w, h, opts = {}, hide = []) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d");
  // Imágenes grandes (impresión a 600 ppp) se hacen por mosaicos: cada mosaico ve un pedazo del mismo
  // encuadre (setViewOffset) y el shader usa coordenadas de la imagen completa, así el rayado, la viñeta
  // y los efectos continúan sin costuras. Los mosaicos se traslapan para que el contorno no se corte.
  const max = Math.min(2048, renderer.capabilities.maxTextureSize || 2048), pad = 12;
  const tiled = w > max || h > max;
  const step = max - pad * 2;
  const scale = Math.max(1, h / 900);
  // el ojo de pez mira fuera del mosaico; por mosaicos se renderiza recto y se curva al final, en la imagen completa
  const fish = tiled ? view.fisheye || 0 : 0;
  if (fish) view = { ...view, fisheye: 0 };
  for (let ty = 0; ty < h; ty += tiled ? step : h) {
    for (let tx = 0; tx < w; tx += tiled ? step : w) {
      const x0 = tiled ? Math.max(0, tx - pad) : 0, y0 = tiled ? Math.max(0, ty - pad) : 0;
      const tw = tiled ? Math.min(w, tx + step + pad) - x0 : w, th = tiled ? Math.min(h, ty + step + pad) - y0 : h;
      if (tiled) { camera.setViewOffset(w, h, x0, y0, tw, th); camera.updateProjectionMatrix(); }
      const rt = composer.makeRT(tw, th), nrt = new THREE.WebGLRenderTarget(tw, th), out = new THREE.WebGLRenderTarget(tw, th);
      composer.render(scene, camera, view, { ...opts, force: true, rt, nrt, target: out, scale, tile: [x0, h - (y0 + th), w, h] }, hide);
      const px = new Uint8Array(tw * th * 4);
      renderer.readRenderTargetPixels(out, 0, 0, tw, th, px);
      renderer.setRenderTarget(null);
      rt.dispose(); nrt.dispose(); out.dispose();
      const img = g.createImageData(tw, th);
      for (let y = 0; y < th; y++) img.data.set(px.subarray((th - 1 - y) * tw * 4, (th - y) * tw * 4), y * tw * 4);
      // solo se pega la parte sin traslape
      const cx = tiled ? tx - x0 : 0, cy = tiled ? ty - y0 : 0, cw = tiled ? Math.min(step, w - tx) : w, ch = tiled ? Math.min(step, h - ty) : h;
      g.putImageData(img, x0, y0, cx, cy, cw, ch);
      if (tiled) await new Promise(r => setTimeout(r, 0));
    }
  }
  if (tiled) { camera.clearViewOffset(); camera.updateProjectionMatrix(); }
  if (fish) barrelCanvas(c, fish);
  if (opts.noBlob) return { canvas: c };
  return new Promise(res => c.toBlob(b => res({ blob: b, canvas: c }), "image/png"));
}
