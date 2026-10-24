const PORTRAIT = `${import.meta.env.BASE_URL}assets/images/ui/leonidas.png`;

/**
 * Panel de mensajes de Leónidas durante la campaña: retrato, nombre y texto.
 * No bloquea el juego: se oculta solo tras un tiempo proporcional al texto.
 */
export class CommanderView {
  constructor(el, { onToggleNarration }) {
    this.el = el;
    el.innerHTML = `
      <img class="tutorial-portrait" src="${PORTRAIT}" alt="" width="48" height="48" />
      <div class="commander-body">
        <div class="tutorial-step">Leónidas I</div>
        <p class="commander-text" data-cmdr="text" role="status" aria-live="polite"></p>
      </div>
      <button class="btn btn-small narration-btn" type="button" data-cmdr="narration" aria-pressed="false"
        title="Leer en voz alta los mensajes de Leónidas"><span aria-hidden="true">🔊</span><span class="sr-only">Leer en voz alta</span></button>`;
    this.text = el.querySelector('[data-cmdr="text"]');
    this.narrationBtn = el.querySelector('[data-cmdr="narration"]');
    this.narrationBtn.addEventListener('click', onToggleNarration);
    this.timer = null;
  }

  show(text) {
    clearTimeout(this.timer);
    this.text.textContent = text;
    this.el.hidden = false;
    this.el.classList.remove('commander-in');
    void this.el.offsetWidth; // reinicia la animación de entrada
    this.el.classList.add('commander-in');
    this.timer = setTimeout(() => this.hide(), 4000 + text.length * 45);
  }

  hide() {
    clearTimeout(this.timer);
    this.el.hidden = true;
  }

  setNarration(on, supported) {
    this.narrationBtn.setAttribute('aria-pressed', String(on));
    this.narrationBtn.disabled = !supported;
    this.narrationBtn.title = supported ? 'Leer en voz alta los mensajes de Leónidas' : 'Este navegador no puede leer en voz alta';
  }
}
