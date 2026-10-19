# 300: El Paso de las Termópilas — Avance 1 (Beta)

Juego web de defensa táctica en 2D con pixel art, inspirado en la batalla de las Termópilas (480 a. C.). Diriges la falange con órdenes de voz, con el teclado o con los botones. Está hecho con HTML5, CSS3, JavaScript (ES Modules), Phaser 3.90 y la Web Speech API.

Esta versión es el **Avance 1 (beta funcional)** del documento *Termopilas_Documentacion_Fases_Beta_Final.docx* (sección 10.2). La versión final (cinco oleadas, arte y audio definitivos, tutorial, ajustes y epílogo ampliado) queda para la segunda entrega.

## Arrancar

Requiere Node.js 20.19+ (o 22.12+).

```bash
npm install
npm run dev        # http://localhost:5195
npm test           # pruebas unitarias y partidas completas sin interfaz (Vitest)
npm run simulate   # juega la beta con varios estilos para revisar el balance
npm run build      # versión de producción en dist/
npm run art        # regenera el pixel art provisional en public/assets/
```

Juega desde el servidor de desarrollo, no abriendo `index.html` directamente. Para usar la voz, usa Chrome o Edge.

## Cómo se juega

La falange ocupa la izquierda del paso y los persas entran por la derecha en tres oleadas. Cada orden cambia el estado de toda la formación:

| Orden | Voz | Tecla | Efecto en la beta |
|---|---|---|---|
| Escudos | «escudos», «falange» | 1 | Bloquea el 100 % de las lluvias de flechas y reduce a la mitad la presión cuerpo a cuerpo. No ataca. |
| Lanzas | «lanzas» | 2 | Ataca al enemigo más adelantado de cada fila dentro del alcance. Las flechas sí hacen daño. Gasta resistencia. |
| Empujen | «empujen» | 3 | Hace retroceder a los enemigos cercanos. Los de la fila junto al acantilado caen al mar. Tiene un enfriamiento de 6 s. |
| Relevo | «relevo», «cambio», «fuego»* | 4 | La reserva sustituye a la primera línea y recupera 45 de resistencia. Tiene un enfriamiento de 10 s. |
| Pausa / Continuar | «pausa» · «continuar», «reanudar» | P / Esc | Congela la partida. Mientras está en pausa no se aceptan órdenes tácticas. |
| Micrófono | — | V | Activa o desactiva la escucha. |
| Sonido | — | M | Silencia o activa los efectos. |

\* «fuego» es solo un alias de juego para el relevo, no una orden de armas de fuego.

- **Cohesión** (0–100): es la vida de la línea. La reducen las flechas, el combate cuerpo a cuerpo y las brechas. **Si llega a 0, pierdes.**
- **Resistencia** (0–100): se gasta con las lanzas y el empuje, y se recupera con los escudos, el relevo y las pausas entre oleadas. Si llega a 0, la formación queda **agotada**: no ataca y solo acepta las órdenes Escudos y Relevo.
- **Moral** (0–100): sube al eliminar enemigos y al superar oleadas, y baja con los impactos y las brechas. Con moral alta las lanzas hacen más daño.
- **Brechas**: un enemigo que pasa 7 s trabado con la línea sin caer la atraviesa. **Con 4 brechas, pierdes.**
- **Lluvias de flechas**: los arqueros se detienen fuera del alcance. Antes de cada descarga aparece un aviso (en la banda superior, sobre los arqueros y sobre la falange, con cuenta atrás). Después de tres descargas, los arqueros cargan cuerpo a cuerpo.

| Oleada | Contenido | Qué enseña |
|---|---|---|
| 1. Exploración | 5 de infantería | Usar las lanzas y el relevo |
| 2. Presión combinada | 2 arqueros y 6 de infantería | Alternar entre escudos y lanzas |
| 3. Presión creciente | 3 arqueros y 9 de infantería, con avisos más cortos | Usar el empuje junto al acantilado y no perder la cohesión |

## Voz

- El idioma es `es-PE`, con la opción de cambiar a `es-ES` en el menú.
- Solo se usan resultados finales del reconocedor, no transcripciones parciales.
- Las órdenes salen de una **lista cerrada de alias**. Se acepta la coincidencia exacta o una palabra de la frase («¡escudos ya!»). Si la frase contiene dos órdenes distintas se considera ambigua y no se ejecuta nada.
- Si el navegador informa de la confianza, se exige un mínimo configurable (0,45).
- La misma orden dicha por voz no se repite antes de 1,2 s.
- Ninguna orden va directa a los gráficos: todas pasan por `CommandController`. Este comprueba que la partida esté activa, que no esté en pausa, los enfriamientos y el estado de la formación. Durante una transición guarda **una** orden pendiente.
- El permiso del micrófono se pide solo al pulsar «Activar micrófono». En el menú solo se comprueba el permiso: la escucha real empieza al entrar en la batalla y se detiene al salir de ella. Durante la pausa sigue escuchando para aceptar «continuar», pero rechaza las órdenes tácticas.
- No se graba ni se guarda audio, y no hay ningún backend propio.
- Si no hay API, se deniega el permiso o falla la red, el HUD informa del problema y el teclado y los botones siguen funcionando.

## Estructura

