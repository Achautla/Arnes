// Arnés · Fase 1: escena, viñetas, maniquí posable, cámaras, luz, semirender y exportación
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { DEG, RAD, clamp, uid, clone, round, escapeHtml as esc, saveFile, kelvinToColor as kelvinColor, paint } from "./util.js";
import * as M from "./mannequin.js";
import { POSE_LIBRARY } from "./poses.js";
import { PRIMITIVES, PROPS, EXTRA_PROPS, TERRAIN, TERRAIN_TYPES, ALL_PROPS, buildProp } from "./props.js";
import { LIGHT_TYPES, newLight, buildLight, buildLightIcon, presetNoir, presetDay, presetSunset, presetMoon, presetNeon, presetFire, presetBacklight, presetUnder, presetBlinds, PRESETS, GOBOS } from "./lights.js";
import { Composer, renderToBlob, MODES } from "./render.js";
import { applyAtmosphere, aspectOf, sceneFor, disposeScene } from "./scenes.js";
import { SCENARIOS } from "./scenarios.js";
import { createPageEditor, styleView, FORMATS } from "./page.js";
import { Store, ASPECTS, newVineta, defaultView, defaultCamera } from "./store.js";
import { buildExample } from "./example.js";
import { createHome } from "./home.js";
import { dress, GARMENTS, MATERIALS, FOLD_TYPES, newGarment } from "./cloth.js";
import * as cloud from "./cloud.js";

const PAPER = 0xf1f0ec, DARK = 0x111214, BLUE = 0x7cc0ea, BLUE_DEEP = 0x3e7fb0;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = matchMedia("(pointer: coarse)").matches;
const desktop = matchMedia("(min-width: 900px)");
const $ = s => document.querySelector(s);

// ---------------------------------------------------------------- Escena
const viewport = $("#viewport");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.75 : 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.prepend(renderer.domElement);
const composer = new Composer(renderer);

const scene = new THREE.Scene();
const overlay = new THREE.Scene();
const content = new THREE.Group(); scene.add(content);
const lightGroup = new THREE.Group(); scene.add(lightGroup);
const iconGroup = new THREE.Group(); overlay.add(iconGroup);

const camera = new THREE.PerspectiveCamera(40, 1, 0.03, 200);

const floorMat = new THREE.MeshStandardMaterial({ color: PAPER, roughness: 1 });
const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), floorMat);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.userData.floor = true;
scene.add(floor);

const grid = new THREE.Group();
const minor = new THREE.GridHelper(10, 100, BLUE, BLUE);
minor.material.transparent = true; minor.material.opacity = 0.28;
const major = new THREE.GridHelper(20, 20, BLUE_DEEP, BLUE);
major.material.transparent = true; major.material.opacity = 0.7;
minor.position.y = 0.001; major.position.y = 0.002;
grid.add(minor, major); scene.add(grid);

const ruler = new THREE.Group(); scene.add(ruler);

// Ayudas de pose (encima de todo)
const HANDLE_KIND = { wrist_L: "end", wrist_R: "end", ankle_L: "end", ankle_R: "end", hips: "core", chest: "core", head: "core", elbow_L: "pole", elbow_R: "pole", knee_L: "pole", knee_R: "pole" };
const hMat = c => new THREE.MeshBasicMaterial({ color: c, depthTest: false, transparent: true, opacity: 0.92 });
const handleMats = { end: hMat(0x2f8fd8), core: hMat(0x8e5bd6), pole: hMat(0xe0873b), pin: hMat(0xd9443a) };
const handleRing = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true });
const handles = {};
for (const [n, kind] of Object.entries(HANDLE_KIND)) {
  const g = new THREE.Group();
  const s = new THREE.Mesh(new THREE.SphereGeometry(kind === "pole" ? 0.8 : 1, 16, 12), handleMats[kind]);
  const r = new THREE.Mesh(new THREE.SphereGeometry(kind === "pole" ? 1.05 : 1.25, 16, 12), handleRing);
  r.renderOrder = 19; s.renderOrder = 20;
  g.add(r, s); g.userData.handle = n; g.userData.core = s; g.userData.kind = kind; s.userData.handle = n; r.userData.handle = n;
  g.visible = false; overlay.add(g); handles[n] = g;
}
const actionLine = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xe0563b, depthTest: false, transparent: true, opacity: 0.85 }));
actionLine.renderOrder = 15; actionLine.visible = false; overlay.add(actionLine);
const comMarker = new THREE.Group();
const comDisc = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.05, 32), new THREE.MeshBasicMaterial({ color: 0x2e9e5b, depthTest: false, transparent: true, side: THREE.DoubleSide }));
comDisc.rotation.x = -Math.PI / 2;
const comLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 1, 0)]), new THREE.LineDashedMaterial({ color: 0x2e9e5b, dashSize: 0.03, gapSize: 0.02, depthTest: false, transparent: true }));
comMarker.add(comDisc, comLine); comMarker.renderOrder = 16; comMarker.visible = false; overlay.add(comMarker);

// Controles: primero los nuestros y el gizmo, al final la órbita (así pueden detenerla)
const tcontrols = new TransformControls(camera, renderer.domElement);
tcontrols.size = coarse ? 1.35 : 1;
overlay.add(tcontrols);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 0.15; controls.maxDistance = 30;
controls.maxPolarAngle = Math.PI * 0.96;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

// ---------------------------------------------------------------- Estado
const store = new Store();
const ui = {
  tab: "escena", sel: null, joint: null, tmode: "translate", pinFeet: true,
  clipboardPose: null, through: false, rings: false, sym: false, finger: "index", handSide: "L", dirty: 3, exportOpen: false, status: "",
};
const world = new Map();   // id → THREE.Group (objetos)
const figs = new Map();    // id → figura del maniquí
const lights = new Map();  // id → { light, icon }

const findObj = id => store.v.objects.find(o => o.id === id);
const findLight = id => store.v.lights.find(o => o.id === id);
const selObj = () => (ui.sel ? findObj(ui.sel) : null);
const selLight = () => (ui.sel ? findLight(ui.sel) : null);
const markDirty = (n = 2) => { ui.dirty = Math.max(ui.dirty, n); };

function hScale(fig) { return fig.d.H / 1.75; }

function buildObject(o) {
  let g;
  if (o.kind === "figure") {
    o.face ??= clone(M.DEFAULT_FACE); o.pins ??= {}; o.anchors ??= {};
    const fig = M.buildFigure(o.params);
    M.applyPose(fig, o.pose, o.relaxed);
    M.applyFace(fig, o.face);
    figs.set(o.id, fig);
    g = fig.root;
    g.position.fromArray(o.pos); g.rotation.set(0, (o.rotY || 0) * DEG, 0);
    if (o.clothes?.length) dressFig(o, fig);
  } else {
    g = buildProp(o.type, o.params);
    g.position.fromArray(o.pos);
    g.rotation.set(...(o.rot || [0, 0, 0]).map(d => d * DEG));
    g.scale.fromArray(o.scale || [1, 1, 1]);
  }
  g.userData.objId = o.id;
  g.traverse(c => { c.userData.objId = o.id; });
  if (o.color) paint(g, o.color, store.v.view.mode !== "clay");
  if (store.v.view.forms && o.kind === "figure") addForms(g);
  g.updateMatrixWorld(true);
  world.set(o.id, g); content.add(g);
  return g;
}
function dressFig(o, fig) {
  const v = store.v.view;
  fig.root.updateMatrixWorld(true);
  fig.dress?.dispose();
  fig.dress = o.clothes?.length ? dress(fig, o.clothes, { quality: v.clothQ, useColor: v.mode !== "clay", map: !!v.tension, wind: v.wind || 0, windDir: v.windDir || 0 }) : null;
  fig.root.traverse(c => { c.userData.objId = o.id; });
}
const defaultClothQ = matchMedia("(pointer: coarse)").matches || (navigator.hardwareConcurrency || 8) <= 4 ? "media" : "alta";
const OUTFITS = {
  noir: { label: "Detective noir", items: ["pantalon", "camisa", "gabardina"] },
  formal: { label: "Traje", items: ["pantalon", "camisa", "saco"] },
  casual: { label: "Camisa y pantalón", items: ["pantalon", "camisa"] },
  vestido: { label: "Vestido", items: ["vestido"] },
  heroe: { label: "Capa", items: ["pantalon", "camisa", "capa"] },
};
function rebuildObject(o) {
  const old = world.get(o.id);
  if (old) { content.remove(old); disposeTree(old); }
  figs.delete(o.id);
  const g = buildObject(o);
  if (ui.sel === o.id) attachGizmo();
  return g;
}
function disposeTree() { /* las geometrías se comparten entre figuras: no se liberan */ }

function rebuildLights() {
  lightGroup.clear(); iconGroup.clear(); lights.clear();
  const low = coarse;
  for (const def of store.v.lights) {
    const light = buildLight(def, low);
    lightGroup.add(light); if (light.target) lightGroup.add(light.target);
    const icon = buildLightIcon(def);
    icon.visible = def.type !== "ambiente";
    iconGroup.add(icon);
    lights.set(def.id, { light, icon });
  }
}
function applyBackground() {
  const v = store.v.view, dark = v.background === "oscuro";
  applyAtmosphere(scene, v);
  minor.material.opacity = dark ? 0.12 : 0.28; major.material.opacity = dark ? 0.3 : 0.7;
  grid.visible = !!v.grid;
  const terrain = [...world.values()].some(g => g.userData.hidesFloor);
  floor.visible = v.floor !== false && !terrain;
}
function repaintAll() {
  const useColor = store.v.view.mode !== "clay";
  for (const f of figs.values()) f.dress?.setStyle({ color: useColor, map: !!store.v.view.tension });
  for (const o of store.v.objects) { const g = world.get(o.id); if (g) paint(g, o.color || null, useColor); }
}
// Formas básicas: cajas de construcción sobre cada parte del cuerpo (ayuda para dibujar)
const formsMat = new THREE.LineBasicMaterial({ color: 0x3e7fb0, transparent: true, opacity: 0.85 });
function addForms(root) {
  root.traverse(m => {
    if (!m.isMesh || !m.userData.mass || m.userData.forms) return;
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox, size = b.getSize(new THREE.Vector3()), c = b.getCenter(new THREE.Vector3());
    const box = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)), formsMat);
    box.position.copy(c); box.userData.formsLine = true; box.raycast = () => {};
    m.add(box); m.userData.forms = box;
  });
}
function rebuildScene() {
  tcontrols.detach();
  for (const g of world.values()) { content.remove(g); disposeTree(g); }
  world.clear(); figs.clear();
  for (const o of store.v.objects) buildObject(o);
  rebuildLights();
  applyBackground();
  if (ui.sel && !findObj(ui.sel) && !findLight(ui.sel)) { ui.sel = null; ui.joint = null; }
  applyCameraState();
  attachGizmo();
  buildRuler();
  markDirty(3);
}

// ---------------------------------------------------------------- Cámara y marco
const frameEl = $("#frame"), svg = $("#guides");
let frameRect = { x: 0, y: 0, w: 1, h: 1 };
function frameAspect() { return aspectOf(store.v.camera, viewport.clientWidth / viewport.clientHeight); }
function fovFrame() { return 2 * Math.atan(12 / store.v.camera.mm); }
function layoutFrame() {
  const vw = viewport.clientWidth, vh = viewport.clientHeight, pad = ui.through ? 0 : 14;
  const A = frameAspect(), aw = vw - 2 * pad, ah = vh - 2 * pad;
  let fw, fh;
  if (A > aw / ah) { fw = aw; fh = aw / A; } else { fh = ah; fw = ah * A; }
  frameRect = { x: (vw - fw) / 2, y: (vh - fh) / 2, w: fw, h: fh };
  Object.assign(frameEl.style, { left: frameRect.x + "px", top: frameRect.y + "px", width: fw + "px", height: fh + "px" });
  camera.aspect = vw / vh;
  camera.fov = 2 * Math.atan(Math.tan(fovFrame() / 2) * vh / fh) * RAD;
  camera.updateProjectionMatrix();
}
function exportCamera() {
  const c = new THREE.PerspectiveCamera(fovFrame() * RAD, frameAspect(), camera.near, camera.far);
  c.position.copy(camera.position); c.quaternion.copy(camera.quaternion); c.updateMatrixWorld(true);
  return c;
}
function applyCameraState() {
  const c = store.v.camera;
  camera.position.fromArray(c.pos); controls.target.fromArray(c.target);
  layoutFrame(); syncLensUI();
}
function storeCamera() {
  const c = store.v.camera;
  c.pos = camera.position.toArray().map(v => round(v, 3));
  c.target = controls.target.toArray().map(v => round(v, 3));
}
let tween = null;
function goTo(pos, target, roll) {
  const c = store.v.camera;
  if (roll !== undefined) c.roll = roll;
  if (reduceMotion) { camera.position.copy(pos); controls.target.copy(target); storeCamera(); store.touch(); markDirty(); return; }
  tween = { t0: performance.now(), dur: 520, fromP: camera.position.clone(), fromT: controls.target.clone(), toP: pos.clone(), toT: target.clone() };
}
function stepTween(now) {
  if (!tween) return;
  const k = Math.min(1, (now - tween.t0) / tween.dur), e = 1 - Math.pow(1 - k, 3);
  camera.position.lerpVectors(tween.fromP, tween.toP, e);
  controls.target.lerpVectors(tween.fromT, tween.toT, e);
  markDirty();
  if (k === 1) { tween = null; storeCamera(); store.touch(); }
}
controls.addEventListener("start", () => { tween = null; });
controls.addEventListener("change", () => markDirty());
controls.addEventListener("end", () => { storeCamera(); store.touch(); });
tcontrols.addEventListener("change", () => markDirty());

