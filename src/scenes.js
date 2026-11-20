// Construye la escena de cualquier viñeta fuera de pantalla (miniaturas de página, exportación, modelo 3D)
import * as THREE from "three";
import { dress } from "./cloth.js";
import { equip } from "./accessories.js";
import { gatherObstacles, deformSkin } from "./contact.js";
import * as M from "./mannequin.js";
import { buildProp } from "./props.js";
import { buildLight } from "./lights.js";
import { buildCreature, setCreatureStyle } from "./creature.js";
import { atmoParticles } from "./atmos.js";
import { DEG, paint } from "./util.js";
import { humanReady, attachHuman, humanDims, loadHuman } from "./human.js";
import { dressHuman, equipHuman, humanShellAcc } from "./humandress.js";

export const PAPER = 0xf1f0ec, DARK = 0x111214;
export const ASPECTS = { libre: null, "1:1": 1, "4:3": 4 / 3, "3:4": 3 / 4, "16:9": 16 / 9, "2:1": 2, "1:2": 0.5 };
export function aspectOf(cam, fallback = 4 / 3) {
  if (typeof cam.aspect === "number") return cam.aspect;
  return ASPECTS[cam.aspect] ?? fallback;
}
export function frameFov(cam) { return 2 * Math.atan(12 / cam.mm) * THREE.MathUtils.RAD2DEG; }

// Fondo y niebla según la vista (papel u oscuro, y atmósfera)
// Tamaño del mundo: con criaturas colosales o escenarios grandes, la niebla, las sombras y la cámara se estiran
export function sceneSpan(objects = []) {
  let s = 1;
  for (const o of objects) {
    const sc = Math.max(...(o.scale || [1, 1, 1]).map(Math.abs));
    if (o.kind === "creature") s = Math.max(s, (o.cparams?.length || 2) * sc / 4);
    else if (o.kind === "prop") s = Math.max(s, sc / 3, Math.hypot(o.pos[0], o.pos[2]) / 12);
  }
  return Math.min(s, 120);
}
export function applyAtmosphere(scene, view, span = 1) {
  const dark = view.background === "oscuro";
  // con atmósfera, el cielo y la niebla toman su color (gris de lluvia, ocre de polvo, azul de noche…)
  const c = new THREE.Color(view.fogColor && (view.fog || 0) > 0 ? view.fogColor : dark ? DARK : PAPER);
  scene.background = c;
  for (const o of scene.children.filter(x => x.userData.atmo)) { scene.remove(o); o.geometry?.dispose(); o.material?.dispose(); }
  const fx = atmoParticles(view, span); if (fx) scene.add(fx);
  const f = view.fog || 0;
  const near = (dark ? 10 : 14) * (1 - f * 0.9), far = (dark ? 30 : 42) * (1 - f * 0.8);
  scene.fog = new THREE.Fog(c, Math.max(0.5, near * span), Math.max(near * span + 2, far * span));
}

export function buildObject3D(o) {
  let g, fig = null;
  if (o.kind === "creature") {
    g = buildCreature(o);
    g.position.fromArray(o.pos); g.rotation.set(...(o.rot || [0, 0, 0]).map(d => d * DEG)); g.scale.fromArray(o.scale || [1, 1, 1]);
  } else if (o.kind === "figure") {
    const real = o.human && humanReady();
    if (o.human && !real) loadHuman().then(() => dispatchEvent(new Event("arnes-model"))).catch(() => {});
    fig = M.buildFigure(real ? { ...o.params, dims: humanDims(o.human) } : o.params);
    M.applyPose(fig, o.pose, o.relaxed);
    M.applyFace(fig, o.face || M.DEFAULT_FACE);
    if (real) attachHuman(fig, o.human, o.face || M.DEFAULT_FACE);
    g = fig.root;
    g.position.fromArray(o.pos); g.rotation.set(0, (o.rotY || 0) * DEG, 0);
  } else {
    g = buildProp(o.type, o.params);
    g.position.fromArray(o.pos);
    g.rotation.set(...(o.rot || [0, 0, 0]).map(d => d * DEG));
    g.scale.fromArray(o.scale || [1, 1, 1]);
  }
  g.userData.objId = o.id;
  g.traverse(c => { c.userData.objId = o.id; });
  g.updateMatrixWorld(true);
  return { g, fig };
}

