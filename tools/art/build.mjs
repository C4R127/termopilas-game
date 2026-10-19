// Genera el pixel art provisional de la beta (Avance 1) en public/assets/.
// Todo se dibuja por código: no hay recursos de terceros ni de la película «300».
// Uso: npm run art
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Canvas, encodePNG, hex, noise, sheet } from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'public', 'assets');

// Paleta del documento: bronce, rojo oscuro, piedra, arena, azul grisáceo y luz cálida.
const P = {
  outline: '#22160f',
  bronze: '#c2873a', bronzeDark: '#8a5a26', bronzeLight: '#ecc272',
  red: '#9e2b22', redDark: '#6a1a16', crest: '#c23a2c',
  skin: '#c98b5f', skinDark: '#94603e',
  leather: '#5b3a22', wood: '#82603a', steel: '#e2dccb',
  pBlue: '#3e5a7c', pBlueDark: '#2a3e58', pOchre: '#c9a14a', pCloth: '#e3d6b2',
  pWicker: '#a87f45', pWickerDark: '#6e5229', beard: '#2a1c14', pRed: '#8c3b2c',
  skyTop: '#33425e', sky2: '#4d5f7d', sky3: '#7f8ea2', sky4: '#c7ae8e', skyLow: '#e8c48c',
  sun: '#f6e2b0', farMount: '#6a7890', farMount2: '#58667e',
  rock: '#7a6b5d', rockDark: '#564a40', rockLight: '#9b8a76', rockShadow: '#40362f',
  sand: '#c9a873', sandDark: '#a88959', sandLight: '#dcc08c', path: '#b8976a',
  sea: '#2d5672', seaDark: '#22445c', seaLight: '#3f7190', foam: '#d2e2e3',
  shrub: '#56603a', shrubDark: '#3d4529', wall: '#a39079', wallDark: '#76654f',
  cream: '#f3e7c9', white: '#ffffff', warn: '#e0a030',
};
const C = Object.fromEntries(Object.entries(P).map(([k, v]) => [k, hex(v)]));

function save(rel, canvas) {
  const file = join(OUT, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, encodePNG(canvas));
  console.log(`  ${rel.padEnd(42)} ${canvas.w}×${canvas.h}`);
}

// ── Hoplita (20 × 20, mira a la derecha) ───────────────────────────────────