// Planos predefinidos: encuadran al personaje seleccionado (o al primero)
const SHOTS = {
  detalle: { label: "Detalle", ext: 0.28, at: 0.86 },
  primer: { label: "Primer plano", ext: 0.5, at: 0.9 },
  medio: { label: "Plano medio", ext: 0.9, at: 0.74 },
  americano: { label: "Americano", ext: 1.3, at: 0.62 },
  general: { label: "General", ext: 1.45, at: 0.5 },
};
const ANGLES = { normal: { label: "Normal", el: 4 }, picado: { label: "Picado", el: 38 }, contrapicado: { label: "Contrapicado", el: -28 }, ras: { label: "A ras de piso", el: null } };
function shotFigure() {
  const o = selObj();
  if (o?.kind === "figure") return o;
  return store.v.objects.find(x => x.kind === "figure");
}
function applyShot(shot, angle) {
  const c = store.v.camera;
  shot = shot || c.shot || "medio"; angle = angle || c.angle || "normal";
  c.shot = shot; c.angle = angle;
  const o = shotFigure();
  if (!o) { toast("Agrega un personaje para usar los planos."); return; }
  const fig = figs.get(o.id);
  const S = SHOTS[shot];
  fig.root.updateMatrixWorld(true);
  // Centro: la altura proporcional en el cuerpo real (sigue a la pelvis si está sentado o agachado)
  const head = fig.joints.head.getWorldPosition(new THREE.Vector3()); head.y += fig.d.hh * 0.5;
  const feet = fig.root.position.clone();
  const hips = fig.joints.hips.getWorldPosition(new THREE.Vector3());
  const top = head.y + fig.d.hh * 0.5, span = Math.max(0.3, top - feet.y);
  let center;
  if (shot === "detalle" || shot === "primer") center = head.clone().setY(head.y - (shot === "primer" ? fig.d.hh * 0.6 : 0));
  else center = new THREE.Vector3(hips.x, feet.y + span * S.at, hips.z);
  const ext = S.ext * hScale(fig) * (shot === "general" ? span / (fig.d.H) : 1);
  const dist = (ext / 2) / Math.tan(fovFrame() / 2) * (frameAspect() < 1 ? 1.15 : 1);
  const fwd = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), (o.rotY || 0) * DEG + 22 * DEG);
  let el = ANGLES[angle].el;
  let pos;
  if (angle === "ras") {
    pos = center.clone().addScaledVector(fwd, dist); pos.y = 0.05;
  } else {
    el *= DEG;
    pos = center.clone().addScaledVector(fwd, dist * Math.cos(el)); pos.y = center.y + dist * Math.sin(el);
    if (pos.y < 0.05) pos.y = 0.05;
  }
  goTo(pos, center);
  renderPanel();
}

// ---------------------------------------------------------------- Regla de cabezas
function spriteLabel(text, w = 0.3, color = "#3e7fb0") {
  const c = document.createElement("canvas"); c.width = 512; c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = color; g.font = "600 66px 'JetBrains Mono', monospace";
  g.textAlign = "right"; g.textBaseline = "middle"; g.fillText(text, 500, 64);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(w, w / 4, 1); return s;
}
function buildRuler() {
  ruler.clear();
  const o = selObj();
  if (!store.v.view.ruler || o?.kind !== "figure") { ruler.visible = false; return; }
  const fig = figs.get(o.id), { H, hh } = fig.d, heads = o.params.heads;
  const x = -0.42 * hScale(fig);
  const pts = [new THREE.Vector3(x, 0, 0), new THREE.Vector3(x, H, 0)];
  const n = Math.floor(heads);
  for (let i = 0; i <= n; i++) { const y = H - i * hh; pts.push(new THREE.Vector3(x - 0.035, y, 0), new THREE.Vector3(x + 0.035, y, 0)); }
  pts.push(new THREE.Vector3(x - 0.035, 0.001, 0), new THREE.Vector3(x + 0.035, 0.001, 0));
  ruler.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: BLUE_DEEP })));
  for (let i = 1; i <= n; i++) { const s = spriteLabel(String(i), 0.36); s.position.set(x - 0.16, H - i * hh + hh / 2, 0); ruler.add(s); }
  if (heads > n) { const s = spriteLabel(String(round(heads - n, 2)).replace("0.", "."), 0.36); s.position.set(x - 0.16, (heads - n) * hh / 2, 0); ruler.add(s); }
  const top = spriteLabel(`${o.params.height} cm`, 0.5); top.position.set(x - 0.06, H + 0.07, 0); ruler.add(top);
  ruler.position.fromArray(o.pos); ruler.rotation.y = (o.rotY || 0) * DEG;
  ruler.visible = true;
}

// ---------------------------------------------------------------- Selección y gizmo
function select(id, joint = null) {
  ui.sel = id; ui.joint = joint;
  if (joint && /^(thumb|index|middle|ring|pinky)/.test(joint)) { ui.handSide = joint.slice(-1); ui.finger = joint.replace(/\d_[LR]$/, ""); ui.fingerOpen = true; }
  attachGizmo(); buildRuler(); renderPanel(); markDirty();
}
function attachGizmo() {
  tcontrols.detach();
  tcontrols.size = coarse ? 1.35 : 1;
  if (!ui.sel || ui.through) return;
  const o = selObj(), l = selLight();
  if (o?.kind === "figure" && ui.tab === "pose") {
    const j = ui.joint && figs.get(o.id)?.joints[ui.joint];
    if (j && ui.rings) {
      tcontrols.attach(j); tcontrols.setMode("rotate"); tcontrols.setSpace("local");
      tcontrols.showX = tcontrols.showY = tcontrols.showZ = true;
      tcontrols.size = coarse ? 0.95 : 0.65;
    }
    return;
  }
  if (o && ui.tmode) {
    tcontrols.attach(world.get(o.id));
    tcontrols.setMode(o.kind === "figure" && ui.tmode === "scale" ? "translate" : ui.tmode);
    const rotFig = o.kind === "figure" && tcontrols.mode === "rotate";
    tcontrols.showX = !rotFig; tcontrols.showZ = !rotFig; tcontrols.showY = true;
    tcontrols.setSpace(tcontrols.mode === "translate" ? "world" : "local");
  } else if (l && l.type !== "ambiente") {
    tcontrols.attach(lights.get(l.id).icon);
    tcontrols.setMode("translate"); tcontrols.showX = tcontrols.showY = tcontrols.showZ = true; tcontrols.setSpace("world");
  }
}
tcontrols.addEventListener("dragging-changed", e => { controls.enabled = !e.value; });
tcontrols.addEventListener("objectChange", () => {
  const obj = tcontrols.object; if (!obj) return;
  if (obj.userData.jointName) {
    const o = selObj(), fig = figs.get(o.id);
    M.clampJoint(fig, obj.userData.jointName, o.relaxed);
    if (ui.sym) symmetryFrom(o, fig, obj.userData.jointName);
    markDirty(); return;
  }
  if (obj.userData.lightId && !obj.userData.objId) {
    const L = lights.get(obj.userData.lightId); L.light.position.copy(obj.position);
  }
  if (ui.sel && ruler.visible && obj === world.get(ui.sel)) { ruler.position.copy(obj.position); ruler.rotation.y = obj.rotation.y; }
  markDirty();
});
tcontrols.addEventListener("mouseUp", () => {
  const obj = tcontrols.object; if (!obj) return;
  if (obj.userData.jointName) {
    const o = selObj(); o.pose = M.readPose(figs.get(o.id), o.pose);
    store.commit(); renderPanel(); return;
  }
  if (obj.userData.lightId && !obj.userData.objId) {
    const def = findLight(obj.userData.lightId); def.pos = obj.position.toArray().map(v => round(v, 3));
  } else {
    const o = findObj(obj.userData.objId); if (!o) return;
    if (obj.position.y < 0 && o.kind === "figure") obj.position.y = 0;
    o.pos = obj.position.toArray().map(v => round(v, 3));
    if (o.kind === "figure") o.rotY = round(obj.rotation.y * RAD, 1);
    else { o.rot = [obj.rotation.x, obj.rotation.y, obj.rotation.z].map(v => round(v * RAD, 1)); o.scale = obj.scale.toArray().map(v => round(v, 3)); }
  }
  store.commit(); renderPanel();
});

// ---------------------------------------------------------------- Interacción en el visor
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let press = null, drag = null;
function setNdc(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
}
function handlesActive() { const o = selObj(); return ui.tab === "pose" && o?.kind === "figure" && !ui.through; }
renderer.domElement.addEventListener("pointerdown", e => {
  press = { x: e.clientX, y: e.clientY, t: performance.now() };
  if (!desktop.matches) document.body.classList.remove("sheet-open");
  if (!handlesActive()) return;
  setNdc(e);
  const hits = ray.intersectObjects(Object.values(handles).filter(h => h.visible), true);
  if (!hits.length) return;
  e.stopImmediatePropagation(); e.preventDefault();
  const name = hits[0].object.userData.handle;
  const o = selObj(), fig = figs.get(o.id);
  const p = handles[name].position.clone();
  const n = camera.getWorldDirection(new THREE.Vector3());
  drag = { name, fig, o, plane: new THREE.Plane().setFromNormalAndCoplanarPoint(n, p), last: p.clone(), id: e.pointerId };
  if (name === "head") o.gaze = null;
  renderer.domElement.setPointerCapture(e.pointerId);
  controls.enabled = false;
}, { capture: true });
renderer.domElement.addEventListener("pointermove", e => {
  if (!drag || e.pointerId !== drag.id) return;
  setNdc(e);
  const hit = new THREE.Vector3();
  if (!ray.ray.intersectPlane(drag.plane, hit)) return;
  const { fig, o, name } = drag;
  const kind = HANDLE_KIND[name];
  if (name === "hips") { M.moveHips(fig, hit.clone().sub(drag.last)); resolvePins(o, fig, null); }
  else if (name === "chest") { M.solveIK(fig, "chest", hit, o.relaxed, 10); resolvePins(o, fig, null); }
  else if (name === "head") M.lookAt(fig, hit, o.relaxed);
  else if (kind === "pole") M.swingPole(fig, name, hit, o.relaxed);
  else {
    if (name.startsWith("ankle") && hit.y < 0.045 * hScale(fig)) hit.y = 0.045 * hScale(fig);
    M.solveIK(fig, name, hit, o.relaxed);
  }
  if (ui.sym && /_[LR]$/.test(name)) symmetryFrom(o, fig, name);
  drag.last.copy(hit);
  markDirty();
});
function endDrag(e) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  const { fig, o, name } = drag;
  if (o.pins?.[name]) pinHere(o, fig, name);
  o.pose = M.readPose(fig, o.pose);
  drag = null; controls.enabled = true;
  store.commit(); renderPanel();
}
renderer.domElement.addEventListener("pointerup", e => {
  if (drag) { endDrag(e); press = null; return; }
  if (!press) return;
  const moved = Math.hypot(e.clientX - press.x, e.clientY - press.y), dt = performance.now() - press.t;
  press = null;
  if (moved > 8 || dt > 600 || tcontrols.dragging || ui.through) return;
  pick(e);
});
renderer.domElement.addEventListener("pointercancel", e => endDrag(e));

function pick(e) {
  setNdc(e);
  const iconHits = ray.intersectObjects(iconGroup.children.filter(c => c.visible), true);
  if (iconHits.length) { selectTab("luz", false); select(iconHits[0].object.userData.lightId); return; }
  const hits = ray.intersectObjects(content.children, true);
  const hit = hits.find(h => h.object.visible && h.object.userData.objId);
  if (!hit) { select(null); return; }
  const id = hit.object.userData.objId, o = findObj(id);
  const ud = hit.object.userData;
  const joint = o?.kind === "figure" && ui.tab === "pose" ? (ud.jointAt ? ud.jointAt(hit.face?.a ?? 0) : ud.joint) || null : null;
  select(id, joint);
}

// ---------------------------------------------------------------- Guías: horizonte y puntos de fuga
function project(dir) {
  const d = dir.clone().applyQuaternion(camera.quaternion.clone().invert());
  if (d.z > -1e-4) return null;
  const p = camera.position.clone().addScaledVector(dir, 1000).project(camera);
  return { x: (p.x + 1) / 2 * viewport.clientWidth, y: (1 - (p.y + 1) / 2) * viewport.clientHeight };
}
function drawGuides() {
  const v = store.v.view, W = viewport.clientWidth, H = viewport.clientHeight;
  let out = "";
  const eye = Math.round(camera.position.y * 100);
  if (v.horizon) {
    const f = new THREE.Vector3().subVectors(controls.target, camera.position); f.y = 0;
    if (f.lengthSq() > 1e-6) {
      f.normalize();
      const s = new THREE.Vector3(-f.z, 0, f.x);
      const a = project(f.clone().addScaledVector(s, -0.6).normalize()), b = project(f.clone().addScaledVector(s, 0.6).normalize());
      if (a && b) {
        const k = (b.y - a.y) / (b.x - a.x || 1e-6), y0 = a.y - k * a.x, y1 = y0 + k * W;
        if ((y0 > -H && y0 < 2 * H) || (y1 > -H && y1 < 2 * H)) {
          out += `<line x1="0" y1="${y0}" x2="${W}" y2="${y1}" class="hz"/>`;
          const ly = Math.min(H - 8, Math.max(16, y0 + k * (W - 120) - 8));
          out += `<text x="${W - 12}" y="${ly}" text-anchor="end" class="hzt">Horizonte · ojo a ${eye} cm</text>`;
        }
      }
    }
  }
  if (v.vp) {
    const dirs = [["X", new THREE.Vector3(1, 0, 0)], ["X", new THREE.Vector3(-1, 0, 0)], ["Z", new THREE.Vector3(0, 0, 1)], ["Z", new THREE.Vector3(0, 0, -1)], ["V", new THREE.Vector3(0, 1, 0)], ["V", new THREE.Vector3(0, -1, 0)]];
    const cx = frameRect.x + frameRect.w / 2, cy = frameRect.y + frameRect.h / 2;
    for (const [k, d] of dirs) {
      const p = project(d);
      if (!p || p.x < -W || p.x > 2 * W || p.y < -H || p.y > 2 * H) continue;
      const inside = p.x > 0 && p.x < W && p.y > 0 && p.y < H;
      out += `<line x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" class="vpl"/>`;
      if (inside) out += `<circle cx="${p.x}" cy="${p.y}" r="7" class="vp"/><text x="${p.x + 11}" y="${p.y - 9}" class="vpt">PF ${k === "V" ? "vertical" : k}</text>`;
    }
  }
  if (v.folds) {
    const seen = [];
    for (const f of figs.values()) for (const L of f.dress?.labels() || []) {
      const q = L.at.clone().project(camera); if (q.z > 1 || Math.abs(q.x) > 1.05 || Math.abs(q.y) > 1.05) continue;
      let x = (q.x + 1) / 2 * W, y = (1 - (q.y + 1) / 2) * H;
      while (seen.some(([a, b]) => Math.abs(a - x) < 70 && Math.abs(b - y) < 22)) y += 24;
      seen.push([x, y]);
      const t = FOLD_TYPES[L.type], w = t.length * 7.4 + 16;
      out += `<g class="fold"><circle cx="${x}" cy="${y}" r="3.5"/><rect x="${x + 7}" y="${y - 11}" width="${w}" height="21" rx="10"/><text x="${x + 15}" y="${y + 4}">${t}</text></g>`;
    }
  }
  svg.innerHTML = out;
  $("#hud-eye").textContent = `Ojo ${eye} cm`;
  const re = $("#r-eye"), rd = $("#r-dist");
  if (re) re.textContent = `${eye} cm`;
  if (rd) rd.textContent = `${camera.position.distanceTo(controls.target).toFixed(1)} m`;
}

