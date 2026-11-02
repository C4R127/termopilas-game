import { BREACH, DIFFICULTY } from '../config/balance.js';
import { COMMANDS } from '../data/commands.js';
import { ANOPAEA } from '../data/anopaea.js';
import { LIGHT_SETTING } from '../config/lighting.js';
import { XERXES } from '../data/boss.js';
import { ENEMY_TYPES, WAVES } from '../data/waves.js';
import { LEONIDAS } from '../data/leonidas.js';
import { ADDRESS_OPTIONS, IDENTITIES, personalize } from '../systems/PlayerProfile.js';
import { KEY_ACTION_LABELS, KEY_ACTIONS, keyLabel, VOICE_SENSITIVITY } from '../systems/SettingsStore.js';

const LOGO = `${import.meta.env.BASE_URL}assets/images/ui/logo.png`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const LANGS = [
  ['es-PE', 'Español (Perú) · es-PE'],
  ['es-ES', 'Español (España) · es-ES'],
  ['es-MX', 'Español (México) · es-MX'],
];

const REASONS = {
  campaign: 'La falange resistió las cinco oleadas.',
  anopaea: 'Rodeada por el paso y por la senda de Anopea, la falange resistió las cuatro oleadas.',
  xerxes: 'Jerjes ordenó la retirada: la falange resistió las cinco oleadas y todos sus decretos.',
  cohesion: 'La cohesión de la formación llegó a cero y la línea cedió.',
  breaches: `Demasiados enemigos abrieron brecha en la línea (${BREACH.maxBreaches}).`,
};

const ANOPAEA_NOTE = `<p class="history-note"><b>Nota histórica.</b> En el tercer día, Efialtes guió a los persas por la senda
de Anopea. Leónidas despidió a gran parte del ejército y cayó con los espartanos, los tespios y los tebanos que se quedaron.
Tu resultado es el de una simulación jugable.</p>`;

const SHORT_NOTE = `<p class="history-note"><b>Nota histórica.</b> La batalla real terminó en victoria persa: un sendero de montaña
permitió rodear la posición griega. Tu resultado es el de una simulación jugable, no una reconstrucción exacta.</p>`;

function fmtTime(ms) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function controlsTable(keys) {
  const rows = COMMANDS.filter((c) => c.id !== 'RESUME').map((c) => {
    const pause = c.id === 'PAUSE';
    const phrases = pause
      ? '«pausa» · «continuar», «reanudar», «seguir»'
      : c.aliases.map((a) => `«${a}»`).join(', ') + (c.id === 'RELIEF' ? ' <small>(«fuego» es solo un alias de juego)</small>' : '');
    const icon = `<i class="icon" data-icon="${c.icon ?? 6}" aria-hidden="true"></i>`;
    const key = pause ? `${keyLabel(keys.PAUSE)} / Esc` : keyLabel(keys[c.id]);
    return `<tr><td>${icon}${esc(pause ? 'Pausa / Continuar' : c.label)}</td><td>${phrases}</td><td><kbd>${esc(key)}</kbd></td><td>${esc(c.help)}</td></tr>`;
  });
  rows.push(`<tr><td><i class="icon" data-icon="5" aria-hidden="true"></i>Micrófono</td><td>—</td><td><kbd>${esc(keyLabel(keys.VOICE))}</kbd></td><td>Activa o desactiva la escucha.</td></tr>`);
  rows.push(`<tr><td><i class="icon" data-icon="8" aria-hidden="true"></i>Sonido</td><td>—</td><td><kbd>${esc(keyLabel(keys.MUTE))}</kbd></td><td>Silencia o activa el sonido.</td></tr>`);
  return `<table class="controls-table">
    <thead><tr><th>Orden</th><th>Voz</th><th>Tecla</th><th>Efecto</th></tr></thead>
    <tbody>${rows.join('')}</tbody></table>`;
}

/**
 * Pantallas HTML superpuestas al lienzo: menú, controles, ajustes, pausa,
 * resultado y epílogo. Los botones llaman a `handlers`; no contienen reglas de juego.
 */
