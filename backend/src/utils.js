import { randomInt } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message, codigo = null) {
    super(message);
    this.status = status;
    this.codigo = codigo;
  }
}

/**
 * Convierte un parámetro de ruta a número entero positivo.
 *
 * Antes cada ruta hacía `Number(req.params.id)`: con una URL como `/api/facturas/abc`,
 * `Number('abc')` es NaN, el NaN viajaba a PostgreSQL y la consulta reventaba con un
 * error de tipo, que el manejador global convertía en un 500 (error del servidor).
 * Lo correcto es responder 400: es una petición mal formada, no un fallo nuestro.
 */
export function idNumerico(valor, nombre = 'identificador') {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) {
    throw new HttpError(400, `El ${nombre} debe ser un número entero positivo`);
  }
  return n;
}

/** Redondea a 2 decimales para evitar errores de punto flotante en cálculos monetarios. */
export const round2 = (n) => Math.round((Number(n || 0)) * 100) / 100;

/**
 * Métodos de pago admitidos. Es la lista que entienden los informes (reportes/facturacion
 * cuenta pagos por cada uno de estos), así que cualquier otro valor crearía pagos invisibles
 * para las estadísticas.
 */
export const METODOS_PAGO = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CHEQUE'];

/** Normaliza el método de pago antes de validarlo y de guardarlo. */
export function normalizarMetodo(metodo) {
  return String(metodo ?? '').trim().toUpperCase();
}

// ---------------------------------------------------------------------------
// Contraseñas
// ---------------------------------------------------------------------------

/** Longitud mínima de contraseña, en un solo sitio para que no haya reglas distintas. */
export const MIN_CLAVE = 12;
export const MAX_CLAVE = 128;

/**
 * Contraseñas que no deben aceptarse nunca. No sustituye a una comprobación contra
 * filtraciones reales (HIBP), pero bloquea lo que de verdad se usa en un ataque de
 * diccionario y no requiere conexión a internet en el momento del despliegue.
 */
const CLAVES_COMUNES = new Set([
  '123456', '123456789', '12345678', '1234567890', 'qwerty', 'qwerty123', 'password',
  'password1', 'password123', 'admin', 'admin123', 'administrador', 'admin1234',
  'finanx', 'finanx123', 'finanx2024', 'finanx2025', 'finanx2026', 'facturacion',
  'facturacion123', 'cajero', 'cajero123', 'supervisor', 'supervisor123', 'cliente',
  'cliente123', 'bienvenido', 'bienvenido1', 'colombia', 'colombia123', 'universidad',
  'secreto', 'secreto123', 'contrasena', 'contraseña', 'contrasena123', 'iloveyou',
  'monkey', 'dragon', 'letmein', 'welcome', 'welcome1', 'abc123', 'abc12345',
  '12345678910', '000000', '111111', '123123', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
]);

const contieneDato = (clave, dato) => {
  const d = String(dato ?? '').trim().toLowerCase();
  if (d.length < 4) return false;
  return clave.toLowerCase().includes(d);
};

/**
 * Valida una contraseña nueva.
 *
 * Regla: 12 caracteres mínimo, sin contraseñas comunes, sin el usuario/correo/nombre
 * de la persona y sin la marca de la aplicación. No se exige "mayúscula + símbolo"
 * porque empuja a claves predecibles; se prefiere longitud y una frase de paso.
 *
 * @param {string} password
 * @param {{username?: string, correo?: string, nombre?: string}} contexto
 */
export function validarPassword(password, contexto = {}) {
  const clave = String(password ?? '');
  if (!clave) throw new HttpError(400, 'La contraseña es obligatoria');
  if (clave.length < MIN_CLAVE) {
    throw new HttpError(400, `La contraseña debe tener al menos ${MIN_CLAVE} caracteres`);
  }
  if (clave.length > MAX_CLAVE) {
    throw new HttpError(400, `La contraseña no puede superar ${MAX_CLAVE} caracteres`);
  }
  if (clave.trim() !== clave) {
    throw new HttpError(400, 'La contraseña no puede empezar ni terminar con espacios');
  }
  if (new Set(clave).size < 5) {
    throw new HttpError(400, 'La contraseña es demasiado repetitiva; use una frase distinta');
  }
  if (CLAVES_COMUNES.has(clave.toLowerCase())) {
    throw new HttpError(400, 'Esa contraseña es demasiado común; elija otra');
  }
  if (clave.toLowerCase().includes('finanx')) {
    throw new HttpError(400, 'La contraseña no puede contener el nombre de la aplicación');
  }
  for (const dato of [contexto.username, contexto.correo, contexto.nombre]) {
    if (contieneDato(clave, dato)) {
      throw new HttpError(400, 'La contraseña no puede contener sus datos personales o su usuario');
    }
  }
  return clave;
}

