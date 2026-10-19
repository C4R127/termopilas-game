import { BREACH } from '../config/balance.js';
import { COMMANDS } from '../data/commands.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const LANGS = [
  ['es-PE', 'Español (Perú) · es-PE'],
  ['es-ES', 'Español (España) · es-ES'],
];

const HISTORY_NOTE = `<p class="history-note"><b>Nota histórica.</b> En el año 480 a. C. una alianza de ciudades griegas
defendió el paso de las Termópilas frente al ejército de Jerjes I. Junto a los espartanos de Leónidas I combatieron
miles de aliados griegos. La batalla real terminó en victoria persa, después de que los atacantes encontraran una
senda para rodear la posición. Esta partida es una simulación jugable, no una reconstrucción exacta.</p>`;

function controlsTable() {
  const rows = COMMANDS.filter((c) => c.id !== 'RESUME').map((c) => {
    const phrases = c.id === 'PAUSE'
      ? '«pausa» · «continuar» / «reanudar»'
      : c.aliases.map((a) => `«${a}»`).join(' / ') + (c.id === 'RELIEF' ? ' <small>(«fuego» es solo un alias de juego)</small>' : '');
    const icon = c.icon != null ? `<i class="icon" data-icon="${c.icon}" aria-hidden="true"></i>` : '<i class="icon" data-icon="6" aria-hidden="true"></i>';
    return `<tr><td>${icon}${esc(c.id === 'PAUSE' ? 'Pausa / Continuar' : c.label)}</td><td>${phrases}</td><td><kbd>${esc(c.keyLabel)}</kbd></td><td>${esc(c.help)}</td></tr>`;
  });
  rows.push('<tr><td><i class="icon" data-icon="5" aria-hidden="true"></i>Micrófono</td><td>—</td><td><kbd>V</kbd></td><td>Activa o desactiva la escucha.</td></tr>');
  return `<table class="controls-table">
    <thead><tr><th>Orden</th><th>Voz</th><th>Tecla</th><th>Efecto</th></tr></thead>
    <tbody>${rows.join('')}</tbody></table>`;
}

const REASONS = {
  campaign: 'La falange resistió las tres oleadas de la beta.',
  cohesion: 'La cohesión de la formación llegó a cero y la línea cedió.',
  breaches: `Demasiados enemigos abrieron brecha en la línea (${BREACH.maxBreaches}).`,
};

function fmtTime(ms) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Pantallas HTML superpuestas al lienzo: menú, controles, pausa y resultado.
 * Los botones llaman a `handlers`; no contienen reglas de juego.
 */
