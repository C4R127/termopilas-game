# 300: El Paso de las Termópilas

**Jugar en línea:** https://c4r127.github.io/termopilas-game/

Juego web de defensa táctica en 2D con pixel art, inspirado en la batalla de las Termópilas (480 a. C.). Diriges la falange con órdenes de voz, con el teclado o con los botones. Está hecho con HTML5, CSS3, JavaScript (ES Modules), Phaser 3.90 y la Web Speech API.

Esta es la **versión final** del documento *Termopilas_Documentacion_Fases_Beta_Final.docx* (sección 10.4). Parte del Avance 1 (beta), que ya fue aprobado.

## Arrancar

Requiere Node.js 20.19+ (o 22.12+).

```bash
npm install
npm run dev        # http://localhost:5195/termopilas-game/
npm run build      # versión de producción en dist/
npm run deploy     # publica dist/ en la rama gh-pages (GitHub Pages)
```

Juega desde el servidor de desarrollo, no abriendo `index.html` directamente. Para usar la voz, usa Chrome o Edge.

## Qué incluye la versión final

| Área | Contenido |
|---|---|
| Campaña | Cinco oleadas con dificultad creciente y pausas de recuperación (Exploración, Presión combinada, Presión creciente, Guardia de élite y Última línea) y un enfrentamiento final con Jerjes I. |
| Jefe final: Jerjes I | Fiel a Heródoto, Jerjes no combate en persona: dirige el asalto desde su trono al fondo del paso. Lanza **decretos** con aviso previo, cada uno con una respuesta distinta: «Que las flechas oculten el sol» (tormenta de 3–4 descargas seguidas: hay que sostener los escudos y empujar entre descarga y descarga a quien lleve mucho tiempo trabado), «Látigos de los capitanes» (la infantería se enfurece, más rápida y peligrosa, y solo el empuje la calma) y «Carga de la guardia real» (2–3 guardias de élite a la vez). Su **determinación** (80) baja al resistir decretos, empujar enfurecidos y abatir tropas, y sube con cada brecha. Al cruzar dos umbrales se levanta del trono y los decretos se endurecen y se combinan; a cero, ordena la retirada. Antes del enfrentamiento la falange recupera 50 de cohesión y toda la resistencia. |
| Dificultad | Fácil, Normal y Difícil, elegibles en el menú y en Ajustes. Cambian la vida y el golpe de los enemigos, el daño de las flechas, el tiempo de aviso, la determinación de Jerjes, la cohesión recuperada entre oleadas y la puntuación (×0,75, ×1 y ×1,5). |
| Escenario histórico: la senda de Anopea | Día 3: Efialtes guía a los persas por el sendero de la montaña y la falange queda rodeada. Cuatro oleadas llegan por el paso y por la retaguardia (los de la senda entran por la izquierda). La orden **Media vuelta** gira la formación; el lado al que no se mira golpea un 30 % más fuerte y la falange solo ataca y empuja hacia donde mira. Por la senda no cae nadie al mar. Tiene su propia entrada en el menú, mensajes de Leónidas, resultado y nota histórica, y no termina con Jerjes. |
| Móvil y tableta | En horizontal, las órdenes pasan a una columna a la derecha y la barra superior se reduce a una línea, así el campo de batalla ocupa casi toda la pantalla (560 × 315 en un móvil de 812 × 375, frente a 160 × 90 antes). En vertical, botones grandes en dos columnas y una sugerencia para girar el dispositivo. Al empezar desde una pantalla táctil, el juego pasa a pantalla completa y fija la orientación horizontal si el navegador lo permite. Hay un botón de pantalla completa, los atajos de teclado se ocultan con el dedo, no hay zoom por doble toque y se respetan las muescas. Vibraciones breves al tocar una orden, al encajar flechas y con cada brecha (se desactivan con «Reducir destellos y partículas»). |
| Iluminación | Amanecer, mediodía, atardecer y noche. En automático, el día avanza con la batalla: la campaña va del amanecer a la noche, en la que llega Jerjes, y en la senda de Anopea los persas bajan de noche y atacan con el día. De noche hay estrellas, luna, antorchas en el muro de los focenses y hogueras en el campamento persa. En Ajustes se puede fijar una luz. |
| Identificación por voz | Al empezar a jugar con la voz, el juego estima el tono de quien da las órdenes (frecuencia fundamental, con Web Audio y en el momento) y Leónidas pasa a tratarle de «aliada» (voz aguda) o «aliado» (voz grave). Si el tono queda en la franja intermedia, o si se juega sin voz, usa «estratega». Decide tras dos órdenes y unos 1,5 s de voz, lo anuncia en el HUD y deja de escuchar el tono. No se graba ni se guarda audio, ni el resultado. En Ajustes se puede fijar el trato, y entonces no se analiza nada. |
| Enemigos | Cuatro patrones: infantería, arqueros, guardia de élite (arquetipo jugable inspirado en los «Inmortales») y grupos mixtos. |
| Órdenes | Escudos (anulan las flechas), Lanzas, Empujen (retroceso; al mar junto al acantilado; desequilibra a la élite) y Relevo, con enfriamientos y una orden en espera durante las transiciones. En la senda de Anopea, además, Media vuelta. |
| Tutorial | Nueve pasos guiados por Leónidas con situaciones preparadas: una para cada orden, otra para la guardia de élite y otra para la voz. Es de texto y no se puede perder; las instrucciones habladas son opcionales (botón 🔊 o Ajustes). |
| Leónidas | Figura de mando en la introducción, el tutorial y la campaña. Da un parte al empezar, la orden de cada oleada y una valoración al superarla, avisa una vez por oleada si la cohesión cae, si hay brecha o si la línea se agota, y despide la campaña. Sus mensajes aparecen en un panel con su retrato y se pueden leer en voz alta. |
| Arte | Escenario por capas (cielo con nubes, Eubea y el golfo, ladera del Calídromo, el paso y mar animado). Hoplitas con reposo, defensa, ataque, empuje, cansancio, relevo, derrota, victoria y retirada fuera de pantalla (en el relevo, la primera línea cansada sale por la izquierda y entra un hoplita de refresco; en la derrota se retira la reserva). Infantería, arqueros y guardia de élite persas; retrato de Leónidas e iconos. Logotipo pixel en el menú («300» con dos escudos espartanos como ceros, lanzas cruzadas y cinta con «TERMÓPILAS»). Combate animado: la segunda fila también clava las lanzas, chispas en el cuerpo a cuerpo, el enemigo recula al recibir un golpe y cae despedido al morir, onda del empuje, sacudida al caer un guardia real y vítores al superar cada oleada. |
| Audio | Música original sintetizada: tema de menú, tema de batalla que gana capas con la intensidad y remates de victoria y derrota. Efectos para cada evento importante. Hay volúmenes de general, música y efectos, además de un botón de silencio. |
| Ajustes | Sonido, accesibilidad, teclas reasignables, voz (idioma, precisión exigida y «Probar micrófono»), dificultad e iluminación. Se guardan en el navegador. |
| Accesibilidad | Todo se juega sin voz. También incluye reducir destellos y partículas, alto contraste, texto más grande, texto normal en lugar de la fuente pixel (todo el texto usa Pixelify Sans por defecto), avisos de flechas más largos y lectura en voz alta de los mensajes. Los estados no dependen solo del color (icono, texto y animación), y los menús y el HUD son HTML accesibles con teclado. |
| Resultado | Puntuación, oleadas, tiempo, bajas por tipo, caídos al mar, flechas bloqueadas, órdenes por voz, teclado y botón, porcentaje de frases de voz entendidas y una tabla por oleada. |
| Historia | Epílogo con una línea temporal (de Maratón a Platea), la distinción entre lo documentado y lo simulado, y las fuentes. |