// ---------------------------------------------------------------- Ayudas por cuadro
const _v = new THREE.Vector3();
function updateHelpers() {
  const o = selObj();
  const fig = o?.kind === "figure" ? figs.get(o.id) : null;
  const showH = handlesActive();
  // Manos ancladas a otro personaje u objeto
  for (const ob of store.v.objects) {
    if (ob.kind !== "figure" || !ob.anchors) continue;
    const f = figs.get(ob.id); if (!f) continue;
    for (const [end, a] of Object.entries(ob.anchors)) {
      if (!a || (drag && drag.o === ob && drag.name === end)) continue;
      const t = anchorTarget(a); if (t) M.solveIK(f, end, t, ob.relaxed, 8);
    }
  }
  for (const [n, h] of Object.entries(handles)) {
    h.visible = !!(showH && fig);
    if (!h.visible) continue;
    if (n === "head") fig.joints.head.localToWorld(h.position.set(0, fig.d.hh * 1.12, 0));
    else fig.joints[n].getWorldPosition(h.position);
    const dist = camera.position.distanceTo(h.position);
    h.scale.setScalar(Math.max(0.016, dist * (coarse ? 0.021 : 0.013)) * (h.userData.kind === "pole" ? 0.85 : 1));
    h.userData.core.material = o.pins?.[n] ? handleMats.pin : handleMats[h.userData.kind];
  }
  // Mirada (personajes que miran al lector o a otro personaje)
  for (const ob of store.v.objects) {
    if (ob.kind !== "figure" || !ob.gaze || ob.gazeHold) continue;
    const f = figs.get(ob.id); if (!f) continue;
    let t = null;
    if (ob.gaze === "camera") t = camera.position.clone();
    else { const other = figs.get(ob.gaze); if (other) { t = other.joints.head.getWorldPosition(new THREE.Vector3()); t.y += other.d.hh * 0.45; } }
    if (t) M.lookAt(f, t, ob.relaxed);
  }
  // Línea de acción y centro de masa
  const v = store.v.view;
  actionLine.visible = !!(fig && v.action && !ui.through);
  if (actionLine.visible) {
    const curve = new THREE.CatmullRomCurve3(M.actionPoints(fig));
    actionLine.geometry.dispose();
    actionLine.geometry = new THREE.TubeGeometry(curve, 40, 0.008 * hScale(fig), 6, false);
  }
  comMarker.visible = !!(fig && v.com && !ui.through && ui.tab === "pose");
  let off = false;
  if (comMarker.visible) {
    const c = M.centerOfMass(fig);
    comMarker.position.set(c.x, 0.004, c.z);
    comLine.scale.y = c.y; comLine.computeLineDistances();
    const sitting = (o.pose.hips?.[1] || 0) < -0.15 * hScale(fig);
    const poly = M.supportPolygon(fig);
    off = !sitting && poly.length >= 3 && !M.insidePolygon([c.x, c.z], poly);
    const col = sitting || poly.length < 3 ? 0x9aa1a8 : off ? 0xd9443a : 0x2e9e5b;
    comDisc.material.color.setHex(col); comLine.material.color.setHex(col);
  }
  $("#hud-balance").hidden = !off;
  for (const { icon } of lights.values()) {
    const d = camera.position.distanceTo(icon.position);
    icon.scale.setScalar(Math.max(0.5, d * 0.18));
    icon.visible = !ui.through && findLight(icon.userData.lightId)?.type !== "ambiente";
    icon.userData.ring.material.color.setHex(ui.sel === icon.userData.lightId ? 0x2f8fd8 : 0x1d2023);
  }
}

// ---------------------------------------------------------------- Bucle de render
function resize() {
  if (!store.project) return;
  const w = viewport.clientWidth, h = viewport.clientHeight;
  renderer.setSize(w, h, false);
  const pr = renderer.getPixelRatio();
  composer.setSize(Math.floor(w * pr), Math.floor(h * pr));
  layoutFrame(); markDirty(3);
}
new ResizeObserver(resize).observe(viewport);

let lastFrame = 0;
renderer.setAnimationLoop(now => {
  if (!store.project || ui.tab === "pagina") return;
  stepTween(now);
  const changed = controls.update();
  if (changed) markDirty();
  const roll = store.v?.camera.roll || 0;
  if (roll) camera.rotateZ(roll * DEG);
  if (camera.position.y < 0.03) camera.position.y = 0.03;
  for (const f of figs.values()) if (f.dress?.tick(now)) ui.dirty = Math.max(ui.dirty || 0, 1);
  if (!ui.dirty && !store.v.objects.some(o => o.gaze === "camera")) return;
  if (ui.dirty) ui.dirty--;
  updateHelpers();
  renderer.autoClear = true;
  composer.render(scene, camera, store.v.view, {}, [grid, ruler]);
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(overlay, camera);
  renderer.autoClear = true;
  drawGuides();
  lastFrame = now;
});

// ---------------------------------------------------------------- Operaciones del modelo
function addFigure() {
  const n = store.v.objects.filter(o => o.kind === "figure").length;
  const pose = M.emptyPose();
  Object.assign(pose.rot, clone(POSE_LIBRARY.de_pie.pose.rot), M.handPoseRot("relajada", "L"), M.handPoseRot("relajada", "R"));
  const o = {
    id: uid("f"), kind: "figure", name: `Personaje ${n + 1}`, pos: [n * 0.8, 0, 0], rotY: 0,
    params: { ...M.DEFAULT_PARAMS }, pose, hands: { L: "relajada", R: "relajada" },
    face: clone(M.DEFAULT_FACE), pins: {}, anchors: {}, gaze: null, relaxed: false,
  };
  store.v.objects.push(o); const g = buildObject(o);
  const fig = figs.get(o.id);
  pinHere(o, fig, "ankle_L"); pinHere(o, fig, "ankle_R");
  void g; store.commit(); select(o.id);
}
function addProp(type) {
  const def = ALL_PROPS()[type];
  const t = controls.target;
  const o = { id: uid("p"), kind: "prop", type, name: def.label, pos: [round(t.x, 2), 0, round(t.z, 2)], rot: [0, 0, 0], scale: [1, 1, 1], params: { ...def.params } };
  if (type === "vaso" || type === "lampara") o.pos[1] = 0;
  store.v.objects.push(o); buildObject(o); store.commit(); select(o.id);
}
async function importGlb(f) {
  if (!f) return;
  if (f.size > 8e6) { toast("El modelo pesa más de 8 MB: simplifícalo antes de importarlo."); return; }
  const src = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
  const t = controls.target;
  const o = { id: uid("p"), kind: "prop", type: "modelo", name: f.name.replace(/\.(glb|gltf)$/i, ""), pos: [round(t.x, 2), 0, round(t.z, 2)], rot: [0, 0, 0], scale: [1, 1, 1], params: { src } };
  store.v.objects.push(o); buildObject(o); store.commit(); select(o.id);
  toast("Modelo importado en arcilla. Si se ve muy grande o pequeño, cambia su escala.");
}
addEventListener("arnes-model", () => { markDirty(3); if (ui.tab === "pagina") pageEd.draw(); });
addEventListener("arnes-model-failed", () => toast("No se pudo leer ese modelo. Prueba exportarlo de nuevo como .glb."));
function deleteSelected() {
  const id = ui.sel; if (!id) return;
  const v = store.v;
  if (findObj(id)) {
    v.objects = v.objects.filter(o => o.id !== id);
    for (const o of v.objects) if (o.gaze === id) o.gaze = null;
    const g = world.get(id); content.remove(g); world.delete(id); figs.delete(id);
  } else if (findLight(id)) { v.lights = v.lights.filter(l => l.id !== id); rebuildLights(); }
  ui.sel = null; ui.joint = null; tcontrols.detach();
  store.commit(); buildRuler(); renderPanel(); markDirty();
}
function duplicateSelected() {
  const o = selObj(); if (!o) return;
  const c = clone(o); c.id = uid(o.kind === "figure" ? "f" : "p"); c.name = store.nextName(o.name);
  c.pos = [o.pos[0] + 0.5, o.pos[1], o.pos[2] + 0.3];
  store.v.objects.push(c); buildObject(c); store.commit(); select(c.id);
}
function setPose(o, lib) {
  const fig = figs.get(o.id), s = hScale(fig);
  const full = M.emptyPose();
  Object.assign(full.rot, clone(o.pose.rot));
  for (const j of M.BODY_JOINTS) full.rot[j] = [0, 0, 0];
  for (const [j, r] of Object.entries(lib.pose.rot)) full.rot[j] = r.slice();
  if (lib.hands) Object.assign(full.rot, M.handPoseRot(lib.hands[0], "L"), M.handPoseRot(lib.hands[1], "R"));
  full.hips = (lib.pose.hips || [0, 0, 0]).map(v => v * s);
  full.body = null;
  M.applyPose(fig, full, o.relaxed);
  if (lib.pose.ik) {
    fig.root.updateMatrixWorld(true);
    for (const [end, p] of Object.entries(lib.pose.ik)) {
      const target = new THREE.Vector3(p[0] * s, p[1] * s, p[2] * s).applyMatrix4(fig.root.matrixWorld);
      M.solveIK(fig, end, target, o.relaxed, 30);
    }
  }
  const pose = M.readPose(fig, full);
  pose.body = lib.pose.body ? lib.pose.body.slice() : null;
  M.applyPose(fig, pose, o.relaxed);
  if (lib.pose.ground !== false) groundFigure(fig);
  o.pose = M.readPose(fig, pose);
  if (lib.hands) o.hands = { L: lib.hands[0], R: lib.hands[1] };
  o.gaze = null;
  for (const end of Object.keys(o.pins || {})) if (o.pins[end]) pinHere(o, fig, end);
  markDirty(3);
}

// Apoya el punto más bajo de la figura sobre el piso
function groundFigure(fig) {
  const min = M.lowestPoint(fig) - fig.root.position.y;
  fig.joints.hips.position.y -= min;
  fig.root.updateMatrixWorld(true);
}
// Fijar manos y pies: el punto se guarda relativo a la figura, así viaja con ella al moverla
const ENDS = [["wrist_L", "Mano izq."], ["wrist_R", "Mano der."], ["ankle_L", "Pie izq."], ["ankle_R", "Pie der."]];
function pinHere(o, fig, end) {
  o.pins ??= {};
  const w = fig.joints[end].getWorldPosition(new THREE.Vector3());
  o.pins[end] = fig.root.worldToLocal(w).toArray().map(v => round(v, 4));
}
function resolvePins(o, fig, except) {
  for (const [end, p] of Object.entries(o.pins || {})) {
    if (!p || end === except || o.anchors?.[end]) continue;
    M.solveIK(fig, end, fig.root.localToWorld(new THREE.Vector3(...p)), o.relaxed, 10);
  }
}
// Simetría en vivo: copia el lado tocado al otro
function symmetryFrom(o, fig, jointOrEnd) {
  const side = jointOrEnd.match(/_([LR])$/)?.[1]; if (!side) return;
  const pose = M.readPose(fig, o.pose);
  M.symmetrize(pose, side);
  M.applyPose(fig, pose, o.relaxed);
}
// Anclas: punto de otro personaje (articulación) u objeto
function anchorTarget(a) {
  const t = a.part ? figs.get(a.obj)?.joints[a.part] : world.get(a.obj);
  if (!t) return null;
  t.updateMatrixWorld(true);
  return t.localToWorld(new THREE.Vector3(...a.off));
}
function setAnchor(o, end, value) {
  o.anchors ??= {};
  if (!value) { delete o.anchors[end]; return; }
  const [obj, part] = value.split("|");
  const t = part ? figs.get(obj)?.joints[part] : world.get(obj);
  if (!t) return;
  const w = figs.get(o.id).joints[end].getWorldPosition(new THREE.Vector3());
  t.updateMatrixWorld(true);
  o.anchors[end] = { obj, part: part || null, off: t.worldToLocal(w).toArray().map(v => round(v, 4)) };
}
// Migración de proyectos de la Fase 1 al esqueleto nuevo
function migrate(p) {
  if (p.version >= 2) return p;
  for (const v of p.vinetas) for (const o of v.objects) {
    if (o.kind !== "figure") continue;
    const pose = M.emptyPose();
    Object.assign(pose.rot, M.fromV1(o.pose?.rot || {}));
    const h = o.hands || { L: "relajada", R: "relajada" };
    Object.assign(pose.rot, M.handPoseRot(h.L, "L"), M.handPoseRot(h.R, "R"));
    pose.hips = o.pose?.hips || [0, 0, 0];
    o.pose = pose; o.face = clone(M.DEFAULT_FACE); o.pins = {}; o.anchors = {};
  }
  p.version = 2;
  return p;
}

