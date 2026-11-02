/**
 * FINAN-X · Limitador de intentos fallidos de inicio de sesión.
 *
 * Estrategia: se cuentan los fallos por combinación (IP, usuario). Un inicio de sesión
 * correcto limpia SOLO esa combinación, nunca el contador global: antes, un login válido
 * con una cuenta propia reiniciaba el contador de la IP y permitía seguir probando
 * contraseñas contra el administrador sin llegar nunca al bloqueo.
 *
 * El bloqueo "duro" por cuenta (aunque cambie la IP) vive en la base de datos
 * (`fallos_login` y `bloqueado_hasta`) y lo aplica la ruta de login.
 *
 * Nota: al ser en memoria, en un despliegue multi-instancia habría que mover este
 * contador a Redis. Para una sola instancia es suficiente.
 */
import { config } from '../config.js';

const fallos = new Map(); // "ip|usuario" -> { contador, ventanaInicia }
const VENTANA_MS = 15 * 60 * 1000;

function ipDe(req) {
  return req.ip || req.socket?.remoteAddress || 'desconocido';
}

function claveDe(req, usuario) {
  return `${ipDe(req)}|${String(usuario || '').trim().toLowerCase()}`;
}

/** Evita que el Map crezca sin límite: descarta entradas vencidas o poda. */
function podar(ahora) {
  if (fallos.size <= 5000) return;
  for (const [clave, r] of fallos) {
    if (ahora - r.ventanaInicia >= VENTANA_MS) fallos.delete(clave);
  }
}

/**
 * Registra un intento fallido para (IP, usuario) y devuelve true si esa combinación
 * ya superó el umbral. La ruta decide qué responder.
 */
export function registrarFalloLogin(req, usuario) {
  const clave = claveDe(req, usuario);
  const ahora = Date.now();
  podar(ahora);
  const r = fallos.get(clave);
  if (r && ahora - r.ventanaInicia < VENTANA_MS) {
    r.contador += 1;
  } else {
    fallos.set(clave, { contador: 1, ventanaInicia: ahora });
  }
  return fallos.get(clave).contador >= config.loginMaxFallidos;
}

/** Un login correcto limpia solo la combinación (IP, usuario) que acertó. */
export function limpiarFallosLogin(req, usuario) {
  fallos.delete(claveDe(req, usuario));
}