function hoplite({ bob = 0, lean = 0, shield = 'side', spear = 'up', legs = 0, tired = false } = {}) {
  const c = new Canvas(20, 20);
  const up = (y) => y + bob + (tired ? 1 : 0);
  const ux = (x, y) => x + (y < 14 ? lean : 0);

  // Lanza detrás del cuerpo cuando está en vertical o atrás.
  const drawSpear = () => {
    if (spear === 'up') {
      c.line(12, 18, 12, up(1), C.wood);
      c.rect(12, up(0) - 1, 1, 2, C.steel);
    } else if (spear === 'back') {
      c.line(3, up(17), 6, up(0), C.wood);
      c.set(6, up(0) - 1, C.steel);
    } else if (spear === 'level' || spear === 'thrust') {
      const off = spear === 'thrust' ? 3 : 0;
      c.line(ux(1 + off, 6), up(6), ux(15 + off, 6), up(6), C.wood);
      c.rect(ux(15 + off, 6), up(6), 2, 1, C.steel);
      c.set(ux(17 + off, 6), up(6), C.steel);
    } else if (spear === 'low') {
      c.line(2, up(9), 16, up(14), C.wood);
      c.set(17, up(14), C.steel);
    }
  };
  if (spear === 'up' || spear === 'back') drawSpear();

  // Piernas con grebas.
  const lx = legs === 1 ? [4, 9] : legs === 2 ? [6, 7] : [5, 8];
  for (const x of lx) {
    c.rect(x, 15, 2, 4, C.bronzeDark);
    c.rect(x, 15, 1, 3, C.bronze);
    c.rect(x, 19, 2, 1, C.leather);
  }
  // Túnica y coraza.
  c.rect(ux(4, 12), up(12), 7, 3, C.red);
  c.rect(ux(4, 14), up(14), 7, 1, C.redDark);
  c.rect(ux(5, 8), up(8), 5, 4, C.bronze);
  c.rect(ux(5, 8), up(8), 1, 4, C.bronzeLight);
  // Capa roja a la espalda.
  c.rect(ux(3, 8), up(8), 2, 6, C.redDark);
  // Brazo de la lanza.
  c.rect(ux(9, 9), up(9), 2, 2, C.skin);
  // Casco corintio con cimera.
  c.rect(ux(5, 3), up(3), 5, 5, C.bronze);
  c.rect(ux(5, 3), up(3), 1, 5, C.bronzeLight);
  c.rect(ux(8, 5), up(5), 2, 1, C.outline); // abertura del rostro
  c.set(ux(9, 6), up(6), C.skinDark);
  c.rect(ux(4, 1), up(1), 6, 2, C.crest);
  c.rect(ux(3, 2), up(2), 1, 2, C.crest);
  c.rect(ux(4, 1), up(1), 6, 1, C.red);

  // Escudo redondo (aspis).
  const shieldAt = { side: [10, 11, 4], front: [11, 8, 5], bash: [13, 10, 5], low: [10, 13, 4] }[shield];
  const [sx, sy, r] = shieldAt;
  c.disc(ux(sx, sy), up(sy), r, C.bronzeDark);
  c.disc(ux(sx, sy), up(sy), r - 1, C.bronze);
  c.disc(ux(sx, sy) - 1, up(sy) - 1, r - 3, C.bronzeLight);
  c.set(ux(sx, sy), up(sy), C.red); // emblema central
  if (spear !== 'up' && spear !== 'back') drawSpear();
  return c.outlined(P.outline);
}

function hopliteFrames() {
  return [
    hoplite({}), // 0-1 reposo
    hoplite({ bob: 1 }),
    hoplite({ shield: 'front', spear: 'back' }), // 2-3 escudos
    hoplite({ shield: 'front', spear: 'back', bob: 1 }),
    hoplite({ spear: 'level' }), // 4-5 lanzas
    hoplite({ spear: 'thrust' }),
    hoplite({ shield: 'bash', spear: 'back', lean: 1 }), // 6-7 empuje
    hoplite({ shield: 'bash', spear: 'back', lean: 2, legs: 1 }),
    hoplite({ shield: 'low', spear: 'low', tired: true }), // 8-9 agotada
    hoplite({ shield: 'low', spear: 'low', tired: true, bob: 1 }),
    hoplite({ legs: 1 }), // 10-11 caminar (relevo)
    hoplite({ legs: 2, bob: 1 }),
  ];
}

// ── Infantería persa con escudo de mimbre (20 × 20, mira a la derecha) ─────

