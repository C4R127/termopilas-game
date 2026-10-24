# 300: El Paso de las Termópilas

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
| Identificación por voz | Antes de la primera batalla, Leónidas pregunta cómo dirigirse a quien juega: se responde con la voz («mujer», «hombre» o «prefiero no decirlo») o con botones. El juego entiende la palabra; no deduce nada del sonido de la voz. A partir de ahí Leónidas trata al jugador de «aliada», «aliado» o «estratega». Se guarda solo en el navegador y se cambia en Ajustes. |
| Enemigos | Cuatro patrones: infantería, arqueros, guardia de élite (arquetipo jugable inspirado en los «Inmortales») y grupos mixtos. |
| Órdenes | Escudos (anulan las flechas), Lanzas, Empujen (retroceso; al mar junto al acantilado; desequilibra a la élite) y Relevo, con enfriamientos y una orden en espera durante las transiciones. |
| Tutorial | Nueve pasos guiados por Leónidas con situaciones preparadas: una para cada orden, otra para la guardia de élite y otra para la voz. Es de texto y no se puede perder; las instrucciones habladas son opcionales (botón 🔊 o Ajustes). |
| Leónidas | Figura de mando en la introducción, el tutorial y la campaña. Da un parte al empezar, la orden de cada oleada y una valoración al superarla, avisa una vez por oleada si la cohesión cae, si hay brecha o si la línea se agota, y despide la campaña. Sus mensajes aparecen en un panel con su retrato y se pueden leer en voz alta. |
| Arte | Escenario por capas (cielo con nubes, Eubea y el golfo, ladera del Calídromo, el paso y mar animado). Hoplitas con reposo, defensa, ataque, empuje, cansancio, relevo, derrota, victoria y retirada fuera de pantalla (en el relevo, la primera línea cansada sale por la izquierda y entra un hoplita de refresco; en la derrota se retira la reserva). Infantería, arqueros y guardia de élite persas; retrato de Leónidas e iconos. |
| Audio | Música original sintetizada: tema de menú, tema de batalla que gana capas con la intensidad y remates de victoria y derrota. Efectos para cada evento importante. Hay volúmenes de general, música y efectos, además de un botón de silencio. |
| Ajustes | Sonido, accesibilidad, teclas reasignables y voz (idioma, precisión exigida y «Probar micrófono»). Se guardan en el navegador. |
| Accesibilidad | Todo se juega sin voz. También incluye reducir destellos y partículas, alto contraste, texto más grande, avisos de flechas más largos y lectura en voz alta de los mensajes. Los estados no dependen solo del color (icono, texto y animación), y los menús y el HUD son HTML accesibles con teclado. |
| Resultado | Puntuación, oleadas, tiempo, bajas por tipo, caídos al mar, flechas bloqueadas, órdenes por voz, teclado y botón, porcentaje de frases de voz entendidas y una tabla por oleada. |
| Historia | Epílogo con una línea temporal (de Maratón a Platea), la distinción entre lo documentado y lo simulado, y las fuentes. |

## Cómo se juega

| Orden | Voz | Tecla* | Efecto |
|---|---|---|---|
| Escudos | «escudos», «escudo», «falange» | 1 | Bloquea el 100 % de las lluvias de flechas y reduce a la mitad la presión cuerpo a cuerpo. No ataca. |
| Lanzas | «lanzas», «lanza», «ataquen» | 2 | Ataca al enemigo más adelantado de cada fila. Las flechas sí hacen daño. Gasta resistencia. |
| Empujen | «empujen», «empujad», «empujar», «empuja» | 3 | Retroceso de los enemigos cercanos. Los de la fila del acantilado caen al mar; la guardia de élite queda desequilibrada (vulnerable a las lanzas). Enfriamiento de 6 s. |
| Relevo | «relevo», «relevos», «cambio», «fuego»** | 4 | La reserva sustituye a la primera línea y recupera 45 de resistencia. Enfriamiento de 10 s. |
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
- **Identificación del jugador**: la respuesta a «¿cómo debo dirigirme a ti?» se reconoce con una tabla cerrada («mujer», «femenino»; «hombre», «masculino», «varón»; «prefiero no decirlo», «neutro»…). Si la frase es ambigua o no se entiende, se vuelve a preguntar. Mientras se escucha la respuesta, ninguna frase se convierte en orden.
- **Lectura en voz alta** (opcional): usa la síntesis de voz del navegador. Mientras Leónidas habla, y durante un margen breve después, lo que oye el micrófono se ignora para que la narración no se convierta en órdenes.
- No se graba ni se guarda audio, y no hay backend. Si no hay API, se deniega el permiso o falla la red, el HUD lo explica y el teclado y los botones siguen funcionando.

