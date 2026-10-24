import { BREACH, PUSH, RELIEF } from '../config/balance.js';
import { getCommand } from '../data/commands.js';
import { MODE_LABELS } from '../systems/GameState.js';

const MODE_ICON = { SHIELDS: 0, SPEARS: 1, PUSH: 2, RELIEF: 3, EXHAUSTED: 4 };
const SOURCE_LABEL = { voice: 'Voz', keyboard: 'Teclado', button: 'Botón' };
export const MIC_TEXT = {
  unsupported: 'Voz no disponible en este navegador',
  off: 'Micrófono apagado',
  requesting: 'Solicitando micrófono…',
  listening: 'Escuchando órdenes',
  error: 'Error de voz',
};

/**
 * HUD en HTML (accesible con teclado y lectores de pantalla). Solo presenta
 * datos y envía órdenes; no duplica las reglas del juego.
 */
export class HudView {
  constructor(root = document) {
    this.top = root.getElementById('hud-top');
    this.bottom = root.getElementById('hud-bottom');
    this.alerts = root.getElementById('alerts');
    this.el = {};
    for (const node of root.querySelectorAll('[data-hud]')) this.el[node.dataset.hud] = node;
    this.buttons = Object.fromEntries([...root.querySelectorAll('.cmd')].map((b) => [b.dataset.cmd, b]));
    this.micBtn = root.getElementById('mic-btn');
    this.formationBlock = root.querySelector('.hud-formation');
    this.cache = new Map();
    this.el.maxBreaches.textContent = BREACH.maxBreaches;
  }

  show(visible) {
    this.top.hidden = !visible;
    this.bottom.hidden = !visible;
    if (!visible) this.alerts.replaceChildren();
  }