## Cómo se juega

| Orden | Voz | Tecla* | Efecto |
|---|---|---|---|
| Escudos | «escudos», «escudo», «falange» | 1 | Bloquea el 100 % de las lluvias de flechas y reduce a la mitad la presión cuerpo a cuerpo. No ataca. |
| Lanzas | «lanzas», «lanza», «ataquen» | 2 | Ataca al enemigo más adelantado de cada fila. Las flechas sí hacen daño. Gasta resistencia. |
| Empujen | «empujen», «empujad», «empujar», «empuja» | 3 | Retroceso de los enemigos cercanos. Los de la fila del acantilado caen al mar; la guardia de élite queda desequilibrada (vulnerable a las lanzas). Enfriamiento de 6 s. |
| Relevo | «relevo», «relevos», «cambio», «fuego»** | 4 | La reserva sustituye a la primera línea y recupera 45 de resistencia. Enfriamiento de 10 s. |
| Media vuelta (solo en la senda de Anopea) | «media vuelta», «retaguardia», «girar» | 5 | La falange encara el otro lado del paso. Durante el giro (0,6 s) no acepta otra orden; la siguiente queda en espera. |
| Pausa / Continuar | «pausa», «pausar» · «continuar», «reanudar», «seguir» | P / Esc | Congela la partida. En pausa no se aceptan órdenes tácticas. |
| Micrófono | — | V | Activa o desactiva la escucha. |
| Sonido | — | M | Silencia o activa el sonido. |

