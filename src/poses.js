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
  // --- Catálogo ampliado (Fase 3 · entrega 9) ---
  manos_bolsillos: { cat: "pie", label: "Manos en los bolsillos", rot: { shoulder_L: [8, 0, 14], shoulder_R: [8, 0, -14], elbow_L: [-38, 0, 0], elbow_R: [-38, 0, 0], hip_L: [-4, 0, -2], knee_L: [6, 0, 0] }, hands: ["relajada", "relajada"] },
  jarras: { cat: "pie", label: "Manos en la cintura", rot: { shoulder_L: [10, 0, 38], shoulder_R: [10, 0, -38], elbow_L: [-100, 0, 0], elbow_R: [-100, 0, 0], hip_L: [-3, 0, 6], hip_R: [0, 0, -6] }, hands: ["apoyada", "apoyada"] },
  brazos_atras: { cat: "pie", label: "Manos atrás", rot: { shoulder_L: [30, 0, 10], shoulder_R: [30, 0, -10], elbow_L: [-60, 0, 0], elbow_R: [-60, 0, 0], spine: [-4, 0, 0], neck: [-4, 0, 0] }, hands: ["relajada", "sujetar"] },
  firme: { cat: "pie", label: "Firmes", rot: { shoulder_L: [0, 0, 3], shoulder_R: [0, 0, -3], elbow_L: [-4, 0, 0], elbow_R: [-4, 0, 0], spine: [-3, 0, 0], neck: [-3, 0, 0] }, hands: ["apoyada", "apoyada"] },
  orgulloso: { cat: "pie", label: "Pecho fuera", rot: { spine: [-8, 0, 0], chest: [-6, 0, 0], neck: [-10, 0, 0], shoulder_L: [12, 0, 10], shoulder_R: [12, 0, -10], elbow_L: [-20, 0, 0], elbow_R: [-20, 0, 0], hip_L: [-6, 0, 5], hip_R: [0, 0, -5] }, hands: ["puno", "puno"] },
  cansado: { cat: "pie", label: "Cansado, hombros caídos", hips: [0, -0.01, 0], rot: { spine: [14, 0, 0], chest: [8, 0, 0], neck: [12, 0, 0], head: [10, 0, 0], shoulder_L: [-4, 0, 3], shoulder_R: [-4, 0, -3], elbow_L: [-8, 0, 0], elbow_R: [-8, 0, 0], hip_L: [-4, 0, 0], knee_L: [10, 0, 0] }, hands: ["relajada", "relajada"] },
  timido: { cat: "pie", label: "Tímido", rot: { spine: [6, 0, 0], neck: [16, -15, 0], head: [8, -10, 0], shoulder_L: [-20, -30, 8], shoulder_R: [-20, 30, -8], elbow_L: [-45, 0, 0], elbow_R: [-45, 0, 0], hip_L: [-4, 0, -6], hip_R: [-4, 0, 6], knee_L: [12, 0, 0], knee_R: [6, 0, 0] }, hands: ["relajada", "relajada"] },
  mirar_arriba: { cat: "pie", label: "Mirar hacia arriba", rot: { spine: [-8, 0, 0], neck: [-25, 0, 0], head: [-20, 0, 0], shoulder_L: [0, 0, 8], shoulder_R: [0, 0, -8], elbow_L: [-10, 0, 0], elbow_R: [-10, 0, 0] }, hands: ["relajada", "relajada"] },
  encogerse: { cat: "pie", label: "Encogerse de hombros", rot: { shoulder_L: [-20, 0, 30], shoulder_R: [-20, 0, -30], elbow_L: [-80, 40, 0], elbow_R: [-80, -40, 0], neck: [0, 0, 8] }, hands: ["abierta", "abierta"] },
  recargado_pared: { cat: "pie", label: "Recargado en la pared", hips: [0, -0.02, -0.03], rot: { hips: [-6, 0, 0], spine: [-6, 0, 0], neck: [6, 0, 0], hip_L: [-30, 0, 0], knee_L: [55, 0, 0], ankle_L: [10, 0, 0], shoulder_L: [8, 0, 10], shoulder_R: [8, 0, -10], elbow_L: [-30, 0, 0], elbow_R: [-25, 0, 0] }, hands: ["relajada", "relajada"] },
  mirar_reloj: { cat: "pie", label: "Mirar el reloj", rot: { neck: [22, 0, 0], head: [10, 10, 0], shoulder_L: [-40, 30, 15], elbow_L: [-110, 0, 0], shoulder_R: [0, 0, -6], elbow_R: [-10, 0, 0] }, hands: ["puno", "relajada"] },
  trotar: { cat: "mover", label: "Trotar", hips: [0, -0.04, 0], rot: { spine: [8, -4, 0], hip_L: [-40, 0, 0], knee_L: [55, 0, 0], hip_R: [15, 0, 0], knee_R: [40, 0, 0], ankle_R: [15, 0, 0], shoulder_L: [30, 0, 8], shoulder_R: [-35, 0, -8], elbow_L: [-85, 0, 0], elbow_R: [-85, 0, 0] }, hands: ["relajada", "relajada"] },
  sprint: { cat: "mover", label: "Esprint", hips: [0, -0.09, 0.03], rot: { hips: [14, 6, 0], spine: [22, -6, 0], neck: [-22, 0, 0], hip_L: [-85, 0, 0], knee_L: [100, 0, 0], ankle_L: [-15, 0, 0], hip_R: [30, 0, 0], knee_R: [55, 0, 0], ankle_R: [35, 0, 0], shoulder_L: [55, 0, 8], shoulder_R: [-75, 0, -8], elbow_L: [-80, 0, 0], elbow_R: [-95, 0, 0] }, hands: ["abierta", "abierta"] },
  caminar_rapido: { cat: "mover", label: "Caminar con prisa", hips: [0, -0.03, 0], rot: { spine: [10, -6, 0], neck: [-6, 0, 0], hip_L: [-30, 0, 0], knee_L: [12, 0, 0], hip_R: [18, 0, 0], knee_R: [28, 0, 0], ankle_R: [14, 0, 0], shoulder_L: [24, 0, 6], shoulder_R: [-26, 0, -6], elbow_L: [-40, 0, 0], elbow_R: [-50, 0, 0] }, hands: ["relajada", "relajada"] },
  sigilo: { cat: "mover", label: "A escondidas", hips: [0, -0.18, 0], rot: { hips: [16, 0, 0], spine: [28, 0, 0], neck: [-30, 0, 0], hip_L: [-60, 0, 6], knee_L: [70, 0, 0], ankle_L: [-10, 0, 0], hip_R: [5, 0, -6], knee_R: [45, 0, 0], ankle_R: [20, 0, 0], shoulder_L: [-40, 0, 20], shoulder_R: [-30, 0, -20], elbow_L: [-60, 0, 0], elbow_R: [-70, 0, 0] }, hands: ["abierta", "relajada"] },
  subir_escalon: { cat: "mover", label: "Subir un escalón", hips: [0, 0.02, 0], ground: false, rot: { spine: [10, 0, 0], hip_L: [-55, 0, 0], knee_L: [70, 0, 0], ankle_L: [-15, 0, 0], hip_R: [8, 0, 0], knee_R: [10, 0, 0], ankle_R: [15, 0, 0], shoulder_L: [15, 0, 8], shoulder_R: [-20, 0, -8], elbow_L: [-25, 0, 0], elbow_R: [-30, 0, 0] }, hands: ["relajada", "relajada"] },
  cojear: { cat: "mover", label: "Cojear", hips: [0, -0.04, 0], rot: { hips: [0, 0, 8], spine: [8, 0, -10], neck: [0, 0, 6], hip_L: [-18, 0, 0], knee_L: [20, 0, 0], hip_R: [10, 0, -6], knee_R: [35, 0, 0], ankle_R: [25, 0, 0], shoulder_R: [-10, 0, -20], elbow_R: [-90, 0, 0], shoulder_L: [10, 0, 15], elbow_L: [-20, 0, 0] }, hands: ["relajada", "apoyada"] },
  piernas_cruzadas: { cat: "sentado", label: "Piernas cruzadas", hips: [0, -0.4, 0], rot: { hip_L: [-90, 0, 0], knee_L: [80, 0, 0], hip_R: [-95, 20, -14], knee_R: [70, 0, 0], ankle_R: [15, 0, 0], spine: [-6, 0, 0], shoulder_L: [-20, 0, 8], shoulder_R: [-25, 0, -8], elbow_L: [-60, 0, 0], elbow_R: [-60, 0, 0] }, hands: ["relajada", "relajada"] },
  codos_rodillas: { cat: "sentado", label: "Codos en las rodillas", hips: [0, -0.4, 0], rot: { hip_L: [-90, 0, 10], hip_R: [-90, 0, -10], knee_L: [95, 0, 0], knee_R: [95, 0, 0], spine: [38, 0, 0], chest: [10, 0, 0], neck: [-30, 0, 0], shoulder_L: [-50, 0, 8], shoulder_R: [-50, 0, -8], elbow_L: [-100, 0, 0], elbow_R: [-100, 0, 0] }, hands: ["relajada", "relajada"] },
  recostado: { cat: "sentado", label: "Sentado recostado", hips: [0, -0.43, 0.06], rot: { hips: [-18, 0, 0], spine: [-10, 0, 0], neck: [14, 0, 0], hip_L: [-65, 0, 8], hip_R: [-60, 0, -12], knee_L: [55, 0, 0], knee_R: [40, 0, 0], shoulder_L: [10, 0, 25], shoulder_R: [10, 0, -25], elbow_L: [-30, 0, 0], elbow_R: [-30, 0, 0] }, hands: ["relajada", "relajada"] },
  sentado_suelo: { cat: "sentado", label: "En el suelo, piernas cruzadas", hips: [0, -0.82, 0], rot: { hip_L: [-80, -40, 45], hip_R: [-80, 40, -45], knee_L: [140, 0, 0], knee_R: [140, 0, 0], spine: [12, 0, 0], neck: [-6, 0, 0], shoulder_L: [-25, 0, 10], shoulder_R: [-25, 0, -10], elbow_L: [-40, 0, 0], elbow_R: [-40, 0, 0] }, hands: ["relajada", "relajada"] },
  abrazar_rodillas: { cat: "sentado", label: "Abrazando las rodillas", hips: [0, -0.8, 0], rot: { hip_L: [-125, 0, 6], hip_R: [-125, 0, -6], knee_L: [140, 0, 0], knee_R: [140, 0, 0], spine: [30, 0, 0], neck: [10, 0, 0], shoulder_L: [-60, -25, 15], shoulder_R: [-60, 25, -15], elbow_L: [-80, 0, 0], elbow_R: [-80, 0, 0] }, hands: ["sujetar", "sujetar"] },
  escribir: { cat: "sentado", label: "Escribiendo en la mesa", hips: [0, -0.4, 0], rot: { hip_L: [-88, 0, 4], hip_R: [-88, 0, -4], knee_L: [86, 0, 0], knee_R: [86, 0, 0], spine: [20, 0, 0], neck: [-6, 0, 0], head: [20, 0, 0], shoulder_L: [-45, -10, 14], shoulder_R: [-50, 10, -12], elbow_L: [-90, 0, 0], elbow_R: [-75, 0, 0] }, hands: ["apoyada", "lapiz"] },
  sentado_lado: { cat: "sentado", label: "Sentado de lado", hips: [0, -0.4, 0], rot: { hips: [0, 35, 0], spine: [4, -30, 0], neck: [0, -15, 0], hip_L: [-85, 0, 6], hip_R: [-85, 0, -6], knee_L: [80, 0, 0], knee_R: [95, 0, 0], shoulder_R: [-30, 30, -10], elbow_R: [-80, 0, 0], shoulder_L: [-10, 0, 20], elbow_L: [-20, 0, 0] }, hands: ["relajada", "apoyada"] },
  acostado: { cat: "suelo", label: "Acostado boca arriba", body: [-90, 0, 0], rot: { neck: [6, 0, 0], shoulder_L: [0, 0, 20], shoulder_R: [0, 0, -20], elbow_L: [-20, 0, 0], elbow_R: [-20, 0, 0], hip_R: [-20, 0, 0], knee_R: [40, 0, 0] }, hands: ["relajada", "relajada"] },
  boca_abajo: { cat: "suelo", label: "Boca abajo", body: [90, 0, 0], rot: { neck: [-15, 70, 0], shoulder_L: [-160, 0, 20], shoulder_R: [-10, 0, -20], elbow_L: [-90, 0, 0], elbow_R: [-10, 0, 0], hip_L: [0, 0, 6], hip_R: [-30, 0, -8], knee_R: [60, 0, 0] }, hands: ["apoyada", "relajada"] },
  codo_suelo: { cat: "suelo", label: "Recostado sobre el codo", body: [0, 0, -75], rot: { spine: [0, 0, 10], neck: [0, 0, 15], shoulder_L: [-80, 0, 5], elbow_L: [-90, 0, 0], shoulder_R: [-10, 0, -15], elbow_R: [-30, 0, 0], hip_L: [-20, 0, 0], knee_L: [30, 0, 0], hip_R: [-40, 0, 0], knee_R: [70, 0, 0] }, hands: ["apoyada", "relajada"] },
  gatear: { cat: "suelo", label: "Gateando", body: [80, 0, 0], rot: { hip_L: [-80, 0, 4], knee_L: [95, 0, 0], hip_R: [-70, 0, -4], knee_R: [90, 0, 0], neck: [-60, 0, 0], shoulder_L: [-95, 0, 8], shoulder_R: [-75, 0, -8], elbow_L: [-6, 0, 0], elbow_R: [-10, 0, 0] }, hands: ["apoyada", "apoyada"] },
  rodilla: { cat: "suelo", label: "Una rodilla en el suelo", hips: [0, -0.38, 0], rot: { hip_L: [-90, 0, 4], knee_L: [92, 0, 0], hip_R: [10, 0, -4], knee_R: [100, 0, 0], ankle_R: [40, 0, 0], spine: [4, 0, 0], shoulder_L: [-45, 0, 10], elbow_L: [-70, 0, 0], shoulder_R: [0, 0, -8], elbow_R: [-10, 0, 0] }, extra: { toes_R: [-55, 0, 0] }, hands: ["apoyada", "relajada"] },
  de_rodillas: { cat: "suelo", label: "De rodillas", hips: [0, -0.4, -0.04], rot: { hip_L: [5, 0, 4], hip_R: [5, 0, -4], knee_L: [95, 0, 0], knee_R: [95, 0, 0], ankle_L: [40, 0, 0], ankle_R: [40, 0, 0], spine: [6, 0, 0], neck: [10, 0, 0], shoulder_L: [0, 0, 8], shoulder_R: [0, 0, -8], elbow_L: [-15, 0, 0], elbow_R: [-15, 0, 0] }, hands: ["relajada", "relajada"] },
  lagartija: { cat: "suelo", label: "Lagartija", body: [68, 0, 0], rot: { neck: [-20, 0, 0], shoulder_L: [-80, 0, 12], shoulder_R: [-80, 0, -12], elbow_L: [-20, 0, 0], elbow_R: [-20, 0, 0], ankle_L: [40, 0, 0], ankle_R: [40, 0, 0] }, hands: ["apoyada", "apoyada"] },
  caer_atras: { cat: "accion", label: "Cayendo de espaldas", hips: [0, 0.1, 0], ground: false, body: [-35, 0, 0], rot: { spine: [-10, 0, 0], neck: [25, 0, 0], hip_L: [-50, 0, 10], knee_L: [40, 0, 0], hip_R: [-20, 0, -10], knee_R: [20, 0, 0], shoulder_L: [-120, 0, 40], shoulder_R: [-100, 0, -50], elbow_L: [-25, 0, 0], elbow_R: [-20, 0, 0] }, hands: ["abierta", "abierta"] },
  tropezar: { cat: "accion", label: "Tropezando", hips: [0, -0.05, 0], ground: false, body: [30, 0, 0], rot: { spine: [10, 0, 0], neck: [-35, 0, 0], hip_L: [-20, 0, 0], knee_L: [20, 0, 0], hip_R: [35, 0, 0], knee_R: [45, 0, 0], shoulder_L: [-70, 0, 30], shoulder_R: [-60, 0, -30], elbow_L: [-20, 0, 0], elbow_R: [-25, 0, 0] }, hands: ["abierta", "abierta"] },
  lanzar: { cat: "accion", label: "Lanzando", hips: [0, -0.03, 0], rot: { hips: [0, -20, 0], spine: [-6, -25, 0], hip_L: [-25, 0, 6], knee_L: [15, 0, 0], hip_R: [15, 0, -4], knee_R: [20, 0, 0], shoulder_R: [-20, 0, -160], elbow_R: [-90, 0, 0], shoulder_L: [-70, 0, 20], elbow_L: [-10, 0, 0] }, hands: ["abierta", "sujetar"] },
  empujar: { cat: "accion", label: "Empujando", hips: [0, -0.06, 0.04], rot: { hips: [12, 0, 0], spine: [20, 0, 0], neck: [-25, 0, 0], hip_L: [-35, 0, 4], knee_L: [40, 0, 0], hip_R: [25, 0, -4], knee_R: [10, 0, 0], ankle_R: [25, 0, 0], shoulder_L: [-85, 0, 8], shoulder_R: [-85, 0, -8], elbow_L: [-15, 0, 0], elbow_R: [-15, 0, 0] }, extra: { wrist_L: [0, 0, 70], wrist_R: [0, 0, -70] }, hands: ["abierta", "abierta"] },
  jalar: { cat: "accion", label: "Jalando una cuerda", hips: [0, -0.1, -0.06], rot: { hips: [-10, 0, 0], spine: [-10, 0, 0], hip_L: [-40, 0, 4], knee_L: [35, 0, 0], hip_R: [-10, 0, -4], knee_R: [45, 0, 0], shoulder_L: [-70, 0, 6], shoulder_R: [-60, 0, -6], elbow_L: [-40, 0, 0], elbow_R: [-70, 0, 0] }, hands: ["puno", "puno"] },
  esquivar: { cat: "accion", label: "Esquivando", hips: [0, -0.12, 0], rot: { hips: [0, 0, -12], spine: [5, 0, 20], neck: [0, 0, 15], hip_L: [-30, 0, 15], knee_L: [45, 0, 0], hip_R: [-5, 0, -20], knee_R: [25, 0, 0], shoulder_L: [-60, 0, 40], shoulder_R: [-45, 0, -15], elbow_L: [-90, 0, 0], elbow_R: [-110, 0, 0] }, hands: ["abierta", "puno"] },
  aterrizar: { cat: "accion", label: "Aterrizando", hips: [0, -0.45, 0], rot: { hips: [20, 0, 0], spine: [30, 0, 0], neck: [-35, 0, 0], hip_L: [-110, 0, 18], hip_R: [-60, 0, -10], knee_L: [125, 0, 0], knee_R: [120, 0, 0], ankle_R: [45, 0, 0], shoulder_L: [-80, 0, 50], shoulder_R: [-20, 0, -70], elbow_L: [-10, 0, 0], elbow_R: [-20, 0, 0] }, extra: { toes_R: [-50, 0, 0] }, hands: ["apoyada", "abierta"] },
  colgado: { cat: "accion", label: "Colgado de las manos", hips: [0, 0.25, 0], ground: false, rot: { shoulder_L: [-175, 0, 12], shoulder_R: [-175, 0, -12], elbow_L: [-8, 0, 0], elbow_R: [-8, 0, 0], neck: [-15, 0, 0], hip_L: [-10, 0, 0], hip_R: [5, 0, 0], knee_L: [20, 0, 0], knee_R: [10, 0, 0], ankle_L: [30, 0, 0], ankle_R: [30, 0, 0] }, hands: ["sujetar", "sujetar"] },
  escalar: { cat: "accion", label: "Escalando", hips: [0, 0.1, 0], ground: false, rot: { spine: [8, 0, 0], neck: [-25, 0, 0], shoulder_L: [-160, 0, 15], elbow_L: [-30, 0, 0], shoulder_R: [-90, 0, -20], elbow_R: [-100, 0, 0], hip_L: [-70, 0, 15], knee_L: [95, 0, 0], hip_R: [-10, 0, -5], knee_R: [25, 0, 0], ankle_R: [35, 0, 0] }, hands: ["sujetar", "sujetar"] },
  cubrirse: { cat: "accion", label: "Cubriéndose", hips: [0, -0.35, 0], rot: { hips: [15, 0, 0], spine: [35, 0, 0], neck: [20, 0, 0], hip_L: [-100, 0, 10], hip_R: [-95, 0, -10], knee_L: [120, 0, 0], knee_R: [120, 0, 0], shoulder_L: [-150, -30, 20], shoulder_R: [-150, 30, -20], elbow_L: [-130, 0, 0], elbow_R: [-130, 0, 0] }, hands: ["abierta", "abierta"] },
  golpe: { cat: "combate", label: "Golpe directo", hips: [0, -0.07, 0.03], rot: { hips: [0, -20, 0], spine: [8, -25, 0], hip_L: [-35, 0, 6], knee_L: [35, 0, 0], hip_R: [20, 0, -6], knee_R: [15, 0, 0], ankle_R: [20, 0, 0], shoulder_R: [-88, 0, -6], elbow_R: [-6, 0, 0], shoulder_L: [-55, 0, 12], elbow_L: [-130, 0, 0] }, hands: ["puno", "puno"] },
  gancho: { cat: "combate", label: "Gancho", hips: [0, -0.08, 0], rot: { hips: [0, -30, 0], spine: [10, -30, -8], hip_L: [-25, 0, 6], knee_L: [30, 0, 0], hip_R: [15, 0, -6], knee_R: [30, 0, 0], shoulder_R: [-80, 0, -70], elbow_R: [-90, 0, 0], shoulder_L: [-50, 0, 15], elbow_L: [-130, 0, 0] }, hands: ["puno", "puno"] },
  patada: { cat: "combate", label: "Patada lateral", hips: [0, -0.02, 0], rot: { hips: [0, 0, 25], spine: [0, 0, -30], neck: [0, 0, 20], hip_L: [0, 0, 6], knee_L: [10, 0, 0], hip_R: [-10, 0, -80], knee_R: [10, 0, 0], shoulder_L: [-30, 0, 50], elbow_L: [-90, 0, 0], shoulder_R: [-40, 0, -30], elbow_R: [-110, 0, 0] }, hands: ["puno", "puno"] },
  bloquear: { cat: "combate", label: "Bloqueando", hips: [0, -0.07, 0], rot: { spine: [10, 0, 0], neck: [12, 0, 0], hip_L: [-25, 0, 6], knee_L: [30, 0, 0], hip_R: [15, 0, -6], knee_R: [25, 0, 0], shoulder_L: [-100, -20, 20], shoulder_R: [-100, 20, -20], elbow_L: [-130, 0, 0], elbow_R: [-130, 0, 0] }, hands: ["puno", "puno"] },
  apuntar: { cat: "combate", label: "Apuntando", rot: { spine: [4, 10, 0], neck: [0, -10, 0], shoulder_R: [-88, 0, -4], elbow_R: [-4, 0, 0], shoulder_L: [-80, 30, 10], elbow_L: [-30, 0, 0], hip_L: [-12, 0, 4], knee_L: [10, 0, 0] }, hands: ["sujetar", "pistola"] },
  herido: { cat: "combate", label: "Herido en el costado", hips: [0, -0.05, 0], rot: { spine: [20, 0, 12], neck: [10, 0, -6], hip_L: [-20, 0, 4], knee_L: [25, 0, 0], hip_R: [0, 0, -4], knee_R: [15, 0, 0], shoulder_R: [-20, 40, -10], elbow_R: [-100, 0, 0], shoulder_L: [-10, 0, 30], elbow_L: [-40, 0, 0] }, hands: ["relajada", "apoyada"] },
  rendirse: { cat: "combate", label: "Manos arriba", rot: { shoulder_L: [0, 0, 150], shoulder_R: [0, 0, -150], elbow_L: [-70, 0, 0], elbow_R: [-70, 0, 0] }, hands: ["abierta", "abierta"] },
  estrechar: { cat: "interaccion", label: "Dar la mano", rot: { spine: [6, 0, 0], shoulder_R: [-45, 0, -4], elbow_R: [-45, 0, 0], shoulder_L: [0, 0, 6], elbow_L: [-10, 0, 0], neck: [6, 0, 0] }, hands: ["relajada", "sujetar"] },
  abrazar: { cat: "interaccion", label: "Abrazar", rot: { spine: [6, 0, 0], neck: [6, -20, 0], shoulder_L: [-80, -40, 10], shoulder_R: [-80, 40, -10], elbow_L: [-90, 0, 0], elbow_R: [-90, 0, 0] }, hands: ["apoyada", "apoyada"] },
  mano_hombro: { cat: "interaccion", label: "Mano en el hombro de otro", rot: { spine: [0, 10, 0], shoulder_R: [-80, 0, -25], elbow_R: [-25, 0, 0], shoulder_L: [0, 0, 6], elbow_L: [-10, 0, 0] }, hands: ["relajada", "apoyada"] },
  ofrecer: { cat: "interaccion", label: "Ofreciendo algo", rot: { spine: [6, 0, 0], shoulder_R: [-55, 0, -6], elbow_R: [-35, 0, 0], shoulder_L: [-55, 0, 6], elbow_L: [-35, 0, 0], neck: [10, 0, 0] }, hands: ["abierta", "abierta"] },
  cargar: { cat: "interaccion", label: "Cargando una caja", hips: [0, -0.03, -0.02], rot: { spine: [-8, 0, 0], neck: [10, 0, 0], shoulder_L: [-45, 0, 18], shoulder_R: [-45, 0, -18], elbow_L: [-70, 0, 0], elbow_R: [-70, 0, 0], hip_L: [-6, 0, 4], hip_R: [-6, 0, -4], knee_L: [10, 0, 0], knee_R: [10, 0, 0] }, hands: ["apoyada", "apoyada"] },
  abrir_puerta: { cat: "interaccion", label: "Abriendo una puerta", rot: { spine: [6, 10, 0], neck: [8, 0, 0], shoulder_R: [-55, 15, -10], elbow_R: [-35, 0, 0], shoulder_L: [0, 0, 8], elbow_L: [-15, 0, 0], hip_L: [-15, 0, 0], knee_L: [10, 0, 0] }, hands: ["relajada", "sujetar"] },
  victoria: { cat: "gestos", label: "Victoria", rot: { spine: [-10, 0, 0], neck: [-20, 0, 0], shoulder_L: [-20, 0, 160], shoulder_R: [-20, 0, -160], elbow_L: [-10, 0, 0], elbow_R: [-10, 0, 0] }, hands: ["puno", "puno"] },
  llorar: { cat: "gestos", label: "Llorando, manos en la cara", rot: { spine: [16, 0, 0], neck: [20, 0, 0], head: [10, 0, 0], shoulder_L: [-80, -40, 15], shoulder_R: [-80, 40, -15], elbow_L: [-140, 0, 0], elbow_R: [-140, 0, 0] }, hands: ["abierta", "abierta"] },
  furioso: { cat: "gestos", label: "Furioso", hips: [0, -0.03, 0], rot: { spine: [10, 0, 0], neck: [-10, 0, 0], head: [8, 0, 0], shoulder_L: [-10, 0, 25], shoulder_R: [-10, 0, -25], elbow_L: [-60, 0, 0], elbow_R: [-60, 0, 0], hip_L: [-8, 0, 8], hip_R: [0, 0, -8] }, hands: ["puno", "puno"] },
  sorpresa: { cat: "gestos", label: "Sorprendido", rot: { spine: [-10, 0, 0], neck: [-10, 0, 0], shoulder_L: [-50, -20, 40], shoulder_R: [-50, 20, -40], elbow_L: [-90, 0, 0], elbow_R: [-90, 0, 0], hip_R: [10, 0, 0], knee_R: [10, 0, 0] }, hands: ["abierta", "abierta"] },
  triste: { cat: "gestos", label: "Cabizbajo", rot: { spine: [18, 0, 0], chest: [8, 0, 0], neck: [25, 0, 0], head: [15, 0, 0], shoulder_L: [-2, 0, 2], shoulder_R: [-2, 0, -2], elbow_L: [-6, 0, 0], elbow_R: [-6, 0, 0] }, hands: ["relajada", "relajada"] },
  reir: { cat: "gestos", label: "Riendo", rot: { spine: [-14, 0, 0], neck: [-25, 0, 0], shoulder_L: [-30, -30, 25], shoulder_R: [10, 0, -15], elbow_L: [-100, 0, 0], elbow_R: [-20, 0, 0], hip_L: [-5, 0, 0], knee_L: [10, 0, 0] }, hands: ["apoyada", "relajada"] },
  beber: { cat: "objetos", label: "Bebiendo", rot: { neck: [-15, 0, 0], head: [-10, 0, 0], shoulder_R: [-60, 30, -12], elbow_R: [-125, 0, 0], shoulder_L: [0, 0, 6], elbow_L: [-12, 0, 0] }, hands: ["relajada", "vaso"] },
  telefono: { cat: "objetos", label: "Hablando por teléfono", rot: { neck: [0, 0, 10], shoulder_R: [-30, 40, -30], elbow_R: [-145, 0, 0], shoulder_L: [8, 0, 14], elbow_L: [-38, 0, 0], hip_L: [-6, 0, 0], knee_L: [8, 0, 0] }, hands: ["relajada", "sujetar"] },
  leer: { cat: "objetos", label: "Leyendo un libro", rot: { neck: [25, 0, 0], head: [12, 0, 0], shoulder_L: [-35, -30, 12], shoulder_R: [-35, 30, -12], elbow_L: [-100, 0, 0], elbow_R: [-100, 0, 0] }, hands: ["apoyada", "apoyada"] },
  martillar: { cat: "objetos", label: "Martillando", hips: [0, -0.04, 0], rot: { spine: [20, 0, 0], neck: [10, 0, 0], shoulder_R: [-140, 0, -20], elbow_R: [-70, 0, 0], shoulder_L: [-50, 0, 12], elbow_L: [-40, 0, 0], hip_L: [-20, 0, 4], knee_L: [20, 0, 0] }, hands: ["apoyada", "puno"] },
  escribir_pie: { cat: "objetos", label: "Escribiendo de pie", rot: { neck: [25, 0, 0], head: [10, 0, 0], shoulder_L: [-40, -20, 12], elbow_L: [-95, 0, 0], shoulder_R: [-35, 25, -12], elbow_R: [-105, 0, 0] }, hands: ["apoyada", "lapiz"] },
  barrer: { cat: "objetos", label: "Barriendo", hips: [0, -0.04, 0], rot: { spine: [18, 20, 0], neck: [10, -10, 0], shoulder_L: [-45, 20, 10], elbow_L: [-30, 0, 0], shoulder_R: [-70, 30, -10], elbow_R: [-80, 0, 0], hip_L: [-20, 0, 4], knee_L: [20, 0, 0], knee_R: [10, 0, 0] }, hands: ["sujetar", "sujetar"] },
};

// Categorías del catálogo (las poses base y de prueba se reparten aquí)
export const POSE_CATS = { pie: "De pie", mover: "Caminar y correr", sentado: "Sentado", suelo: "En el suelo", accion: "Acción y caída", combate: "Combate", interaccion: "Entre dos", gestos: "Gestos y emociones", objetos: "Con objetos", paginas: "De tus páginas" };
const BASE_CAT = { de_pie: "pie", relajado: "pie", brazos_cruzados: "pie", pensando: "gestos", saludar: "gestos", senalar: "gestos", caminar: "mover", correr: "mover", sentado: "sentado", agachado: "suelo", guardia: "combate", apoyado_mesa: "objetos" };
export const POSE_LIBRARY = {};
for (const [k, r] of Object.entries(RAW)) {
  POSE_LIBRARY[k] = {
    label: r.label, test: !!r.test, hands: r.hands, cat: r.cat || BASE_CAT[k] || (r.test ? "paginas" : "pie"),
    pose: { rot: { ...fromV1(r.rot), ...(r.extra || {}) }, hips: r.hips || [0, 0, 0], ik: r.ik, body: r.body || null, ground: r.ground !== false },
  };
}
