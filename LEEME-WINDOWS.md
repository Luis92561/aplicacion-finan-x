# FINAN-X en Windows · Guía completa

Este proyecto usa **Docker**, así que en Windows se abre casi igual que en Mac: solo necesitas **Docker Desktop for Windows** + **Git for Windows**. El código viaja por **GitHub** (repositorio privado), así que no hace falta USB para el código — solo para mover datos entre PC (opcional, al final).

---

## 0. Qué necesitas en la PC

| Requisito | Detalle |
|---|---|
| **Windows 10 u 11** (64 bits) | Hogar/Pro, actualizado |
| **Docker Desktop for Windows** | Gratis: https://www.docker.com/products/docker-desktop/ |
| **Git for Windows** | Gratis: https://git-scm.com/download/win |
| Internet | Para descargar imágenes (PostgreSQL 16, Node 22, nginx) y clonar el repo |
| RAM recomendada | 8 GB o más (4 GB mínimo) |

> Durante la instalación de Docker Desktop **acepta el motor WSL 2** (opción recomendada por defecto). Esto requiere que la **virtualización esté activada en la BIOS** (normalmente ya lo está; si no, activa "Intel VT-x" o "AMD-V").

---

## 1. Instalar Docker Desktop y Git

1. **Docker Desktop for Windows**: descarga, instala, reinicia si lo pide.
2. **Git for Windows**: descarga e instala con las opciones por defecto (al final te pregunta el editor — puedes dejar el que venga, o elegir VS Code).
3. Abre **Docker Desktop** y espera a que abajo a la izquierda diga *Engine running*.
4. Abre **PowerShell** y verifica:

```powershell
docker version
git --version
```

Ambos deben responder con versión (p. ej. `docker 27.x`, `git 2.4x`).

> Si PowerShell te bloquea los scripts (mensaje azul "Execution Policy"), ejecuta **una vez**:
>
> ```powershell
> Set-ExecutionPolicy -Scope LocalMachine RemoteSigned
> ```
> (respóndele **Y**). Esto es lo que hace que `.\levantar.ps1` pueda ejecutarse.

---

## 2. Traer el proyecto a la PC (git clone)

Abre PowerShell y escribe:

```powershell
git clone https://github.com/Luis92561/aplicacion-finan-x.git C:\FINANX
cd C:\FINANX
```

Te pedirá usuario y contraseña **(contraseña = token de GitHub**, no tu contraseña normal). Si no tienes token, créalo: GitHub → Settings → Developer settings → **Personal access tokens → Tokens (classic) → Generate** → marca **`repo`** → copia el token → úsalo como contraseña.

Dentro de `C:\FINANX` debe quedar:

```
C:\FINANX\
├── docker-compose.yml
├── levantar.ps1            ← arranca todo (Windows)
├── iniciar-app.ps1         ← arranca + abre el navegador (Windows)
├── sincronizar-datos.ps1   ← mover datos entre PC (Windows)
├── database\               (init.sql y migraciones)
├── backend\                (API Node.js)
└── frontend\               (aplicación React)
```

> Ruta `C:\FINANX` = sin espacios ni acentos → sin problemas con Docker.

---

## 3. Arrancar la aplicación

```powershell
cd C:\FINANX
.\levantar.ps1
```

1. **La primera vez tarda varios minutos** (descarga PostgreSQL, Node, nginx y compila el frontend). Las siguientes veces es casi instantáneo.
2. Si Docker Desktop no está abierto, **el script lo abre solo y espera** a que esté listo.
3. Al terminar se abre tu navegador en:

```
http://localhost:8080/login
```

> ¿Prefieres el navegador y que de paso verifique que esté arriba? Usa `.\iniciar-app.ps1`.

---

## 4. Iniciar sesión (credenciales demo)

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `admin@finanx.test` | `admin123` |
| Facturador | `facturador@finanx.test` | `facturador123` |
| Cajero | `cajero@finanx.test` | `cajero123` |
| Supervisor | `supervisor@finanx.test` | `supervisor123` |
| Cliente (portal) | `cliente@finanx.test` | `cliente123` |