function persian({ archer = false, legs = 0, bob = 0, lean = 0, pose = 'walk' } = {}) {
  const c = new Canvas(20, 20);
  const up = (y) => y + bob;
  const ux = (x, y) => x + (y < 14 ? lean : 0);
  const tunic = archer ? C.pOchre : C.pBlue;
  const tunicDark = archer ? C.bronzeDark : C.pBlueDark;
  const trim = archer ? C.pRed : C.pOchre;

  if (archer) {
    // Carcaj a la espalda.
    c.rect(ux(3, 6), up(6), 2, 6, C.leather);
    c.rect(ux(3, 5), up(5), 1, 1, C.pCloth);
    c.rect(ux(4, 4), up(4), 1, 2, C.pCloth);
  }
  // Pantalones y piernas.
  const lx = legs === 1 ? [4, 9] : legs === 2 ? [6, 7] : [5, 8];
  for (const x of lx) {
    c.rect(x, 15, 2, 4, C.pCloth);
    c.rect(x, 19, 2, 1, C.leather);
  }
  // Túnica con ribete.
  c.rect(ux(4, 8), up(8), 7, 7, tunic);
  c.rect(ux(4, 8), up(8), 1, 7, tunicDark);
  c.rect(ux(4, 14), up(14), 7, 1, trim);
  c.rect(ux(7, 8), up(8), 1, 6, trim);
  // Cabeza: gorro de fieltro, rostro y barba.
  c.rect(ux(5, 4), up(4), 5, 4, C.skin);
  c.rect(ux(5, 6), up(6), 1, 2, C.skinDark);
  c.rect(ux(7, 6), up(6), 3, 2, C.beard);
  c.set(ux(9, 5), up(5), C.outline); // ojo
  c.rect(ux(4, 1), up(1), 6, 3, C.pCloth);
  c.rect(ux(4, 3), up(3), 2, 3, C.pCloth); // orejeras del tocado
  c.rect(ux(5, 1), up(1), 4, 1, trim);

  if (archer) {
    // Arco: de lado al caminar, alzado al apuntar.
    if (pose === 'draw' || pose === 'release') {
      const x = ux(13, 7);
      c.line(x, up(2), x + 2, up(7), C.wood);
      c.line(x + 2, up(7), x, up(12), C.wood);
      c.line(x, up(2), pose === 'draw' ? x - 3 : x, up(7), C.pCloth);
      c.line(pose === 'draw' ? x - 3 : x, up(7), x, up(12), C.pCloth);
      if (pose === 'draw') c.line(x - 3, up(7), x + 4, up(7), C.wood);
      c.rect(ux(9, 7), up(7), 3, 2, C.skin);
    } else {
      c.line(ux(11, 6), up(6), ux(12, 10), up(10), C.wood);
      c.line(ux(12, 10), up(10), ux(11, 14), up(14), C.wood);
      c.rect(ux(9, 10), up(10), 2, 2, C.skin);
    }
  } else {
    // Lanza corta.
    if (pose === 'attack') {
      c.line(ux(2, 9), up(9), ux(17, 9), up(9), C.wood);
      c.rect(ux(17, 9), up(9), 2, 1, C.steel);
    } else if (pose === 'raise') {
      c.line(ux(4, 11), up(11), ux(14, 3), up(3), C.wood);
      c.rect(ux(14, 2), up(2), 1, 2, C.steel);
    } else {
      c.line(ux(13, 17), up(17), ux(13, 2), up(2), C.wood);
      c.rect(ux(13, 0), up(0), 1, 2, C.steel);
    }
    // Escudo rectangular de mimbre (spara).
    const sx = ux(11, 6);
    c.rect(sx, up(5), 4, 11, C.pWicker);
    for (let y = 0; y < 11; y += 2) c.rect(sx, up(5) + y, 4, 1, C.pWickerDark);
    c.rect(sx + 3, up(5), 1, 11, C.pWickerDark);
  }
  return c.outlined(P.outline);
}

function infantryFrames() {
  const f = [
    persian({ legs: 1 }), persian({ legs: 0, bob: 1 }), persian({ legs: 2 }), persian({ legs: 0, bob: 1 }), // 0-3 avanzar
    persian({ pose: 'raise' }), persian({ pose: 'attack', lean: 1 }), // 4-5 atacar
    persian({ lean: -1, bob: 1 }), // 6 aturdido
  ];
  f.push(persian({}).lying()); // 7 caído
  return f;
}

function archerFrames() {
  const f = [
    persian({ archer: true, legs: 1 }), persian({ archer: true, bob: 1 }), persian({ archer: true, legs: 2 }), persian({ archer: true, bob: 1 }),
    persian({ archer: true, pose: 'draw' }), persian({ archer: true, pose: 'release' }), // 4-5 apuntar y disparar
    persian({ archer: true, lean: -1, bob: 1 }), // 6 aturdido
  ];
  f.push(persian({ archer: true }).lying()); // 7 caído
  return f;
}

// ── Escenario: el paso entre la ladera del Calídromo y el mar (320 × 180) ──

