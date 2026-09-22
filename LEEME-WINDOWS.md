# 📦 FINAN-X en Windows · Guía rápida

Este proyecto está construido con **Docker**, así que se abre en Windows casi igual que en Mac: solo necesitas **Docker Desktop for Windows**. Aquí está todo lo que necesitas, paso a paso.

---

## 0. Qué necesitas en la PC

| Requisito | Detalle |
|---|---|
| **Windows 10 u 11** (64 bits) | Hogar/Pro, actualizado |
| **Docker Desktop for Windows** | Gratis: https://www.docker.com/products/docker-desktop/ |
| Internet | Para la primera descarga de imágenes (PostgreSQL 16, Node 22, nginx) |
| RAM recomendada | 8 GB o más (4 GB mínimo) |

> ⚠️ Durante la instalación de Docker Desktop **acepta usar el motor WSL 2** (es la opción recomendada por defecto). Esto requiere que la **virtualización esté activada en la BIOS** (normalmente ya lo está; si no, entra a la BIOS y activa "Intel VT-x").

---

## 1. Instalar Docker Desktop

1. Descarga e instala **Docker Desktop for Windows**.
2. Al terminar, **reinicia el equipo** si te lo pide.
3. Abre **Docker Desktop** y espera a que el "whale" deje de girar (abajo a la izquierda debe decir *Engine running*).
4. Para comprobar que quedó bien, abre **PowerShell** y escribe:

```powershell
docker version
```

Debe mostrar una versión (p. ej. `27.x`). Si dice *"command not found"*, reinicia PowerShell o el equipo.

---

## 2. Pasar el proyecto a la PC

1. Copia el archivo **`FINANX-PROYECTO.zip`** (te lo dejo listo en este mismo proyecto) a la PC Windows, por USB, Google Drive, iCloud, WhatsApp… como prefieras.
2. Descomprímelo en una ruta **sin espacios ni símbolos raros**. Idea:

```
C:\FINANX
```

> 💡 Si lo descomprimes dentro de *Documentos* o el *Escritorio* con nombre "Project Facturacion Finan-x", también funciona, pero las rutas con espacios dan problemas en algunas herramientas. `C:\FINANX` es lo más limpio.

Dentro de `C:\FINANX` debe quedar:

```
C:\FINANX\
├── docker-compose.yml
├── levantar.ps1        ← script para Windows (nuevo)
├── iniciar-app.ps1     ← script para Windows (nuevo)
├── database\           (init.sql y migraciones)
├── backend\            (API Node.js)
└── frontend\           (aplicación React)
```

---

## 3. Arrancar la aplicación

1. Abre **PowerShell**:
   - Pulsa `Inicio`, escribe `PowerShell`, dale Enter.
   - (O clic derecho sobre la carpeta `C:\FINANX` → *Abrir en terminal*.)
2. Ve a la carpeta y arranca:

```powershell
cd C:\FINANX
.\levantar.ps1
```

3. La primera vez **tardará varios minutos** (descarga PostgreSQL, Node, nginx y compila el frontend). Las siguientes veces es casi instantáneo.
4. Cuando termine **se abrirá tu navegador** en:

```
http://localhost:8080
```

> Si PowerShell te bloquea el script con un mensaje azul de "Execution Policy", ejecuta antes esto (solo para la ventana actual):
>
> ```powershell
> Set-ExecutionPolicy -Scope Process Bypass
> ```
> y vuelve a intentar `.\levantar.ps1`.

---

## 4. Iniciar sesión

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@finanx.test` | `admin123` |
| Facturador | `facturador@finanx.test` | `facturador123` |
| Cajero | `cajero@finanx.test` | `cajero123` |
| Supervisor | `supervisor@finanx.test` | `supervisor123` |
| Cliente (portal) | `cliente@finanx.test` | `cliente123` |

---

## 5. Detener / reiniciar

```powershell
.\levantar.ps1 --stop         # detiene la app (los datos se conservan)
.\levantar.ps1                # la vuelve a levantar
.\iniciar-app.ps1             # levanta y abre el navegador
.\iniciar-app.ps1 stop        # detiene
.\iniciar-app.ps1 url         # solo abre el navegador (si ya corre)
```

> ⚠️ `--purge` borra TODOS los datos (como si fuera una instalación nueva). No lo uses si quieres conservar los registros.

---

## 6. Abrir la base de datos en PostgreSQL (Windows)

La base corre dentro de Docker en el puerto **5432**, igual que en Mac:

**Opción A — Consola (psql):**

```powershell
docker exec -it finanx-db psql -U finanx -d finanx
```

**Opción B — Con pgAdmin (como ya sabes):**

1. Instala **pgAdmin 4** para Windows (el instalador `.exe` de 64 bits, no el ARM — la mayoría de PCs son x64): https://www.pgadmin.org/download/
2. Abre pgAdmin → clic derecho en *Servers* → **Register → Server…**
3. Conexión:

| Campo | Valor |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | `finanx` |
| Username | `finanx` |
| Password | `finanx` |

> En la PC nueva **no habrá** un "PostgreSQL 18" local que te confunda: solo verás el servidor FINAN-X que crees.

---

## 7. Problemas comunes en Windows (y su solución)

| Problema | Solución |
|---|---|
| `docker: command not found` | Docker Desktop no instalado o PowerShell no reiniciado. Repite el paso 1. |
| *"WSL 2 installation is incomplete"* | Abre PowerShell como administrador y ejecuta `wsl --update`, luego reinicia y abre Docker Desktop. |
| *"Virtualization is not enabled"* | Activa "Intel VT-x" (o AMD-V) en la BIOS y reinicia. |
| El puerto 5432/4000/8080 está ocupado | Otra app usa esos puertos. Cierra esa app, o cambia el puerto en `docker-compose.yml` (ej. `"8081:80"` y abre `http://localhost:8081`). |
| Los scripts `.sh` (Mac) fallan aquí | Son de Mac/Linux. **Usa los `.ps1`** que vienen en esta carpeta: `levantar.ps1` e `iniciar-app.ps1`. |
| La primera carga es muy lenta | Es normal (descarga imágenes). Las siguientes son rápidas. |
| El antivirus bloquea Docker | Agrega Docker Desktop a las exclusiones del antivirus (Windows Defender → permitir en la carpeta de datos de Docker). |
| No veo las 2 imágenes… ¿dónde está la app? | Revisa contenedores: `docker compose ps`. Los tres (db, backend, frontend) deben estar "Up". |

---

## 8. (Opcional) Llevarse los datos actuales a la PC nueva

Quien arranca la app en la PC nueva empieza con la **base de datos demo de siempre** (clientes, facturas, pagos del seed). Si quisieras llevar **tus datos actuales** (los que tienes en la Mac), se exportan/importan así:

**En la Mac:**

```bash
docker exec finanx-db pg_dump -U finanx -d finanx > respaldo_finanx.sql
```

**En la PC Windows (después de levantar la app una vez):**

```powershell
Get-Content respaldo_finanx.sql | docker exec -i finanx-db psql -U finanx -d finanx
```

> ⚠️ Hazlo con la app **detenida** (`docker compose down`) para que no haya conflictos, y levanta solo la base primero si fuera necesario. Es un paso avanzado: salta este punto si no lo necesitas.

---

## 9. Comandos útiles cortos

```powershell
docker compose ps            # estado de los 3 contenedores
docker compose logs backend  # ver los registros del backend
docker compose logs db       # ver los registros de la base
docker exec -it finanx-db psql -U finanx -d finanx   # entrar a la base
```

---

Ahora solo queda copiar el ZIP y seguir el paso 2. ¡Buena mudanza! 🚚