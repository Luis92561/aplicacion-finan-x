import 'dotenv/config';

const esProduccion = process.env.NODE_ENV === 'production';

/**
 * Valores que aparecen en el repositorio (docker-compose, .env.example, código) o en
 * documentación. Si alguno se usa como JWT_SECRET, cualquiera puede leerlo y FORJAR
 * tokens: bastaría un secreto válido para entrar como ADMIN. Se rechazan siempre.
 */
const SECRETOS_DEBILES = [
  'finanx-prod-secret',   // valor por defecto que tenía docker-compose.yml
  'finanx-dev-secret',    // valor por defecto de este archivo
  'cambiar',              // "cambiar-por-una-clave-segura", "cambiar-en-produccion"
  'cambia-esta-clave',    // backend/.env.example
  'changeme',
  'change-me',
];

const MIN_LARGO = 32;

/**
 * Comprueba el JWT_SECRET antes de arrancar.
 *
 * Antes solo se miraba la LONGITUD y únicamente en producción, así que el valor por defecto
 * de docker-compose (que ya tenía ≥32 caracteres) pasaba la validación y un despliegue sin
 * variables de entorno arrancaba con un secreto público en el repositorio.
 */
function revisarJwtSecret() {
  const secreto = process.env.JWT_SECRET;

  if (!secreto) {
    console.error(
      'FINAN-X: falta JWT_SECRET.\n' +
      '  El secreto firma los tokens de sesión; sin él no se puede arrancar de forma segura.\n' +
      '  Genere uno y guárdelo en un archivo .env (que NO se sube a git):\n' +
      '    node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
    );
    process.exit(1);
  }

  const minuscula = secreto.toLowerCase();
  const debil = SECRETOS_DEBILES.find((p) => minuscula.includes(p));

  if (debil) {
    console.error(
      `FINAN-X: JWT_SECRET contiene el valor de ejemplo "${debil}", que está publicado en el repositorio.\n` +
      '  Con un secreto conocido se pueden FABRICAR tokens y suplantar a cualquier usuario, incluido ADMIN.\n' +
      '  Defina un JWT_SECRET propio y aleatorio (≥32 caracteres) en su archivo .env:\n' +
      '    node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
    );
    process.exit(1);
  }

  if (secreto.length < MIN_LARGO) {
    console.error(
      `FINAN-X: JWT_SECRET es demasiado corto (${secreto.length} caracteres; mínimo ${MIN_LARGO}).\n` +
      '  Genere uno aleatorio con:\n' +
      '    node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'base64url\'))"'
    );
    process.exit(1);
  }

  if (!esProduccion) {
    console.warn('FINAN-X: JWT_SECRET de desarrollo en uso. Use un secreto distinto en producción.');
  }

  return secreto;
}

const jwtSecret = revisarJwtSecret();

/** Valor booleano desde entorno, con valor por defecto según el entorno. */
const bandera = (nombre, porDefecto) => (process.env[nombre] ?? (porDefecto ? 'on' : 'off')) === 'on';

export const config = {
  esProduccion,
  port: Number(process.env.PORT || 4000),
  db: {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'finanx_app',
    password: process.env.PGPASSWORD || 'finanx_app',
    database: process.env.PGDATABASE || 'finanx',
    ssl: bandera('PGSSL', false),
  },
  jwtSecret,
  jwtIssuer: 'finanx-api',
  jwtAudience: 'finanx-web',
  /** Vida corta: la sesión se renueva iniciando sesión otra vez. */
  jwtExpiresIn: process.env.JWT_EXPIRES || '2h',
  /** Cookie de sesión HttpOnly (el navegador no la expone a JavaScript). */
  cookieNombre: 'fx_session',
  cookieSecure: bandera('COOKIE_SECURE', esProduccion),
  cookieMaxAgeSegundos: Number(process.env.COOKIE_MAX_AGE) || 2 * 60 * 60,
  /** Orígenes permitidos por CORS (con credenciales, nunca "*"). */
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:8080')
    .split(',').map((s) => s.trim()).filter(Boolean),
  /** Intentos fallidos de login por cuenta antes de bloquear (con retroceso). */
  loginMaxFallidos: Number(process.env.LOGIN_MAX_FAILURES) || 5,
  /** Minutos de bloqueo base; se multiplica por el número de bloqueos previos. */
  loginBloqueoMinutos: Number(process.env.LOGIN_LOCK_MINUTES) || 15,
  /** El autoregistro público se apaga por defecto en producción. */
  registroAbierto: bandera('REGISTRO_ABIERTO', !esProduccion),
  /** Máximo de solicitudes de autoregistro por IP en 1 hora (anti-spam). */
  registroRateMax: Number(process.env.REGISTRO_RATE_LIMIT) || 20,
  /**
   * OTP (código de un solo uso) para recuperar contraseña.
   *
   * Con esto en `true`, el código viaja en la RESPUESTA de la API y la interfaz lo muestra:
   * cualquiera podría pedir el código de otra cuenta y cambiarle la contraseña. Es cómodo para
   * demostrar el flujo, pero anula el segundo factor. En producción queda SIEMPRE apagado,
   * aunque se ponga la variable: no es una decisión de configuración, es una regla.
   */
  otpDemo: !esProduccion && (process.env.OTP_RETORNO_DEMO ?? 'on') !== 'off',
  otpValidezMinutos: Number(process.env.OTP_VALIDEZ_MINUTOS) || 10,
  otpMaxIntentos: Number(process.env.OTP_MAX_INTENTOS) || 5,
  /** Segundos mínimos entre solicitudes de OTP de una misma cuenta. */
  otpCooldownSegundos: process.env.OTP_COOLDOWN_SEGUNDOS !== undefined
    ? Number(process.env.OTP_COOLDOWN_SEGUNDOS)
    : 60,
  /** Máximo de solicitudes/intentos de recuperación de contraseña por IP en 15 min. */
  recuperarRateMax: Number(process.env.RECUPERAR_RATE_LIMIT) || 40,
  /** Coste de bcrypt. 12 es el mínimo razonable en 2026. */
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
  /** Límite global de peticiones por IP cada 15 minutos. */
  limiteGlobal: Number(process.env.RATE_LIMIT_GLOBAL) || 300,
};
