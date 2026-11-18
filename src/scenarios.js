// Escenarios prearmados: se agregan a la viñeta actual como objetos normales (se pueden mover o borrar)
import { uid } from "./util.js";

const P = (type, name, pos, rotY = 0, params = {}) => ({ id: uid("p"), kind: "prop", type, name, pos, rot: [0, rotY, 0], scale: [1, 1, 1], params });
const walls = (w, d, h = 280, label = "Muro") => [
  P("pared", `${label} del fondo`, [0, 0, -d / 2], 0, { ancho: w * 100, alto: h }),
  P("pared", `${label} izquierdo`, [-w / 2, 0, 0], 90, { ancho: d * 100, alto: h }),
  P("pared", `${label} derecho`, [w / 2, 0, 0], -90, { ancho: d * 100, alto: h }),
];

export const SCENARIOS = {
  sotano: { label: "Sótano de piedra", preset: "noir", build: () => [
    ...walls(5, 4.4, 260, "Muro de piedra"), P("mesa", "Mesa", [0, 0, 0]), P("silla", "Silla", [-0.95, 0, 0], 90), P("silla", "Silla", [0.95, 0, 0], -90),
    P("lampara", "Lámpara", [0.05, 0.74, -0.22]), P("baul", "Baúl", [-1.8, 0, -1.6], 10), P("estante", "Estante", [1.6, 0, -2.0]), P("columna", "Columna", [-1.8, 0, 1.2], 0, { alto: 260 }),
  ] },
  oficina: { label: "Oficina de detective", preset: "blinds", build: () => [
    ...walls(5, 4.5, 280), P("ventana", "Ventana con persiana", [2.49, 0, -0.4], -90, { ancho: 140, alto: 120 }), P("escritorio", "Escritorio", [0, 0, -0.9]),
    P("silla", "Silla del detective", [0, 0, -1.55], 0), P("silla", "Silla del cliente", [0, 0, 0.1], 180), P("lampara", "Lámpara", [-0.45, 0.74, -1.0], 30),
    P("estante", "Archivero", [-2.0, 0, -2.0]), P("colgante", "Lámpara de techo", [0, 0, 0.5]), P("vaso", "Vaso", [0.35, 0.74, -0.8]),
  ] },
  callejon: { label: "Callejón", preset: "moon", build: () => [
    P("pared", "Muro izquierdo", [-1.6, 0, -2], 90, { ancho: 1400, alto: 900 }), P("pared", "Muro derecho", [1.6, 0, -2], -90, { ancho: 1400, alto: 900 }),
    P("bote", "Bote de basura", [-1.25, 0, 0.6]), P("bote", "Bote de basura", [-1.25, 0, 1.2]), P("caja", "Cajas", [1.2, 0, -1.2], 15, { ancho: 60, alto: 50, fondo: 60 }),
    P("farol", "Farol", [1.3, 0, -4], -90, { alto: 360 }), P("puerta", "Puerta trasera", [1.55, 0, 2], -90),
  ] },
  calle: { label: "Calle con faroles", preset: "moon", build: () => [
    P("caja", "Edificio", [-6, 0, -9], 0, { ancho: 800, alto: 1400, fondo: 800 }), P("caja", "Edificio", [4, 0, -10], 0, { ancho: 900, alto: 2000, fondo: 800 }),
    P("caja", "Banqueta", [0, 0, -3.5], 0, { ancho: 3000, alto: 15, fondo: 300 }), P("farol", "Farol", [-3, 0, -2.6], 180), P("farol", "Farol", [4, 0, -2.6], 180),
    P("auto", "Auto estacionado", [1.2, 0, -1.2], 90),
  ] },
  bar: { label: "Bar", preset: "noir", build: () => [
    ...walls(7, 5), P("caja", "Barra", [0, 0, -1.4], 0, { ancho: 400, alto: 110, fondo: 60 }), P("estante", "Repisa de botellas", [0, 0, -2.3], 0, { ancho: 380, alto: 200 }),
    P("cilindro", "Banco", [-1, 0, -0.75], 0, { radio: 18, alto: 75 }), P("cilindro", "Banco", [0, 0, -0.75], 0, { radio: 18, alto: 75 }), P("cilindro", "Banco", [1, 0, -0.75], 0, { radio: 18, alto: 75 }),
    P("colgante", "Lámpara", [-1, 0, -1.4], 0, { altura: 200 }), P("colgante", "Lámpara", [1, 0, -1.4], 0, { altura: 200 }), P("vaso", "Vaso", [0.2, 1.1, -1.4]),
  ] },
  recamara: { label: "Recámara", preset: "moon", build: () => [
    ...walls(4.5, 4), P("cama", "Cama", [-0.6, 0, -0.9]), P("caja", "Buró", [0.45, 0, -1.7], 0, { ancho: 45, alto: 55, fondo: 40 }), P("lampara", "Lámpara", [0.45, 0.55, -1.75]),
    P("ventana", "Ventana", [2.24, 0, -0.5], -90), P("espejo", "Espejo de pie", [1.6, 0, 1.2], -120),
  ] },
  porche: { label: "Porche con barandal", preset: "moon", build: () => [
    P("pared", "Fachada de la casa", [0, 0, -1.6], 0, { ancho: 900, alto: 600 }), P("losa", "Piso del porche", [0, 0, 0], 0, { ancho: 700, fondo: 320, alto: 50 }),
    P("barandal", "Barandal", [0, 0.5, 1.55], 0, { ancho: 500, alto: 95 }), P("escalera", "Escalones", [3.0, 0, 2.2], 180, { escalones: 3, ancho: 140 }),
    P("puerta", "Puerta", [0.5, 0.5, -1.55]), P("ventana", "Ventana", [-2.2, 0.5, -1.55]), P("columna", "Poste", [-3.4, 0.5, 1.5], 0, { alto: 280 }), P("columna", "Poste", [2.5, 0.5, 1.5], 0, { alto: 280 }),
    P("arbusto", "Arbustos", [-1.5, 0, 2.4], 0, { ancho: 160 }), P("arbol", "Árbol", [-6, 0, 3]),
  ] },
  juntas: { label: "Sala de juntas", preset: "noir", build: () => [
    ...walls(7, 5.5), P("caja", "Mesa larga", [0, 0, 0], 0, { ancho: 320, alto: 76, fondo: 120 }),
    ...[-1.1, 0, 1.1].flatMap(x => [P("silla", "Silla", [x, 0, -0.9], 0), P("silla", "Silla", [x, 0, 0.9], 180)]),
    P("silla", "Cabecera", [-2.0, 0, 0], 90), P("pizarron", "Pizarrón", [0, 0, -2.7]), P("colgante", "Lámpara", [0, 0, 0], 0, { altura: 190 }), P("maqueta", "Maqueta", [0.6, 0.76, 0]),
  ] },
  biblioteca: { label: "Biblioteca con escalera de caracol", preset: "noir", build: () => [
    ...walls(7, 6, 600), P("estante", "Librero", [-2.4, 0, -2.85], 0, { ancho: 180, alto: 260 }), P("estante", "Librero", [-0.5, 0, -2.85], 0, { ancho: 180, alto: 260 }),
    P("estante", "Librero", [3.35, 0, -1], -90, { ancho: 180, alto: 260 }), P("caracol", "Escalera de caracol", [2, 0, 1.5], 0, { alto: 320 }), P("losa", "Balcón", [1.5, 3.2, -2.3], 0, { ancho: 400, fondo: 140, alto: 15 }),
    P("escritorio", "Escritorio", [-1.2, 0, 0.6], 90), P("lampara", "Lámpara", [-1.2, 0.74, 0.3]),
  ] },
  obra: { label: "Edificio en construcción", preset: "sunset", build: () => [
    P("losa", "Losa", [0, 0, 0], 0, { ancho: 1200, fondo: 900, alto: 30 }), P("losa", "Losa superior", [0, 3.3, 0], 0, { ancho: 1200, fondo: 900, alto: 30 }),
    ...[-5, -1.7, 1.7, 5].flatMap(x => [P("columna", "Columna", [x, 0.3, -4], 0, { alto: 300 }), P("columna", "Columna", [x, 0.3, 4], 0, { alto: 300 })]),
    P("andamio", "Andamio", [0, 0.3, 5.2], 0, { ancho: 600, pisos: 2 }), P("grua", "Grúa", [10, 0, -10], 0, { alto: 2400 }), P("maqueta", "Material", [3, 0.3, 0]),
  ] },
  cocina: { label: "Cocina", preset: "day", build: () => [
    ...walls(5, 4), P("caja", "Barra de cocina", [0, 0, -1.7], 0, { ancho: 380, alto: 90, fondo: 60 }), P("caja", "Alacena", [0, 1.5, -1.82], 0, { ancho: 380, alto: 70, fondo: 35 }),
    P("mesa", "Mesa", [0.3, 0, 0.4], 0, { ancho: 110, fondo: 80, alto: 76 }), P("silla", "Silla", [-0.4, 0, 0.4], 90), P("silla", "Silla", [1.0, 0, 0.4], -90), P("ventana", "Ventana", [2.49, 0, -0.5], -90),
  ] },
  sala: { label: "Sala", preset: "day", build: () => [
    ...walls(6, 5), P("sofa", "Sofá", [0, 0, -1.8]), P("caja", "Mesa de centro", [0, 0, -0.6], 0, { ancho: 110, alto: 42, fondo: 60 }),
    P("silla", "Sillón", [1.8, 0, -0.6], -90), P("lampara", "Lámpara", [-1.3, 0, -2.0]), P("ventana", "Ventana", [-2.99, 0, 0], 90, { ancho: 160 }),
  ] },
  aula: { label: "Aula", preset: "day", build: () => [
    ...walls(8, 7), P("pizarron", "Pizarrón", [0, 0, -3.42], 0, { ancho: 300 }), P("escritorio", "Escritorio del maestro", [-1.5, 0, -2.4]),
    ...[-2, 0, 2].flatMap(x => [-0.5, 1.0].flatMap(z => [P("mesa", "Pupitre", [x, 0, z], 0, { ancho: 70, fondo: 50, alto: 72 }), P("silla", "Silla", [x, 0, z + 0.45], 180)])),
  ] },
  campo: { label: "Campo abierto", preset: "day", build: () => [P("terreno", "Campo", [0, 0, 0], 0, { tipo: "campo", ancho: 3000, relieve: 120, semilla: 7 }), P("arbol", "Árbol", [4, 0, -6]), P("roca", "Roca", [-2, 0, -3])] },
  bosque: { label: "Bosque", preset: "sunset", build: () => [P("terreno", "Bosque", [0, 0, 0], 0, { tipo: "bosque", ancho: 3000, relieve: 90, semilla: 13 })] },
  abismo: { label: "Precipicio o abismo", preset: "moon", build: () => [P("terreno", "Precipicio", [0, 0, 0], 0, { tipo: "abismo", ancho: 3000, relieve: 150, semilla: 5 })] },
  cueva: { label: "Cueva", preset: "fire", build: () => [P("terreno", "Cueva", [0, 0, 0], 0, { tipo: "cueva", ancho: 1600, relieve: 200, semilla: 9 })] },
  rio: { label: "Orilla de río", preset: "day", build: () => [P("terreno", "Orilla de río", [0, 0, 0], 0, { tipo: "rio", ancho: 3000, relieve: 80, semilla: 4 }), P("roca", "Roca", [1.5, 0, 1.8])] },
};