\* Teclas por defecto; se pueden cambiar en **Ajustes**. Esc siempre pausa o cierra.
\*\* «fuego» es solo un alias de juego para el relevo, no una orden de armas de fuego.

- **Cohesión**: es la vida de la línea. Si llega a 0, pierdes. Se recuperan 20 puntos al superar cada oleada.
- **Resistencia**: la gastan las lanzas y el empuje. Si llega a 0, la formación queda agotada y solo acepta las órdenes Escudos y Relevo.
- **Moral**: con moral alta las lanzas hacen más daño.
- **Brechas**: un enemigo trabado 7 s sin caer atraviesa la línea. Con 4 brechas, pierdes.
- **Lluvias de flechas**: antes de cada descarga hay un aviso con cuenta atrás en la banda superior, sobre los arqueros y sobre la falange.

## Voz

- El idioma es `es-PE`, y en Ajustes se puede cambiar a `es-ES` o `es-MX`. Solo se usan resultados finales del reconocedor, de una **lista cerrada de alias** sin parecidos entre órdenes distintas.
- Si una frase contiene dos órdenes, se considera ambigua y no se ejecuta nada.
- La **precisión exigida** (alta, normal o baja) fija la confianza mínima: 0,6, 0,45 o 0,25.
- La misma orden dicha por voz no se repite antes de 1,2 s.
- Ninguna orden va directa a los gráficos: todas pasan por `CommandController`.
- El permiso del micrófono se pide solo tras una acción explícita.
  - La escucha real ocurre durante la batalla o la prueba de Ajustes, y se detiene al salir.
  - Durante la pausa sigue escuchando para aceptar «continuar».
- **Tono de voz**: `PitchSensor` abre el micrófono con Web Audio solo durante la batalla, con la voz activa y el trato en automático. Estima la frecuencia fundamental cada 50 ms por autocorrelación y solo cuenta los fragmentos de los 3 s anteriores a una frase que el reconocedor acaba de oír, para que la música o la narración no cuenten. Con la mediana: menos de 155 Hz → «aliado», más de 175 Hz → «aliada», entre medias → «estratega». El tono no siempre coincide con cómo se identifica cada persona, por eso existe la franja neutra y el ajuste manual.
- **Lectura en voz alta** (opcional): usa la síntesis de voz del navegador. Mientras Leónidas habla, y durante un margen breve después, lo que oye el micrófono se ignora para que la narración no se convierta en órdenes.
- No se graba ni se guarda audio, y no hay backend. Si no hay API, se deniega el permiso o falla la red, el HUD lo explica y el teclado y los botones siguen funcionando.

## Estructura

