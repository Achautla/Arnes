# Arnés

Storyboard 3D para cómic: posar personajes, colocar cámaras y luces, y obtener un semirender (volumen, sombras y valores) para dibujar a lápiz.

## Fase 5 · cierre (19-nov)

- **Rostro realista:** cabeza esculpida de una sola superficie (cuencas, pómulos, nariz, labios, mentón y mandíbula) con siete rasgos ajustables, incluida la edad.
- **Calcar la pose sobre el dibujo, sin IA:** el dibujo de la viñeta se pone encima del visor y arrastras los puntos del esqueleto; la cadera mueve al personaje y manos y pies van a sus puntos.
- **Al armar una escena** los personajes ya no quedan dentro de los muebles, y salen con rostro realista.
- **Piel con cuello:** el tronco se une con la cabeza sin anillo.
- Corregido un paréntesis que desde el 18-nov por la noche impedía cargar la app.

### Pendiente antes de la Fase 6

- Manos con detalle (nudillos, uñas) y piel continua en manos, pies y cabeza.
- Músculos visibles en el cuerpo heroico.
- Hombros: se nota el corte entre el tronco y la manga de la piel.
- Rostro realista: todavía se ve modelado, no fotográfico; falta textura de piel en la cara.
- Probar con Gemini real (lectura de página, de viñeta y acabado). Las imágenes no tienen cuota gratis.
- En el video, interpolar también las luces.

## Fase 5 · entregas 2 a 9 (18-nov)

- **Viñeta a escena** (Escena → «Desde tu dibujo»): Gemini lee el dibujo de la viñeta y devuelve plano, ángulo, lente, escenario, luz, efecto, personajes (pose, cuerpo, piel, ropa, expresión, giro, posición) y objetos del catálogo. Pantalla de revisión; luego se arma la escena.
- **Pose fina desde el dibujo:** los puntos del esqueleto que marca Gemini llevan muñecas y tobillos a su lugar con cinemática inversa; se descarta un brazo si queda detrás de la espalda.
- **Cuerpo continuo con piel:** una piel ceñida de una sola pieza (tronco, brazos y piernas) sobre el esqueleto, con seis tonos. **Tipos de cuerpo:** niño, joven, adulto, mujer, persona mayor (con postura) y heroico.
- **Ropa con textura:** algodón, mezclilla, lana, cuero y seda.
- **Contacto con volumen:** la piel y la tela abultan alrededor de donde se aplastan.
- **Tus trazos:** de una foto con trazos sueltos se recortan los trazos uno por uno y el render de trazos los usa.
- **Hojas de modelo por personaje:** se mandan al acabado con IA para mantener al personaje igual en todas las viñetas.

## Fase 5 · entrega 1 y cierre de pendientes de la Fase 4 (18-nov)

- **Página desde una foto** (pestaña Página): encuentra las viñetas aunque estén inclinadas (inunda el papel desde la orilla y lo encerrado son las viñetas), las ordena para lectura occidental o manga, elige el formato de papel y crea una viñeta vacía por recuadro con su proporción. Con clave de Gemini corrige los casos difíciles y describe cada viñeta.
- **Impresión a 600 ppp** por mosaicos, sin costuras, y **sangrado de 3 mm** con marcas de corte.
- **Globos con estilos** (limpio, entintado a mano, noir, manga) y **onomatopeyas** con letra, color y giro.
- **Video** entre viñetas: cámara, posiciones y poses interpoladas, 15 a 90 s, 16:9, 9:16, 1:1 o 4:5, 1080p o 720p, MP4 (WebCodecs + mp4-muxer, MIT, incluido en `src/vendor`) con respaldo WebM.

## Fase 4 · render final (18-nov)

- **Render de trazos:** la viñeta se dibuja con trazos sueltos de plumilla (decenas de miles), que siguen el flujo de la forma, se afinan en las puntas, cambian de presión y se cruzan en la sombra. Render final a 1800 px.
- **Acabado con IA:** el render y una página del artista se envían a un modelo de imagen de Gemini (por defecto `gemini-3.1-flash-image`) con la clave del artista, para redibujar la viñeta en su estilo conservando composición, poses y luz.
- **Piel:** los personajes pueden pasar de madera a piel, con seis tonos, brillo suave y poro fino.

## Fase 4 · detalles de render y pintura (18-nov)

