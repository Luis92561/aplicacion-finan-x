# 🔄 FINAN-X · Cómo trabajar en dos computadoras (Mac + Windows)

El proyecto ahora está bajo **Git** (historial de cambios) y se sincroniza con un repositorio **privado de GitHub**. Así, **el código** vive en las dos PC y siempre está actualizado; **la base de datos**, en cambio, vive **dentro de cada PC** (en Docker) y se pasa aparte cuando la necesites.

---

## 1. La regla de oro

| Qué | Dónde vive | Cómo se sincroniza |
|---|---|---|
| **El código** (backend, frontend, scripts, docs) | En el repositorio (GitHub) | `git pull` / `git push` |
| **La base de datos** | En el volumen Docker de CADA PC (`finanx_pgdata`) | Con `sincronizar-datos.*` (export/import) — solo si necesitas los mismos datos |
| `node_modules` | En cada PC | Se regenera solo (`npm install`) o se usa Docker |

> Cada computadora es "igual pero independiente": mismo código, misma app, misma base demo. Los cambios se comparten CON git.

---

## 2. Primera vez en una computadora nueva (Windows)

1. Instala **Git for Windows**: https://git-scm.com (siguiente → siguiente → listo).
2. Instala **Docker Desktop for Windows** (acepta WSL 2).
3. Abre PowerShell y clona el proyecto:

```powershell
git clone https://github.com/TU-USUARIO/finanx.git C:\FINANX
cd C:\FINANX
.\levantar.ps1
```

4. Tu identidad para los commits (una sola vez):

```powershell
git config --global user.name "Tu Nombre"
git config --global user.email "tu@correo.com"
```

---

## 3. Flujo de trabajo diario (en AMBAS PC)

Antes de empezar a trabajar, **trae los cambios de la otra PC**:

```bash
# Mac
git pull
```

```powershell
# Windows
git pull
```

Trabaja normal. Cuando termines, **sube tus cambios**:

```bash
# Mac y Windows (igual)
git add -A
git commit -m "Describe qué hiciste"
git push
```

> 🔑 **Regla de los 3 pasos:** `pull` antes de empezar, `add + commit + push` al terminar. Si al hacer `push` te dice que hay cambios en GitHub, haz `git pull` primero y vuelve a intentar.

---

## 4. Si editas y OTRA PC ya subió cambios (conflicto)

Git intenta mezclar solo. Si dos personas/pc cambian **la misma línea** de un archivo, Git marca un **conflicto**: aparece `<<<<<<<` en el archivo. Solución en 3 pasos:

1. Abre el archivo y decide qué versión te quedas (borra las líneas `<<<<<<<`, `=======`, `>>>>>>>`).
2. Guarda el archivo.
3. Vuelve a subir:

```bash
git add -A
git commit -m "Resueltos conflictos"
git push
```

---

## 5. Llevar los DATOS de la base de una PC a otra (opcional)

Cada PC arranca con la base demo, así que normalmente no necesitas pasar nada. Pero si quieres que la PC Windows tenga **los mismos datos que tu Mac** (facturas, pagos, etc.):

**En la Mac (exporta):**

```bash
./sincronizar-datos.sh export
```

Se crea `respaldo/finanx_20260921_…sql`. Lleva ese archivo a la PC Windows (USB, Drive, etc.)

**En la PC Windows (importa):**

```powershell
docker compose down -v        # borra la base actual de esa PC (¡sí, se pierde!)
docker compose up -d db       # la recrea vacía
.\sincronizar-datos.ps1 import
docker compose up -d --build  # levanta la app completa
```

> ⚠️ El import **reemplaza** los datos de esa PC. Y como `sincronizar-datos.sh export` guarda el respaldo dentro de la carpeta del proyecto (que está ignorada por git), el archivo `.sql` **no sube a GitHub** — se mueve aparte (USB/Drive). Así no ensuciamos el repositorio con respaldos.

---

## 6. Comandos útiles (referencia rápida)

```bash
git status          # ¿qué archivos cambiaron?
git log --oneline   # historial de commits
git diff            # ver el detalle de lo no guardado
git pull            # traer cambios
git push            # subir cambios
git add -A && git commit -m "mensaje"   # guardar mis cambios (los 2 juntos)
```

---

## 7. Recomendaciones

- **Commit pequeños y con mensaje claro.** (*"Agrego filtro de fecha en pagos"* es mejor que *"cambios"*).
- **Haz `git pull` antes de empezar cada sesión**, siempre.
- **Nunca edites el mismo archivo a la vez en las dos PC** — así evitarás conflictos.
- Los cambios en la app se ven al recargar el navegador; no necesitas reinstalar nada.
- ¿Quieres otra persona mirando? GitHub privado + invitarla como colaborador (Settings → Collaborators).