## Estructura

```
src/
├─ main.js                 entrada: Phaser, teclas (según ajustes), botones y escalado del lienzo
├─ app.js                  composición: estado, bus, ajustes, voz, audio, vistas y navegación
├─ config/                 balance.js (valores de diseño), gameConfig.js (Phaser)
├─ scenes/                 Boot, Preload, Menu, Tutorial, Battle, HUD (paralela) y Result + backdrop (capas)
├─ entities/               Formation (reglas), FormationView, EnemyUnit, EventMarker, XerxesView
├─ systems/                BattleSimulation, CommandController, WaveManager, GameState, TutorialDirector,
│                          CommanderMessages, BossDirector (Jerjes), PlayerProfile, SettingsStore,
│                          VoiceCommandManager, Narrator, AudioManager y EventBus
├─ data/                   commands.js (órdenes), waves.js (oleadas), boss.js (Jerjes), leonidas.js (mensajes)
├─ ui/                     HudView, Screens (menú, ajustes, pausa, resultado, epílogo), TutorialView y CommanderView
└─ styles/main.css
public/assets/             pixel art generado (capas, personajes, efectos, iconos, retrato y fuente)
```

### Decisiones técnicas

- **Reglas independientes de Phaser.** `BattleSimulation` usa un paso fijo de 1/60 s y es determinista, así que la campaña y el tutorial se juegan enteros en Node. Las escenas solo dibujan.
- **Uso de Phaser.** Phaser se encarga de las escenas, las animaciones, los tweens, las partículas y de Arcade Physics para las flechas (tiro parabólico, reutilizadas desde una reserva) y para los enemigos que caen al mar. El retroceso del empuje se calcula en la simulación para poder probarlo y para que no dependa de la tasa de fotogramas.
- **Jefe final.** `BossDirector` (sin Phaser) se activa al cerrar la quinta oleada dentro de `BattleSimulation`: anuncia decretos, envía refuerzos, lleva la determinación y las fases, y al llegar a cero llama a la retirada. La simulación añade las tormentas de flechas, el enfurecimiento y la retirada; `XerxesView` solo los dibuja.
- **Tutorial.** `TutorialScene` reutiliza `BattleScene` con una simulación sin oleadas en la que la línea nunca cede del todo. `TutorialDirector` prepara cada paso y comprueba el objetivo.
- **Ajustes.** `SettingsStore` guarda las preferencias en `localStorage`, descarta datos corruptos y funciona en memoria si el almacenamiento está bloqueado. Al reasignar una tecla ocupada, las dos acciones intercambian sus teclas.
- **HUD y menús en HTML.** El lienzo usa una resolución lógica de 320 × 180 sin suavizado, con zoom entero cuando cabe y siempre en 16:9.

## Pruebas

El repositorio contiene solo lo necesario para ejecutar el juego. Las pruebas automáticas, la simulación de balance, el generador de pixel art y la documentación de pruebas de aceptación se mantienen fuera del repositorio.

**Pendiente de comprobar:** la voz se probó con un reconocedor simulado. Falta jugar una partida completa con micrófono real en Chrome o Edge.

## Aviso histórico y de recursos

Es una interpretación lúdica: la batalla real terminó en victoria persa y junto a los espartanos lucharon miles de aliados griegos. Jerjes no combatió en persona y sus «decretos» son mecánicas inventadas; la frase de luchar a la sombra se atribuye al espartano Diéneces. El epílogo lo explica. Todos los sprites, iconos, la fuente pixel y la música se generan por código en este repositorio. No se usa material de la película *300*.
