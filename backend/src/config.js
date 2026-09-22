import 'dotenv/config';

const esProduccion = process.env.NODE_ENV === 'production';

// Refuerzo de seguridad: en producción se exige un secreto JWT fuerte (≥32 caracteres).
if (esProduccion) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error(
      'FINAN-X: en producción es obligatorio definir JWT_SECRET con al menos 32 caracteres. ' +
      'Configúrelo en docker-compose o en las variables de entorno antes de arrancar.'
    );
    process.exit(1);
  }
} else if (!process.env.JWT_SECRET) {
  console.warn('FINAN-X: usando JWT_SECRET de desarrollo "finanx-dev-secret". Defina JWT_SECRET para producción.');
}

export const config = {
  port: Number(process.env.PORT || 4000),
  db: {
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'finanx',
    password: process.env.PGPASSWORD || 'finanx',
    database: process.env.PGDATABASE || 'finanx',
  },
  jwtSecret: process.env.JWT_SECRET || 'finanx-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES || '8h',
  /** Orígenes permitidos por CORS (el navegador solo recibe la cabecera si el origen está aquí). */
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:8080')
    .split(',').map((s) => s.trim()).filter(Boolean),
  /** Intentos fallidos de login permitidos por IP antes de bloquear 429 (ventana de 15 min). */
  loginMaxFallidos: Number(process.env.LOGIN_MAX_FAILURES) || 5,
  /** Máximo de solicitudes de autoregistro por IP en 1 hora (anti-spam). */
  registroRateMax: Number(process.env.REGISTRO_RATE_LIMIT) || 20,
  /** OTP (código de un solo uso) para recuperar contraseña. */
  otpDemo: (process.env.OTP_RETORNO_DEMO || 'on') !== 'off',      // 'on': el código vuelve en la respuesta (solo demo)
  otpValidezMinutos: Number(process.env.OTP_VALIDEZ_MINUTOS) || 10,
  otpMaxIntentos: Number(process.env.OTP_MAX_INTENTOS) || 5,
  /** Máximo de solicitudes/intentos de recuperación de contraseña por IP en 15 min (anti-spam OTP). */
  recuperarRateMax: Number(process.env.RECUPERAR_RATE_LIMIT) || 40,
};