---

## 5. Mantener el código actualizado (Mac ↔ PC)

Cuando en **una** PC cambias código, súbelo. En la **otra**, bájalo.

**Al terminar de trabajar (en la PC que modificó):**
```powershell
git add -A
git commit -m "describe lo que hiciste"
git push
```

**Al empezar a trabajar (en la otra PC):**
```powershell
git pull
```

> Haz `git pull` **antes** de tocar código. Si tus archivos están en conflicto, PowerShell te lo dirá y se resuelve a mano (o me lo pegas aquí).

---

## 6. Detener / reiniciar

```powershell
.\levantar.ps1 --stop         # detiene la app (los datos se conservan)
.\levantar.ps1                # la vuelve a levantar
.\levantar.ps1 --purge        # detiene y BORRA los datos (instalación nueva)
```

> ⚠️ `--purge` borra TODOS los datos. No lo uses si quieres conservar registros.

---

## 7. Abrir la base de datos (Windows)

La base corre dentro de Docker en el puerto **5432** (igual que en Mac):

**Consola:**
```powershell
docker exec -it finanx-db psql -U finanx -d finanx
```

**pgAdmin 4** (opcional):
1. Instala **pgAdmin 4 for Windows** (el `.exe` de 64 bits / x64).
2. Register → Server:

| Campo | Valor |
|---|---|
| Host | `localhost` |
| Port | `5432` |
| Database | `finanx` |
| Username | `finanx` |
| Password | `finanx` |

> En la PC nueva **no habrá** un "PostgreSQL 18" local que te confunda: solo verás el servidor FINAN-X que crees.

---

## 8. Problemas comunes (y su solución)

| Problema | Solución |
|---|---|
| `docker: command not found` | Docker no instalado o PowerShell no reiniciado. Repite el paso 1. |
| *"WSL 2 installation is incomplete"* | PowerShell como administrador → `wsl --update` → reinicia y abre Docker Desktop. |
| *"Virtualization is not enabled"* | Activa "Intel VT-x" / "AMD-V" en la BIOS y reinicia. |
| El puerto 5432/4000/8080 está ocupado | Otra app usa esos puertos. Ciérrala, o cambia el puerto en `docker-compose.yml`. |
| *"Test-DockerRunning : el término ... no se reconoce"* | Ese error **ya está corregido** en las últimas versiones de los scripts. Ejecuta `git pull` para traerlas. |
| *"failed to connect to the docker API ... daemon is not running"* | Docker Desktop no estaba encendido. El script ahora **lo abre solo** y espera ~2 min. O ábrelo manualmente y deja que diga *Engine running*. |
| Los scripts `.sh` fallan aquí | Son de Mac/Linux. **Usa los `.ps1`**: `levantar.ps1`, `iniciar-app.ps1`. |
| El antivirus bloquea Docker | Agrega Docker Desktop a las exclusiones del antivirus. |
| La primera carga es muy lenta | Es normal (descarga imágenes). Las siguientes son rápidas. |

---

## 9. (Opcional) Llevar los datos de una PC a la otra

Cada computadora tiene **su propia base** en Docker (los datos NO se sincronizan con git). Para pasar datos entre PC:

**En la PC que tiene los datos (exporta):**
```powershell
.\sincronizar-datos.ps1 export
```
Crea un archivo `respaldo\finanx_FECHA.sql`. Llévalo a la otra PC (USB, Drive…).

**En la PC de destino (importa):**
```powershell
.\sincronizar-datos.ps1 import
```
Te pedirá confirmación y **reemplazará** los datos actuales por los del respaldo.

> ⚠️ `import` borra los datos actuales de esa PC. Asegúrate de que es lo que quieres.

---

**¿Dudas en cualquier paso? Mándame el mensaje tal cual te salga y te lo resuelvo.** 🚀
