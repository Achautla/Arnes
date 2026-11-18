// Biblioteca de poses. Se escriben con la convención de la Fase 1 (ángulos de Euler, 17 articulaciones)
// y se convierten al esqueleto nuevo al cargar. "extra" va directo en el formato nuevo (doblar/girar).
// hips: desplazamiento de la pelvis en metros para una figura de 175 cm; ik: objetivos de manos o pies;
// body: orientación del cuerpo entero (para acostarse); ground: apoyar en el piso al aplicar.
import { fromV1 } from "./mannequin.js";

const RAW = {
  de_pie: { label: "De pie", rot: { shoulder_L: [0, 0, 6], shoulder_R: [0, 0, -6], elbow_L: [-8, 0, 0], elbow_R: [-8, 0, 0] }, hands: ["relajada", "relajada"] },
  relajado: {
    label: "Relajado (contrapposto)", hips: [-0.02, -0.01, 0],
    rot: { hips: [0, 4, 5], hip_L: [-8, 0, -3], knee_L: [14, 0, 0], ankle_L: [4, 0, 0], hip_R: [0, 0, 4], spine: [0, 0, -6], chest: [0, 0, -3], neck: [0, 0, 4],
      shoulder_L: [4, 0, 9], shoulder_R: [-4, 0, -8], elbow_L: [-14, 0, 0], elbow_R: [-10, 0, 0] }, hands: ["relajada", "relajada"],
  },
  sentado: {
    label: "Sentado", hips: [0, -0.4, 0],
    rot: { hip_L: [-88, 0, 3], hip_R: [-88, 0, -3], knee_L: [86, 0, 0], knee_R: [86, 0, 0], spine: [6, 0, 0],
      shoulder_L: [-22, 0, 6], shoulder_R: [-22, 0, -6], elbow_L: [-55, 0, 0], elbow_R: [-55, 0, 0] }, hands: ["relajada", "relajada"],
  },
  caminar: {
    label: "Caminar", hips: [0, -0.02, 0],
    rot: { hips: [0, 5, 0], spine: [2, -4, 0], hip_L: [-22, 0, 0], knee_L: [8, 0, 0], ankle_L: [-8, 0, 0], hip_R: [14, 0, 0], knee_R: [22, 0, 0], ankle_R: [10, 0, 0],
      shoulder_L: [16, 0, 6], shoulder_R: [-18, 0, -6], elbow_L: [-16, 0, 0], elbow_R: [-26, 0, 0] }, hands: ["relajada", "relajada"],
  },
  correr: {
    label: "Correr", hips: [0, -0.06, 0],
    rot: { hips: [0, 8, 0], spine: [14, -6, 0], chest: [4, 0, 0], neck: [-10, 0, 0], hip_L: [-65, 0, 0], knee_L: [85, 0, 0], hip_R: [22, 0, 0], knee_R: [70, 0, 0], ankle_R: [25, 0, 0],
      shoulder_L: [40, 0, 8], shoulder_R: [-55, 0, -8], elbow_L: [-95, 0, 0], elbow_R: [-90, 0, 0] }, hands: ["puno", "puno"],
  },
  senalar: { label: "Señalar", rot: { shoulder_R: [-88, 0, -4], elbow_R: [-4, 0, 0], shoulder_L: [0, 0, 6], elbow_L: [-10, 0, 0], spine: [0, -6, 0], hip_L: [-4, 0, 2] }, hands: ["relajada", "senalar"] },
  brazos_cruzados: {
    label: "Brazos cruzados",
    rot: { shoulder_L: [-30, -55, 10], shoulder_R: [-30, 55, -10], elbow_L: [-105, 0, 0], elbow_R: [-115, 0, 0] },
    ik: { wrist_L: [-0.13, 1.17, 0.13], wrist_R: [0.13, 1.13, 0.16] }, hands: ["relajada", "relajada"],
  },
  apoyado_mesa: {
    label: "Apoyado en la mesa",
    rot: { hips: [14, 0, 0], hip_L: [-14, 0, 0], hip_R: [-14, 0, 0], spine: [18, 0, 0], chest: [6, 0, 0], neck: [-18, 0, 0], head: [-10, 0, 0],
      shoulder_L: [-55, 0, 8], shoulder_R: [-55, 0, -8], elbow_L: [-6, 0, 0], elbow_R: [-6, 0, 0] },
    extra: { wrist_L: [0, 0, 60], wrist_R: [0, 0, -60] },
    ik: { wrist_L: [0.2, 0.84, 0.42], wrist_R: [-0.2, 0.84, 0.42] }, hands: ["apoyada", "apoyada"],
  },
  guardia: {
    label: "Guardia de pelea", hips: [0, -0.06, 0],
    rot: { hips: [0, 22, 0], spine: [6, -14, 0], neck: [10, -6, 0], hip_L: [-22, 0, 4], knee_L: [26, 0, 0], ankle_L: [-6, 0, 0], hip_R: [16, 0, -4], knee_R: [22, 0, 0],
      shoulder_L: [-50, 0, 12], shoulder_R: [-32, 0, -16], elbow_L: [-125, 0, 0], elbow_R: [-138, 0, 0] }, hands: ["puno", "puno"],
  },
  pensando: {
    label: "Pensando",
    rot: { head: [10, 0, 4], neck: [6, 0, 0], shoulder_R: [-35, 40, -10], elbow_R: [-140, 0, 0], shoulder_L: [-20, -65, 6], elbow_L: [-95, 0, 0], hip_L: [-6, 0, 0], knee_L: [8, 0, 0] },
    ik: { wrist_R: [-0.02, 1.38, 0.15], wrist_L: [-0.07, 1.11, 0.12] }, hands: ["relajada", "puno"],
  },
  agachado: {
    label: "En cuclillas", hips: [0, -0.6, -0.08],
    rot: { hips: [12, 0, 0], spine: [30, 0, 0], neck: [-25, 0, 0], hip_L: [-118, 0, 10], hip_R: [-118, 0, -10], knee_L: [140, 0, 0], knee_R: [140, 0, 0], ankle_L: [-25, 0, 0], ankle_R: [-25, 0, 0],
      shoulder_L: [-50, 0, 10], shoulder_R: [-50, 0, -10], elbow_L: [-55, 0, 0], elbow_R: [-55, 0, 0] }, hands: ["relajada", "relajada"],
  },
  saludar: { label: "Saludar", rot: { shoulder_R: [-10, 0, -150], elbow_R: [-35, 0, 0], shoulder_L: [0, 0, 6], elbow_L: [-10, 0, 0], neck: [0, -5, 0] }, hands: ["relajada", "abierta"] },

  // --- Poses de prueba de "The Elder's Apprentice" ---
  salto: {
    label: "Salto (cap. V)", test: true, hips: [0, 0.32, 0], ground: false,
    rot: { spine: [16, 0, 0], chest: [10, 0, 0], neck: [-18, 0, 0], hip_L: [-100, 0, 8], knee_L: [115, 0, 0], ankle_L: [25, 0, 0], hip_R: [-35, 0, -6], knee_R: [125, 0, 0], ankle_R: [30, 0, 0],
      shoulder_R: [-140, 0, -25], elbow_R: [-15, 0, 0], shoulder_L: [25, 0, 55], elbow_L: [-45, 0, 0] }, hands: ["garra", "abierta"],
  },
  tendida_lado: {
    label: "Tendida de lado (cap. V)", test: true, body: [0, 0, -90],
    rot: { hip_L: [-25, 0, 0], knee_L: [35, 0, 0], hip_R: [-50, 0, -5], knee_R: [65, 0, 0], ankle_R: [15, 0, 0], neck: [0, 0, 18], head: [0, -10, 8],
      shoulder_L: [-100, 0, 10], elbow_L: [-120, 0, 0], shoulder_R: [-30, 0, -5], elbow_R: [-40, 0, 0], spine: [8, 0, 0] }, hands: ["relajada", "apoyada"],
  },
  llave: {
    label: "Llave en la cerradura (cap. V)", test: true,
    rot: { spine: [10, 0, 0], neck: [10, 0, 0], shoulder_R: [-80, 20, -6], shoulder_L: [-60, -10, 10], elbow_L: [-35, 0, 0], hip_L: [-12, 0, 0], knee_L: [10, 0, 0] },
    extra: { elbow_R: [-25, 70, 0] }, hands: ["abierta", "pellizco"],
  },
  escalera: {
    label: "Bajando escalones (cap. V)", test: true, ground: false, hips: [0, -0.1, 0],
    rot: { hip_L: [-35, 0, 4], knee_L: [25, 0, 0], ankle_L: [-15, 0, 0], hip_R: [10, 0, -3], knee_R: [40, 0, 0], ankle_R: [-10, 0, 0], spine: [6, 10, 0], neck: [12, 0, 0],
      shoulder_L: [-10, 0, 22], elbow_L: [-20, 0, 0], shoulder_R: [10, 0, -15], elbow_R: [-15, 0, 0] }, hands: ["relajada", "relajada"],
  },
  sujetar_detras: {
    label: "Sujetar por detrás (cap. V)", test: true,
    rot: { spine: [6, 10, 0], shoulder_L: [-70, -40, 25], elbow_L: [-70, 0, 0], shoulder_R: [-25, 0, -80], elbow_R: [-10, 0, 0], hip_L: [-15, 0, 0], knee_L: [12, 0, 0] },
    hands: ["sujetar", "abierta"],
  },
  mesa_senalar: {
    label: "Inclinado señalando (cap. VII)", test: true,
    rot: { hips: [14, 0, 0], hip_L: [-14, 0, 0], hip_R: [-14, 0, 0], spine: [20, 6, 0], chest: [8, 0, 0], neck: [-12, 0, 0], head: [10, 0, 0],
      shoulder_L: [-55, 0, 8], elbow_L: [-6, 0, 0], shoulder_R: [-70, 10, -6], elbow_R: [-12, 0, 0] },
    extra: { wrist_L: [0, 0, 60] }, ik: { wrist_L: [0.22, 0.84, 0.42], wrist_R: [-0.12, 0.84, 0.55] }, hands: ["apoyada", "senalar"],
  },
  desenrollar: {
    label: "Desenrollar un plano (cap. VII)", test: true,
    rot: { spine: [10, 0, 0], neck: [12, 0, 0], shoulder_L: [-50, 0, 20], shoulder_R: [-50, 0, -20], elbow_L: [-60, 0, 0], elbow_R: [-60, 0, 0] },
    ik: { wrist_L: [0.24, 1.0, 0.34], wrist_R: [-0.24, 1.0, 0.34] }, hands: ["sujetar", "sujetar"],
  },
  barandal: {
    label: "Recargada fumando (cap. IV)", test: true, hips: [-0.03, -0.01, 0],
    rot: { hips: [0, 6, 8], hip_L: [-10, 0, -4], knee_L: [18, 0, 0], hip_R: [0, 0, 5], spine: [0, 0, -7], chest: [0, 0, -3], neck: [0, -10, 4],
      shoulder_L: [-20, -40, 25], elbow_L: [-95, 0, 0], shoulder_R: [-40, 30, -15], elbow_R: [-140, 0, 0] },
    ik: { wrist_R: [-0.02, 1.46, 0.16], wrist_L: [-0.02, 1.12, 0.1] }, hands: ["relajada", "pellizco"],
  },
  atada: {
    label: "Boca abajo, manos atadas (cap. IV)", test: true, body: [90, 0, 0],
    rot: { neck: [-20, 55, 0], head: [-10, 20, 0], shoulder_L: [45, 60, 12], shoulder_R: [45, -60, -12], elbow_L: [-95, 0, 0], elbow_R: [-95, 0, 0],
      hip_L: [0, 0, 4], hip_R: [5, 0, -4], knee_R: [25, 0, 0] },
    ik: { wrist_L: [-0.04, 0.98, -0.16], wrist_R: [0.04, 0.98, -0.16] }, hands: ["puno", "puno"],
  },
  cuclillas_talones: {
    label: "Agachado entre arbustos (cap. IV)", test: true, hips: [0, -0.6, -0.04],
    rot: { hips: [15, 0, 0], spine: [32, 0, 0], neck: [-28, 0, 0], hip_L: [-120, 0, 12], hip_R: [-115, 0, -8], knee_L: [150, 0, 0], knee_R: [145, 0, 0], ankle_L: [20, 0, 0], ankle_R: [20, 0, 0],
      shoulder_L: [-45, 0, 12], elbow_L: [-70, 0, 0], shoulder_R: [-65, 0, -10], elbow_R: [-30, 0, 0] },
    extra: { toes_L: [-55, 0, 0], toes_R: [-55, 0, 0] }, hands: ["apoyada", "garra"],
  },
  sentado_baston: {
    label: "Sentado con bastón (cap. III)", test: true, hips: [0, -0.4, 0],
    rot: { hip_L: [-85, 0, 6], hip_R: [-85, 0, -6], knee_L: [80, 0, 0], knee_R: [90, 0, 0], spine: [4, 0, 0], neck: [6, 0, 0],
      shoulder_L: [-22, 0, 6], elbow_L: [-55, 0, 0], shoulder_R: [-40, 0, -8], elbow_R: [-45, 0, 0] },
    ik: { wrist_R: [-0.14, 0.78, 0.42] }, hands: ["relajada", "sujetar"],
  },
  mano_frente: {
    label: "Mano en la frente (cap. III)", test: true,
    rot: { head: [14, 0, 0], neck: [8, 0, 0], shoulder_R: [-110, 30, -20], elbow_R: [-120, 0, 0], shoulder_L: [0, 0, 6], elbow_L: [-12, 0, 0] },
    ik: { wrist_R: [-0.1, 1.6, 0.16] }, hands: ["relajada", "abierta"],
  },
};

export const POSE_LIBRARY = {};
for (const [k, r] of Object.entries(RAW)) {
  POSE_LIBRARY[k] = {
    label: r.label, test: !!r.test, hands: r.hands,
    pose: { rot: { ...fromV1(r.rot), ...(r.extra || {}) }, hips: r.hips || [0, 0, 0], ik: r.ik, body: r.body || null, ground: r.ground !== false },
  };
}