function background() {
  const W = 320;
  const H = 180;
  const c = new Canvas(W, H);
  // Cielo del amanecer con bandas tramadas.
  const bands = [[0, C.skyTop], [18, C.sky2], [36, C.sky3], [56, C.sky4], [72, C.skyLow]];
  for (let y = 0; y < 100; y++) {
    for (let x = 0; x < W; x++) {
      let i = bands.length - 1;
      while (i > 0 && y < bands[i][0]) i--;
      const next = bands[i + 1];
      const dither = next && y >= next[0] - 3 && (x + y) % 2 === 0;
      c.set(x, y, dither ? next[1] : bands[i][1]);
    }
  }
  c.disc(262, 66, 9, C.skyLow);
  c.disc(262, 66, 7, C.sun);
  // Montañas lejanas de Eubea, al otro lado del golfo.
  for (let x = 0; x < W; x++) {
    const h1 = 78 + Math.sin(x / 23) * 5 + Math.sin(x / 9 + 1) * 2;
    const h2 = 86 + Math.sin(x / 31 + 2) * 4;
    for (let y = Math.round(h1); y < 100; y++) c.set(x, y, C.farMount);
    for (let y = Math.round(h2); y < 100; y++) c.set(x, y, C.farMount2);
  }
  // Mar del golfo al fondo.
  for (let y = 94; y < 112; y++) for (let x = 0; x < W; x++) c.set(x, y, noise(x, y, 3) < 0.08 ? C.seaLight : C.sea);
  // Ladera rocosa del monte a la izquierda, que cae hacia el paso.
  for (let x = 0; x < W; x++) {
    const top = Math.round(8 + x * 0.42 + Math.sin(x / 7) * 3 + Math.sin(x / 17) * 5);
    if (top > 112) continue;
    for (let y = top; y < 114; y++) {
      const n = noise(x, y, 7);
      const depth = y - top;
      let col = depth < 2 ? C.rockLight : n < 0.18 ? C.rockDark : n > 0.92 ? C.rockLight : C.rock;
      if (depth > 3 && noise(x >> 2, y >> 1, 21) < 0.06) col = C.rockShadow; // grietas y estratos
      c.set(x, y, col);
    }
    // Matorrales en la ladera.
    if (noise(x, 1, 11) < 0.07 && top < 104) {
      c.disc(x, top + 4, 2, C.shrubDark);
      c.disc(x, top + 3, 1.5, C.shrub);
    }
  }
  // Suelo del paso.
  for (let y = 112; y < 153; y++) {
    for (let x = 0; x < W; x++) {
      const n = noise(x >> 1, y >> 1, 5);
      let col = n < 0.07 ? C.sandDark : n > 0.95 ? C.sandLight : C.sand;
      if (y > 126 && y < 140 && n > 0.55 && n < 0.62) col = C.path; // huellas del camino
      c.set(x, y, col);
    }
  }
  for (let x = 0; x < W; x++) c.set(x, 112, C.sandDark);
  // Borde del acantilado: más quebrado justo delante de la falange (zona de peligro).
  for (let x = 0; x < W; x++) {
    const danger = x > 96 && x < 150;
    const edge = 153 + (danger ? Math.round(noise(x, 0, 9) * 2) : 0);
    for (let y = edge; y < 160; y++) c.set(x, y, y === edge ? (danger ? C.rockDark : C.rockLight) : noise(x, y, 4) < 0.3 ? C.rockShadow : C.rockDark);
    if (danger && noise(x, 2, 13) < 0.2) c.set(x, edge - 1, C.rockDark); // piedras sueltas
    if (danger && x % 11 === 0) c.line(x, edge - 2, x + 1, edge + 3, C.rockShadow); // grietas del borde
  }
  // Mar en primer plano, bajo el acantilado.
  for (let y = 160; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const wave = Math.sin(x / 6 + y * 1.3) > 0.85;
      c.set(x, y, wave ? C.seaLight : y < 163 ? C.seaDark : C.sea);
    }
  }
  for (let x = 0; x < W; x += 1) if (noise(x, 160, 2) < 0.35) c.set(x, 160, C.foam);
  // Muro de los focenses en ruinas, detrás de la formación (zona protegida).
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i < 4; i++) {
      const bx = 4 + i * 7 + (row % 2) * 3;
      const by = 104 + row * 5;
      if (row === 0 && i === 3) continue;
      c.rect(bx, by, 6, 4, C.wall);
      c.rect(bx, by + 3, 6, 1, C.wallDark);
      c.rect(bx + 5, by, 1, 4, C.wallDark);
    }
  }
  return c;
}