export class Screens {
  constructor(el, settings, handlers) {
    this.el = el;
    this.settings = settings;
    this.handlers = handlers;
    this.current = null;
    this.returnTo = null; // pantalla a la que vuelven Controles, Ajustes y Epílogo
    el.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target || target.tagName === 'SELECT' || target.tagName === 'INPUT') return;
      this.#action(target.dataset.action, target);
    });
    el.addEventListener('input', (e) => this.#field(e.target));
    el.addEventListener('change', (e) => {
      if (e.target.tagName === 'SELECT' || e.target.type === 'checkbox') this.#field(e.target);
    });
  }

  #field(target) {
    const { section, key } = target.dataset;
    if (section && key) {
      const value = target.type === 'checkbox' ? target.checked : target.type === 'range' ? Number(target.value) / 100 : target.value;
      this.handlers.onSetting(section, key, value);
      const out = target.closest('label')?.querySelector('output');
      if (out) out.textContent = `${target.value} %`;
    }
  }

  #action(action, target) {
    const h = this.handlers;
    switch (action) {
      case 'start': return h.onStart();
      case 'difficulty': return this.#setDifficulty(target.dataset.id);
      case 'tutorial': return h.onTutorial();
      case 'voiceid': return h.onVoiceId?.(target.dataset.do, target.dataset.id);
      case 'anopaea': return h.onAnopaea();
      case 'controls': return this.controls();
      case 'settings': return this.settingsScreen();
      case 'epilogue': return this.epilogue();
      case 'back': return this.back();
      case 'voice': return h.onVoiceToggle();
      case 'voice-test': return h.onVoiceTest();
      case 'rebind': return this.#captureKey(target.dataset.key, target);
      case 'reset-keys': this.settings.resetKeys(); return this.settingsScreen();
      case 'resume': return h.onResume();
      case 'retry': return h.onRestart();
      case 'ask-restart': return this.#confirm('¿Reiniciar la campaña desde la primera oleada? Se perderá el progreso de esta partida.', 'retry');
      case 'ask-menu': return this.#confirm('¿Volver al menú principal? Se perderá el progreso de esta partida.', 'menu');
      case 'cancel-confirm': return this.el.querySelector('.confirm-box')?.remove();
      case 'menu': return h.onMenu();
      default: return undefined;
    }
  }

  #show(name, html, { transparent = false } = {}) {
    if (this.current !== 'settings' && name === 'settings') this.handlers.onSettingsOpen?.();
    if (this.current === 'settings' && name !== 'settings') this.handlers.onSettingsClose?.();
    this.current = name;
    this.el.innerHTML = html;
    this.el.dataset.transparent = String(transparent);
    this.el.hidden = false;
    this.el.scrollTop = 0;
    // El foco va al botón principal para poder jugar solo con teclado.
    (this.el.querySelector('[data-autofocus]') ?? this.el.querySelector('button'))?.focus({ preventScroll: true });
  }

  hide() {
    if (this.current === 'settings') this.handlers.onSettingsClose?.();
    this.current = null;
    this.el.hidden = true;
    this.el.innerHTML = '';
  }

  /** Vuelve desde Controles, Ajustes o Epílogo a la pantalla de origen. */
  back() {
    const to = this.returnTo ?? 'menu';
    if (to === 'pause') this.pause();
    else if (to === 'result' && this.lastResult) this.result(...this.lastResult);
    else this.menu();
  }

  menu(opts = this.lastMenu ?? {}) {
    this.lastMenu = opts;
    this.returnTo = 'menu';
    const { voiceWanted = false, voiceSupported = true, note = '', noteKind = '' } = opts;
    const tutorialDone = this.settings.get('progress', 'tutorialDone');
    this.#show('menu', `
      <div class="panel">
        <h1 class="menu-title"><span class="logo-wrap"><img class="logo" src="${LOGO}" alt="300: El Paso de las Termópilas" width="176" height="64"></span>
          <small>Estrategia táctica con órdenes de voz</small></h1>
        <p class="lead">Termópilas, 480 a. C. Dirige la falange aliada en el paso estrecho entre la montaña y el mar.
          Cambia de formación a tiempo para resistir cinco oleadas y los decretos del propio Jerjes.</p>
        <div class="menu-actions">
          <button class="btn btn-primary" type="button" data-action="start" ${tutorialDone ? 'data-autofocus' : ''}>Comenzar campaña</button>
          ${this.#difficultyPicker()}
          <button class="btn" type="button" data-action="tutorial" ${tutorialDone ? '' : 'data-autofocus'}>
            <i class="icon" data-icon="9" aria-hidden="true"></i>Tutorial ${tutorialDone ? '' : '<span class="badge">recomendado</span>'}</button>
          <button class="btn" type="button" data-action="anopaea" title="Día 3: los persas rodean el paso; ataques por delante y por detrás">
            <i class="icon" data-icon="12" aria-hidden="true"></i>Escenario: la senda de Anopea</button>
          <div class="btn-grid">
            <button class="btn" type="button" data-action="controls">Controles</button>
            <button class="btn" type="button" data-action="settings"><i class="icon" data-icon="8" aria-hidden="true"></i>Ajustes</button>
            <button class="btn" type="button" data-action="epilogue">Historia</button>
            <button class="btn" type="button" data-action="voice" aria-pressed="${voiceWanted}" ${voiceSupported ? '' : 'disabled'}>
              <i class="icon" data-icon="5" aria-hidden="true"></i>${voiceWanted ? 'Micrófono activado' : 'Activar micrófono'}</button>
          </div>
        </div>
        <p class="voice-note" data-voice-note data-kind="${noteKind}" role="status" aria-live="polite">${esc(note)}</p>
        <p class="fineprint">Se juega entero con voz, con teclado o con los botones en pantalla. El reconocimiento de voz depende del
          navegador (Chrome o Edge) y puede usar sus servicios en línea; el juego no graba ni guarda audio: interpreta las frases de las
          órdenes y estima el tono de tu voz para que Leónidas te trate de «aliada» o «aliado» (se cambia en Ajustes). Interpretación
          lúdica inspirada en un hecho histórico.</p>
      </div>`, { transparent: true });
  }

  /** Selector de dificultad del menú: tres botones con estado pulsado. */
  #difficultyPicker() {
    const current = this.settings.get('game', 'difficulty');
    const help = {
      easy: 'Más tiempo para reaccionar y enemigos más débiles. En la senda de Anopea atacan por un solo lado cada vez y la falange gira sola',
      normal: 'El equilibrio de referencia. En la senda de Anopea, tú ordenas la media vuelta',
      hard: 'Avisos más cortos, enemigos más duros y más puntos. En la senda de Anopea, frente y retaguardia atacan a la vez más a menudo',
    };
    return `<div class="difficulty" role="group" aria-label="Dificultad">
      <span class="difficulty-label">Dificultad</span>
      ${Object.values(DIFFICULTY).map((d) => `<button class="btn btn-small" type="button" data-action="difficulty" data-id="${d.id}" aria-pressed="${d.id === current}" title="${esc(help[d.id])}">${esc(d.label)}</button>`).join('')}
    </div>`;
  }

  #setDifficulty(id) {
    if (!DIFFICULTY[id]) return;
    this.handlers.onSetting('game', 'difficulty', id);
    for (const btn of this.el.querySelectorAll('[data-action="difficulty"]')) btn.setAttribute('aria-pressed', String(btn.dataset.id === id));
  }

  setVoiceNote(note, kind = '') {
    if (this.lastMenu) Object.assign(this.lastMenu, { note, noteKind: kind });
    const el = this.el.querySelector('[data-voice-note]');
    if (!el) return;
    el.textContent = note;
    el.dataset.kind = kind;
  }

  controls() {
    this.#show('controls', `
      <div class="panel panel-wide">
        <h2>Controles y órdenes</h2>
        <p class="lead">Cada orden cambia el estado de toda la formación. Lee los avisos de la parte superior:
          cuando aparezca <b>¡Lluvia de flechas!</b>, levanta los escudos antes del impacto.</p>
        ${controlsTable(this.settings.get('keys'))}
        <p class="fineprint">Las teclas se pueden cambiar en Ajustes. Las órdenes por voz solo se aceptan con la partida en marcha y
          cualquier frase fuera de la lista se ignora. El empuje y el relevo tienen enfriamiento. Si la resistencia llega a cero,
          la formación queda agotada: ordena relevo o escudos para recuperarla.</p>
        <div class="btn-row"><button class="btn" type="button" data-action="back" data-autofocus>Volver</button></div>
      </div>`);
  }

  settingsScreen() {
    const s = this.settings;
    const audio = s.get('audio');
    const access = s.get('access');
    const voice = s.get('voice');
    const keys = s.get('keys');
    const slider = (key, label) => `<label class="slider">${label}
      <input type="range" min="0" max="100" step="5" value="${Math.round(audio[key] * 100)}" data-section="audio" data-key="${key}" />
      <output>${Math.round(audio[key] * 100)} %</output></label>`;
    const check = (key, label, help) => `<label class="check"><input type="checkbox" data-section="access" data-key="${key}" ${access[key] ? 'checked' : ''} />
      <span><b>${label}</b><small>${help}</small></span></label>`;
    const keyRows = KEY_ACTIONS.map((a) => `<tr><td>${esc(KEY_ACTION_LABELS[a])}</td>
      <td><button class="btn btn-key" type="button" data-action="rebind" data-key="${a}" aria-label="Cambiar tecla de ${esc(KEY_ACTION_LABELS[a])}: ${esc(keyLabel(keys[a]))}">
        <kbd>${esc(keyLabel(keys[a]))}</kbd> Cambiar</button></td></tr>`).join('');
    this.#show('settings', `
      <div class="panel panel-wide settings">
        <h2>Ajustes</h2>
        <div class="settings-grid">
          <section aria-labelledby="set-audio">
            <h3 id="set-audio">Sonido</h3>
            ${slider('master', 'Volumen general')}
            ${slider('music', 'Música')}
            ${slider('sfx', 'Efectos')}
            <label class="check"><input type="checkbox" data-section="audio" data-key="muted" ${audio.muted ? 'checked' : ''} />
              <span><b>Silenciar todo</b><small>Cada sonido importante tiene también un aviso visual.</small></span></label>
          </section>
          <section aria-labelledby="set-access">
            <h3 id="set-access">Accesibilidad</h3>
            ${check('reduceEffects', 'Reducir destellos y partículas', 'Sin parpadeos, sacudidas de cámara ni destellos de golpe; menos partículas.')}
            ${check('highContrast', 'Alto contraste', 'Paneles más oscuros, texto más claro y bordes marcados.')}
            ${check('largeText', 'Texto más grande', 'Amplía el HUD, los botones y los menús.')}
            ${check('plainText', 'Texto normal (sin fuente pixel)', 'Los párrafos, ajustes y mensajes de Leónidas usan la fuente del sistema, más cómoda para leer.')}
            ${check('longWarnings', 'Avisos de flechas más largos', 'Un 50 % más de tiempo para reaccionar (útil con la voz).')}
            ${check('narration', 'Leer en voz alta los mensajes', 'Leónidas lee las indicaciones del tutorial y de la campaña con la voz del navegador. Mientras habla, el micrófono no acepta órdenes.')}
          </section>
          <section aria-labelledby="set-keys">
            <h3 id="set-keys">Teclas</h3>
            <table class="keys-table"><tbody>${keyRows}</tbody></table>
            <p class="key-note" data-key-note role="status" aria-live="polite">Esc siempre pausa o cierra; Tab, Intro y Espacio manejan los botones.</p>
            <button class="btn btn-small" type="button" data-action="reset-keys">Restablecer teclas</button>
          </section>
          <section aria-labelledby="set-voice">
            <h3 id="set-voice">Voz</h3>
            <label class="field">Idioma del reconocimiento
              <select data-section="voice" data-key="lang">${LANGS.map(([v, l]) => `<option value="${v}" ${v === voice.lang ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
            <label class="field">Dificultad de la campaña
              <select data-section="game" data-key="difficulty">${Object.values(DIFFICULTY).map((d) => `<option value="${d.id}" ${d.id === this.settings.get('game', 'difficulty') ? 'selected' : ''}>${d.label}</option>`).join('')}</select></label>
            <label class="field" title="En automático, la luz avanza con la batalla: del amanecer a la noche.">Iluminación
              <select data-section="game" data-key="lighting">${Object.entries(LIGHT_SETTING).map(([v, l]) => `<option value="${v}" ${v === this.settings.get('game', 'lighting') ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
            <label class="field">Precisión exigida
              <select data-section="voice" data-key="sensitivity">${Object.entries(VOICE_SENSITIVITY).map(([v, d]) => `<option value="${v}" ${v === voice.sensitivity ? 'selected' : ''}>${d.label}</option>`).join('')}</select></label>
            <button class="btn btn-small" type="button" data-action="voice-test" aria-pressed="false"><i class="icon" data-icon="5" aria-hidden="true"></i><span>Probar micrófono</span></button>
            <p class="voice-note" data-voice-test role="status" aria-live="polite">Di una orden para comprobar cómo la entiende el juego. No se ejecuta nada.</p>
            <label class="field">Leónidas se dirige a ti como
              <select data-section="player" data-key="address">${Object.entries(ADDRESS_OPTIONS).map(([v, l]) => `<option value="${v}" ${v === s.get('player', 'address') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
            <p class="fineprint">El reconocimiento lo hace el navegador y puede depender de sus servicios en línea. El juego no graba
              ni guarda audio: compara el texto reconocido con la lista cerrada de órdenes y, en automático, estima el tono de tu voz
              mientras das las primeras órdenes para elegir entre «aliada» y «aliado» («estratega» si el tono no basta). Ese cálculo
              se hace en el momento y no se guarda; elige una forma fija si prefieres que no se analice.</p>
          </section>
        </div>
        <div class="btn-row"><button class="btn btn-primary" type="button" data-action="back" data-autofocus>Volver</button></div>
      </div>`);
  }

  /**
   * Antes de la batalla: Leónidas identifica a quien juega por el tono de su voz.
   * phase: 'ask' (instrucciones), 'listening', 'done', 'retry' (no se oyó bastante) o 'error' (sin micrófono).
   */
  voiceId({ phase = 'ask', identity = null, heard = false } = {}) {
    const portrait = `${import.meta.env.BASE_URL}assets/images/ui/leonidas.png`;
    const ally = identity ? IDENTITIES[identity].ally : null;
    const btn = (action, label, { primary = false, icon = null, id = null, auto = false } = {}) =>
      `<button class="btn ${primary ? 'btn-primary' : ''}" type="button" data-action="voiceid" data-do="${action}" ${id ? `data-id="${id}"` : ''} ${auto ? 'data-autofocus' : ''}>${icon != null ? `<i class="icon" data-icon="${icon}" aria-hidden="true"></i>` : ''}${esc(label)}</button>`;
    const picks = Object.entries(IDENTITIES).map(([id, d]) => btn('pick', d.label, { id })).join('');
    const body = {
      ask: `<p class="lead">${esc(personalize(LEONIDAS.voiceIdAsk, identity ?? 'unspecified'))}</p>
        <div class="voiceid-actions">${btn('listen', 'Identificar mi voz', { primary: true, icon: 5, auto: true })}
          ${ally ? btn('continue', `Seguir como «${ally}»`) : ''}</div>`,
      listening: `<p class="lead">Escuchando… di en voz alta: <b>«${esc(LEONIDAS.voiceIdPhrase)}»</b></p>
        <div class="voiceid-meter" role="progressbar" aria-label="Voz oída" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><span data-voiceid-bar></span></div>
        <p class="voice-note" role="status" aria-live="polite" data-voiceid-note>Habla con tu tono normal, como si dieras una orden.</p>`,
      done: `<p class="lead voiceid-result">${heard ? 'Te reconozco por la voz' : 'De acuerdo'}: Leónidas te tratará de <b>«${esc(ally ?? '')}»</b>.</p>
        <div class="voiceid-actions">${btn('continue', 'Comenzar', { primary: true, auto: true })}${btn('listen', 'Repetir', { icon: 5 })}</div>
        <p class="voiceid-fix">¿No es correcto? Elige cómo quieres que te trate:</p>
        <div class="btn-grid voiceid-picks">${picks}</div>`,
      retry: `<p class="lead">No te he oído lo suficiente. Acércate al micrófono y di la frase completa, en voz alta.</p>
        <div class="voiceid-actions">${btn('listen', 'Intentar de nuevo', { primary: true, icon: 5, auto: true })}</div>
        <p class="voiceid-fix">O elige cómo quieres que te trate:</p>
        <div class="btn-grid voiceid-picks">${picks}</div>`,
      error: `<p class="lead">No se pudo usar el micrófono (permiso denegado o no hay ninguno). Elige cómo quieres que te trate o salta este paso.</p>
        <div class="btn-grid voiceid-picks">${picks}</div>`,
    }[phase];
    this.#show('voiceid', `
      <div class="panel voiceid" data-phase="${phase}">
        <div class="voiceid-head">
          <img class="tutorial-portrait" src="${portrait}" alt="Leónidas I" width="64" height="64" />
          <div><h2>Antes de la batalla</h2>${body}</div>
        </div>
        <p class="fineprint">El tono de tu voz se analiza en el momento, en este navegador: no se graba, no se guarda ni se envía audio.
          Solo sirve para que Leónidas te llame «aliada» o «aliado» (o «estratega» si el tono no basta). Puedes fijarlo en Ajustes.</p>
        <div class="btn-row">${phase === 'listening' ? '' : `${btn('skip', 'Saltar')}${btn('cancel', 'Volver al menú')}`}</div>
      </div>`);
  }

  /** Barra «te oigo» mientras escucha el panel de identificación (0–1). */
  voiceIdProgress(fraction) {
    const bar = this.el.querySelector('[data-voiceid-bar]');
    if (!bar) return;
    const pct = Math.round(fraction * 100);
    bar.style.width = `${pct}%`;
    bar.parentElement.setAttribute('aria-valuenow', String(pct));
    if (pct >= 100) this.el.querySelector('[data-voiceid-note]').textContent = 'Te oigo bien. Termina la frase…';
  }

  /** Resultado de la prueba de voz dentro de Ajustes. */
  setVoiceTest(text, kind = '', listening) {
    const el = this.el.querySelector('[data-voice-test]');
    if (el) {
      el.textContent = text;
      el.dataset.kind = kind;
    }
    if (listening != null) {
      const btn = this.el.querySelector('[data-action="voice-test"]');
      if (btn) {
        btn.setAttribute('aria-pressed', String(listening));
        btn.querySelector('span').textContent = listening ? 'Detener prueba' : 'Probar micrófono';
      }
    }
  }

  /** Espera la siguiente tecla para asignarla a una acción (Esc cancela). */
  #captureKey(action, button) {
    const note = this.el.querySelector('[data-key-note]');
    button.querySelector('kbd').textContent = '…';
    note.textContent = `Pulsa la nueva tecla para «${KEY_ACTION_LABELS[action]}» (Esc cancela).`;
    const onKey = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      window.removeEventListener('keydown', onKey, true);
      if (e.code === 'Escape') {
        this.settingsScreen();
        return;
      }
      const r = this.settings.rebind(action, e.code);
      this.settingsScreen();
      const msg = !r.ok ? r.reason
        : r.swappedWith ? `${keyLabel(e.code)} asignada a ${KEY_ACTION_LABELS[action]}; ${KEY_ACTION_LABELS[r.swappedWith]} pasa a ${keyLabel(this.settings.get('keys', r.swappedWith))}.`
          : `${keyLabel(e.code)} asignada a ${KEY_ACTION_LABELS[action]}.`;
      this.el.querySelector('[data-key-note]').textContent = msg;
      this.el.querySelector(`[data-action="rebind"][data-key="${action}"]`)?.focus();
    };
    window.addEventListener('keydown', onKey, true);
  }

  pause() {
    this.returnTo = 'pause';
    this.#show('pause', `
      <div class="panel panel-wide">
        <h2>Partida pausada</h2>
        <p class="lead">La simulación está congelada. Di «continuar» o pulsa <kbd>${esc(keyLabel(this.settings.get('keys', 'PAUSE')))}</kbd> / <kbd>Esc</kbd> para seguir.</p>
        <div class="btn-row">
          <button class="btn btn-primary" type="button" data-action="resume" data-autofocus>Continuar</button>
          <button class="btn" type="button" data-action="settings">Ajustes</button>
          <button class="btn" type="button" data-action="ask-restart">Reiniciar</button>
          <button class="btn" type="button" data-action="ask-menu">Menú principal</button>
        </div>
        ${controlsTable(this.settings.get('keys'))}
      </div>`);
  }

  #confirm(text, action) {
    this.el.querySelector('.confirm-box')?.remove();
    const box = document.createElement('div');
    box.className = 'confirm-box';
    box.setAttribute('role', 'alertdialog');
    box.innerHTML = `<p>${esc(text)}</p><div class="btn-row">
      <button class="btn btn-primary" type="button" data-action="${action}">Sí</button>
      <button class="btn" type="button" data-action="cancel-confirm">No</button></div>`;
    this.el.querySelector('.btn-row').after(box);
    box.querySelector('button').focus();
  }

  result(result, stats) {
    this.lastResult = [result, stats];
    this.returnTo = 'result';
    const win = result.victory;
    const c = stats.commands;
    const totalVolleys = stats.volleysBlocked + stats.volleysTaken;
    const byType = Object.keys(ENEMY_TYPES).map((t) => `${ENEMY_TYPES[t].name}: ${stats.killsByType[t] ?? 0}`).join(' · ');
    const anopaea = result.scenario === 'anopaea';
    const waves = anopaea ? ANOPAEA.waves : WAVES;
    const voiceRate = stats.voiceHeard ? `${Math.round((stats.voiceMatched / stats.voiceHeard) * 100)} % de ${stats.voiceHeard}` : 'sin usar';
    const waveRows = waves.map((w, i) => {
      const log = stats.waveLog.find((l) => l.index === i);
      return `<tr><td>${i + 1}. ${esc(w.name)}</td><td>${log ? 'Superada' : i === result.wavesCleared && !win ? 'Aquí cedió la línea' : '—'}</td>
        <td>${log ? fmtTime(log.timeMs) : '—'}</td><td>${log?.kills ?? '—'}</td><td>${log?.cohesion ?? '—'}</td></tr>`;
    }).join('') + (anopaea ? '' : `<tr><td>Final. ${esc(XERXES.name)}</td><td>${result.bossDefeated ? 'Ordenó la retirada' : result.bossReached ? 'Aquí cedió la línea' : '—'}</td>
        <td>${result.bossReached ? fmtTime(result.bossTimeMs) : '—'}</td><td>—</td><td>${result.bossReached ? result.cohesion : '—'}</td></tr>`);
    this.#show('result', `
      <div class="panel panel-wide ${win ? 'result-victory' : 'result-defeat'}">
        ${anopaea ? `<p class="result-scenario"><i class="icon" data-icon="12" aria-hidden="true"></i>${esc(ANOPAEA.name)}</p>` : ''}
        <h2>${win ? 'La línea resiste' : 'La línea ha cedido'}</h2>
        <p class="result-address">${esc(personalize(win ? 'Bien luchado, {aliado}.' : 'Has resistido con honor, {aliado}.', this.handlers.identity?.()))}</p>
        <p class="lead">${esc(REASONS[result.reason] ?? '')}</p>
        <div class="stats">
          <div class="stat stat-score"><span>Puntuación</span><b>${stats.score}</b><small>Dificultad: ${esc((DIFFICULTY[this.settings.get('game', 'difficulty')] ?? DIFFICULTY.normal).label)}</small></div>
          <div class="stat"><span>Oleadas superadas</span><b>${result.wavesCleared} / ${waves.length}</b></div>
          <div class="stat"><span>Tiempo</span><b>${fmtTime(result.timeMs)}</b></div>
          <div class="stat"><span>Enemigos repelidos</span><b>${stats.kills}</b><small>${esc(byType)}</small></div>
          <div class="stat"><span>Caídos al mar</span><b>${stats.edgeKills}</b></div>
          <div class="stat"><span>Lluvias de flechas bloqueadas</span><b>${stats.volleysBlocked} / ${totalVolleys}</b></div>
          <div class="stat"><span>Órdenes (voz · teclado · botón)</span><b>${c.voice} · ${c.keyboard} · ${c.button}</b><small>${stats.rejected} rechazadas</small></div>
          <div class="stat"><span>Frases de voz entendidas</span><b>${voiceRate}</b></div>
          ${anopaea ? '' : `<div class="stat"><span>Determinación de Jerjes</span><b>${result.bossReached ? `${result.bossResolve ?? 0} / ${XERXES.resolveMax}` : 'no llegó'}</b><small>${result.bossDefeated ? 'ordenó la retirada' : result.bossReached ? 'resistió el enfrentamiento' : ''}</small></div>`}
        </div>
        <table class="controls-table waves-table">
          <thead><tr><th>Oleada</th><th>Resultado</th><th>Tiempo</th><th>Bajas</th><th>Cohesión al final</th></tr></thead>
          <tbody>${waveRows}</tbody></table>
        ${anopaea ? ANOPAEA_NOTE : SHORT_NOTE}
        <div class="btn-row">
          <button class="btn btn-primary" type="button" data-action="retry" data-autofocus>${anopaea ? 'Reintentar escenario' : 'Reintentar campaña'}</button>
          <button class="btn" type="button" data-action="epilogue">Epílogo histórico</button>
          <button class="btn" type="button" data-action="menu">Menú principal</button>
        </div>
      </div>`);
  }

  /** Epílogo: qué ocurrió en realidad y qué es simulación (secciones 2 y 10.4). */
  epilogue() {
    const timeline = [
      ['490 a. C.', 'Primera invasión persa. Atenas la rechaza en Maratón.'],
      ['480 a. C., verano', 'Jerjes I cruza el Helesponto con un gran ejército y una flota para someter Grecia.'],
      ['480 a. C., agosto o septiembre', 'Una alianza de ciudades griegas, con varios miles de hoplitas al mando del rey espartano Leónidas I, ocupa el paso de las Termópilas. Al mismo tiempo, la flota aliada combate en Artemisio.'],
      ['Días 1 y 2', 'Los griegos rechazan los asaltos persas en el paso estrecho, también los de la guardia real que Heródoto llama «los Inmortales».'],
      ['Día 3', 'Un griego de la zona, Efialtes, guía a los persas por un sendero de montaña que rodea la posición. Leónidas despide a gran parte del ejército y se queda con los espartanos y otros aliados, entre ellos tespios y tebanos. Caen casi todos: victoria persa.'],
      ['480 a. C., septiembre', 'Los persas toman Atenas, pero la flota griega vence en Salamina.'],
      ['479 a. C.', 'La victoria griega en Platea pone fin a la invasión.'],
    ];
    this.#show('epilogue', `
      <div class="panel panel-wide epilogue">
        <h2>Epílogo histórico</h2>
        <p class="lead">El juego se inspira en un acontecimiento real, pero no lo reproduce. Esto es lo que cuentan las fuentes.</p>
        <ol class="timeline">${timeline.map(([when, what]) => `<li><b>${when}</b><span>${what}</span></li>`).join('')}</ol>
        <div class="two-cols">
          <section><h3>Lo documentado</h3><ul>
            <li>La batalla terminó en <b>victoria persa</b>.</li>
            <li>Los «300» fueron solo los espartanos: junto a ellos lucharon miles de aliados griegos.</li>
            <li>El paso estaba entre las laderas del monte Calídromo y la costa del golfo Malíaco, mucho más cerca del agua que hoy.</li>
            <li>Su resistencia, junto con Salamina y Platea, se convirtió en un símbolo para los griegos.</li>
          </ul></section>
          <section><h3>Lo que simula el juego</h3><ul>
            <li>Las cinco oleadas, la cohesión, la resistencia y la moral son reglas de juego, no datos históricos.</li>
            <li>La «guardia de élite» es un arquetipo jugable inspirado en la guardia real persa.</li>
            <li>Empujar enemigos al mar es una mecánica del juego; no describe un episodio concreto.</li>
            <li>Jerjes no combatió en persona: Heródoto cuenta que observaba la batalla desde su trono y que llegó a levantarse de él temiendo por su ejército. En el juego es el jefe final y sus «decretos» son mecánicas inventadas. La frase de lucharemos a la sombra se atribuye al espartano Diéneces.</li>
            <li>El escenario «La senda de Anopea» recrea el tercer día como un combate por dos frentes; la «media vuelta» es una orden de juego.</li>
            <li>Ganar la campaña o el escenario no cambia el desenlace real.</li>
          </ul></section>
        </div>
        <p class="fineprint">Fuentes: Heródoto, <i>Historias</i>, libro VII. M. Cartwright, «Battle of Thermopylae» y «Leonidas I of Sparta»,
          <i>World History Encyclopedia</i> (2013). Las fechas exactas varían según los autores.</p>
        <div class="btn-row"><button class="btn btn-primary" type="button" data-action="back" data-autofocus>Volver</button></div>
      </div>`);
  }
}
