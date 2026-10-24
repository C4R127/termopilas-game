const PORTRAIT = `${import.meta.env.BASE_URL}assets/images/ui/leonidas.png`;

/**
 * Panel del tutorial: retrato de Leónidas, instrucción del paso, pista y
 * botones. Es texto en pantalla (tutorial silencioso, sección 7.5); la lectura
 * en voz alta es opcional y se activa con el botón 🔊 o en Ajustes.
 */
export class TutorialView {
  constructor(el, { onNext, onExit, onCampaign, onToggleNarration }) {
    this.el = el;
    el.innerHTML = `
      <img class="tutorial-portrait" src="${PORTRAIT}" alt="Leónidas I" width="64" height="64" />
      <div class="tutorial-body">
        <div class="tutorial-step" data-tut="step"></div>
        <p class="tutorial-text" data-tut="text" role="status" aria-live="polite"></p>
        <p class="tutorial-hint" data-tut="hint" role="status" aria-live="polite"></p>
      </div>
      <div class="tutorial-actions">
        <button class="btn btn-primary" type="button" data-tut="next">Continuar</button>
        <button class="btn btn-primary" type="button" data-tut="campaign" hidden>Comenzar campaña</button>
        <button class="btn btn-small" type="button" data-tut="narration" aria-pressed="false"><span aria-hidden="true">🔊</span> Leer en voz alta</button>
        <button class="btn btn-small" type="button" data-tut="exit">Salir del tutorial</button>
      </div>`;
    this.q = (k) => el.querySelector(`[data-tut="${k}"]`);
    this.q('next').addEventListener('click', onNext);
    this.q('exit').addEventListener('click', onExit);
    this.q('campaign').addEventListener('click', onCampaign);
    this.q('narration').addEventListener('click', onToggleNarration);
  }

  setNarration(on, supported) {
    const btn = this.q('narration');
    btn.setAttribute('aria-pressed', String(on));
    btn.disabled = !supported;
    btn.title = supported ? 'Leónidas lee en voz alta cada indicación' : 'Este navegador no puede leer en voz alta';
  }

  show(visible) {
    this.el.hidden = !visible;
  }

  render({ index, total, text, hint, awaitNext, finished }) {
    this.q('step').textContent = `Paso ${index + 1} de ${total}`;
    this.q('text').textContent = text;
    this.q('hint').textContent = hint;
    this.q('hint').hidden = !hint;
    this.q('next').hidden = !awaitNext || finished;
    this.q('campaign').hidden = !finished;
    this.q('exit').textContent = finished ? 'Volver al menú' : 'Salir del tutorial';
    const focus = finished ? this.q('campaign') : awaitNext ? this.q('next') : null;
    focus?.focus({ preventScroll: true });
  }
}