// ── Efectos, iconos y fuente ───────────────────────────────────────────────

function arrow() {
  const c = new Canvas(8, 3);
  c.line(1, 1, 6, 1, C.wood);
  c.set(7, 1, C.steel);
  c.set(6, 0, C.steel);
  c.set(6, 2, C.steel);
  c.set(0, 0, C.pCloth);
  c.set(0, 2, C.pCloth);
  c.set(1, 0, C.pCloth);
  c.set(1, 2, C.pCloth);
  return c;
}

function particles() {
  const f = [0, 1, 2, 3].map(() => new Canvas(4, 4));
  f[0].disc(1.5, 1.5, 1.6, C.sandLight); // polvo
  f[0].set(2, 2, C.sand);
  f[1].rect(1, 0, 1, 4, C.bronzeLight); // destello
  f[1].rect(0, 1, 4, 1, C.bronzeLight);
  f[1].set(1, 1, C.white);
  f[2].disc(1.5, 1.5, 1.6, C.foam); // salpicadura
  f[2].set(1, 1, C.white);
  f[3].disc(1.5, 1.5, 1.4, C.rockDark); // piedra o tierra
  return sheet(f);
}

function icons() {
  const make = () => new Canvas(12, 12);
  const shield = make();
  shield.disc(5.5, 5.5, 5, C.bronzeDark);
  shield.disc(5.5, 5.5, 4, C.bronze);
  shield.disc(4.5, 4.5, 2, C.bronzeLight);
  shield.disc(5.5, 5.5, 1, C.red);
  const spears = make();
  spears.line(1, 10, 9, 2, C.wood);
  spears.line(9, 2, 10, 1, C.steel);
  spears.rect(9, 1, 2, 2, C.steel);
  spears.line(1, 6, 8, 6, C.wood);
  spears.rect(8, 5, 2, 3, C.steel);
  spears.set(10, 6, C.steel);
  const push = make();
  push.disc(4, 6, 3.5, C.bronze);
  push.disc(4, 6, 1, C.red);
  push.rect(7, 5, 3, 2, C.cream);
  push.line(9, 3, 11, 6, C.cream);
  push.line(11, 6, 9, 9, C.cream);
  const relief = make();
  relief.line(2, 3, 9, 3, C.cream);
  relief.line(9, 3, 7, 1, C.cream);
  relief.line(9, 3, 7, 5, C.cream);
  relief.line(2, 8, 9, 8, C.bronzeLight);
  relief.line(2, 8, 4, 6, C.bronzeLight);
  relief.line(2, 8, 4, 10, C.bronzeLight);
  const warn = make();
  for (const x of [2, 6, 10]) {
    warn.line(x - 1, 1, x - 1 + 2, 8, C.cream);
    warn.set(x + 1, 9, C.warn);
    warn.set(x + 1, 10, C.warn);
  }
  const mic = make();
  mic.rect(4, 1, 4, 6, C.cream);
  mic.rect(5, 0, 2, 1, C.cream);
  mic.line(2, 5, 2, 7, C.cream);
  mic.line(9, 5, 9, 7, C.cream);
  mic.line(3, 8, 8, 8, C.cream);
  mic.rect(5, 9, 2, 2, C.cream);
  mic.rect(3, 11, 6, 1, C.cream);
  const pause = make();
  pause.rect(3, 2, 2, 8, C.cream);
  pause.rect(7, 2, 2, 8, C.cream);
  return sheet([shield, spears, push, relief, warn, mic, pause].map((i) => i.outlined(P.outline)));
}