// ---------------------------------------------------------------- Interfaz (paneles)
const panel = $("#panel-body");
const tabs = [...document.querySelectorAll('[role="tab"]')];
function selectTab(name, fromUser = true) {
  const same = name === ui.tab;
  ui.tab = name;
  pageEd.show(name === "pagina");
  document.body.classList.toggle("page-mode", name === "pagina");
  for (const t of tabs) t.setAttribute("aria-selected", String(t.dataset.tab === name));
  if (!desktop.matches && fromUser) document.body.classList.toggle("sheet-open", !(same && document.body.classList.contains("sheet-open")));
  if (!desktop.matches && !fromUser) document.body.classList.add("sheet-open");
  attachGizmo(); renderPanel(); markDirty();
}
tabs.forEach(t => t.addEventListener("click", () => selectTab(t.dataset.tab)));

const pill = (val, cur, label, act, extra = "") => `<button class="pill${val === cur ? " on" : ""}" data-act="${act}" data-val="${esc(val)}" ${extra}>${esc(label)}</button>`;
const slider = (id, label, val, min, max, step, unit = "", act = "set") =>
  `<div class="field"><label for="${id}">${esc(label)} <output id="${id}-o">${esc(fmt(val, step))}${unit}</output></label>
   <input type="range" id="${id}" data-act="${act}" data-key="${id}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
const toggle = (key, label, sub, on, act = "view") =>
  `<label class="toggle"><span>${esc(label)}${sub ? `<small>${esc(sub)}</small>` : ""}</span><input type="checkbox" data-act="${act}" data-key="${key}" ${on ? "checked" : ""}></label>`;
function fmt(v, step) { return step >= 1 ? Math.round(v) : step >= 0.1 ? Number(v).toFixed(1) : Number(v).toFixed(2); }
const num = (key, label, val, unit, step = 1) =>
  `<label class="num"><span>${esc(label)}</span><input type="number" inputmode="decimal" data-act="num" data-key="${key}" value="${val}" step="${step}"><em>${unit}</em></label>`;

function renderPanel() {
  const t = ui.tab;
  let h = "";
  if (t === "escena") h = panelEscena();
  else if (t === "pose") h = panelPose();
  else if (t === "camara") h = panelCamara();
  else if (t === "pagina") h = pageEd.panelHtml(pill);
  else h = panelLuz();
  panel.innerHTML = h;
  $("#vchip").textContent = store.v.name;
  $("#undo").disabled = !store.past.length; $("#redo").disabled = !store.future.length;
  renderToolbar();
}

function panelEscena() {
  const v = store.v, P = store.project;
  let h = `<h2>Viñetas</h2><p class="sub">Cada viñeta es su propio cuarto 3D. Duplícala para armar la siguiente sin rehacer nada.</p>
  <div class="vlist">${P.vinetas.map((x, i) => `<button class="vitem${i === P.cur ? " on" : ""}" data-act="vineta" data-val="${i}"><b>${i + 1}</b><span>${esc(x.name)}</span></button>`).join("")}</div>
  <div class="row"><button class="btn" data-act="v-dup">Duplicar viñeta</button><button class="btn" data-act="v-new">Nueva vacía</button></div>
  <div class="row"><input class="text" id="vname" value="${esc(v.name)}" aria-label="Nombre de la viñeta"><button class="btn" data-act="v-ren">Renombrar</button><button class="btn danger" data-act="v-del" ${P.vinetas.length < 2 ? "disabled" : ""}>Borrar</button></div>`;
  h += `<h2>Agregar</h2><div class="adds"><button class="btn accent" data-act="add-fig">+ Personaje</button>
    ${Object.entries(PRIMITIVES).map(([k, d]) => `<button class="btn" data-act="add" data-val="${k}">${d.label}</button>`).join("")}</div>
    <details class="more"><summary>Utilería (${Object.keys(PROPS).length + Object.keys(EXTRA_PROPS).length})</summary><div class="adds">${Object.entries({ ...PROPS, ...EXTRA_PROPS }).map(([k, d]) => `<button class="btn" data-act="add" data-val="${k}">${d.label}</button>`).join("")}</div></details>
    <div class="row"><button class="btn" data-act="import-glb">Importar modelo .glb</button><input type="file" id="glbfile" accept=".glb,.gltf,model/gltf-binary" hidden></div>
    <details class="more"><summary>Escenarios y terreno (${Object.keys(SCENARIOS).length})</summary><p class="sub">Se agregan a esta viñeta como objetos normales: puedes mover o borrar cualquier pieza.</p><div class="adds">${Object.entries(SCENARIOS).map(([k, d]) => `<button class="btn" data-act="scenario" data-val="${k}">${d.label}</button>`).join("")}</div></details>`;
  h += `<h2>En esta viñeta</h2>`;
  h += v.objects.length ? `<div class="olist">${v.objects.map(o => `<button class="oitem${o.id === ui.sel ? " on" : ""}" data-act="sel" data-val="${o.id}"><span>${esc(o.name)}</span><small>${o.kind === "figure" ? `${o.params.height} cm · ${o.params.heads} cabezas` : (ALL_PROPS()[o.type]?.label || o.type)}</small></button>`).join("")}</div>`
    : `<p class="empty">Todavía no hay nada. Agrega un personaje o un objeto.</p>`;
  const o = selObj();
  if (o) h += propsOf(o);
  h += `<h2>Visor</h2><div class="toggles">${toggle("grid", "Grilla", "Líneas cada 10 cm y cada 1 m", v.view.grid)}${toggle("ruler", "Regla de cabezas", "Junto al personaje seleccionado", v.view.ruler)}
    ${toggle("floor", "Piso", "Apágalo para escenas en el aire o sobre terreno", v.view.floor !== false)}${toggle("forms", "Formas básicas", "Cajas de construcción sobre el cuerpo, para aprender a dibujarlo", !!v.view.forms)}
    ${toggle("tension", "Mapa de la tela", "Azul donde se comprime (pliegues), rojo donde se estira", !!v.view.tension)}${toggle("folds", "Tipos de pliegue", "Etiqueta tubo, zigzag, espiral, medio cierre, caída o inerte", !!v.view.folds)}</div>
    <h3>Calidad de la tela</h3><div class="pills">${[["baja", "Baja (rápida)"], ["media", "Media"], ["alta", "Alta"]].map(([k, l]) => pill(k, v.view.clothQ || defaultClothQ, l, "clothq")).join("")}</div>`;
  return h;
}
function propsOf(o) {
  const isFig = o.kind === "figure";
  let h = `<div class="card"><div class="card-h"><input class="text" data-act="rename" value="${esc(o.name)}" aria-label="Nombre"></div>
  <div class="nums">${num("px", "X", Math.round(o.pos[0] * 100), "cm")}${num("py", "Altura", Math.round(o.pos[1] * 100), "cm")}${num("pz", "Z", Math.round(o.pos[2] * 100), "cm")}</div>
  <div class="nums">${isFig ? num("ry", "Giro", Math.round(o.rotY || 0), "°") : num("rx", "Giro X", Math.round(o.rot[0]), "°") + num("ry", "Giro Y", Math.round(o.rot[1]), "°") + num("rz", "Giro Z", Math.round(o.rot[2]), "°")}</div>`;
  if (!isFig) {
    const pp = Object.entries(o.params || {}).filter(([k, val]) => typeof val === "number");
    if (o.type === "terreno") h += `<div class="pills">${Object.entries(TERRAIN_TYPES).map(([k, l]) => pill(k, o.params.tipo, l, "terrain")).join("")}</div>`;
    if (pp.length) h += `<div class="nums">${pp.map(([k, val]) => num("param:" + k, k[0].toUpperCase() + k.slice(1), val, ["escalones", "pisos", "semilla"].includes(k) ? "" : "cm")).join("")}</div>`;
    h += `<div class="nums">${num("scale", "Escala", Math.round((o.scale?.[0] ?? 1) * 100), "%")}</div>`;
  }
  if (isFig) h += clothesPanel(o);
  h += `<div class="row colorrow"><label class="sel"><span>${isFig ? "Color de la piel o del maniquí" : "Color (para estilos de color y para separar planos)"}</span><input type="color" data-act="obj-color" value="${o.color || "#bdb6ac"}"></label>${o.color ? `<button class="btn" data-act="obj-nocolor">Quitar color</button>` : ""}</div>`;
  h += `<div class="row"><button class="btn" data-act="dup">Duplicar</button><button class="btn" data-act="fwd">Copiar a viñetas siguientes</button><button class="btn danger" data-act="del">Borrar</button></div></div>`;
  return h;
}

function clothesPanel(o) {
  const list = o.clothes || [];
  let h = `<h3>Ropa</h3>`;
  if (!list.length) h += `<p class="sub">Viste al personaje para ver cómo se dobla y cae la tela en cada pose.</p><div class="pills">${Object.entries(OUTFITS).map(([k, d]) => pill(k, "", d.label, "outfit")).join("")}</div>`;
  h += `<div class="adds">${Object.entries(GARMENTS).map(([k, d]) => `<button class="btn" data-act="garment-add" data-val="${k}">+ ${d.label}</button>`).join("")}</div>`;
  if (list.length) h += `<div class="olist">${list.map(g => `<button class="oitem${g.id === ui.garment ? " on" : ""}" data-act="garment-sel" data-val="${g.id}"><span><i class="swatch" style="background:${g.color}"></i>${GARMENTS[g.type].label}</span><small>${MATERIALS[g.mat].label.split(" (")[0]}</small></button>`).join("")}</div>`;
  const g = list.find(x => x.id === ui.garment);
  if (g) {
    const def = GARMENTS[g.type];
    h += `<div class="card sub-card">
      <div class="row colorrow"><label class="sel"><span>Color de ${def.label.toLowerCase()}</span><input type="color" data-act="garment-color" value="${g.color}"></label></div>
      <h3>Tela</h3><div class="pills">${Object.entries(MATERIALS).map(([k, m]) => pill(k, g.mat, m.label, "garment-mat")).join("")}</div>
      ${slider("ease", "Holgura", g.ease ?? 1.2, 0.3, 5, 0.1, " cm", "garment")}
      ${g.length !== undefined ? slider("length", g.type === "pantalon" ? "Largo (corto ↔ al tobillo)" : "Largo (cadera ↔ tobillo)", g.length, g.type === "pantalon" ? 0.3 : 0.15, 1, 0.01, "", "garment") : ""}
      ${g.sleeve !== undefined ? slider("sleeve", "Manga (sin manga ↔ larga)", g.sleeve, 0, 1, 0.01, "", "garment") : ""}
      ${g.collar !== undefined ? `<h3>Cuello</h3><div class="pills">${[["bajo", "Normal"], ["alzado", "Alzado"], ["no", "Sin cuello"]].map(([k, l]) => pill(k, g.collar, l, "garment-collar")).join("")}</div>` : ""}
      ${g.belt !== undefined ? `<div class="toggles">${toggle("belt", "Cinturón", "", g.belt, "garment-t")}</div>` : ""}
      <div class="row"><button class="btn" data-act="garment-up">Subir de capa</button><button class="btn danger" data-act="garment-del">Quitar ${def.label.toLowerCase()}</button></div></div>`;
  }
  if (list.length) h += `<div class="row"><button class="btn" data-act="garment-copy">Copiar ropa a los demás personajes</button></div>`;
  return h;
}

