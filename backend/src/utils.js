export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Redondea a 2 decimales para evitar errores de punto flotante en cálculos monetarios. */
export const round2 = (n) => Math.round((Number(n || 0)) * 100) / 100;

export const num = (v) => Number(v || 0);

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