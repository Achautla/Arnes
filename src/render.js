// Semirender: arcilla, vista de valores, contorno y modo de líneas azules para imprimir
import * as THREE from "three";

const vert = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const frag = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tColor, tDepth, tNormal, tLit, tNdl;
uniform mat3 camRot;
uniform vec2 res;
uniform float near, far, thick;
uniform int mode, tones;
uniform vec4 th;
uniform bool outline, blue, clearBg, useNormal, contourOnly;
uniform float dotSize;
uniform vec3 ink, blueInk;
float lin(float d){ float z = d * 2.0 - 1.0; return (2.0 * near * far) / (far + near - z * (far - near)); }
vec3 toSRGB(vec3 c){ return pow(max(c, 0.0), vec3(1.0/2.2)); }
float quant(float l){
  if (tones == 2) return l < th.x ? 0.0 : 1.0;
  if (tones == 3) return l < th.x ? 0.0 : (l < th.y ? 0.5 : 1.0);
  return l < th.x ? 0.0 : l < th.y ? 0.25 : l < th.z ? 0.5 : l < th.w ? 0.75 : 1.0;
}
void main(){
  vec3 col = toSRGB(texture2D(tColor, vUv).rgb);
  float d = texture2D(tDepth, vUv).x;
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  float v = lum;
  if (mode == 1) { v = quant(lum); col = vec3(v); }
  else if (mode == 2) { v = lum < th.x ? 0.0 : 1.0; col = vec3(v); }
  else if (mode == 3) {
    vec2 px = vUv * res;
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
  else if (mode == 4) {
    float q = lum < th.x ? 0.28 : (lum < th.y ? 0.62 : 1.0);
    vec3 chroma = col / max(lum, 0.04);
    col = clamp(chroma * q, 0.0, 1.0); v = q;
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
  gl_FragColor = vec4(col, a);
}`;

// Modos de semirender ("arcilla" y "color" no cuantizan)
export const MODE_INDEX = { clay: 0, color: 0, values: 1, noir: 2, manga: 3, cel: 4, luz: 5 };
export const MODES = { clay: "Arcilla", color: "Color", values: "Valores", noir: "Noir", manga: "Manga", cel: "Cel", luz: "Notas de luz" };
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
        res: { value: new THREE.Vector2(1, 1) }, near: { value: 0.05 }, far: { value: 200 },
        thick: { value: 1.5 }, mode: { value: 0 }, dotSize: { value: 7 }, tones: { value: 3 }, th: { value: new THREE.Vector4(0.2, 0.45, 0.65, 0.85) },
        outline: { value: false }, contourOnly: { value: false }, blue: { value: false }, clearBg: { value: false }, useNormal: { value: true },
        ink: { value: new THREE.Color(0.11, 0.11, 0.12) }, blueInk: { value: new THREE.Color(0.25, 0.55, 0.85) },
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
    const post = opts.force || (MODE_INDEX[view.mode] || 0) > 0 || view.outline || opts.blue;
    if (!post) { r.setRenderTarget(opts.target || null); r.render(scene, camera); return; }
    const rt = opts.rt || this.rt, nrt = opts.nrt || this.nrt;
    if (view.mode === "luz") this.lightNotes(scene, camera, rt, opts);
    else { r.setRenderTarget(rt); r.render(scene, camera); }
    const wantN = view.outline || opts.blue;
    if (wantN) {
      const bg = scene.background, fog = scene.fog;
      scene.overrideMaterial = this.normalMat; scene.background = null; scene.fog = null;
      const vis = hideForNormals.map(o => o.visible); hideForNormals.forEach(o => (o.visible = false));
      r.setRenderTarget(nrt); r.setClearColor(0x000000, 0); r.clear(); r.render(scene, camera);
      hideForNormals.forEach((o, i) => (o.visible = vis[i]));
      scene.overrideMaterial = null; scene.background = bg; scene.fog = fog;
    }
    const u = this.mat.uniforms;
    u.tColor.value = rt.texture; u.tDepth.value = rt.depthTexture; u.tNormal.value = nrt.texture;
    u.res.value.set(rt.width, rt.height);
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
  const aux = []; scene.traverse(o => { if ((o.isLine || o.isPoints || o.isSprite) && o.visible) { aux.push(o); o.visible = false; } });
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
  const t = m === "noir" || m === "manga" ? 2 : m === "cel" ? 3 : view.tones || 3, k = view.th ?? 0.5;
  const shift = (k - 0.5) * 0.4;
  const base = t === 2 ? [0.5, 1, 1, 1] : t === 3 ? [0.33, 0.66, 1, 1] : [0.2, 0.4, 0.6, 0.8];
  if (m === "noir") base[0] = 0.32;
  return base.map(v => (v >= 1 ? 1.01 : Math.min(0.98, Math.max(0.02, v + shift))));
}

// Render a una imagen (Blob PNG) con la cámara dada
export async function renderToBlob(renderer, composer, scene, camera, view, w, h, opts = {}, hide = []) {
  const rt = composer.makeRT(w, h);
  const nrt = new THREE.WebGLRenderTarget(w, h);
  const out = new THREE.WebGLRenderTarget(w, h);
  composer.render(scene, camera, view, { ...opts, force: true, rt, nrt, target: out, scale: Math.max(1, h / 900) }, hide);
  const px = new Uint8Array(w * h * 4);
  renderer.readRenderTargetPixels(out, 0, 0, w, h, px);
  renderer.setRenderTarget(null);
  rt.dispose(); nrt.dispose(); out.dispose();
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const g = c.getContext("2d");
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++) img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
  g.putImageData(img, 0, 0);
  return new Promise(res => c.toBlob(b => res({ blob: b, canvas: c }), "image/png"));
}
