// Codifica PNG minimale (RGBA 8 bit) usando CompressionStream, disponibile nei Workers.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

async function deflate(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** @param {Uint8Array} rgba pixel width*height*4 */
export async function encodePng(width, height, rgba) {
  const raw = new Uint8Array(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filtro "none"
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr.set([8, 6, 0, 0, 0], 8); // 8 bit, RGBA
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', await deflate(raw)),
    chunk('IEND', new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** Piccola tela per disegnare rettangoli, cerchi e linee. */
export class Canvas {
  constructor(width, height, bg) {
    this.width = width;
    this.height = height;
    this.data = new Uint8Array(width * height * 4);
    this.rect(0, 0, width, height, bg);
  }
  px(x, y, [r, g, b]) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    const i = (y * this.width + x) * 4;
    this.data[i] = r; this.data[i + 1] = g; this.data[i + 2] = b; this.data[i + 3] = 255;
  }
  rect(x, y, w, h, color) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, color);
  }
  outline(x, y, w, h, t, color) {
    this.rect(x, y, w, t, color); this.rect(x, y + h - t, w, t, color);
    this.rect(x, y, t, h, color); this.rect(x + w - t, y, t, h, color);
  }
  circle(cx, cy, r, color) {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) this.px(cx + i, cy + j, color);
  }
  cross(x, y, size, t, color) {
    for (let k = 0; k < size; k++) {
      for (let d = 0; d < t; d++) { this.px(x + k + d, y + k, color); this.px(x + size - 1 - k + d, y + k, color); }
    }
  }
  png() { return encodePng(this.width, this.height, this.data); }
}
