// Utilidades del generador de pixel art: lienzo RGBA, primitivas y codificador PNG.
import { deflateSync } from 'node:zlib';

export const hex = (h) => (h == null ? 0 : ((parseInt(h.slice(1), 16) << 8) | 0xff) >>> 0);

export class Canvas {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Uint32Array(w * h);
  }

  set(x, y, c) {
    x = Math.round(x);
    y = Math.round(y);
    if (c == null || x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = typeof c === 'string' ? hex(c) : c;
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.px[y * this.w + x];
  }

  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  line(x0, y0, x1, y1, c) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  }

  disc(cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r + 0.3) this.set(x, y, c);
      }
    }
  }

  ellipse(cx, cy, rx, ry, c) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.05) this.set(x, y, c);
      }
    }
  }

  /** Copia los píxeles opacos de `src` en (dx, dy). */
  blit(src, dx, dy, { flipX = false } = {}) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const p = src.get(flipX ? src.w - 1 - x : x, y);
        if (p & 0xff) this.set(dx + x, dy + y, p);
      }
    }
  }

  /** Contorno de 1 px alrededor de los píxeles opacos (vecindad de 4). */
  outlined(color) {
    const out = new Canvas(this.w, this.h);
    const c = hex(color);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y) & 0xff) continue;
        if ((this.get(x - 1, y) | this.get(x + 1, y) | this.get(x, y - 1) | this.get(x, y + 1)) & 0xff) out.set(x, y, c);
      }
    }
    out.blit(this, 0, 0);
    return out;
  }

  /** Gira 90° (cuadrado) y apoya el resultado en el borde inferior: figura tendida. */
  lying() {
    const rot = new Canvas(this.w, this.h);
    let maxY = 0;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const p = this.get(x, y);
        if (!(p & 0xff)) continue;
        // Antihorario: la cabeza queda a la izquierda (cae de espaldas).
        rot.set(y, this.w - 1 - x, p);
        maxY = Math.max(maxY, this.w - 1 - x);
      }
    }
    const out = new Canvas(this.w, this.h);
    out.blit(rot, 0, this.h - 1 - maxY);
    return out;
  }
}

/** Une fotogramas del mismo tamaño en una tira horizontal (spritesheet). */
export function sheet(frames) {
  const { w, h } = frames[0];
  const out = new Canvas(w * frames.length, h);
  frames.forEach((f, i) => out.blit(f, i * w, 0));
  return out;
}

/** Ruido determinista en [0, 1). */
export function noise(x, y, seed = 1) {
  let n = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}

// ── PNG ─────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** PNG RGBA de 8 bits. */
export function encodePNG(canvas) {
  const { w, h, px } = canvas;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const stride = w * 4 + 1;
  const raw = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = px[y * w + x];
      const o = y * stride + 1 + x * 4;
      raw[o] = (p >>> 24) & 0xff;
      raw[o + 1] = (p >>> 16) & 0xff;
      raw[o + 2] = (p >>> 8) & 0xff;
      raw[o + 3] = p & 0xff;
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