export class Screens {
  constructor(el, handlers) {
    this.el = el;
    this.handlers = handlers;
    this.current = null;
    el.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target || target.tagName === 'SELECT') return;
      this.#action(target.dataset.action);
    });
    el.addEventListener('change', (e) => {
      if (e.target.dataset.action === 'lang') handlers.onLang?.(e.target.value);
    });
  }

  #action(action) {
    const h = this.handlers;
    switch (action) {
      case 'start': return h.onStart();
      case 'controls': return this.controls();
      case 'back': return this.menu(this.lastMenu);
      case 'voice': return h.onVoiceToggle();
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
    this.current = name;
    this.el.innerHTML = html;
    this.el.dataset.transparent = String(transparent);
    this.el.hidden = false;
    // El foco va al botón principal para poder jugar solo con teclado.
    (this.el.querySelector('[data-autofocus]') ?? this.el.querySelector('button'))?.focus({ preventScroll: true });
  }

  hide() {
    this.current = null;
    this.el.hidden = true;
    this.el.innerHTML = '';
  }

  menu(opts = this.lastMenu ?? {}) {
    this.lastMenu = opts;
    const { voiceWanted = false, voiceSupported = true, lang = 'es-PE', note = '', noteKind = '' } = opts;
    const options = LANGS.map(([v, label]) => `<option value="${v}" ${v === lang ? 'selected' : ''}>${label}</option>`).join('');
    this.#show('menu', `
      <div class="panel">
        <h1>300: El Paso de las Termópilas
          <small>Estrategia táctica con órdenes de voz <span class="badge">Beta · Avance 1</span></small></h1>
        <p class="lead">Termópilas, 480 a. C. Dirige la falange aliada en el paso estrecho entre la montaña y el mar.
          Cambia de formación a tiempo para resistir tres oleadas.</p>
        <div class="menu-actions">
          <button class="btn btn-primary" type="button" data-action="start" data-autofocus>Comenzar</button>
          <button class="btn" type="button" data-action="controls">Controles</button>
          <button class="btn" type="button" data-action="voice" aria-pressed="${voiceWanted}" ${voiceSupported ? '' : 'disabled'}>
            <i class="icon" data-icon="5" aria-hidden="true"></i>${voiceWanted ? 'Micrófono activado' : 'Activar micrófono'}</button>
        </div>
        <label class="field">Idioma del reconocimiento
          <select data-action="lang">${options}</select></label>
        <p class="voice-note" data-voice-note data-kind="${noteKind}" role="status" aria-live="polite">${esc(note)}</p>
        <p class="fineprint">Puedes jugar la beta completa con teclado (<kbd>1</kbd>–<kbd>4</kbd>, <kbd>P</kbd>) o con los botones.
          El reconocimiento de voz depende del navegador (Chrome o Edge) y puede usar sus servicios en línea; el juego no graba
          ni guarda audio, solo interpreta las frases de las órdenes. Interpretación lúdica inspirada en un hecho histórico.</p>
      </div>`, { transparent: true });
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
        ${controlsTable()}
        <p class="fineprint">Las órdenes por voz se aceptan solo con la partida en marcha. Si dices algo que no está en la lista,
          no se ejecuta nada. El empuje y el relevo tienen enfriamiento. Si la resistencia llega a cero, la formación queda
          agotada: ordena relevo o escudos para recuperarla.</p>
        <div class="btn-row"><button class="btn" type="button" data-action="back" data-autofocus>Volver</button></div>
      </div>`);
  }

  pause() {
    this.#show('pause', `
      <div class="panel panel-wide">
        <h2>Partida pausada</h2>
        <p class="lead">La simulación está congelada. Di «continuar» o pulsa <kbd>P</kbd> / <kbd>Esc</kbd> para seguir.</p>
        <div class="btn-row">
          <button class="btn btn-primary" type="button" data-action="resume" data-autofocus>Continuar</button>
          <button class="btn" type="button" data-action="ask-restart">Reiniciar campaña</button>
          <button class="btn" type="button" data-action="ask-menu">Menú principal</button>
        </div>
        ${controlsTable()}
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
    const win = result.victory;
    const c = stats.commands;
    this.#show('result', `
      <div class="panel panel-wide ${win ? 'result-victory' : 'result-defeat'}">
        <h2>${win ? 'La línea resiste' : 'La línea ha cedido'}</h2>
        <p class="lead">${esc(REASONS[result.reason] ?? '')}</p>
        <div class="stats">
          <div class="stat"><span>Oleadas superadas</span><b>${result.wavesCleared} / 3</b></div>
          <div class="stat"><span>Tiempo</span><b>${fmtTime(result.timeMs)}</b></div>
          <div class="stat"><span>Enemigos repelidos</span><b>${stats.kills}</b></div>
          <div class="stat"><span>Caídos al mar</span><b>${stats.edgeKills}</b></div>
          <div class="stat"><span>Flechas bloqueadas</span><b>${stats.volleysBlocked} / ${stats.volleysBlocked + stats.volleysTaken}</b></div>
          <div class="stat"><span>Órdenes (voz · teclado · botón)</span><b>${c.voice} · ${c.keyboard} · ${c.button}</b></div>
        </div>
        ${HISTORY_NOTE}
        <div class="btn-row">
          <button class="btn btn-primary" type="button" data-action="retry" data-autofocus>Reintentar</button>
          <button class="btn" type="button" data-action="menu">Menú principal</button>
        </div>
      </div>`);
  }
}
