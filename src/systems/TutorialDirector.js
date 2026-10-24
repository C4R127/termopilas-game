import { LANE } from '../config/balance.js';
import { EVENTS } from './EventBus.js';
import { MODES } from './GameState.js';

export const TUTORIAL_EVENT = 'TUTORIAL_STEP';

/**
 * Pasos del tutorial silencioso (sección 7.5): texto en pantalla, una situación
 * preparada y un objetivo. Los pasos con `next` esperan a que el jugador pulse
 * «Continuar»; el resto avanza al cumplir el objetivo.
 */
export const TUTORIAL_STEPS = [
  {
    id: 'intro',
    text: 'Soy Leónidas. Escúchame bien, {aliado}: defendemos el paso entre la montaña y el mar. La falange obedece órdenes cortas: puedes darlas con la voz, con el teclado o con los botones de abajo.',
    next: true,
  },
  {
    id: 'spears',
    text: 'Llega la infantería persa. Ordena LANZAS para atacar a los enemigos que se acercan.',
    setup(t) {
      t.forceMode(MODES.SHIELDS);
      t.spawn('infantry', 1, 230);
    },
    goal: (t) => t.defeatedAll(),
    retry(t) {
      if (t.cleared()) {
        t.setHint('Ese enemigo cruzó la línea. Prueba otra vez: ordena LANZAS antes de que llegue.');
        t.spawn('infantry', 1, 230);
      }
    },
  },
  {
    id: 'shields',
    text: 'Un arquero toma posición. Cuando aparezca el aviso ¡FLECHAS!, ordena ESCUDOS antes del impacto.',
    setup(t) {
      t.archer = t.spawn('archer', 0, 250);
      t.archer.volleysLeft = 99; // dispara hasta que lo consigas
    },
    goal: (t) => t.blocked > 0,
    after(t) {
      if (t.archer && !t.archer.removed) t.archer.volleysLeft = 0; // sin flechas, carga cuerpo a cuerpo
    },
  },
  {
    id: 'finish-archer',
    text: '¡Bloqueadas! Sin flechas, el arquero carga contra la línea. Vuelve a ordenar LANZAS.',
    goal: (t) => t.cleared(),
    retry(t) {
      if (t.sim.state.formationMode === MODES.SHIELDS && !t.hint) t.setHint('Con los escudos en alto la falange no ataca: ordena LANZAS.');
    },
  },
  {
    id: 'push',
    text: 'Dos enemigos avanzan junto al acantilado. Cuando estén pegados a la línea, ordena EMPUJEN para hacerlos caer al mar.',
    setup(t) {
      t.forceMode(MODES.SHIELDS);
      t.edgeAtStart = t.sim.state.stats.edgeKills;
      t.spawn('infantry', LANE.edgeRow, 200);
      t.spawn('infantry', LANE.edgeRow, 216);
    },
    goal: (t) => t.sim.state.stats.edgeKills > t.edgeAtStart,
    retry(t) {
      // Si los venció de otra forma, aparece otro enemigo para practicar el empuje.
      if (t.cleared()) {
        t.setHint('Inténtalo con EMPUJEN cuando el enemigo esté pegado a la línea, junto al borde.');
        t.spawn('infantry', LANE.edgeRow, 200);
      }
    },
  },
  {
    id: 'elite',
    text: 'La guardia de élite resiste las lanzas. Ordena EMPUJEN para desequilibrarla y, justo después, LANZAS.',
    setup(t) {
      t.forceMode(MODES.SPEARS);
      t.sim.state.stamina = 100;
      t.sim.state.cooldowns.PUSH = 0;
      t.spawn('elite', 1, 200);
    },
    goal: (t) => t.cleared(),
    retry(t) {
      if (!t.hint && t.sim.state.simTime - t.stepStart > 9000) t.setHint('Las lanzas apenas le hacen daño: EMPUJEN primero y ataca mientras se tambalea.');
    },
  },
  {
    id: 'relief',
    text: 'La primera línea está agotada: la barra de resistencia está baja. Ordena RELEVO para que la reserva ocupe su lugar.',
    setup(t) {
      t.sim.state.stamina = 12;
      t.sim.state.cooldowns.RELIEF = 0;
      t.reliefDone = false;
    },
    goal: (t) => t.reliefDone,
  },
  {
    id: 'voice',
    text: 'Con la voz basta una palabra: «escudos», «lanzas», «empujen» o «relevo»; «pausa» y «continuar» detienen y reanudan. Activa el micrófono con su botón o la tecla V cuando quieras.',
    next: true,
  },
  {
    id: 'done',
    text: 'Has aprendido las cuatro órdenes, {aliado}. Lee los avisos, cuida la cohesión y resiste las cinco oleadas y los decretos de Jerjes. ¡A la batalla!',
    next: true,
    finish: true,
  },
];