```
src/
├─ main.js                 entrada: Phaser, teclas (según ajustes), botones y escalado del lienzo
├─ app.js                  composición: estado, bus, ajustes, voz, audio, vistas y navegación
├─ config/                 balance.js (valores de diseño), gameConfig.js (Phaser), lighting.js (luces)
├─ scenes/                 Boot, Preload, Menu, Tutorial, Battle, Anopaea, HUD (paralela) y Result
│                          + backdrop (capas) y lighting (variantes de luz)
├─ entities/               Formation (reglas), FormationView, EnemyUnit, EventMarker, XerxesView
├─ systems/                BattleSimulation, CommandController, WaveManager, GameState, TutorialDirector,
│                          CommanderMessages, BossDirector (Jerjes), PlayerProfile, PitchSensor (tono), SettingsStore,
│                          VoiceCommandManager, Narrator, AudioManager y EventBus
├─ data/                   commands.js (órdenes), waves.js (oleadas), anopaea.js (escenario), boss.js (Jerjes),
│                          leonidas.js (mensajes)
├─ ui/                     HudView, Screens (menú, ajustes, pausa, resultado, epílogo), TutorialView y CommanderView
└─ styles/main.css
public/assets/             pixel art generado (capas, personajes, efectos, iconos, retrato y fuente)
```

### Decisiones técnicas

- **Reglas independientes de Phaser.** `BattleSimulation` usa un paso fijo de 1/60 s y es determinista, así que la campaña y el tutorial se juegan enteros en Node. Las escenas solo dibujan.
- **Uso de Phaser.** Phaser se encarga de las escenas, las animaciones, los tweens, las partículas y de Arcade Physics para las flechas (tiro parabólico, reutilizadas desde una reserva) y para los enemigos que caen al mar. El retroceso del empuje se calcula en la simulación para poder probarlo y para que no dependa de la tasa de fotogramas.
- **Jefe final.** `BossDirector` (sin Phaser) se activa al cerrar la quinta oleada dentro de `BattleSimulation`: anuncia decretos, envía refuerzos, lleva la determinación y las fases, y al llegar a cero llama a la retirada. La simulación añade las tormentas de flechas, el enfurecimiento y la retirada; `XerxesView` solo los dibuja.
- **Dos frentes.** Cada enemigo tiene un lado (`front` o `rear`). La simulación trabaja con una «coordenada de aproximación» (la x en el frente y su reflejo respecto a `LANE.rearMirror` en la retaguardia), así el movimiento, las lanzas, el contacto y el empuje usan las mismas reglas en los dos lados. `AnopaeaScene` solo cambia la simulación de `BattleScene`.
- **Iluminación.** Una matriz de color sobre la cámara principal (post-FX de WebGL) da el color de cada momento del día, con transiciones suaves. Las antorchas y hogueras se dibujan en una segunda cámara sin corrección, para que la noche no las vuelva azules. Con el renderizador Canvas el juego funciona igual, sin la corrección de color.
- **Tutorial.** `TutorialScene` reutiliza `BattleScene` con una simulación sin oleadas en la que la línea nunca cede del todo. `TutorialDirector` prepara cada paso y comprueba el objetivo.
- **Ajustes.** `SettingsStore` guarda las preferencias en `localStorage`, descarta datos corruptos y funciona en memoria si el almacenamiento está bloqueado. Al reasignar una tecla ocupada, las dos acciones intercambian sus teclas.
- **HUD y menús en HTML.** El lienzo usa una resolución lógica de 320 × 180 sin suavizado, con zoom entero cuando cabe y siempre en 16:9. El diseño táctil se resuelve con CSS (orientación y tamaño de pantalla), sin una versión aparte.

## Pruebas

El repositorio contiene solo lo necesario para ejecutar el juego. Las pruebas automáticas, la simulación de balance, el generador de pixel art y la documentación de pruebas de aceptación se mantienen fuera del repositorio.

**Pendiente de comprobar:** la voz se probó con un reconocedor simulado. Falta jugar una partida completa con micrófono real en Chrome o Edge.

## Aviso histórico y de recursos

Es una interpretación lúdica: la batalla real terminó en victoria persa y junto a los espartanos lucharon miles de aliados griegos. Jerjes no combatió en persona y sus «decretos» son mecánicas inventadas; la frase de luchar a la sombra se atribuye al espartano Diéneces. El epílogo lo explica. Todos los sprites, iconos, la fuente pixel y la música se generan por código en este repositorio. No se usa material de la película *300*.