function panelPose() {
  const o = selObj();
  if (o?.kind !== "figure") {
    const firsts = store.v.objects.filter(x => x.kind === "figure");
    return `<h2>Pose</h2><p class="empty">Toca un personaje en el visor para posarlo${firsts.length ? ", o elige uno:" : "."}</p>
    <div class="olist">${firsts.map(f => `<button class="oitem" data-act="sel" data-val="${f.id}"><span>${esc(f.name)}</span></button>`).join("")}</div>
    <button class="btn accent" data-act="add-fig">+ Personaje</button>`;
  }
  const p = o.params;
  const lib = Object.entries(POSE_LIBRARY);
  let h = `<h2>${esc(o.name)}</h2>
  <p class="sub">Arrastra los puntos: <b class="k-end">azules</b> manos y pies, <b class="k-core">morados</b> pelvis, pecho y cabeza, <b class="k-pole">naranjas</b> codos y rodillas. Toca el cuerpo para girar una parte.</p>
  <div class="row"><button class="btn accent" data-act="ground">Apoyar en el piso</button><button class="btn${ui.sym ? " on" : ""}" data-act="sym">Simetría ${ui.sym ? "activa" : "apagada"}</button><button class="btn" data-act="mirror">Espejo</button></div>
  <h3>Fijar en su lugar</h3><div class="pills">${ENDS.map(([e, l]) => pill(e, o.pins?.[e] ? e : "", l, "pin")).join("")}</div>
  <p class="sub">Lo fijado (en rojo) no se mueve cuando mueves la pelvis, el pecho o el resto del cuerpo.</p>`;
  h += `<h3>Poses</h3><div class="lib">${lib.filter(([, d]) => !d.test).map(([k, d]) => `<button class="btn" data-act="pose" data-val="${k}">${d.label}</button>`).join("")}</div>
  <details class="more"><summary>Poses de prueba de tus páginas (${lib.filter(([, d]) => d.test).length})</summary><div class="lib">${lib.filter(([, d]) => d.test).map(([k, d]) => `<button class="btn" data-act="pose" data-val="${k}">${d.label}</button>`).join("")}</div></details>`;
  const saved = savedPoses();
  h += `<details class="more"><summary>Mis poses (${saved.length})</summary>
    <div class="row"><input class="text" id="posename" placeholder="Nombre de la pose" aria-label="Nombre de la pose"><button class="btn" data-act="pose-save">Guardar actual</button></div>
    ${saved.length ? `<div class="lib">${saved.map((x, i) => `<span class="saved"><button class="btn" data-act="pose-mine" data-val="${i}">${esc(x.name)}</button><button class="x" data-act="pose-del" data-val="${i}" aria-label="Borrar ${esc(x.name)}">×</button></span>`).join("")}</div>` : ""}</details>`;
  // Articulación
  const j = ui.joint;
  const opt = n => `<option value="${n}" ${n === (j || "") ? "selected" : ""}>${PSEUDO[n]?.label || M.jointLabel(n)}</option>`;
  const grp = (label, list) => `<optgroup label="${label}">${list.map(opt).join("")}</optgroup>`;
  h += `<h3>Articulación</h3><select class="text" data-act="joint" aria-label="Articulación"><option value="">Toca el cuerpo o elige…</option>
    ${grp("Tronco y cabeza", ["hips", "spine_all", "spine1", "spine2", "spine3", "chest", "neck_all", "neck1", "neck2", "head", "jaw"])}
    ${grp("Brazo izquierdo", ["clavicle_L", "shoulder_L", "elbow_L", "wrist_L"])}${grp("Brazo derecho", ["clavicle_R", "shoulder_R", "elbow_R", "wrist_R"])}
    ${grp("Pierna izquierda", ["hip_L", "knee_L", "ankle_L", "toes_L"])}${grp("Pierna derecha", ["hip_R", "knee_R", "ankle_R", "toes_R"])}
    ${j && /^(thumb|index|middle|ring|pinky)/.test(j) ? grp("Dedo", [j]) : ""}</select>`;
  if (j) {
    h += jointSliders(o, j);
    h += `<div class="row"><button class="btn" data-act="joint-reset">Restablecer</button>${PSEUDO[j] ? "" : `<button class="btn${ui.rings ? " on" : ""}" data-act="rings">${ui.rings ? "Ocultar anillos" : "Girar con anillos"}</button>`}</div>`;
  }
  // Manos
  h += `<h3>Manos</h3>`;
  for (const sd of ["L", "R"]) h += `<div class="pills"><span class="pl">${sd === "L" ? "Izq." : "Der."}</span>${Object.entries(M.HAND_POSES).map(([k, d]) => pill(k, o.hands?.[sd], d.label, "hand", `data-side="${sd}"`)).join("")}</div>`;
  const fs = ui.handSide, fn = ui.finger;
  h += `<details class="more"${ui.fingerOpen ? " open" : ""} data-det="finger"><summary>Dedo por dedo</summary>
    <div class="pills">${pill("L", fs, "Mano izquierda", "hand-side")}${pill("R", fs, "Mano derecha", "hand-side")}</div>
    <div class="pills">${Object.entries(M.FINGER_LABEL).map(([k, l]) => pill(k, fn, l, "finger")).join("")}</div>
    ${fingerSliders(o, fs, fn)}</details>`;
  // Rostro
  const f = o.face || M.DEFAULT_FACE, e = f.expr;
  h += `<h3>Rostro</h3><div class="pills">${pill("simple", f.mode, "Guías de construcción", "face-mode")}${pill("detallado", f.mode, "Detallado", "face-mode")}${pill("guides", f.guides ? "guides" : "", "Mostrar guías", "face-guides")}</div>
  <div class="pills">${Object.entries(M.EXPRESSIONS).map(([k, d]) => pill(k, f.exprName, d.label, "expr")).join("")}${savedExpr().map((x, i) => pill("mine:" + i, f.exprName, x.name, "expr")).join("")}</div>
  <details class="more"${ui.faceOpen ? " open" : ""} data-det="face"><summary>Ajustar expresión</summary>
    ${faceSlider("brow.0", "Ceja izquierda (baja ↔ sube)", e.brow[0], -1, 1, 0.05)}${faceSlider("brow.1", "Ceja derecha (baja ↔ sube)", e.brow[1], -1, 1, 0.05)}
    ${faceSlider("brow.2", "Ceja izquierda (enojo ↔ tristeza)", e.brow[2], -30, 30, 1)}${faceSlider("brow.3", "Ceja derecha (enojo ↔ tristeza)", e.brow[3], -30, 30, 1)}
    ${faceSlider("lid.0", "Párpado izquierdo (cerrado ↔ muy abierto)", e.lid[0], 0, 1.3, 0.05)}${faceSlider("lid.1", "Párpado derecho", e.lid[1], 0, 1.3, 0.05)}
    ${faceSlider("open", "Boca abierta", e.open, 0, 1, 0.05)}${faceSlider("wide", "Boca (estrecha ↔ ancha)", e.wide, 0.6, 1.4, 0.05)}
    ${faceSlider("smile.0", "Comisura izquierda (abajo ↔ arriba)", e.smile[0], -1, 1, 0.05)}${faceSlider("smile.1", "Comisura derecha", e.smile[1], -1, 1, 0.05)}
    ${faceSlider("jaw", "Mandíbula", e.jaw, 0, 28, 1)}
    <div class="row"><input class="text" id="exprname" placeholder="Nombre de la expresión" aria-label="Nombre de la expresión"><button class="btn" data-act="expr-save">Guardar expresión</button></div>
    ${savedExpr().length ? `<div class="lib">${savedExpr().map((x, i) => `<span class="saved"><span class="pl">${esc(x.name)}</span><button class="x" data-act="expr-del" data-val="${i}" aria-label="Borrar ${esc(x.name)}">×</button></span>`).join("")}</div>` : ""}
  </details>`;
  // Mirada y anclas
  const others = store.v.objects.filter(x => x.kind === "figure" && x.id !== o.id);
  h += `<h3>Mirada</h3><div class="pills">${pill("", o.gaze || "", "Libre", "gaze")}${pill("camera", o.gaze || "", "Al lector", "gaze")}${others.map(x => pill(x.id, o.gaze || "", "A " + x.name, "gaze")).join("")}</div>`;
  const anchorOpts = cur => {
    let r = `<option value="">Sin anclar</option>`;
    for (const x of others) r += `<optgroup label="${esc(x.name)}">${ANCHOR_PARTS.map(([pt, l]) => `<option value="${x.id}|${pt}" ${cur === x.id + "|" + pt ? "selected" : ""}>${l}</option>`).join("")}</optgroup>`;
    const props = store.v.objects.filter(x => x.kind !== "figure");
    if (props.length) r += `<optgroup label="Objetos">${props.map(x => `<option value="${x.id}" ${cur === x.id ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</optgroup>`;
    return r;
  };
  h += `<h3>Anclar las manos</h3><p class="sub">Acerca la mano al lugar y luego ánclala: si el otro personaje u objeto se mueve, la mano lo sigue.</p>`;
  for (const [end, l] of ENDS.slice(0, 2)) {
    const a = o.anchors?.[end], cur = a ? (a.part ? `${a.obj}|${a.part}` : a.obj) : "";
    h += `<label class="sel"><span>${l}</span><select data-act="anchor" data-end="${end}">${anchorOpts(cur)}</select></label>`;
  }
  h += `<h3>Herramientas</h3><div class="row"><button class="btn" data-act="copy-pose">Copiar pose</button><button class="btn" data-act="paste-pose" ${ui.clipboardPose ? "" : "disabled"}>Pegar pose</button></div>`;
  h += `<div class="toggles">${toggle("relaxed", "Relajar límites articulares", "Para estilos caricaturescos", o.relaxed, "fig")}
    ${toggle("action", "Línea de acción", "Curva de cabeza a pie de apoyo", store.v.view.action)}
    ${toggle("com", "Centro de masa", "Avisa si la figura de pie pierde el equilibrio", store.v.view.com)}</div>`;
  h += `<details class="more"><summary>Cuerpo</summary>${slider("height", "Altura", p.height, 140, 210, 1, " cm", "param")}${slider("heads", "Proporción", p.heads, 6, 8.5, 0.25, " cabezas", "param")}
  ${slider("build", "Complexión", p.build, 0, 1, 0.05, "", "param")}${slider("shape", "Forma (masculina ↔ femenina)", p.shape, 0, 1, 0.05, "", "param")}
  <p class="sub">${p.height} cm · ${p.heads} cabezas · una cabeza mide ${round(p.height / p.heads, 1)} cm</p></details>`;
  return h;
}

// Articulaciones que se mueven en conjunto
const PSEUDO = {
  spine_all: { label: "Columna completa", joints: ["spine1", "spine2", "spine3", "chest"] },
  neck_all: { label: "Cuello completo", joints: ["neck1", "neck2"] },
};
const ANCHOR_PARTS = [["head", "Cabeza"], ["jaw", "Cara (boca)"], ["chest", "Pecho"], ["shoulder_L", "Hombro izquierdo"], ["shoulder_R", "Hombro derecho"], ["hips", "Cintura"], ["wrist_L", "Mano izquierda"], ["wrist_R", "Mano derecha"]];
function jointSliders(o, j) {
  const refs = PSEUDO[j]?.joints || [j];
  const L = M.limitsFor(refs[0], o.relaxed), labels = M.axisLabels(refs[0]);
  let h = "";
  ["x", "y", "z"].forEach((ax, i) => {
    if (L[ax][0] === L[ax][1]) return;
    const sg = M.sideSign(refs[0], ax), n = refs.length;
    const raw = refs.reduce((a, k) => a + (o.pose.rot[k]?.[i] || 0), 0);
    let lo = L[ax][0] * n, hi = L[ax][1] * n; if (sg < 0) [lo, hi] = [-hi, -lo];
    const id = `j-${j}-${ax}`;
    h += `<div class="field"><label for="${id}">${esc(labels[ax] || ax.toUpperCase())} <output id="${id}-o">${Math.round(raw * sg)}°</output></label>
      <input type="range" id="${id}" data-act="joint-rot" data-joint="${j}" data-ax="${i}" min="${lo}" max="${hi}" step="1" value="${round(raw * sg, 1)}"></div>`;
  });
  return h;
}
function fingerSliders(o, side, finger) {
  const names = finger === "thumb" ? ["thumb1", "thumb2", "thumb3"] : [finger + "1", finger + "2", finger + "3"];
  return names.map((n, i) => `<p class="sub">${["Base", "Medio", "Punta"][i]}</p>${jointSliders(o, `${n}_${side}`)}`).join("");
}
const faceSlider = (key, label, val, min, max, step) => {
  const id = "fc-" + key.replace(".", "-");
  return `<div class="field"><label for="${id}">${esc(label)} <output id="${id}-o">${fmt(val, step)}</output></label>
  <input type="range" id="${id}" data-act="face" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
};
function savedExpr() { try { return JSON.parse(localStorage.getItem("arnes-expr") || "[]"); } catch { return []; } }
function writeExpr(a) { try { localStorage.setItem("arnes-expr", JSON.stringify(a)); } catch { toast("Este navegador no permite guardar expresiones aquí."); } }
function setFace(o) {
  const fig = figs.get(o.id);
  o.pose.rot.jaw = [o.face.expr.jaw || 0, 0, 0];
  M.setJoint(fig, "jaw", o.pose.rot.jaw, o.relaxed);
  M.applyFace(fig, o.face);
  markDirty();
}

function panelCamara() {
  const c = store.v.camera, v = store.v.view;
  const fig = shotFigure();
  let h = `<h2>Cámara</h2><div class="readouts"><div class="readout"><b id="r-eye">${Math.round(camera.position.y * 100)} cm</b><small>Altura del ojo</small></div>
  <div class="readout"><b id="r-dist">${camera.position.distanceTo(controls.target).toFixed(1)} m</b><small>Distancia</small></div>
  <div class="readout"><b>${c.mm} mm</b><small>Lente</small></div></div>`;
  h += `<h3>Plano ${fig ? `<span class="sub-in">sobre ${esc(fig.name)}</span>` : ""}</h3><div class="pills">${Object.entries(SHOTS).map(([k, d]) => pill(k, c.shot, d.label, "shot")).join("")}</div>
  <h3>Ángulo</h3><div class="pills">${Object.entries(ANGLES).map(([k, d]) => pill(k, c.angle, d.label, "angle")).join("")}</div>
  ${slider("roll", "Holandés (inclinar la cámara)", c.roll || 0, -45, 45, 1, "°", "roll")}
  <p class="sub">También puedes girar la cámara con dos dedos en el visor mientras esta pestaña está abierta.</p>
  ${tipFor(c)}`;
  h += `<div class="field"><label for="lens">Lente <output id="lens-o">${c.mm} mm</output></label><input type="range" id="lens" data-act="lens" min="14" max="200" step="1" value="${c.mm}">
  <div class="scale"><span>14 gran angular</span><span>50 normal</span><span>200 tele</span></div></div>`;
  h += `<h3>Proporción de la viñeta</h3><div class="pills">${Object.keys(ASPECTS).map(k => pill(k, c.aspect, k === "libre" ? "Libre" : k, "aspect")).join("")}${typeof c.aspect === "number" ? pill("page", "page", `De su recuadro (${round(c.aspect, 2)}:1)`, "noop") : ""}</div>`;
  h += `<h3>Vistas libres</h3><div class="pills">${[["front", "Frente"], ["side", "Lado"], ["top", "Arriba"], ["persp", "Tres cuartos"]].map(([k, l]) => pill(k, "", l, "view-free")).join("")}</div>`;
  h += `<div class="toggles">${toggle("horizon", "Línea de horizonte", "Siempre a la altura del ojo de la cámara", v.horizon)}${toggle("vp", "Puntos de fuga", "De la grilla del piso y de las verticales", v.vp)}</div>`;
  h += `<button class="btn accent wide" data-act="through">Ver a través de la cámara</button>`;
  return h;
}

function panelLuz() {
  const v = store.v.view;
  let h = `<h2>Luz</h2><div class="pills">${Object.entries(PRESETS).map(([k, l]) => pill(k, "", l, "preset")).join("")}</div>`;
  h += `<h3>Luces (${store.v.lights.length} de 4)</h3><div class="olist">${store.v.lights.map(l => `<button class="oitem${l.id === ui.sel ? " on" : ""}" data-act="sel-light" data-val="${l.id}"><span>${esc(l.name)}</span><small>${LIGHT_TYPES[l.type].label.split(" (")[0]} · ${l.color ? "color propio" : l.kelvin + " K"}${l.gobo && l.gobo !== "ninguno" ? " · " + GOBOS[l.gobo] : ""}</small></button>`).join("") || `<p class="empty">Sin luces: la escena se ve negra.</p>`}</div>`;
  if (store.v.lights.length < 4) h += `<div class="adds">${Object.entries(LIGHT_TYPES).map(([k, d]) => `<button class="btn" data-act="add-light" data-val="${k}">+ ${d.label.split(" (")[0]}</button>`).join("")}</div>`;
  const l = selLight();
  if (l) {
    h += `<div class="card"><div class="card-h"><input class="text" data-act="rename-light" value="${esc(l.name)}" aria-label="Nombre de la luz"></div>
    ${slider("intensity", "Intensidad", l.intensity, 0, LIGHT_TYPES[l.type].max, LIGHT_TYPES[l.type].max > 10 ? 1 : 0.05, "", "light")}
    ${l.color ? "" : slider("kelvin", "Temperatura (cálida ↔ fría)", l.kelvin, 1800, 10000, 100, " K", "light")}
    <div class="row colorrow"><label class="sel"><span>Color de la luz</span><input type="color" data-act="light-color" value="${l.color || "#ffffff"}"></label>${l.color ? `<button class="btn" data-act="light-nocolor">Usar temperatura</button>` : ""}</div>
    ${l.type === "foco" ? `<h3>Gobo (sombra proyectada)</h3><div class="pills">${Object.entries(GOBOS).map(([k, g]) => pill(k, l.gobo || "ninguno", g, "gobo")).join("")}</div>` : ""}
    ${l.type !== "ambiente" ? slider("softness", "Sombra (dura ↔ suave)", l.softness, 0, 1, 0.05, "", "light") + `<div class="toggles">${toggle("shadow", "Proyecta sombra", "", l.shadow, "light-t")}</div>` : ""}
    <p class="sub">${l.type !== "ambiente" ? "Mueve la luz con las flechas del visor." : "La luz ambiente ilumina todo por igual."}</p>
    <div class="row"><button class="btn" data-act="fwd">Copiar a viñetas siguientes</button><button class="btn danger" data-act="del">Borrar luz</button></div></div>`;
  }
  h += `<h2>Semirender</h2><div class="pills">${Object.entries(MODES).map(([k, l]) => pill(k, v.mode, l, "mode")).join("")}</div>`;
  const tips = { clay: "Volumen gris, sin color.", color: "Usa el color que le diste a cada objeto.", values: "Agrupa la luz en 2, 3 o 5 tonos.", noir: "Solo negro y blanco: decide dónde van las masas de negro.", manga: "Medios tonos como tramas de puntos.", cel: "Color plano en tres tonos." };
  h += `<p class="sub">${tips[v.mode] || ""}</p>`;
  if (v.mode === "values") h += `<div class="pills"><span class="pl">Tonos</span>${[2, 3, 5].map(n => pill(String(n), String(v.tones), String(n), "tones")).join("")}</div>`;
  if (v.mode !== "clay" && v.mode !== "color") h += slider("th", "Umbral (más luz ↔ más sombra)", v.th, 0, 1, 0.05, "", "view-r");
  if (v.mode === "manga") h += slider("dot", "Tamaño de la trama", v.dot || 7, 3, 16, 1, " px", "view-r");
  h += `<div class="toggles">${toggle("outline", "Contorno", "Silueta y bordes marcados", v.outline)}</div>`;
  if (v.outline) h += slider("thick", "Grosor del contorno", v.thick, 0.5, 4, 0.25, " px", "view-r");
  h += `<h3>Fondo y atmósfera</h3><div class="pills">${pill("papel", v.background, "Papel", "bg")}${pill("oscuro", v.background, "Oscuro", "bg")}</div>
  ${slider("fog", "Niebla o humo (separa los planos)", v.fog || 0, 0, 1, 0.05, "", "fog")}
  <h3>Viento</h3><p class="sub">Mueve capas, faldones y faldas.</p>
  ${slider("wind", "Fuerza", v.wind || 0, 0, 1, 0.05, "", "wind")}${slider("windDir", "Dirección", v.windDir || 0, -180, 180, 5, "°", "wind")}`;
  return h;
}

// Consejos por plano y ángulo
const TIPS = {
  detalle: "El detalle obliga a mirar un objeto o un gesto: úsalo para pistas y tensión.",
  primer: "El primer plano es emoción: el lector lee la cara antes que el texto.",
  medio: "El plano medio sirve para diálogos: se ven gestos y manos.",
  americano: "El americano (corte en las rodillas) da presencia y acción contenida.",
  general: "El plano general ubica dónde estamos: úsalo al abrir una escena.",
  picado: "El picado empequeñece al personaje: vulnerable, vigilado.",
  contrapicado: "El contrapicado lo engrandece: poder, amenaza o heroísmo.",
  ras: "A ras de piso exagera la escala y el drama; ideal para pasos y caídas.",
  normal: "A la altura de los ojos es neutral: el lector está al mismo nivel.",
};
function tipFor(c) {
  const t = [TIPS[c.shot], TIPS[c.angle]].filter(Boolean);
  if (Math.abs(c.roll || 0) > 4) t.push("El holandés transmite inquietud o desequilibrio: úsalo con moderación.");
  return t.length ? `<p class="tip">${t.map(esc).join(" ")}</p>` : "";
}

// Barra flotante del visor: modo de transformación
function renderToolbar() {
  const o = selObj();
  const show = o && ui.tab !== "pose" && !ui.through;
  const tb = $("#tbar");
  tb.hidden = !show;
  if (!show) return;
  const modes = o.kind === "figure" ? [["translate", "Mover"], ["rotate", "Girar"]] : [["translate", "Mover"], ["rotate", "Girar"], ["scale", "Escalar"]];
  tb.innerHTML = modes.map(([m, l]) => `<button class="${ui.tmode === m ? "on" : ""}" data-tm="${m}">${l}</button>`).join("") +
    (o.kind === "figure" ? `<button data-go="pose">Posar</button>` : "");
}
$("#tbar").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.tm) { ui.tmode = b.dataset.tm; attachGizmo(); renderToolbar(); markDirty(); }
  if (b.dataset.go) selectTab("pose", false);
});

