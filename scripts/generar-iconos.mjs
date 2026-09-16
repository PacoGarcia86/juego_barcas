// [P-202] Los iconos de la aplicación instalable. Se GENERAN, no se dibujan a
// mano: así el día que cambie el color de latón no hay seis ficheros que
// alguien se olvida de regenerar.
//
// No descarga nada ni necesita un editor: dibuja un SVG y lo rasteriza con el
// canvas de `sharp` si está, y si no, con un PNG escrito a mano. Aquí se usa la
// segunda vía para no añadir una dependencia por seis iconos.

import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const SALIDA = new URL('../public/', import.meta.url);
mkdirSync(SALIDA, { recursive: true });

const FONDO = [4, 18, 28];
const LATON = [242, 193, 78];
const AGUA = [37, 110, 140];

/** Un PNG de color verdadero, escrito a mano. */
function png(ancho, alto, pixel) {
  const filas = [];
  for (let y = 0; y < alto; y++) {
    const fila = Buffer.alloc(ancho * 4 + 1);
    fila[0] = 0; // filtro «ninguno»
    for (let x = 0; x < ancho; x++) {
      const [r, g, b, a] = pixel(x / ancho, y / alto);
      fila.set([r, g, b, a], 1 + x * 4);
    }
    filas.push(fila);
  }
  const datos = deflateSync(Buffer.concat(filas), { level: 9 });

  const trozo = (tipo, cuerpo) => {
    const largo = Buffer.alloc(4);
    largo.writeUInt32BE(cuerpo.length);
    const con = Buffer.concat([Buffer.from(tipo, 'ascii'), cuerpo]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(con) >>> 0);
    return Buffer.concat([largo, con, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', datos),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

const TABLA = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA[(c ^ b) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}

/** Una barca de latón sobre el agua, en silueta. */
function dibujo(margen) {
  return (u, v) => {
    // Fuera del área segura del icono maskable, solo fondo.
    const x = (u - 0.5) / (1 - margen);
    const y = (v - 0.5) / (1 - margen);
    if (Math.abs(x) > 0.5 || Math.abs(y) > 0.5) return [...FONDO, 255];

    // Agua: dos ondas por debajo de la línea de flotación.
    if (y > 0.1) {
      const onda = Math.sin(x * 16) * 0.018 + Math.sin(x * 27 + 1.7) * 0.01;
      if (y > 0.14 + onda) return [...AGUA, 255];
      return [...LATON, 255];
    }
    // Casco: media elipse con la proa levantada.
    const casco = Math.abs(x) < 0.34 && y > -0.02 && y < 0.11 - Math.pow(Math.abs(x) / 0.34, 3) * 0.06;
    // Vela: un triángulo.
    const vela = y < 0 && y > -0.36 && x > -0.02 && x < 0.02 + (-y) * 0.62;
    // Mástil.
    const mastil = Math.abs(x + 0.02) < 0.012 && y > -0.38 && y < 0.02;
    if (casco || vela || mastil) return [...LATON, 255];
    return [...FONDO, 255];
  };
}

const iconos = [
  ['icon-192.png', 192, 0.06],
  ['icon-512.png', 512, 0.06],
  ['icon-maskable-192.png', 192, 0.2],
  ['icon-maskable-512.png', 512, 0.2],
  ['apple-touch-icon.png', 180, 0.08],
];

for (const [nombre, tamano, margen] of iconos) {
  writeFileSync(new URL(nombre, SALIDA), png(tamano, tamano, dibujo(margen)));
  console.log(`  ${nombre}  ${tamano}×${tamano}`);
}

const hex = (c) => '#' + c.map((n) => n.toString(16).padStart(2, '0')).join('');
writeFileSync(
  new URL('icon.svg', SALIDA),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="${hex(FONDO)}"/>
  <path d="M10 42h44l-6 9H16z" fill="${hex(LATON)}"/>
  <path d="M31 8l14 26H31z" fill="${hex(LATON)}"/>
  <rect x="29.5" y="8" width="1.8" height="28" fill="${hex(LATON)}"/>
  <path d="M6 54c5-3 9 3 14 0s9 3 14 0 9 3 14 0 6 1 10 0" stroke="${hex(AGUA)}" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>
`,
);
console.log('  icon.svg');
