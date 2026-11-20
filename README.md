# Arnés

Storyboard 3D para cómic: posar personajes, colocar cámaras y luces, y obtener un semirender (volumen, sombras y valores) para dibujar a lápiz.

## Fase 6 · bloques 2 y 3, y bugs corregidos (20-nov)
- **Objetos propios y accesorios** (Escena → Agregar → Objetos propios): piezas simples (caja, cilindro, cono, esfera, media esfera, cápsula, aro, cuña, tubo, pirámide) con tamaño, posición, giro, color, textura y espejo. 12 de partida (espada, lanza, escudo, pistola, bastón de mago, linterna, barril, maceta, banca, poste, machete, libro). Se guardan en «Mis objetos», viajan con la cuenta y **se sostienen con la mano**: siguen a la muñeca en cualquier pose.
- **Plantas como objetos**: ceiba, roble, pino, palmera, platanera, sauce, mangle con raíces en zancos, árbol seco, arbusto, helecho, flores, pasto, cactus y tronco caído; altura, grosor, follaje y «otra planta de la misma especie».
- **Exteriores**: ciudad, pueblo, carretera, río en pendiente, lago, manglar, selva, desierto y acantilados, con edificios con ventanas, casas con techo de teja, calles, banquetas, agua, cercas y postes con cables. Cada terreno trae su vegetación.
- **Atmósferas** (Luz): niebla, lluvia, polvo, humo, calor, noche de luna, amanecer y tormenta; luz, color de cielo y niebla y partículas en 3D.
- **Criaturas**: placas óseas encimadas como tejas, joroba, patas delanteras con largo y grosor propios; desde tu dibujo se mide también la línea del lomo y el grosor relativo de las patas.
- **Comunidad**: perfil público (usuario, nombre, foto, biografía), galería con filtros, búsqueda y orden, página de cada artista, «me gusta», reportes (3 reportes ocultan hasta revisión), «usar en Arnés» y «mezclar» solo si el autor lo permite (con crédito). «Compartir» en personajes, criaturas, objetos, viñetas, escenarios, páginas y estilos: enlace sin cuenta (#pieza=) o publicación (#pub=). **Requiere correr `data/supabase-social.sql`.**
- **Recuperar la cuenta**: «¿Olvidaste tu contraseña?» manda un correo; el enlace regresa a Arnés y pide la contraseña nueva.
- **Bugs corregidos**: personaje de maniquí guardado salía con cuerpo realista; borrar una viñeta dejaba recuadros de página apuntando a la nada; color de piel desde Escena no cambiaba el cuerpo realista; escalar una criatura no estiraba niebla, cámara ni sombras; la lectura con IA no aplicaba el tipo de cuerpo al cuerpo realista; sin internet se cerraba la sesión; borrar la cuenta dejaba los .glb en la nube; la copa de un árbol aplastaba (por contacto) a quien estuviera debajo; un árbol sin copa generaba geometría inválida; el gizmo quedaba pegado a la luz vieja tras cambiar la atmósfera.

## Fase 6 · bloques 0 y 1 (19-nov)
- **Servicios de IA** (Luz → Servicios de IA): Gemini, OpenRouter, OpenAI, Groq, Mistral, xAI, Anthropic (solo leer) y cualquier servicio compatible con OpenAI. Cada ficha trae el enlace para sacar la clave, modelos para leer y para dibujar, «Probar», y el orden de respaldo: si uno falla o se queda sin cuota, Arnés prueba el siguiente. Las claves viven solo en el dispositivo. Todo lo de IA conserva su camino sin IA.
- **Estilos aprendidos editables**: cada parámetro se ajusta a mano, se duplica (versiones) y se mezcla con otro estilo.
- **Criaturas** (Escena → + Criatura): 9 plantillas (reptil, cuadrúpedo, ave, serpiente, pez, insectoide, arácnido, bípedo no humano, colosal) con esqueleto propio y piel continua con pesos. Proporciones por deslizador, 0–4 pares de patas, erguida, alas, aletas; piel lisa, rugosa, escamas, pelaje, plumas o quitina; coraza en bandas, escudos o placas; pliegues, púas, cuernos, dientes, cejas óseas, masa de hombros. Poses rápidas y giro por articulación; la boca se abre.
- **Criatura desde tu dibujo**: vista de lado (y opcional de frente) → silueta separada del papel y de los renglones, perfil de grosor, cola, cabeza, patas y ancho; propone plantilla y proporciones. Es una propuesta para afinar, no una copia.
- **Escala colosal**: niebla, piso, sombras y cámara se estiran con el tamaño de lo que hay en la viñeta; lente desde 8 mm.

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

## Modelos .glb importados (19-nov)

- Conservan sus colores y texturas; «Arcilla» es una opción por objeto («Aspecto del modelo»).
- Hasta 50 MB. El archivo se guarda aparte (IndexedDB del dispositivo y, con cuenta, en Storage `modelos/<usuario>/<huella>.glb`); el proyecto solo guarda `glb:<huella>`.
- Proyectos viejos con el .glb incrustado se migran solos al abrirlos. «Guardar proyecto» en archivo vuelve a incrustar los modelos para que el archivo abra en cualquier lado.
- Soporta Draco y Meshopt.
- Viñetas nuevas (y las creadas desde una foto de página) nacen con luz de día; las viñetas sin luces reciben una luz de cortesía en vez de verse negras.

## Entrega definitiva de la Fase 5 (19-nov): cuerpo realista, manos, Taller y estilo aprendido

- **Cuerpo realista (A):** malla humana de una pieza (MakeHuman, CC0) con 14,500 vértices y 53 huesos, manejada por el esqueleto del maniquí: las poses, la cinemática inversa, los pines y las expresiones de siempre la mueven. Edad (11 a 90 años), sexo, músculo, peso, estatura, 98 controles de cuerpo y rostro, y 34 unidades de expresión (cejas, párpados, boca). Los personajes nuevos nacen con cuerpo realista; el maniquí de madera sigue disponible.
- **Manos (B):** dedos reales con tres falanges, nudillos y uñas de la malla; las poses de mano de la biblioteca se aplican igual. Nueva pose «Pulgar arriba».
- **Taller de personajes:** pestaña propia, con fichas enlazadas entre viñetas (opción «solo en esta viñeta»). Secciones: Personajes, Cuerpo, Rostro, Extremidades, Manos, Piel, Cabello, Vestuario y Ficha.
  - Extremidades: amputaciones con muñón redondeado (mano, antebrazo, codo, brazo, hombro; pie, bajo y sobre la rodilla, cadera), prótesis (gancho, brazo mecánico, pata de palo, lámina deportiva, prótesis moderna), ojos cerrados, con parche o de vidrio, bastón y muleta.
  - Piel: tonos, pecas, manchas de la edad, lunares, cicatrices, quemaduras, tatuajes, ojeras, barba de tres días, barba, candado y bigote.
  - Cabello: 12 peinados que nacen del cuero cabelludo, canas y entradas.
  - Vestuario: camisa, pantalón, saco, gabardina, vestido, falda, rebozo y capa como capas que siguen el cuerpo, más calzado, guantes y el catálogo de accesorios.
  - Presets editables: seis cuerpos de partida, las variantes del aprendiz (joven; mayor con entradas y parche; mayor con ojo de vidrio) y los seis personajes de prueba.
- **Estilo aprendido (C):** sube de 1 a 6 dibujos de un artista y Arnés mide su tinta, papel, grosor, rayado, negros y contorno. Con eso redibuja la viñeta: contornos vectorizados con su temblor y rayado con su ritmo, o grabado con su contorno encima si el artista pinta el tono. Sin IA, en el teléfono.
- **Modelos .glb:** conservan sus texturas, pesan hasta 50 MB y viven fuera del proyecto.

### Pendiente
- Ropa con pliegues de tela real (hoy las capas siguen el cuerpo, sin arrugas) y mangas vacías en un brazo amputado.
- Pinceles para esculpir con el dedo y lados izquierdo/derecho por separado.
- Nariz rota u otras asimetrías del rostro (falta empaquetar las deformaciones asimétricas).
- Al cambiar un personaje sentado por uno de otra estatura, la pose puede necesitar un reajuste.
- El bucket «modelos» de Supabase para llevar los .glb a otros dispositivos (requiere tu aprobación).

## Cierre de pendientes de la Fase 5 (19-nov, noche)

- **Ropa:** cuellos parejos (redondo, V, camisa, alto, abierto), pliegues que dependen de la pose (codos, rodillas, cintura, regazo y axilas) y caída cerca de los dobladillos. Faldas y abrigos con pliegues verticales.
- **Brazo amputado:** la manga puede quedar vacía, doblada y prendida con un alfiler, o recortada (con prótesis, recortada por defecto).
- **Cabello y vello:** mechones de cinta que salen del cuero cabelludo siguiendo el remolino; barba con pelo. El generador `strands()` sirve también para el pelaje de las criaturas.
- **Esculpir con el dedo** (Taller → Esculpir): inflar, desinflar, alisar, pellizcar y arrastrar, con simetría. Se guarda en la ficha como diferencias comprimidas.
- **Lados por separado y asimetrías:** brazos, piernas, ojos, orejas y mejillas con control izquierdo y derecho; 23 asimetrías del rostro (nariz torcida incluida).
- **Cambiar de cuerpo sentado:** conserva la altura del asiento y la posición de los pies; de pie, los pies en el piso.
- **Estilo aprendido:** ojos, cejas, cabello y barba oscuros se rellenan con trazo corto que sigue su forma.
- **Modelos .glb:** se comprimen en el teléfono (texturas WebP, geometría Meshopt): el tiburón pasa de 4.9 a 0.5 MB y el ratón de 24.5 a 3.4 MB. Se aceptan hasta 200 MB antes de comprimir. Para llevarlos a otros dispositivos: `data/supabase-modelos.sql`.
