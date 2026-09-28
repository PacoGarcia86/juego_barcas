// [V-4xx] El sonido de la regata, sintetizado entero con Web Audio.
//
// [V-401] Ni un fichero de audio: osciladores, ruido y filtros. El ruido sale
// de `rng.ts` con semilla fija (`B-901`), así que suena igual en cada partida.
// [V-405] Capa hoja: no conoce React, ni el render, ni la interfaz.
//
// [V-404] Los navegadores no dejan sonar nada hasta el primer gesto del
// usuario. `arrancar()` se llama desde ese gesto; antes, todo es silencio.

import { crearRng } from '../engine/rng.ts';

/** [V-402] Un sonido por suceso, y los de la salida. */
export const NOMBRES_SONIDO = [
  'cuenta',
  'salida',
  'perfecta',
  'calada',
  'ruleta',
  'objeto',
  'lanzas',
  'racha',
  'golpe',
  'aciertas',
  'tePasan',
  'adelantas',
  'vuelta',
  'ultimaVuelta',
  'meta',
  'cenida',
  'huevo',
] as const;

export type NombreSonido = (typeof NOMBRES_SONIDO)[number];

type Onda = 'sine' | 'square' | 'sawtooth' | 'triangle';

/** Semilla del ruido. Fija: el mismo mar suena igual [B-901]. */
const SEMILLA_RUIDO = 0x5eaf00d;

export class Sintetizador {
  private ctx: AudioContext | null = null;
  private maestro: GainNode | null = null;
  private ruido: AudioBuffer | null = null;
  private agua: { filtro: BiquadFilterNode; volumen: GainNode } | null = null;
  private fasePalada = 0;
  private callado = false;

  /** [V-404] Desde un gesto del usuario. Llamarlo varias veces no hace nada. */
  arrancar(): void {
    const Contexto = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (Contexto === undefined) return;
    if (this.ctx !== null) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const ctx = new Contexto();
    this.ctx = ctx;
    const compresor = ctx.createDynamicsCompressor();
    compresor.threshold.value = -14;
    compresor.ratio.value = 4;
    compresor.connect(ctx.destination);
    this.maestro = ctx.createGain();
    this.maestro.gain.value = this.callado ? 0 : 0.8;
    this.maestro.connect(compresor);

    // [V-401] Dos segundos de ruido blanco, del PRNG con semilla.
    const rng = crearRng(SEMILLA_RUIDO);
    const largo = ctx.sampleRate * 2;
    this.ruido = ctx.createBuffer(1, largo, ctx.sampleRate);
    const datos = this.ruido.getChannelData(0);
    for (let i = 0; i < largo; i++) datos[i] = rng.siguiente() * 2 - 1;

    // [V-403] El agua: ruido en bucle por un paso bajo que abre con la velocidad.
    const fuente = ctx.createBufferSource();
    fuente.buffer = this.ruido;
    fuente.loop = true;
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 300;
    const volumen = ctx.createGain();
    volumen.gain.value = 0;
    fuente.connect(filtro).connect(volumen).connect(this.maestro);
    fuente.start();
    this.agua = { filtro, volumen };
  }

  /** [V-404] Silencio sí o no. */
  silenciar(callado: boolean): void {
    this.callado = callado;
    if (this.ctx !== null && this.maestro !== null) {
      this.maestro.gain.setTargetAtTime(callado ? 0 : 0.8, this.ctx.currentTime, 0.05);
    }
  }

  get silenciado(): boolean {
    return this.callado;
  }

  /**
   * [V-403] El ambiente, una vez por fotograma: el agua sube con la velocidad
   * que se VE y la palada suena al ritmo del gas.
   */
  ambiente(dt: number, velocidadVisible: number, gas: number): void {
    const ctx = this.ctx;
    if (ctx === null || this.agua === null) return;
    const v = Math.min(1, velocidadVisible / 16);
    this.agua.filtro.frequency.setTargetAtTime(260 + 1600 * v, ctx.currentTime, 0.2);
    this.agua.volumen.gain.setTargetAtTime(0.05 + 0.1 * v, ctx.currentTime, 0.2);
    if (gas <= 0.05 || velocidadVisible <= 0.2) return;
    this.fasePalada += dt * (0.7 + 0.9 * gas);
    if (this.fasePalada >= 1) {
      this.fasePalada -= 1;
      this.soplo(0.12, 700, 'bandpass', 0.05 + 0.05 * gas, 350);
    }
  }

