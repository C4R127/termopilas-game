const PORTRAIT = `${import.meta.env.BASE_URL}assets/images/ui/leonidas.png`;

/**
 * Panel de mensajes de Leónidas durante la campaña: retrato, nombre y texto.
 * No bloquea el juego: se oculta solo tras un tiempo proporcional al texto.
 */
export class CommanderView {
  constructor(el) {
    this.el = el;
    el.innerHTML = `
      <img class="tutorial-portrait" src="${PORTRAIT}" alt="" width="48" height="48" />
      <div class="commander-body">
        <div class="tutorial-step">Leónidas I</div>
        <p class="commander-text" data-cmdr="text" role="status" aria-live="polite"></p>
      </div>`;
    this.text = el.querySelector('[data-cmdr="text"]');
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
}