```
src/
├─ main.js                 entrada: Phaser, teclado, botones y escalado del lienzo
├─ app.js                  composición: estado, bus, voz, audio, HUD y navegación entre escenas
├─ config/                 balance.js (todos los valores de diseño), gameConfig.js (Phaser)
├─ scenes/                 Boot, Preload, Menu, Battle, HUD (paralela) y Result
├─ entities/               Formation (reglas), FormationView, EnemyUnit, EventMarker
├─ systems/                BattleSimulation, CommandController, WaveManager, GameState,
│                          VoiceCommandManager, AudioManager y EventBus
├─ data/                   commands.js (tabla cerrada de órdenes), waves.js (enemigos y oleadas)
├─ ui/                     HudView y Screens (HUD, menú, controles, pausa y resultado en HTML)
└─ styles/main.css
public/assets/             pixel art provisional (PNG generados) y fuente pixel 3×5
tools/art/                 generador del pixel art (sin recursos de terceros)
scripts/                   bots de prueba y simulación de balance
tests/                     38 pruebas: voz, órdenes, oleadas, combate y partidas completas
```

### Decisiones técnicas

- **Reglas independientes de Phaser.** `BattleSimulation` usa un paso fijo de 1/60 s y es determinista: mueve a los enemigos, resuelve el combate, el empuje, las flechas, las brechas, las oleadas y el final de la partida. Por eso se puede probar en Node y simular partidas completas. `BattleScene` solo dibuja lo que ocurre en la simulación.
- **Uso de Phaser.** Phaser se encarga de las escenas, la carga de recursos, las animaciones, los tweens, las partículas (polvo, chispas y salpicaduras) y de Arcade Physics para los objetos que se mueven por física: las flechas siguen un tiro parabólico con gravedad y los enemigos derribados caen por el acantilado. Esto se aparta en parte de la sección 8.5 del documento: el retroceso del empuje se calcula en la simulación y no con un cuerpo de Arcade. Así el resultado se puede probar y no depende de la tasa de fotogramas.
- **Eventos de la sección 9.2.** `COMMAND_RECEIVED`, `FORMATION_CHANGED`, `WAVE_STARTED`, `WAVE_COMPLETED`, `MORALE_UPDATED`, `VOICE_ERROR` y `GAME_OVER` viajan por un bus propio, junto con otros eventos de la beta (descargas, empuje, brechas…).
- **HUD y menús en HTML.** Así son accesibles con teclado y lectores de pantalla y se leen bien a cualquier tamaño. El lienzo usa una resolución lógica de 320 × 180, ampliada sin suavizado. El factor de zoom es entero cuando cabe y fraccionario cuando no, y siempre se mantiene la proporción 16:9.
- **Sonidos.** Los efectos son tonos breves sintetizados con Web Audio y cada uno tiene un aviso visual equivalente. No se usa música (no se exige en la beta).

## Criterios de aceptación del Avance 1 (sección 11.2)

| Criterio | Estado | Cómo se comprobó |
|---|---|---|
| No hay bloqueos críticos al iniciar, jugar o reiniciar las tres oleadas | ✅ | Partidas en el navegador sin errores de consola y bots que juegan las tres oleadas (`npm test`) |
| La partida se gana o se pierde con un ciclo claro y luego se reinicia | ✅ | Victoria y derrota en las pruebas; derrota y «Reintentar» en el navegador |
| Las cuatro órdenes cambian el estado visual y producen su efecto | ✅ | `tests/commands.test.js` y `tests/battle.test.js`, más una prueba manual |
| Las órdenes de voz reconocidas reciben confirmación visible | ✅* | Se probó con un reconocedor simulado dentro de la página; no se probó con un micrófono real |
| La beta se completa con teclado y botones sin micrófono | ✅ | Bot «atento» (solo teclado) y prueba manual con teclas y botones |
| La interfaz informa del estado del micrófono, los errores y la última orden | ✅ | Probado con el permiso denegado, frases desconocidas y órdenes rechazadas |
| No se guarda audio ni se envían datos a un backend propio | ✅ | Solo se procesa texto; no hay servidor |
| Los sprites se escalan con bordes nítidos y la partida es estable | ✅ | `pixelArt` activado y `image-rendering: pixelated`; probado a 1280×760 y 1024×640 |

\* Falta probarlo con un micrófono real en Chrome o Edge.

Pruebas funcionales de la sección 11.1 que corresponden a la beta: T-01 a T-10. La T-11 (reducir efectos y desactivar audio desde los ajustes) es de la versión final; en la beta solo existe la tecla M para silenciar.

## Fuera del alcance de esta entrega (para la versión final)

- Cinco oleadas y cuatro patrones de enemigo (guardia de élite y grupos mixtos).
- Pixel art definitivo con capas, partículas optimizadas, música original y controles de volumen.
- Tutorial, pantalla de ajustes (remapeo de teclas, reducir destellos, volumen), estadísticas de campaña y epílogo histórico ampliado.
- Alias de voz ajustados con usuarios y pruebas ampliadas de accesibilidad y rendimiento.

## Aviso histórico y de recursos

Es una interpretación lúdica: la batalla real terminó en victoria persa y junto a los espartanos lucharon miles de aliados griegos. La pantalla de resultado lo explica. Todos los sprites, iconos, la fuente y los sonidos se generan por código en este repositorio. No se usa material de la película *300*.