  /** [V-402] Un sonido de suceso. */
  tocar(nombre: NombreSonido): void {
    if (this.ctx === null || this.callado) return;
    switch (nombre) {
      case 'cuenta':
        this.tono(440, 0.18, 'square', 0.18);
        return;
      case 'salida':
        this.tono(880, 0.55, 'sawtooth', 0.14);
        this.tono(660, 0.55, 'sawtooth', 0.1);
        return;
      case 'perfecta':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tono(f, 0.1, 'square', 0.12, i * 0.05));
        this.soplo(0.6, 900, 'bandpass', 0.25, 4000);
        return;
      case 'calada':
        this.tono(110, 0.5, 'sawtooth', 0.2, 0, 70);
        return;
      case 'ruleta':
        this.tono(1250, 0.035, 'square', 0.06);
        return;
      case 'objeto':
        [660, 880, 1320].forEach((f, i) => this.tono(f, 0.12, 'triangle', 0.2, i * 0.07));
        return;
      case 'lanzas':
        this.soplo(0.3, 500, 'bandpass', 0.22, 2400);
        return;
      case 'racha':
        this.soplo(0.7, 400, 'bandpass', 0.3, 3200);
        this.tono(220, 0.6, 'sawtooth', 0.08, 0, 520);
        return;
      case 'golpe':
        this.soplo(0.4, 1200, 'lowpass', 0.45, 200);
        this.tono(140, 0.35, 'sine', 0.35, 0, 45);
        return;
      case 'aciertas':
        this.tono(784, 0.09, 'square', 0.12);
        this.tono(1175, 0.16, 'square', 0.12, 0.08);
        return;
      case 'tePasan':
        this.tono(520, 0.16, 'triangle', 0.22);
        this.tono(330, 0.3, 'triangle', 0.22, 0.14);
        return;
      case 'adelantas':
        this.tono(523, 0.1, 'triangle', 0.2);
        this.tono(784, 0.2, 'triangle', 0.2, 0.08);
        return;
      case 'vuelta':
        this.tono(988, 0.5, 'sine', 0.2);
        this.tono(1319, 0.6, 'sine', 0.14, 0.12);
        return;
      case 'ultimaVuelta':
        [523, 659, 784, 1047].forEach((f, i) => this.tono(f, i === 3 ? 0.5 : 0.13, 'square', 0.12, i * 0.13));
        return;
      case 'meta':
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) =>
          this.tono(f, i === 5 ? 0.9 : 0.16, 'square', 0.12, i * 0.15),
        );
        this.soplo(1.2, 3000, 'highpass', 0.08, 6000, 0.6);
        return;
      case 'cenida':
        this.tono(1500, 0.08, 'sine', 0.16);
        this.tono(2000, 0.12, 'sine', 0.14, 0.06);
        return;
      case 'huevo':
        this.soplo(0.07, 2600, 'highpass', 0.3, 2600);
        this.tono(1800, 0.05, 'triangle', 0.1, 0.02);
        return;
    }
  }

  destruir(): void {
    void this.ctx?.close();
    this.ctx = null;
  }

  /** Un oscilador con envolvente, y un deslizamiento de tono si se pide. */
  private tono(frecuencia: number, duracion: number, onda: Onda, volumen: number, retraso = 0, hasta?: number): void {
    const ctx = this.ctx;
    if (ctx === null || this.maestro === null) return;
    const t = ctx.currentTime + retraso;
    const osc = ctx.createOscillator();
    osc.type = onda;
    osc.frequency.setValueAtTime(frecuencia, t);
    if (hasta !== undefined) osc.frequency.exponentialRampToValueAtTime(hasta, t + duracion);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volumen, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    osc.connect(g).connect(this.maestro);
    osc.start(t);
    osc.stop(t + duracion + 0.02);
  }

  /** Un golpe de ruido filtrado, con barrido de frecuencia. */
  private soplo(
    duracion: number,
    frecuencia: number,
    tipo: BiquadFilterType,
    volumen: number,
    hasta: number,
    retraso = 0,
  ): void {
    const ctx = this.ctx;
    if (ctx === null || this.maestro === null || this.ruido === null) return;
    const t = ctx.currentTime + retraso;
    const fuente = ctx.createBufferSource();
    fuente.buffer = this.ruido;
    const filtro = ctx.createBiquadFilter();
    filtro.type = tipo;
    filtro.Q.value = 1.2;
    filtro.frequency.setValueAtTime(frecuencia, t);
    filtro.frequency.exponentialRampToValueAtTime(Math.max(20, hasta), t + duracion);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volumen, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
    fuente.connect(filtro).connect(g).connect(this.maestro);
    fuente.start(t, 0.1 + ((t * 0.37) % 1.5));
    fuente.stop(t + duracion + 0.02);
  }
}
