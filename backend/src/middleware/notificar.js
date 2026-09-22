/**
 * FINAN-X · Envío de códigos de un solo uso (OTP) para recuperación de contraseña.
 *
 * Este entorno (académico/demostración) no dispone de un proveedor real de SMS o correo,
 * por lo que el código se escribe en la consola del backend y (en modo demo) la API lo
 * devuelve en la respuesta para poder probar el flujo completo.
 *
 * Para producción, conecte aquí su proveedor real (no cambie la firma de la función):
 *   - SMS: Twilio / MessageBird / AWS SNS
 *   - Correo: nodemailer con SMTP / Resend / SendGrid
 */
export async function enviarCodigo({ canal, destino, codigo }) {
  const destinoVisible = destino && String(destino).length > 4
    ? `${String(destino).slice(0, 2)}***${String(destino).slice(-2)}`
    : '(sin contacto registrado)';
  // eslint-disable-next-line no-console
  console.log(`[OTP] canal=${canal} destino=${destinoVisible} codigo=${codigo} — DEMO: en producción se enviaría por ${canal === 'SMS' ? 'SMS' : 'correo electrónico'}`);
}