// Eventos del panel
panel.addEventListener("toggle", e => {
  const d = e.target; if (!d.dataset?.det) return;
  if (d.dataset.det === "finger") ui.fingerOpen = d.open; else if (d.dataset.det === "face") ui.faceOpen = d.open;
}, true);
panel.addEventListener("click", e => {
  const b = e.target.closest("[data-act]"); if (!b || b.tagName === "INPUT" || b.tagName === "SELECT" || b.tagName === "TEXTAREA") return;
  const act = b.dataset.act, val = b.dataset.val;
  if (/^(pg|pn|bl)-/.test(act)) { pageEd.onClick(act, val); return; }
  const o = selObj(), v = store.v;
  switch (act) {
    case "vineta": storeCamera(); store.project.cur = +val; ui.sel = null; store.commit(); rebuildScene(); renderPanel(); break;
    case "v-dup": storeCamera(); store.duplicateVineta(); store.commit(); rebuildScene(); renderPanel(); toast("Viñeta duplicada con todo su contenido."); break;
    case "v-new": storeCamera(); store.addVineta(); store.commit(); rebuildScene(); renderPanel(); break;
    case "v-ren": { const n = $("#vname").value.trim(); if (n) { v.name = n; store.commit(); renderPanel(); } break; }
    case "v-del": if (store.deleteVineta()) { store.commit(); rebuildScene(); renderPanel(); } break;
    case "add-fig": addFigure(); break;
    case "add": addProp(val); break;
    case "sel": select(val); if (ui.tab === "pose") renderPanel(); break;
    case "sel-light": select(val); break;
    case "dup": duplicateSelected(); break;
    case "del": deleteSelected(); break;
    case "fwd": { const n = store.copyForward(ui.sel); store.commit(); toast(n ? `Copiado a ${n} viñeta${n > 1 ? "s" : ""} siguiente${n > 1 ? "s" : ""}.` : "No hay viñetas después de esta."); break; }
    case "pose": setPose(o, POSE_LIBRARY[val]); store.commit(); renderPanel(); markDirty(); break;
    case "pose-save": { const name = $("#posename").value.trim() || `Pose ${savedPoses().length + 1}`; savePose(name, o); renderPanel(); toast("Pose guardada en este dispositivo."); break; }
    case "pose-mine": { const sv = savedPoses()[+val]; setPose(o, { pose: sv.pose, hands: null }); o.hands = { ...sv.hands }; store.commit(); renderPanel(); break; }
    case "pose-del": { const all = savedPoses(); all.splice(+val, 1); writePoses(all); renderPanel(); break; }
    case "joint-reset": { for (const k of PSEUDO[ui.joint]?.joints || [ui.joint]) o.pose.rot[k] = [0, 0, 0]; M.applyPose(figs.get(o.id), o.pose, o.relaxed); store.commit(); renderPanel(); markDirty(); break; }
    case "hand": {
      const sd = b.dataset.side;
      o.hands[sd] = val; Object.assign(o.pose.rot, M.handPoseRot(val, sd));
      if (ui.sym) { const other = sd === "L" ? "R" : "L"; o.hands[other] = val; Object.assign(o.pose.rot, M.handPoseRot(val, other)); }
      M.applyPose(figs.get(o.id), o.pose, o.relaxed); store.commit(); renderPanel(); markDirty(); break;
    }
    case "hand-side": ui.handSide = val; ui.fingerOpen = true; renderPanel(); break;
    case "finger": ui.finger = val; ui.fingerOpen = true; renderPanel(); break;
    case "gaze": o.gaze = val || null; if (!o.gaze) { o.pose = M.readPose(figs.get(o.id), o.pose); } store.commit(); renderPanel(); markDirty(); break;
    case "mirror": { o.pose = M.mirrorPose(o.pose); o.hands = { L: o.hands.R, R: o.hands.L }; M.applyPose(figs.get(o.id), o.pose, o.relaxed); store.commit(); markDirty(); renderPanel(); break; }
    case "sym": ui.sym = !ui.sym; toast(ui.sym ? "Simetría activa: lo que muevas de un lado se copia al otro." : "Simetría apagada."); renderPanel(); break;
    case "ground": { const fig = figs.get(o.id); groundFigure(fig); resolvePins(o, fig, null); o.pose = M.readPose(fig, o.pose); store.commit(); markDirty(); toast("Figura apoyada en el piso."); break; }
    case "pin": {
      const fig = figs.get(o.id); o.pins ??= {};
      if (o.pins[val]) o.pins[val] = null; else pinHere(o, fig, val);
      store.commit(); renderPanel(); markDirty(); break;
    }
    case "rings": ui.rings = !ui.rings; attachGizmo(); renderPanel(); markDirty(); break;
    case "face-mode": o.face.mode = val; setFace(o); store.commit(); renderPanel(); break;
    case "face-guides": o.face.guides = !o.face.guides; setFace(o); store.commit(); renderPanel(); break;
    case "expr": {
      const src = val.startsWith("mine:") ? savedExpr()[+val.slice(5)]?.expr : M.EXPRESSIONS[val];
      if (!src) break;
      o.face.expr = clone(src); delete o.face.expr.label; o.face.exprName = val;
      if (o.face.mode !== "detallado" && !val.startsWith("neutral")) o.face.mode = "detallado";
      setFace(o); store.commit(); renderPanel(); break;
    }
    case "expr-save": { const name = $("#exprname").value.trim() || `Expresión ${savedExpr().length + 1}`; const all = savedExpr(); all.push({ name, expr: clone(o.face.expr) }); writeExpr(all); o.face.exprName = "mine:" + (all.length - 1); ui.faceOpen = true; renderPanel(); toast("Expresión guardada en este dispositivo."); break; }
    case "expr-del": { const all = savedExpr(); all.splice(+val, 1); writeExpr(all); ui.faceOpen = true; renderPanel(); break; }
    case "copy-pose": ui.clipboardPose = { pose: clone(o.pose), hands: { ...o.hands }, H: figs.get(o.id).d.H }; toast("Pose copiada. Selecciona otro personaje y pégala."); renderPanel(); break;
    case "paste-pose": {
      const cp = ui.clipboardPose, k = figs.get(o.id).d.H / cp.H;
      o.pose = clone(cp.pose); o.pose.hips = o.pose.hips.map(x => x * k); o.hands = { ...cp.hands };
      rebuildObject(o); store.commit(); markDirty(); renderPanel(); break;
    }
    case "shot": applyShot(val, null); break;
    case "angle": applyShot(null, val); break;
    case "scenario": {
      const sc = SCENARIOS[val]; const objs = sc.build();
      v.objects.push(...objs); for (const ob of objs) buildObject(ob);
      if (sc.preset) applyPreset(sc.preset);
      applyBackground(); store.commit(); renderPanel(); markDirty(3); toast(`Escenario agregado: ${sc.label}.`); break;
    }
    case "import-glb": $("#glbfile").click(); break;
    case "outfit": { o.clothes = OUTFITS[val].items.map(newGarment); ui.garment = o.clothes.at(-1).id; rebuildObject(o); store.commit(); renderPanel(); markDirty(3); toast("Vestido. Cambia la pose y la tela se acomoda sola al soltar."); break; }
    case "garment-add": { o.clothes ??= []; const g = newGarment(val); o.clothes.push(g); ui.garment = g.id; rebuildObject(o); store.commit(); renderPanel(); markDirty(3); break; }
    case "garment-sel": ui.garment = ui.garment === val ? null : val; renderPanel(); break;
    case "garment-mat": case "garment-collar": {
      const g = o.clothes.find(x => x.id === ui.garment); g[act === "garment-mat" ? "mat" : "collar"] = val;
      rebuildObject(o); store.commit(); renderPanel(); markDirty(3); break;
    }
    case "garment-del": { o.clothes = o.clothes.filter(x => x.id !== ui.garment); ui.garment = null; rebuildObject(o); store.commit(); renderPanel(); markDirty(3); break; }
    case "garment-up": { const i = o.clothes.findIndex(x => x.id === ui.garment); if (i < o.clothes.length - 1) { const [g] = o.clothes.splice(i, 1); o.clothes.splice(i + 1, 0, g); } rebuildObject(o); store.commit(); renderPanel(); markDirty(3); break; }
    case "garment-copy": {
      for (const f of v.objects) if (f.kind === "figure" && f !== o) { f.clothes = clone(o.clothes).map(g => ({ ...g, id: newGarment(g.type).id })); rebuildObject(f); }
      store.commit(); markDirty(3); toast("Ropa copiada. Cambia los colores para distinguir a cada personaje."); break;
    }
    case "clothq": v.view.clothQ = val; rebuildScene(); store.commit(); renderPanel(); markDirty(3); break;
    case "terrain": { o.params.tipo = val; rebuildObject(o); applyBackground(); store.commit(); renderPanel(); markDirty(); break; }
    case "obj-nocolor": { delete o.color; paint(world.get(o.id), null); store.commit(); renderPanel(); markDirty(); break; }
    case "light-nocolor": { const l = selLight(); delete l.color; rebuildLights(); attachGizmo(); store.commit(); renderPanel(); markDirty(); break; }
    case "gobo": { const l = selLight(); l.gobo = val; if (val !== "ninguno") l.shadow = true; rebuildLights(); attachGizmo(); store.commit(); renderPanel(); markDirty(); break; }
    case "aspect": v.camera.aspect = val; layoutFrame(); store.commit(); renderPanel(); markDirty(); break;
    case "view-free": freeView(val); break;
    case "through": setThrough(true); break;
    case "preset": applyPreset(val); break;
    case "add-light": { const l = newLight(val); const t = controls.target; if (val !== "sol") l.pos = [round(t.x + 0.6, 2), round(t.y + 0.9, 2), round(t.z + 0.6, 2)]; v.lights.push(l); rebuildLights(); store.commit(); select(l.id); break; }
    case "mode": v.view.mode = val; repaintAll(); store.commit(); renderPanel(); markDirty(); break;
    case "tones": v.view.tones = +val; store.commit(); renderPanel(); markDirty(); break;
    case "bg": v.view.background = val; applyBackground(); store.commit(); renderPanel(); markDirty(); break;
  }
});
panel.addEventListener("input", e => {
  const el = e.target, act = el.dataset.act, key = el.dataset.key; if (!act) return;
  if (act === "bl-text") { pageEd.onInput(act, key, 0, el); return; }
  const val = +el.value, out = document.getElementById(el.id + "-o");
  const o = selObj();
  if (out && el.type === "range") out.textContent = fmt(val, +el.step) + (out.textContent.match(/[^\d.\-]+$/)?.[0] || "");
  if (act === "joint-rot") {
    const j = el.dataset.joint, i = +el.dataset.ax, refs = PSEUDO[j]?.joints || [j];
    const raw = val * M.sideSign(refs[0], "xyz"[i]);
    for (const k of refs) { o.pose.rot[k] = o.pose.rot[k] || [0, 0, 0]; o.pose.rot[k][i] = raw / refs.length; }
    if (/^(neck|head)/.test(j)) o.gaze = null;
    if (ui.sym && /_[LR]$/.test(j)) M.symmetrize(o.pose, j.slice(-1));
    if (out) out.textContent = Math.round(val) + "°";
    M.applyPose(figs.get(o.id), o.pose, o.relaxed); markDirty();
  } else if (act === "face") {
    const [k, idx] = key.split(".");
    if (idx !== undefined) o.face.expr[k][+idx] = val; else o.face.expr[k] = val;
    o.face.exprName = null; setFace(o);
  } else if (act === "param") {
    o.params[key] = val; rebuildObject(o); groundFigure(figs.get(o.id)); o.pose = M.readPose(figs.get(o.id), o.pose); buildRuler(); markDirty();
  } else if (act === "lens") {
    store.v.camera.mm = val; $("#lens-o").textContent = val + " mm"; layoutFrame(); syncLensUI(); markDirty();
  } else if (act === "light") {
    const l = selLight(); l[key] = val;
    const L = lights.get(l.id).light;
    if (key === "intensity") L.intensity = val; else if (key === "kelvin") L.color.copy(kelvinColor(val));
    else if (key === "softness") { if (L.shadow) L.shadow.radius = 1 + val * 9; if (L.isSpotLight) L.penumbra = 0.15 + val * 0.7; }
    markDirty();
  } else if (act === "view-r") { store.v.view[key] = val; markDirty(); }
  else if (act === "fog") { store.v.view.fog = val; applyBackground(); markDirty(); }
  else if (act === "wind") { store.v.view[key] = val; }
  else if (act === "roll") { store.v.camera.roll = val; markDirty(); }
  else if (pageEd.onInput(act, key, val, el)) { /* página */ }
});
panel.addEventListener("change", e => {
  const el = e.target, act = el.dataset.act, key = el.dataset.key;
  if (el.id === "glbfile") { importGlb(el.files[0]); el.value = ""; return; }
  if (!act) return;
  const o = selObj(), v = store.v;
  if (pageEd.onChangeEl(act, el)) return;
  if (act === "obj-color") { o.color = el.value; paint(world.get(o.id), o.color, store.v.view.mode !== "clay"); if (store.v.view.mode === "clay") toast("El color se ve en los estilos Color, Cel, Noir, Manga y Valores."); store.commit(); renderPanel(); markDirty(); return; }
  if (act === "garment-color" || act === "garment" || act === "garment-t") {
    const g = o.clothes.find(x => x.id === ui.garment); if (!g) return;
    if (act === "garment-color") g.color = el.value; else if (act === "garment") g[key] = +el.value; else g[key] = el.checked;
    rebuildObject(o); store.commit(); if (act === "garment-color") renderPanel(); markDirty(3); return;
  }
  if (act === "wind") { for (const f of figs.values()) f.dress?.setWind(v.view.wind || 0, v.view.windDir || 0); store.commit(); markDirty(3); return; }
  if (act === "light-color") { const l = selLight(); l.color = el.value; rebuildLights(); attachGizmo(); store.commit(); renderPanel(); markDirty(); return; }
  if (["joint-rot", "param", "lens", "light", "view-r", "face", "fog", "roll"].includes(act)) {
    if (act === "joint-rot") o.pose = M.readPose(figs.get(o.id), o.pose);
    store.commit(); if (act === "param") renderPanel(); return;
  }
  if (act === "anchor") { setAnchor(o, el.dataset.end, el.value); store.commit(); markDirty(3); return; }
  if (act === "view") {
    v.view[key] = el.checked;
    if (key === "grid" || key === "floor") applyBackground();
    if (key === "ruler") buildRuler();
    if (key === "forms") rebuildScene();
    if (key === "tension") repaintAll();
    store.commit(); markDirty(); return;
  }
  if (act === "ui") { if (key === "pin") ui.pinFeet = el.checked; return; }
  if (act === "fig") { o.relaxed = el.checked; M.applyPose(figs.get(o.id), o.pose, o.relaxed); store.commit(); renderPanel(); markDirty(); return; }
  if (act === "light-t") { const l = selLight(); l.shadow = el.checked; lights.get(l.id).light.castShadow = el.checked; store.commit(); markDirty(); return; }
  if (act === "joint") { ui.joint = el.value || null; attachGizmo(); renderPanel(); markDirty(); return; }
  if (act === "rename") { if (o) { o.name = el.value.trim() || o.name; store.commit(); renderPanel(); } return; }
  if (act === "rename-light") { const l = selLight(); l.name = el.value.trim() || l.name; store.commit(); renderPanel(); return; }
  if (act === "num") {
    const val = parseFloat(el.value); if (Number.isNaN(val)) return;
    const g = world.get(o.id);
    if (key === "px" || key === "py" || key === "pz") { o.pos["xyz".indexOf(key[1])] = val / 100; g.position.fromArray(o.pos); if (ruler.visible) ruler.position.fromArray(o.pos); }
    else if (key === "ry" && o.kind === "figure") { o.rotY = val; g.rotation.y = val * DEG; buildRuler(); }
    else if (key[0] === "r") { o.rot["xyz".indexOf(key[1])] = val; g.rotation.set(...o.rot.map(d => d * DEG)); }
    else if (key === "scale") { const s = Math.max(1, val) / 100; o.scale = [s, s, s]; g.scale.setScalar(s); }
    else if (key.startsWith("param:")) { o.params[key.slice(6)] = Math.max(1, val); rebuildObject(o); }
    store.commit(); markDirty();
  }
});