/** Genera una contraseña temporal legible y aleatoria (16 caracteres). */
export function generarClaveTemporal() {
  // Sin caracteres ambiguos (0/O, 1/l/I) para poder dictarla o copiarla sin errores.
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const simbolos = '!#$%&*+-=?@';
  const elegir = (conjunto) => conjunto[randomInt(0, conjunto.length)];
  const base = Array.from({ length: 14 }, () => elegir(alfabeto)).join('');
  return `${elegir(alfabeto)}${base}${elegir(simbolos)}${elegir(simbolos)}`;
}

/** Algoritmo de Luhn: valida el dígito verificador de un número de tarjeta. */
export function validarLuhn(numero) {
  const n = String(numero || '').replace(/\D/g, '');
  if (!/^\d{13,19}$/.test(n)) return false;
  let suma = 0;
  let doble = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = Number(n[i]);
    if (doble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
    doble = !doble;
  }
  return suma % 10 === 0;
}

/** Marca comercial de una tarjeta según los primeros dígitos (solo para mostrar). */
export function derivarTipoTarjeta(numero) {
  const n = String(numero || '').replace(/\D/g, '');
  if (/^4/.test(n)) return 'VISA';
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'MASTERCARD';
  if (/^3[47]/.test(n)) return 'AMEX';
  return 'OTRA';
}

/**
 * Valida y normaliza los datos requeridos por método de pago (pago en línea).
 * - TARJETA: número (13–19 dígitos + Luhn), CVV (nunca se almacena), vencimiento MM/AA, banco, titular.
 * - TRANSFERENCIA: banco, número de cuenta y referencia del comprobante.
 * - CHEQUE: banco y número de cheque (referencia).
 * - EFECTIVO: sin datos adicionales.
 * Devuelve solo los campos seguros para persistir (nunca CVV ni número completo).
 */
export function validarDatosPago(metodoPago, body = {}) {
  const b = body || {};
  const limpiar = (v) => String(v || '').trim();
  const numeros = (v) => String(v || '').replace(/\D/g, '');

  if (metodoPago === 'TARJETA') {
    const n = numeros(b.numeroTarjeta);
    const cvv = numeros(b.codigoSeguridad);
    const vto = limpiar(b.vencimientoTarjeta);
    const banco = limpiar(b.banco);
    const titular = limpiar(b.titularTarjeta);
    if (!/^\d{13,19}$/.test(n)) throw new HttpError(400, 'Tarjeta: el número es inválido (13 a 19 dígitos)');
    if (!validarLuhn(n)) throw new HttpError(400, 'Tarjeta: el número no pasa la validación de dígito verificador (Luhn)');
    if (!/^\d{3,4}$/.test(cvv)) throw new HttpError(400, 'Tarjeta: código de seguridad inválido (3 o 4 dígitos)');
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(vto)) throw new HttpError(400, 'Tarjeta: vencimiento inválido (formato MM/AA)');
    const [mm, aa] = vto.split('/').map(Number);
    const vence = new Date(2000 + aa, mm, 0); // último día del mes de vencimiento
    if (vence < new Date()) throw new HttpError(400, 'Tarjeta: la tarjeta está vencida');
    if (!banco) throw new HttpError(400, 'Tarjeta: indique el banco emisor');
    if (titular.length < 3) throw new HttpError(400, 'Tarjeta: indique el titular de la tarjeta');
    return {
      banco, titular,
      tipo_tarjeta: derivarTipoTarjeta(n),
      ultimos_digitos_tarjeta: n.slice(-4),
      vencimiento_tarjeta: vto,
    };
  }

  if (metodoPago === 'TRANSFERENCIA') {
    const banco = limpiar(b.banco);
    const cuenta = numeros(b.numeroCuenta);
    const ref = limpiar(b.referencia);
    if (!banco) throw new HttpError(400, 'Transferencia: indique el banco');
    if (!/^\d{4,20}$/.test(cuenta)) throw new HttpError(400, 'Transferencia: número de cuenta inválido (4 a 20 dígitos)');
    if (ref.length < 4) throw new HttpError(400, 'Transferencia: indique una referencia (n.º de comprobante)');
    return { banco, numero_cuenta: cuenta };
  }

  if (metodoPago === 'CHEQUE') {
    const banco = limpiar(b.banco);
    const ref = limpiar(b.referencia);
    if (!banco) throw new HttpError(400, 'Cheque: indique el banco');
    if (ref.length < 4) throw new HttpError(400, 'Cheque: indique el número del cheque (referencia)');
    return { banco };
  }

  return {}; // EFECTIVO: sin datos adicionales
}

/** Enmascara un dato largo dejando visibles los últimos 4 caracteres. */
export function enmascarar(valor) {
  const s = String(valor ?? '').trim();
  if (!s) return null;
  if (s.length <= 4) return '····';
  return `····${s.slice(-4)}`;
}
