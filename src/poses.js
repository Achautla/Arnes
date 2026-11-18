// Biblioteca de poses base. Rotaciones en grados; "hips" (desplazamiento de pelvis) y "ik"
// (objetivos de manos o pies) en metros para una figura de 175 cm: se escalan a la altura real.
const P = (rot, extra = {}) => ({ rot, ...extra });

export const POSE_LIBRARY = {
  de_pie: { label: "De pie", pose: P({ shoulder_L: [0, 0, 6], shoulder_R: [0, 0, -6], elbow_L: [-8, 0, 0], elbow_R: [-8, 0, 0] }), hands: ["relajada", "relajada"] },
  relajado: {
    label: "Relajado (contrapposto)",
    pose: P({ hips: [0, 4, 5], hip_L: [-8, 0, -3], knee_L: [14, 0, 0], ankle_L: [4, 0, 0], hip_R: [0, 0, 4], spine: [0, 0, -6], chest: [0, 0, -3], neck: [0, 0, 4],
      shoulder_L: [4, 0, 9], shoulder_R: [-4, 0, -8], elbow_L: [-14, 0, 0], elbow_R: [-10, 0, 0] }, { hips: [-0.02, -0.01, 0] }),
    hands: ["relajada", "relajada"],
  },
  sentado: {
    label: "Sentado",
    pose: P({ hip_L: [-88, 0, 3], hip_R: [-88, 0, -3], knee_L: [86, 0, 0], knee_R: [86, 0, 0], spine: [6, 0, 0],
      shoulder_L: [-22, 0, 6], shoulder_R: [-22, 0, -6], elbow_L: [-55, 0, 0], elbow_R: [-55, 0, 0] }, { hips: [0, -0.4, 0] }),
    hands: ["relajada", "relajada"],
  },
  caminar: {
    label: "Caminar",
    pose: P({ hips: [0, 5, 0], spine: [2, -4, 0], hip_L: [-22, 0, 0], knee_L: [8, 0, 0], ankle_L: [-8, 0, 0], hip_R: [14, 0, 0], knee_R: [22, 0, 0], ankle_R: [10, 0, 0],
      shoulder_L: [16, 0, 6], shoulder_R: [-18, 0, -6], elbow_L: [-16, 0, 0], elbow_R: [-26, 0, 0] }, { hips: [0, -0.02, 0] }),
    hands: ["relajada", "relajada"],
  },
  correr: {
    label: "Correr",
    pose: P({ hips: [0, 8, 0], spine: [14, -6, 0], chest: [4, 0, 0], neck: [-10, 0, 0], hip_L: [-65, 0, 0], knee_L: [85, 0, 0], hip_R: [22, 0, 0], knee_R: [70, 0, 0], ankle_R: [25, 0, 0],
      shoulder_L: [40, 0, 8], shoulder_R: [-55, 0, -8], elbow_L: [-95, 0, 0], elbow_R: [-90, 0, 0] }, { hips: [0, -0.06, 0] }),
    hands: ["puno", "puno"],
  },
  senalar: {
    label: "Señalar",
    pose: P({ shoulder_R: [-88, 0, -4], elbow_R: [-4, 0, 0], shoulder_L: [0, 0, 6], elbow_L: [-10, 0, 0], spine: [0, -6, 0], hip_L: [-4, 0, 2] }),
    hands: ["relajada", "senalar"],
  },
  brazos_cruzados: {
    label: "Brazos cruzados",
    pose: P({ shoulder_L: [-30, -55, 10], shoulder_R: [-30, 55, -10], elbow_L: [-105, 0, 0], elbow_R: [-115, 0, 0] }, { ik: { wrist_L: [-0.13, 1.17, 0.13], wrist_R: [0.13, 1.13, 0.16] } }),
    hands: ["relajada", "relajada"],
  },
  apoyado_mesa: {
    label: "Apoyado en la mesa",
    pose: P({ hips: [14, 0, 0], hip_L: [-14, 0, 0], hip_R: [-14, 0, 0], spine: [18, 0, 0], chest: [6, 0, 0], neck: [-18, 0, 0], head: [-10, 0, 0],
      shoulder_L: [-55, 0, 8], shoulder_R: [-55, 0, -8], elbow_L: [-6, 0, 0], elbow_R: [-6, 0, 0], wrist_L: [55, 0, 0], wrist_R: [55, 0, 0] },
      { ik: { wrist_L: [0.2, 0.84, 0.42], wrist_R: [-0.2, 0.84, 0.42] } }),
    hands: ["apoyada", "apoyada"],
  },
  guardia: {
    label: "Guardia de pelea",
    pose: P({ hips: [0, 22, 0], spine: [6, -14, 0], neck: [10, -6, 0], hip_L: [-22, 0, 4], knee_L: [26, 0, 0], ankle_L: [-6, 0, 0], hip_R: [16, 0, -4], knee_R: [22, 0, 0],
      shoulder_L: [-50, 0, 12], shoulder_R: [-32, 0, -16], elbow_L: [-125, 0, 0], elbow_R: [-138, 0, 0] }, { hips: [0, -0.06, 0] }),
    hands: ["puno", "puno"],
  },
  pensando: {
    label: "Pensando",
    pose: P({ head: [10, 0, 4], neck: [6, 0, 0], shoulder_R: [-35, 40, -10], elbow_R: [-140, 0, 0], shoulder_L: [-20, -65, 6], elbow_L: [-95, 0, 0], hip_L: [-6, 0, 0], knee_L: [8, 0, 0] },
      { ik: { wrist_R: [-0.02, 1.38, 0.15], wrist_L: [-0.07, 1.11, 0.12] } }),
    hands: ["relajada", "puno"],
  },
  agachado: {
    label: "En cuclillas",
    pose: P({ hips: [12, 0, 0], spine: [30, 0, 0], neck: [-25, 0, 0], hip_L: [-118, 0, 10], hip_R: [-118, 0, -10], knee_L: [140, 0, 0], knee_R: [140, 0, 0], ankle_L: [-25, 0, 0], ankle_R: [-25, 0, 0],
      shoulder_L: [-50, 0, 10], shoulder_R: [-50, 0, -10], elbow_L: [-55, 0, 0], elbow_R: [-55, 0, 0] }, { hips: [0, -0.6, -0.08] }),
    hands: ["relajada", "relajada"],
  },
  saludar: {
    label: "Saludar",
    pose: P({ shoulder_R: [-10, 0, -150], elbow_R: [-35, 0, 0], shoulder_L: [0, 0, 6], elbow_L: [-10, 0, 0], neck: [0, -5, 0] }),
    hands: ["relajada", "abierta"],
  },
};
