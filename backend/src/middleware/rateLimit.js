/**
 * FINAN-X · Limitador de intentos fallidos de inicio de sesión (por IP, en memoria).
 *
 * Estrategia: solo se cuentan los intentos FALLIDOS (401). Un login exitoso
 * limpia el contador, de modo que un usuario legítimo nunca queda bloqueado
 * por equivocarse unas veces. Al superar el umbral, cada NUEVO fallo responde 429.
 *
 * Nota: al ser en memoria, en un despliegue multi-instancia habría que mover
 * este contador a Redis. Para este proyecto (una sola instancia) es suficiente.
 */
import { config } from '../config.js';

const fallosPorIp = new Map(); // ip -> { contador, ventanaInicia }
const VENTANA_MS = 15 * 60 * 1000;

function ipDe(req) {
  return req.ip || req.socket?.remoteAddress || 'desconocido';
}

/** Evita que el Map crezca sin límite: descarta entradas vencidas o poda. */
function podar(ahora) {
  if (fallosPorIp.size <= 5000) return;
  for (const [ip, r] of fallosPorIp) {
    if (ahora - r.ventanaInicia >= VENTANA_MS) fallosPorIp.delete(ip);
  }
}

/**
 * Registra un intento fallido. Si la IP ya superó el umbral en la ventana,
 * responde 429 y devuelve true (ya respondió). Si no, devuelve false.
 */
export function registrarFalloLogin(req, res) {
  const ip = ipDe(req);
  const ahora = Date.now();
  podar(ahora);
  const r = fallosPorIp.get(ip);
  if (r && ahora - r.ventanaInicia < VENTANA_MS) {
    r.contador += 1;
    if (r.contador >= config.loginMaxFallidos) {
      res.status(429).json({
        error: 'Demasiados intentos fallidos de inicio de sesión. Espere 15 minutos antes de volver a intentar.',
      });
      return true;
    }
  } else {
    fallosPorIp.set(ip, { contador: 1, ventanaInicia: ahora });
  }
  return false;
}

/** Un login exitoso limpia el contador de la IP. */
export function limpiarFallosLogin(req) {
  fallosPorIp.delete(ipDe(req));
}