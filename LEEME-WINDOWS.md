# FINAN-X · Guía rápida en Windows

> **Versión 1.0.0.** Si solo quiere abrir la aplicación, use el lanzador:
> `entrega/windows/ABRIR-FINAN-X.bat` (doble clic).

## 1. Requisitos

- Windows 10 u 11 de 64 bits.
- Docker Desktop instalado y funcionando (una sola vez).
- Puerto 8080 libre.

## 2. Abrir

Doble clic en `entrega/windows/ABRIR-FINAN-X.bat`. El lanzador arranca Docker, genera
`.env`, carga las imágenes si no hay internet, levanta el stack, crea las cuentas y abre
<http://localhost:8080>.

## 3. Cuentas

Están en `primer-ingreso/Acta-Usuarios-Primer-Ingreso.pdf`. Todas piden **cambiar la
contraseña en el primer ingreso**.

| Usuario | Rol |
|---|---|
| `admin` | Administrador |
| `facturacion` | Facturador |
| `caja` | Cajero |
| `supervision` | Supervisor |
| `cliente` | Portal del cliente |

## 4. Otros lanzadores

- `CERRAR-FINAN-X.bat` — detiene la aplicación (conserva los datos).
- `REINICIAR-DATOS.bat` — borra los datos y deja la demo como nueva.
- `ABRIR-MODO-SEGURO.bat` — HTTPS en <https://localhost:8443> (autofirmado).

## 5. Modo desarrollo (opcional)

```powershell
docker compose up -d db

cd backend
npm install
$env:JWT_SECRET = "un-secreto-aleatorio-de-mas-de-32-caracteres"
npm run init:usuarios -- --archivo ../primer-ingreso/usuarios-iniciales.json
npm run dev
```

```powershell
cd frontend
npm install
npm run dev
```

Datos de demostración (solo desarrollo):

```powershell
cd backend
$env:SEED_DEMO = "true"
npm run seed:demo
```

## 6. Problemas frecuentes

| Síntoma | Solución |
|---|---|
| Docker no responde | Abrir Docker Desktop y esperar "Engine running". |
| `Bind for 0.0.0.0:8080 failed` | Otro programa usa el 8080; ciérrelo o use el modo seguro. |
| El `.bat` no se ejecuta | Clic derecho → Propiedades → Desbloquear. |
| El login pide cambiar la clave | Es correcto: es el primer ingreso. |
| `Falta JWT_SECRET` | Borre `.env` y vuelva a ejecutar el lanzador. |

Guía completa: `documentacion/03-operacion/Instrucciones_Despliegue.md`.
