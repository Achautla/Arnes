// Construye la escena de cualquier viñeta fuera de pantalla (miniaturas de página, exportación, modelo 3D)
import * as THREE from "three";
import { dress } from "./cloth.js";
import { equip } from "./accessories.js";
import * as M from "./mannequin.js";
import { buildProp } from "./props.js";
import { buildLight } from "./lights.js";
import { DEG, paint } from "./util.js";

export const PAPER = 0xf1f0ec, DARK = 0x111214;
export const ASPECTS = { libre: null, "1:1": 1, "4:3": 4 / 3, "3:4": 3 / 4, "16:9": 16 / 9, "2:1": 2, "1:2": 0.5 };
export function aspectOf(cam, fallback = 4 / 3) {
  if (typeof cam.aspect === "number") return cam.aspect;
  return ASPECTS[cam.aspect] ?? fallback;
}
export function frameFov(cam) { return 2 * Math.atan(12 / cam.mm) * THREE.MathUtils.RAD2DEG; }

// Fondo y niebla según la vista (papel u oscuro, y atmósfera)
export function applyAtmosphere(scene, view) {
  const dark = view.background === "oscuro";
  const c = new THREE.Color(dark ? DARK : PAPER);
  scene.background = c;
  const f = view.fog || 0;
  const near = (dark ? 10 : 14) * (1 - f * 0.9), far = (dark ? 30 : 42) * (1 - f * 0.8);
  scene.fog = new THREE.Fog(c, Math.max(0.5, near), Math.max(near + 2, far));
}

export function buildObject3D(o) {
  let g, fig = null;
  if (o.kind === "figure") {
    fig = M.buildFigure(o.params);
    M.applyPose(fig, o.pose, o.relaxed);
    M.applyFace(fig, o.face || M.DEFAULT_FACE);
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
  applyAtmosphere(scene, view);
  const content = new THREE.Group(); scene.add(content);
  const figs = new Map(), world = new Map();
  const useColor = (mode || view.mode) !== "clay";
  let hideFloor = false;
  for (const o of v.objects) {
    const { g, fig } = buildObject3D(o);
    if (o.color) paint(g, o.color, useColor);
    if (g.userData.hidesFloor) hideFloor = true;
    content.add(g); world.set(o.id, g); if (fig) figs.set(o.id, fig);
  }
  if (view.floor !== false && !hideFloor) {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: PAPER, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  }
  for (const def of v.lights) {
    const L = buildLight(def, lowEnd);
    scene.add(L); if (L.target) scene.add(L.target);
  }
  const cam = v.camera;
  const camera = new THREE.PerspectiveCamera(frameFov(cam), aspectOf(cam), 0.03, 200);
  camera.position.fromArray(cam.pos);
  camera.lookAt(new THREE.Vector3(...cam.target));
  if (cam.roll) camera.rotateZ(cam.roll * DEG);
  camera.updateMatrixWorld(true);
  applyConstraints(v.objects, figs, world, camera.position);
  // Ropa: se viste después de las anclas, con la tela ya asentada
  for (const o of v.objects) {
    const fig = figs.get(o.id);
    const hair = o.hair && o.hair.style && o.hair.style !== "ninguno";
    if (fig && (o.clothes?.length || hair)) {
      fig.dress = dress(fig, o.clothes || [], { hair: o.hair, quality: lowEnd ? "media" : (view.clothQ || "alta"), useColor, map: !!view.tension, wind: view.wind || 0, windDir: view.windDir || 0 });
    }
    if (fig && o.accessories?.length) fig.acc = equip(fig, o.accessories, { useColor });
    if (fig) fig.root.traverse(c => { c.userData.objId = o.id; });
  }
  return { scene, camera, content, figs, world };
}

export function disposeScene(scene) {
  scene.traverse(o => {
    if (o.isLight && o.shadow?.map) o.shadow.map.dispose();
  });
}