  #set(key, value, apply) {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    apply(value);
  }

  #meter(name, value) {
    const v = Math.round(value);
    this.#set(name, v, () => {
      this.el[name].textContent = v;
      this.el[`${name}Bar`].style.width = `${v}%`;
      this.el[name].closest('.meter').dataset.low = String(v <= 25);
    });
  }

  /** Refresca barras y estado (se llama varias veces por segundo desde HUDScene). */
  update(snap, wave) {
    this.#meter('cohesion', snap.cohesion);
    this.#meter('stamina', snap.stamina);
    this.#meter('morale', snap.morale);
    this.#set('wave', `${wave.index}|${wave.total}|${wave.name}`, () => {
      this.el.wave.textContent = wave.index + 1;
      this.el.waves.textContent = wave.total;
      this.el.waveName.textContent = wave.name;
    });
    this.#set('waveBar', Math.round(wave.progress * 100), (p) => { this.el.waveBar.style.width = `${p}%`; });
    this.#set('breaches', snap.breaches, (b) => {
      this.el.breaches.textContent = b;
      this.el.breaches.parentElement.dataset.danger = String(b >= BREACH.maxBreaches - 1);
    });
    this.#set('mode', snap.formationMode, (mode) => {
      this.el.mode.textContent = MODE_LABELS[mode];
      this.el.modeIcon.dataset.icon = MODE_ICON[mode];
      this.formationBlock.dataset.mode = mode;
      for (const [id, btn] of Object.entries(this.buttons)) btn.setAttribute('aria-pressed', String(id === mode));
    });
    this.#cooldown('PUSH', snap.pushReadyIn, PUSH.cooldownMs, 'Empuje listo', 'Empuje en enfriamiento');
    this.#cooldown('RELIEF', snap.reliefReadyIn, RELIEF.cooldownMs, 'Relevo disponible', 'Relevo no disponible');
    const exhausted = snap.formationMode === 'EXHAUSTED';
    this.#set('exhausted', exhausted, (ex) => {
      this.buttons.PUSH.dataset.blocked = String(ex);
    });
  }

  #cooldown(id, remaining, total, readyText, waitText) {
    const btn = this.buttons[id];
    const secs = Math.ceil(remaining / 1000);
    this.#set(`cd-${id}`, secs, () => {
      btn.querySelector('[data-state]').textContent = secs > 0 ? `${waitText} (${secs} s)` : readyText;
      btn.dataset.unavailable = String(secs > 0);
    });
    btn.querySelector('.cooldown').style.width = `${Math.max(0, Math.min(1, remaining / total)) * 100}%`;
  }

  /** Último comando recibido y si se ejecutó o no. */
  commandResult(result) {
    const src = SOURCE_LABEL[result.source] ?? result.source;
    const heard = result.transcript ? ` «${result.transcript}»` : '';
    const mark = result.status === 'rejected' ? '✗' : result.status === 'pending' ? '…' : '✓';
    this.el.lastCommand.textContent = `${src}${heard}: ${result.label.toUpperCase()} ${mark} ${result.message}`;
    this.el.lastCommand.dataset.status = result.status;
    const btn = this.buttons[result.id];
    if (btn) {
      btn.dataset.flash = result.accepted ? 'ok' : 'no';
      setTimeout(() => { delete btn.dataset.flash; }, 400);
    }
  }

  /** Frase oída que no produjo orden (desconocida, ambigua, poca confianza, repetida). */
  voiceHeard(e) {
    if (e.status === 'matched') return;
    const why = {
      unknown: 'no es una orden',
      ambiguous: 'contiene varias órdenes',
      'low-confidence': 'no se entendió con claridad',
      repeat: 'repetida: ignorada',
      empty: 'sin texto',
    }[e.status] ?? e.status;
    this.el.lastCommand.textContent = `Voz «${e.transcript}»: ${why}`;
    this.el.lastCommand.dataset.status = 'rejected';
    if (e.status !== 'repeat') this.alert(`«${e.transcript}» ${why}`, 'warn', 1800);
  }

  voiceStatus(status, message, wanted) {
    this.el.micStatus.textContent = message && status !== 'listening' ? message : MIC_TEXT[status] ?? status;
    this.el.micStatus.dataset.status = status;
    this.micBtn.dataset.status = status;
    this.micBtn.setAttribute('aria-pressed', String(!!wanted));
    this.micBtn.querySelector('.mic-text').textContent = wanted ? 'Voz activa' : 'Activar voz';
  }

  /** Aviso temporal en la banda de avisos. Devuelve el nodo para poder quitarlo. */
  alert(text, kind = 'info', ms = 1600, { icon } = {}) {
    const node = document.createElement('div');
    node.className = 'alert';
    node.dataset.kind = kind;
    if (icon != null) {
      const i = document.createElement('i');
      i.className = 'icon';
      i.dataset.icon = icon;
      i.setAttribute('aria-hidden', 'true');
      node.append(i);
    }
    node.append(text);
    this.alerts.append(node);
    while (this.alerts.children.length > 3) this.alerts.firstElementChild.remove();
    if (ms > 0) setTimeout(() => node.remove(), ms);
    return node;
  }

  clearAlerts() {
    this.alerts.replaceChildren();
  }

  /** Panel de Jerjes en la barra superior durante el enfrentamiento final. */
  setBoss(boss) {
    const panel = document.querySelector('.hud-boss');
    const wave = document.querySelector('.hud-wave');
    panel.hidden = !boss;
    wave.hidden = !!boss;
    if (!boss) return;
    const pct = Math.round((boss.resolve / boss.max) * 100);
    this.#set('bossBar', pct, (p) => { this.el.bossBar.style.width = `${p}%`; });
    this.#set('bossPhase', boss.standing, (st) => { this.el.bossPhase.textContent = st ? 'se ha levantado' : 'en su trono'; });
    this.#set('bossDecree', boss.decreeName ?? '', (d) => {
      this.el.bossDecree.textContent = d ? `Decreto: «${d}»` : `Determinación ${boss.resolve} / ${boss.max}`;
      panel.dataset.decree = String(!!d);
    });
    if (!boss.decreeName) this.el.bossDecree.textContent = `Determinación ${boss.resolve} / ${boss.max}`;
  }

  /** Rótulos de tecla en los botones según las asignaciones actuales. */
  setKeyLabels(keys, labelOf) {
    for (const [id, btn] of Object.entries(this.buttons)) btn.querySelector('kbd').textContent = labelOf(keys[id]);
    this.micBtn.querySelector('kbd').textContent = labelOf(keys.VOICE);
    document.querySelector('#pause-btn kbd').textContent = labelOf(keys.PAUSE);
  }

  /** En el tutorial la barra superior indica pasos en lugar de oleadas. */
  setWaveCaption(text) {
    document.querySelector('.hud-wave .hud-label').textContent = text;
  }

  static commandLabel(id) {
    return getCommand(id)?.label ?? id;
  }
}