/** Dirige el tutorial sobre una BattleSimulation sin oleadas. Sin dependencias de Phaser. */
export class TutorialDirector {
  constructor(sim, bus, steps = TUTORIAL_STEPS) {
    this.sim = sim;
    this.bus = bus;
    this.steps = steps;
    this.index = -1;
    this.blocked = 0;
    this.hint = '';
    this.finished = false;
    this.offs = [
      bus.on(EVENTS.VOLLEY_IMPACT, (e) => {
        if (e.blocked) this.blocked++;
        else if (this.step?.id === 'shields') this.setHint('Las flechas te alcanzaron: ordena ESCUDOS en cuanto veas el aviso.');
      }),
      bus.on(EVENTS.RELIEF_DONE, () => { this.reliefDone = true; }),
    ];
  }

  destroy() {
    this.offs.forEach((off) => off());
  }

  get step() {
    return this.steps[this.index] ?? null;
  }

  start() {
    this.#go(0);
  }

  /** Botón «Continuar» de los pasos informativos. */
  next() {
    if (!this.step?.next) return;
    if (this.step.finish) {
      this.finished = true;
      this.#emit();
      return;
    }
    this.#go(this.index + 1);
  }

  /** Llamado tras cada paso de simulación. */
  update() {
    const step = this.step;
    if (!step || step.next || this.finished) return;
    if (step.goal(this)) {
      step.after?.(this);
      this.#go(this.index + 1);
    } else {
      step.retry?.(this);
    }
  }

  cleared() {
    return this.sim.enemies.every((e) => e.removed);
  }

  /** Todos los enemigos del paso cayeron (ninguno abrió brecha). */
  defeatedAll() {
    return this.cleared() && this.sim.state.stats.kills > this.killsAt && this.sim.state.breaches === this.breachesAt;
  }

  setHint(hint) {
    this.hint = hint;
    this.#emit();
  }

  spawn(type, row, x) {
    return this.sim.spawn(type, row, x);
  }

  /** Coloca la formación en una postura sin pasar por las órdenes (preparación del paso). */
  forceMode(mode) {
    const s = this.sim.state;
    s.formationMode = mode;
    s.stance = mode;
    s.busyUntil = 0;
    s.pending = null;
    this.bus.emit(EVENTS.FORMATION_CHANGED, { mode, previous: null, reason: 'tutorial' });
  }

  #go(index) {
    this.index = index;
    this.hint = '';
    this.stepStart = this.sim.state.simTime;
    this.killsAt = this.sim.state.stats.kills;
    this.breachesAt = this.sim.state.breaches;
    this.step?.setup?.(this);
    this.#emit();
  }

  #emit() {
    const step = this.step;
    this.bus.emit(TUTORIAL_EVENT, {
      index: this.index,
      total: this.steps.length,
      id: step?.id,
      text: step?.text ?? '',
      hint: this.hint,
      awaitNext: !!step?.next,
      finished: this.finished,
    });
  }
}