function freeView(k) {
  const t = controls.target.clone(), d = Math.max(2.5, camera.position.distanceTo(t));
  const map = { front: [0, 0.1, 1], side: [1, 0.1, 0], top: [0.001, 1, 0.001], persp: [0.62, 0.38, 0.69] };
  const dir = new THREE.Vector3(...map[k]).normalize();
  store.v.camera.roll = 0;
  goTo(t.clone().addScaledVector(dir, d), t);
}
function setThrough(on) {
  ui.through = on;
  document.body.classList.toggle("through", on);
  document.body.classList.remove("sheet-open");
  attachGizmo(); layoutFrame(); renderToolbar(); markDirty(3);
}
$("#exit-through").addEventListener("click", () => setThrough(false));
function syncLensUI() { $("#hud-lens").textContent = store.v.camera.mm + " mm"; }

function applyPreset(k) {
  const v = store.v;
  let lampPos = null;
  const lamp = v.objects.find(o => o.type === "lampara" || o.type === "colgante" || o.type === "farol");
  if (lamp) {
    const g = world.get(lamp.id), off = g.userData.lightOffset || [0, 0.3, 0];
    lampPos = new THREE.Vector3(...off).applyMatrix4(g.matrixWorld).toArray().map(x => round(x, 3));
  }
  const F = { noir: () => presetNoir(lampPos), day: presetDay, sunset: presetSunset, moon: presetMoon, neon: presetNeon, fire: presetFire, back: presetBacklight, under: presetUnder, blinds: presetBlinds };
  const p = (F[k] || presetDay)();
  v.lights = p.lights; v.view.background = p.background; v.view.fog = p.fog ?? v.view.fog ?? 0;
  rebuildLights(); applyBackground(); ui.sel = p.lights.find(l => l.type !== "ambiente")?.id || p.lights[0].id; attachGizmo();
  store.commit(); renderPanel(); markDirty();
  if (k === "noir" && !lamp) toast("Agrega una lámpara y vuelve a elegir el preset para que la luz salga de ella.");
}

// Poses guardadas en el dispositivo
function savedPoses() { try { return JSON.parse(localStorage.getItem("arnes-poses") || "[]"); } catch { return []; } }
function writePoses(a) { try { localStorage.setItem("arnes-poses", JSON.stringify(a)); } catch { toast("Este navegador no permite guardar poses aquí."); } }
function savePose(name, o) {
  const k = 1.75 / figs.get(o.id).d.H;
  const all = savedPoses();
  all.push({ name, pose: { rot: clone(o.pose.rot), hips: o.pose.hips.map(x => x * k), body: o.pose.body || null }, hands: { ...o.hands } });
  writePoses(all);
}

// ---------------------------------------------------------------- Editor de página
const pageEd = createPageEditor({
  store, renderer, composer, toast, renderPanel,
  onChange: () => store.commit(),
  editVineta: id => { storeCamera(); store.project.cur = store.project.vinetas.findIndex(v => v.id === id); ui.sel = null; store.commit(); rebuildScene(); selectTab("camara", false); },
  newVinetaFor: () => { storeCamera(); const c = clone(store.v); c.id = uid("v"); c.name = `Viñeta ${store.project.vinetas.length + 1}`; store.project.vinetas.push(c); return c; },
  openExport: () => dlg.showModal(),
});

// Giro con dos dedos (holandés) mientras la pestaña Cámara está abierta
const touches = new Map(); let twist = null;
renderer.domElement.addEventListener("pointerdown", e => { if (e.pointerType === "touch") touches.set(e.pointerId, [e.clientX, e.clientY]); });
renderer.domElement.addEventListener("pointermove", e => {
  if (!touches.has(e.pointerId)) return;
  touches.set(e.pointerId, [e.clientX, e.clientY]);
  if (touches.size !== 2 || ui.tab !== "camara") { twist = null; return; }
  const [a, b] = [...touches.values()];
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * RAD;
  if (twist !== null) {
    let d = ang - twist; if (d > 180) d -= 360; if (d < -180) d += 360;
    store.v.camera.roll = clamp((store.v.camera.roll || 0) - d, -45, 45);
    const r = $("#roll"); if (r) { r.value = store.v.camera.roll; $("#roll-o").textContent = Math.round(store.v.camera.roll) + "°"; }
    markDirty();
  }
  twist = ang;
});
const endTouch = e => { if (touches.delete(e.pointerId) && touches.size < 2 && twist !== null) { twist = null; store.commit(); } };
renderer.domElement.addEventListener("pointerup", endTouch);
renderer.domElement.addEventListener("pointercancel", endTouch);