// Objetos sostenidos con la mano: siguen a la muñeca con el desfase guardado al tomarlos
const _hm = new THREE.Matrix4(), _hs = new THREE.Vector3();
export function applyHolds(objects, figs, world, skipId = null) {
  for (const ob of objects) {
    const h = ob.hold; if (!h || ob.id === skipId) continue;
    const f = figs.get(h.obj), j = f?.joints[h.end], g = world.get(ob.id); if (!j || !g) continue;
    j.updateMatrixWorld(true);
    _hm.compose(new THREE.Vector3(...h.off), new THREE.Quaternion(...h.q), _hs.set(1, 1, 1)).premultiply(j.matrixWorld);
    _hm.decompose(g.position, g.quaternion, _hs);
    g.scale.fromArray(ob.scale || [1, 1, 1]); g.updateMatrixWorld(true);
  }
}
// Mirada y anclas (las mismas reglas que en el visor)
export function applyConstraints(objects, figs, world, cameraPos) {
  for (const ob of objects) {
    if (ob.kind !== "figure") continue;
    const f = figs.get(ob.id); if (!f) continue;
    for (const [end, a] of Object.entries(ob.anchors || {})) {
      if (!a) continue;
      const t = a.part ? figs.get(a.obj)?.joints[a.part] : world.get(a.obj);
      if (!t) continue;
      t.updateMatrixWorld(true);
      M.solveIK(f, end, t.localToWorld(new THREE.Vector3(...a.off)), ob.relaxed, 10);
    }
    if (!ob.gaze) continue;
    let t = null;
    if (ob.gaze === "camera") t = cameraPos?.clone();
    else { const other = figs.get(ob.gaze); if (other) { t = other.joints.head.getWorldPosition(new THREE.Vector3()); t.y += other.d.hh * 0.45; } }
    if (t) M.lookAt(f, t, ob.relaxed);
  }
}

export function sceneFor(v, { lowEnd = true, mode } = {}) {
  const scene = new THREE.Scene();
  const view = v.view;
  const span = sceneSpan(v.objects);
  applyAtmosphere(scene, view, span);
  const content = new THREE.Group(); scene.add(content);
  const figs = new Map(), world = new Map();
  const useColor = (mode || view.mode) !== "clay";
  let hideFloor = false;
  for (const o of v.objects) {
    const { g, fig } = buildObject3D(o);
    if (o.kind === "creature") setCreatureStyle(g, useColor && (mode || view.mode) !== "grabado", o.color);
    else if (o.color || o.tex || g.userData.parts) paint(g, o.color || null, useColor && (mode || view.mode) !== "grabado", o.tex);
    if (g.userData.hidesFloor) hideFloor = true;
    content.add(g); world.set(o.id, g); if (fig) { fig.root.userData.isFigure = true; figs.set(o.id, fig); }
  }
  if (view.floor !== false && !hideFloor) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80 * span, 80 * span), new THREE.MeshStandardMaterial({ color: PAPER, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  }
  if (!v.lights?.length) { // viñetas viejas sin luces: luz de cortesía para que no salgan negras
    const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(3, 6, 4);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8070, 1.1), sun);
  }
  for (const def of v.lights || []) {
    const L = buildLight(def, lowEnd, span);
    scene.add(L); if (L.target) scene.add(L.target);
  }
  const cam = v.camera;
  const camera = new THREE.PerspectiveCamera(frameFov(cam), aspectOf(cam), 0.03 * Math.sqrt(span), 200 * span);
  camera.position.fromArray(cam.pos);
  camera.lookAt(new THREE.Vector3(...cam.target));
  if (cam.roll) camera.rotateZ(cam.roll * DEG);
  camera.updateMatrixWorld(true);
  applyConstraints(v.objects, figs, world, camera.position);
  applyHolds(v.objects, figs, world);
  // Ropa: se viste después de las anclas, con la tela ya asentada
  for (const o of v.objects) {
    const fig = figs.get(o.id);
    const hair = o.hair && o.hair.style && o.hair.style !== "ninguno";
    const clothes = [...(o.tex === "piel" ? [{ id: "piel", type: "piel", color: o.color || "#c99a76", mat: "piel", ease: 0.15 }] : []), ...(o.clothes || [])];
    if (fig?.human) {
      fig.human.setStyle(useColor, o.color, o.hair?.color);
      const sa = humanShellAcc(o.accessories);
      fig.dress = dressHuman(fig, o.clothes || [], { hair: o.hair, facial: o.human.facial, sleeves: o.human.sleeves, prosthesis: o.human.prosthesis, footwear: sa.footwear || o.human.footwear, footColor: sa.footColor, gloves: sa.gloves, useColor });
      if (o.accessories?.length) fig.acc = equipHuman(fig, o.accessories, { useColor }, equip);
      fig.root.traverse(c => { c.userData.objId = o.id; });
      continue;
    }
    if (fig && (clothes.length || hair)) {
      fig.dress = dress(fig, clothes, { obstacles: () => gatherObstacles([...world.values()], [...figs.values()], fig.root), hair: o.hair, quality: lowEnd ? "media" : (view.clothQ || "alta"), useColor, map: !!view.tension, wind: view.wind || 0, windDir: view.windDir || 0 });
    }
    if (fig && o.accessories?.length) fig.acc = equip(fig, o.accessories, { useColor });
    if (fig) fig.root.traverse(c => { c.userData.objId = o.id; });
    if (fig) deformSkin(fig, gatherObstacles([...world.values()], [...figs.values()], fig.root), view.floor === false ? -Infinity : 0);
  }
  return { scene, camera, content, figs, world };
}

export function disposeScene(scene) {
  scene.traverse(o => {
    if (o.isLight && o.shadow?.map) o.shadow.map.dispose();
  });
}
