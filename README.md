# Arnés

Storyboard 3D para cómic: posar personajes, colocar cámaras y luces, y obtener un semirender (volumen, sombras y valores) para dibujar a lápiz.

## Fase 2 · bloque 1 (movimiento) — publicado

- **Esqueleto de 55 articulaciones**: clavículas que acompañan al brazo, columna de 4 segmentos, cuello de 2, mandíbula, antebrazo con giro visible, 15 articulaciones por mano y dedos del pie.
- **Rotación anatómica**: cada articulación se dobla dentro de un cono y gira sobre su propio hueso, con límites de rangos reales. Deslizadores con nombres claros ("Adelante ↔ atrás", "Palma adentro ↔ afuera") y **anillos** para girar arrastrando en el visor.
- **Cuerpo completo**: puntos para manos, pies, pelvis, pecho, cabeza, codos y rodillas. **Fijar** manos y pies, **anclar** una mano a otro personaje u objeto, **simetría en vivo**, espejo y **apoyar en el piso**.
- **Manos**: 12 poses (abierta, relajada, puño, sujetar, señalar, apoyada, contar, pellizco, sostener lápiz, garra, pistola, vaso) y control dedo por dedo.
- **Rostro**: guías de construcción o rostro detallado, 8 expresiones y expresiones propias.
- **24 poses**: las 12 base más 12 poses de prueba tomadas de "The Elder's Apprentice".
- Los proyectos de la Fase 1 se convierten solos al esqueleto nuevo.

## Fase 1 (completa)

- **Viñetas como cuartos 3D**: cada viñeta guarda su escena, sus luces y su cámara. Se duplica completa para armar la siguiente, y cualquier objeto o luz se puede copiar a las viñetas siguientes.
- **Escena**: grilla de 10 cm y 1 m, primitivas (caja, cilindro, esfera, plano) y 10 objetos de utilería (mesa, silla, lámpara, puerta, pared, ventana, escalera, vaso, baúl, estante). Mover, girar y escalar con el gizmo o con valores en centímetros. Deshacer y rehacer (50 pasos).
- **Maniquí**: altura (140 a 210 cm), proporción (6 a 8.5 cabezas), complexión y forma. 17 articulaciones con límites anatómicos (se pueden relajar). Arrastrar manos, pies y pelvis (cinemática inversa), con opción de fijar los pies. 6 poses de mano, mirada hacia el lector o hacia otro personaje, espejo, copiar y pegar pose, 12 poses base y poses propias. Línea de acción y centro de masa con aviso de equilibrio.
- **Cámara**: lente de 14 a 200 mm, planos (detalle, primer plano, medio, americano, general), ángulos (normal, picado, contrapicado, a ras de piso, holandés), proporción de la viñeta, horizonte, puntos de fuga y vista a través de la cámara.
- **Luz y semirender**: hasta 4 luces (punto, foco, sol, ambiente) con intensidad, temperatura y dureza de sombra; presets "Lámpara noir" y "Luz de día"; modos arcilla y valores (2, 3 o 5 tonos) y contorno.
- **Guardar y exportar**: guardado automático en el dispositivo, archivo de proyecto (`.arnes.json`), PNG por capas (arcilla, valores, contorno; fondo transparente opcional) y **hoja carta para imprimir** con la viñeta a escala en líneas azul claro o gris tenue.

Incluye un proyecto de ejemplo: la viñeta 2 de la página de referencia ("El viejo y el aprendiz") en dos viñetas.

## Cómo usarla

Publícala con GitHub Pages: **Settings → Pages → Branch: `main` / `(root)` → Save**. En unos minutos queda en `https://achautla.github.io/arnes/`. Desde Chrome en Android puedes instalarla con "Agregar a la pantalla de inicio"; después de abrirla una vez funciona sin conexión.

Para probarla en tu computadora sin publicar: `python -m http.server` en esta carpeta y abre `http://localhost:8000`.

## Estructura

- `index.html`, `styles.css`: interfaz (teléfono primero; panel lateral en pantallas de 900 px o más).
- `src/main.js`: escena, viñetas, selección, interacción y paneles.
- `src/mannequin.js`: maniquí segmentado, límites, IK, manos, mirada, centro de masa.
- `src/poses.js`, `src/props.js`, `src/lights.js`: biblioteca de poses, utilería y luces.
- `src/render.js`: semirender (valores, contorno, líneas azules) y exportación a imagen.
- `src/store.js`: proyecto, deshacer y guardado sin conexión. `src/example.js`: proyecto de ejemplo.
- `sw.js`, `manifest.webmanifest`: instalación y uso sin conexión.

Motor 3D: Three.js 0.160.0 (jsDelivr). PDF: jsPDF 2.5.1 (cdnjs).

## Documento del proyecto

Concepto, módulos, fases y especificación de la Fase 1: https://claude.ai/artifact/KpJZYWdoGxxFWh6o1vAJ3e
