# 🔄 FINAN-X en Windows · Guía de Git (PowerShell)

Todo el código de FINAN-X vive en un **repositorio privado de GitHub**. Con Git mantienes **las dos computadoras sincronizadas**: haces cambios en una, los subes, y en la otra los bajas. Aquí está todo en PowerShell.

---

## 0. La regla de oro

| Qué | Dónde vive | Cómo se sincroniza |
|---|---|---|
| **El código** (backend, frontend, scripts, docs) | En el repositorio (GitHub) | `git pull` / `git push` |
| **La base de datos** | Dentro del Docker de CADA PC (volumen local `finanx_pgdata`) | Con `.\sincronizar-datos.ps1 export/import` — solo si necesitas los mismos datos |
| `node_modules` | En cada PC, dentro de Docker | No se guarda en git; se regenera solo |

> Cada PC es "igual pero independiente": mismo código, misma app, misma base demo. Los **cambios de código** se comparten por Git; los **datos** solo si tú los exportas/importas.

---

## 1. Clonar el proyecto (primera vez en la PC)

```powershell
git clone https://github.com/Luis92561/aplicacion-finan-x.git C:\FINANX
cd C:\FINANX
```

Configura tu identidad (una sola vez):

```powershell
git config --global user.name "Luis"
git config --global user.email "tu-correo@correo.com"
```

> 🔑 Para descargar (clone) necesitas un **token de acceso personal** si el repo es privado: crea un token en GitHub → Settings → Developer settings → Personal access tokens → le das permiso **repo**. Lo usas como contraseña de Git.

---

## 2. Flujo diario (en AMBAS PC, igual)

**Al empezar a trabajar — trae lo de la otra PC:**

```powershell
git pull
```

**Al terminar — sube lo que hiciste:**

```powershell
git add -A
git commit -m "Describe brevemente lo que hiciste"
git push
```

> 🔑 La "regla de los 3 pasos" al terminar: `add` + `commit` + `push`. Y **siempre `git pull` antes de empezar**.

---

## 3. Si otra PC ya subió cambios y tu `push` falla

Git intenta mezclar solo. Ejecuta:

```powershell
git pull
```

- Si **pull** se hace bien → vuelve a `git push`.
- Si aparece un **conflicto** (`<<<<<<<` en el archivo), PowerShell te lo dirá así:

```
CONFLICT (content): Merge conflict in backend/src/algo.js
```

Entonces:
1. Abre ese archivo y decide qué versión te quedas (borra las líneas `<<<<<<<`, `=======`, `>>>>>>>`).
2. Guarda el archivo.
3. Sube la solución:

```powershell
git add -A
git commit -m "Resueltos los conflictos"
git push
```

---

## 4. Comandos útiles (referencia)

```powershell
git status              # ¿qué cambió sin subir?
git log --oneline       # historial de commits
git pull                # traer cambios
git push                # subir cambios
git add -A              # marcar todos los cambios
git commit -m "texto"   # guardarlos localmente
```

---

## 5. Llevar los DATOS de una PC a otra (opcional)

Cada PC arranca con la base demo, así que normalmente **no necesitas pasar nada**. Pero si quieres que la PC nueva tenga **los mismos datos** que la otra (facturas, pagos…):

**En la PC que tiene los datos (exporta):**

```powershell
.\sincronizar-datos.ps1 export
```

Se crea `respaldo\finanx_FECHA.sql`. Lleva ese archivo a la otra PC (USB, Drive…).

**En la PC de destino (importa):**

```powershell
docker compose down -v        # borra la base actual de esa PC (¡se pierde!)
docker compose up -d db       # la recrea vacía
.\sincronizar-datos.ps1 import
docker compose up -d --build  # levanta la app completa
```

> ⚠️ El import **reemplaza** los datos de esa PC. Y como `sincronizar-datos.ps1 export` guarda el respaldo dentro de `respaldo\` (carpeta ignorada por git), el archivo `.sql` **no sube a GitHub** — se mueve aparte (USB/Drive). Así no ensuciamos el repositorio.

---

## 6. Detener / reiniciar

```powershell
.\levantar.ps1 --stop     # detiene todo (los datos se conservan)
.\levantar.ps1            # lo vuelve a levantar
.\levantar.ps1 --purge    # detiene y BORRA los datos (down -v)
```

---

## 7. Problemas comunes

| Problema | Solución |
|---|---|
| `git pull` pide contraseña y no funciona | Usa un **token** de GitHub (Settings → Developer settings → Personal access tokens → repo). |
| "No se reconoce 'git'" | Git for Windows no instalado o PowerShell no reiniciado. https://git-scm.com/download/win |
| "No se reconoce 'Test-DockerRunning'" | **Ya corregido** en los scripts. Haz `git pull` para traer la versión nueva. |
| "daemon is not running" | Docker Desktop apagado. El script lo abre solo, o ábrelo manualmente y espera "Engine running". |
| El archivo respaldo no aparece en git | Normal: `respaldo\` está ignorado. Muévelo aparte (USB/Drive). |

---

## 8. Recomendaciones

- **`git pull` antes de cada sesión**, siempre.
- **Mensajes de commit claros y cortos** ("Agrego filtro de fechas", no "cambios").
- **No edites el mismo archivo a la vez en las dos PC** → evitas conflictos.
- Los cambios se ven al recargar el navegador; no necesitas reinstalar nada.
- ¿Otra persona mirando? GitHub privado + añádela como *Collaborator* (Settings → Collaborators).

---

Todo listo. Cada noche: **pull antes de trabajar, add + commit + push al terminar.** ¡Eso es todo! 🚀