- **Texturas de superficie** por objeto: madera, ladrillo, follaje, piedra, tela y metal gastado. Los estilos de artista las entintan como juntas, vetas, hojas y grietas (control «Detalle de texturas»).
- **Humo o vapor** como objeto: volutas que miran a la cámara, claras u oscuras, sin contorno.
- **Lluvia** como efecto de viñeta, con viento.
- **Pintura:** tercer estilo de artista para ilustración a color con atmósfera (sombras y luces teñidas, valores en manchas, textura de pincel). La calibración lo elige para imágenes pintadas; el grabado ya no acepta papel oscuro.

## Fase 4 · bloque 2 y calibración (18-nov)

- **Efectos de viñeta** (pestaña Cámara): líneas de velocidad con dirección, líneas de enfoque, marco de impacto en negro y blanco, con centro e intensidad ajustables.
- **Ojo de pez** y lente hasta 8 mm para escorzos extremos.
- **Calibrar desde una página tuya** (pestaña Luz): lectura local del papel, la tinta, la mancha de negro y el rayado; con clave de Gemini (opcional, guardada solo en el dispositivo) la lectura se afina y describe el trazo. El resultado queda guardado como estilo propio.

## Fase 4 · primera entrega: estilos de artista (18-nov)

- **Grabado sepia · Brayand:** sale de las páginas de *The Elder's Apprentice*. Papel envejecido con grano y viñeteado, plumilla con rayado cruzado que se curva con la forma, negros sólidos y línea que engorda en la sombra.
- **Color dinámico:** sale de los reels de viñeta animada. Color plano saturado, manchas de negro, luz de contorno y cielo de estallido con dos colores.
- **Mis estilos:** guarda los parámetros de la viñeta como estilo propio. Cada perfil tiene varios y viajan con la cuenta.
- **Entrar con Facebook** en la pantalla de inicio (requiere el proveedor activo en Supabase).

## Fase 3 · entrega 9 y contactos (18-nov)

- **Biblioteca de poses:** 85 poses en 10 categorías (de pie, moverse, sentado, suelo, acción, combate, interacción, gestos, con objetos, páginas), con filtro por categoría.
- **Práctica cronometrada:** poses al azar de la categoría elegida, ángulo de cámara aleatorio, tiempo por pose (30 s a 5 min) y botón "Quedarme con esta pose".
- **Contactos y deformación:** la tela (faldas, capas, cabello) ya no atraviesa muebles, objetos ni otras figuras; la ropa ajustada se empuja fuera de los objetos; la piel se aplana contra asientos, suelo y otros cuerpos. La tela también choca consigo misma.
- Límites conocidos: el aplanado no conserva volumen (no abulta alrededor del contacto) y los objetos se aproximan con cajas.

## Fase 3 · bloque 2, entregas 5 a 8 (18-nov)

- **Tela sobre tela**: las telas sueltas chocan con las de capas de abajo (capa sobre gabardina) y las capas de encima respetan el grosor de lo que llevan debajo.
- **Accesorios y joyería** (29 piezas en 9 zonas): sombreros, lentes, aretes, cadenas, dijes, gargantilla, bufanda, corbata, moño, reloj, pulseras de cuero e hilo, brazalete, pulso, anillos, solitario, sello, guantes, zapatos, botas, tenis y cinturón; con color, material, lado, dedo y tamaño. Catálogo de datos (`src/accessories.js`) listo para editarse en la Fase 6.
- **Cabello**: rapado, corto, rizado, afro, chongo, cola, trenza, largo, melena y mechón; color, volumen y largo; el pelo largo, la cola y la trenza se simulan y responden al viento.
- **A medida**: abierta al frente, solapas, botones, puños y bastilla.
- **Personajes guardados**: cuerpo, rostro, cabello, ropa y accesorios; viajan con la cuenta.

## Cierre de Fase 2 (18-nov)

- **Notas de luz** (Luz → Semirender): zona iluminada, terminador, sombra propia, sombra proyectada, luz reflejada y sin luz directa, calculadas con la luz principal.
- **Enlace de solo lectura** (Exportar → Compartir para ver): el proyecto va comprimido dentro del enlace (`#ver=`), sin servidor. Quien lo abre puede ver, girar la cámara y guardar una copia.
- Pendiente: la nube, en cuanto haya una organización propia de Supabase conectada.

## Fase 3 · bloque 1 (ropa y pliegues) — publicado

