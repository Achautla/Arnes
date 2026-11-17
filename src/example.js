// Proyecto de ejemplo: la viñeta 2 de la página de referencia ("El viejo y el aprendiz")
import * as THREE from "three";
import * as M from "./mannequin.js";
import { POSE_LIBRARY } from "./poses.js";
import { presetNoir } from "./lights.js";
import { newVineta } from "./store.js";
import { clone, DEG, round } from "./util.js";

function seated(id, name, params, pos, rotY, wristTargets, extraRot = {}) {
  const fig = M.buildFigure(params);
  fig.root.position.fromArray(pos);
  fig.root.rotation.y = rotY * DEG;
  const s = fig.d.H / 1.75;
  const pose = M.emptyPose();
  for (const [j, r] of Object.entries(POSE_LIBRARY.sentado.pose.rot)) pose.rot[j] = r.slice();
  for (const [j, r] of Object.entries(extraRot)) pose.rot[j] = r.slice();
  pose.hips = POSE_LIBRARY.sentado.pose.hips.map(v => v * s);
  M.applyPose(fig, pose);
  for (const [end, t] of Object.entries(wristTargets)) M.solveIK(fig, end, new THREE.Vector3(...t), false, 30);
  return {
    id, kind: "figure", name, pos, rotY, params, pose: M.readPose(fig),
    hands: { L: "apoyada", R: "relajada" }, gaze: null, relaxed: false,
  };
}
const prop = (id, type, name, pos, rotY = 0, params = {}) => ({ id, kind: "prop", type, name, pos, rot: [0, rotY, 0], scale: [1, 1, 1], params });

export function buildExample() {
  const v = newVineta("Viñeta 1 · Frente a frente");
  const viejo = seated("f_viejo", "El viejo", { height: 172, heads: 7.5, build: 0.55, shape: 0 }, [-0.9, 0, 0], 90,
    { wrist_L: [-0.5, 0.8, -0.13], wrist_R: [-0.48, 0.8, 0.15] }, { spine: [4, 0, 0], neck: [6, 0, 0] });
  viejo.hands = { L: "apoyada", R: "sujetar" };
  const joven = seated("f_joven", "El aprendiz", { height: 178, heads: 7.5, build: 0.4, shape: 0 }, [0.9, 0, 0], -90,
    { wrist_L: [0.47, 0.79, 0.14], wrist_R: [0.47, 0.79, -0.13] }, { spine: [14, 0, 0], chest: [6, 0, 0] });
  viejo.gaze = joven.id; joven.gaze = viejo.id;
  v.objects = [
    prop("p_mesa", "mesa", "Mesa", [0, 0, 0], 0, { ancho: 120, fondo: 70, alto: 74 }),
    prop("p_silla1", "silla", "Silla del viejo", [-0.98, 0, 0], 90, { asiento: 44 }),
    prop("p_silla2", "silla", "Silla del aprendiz", [0.98, 0, 0], -90, { asiento: 44 }),
    prop("p_lampara", "lampara", "Lámpara", [0.02, 0.74, -0.24], 0),
    prop("p_vaso", "vaso", "Vaso", [-0.44, 0.74, 0.16], 0),
    prop("p_pared", "pared", "Muro de piedra", [0, 0, -1.4], 0, { ancho: 420, alto: 280 }),
    prop("p_estante", "estante", "Estante", [1.55, 0, -1.18], 0),
    prop("p_baul", "baul", "Baúl", [-1.75, 0, -0.95], 12),
    viejo, joven,
  ];
  // Luz de la lámpara: sale de la pantalla de la lámpara
  const noir = presetNoir([0.15, 1.07, -0.24]);
  v.lights = noir.lights;
  v.view.background = noir.background;
  v.view.grid = false;
  v.camera = { pos: [2.15, 1.38, 0.78], target: [-0.7, 1.0, -0.05], mm: 35, roll: 0, aspect: "4:3", shot: null, angle: "normal" };

  // Viñeta 2: el mismo cuarto, primer plano del viejo
  const v2 = clone(v);
  v2.id = "v_" + Math.random().toString(36).slice(2, 8);
  v2.name = "Viñeta 2 · Primer plano del viejo";
  v2.camera = { pos: [0.18, 1.22, 0.5], target: [-0.86, 1.13, -0.02], mm: 50, roll: 0, aspect: "1:1", shot: "primer", angle: "normal" };

  return { version: 1, name: "El viejo y el aprendiz", cur: 0, vinetas: [v, v2] };
}
