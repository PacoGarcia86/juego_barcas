// [K-201] Ritmo de juego: segundos de regata por segundo real.
//
// Una regata de verdad dura doce minutos (`DK4`); una de kart, dos o tres. El
// motor NO se entera: la costura le da más pasos de `PASO` por fotograma, con
// la misma semilla y el mismo resultado (`B-901`). Por eso vive en `juego/` y
// no en el motor.
export const RITMO = 3;