- **Ropa** (Escena → personaje → Ropa): camisa, pantalón, saco, gabardina, vestido, falda y capa; vestuarios rápidos (detective noir, traje, casual, vestido, capa).
- Cada prenda: color, tela (rígida, media, suelta), holgura, largo, manga, cuello (normal, alzado, sin cuello), cinturón y orden de capas. «Copiar ropa a los demás personajes».
- Las partes ceñidas siguen a los huesos; faldones, faldas, vestidos y capas se simulan como tela con choque contra el cuerpo y el piso. La tela se acomoda sola al soltar la pose.
- **Pliegues**: crestas donde la tela se comprime y en el lado de adentro de codos, rodillas, ingle y cintura; pliegues de caída en la tela colgada.
- **Mapa de la tela** (azul comprime, rojo estira) y **tipos de pliegue** (tubo, zigzag, espiral, medio cierre, caída, inerte) en Escena → Visor.
- **Viento** (Luz → Fondo y atmósfera) para capas y faldones. **Calidad de la tela** baja, media o alta (en teléfono arranca en media).
- El maniquí se oculta bajo la ropa para que ninguna articulación asome.

## Fase 2 · bloque 2 (página, estilos, escenarios y nube) — publicado

- **Inicio**: entrar a la nube (cuando se active) → mis proyectos (nuevo, ejemplo, renombrar, duplicar, borrar) → área de diseño. El botón «Proyectos» de la cabecera vuelve a la lista.
- **Página** (5.ª pestaña): formatos cómic americano, carta, A4 y manga B5; 8 distribuciones (incluida «Como tus páginas»); margen, calle e inclinación; vértices editables para viñetas libres o inclinadas; insertos; plantillas propias; semirender en vivo dentro de cada recuadro; globos (diálogo, pensamiento, grito, caja de texto).
- **Composición**: tercios, recorrido de lectura numerado, aviso de salto de eje entre viñetas seguidas, holandés libre de −45° a 45° (deslizador o giro con dos dedos), consejos por plano y ángulo.
- **Estilos**: arcilla, color (por objeto), valores, noir, manga (trama de puntos), cel; con o sin contorno.
- **Luz**: 9 presets (lámpara noir, día, atardecer, luna, neón, fogata, contraluz, desde abajo, persiana), color propio por luz, gobos en focos (persiana, ventana, rejas, hojas), niebla o humo.
- **Escenarios**: 18 (sótano, oficina, callejón, calle, bar, recámara, porche, sala de juntas, biblioteca, obra, cocina, sala, aula, campo, bosque, abismo, cueva, río), 21 piezas de utilería nuevas sacadas de tus páginas, terreno irregular con relieve, importar modelos .glb, capa de formas básicas.
- **Exportar**: página en PNG/PDF a 150 o 300 ppp en cualquier estilo (o líneas azules); viñeta en PNG en cualquier estilo; PSD por capas (ag-psd 34.1.0); modelo GLB y OBJ.
- **Nube**: código listo (`src/cloud.js`, `supabase/schema.sql` con RLS). Se activa pegando la URL y la clave publicable en `src/cloud-config.js`.

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
- `src/poses.js`, `src/props.js`, `src/props2.js`, `src/lights.js`: biblioteca de poses, utilería, terreno, luces, presets y gobos.
- `src/scenarios.js`: escenarios armados. `src/scenes.js`: escenas fuera del visor (miniaturas de página y exportación).
- `src/share.js`: enlace de solo lectura comprimido.
- `src/accessories.js`: catálogo de accesorios y joyería.
- `src/cloth.js`: ropa, simulación de tela, pliegues y clasificación de pliegues.
- `src/page.js`: editor de página. `src/home.js`: inicio y mis proyectos. `src/cloud.js`, `src/cloud-config.js`: nube (Supabase por REST).
- `src/render.js`: semirender (valores, contorno, líneas azules) y exportación a imagen.
- `src/store.js`: proyecto, deshacer y guardado sin conexión. `src/example.js`: proyecto de ejemplo.
- `sw.js`, `manifest.webmanifest`: instalación y uso sin conexión.

Motor 3D: Three.js 0.160.0 (jsDelivr). PDF: jsPDF 2.5.1 (cdnjs). PSD: ag-psd 34.1.0 (jsDelivr).

### Nube (activa)
Proyecto de Supabase «Arnes» (`nokiuqisqrbvdxdotkkk`): tablas `projects` y `profiles` con RLS (cada cuenta solo ve lo suyo). Funciona en GitHub Pages; dentro de claude.ai la app sigue guardando solo en el dispositivo. Cuentas con correo y contraseña; las expresiones y poses guardadas viajan con la cuenta.

## Documento del proyecto

Concepto, módulos, fases y especificación de la Fase 1: https://claude.ai/artifact/KpJZYWdoGxxFWh6o1vAJ3e