// Fuente 3 × 5 en celdas de 4 × 6 (con sombra). Solo mayúsculas sin tildes.
export const FONT_CHARS = ' !?-+.,:%/0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GLYPHS = {
  ' ': '...,...,...,...,...', '!': '.#.,.#.,.#.,...,.#.', '?': '##.,..#,.#.,...,.#.', '-': '...,...,###,...,...',
  '+': '...,.#.,###,.#.,...', '.': '...,...,...,...,.#.', ',': '...,...,...,.#.,#..', ':': '...,.#.,...,.#.,...',
  '%': '#.#,..#,.#.,#..,#.#', '/': '..#,..#,.#.,#..,#..',
  0: '###,#.#,#.#,#.#,###', 1: '.#.,##.,.#.,.#.,###', 2: '##.,..#,.#.,#..,###', 3: '##.,..#,.#.,..#,##.',
  4: '#.#,#.#,###,..#,..#', 5: '###,#..,##.,..#,##.', 6: '.##,#..,###,#.#,###', 7: '###,..#,.#.,.#.,.#.',
  8: '###,#.#,###,#.#,###', 9: '###,#.#,###,..#,##.',
  A: '.#.,#.#,###,#.#,#.#', B: '##.,#.#,##.,#.#,##.', C: '.##,#..,#..,#..,.##', D: '##.,#.#,#.#,#.#,##.',
  E: '###,#..,##.,#..,###', F: '###,#..,##.,#..,#..', G: '.##,#..,#.#,#.#,.##', H: '#.#,#.#,###,#.#,#.#',
  I: '###,.#.,.#.,.#.,###', J: '..#,..#,..#,#.#,.#.', K: '#.#,#.#,##.,#.#,#.#', L: '#..,#..,#..,#..,###',
  M: '#.#,###,###,#.#,#.#', N: '##.,#.#,#.#,#.#,#.#', O: '.#.,#.#,#.#,#.#,.#.', P: '##.,#.#,##.,#..,#..',
  Q: '.#.,#.#,#.#,##.,.##', R: '##.,#.#,##.,#.#,#.#', S: '.##,#..,.#.,..#,##.', T: '###,.#.,.#.,.#.,.#.',
  U: '#.#,#.#,#.#,#.#,.##', V: '#.#,#.#,#.#,.#.,.#.', W: '#.#,#.#,###,###,#.#', X: '#.#,#.#,.#.,#.#,#.#',
  Y: '#.#,#.#,.#.,.#.,.#.', Z: '###,..#,.#.,#..,###',
};
export const FONT_PER_ROW = 16;

function font() {
  const rows = Math.ceil(FONT_CHARS.length / FONT_PER_ROW);
  const c = new Canvas(FONT_PER_ROW * 4, rows * 6);
  [...FONT_CHARS].forEach((ch, i) => {
    const ox = (i % FONT_PER_ROW) * 4;
    const oy = Math.floor(i / FONT_PER_ROW) * 6;
    const g = GLYPHS[ch].split(',');
    g.forEach((row, y) => [...row].forEach((v, x) => v === '#' && c.set(ox + x + 1, oy + y + 1, C.outline)));
    g.forEach((row, y) => [...row].forEach((v, x) => v === '#' && c.set(ox + x, oy + y, C.white)));
  });
  return c;
}

console.log('Generando pixel art provisional…');
save('images/backgrounds/pass.png', background());
save('images/characters/hoplite.png', sheet(hopliteFrames()));
save('images/characters/persian-infantry.png', sheet(infantryFrames()));
save('images/characters/persian-archer.png', sheet(archerFrames()));
save('images/effects/arrow.png', arrow());
save('images/effects/particles.png', particles());
save('images/ui/icons.png', icons());
save('fonts/pixel-3x5.png', font());
writeFileSync(join(OUT, 'fonts', 'pixel-3x5.json'), JSON.stringify({ chars: FONT_CHARS, width: 4, height: 6, perRow: FONT_PER_ROW }, null, 2));
console.log('Listo.');