// ---------------------------------------------------------------- Cabecera: deshacer, exportar
$("#undo").addEventListener("click", () => store.undo());
$("#redo").addEventListener("click", () => store.redo());
$("#vchip").addEventListener("click", () => selectTab("escena", false));
store.on(kind => {
  if (kind === "restore") { rebuildScene(); renderPanel(); pageEd.draw(); }
  if (kind === "commit") { $("#undo").disabled = !store.past.length; $("#redo").disabled = !store.future.length; }
  if (kind === "saved") $("#savestate").textContent = cloud.user() ? "Guardado en este dispositivo · sincronizando…" : "Guardado en este dispositivo";
  if (kind === "synced") $("#savestate").textContent = "Guardado en este dispositivo y en la nube";
  if (kind === "sync-failed") $("#savestate").textContent = "Guardado en este dispositivo · la nube no respondió, se reintenta al siguiente cambio";
  if (kind === "save-failed") $("#savestate").textContent = "Sin guardado automático aquí: exporta el proyecto";
});
addEventListener("keydown", e => {
  if (e.target.matches("input, select, textarea")) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); e.shiftKey ? store.redo() : store.undo(); }
  else if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); store.redo(); }
  else if (e.key === "Delete" || e.key === "Backspace") { if (ui.sel) deleteSelected(); }
  else if (e.key === "g" || e.key === "w") { ui.tmode = "translate"; attachGizmo(); renderToolbar(); markDirty(); }
  else if (e.key === "r" || e.key === "e") { ui.tmode = "rotate"; attachGizmo(); renderToolbar(); markDirty(); }
  else if (e.key === "s") { ui.tmode = "scale"; attachGizmo(); renderToolbar(); markDirty(); }
  else if (e.key === "Escape") { if (ui.through) setThrough(false); else select(null); }
});

// Exportación
const dlg = $("#export");
$("#open-export").addEventListener("click", () => { dlg.showModal(); });
dlg.addEventListener("click", async e => {
  const b = e.target.closest("[data-x]"); if (!b) { if (e.target === dlg) dlg.close(); return; }
  const x = b.dataset.x, st = $("#xstatus");
  if (x === "close") { dlg.close(); return; }
  b.disabled = true; st.textContent = "Preparando…";
  try {
    if (x === "page-png" || x === "page-pdf") {
      storeCamera();
      const pst = $("#xpstyle").value, dpi = +$("#xpdpi").value;
      st.textContent = "Dibujando la página…";
      const { canvas } = await pageEd.exportCanvas({ dpi, style: pst === "blue" ? "clay" : pst, outline: $("#xpline").checked, blue: pst === "blue" });
      const pg = pageEd.page(), name = slug(store.project.name || "pagina") + "-pag" + (store.project.curPage + 1);
      if (x === "page-png") {
        const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
        st.textContent = await resultMsg(saveFile(name + ".png", blob));
      } else {
        const jsPDF = await loadJsPDF(), F = FORMATS[pg.format];
        const doc = new jsPDF({ unit: "mm", format: [F.w, F.h], orientation: F.w > F.h ? "l" : "p" });
        doc.addImage(canvas.toDataURL("image/jpeg", 0.93), "JPEG", 0, 0, F.w, F.h);
        st.textContent = await resultMsg(saveFile(name + ".pdf", doc.output("blob")));
      }
    } else if (x === "psd") {
      st.textContent = "Separando capas…";
      const blob = await exportPsd(+$("#xres").value);
      st.textContent = await resultMsg(saveFile(`${slug(store.v.name)}.psd`, blob));
    } else if (x === "glb" || x === "obj") {
      storeCamera();
      const { scene: sc, content: ct } = sceneFor(store.v);
      ct.updateMatrixWorld(true);
      let data;
      if (x === "glb") {
        const { GLTFExporter } = await import("three/addons/exporters/GLTFExporter.js");
        data = new Blob([await new GLTFExporter().parseAsync(ct, { binary: true })], { type: "model/gltf-binary" });
      } else {
        const { OBJExporter } = await import("three/addons/exporters/OBJExporter.js");
        data = new Blob([new OBJExporter().parse(ct)], { type: "text/plain" });
      }
      disposeScene(sc);
      st.textContent = await resultMsg(saveFile(`${slug(store.v.name)}.${x}`, data));
    } else if (x === "png") {
      const res = +$("#xres").value, layer = $("#xlayer").value, clear = $("#xclear").checked;
      const view = layerView(layer, $("#xline").checked);
      const A = frameAspect(), w = A >= 1 ? res : Math.round(res * A), h = A >= 1 ? Math.round(res / A) : res;
      const { blob } = await withExportScene(() => renderToBlob(renderer, composer, scene, exportCamera(), view, w, h, { clearBg: clear }, [grid, ruler]));
      st.textContent = await resultMsg(saveFile(`${slug(store.v.name)}-${layer}.png`, blob));
    } else if (x === "sheet" || x === "sheet-png") {
      const canvas = await printSheet(+$("#xwidth").value, $("#xink").value);
      if (x === "sheet-png") {
        const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
        st.textContent = await resultMsg(saveFile(`${slug(store.v.name)}-hoja.png`, blob));
      } else {
        const jsPDF = await loadJsPDF();
        const doc = new jsPDF({ unit: "in", format: "letter" });
        doc.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", 0, 0, 8.5, 11);
        st.textContent = await resultMsg(saveFile(`${slug(store.v.name)}-hoja.pdf`, doc.output("blob")));
      }
    } else if (x === "save-proj") {
      storeCamera();
      st.textContent = await resultMsg(saveFile(`${slug(store.project.name || "proyecto")}.arnes.json`, JSON.stringify(store.project)));
    } else if (x === "open-proj") { $("#xfile").click(); st.textContent = ""; }
  } catch (err) { console.error(err); st.textContent = "No se pudo completar. Intenta con una resolución menor."; }
  b.disabled = false;
});
$("#xfile").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const p = JSON.parse(await f.text());
    if (!p.vinetas?.length) throw new Error("formato");
    store.load(migrate(p)); store.scheduleSave(); ui.sel = null; rebuildScene(); renderPanel();
    $("#xstatus").textContent = `Abierto: ${p.vinetas.length} viñeta${p.vinetas.length > 1 ? "s" : ""}.`;
  } catch { $("#xstatus").textContent = "Ese archivo no es un proyecto de Arnés."; }
  e.target.value = "";
});
async function resultMsg(p) { const r = await p; return r === "ok" ? "Listo." : r === "declined" ? "Descarga cancelada." : "Este visor no permite descargar archivos. Abre Arnés desde GitHub Pages."; }
const slug = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "arnes";
function layerView(layer, outline = store.v.view.outline) {
  const v = store.v.view;
  if (layer === "contorno") return { ...v, mode: "clay", outline: true, contourOnly: true };
  return styleView(v, layer, outline);
}
// PSD: arcilla de fondo, figuras sueltas, valores y contorno en capas separadas
async function exportPsd(res) {
  const A = frameAspect(), w = A >= 1 ? res : Math.round(res * A), h = A >= 1 ? Math.round(res / A) : res;
  const agPsd = await loadAgPsd();
  const v = store.v.view, cam = exportCamera();
  const figGroups = [...figs.keys()].map(id => world.get(id)).filter(Boolean);
  const propGroups = [...world.entries()].filter(([id]) => !figs.has(id)).map(([, g]) => g);
  const shot = async (view, opts, hide) => {
    const vis = hide.map(o => o.visible); hide.forEach(o => (o.visible = false));
    try { return (await withExportScene(() => renderToBlob(renderer, composer, scene, cam, view, w, h, opts, [grid, ruler]))).canvas; }
    finally { hide.forEach((o, i) => (o.visible = vis[i])); }
  };
  const base = await shot({ ...v, mode: "clay", outline: false }, {}, []);
  const stage = await shot({ ...v, mode: "clay", outline: false }, {}, figGroups);
  const people = await shot({ ...v, mode: "clay", outline: false }, { clearBg: true }, [...propGroups, floor]);
  const values = await shot({ ...v, mode: "values", outline: false }, {}, []);
  const line = await shot({ ...v, mode: "clay", outline: true, contourOnly: true }, { clearBg: true }, []);
  const psd = {
    width: w, height: h, canvas: base,
    children: [
      { name: "Escenario (arcilla)", canvas: stage },
      { name: "Figuras", canvas: people },
      { name: "Valores", canvas: values, opacity: 0.6, blendMode: "multiply", hidden: true },
      { name: "Contorno", canvas: line },
    ],
  };
  return new Blob([agPsd.writePsd(psd)], { type: "image/vnd.adobe.photoshop" });
}
let agPsdP = null;
function loadAgPsd() {
  if (window.agPsd) return Promise.resolve(window.agPsd);
  agPsdP ??= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/ag-psd@34.1.0/dist/bundle.js";
    s.onload = () => res(window.agPsd); s.onerror = rej; document.head.appendChild(s);
  });
  return agPsdP;
}
async function withExportScene(fn) {
  const vis = [...Object.values(handles), actionLine, comMarker].map(o => o.visible);
  const res = await fn();
  [...Object.values(handles), actionLine, comMarker].forEach((o, i) => (o.visible = vis[i]));
  markDirty(3);
  return res;
}
// Hoja carta a 300 ppp con la viñeta a escala en líneas azules (o gris tenue)
async function printSheet(widthCm, ink) {
  const DPI = 300, W = 2550, H = 3300, margin = 0.6 * DPI;
  const A = frameAspect();
  let pw = Math.round(widthCm / 2.54 * DPI), ph = Math.round(pw / A);
  const maxH = H - margin * 2 - 260;
  if (ph > maxH) { ph = maxH; pw = Math.round(ph * A); }
  composer.mat.uniforms.blueInk.value.set(ink === "gris" ? 0x8c8f93 : 0x5aa9e0);
  const { canvas: img } = await withExportScene(() => renderToBlob(renderer, composer, scene, exportCamera(), store.v.view, pw, ph, { blue: true }, [grid, ruler]));
  composer.mat.uniforms.blueInk.value.setRGB(0.25, 0.55, 0.85);
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.fillStyle = "#ffffff"; g.fillRect(0, 0, W, H);
  const x = (W - pw) / 2, y = margin + 120;
  g.drawImage(img, x, y);
  g.strokeStyle = ink === "gris" ? "#8c8f93" : "#5aa9e0"; g.lineWidth = 6; g.strokeRect(x, y, pw, ph);
  g.fillStyle = ink === "gris" ? "#8c8f93" : "#5aa9e0";
  g.font = "600 44px Figtree, sans-serif";
  g.fillText(`Arnés · ${store.v.name}`, margin, margin + 40);
  g.font = "400 34px Figtree, sans-serif";
  const cam = store.v.camera;
  g.fillText(`Viñeta de ${round(pw / DPI * 2.54, 1)} × ${round(ph / DPI * 2.54, 1)} cm · lente ${cam.mm} mm · ojo a ${Math.round(camera.position.y * 100)} cm`, margin, y + ph + 70);
  return c;
}
let jsPDFp = null;
function loadJsPDF() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF);
  jsPDFp ??= new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => res(window.jspdf.jsPDF); s.onerror = rej; document.head.appendChild(s);
  });
  return jsPDFp;
}

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.tm); toast.tm = setTimeout(() => (t.hidden = true), 3600);
}

// Acceso para pruebas desde la consola
window.__arnes = { pageEd, exportPsd, store, ui, select, setPose, figs, selectTab, applyShot, camera, controls, rebuildScene, renderPanel, markDirty, POSE_LIBRARY, addFigure, M, pinHere, setAnchor, groundFigure, migrate };

// ---------------------------------------------------------------- Arranque
$("#hint").textContent = coarse ? "Un dedo: girar · Dos dedos: acercar y desplazar · Toca para elegir" : "Arrastrar: girar · Clic derecho: desplazar · Rueda: acercar · Clic: elegir";
desktop.addEventListener("change", () => document.body.classList.remove("sheet-open"));
window.claude?.hot?.snapshot?.(() => ({ project: store.project, tab: ui.tab }));

async function start(hot = {}) {
  if (hot.project) { openProject(hot.project, hot.tab); return; }
  await store.list(); // migra el guardado de versiones anteriores
  home.show();
  document.body.classList.add("ready");
}
function openProject(project, tab = "escena") {
  if (!project?.vinetas?.length) project = buildExample();
  store.load(migrate(project));
  ui.sel = null; ui.joint = null;
  ui.tab = tab;
  for (const t of tabs) t.setAttribute("aria-selected", String(t.dataset.tab === ui.tab));
  pageEd.show(ui.tab === "pagina"); document.body.classList.toggle("page-mode", ui.tab === "pagina");
  $("#undo").disabled = $("#redo").disabled = true;
  rebuildScene(); resize(); renderPanel(); store.saveNow();
  document.body.classList.add("ready");
}
function blankProject() {
  const v = newVineta("Viñeta 1"); const p = presetDay(); v.lights = p.lights; v.view.background = p.background;
  return { version: 2, name: "Proyecto nuevo", cur: 0, vinetas: [v] };
}
const home = createHome({
  store,
  onOpen: p => { if (p) openProject(p); else if (store.project) markDirty(3); },
  makeExample: () => buildExample(),
  makeBlank: blankProject,
});
window.__arnes.home = home;
$("#pchip").addEventListener("click", async () => { if (store.project) { storeCamera(); clearTimeout(store.saveTimer); await store.saveNow(); } home.show(); });
await document.fonts?.ready;
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});

// Sin conexión (solo fuera de claude.ai, donde los service workers están permitidos)
if ("serviceWorker" in navigator && !window.claude && location.protocol === "https:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
