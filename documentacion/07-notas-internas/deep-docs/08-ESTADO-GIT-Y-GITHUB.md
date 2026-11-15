# 🔀 Estado de Git y de GitHub

> ✅ **ACTUALIZADO.** Al inicio del proyecto no había repositorio Git. Ya está resuelto:
> el repositorio existe, está vinculado y el proyecto quedó versionado.
> Este documento conserva el diagnóstico original (útil como contexto) y documenta el estado final.

## 🔎 Hallazgo importante: el repositorio ya existía y tenía historia

Mi diagnóstico inicial —"no hay repositorio"— era **correcto para esta carpeta**, pero **incompleto**:
el repositorio **sí existía en GitHub, es privado, y ya tenía 8 commits**. Como es privado, GitHub
responde `Not Found` a quien no está autenticado, así que desde fuera parecía no existir.

- **Remoto:** https://github.com/Luis92561/aplicacion-finan-x.git (**privado**)
- **Rama principal:** `main` @ `797c38e` · **otra rama:** `pruebas`

La copia local era **más antigua** que el repositorio. Comprobado: el código local coincidía
exactamente con la rama `pruebas`, y `main` había avanzado añadiendo documentación y arreglos.

### Lo que el repositorio tenía y esta copia local **no**

| Archivo | Para qué sirve |
|---|---|
| `.gitattributes` | **Fija los finales de línea**: `*.sh` siempre LF (o fallan en Mac/Linux), binarios sin tocar |
| `sincronizar-datos.ps1` / `.sh` | Scripts de sincronización de datos entre Mac y Windows |
| `GUIA-GIT.md` / `GUIA-GIT-WINDOWS.md` | Guías de Git (incluida la versión para PowerShell) |
| `documentacion/FINAN-X_Diagrama_Clases.pdf` | Diagrama de clases detallado |
| `documentacion/diagrams/15_diagrama_clases_detallado.puml` + `.svg` | Fuente y render del mismo |

### ⚠️ El detalle que casi causa un problema

La copia local tenía `levantar.ps1` e `iniciar-app.ps1` con **caracteres no ASCII y sin BOM**
(133 y 10 caracteres: `·óé▶⚠✔`), mientras el repositorio los tiene en **ASCII puro**.

La historia de commits del repositorio explica por qué:

> `9dad982` **Fix: scripts Windows (levantar/iniciar/sincronizar) en ASCII puro para PowerShell 5.1**

PowerShell 5.1 (el que trae Windows) lee los `.ps1` sin BOM como ANSI, así que esos acentos y símbolos
se rompen. **Subir la copia local habría reintroducido ese bug.** Por eso en la integración se
conservaron **los `.ps1` del repositorio** y solo se llevó el código de la corrección.

### Otro detalle: los HTML de la documentación

`documentacion/*.html` aparece en el `.gitignore` del repositorio:

```
# Documentos generados (se regeneran con los scripts)
# NOTA: los PDF de la doc SI viajan por git (para tenerlos en ambas PC).
documentacion/*.html
```

Es decir: **los HTML se excluyen a propósito** y viajan los PDF. No es una pérdida, es una decisión.
(El `.gitignore` local, en cambio, era la versión mínima original.)

---

## Diagnóstico original (al inicio del proyecto)

<details>
<summary>Por qué al principio parecía que no había repositorio (clic para desplegar)</summary>

### No había Git en esta carpeta

```
git status
→ fatal: not a git repository (or any of the parent directories): .git
```

Se buscó un directorio `.git` de forma recursiva en todo el proyecto **y** en toda la cadena de
carpetas padre: **ninguno**. `git remote -v` no devolvía nada y no había historial.

### La documentación lo confirmaba

- `documentacion/B_Guia_Tecnica_Desarrolladores.html` §12: *"`git init` + commits del repositorio
  (**aún no versionado**)"*.
- `documentacion/SPEC_Funcional.md` línea 243: *"Repositorio Git versionado (**aún no inicializado**)"*.

Era cierto **para esta copia**: el proyecto se desarrolló y se versionó desde la otra máquina (Mac), y
esta copia llegó sin el directorio `.git` (por eso existen `sincronizar-datos.ps1/.sh` y las guías de
Git: el flujo de trabajo era Mac ↔ Windows). Eso explica el desfase.

### Ya existía un `.gitignore` (versión mínima)

```
node_modules/
dist/
.env
*.log
.DS_Store
```

</details>

---

## Herramientas disponibles en esta máquina

| Herramienta | Estado |
|---|---|
| `git` | ✅ **2.55.0.windows.5** |
| `gh` (GitHub CLI) | ❌ No instalado |
| Git Credential Manager | ✅ Funcionó (el `push` autenticó correctamente) |
| Llaves SSH en `~/.ssh` | ❌ No hay |
| Identidad de Git | ⚠️ La global tenía **`user.name` duplicado** (`luis92561` y `Luis`); se fijó a nivel de repo |

> Se configuró la identidad **solo en este repositorio** (`git config user.name/user.email`), sin tocar
> la global. Convendría limpiar la duplicada:
> `git config --global --unset-all user.name` y volver a definirla una sola vez.

## Conectividad

| Prueba | Resultado |
|---|---|
| DNS `github.com` | ✅ `140.82.113.4` |
| `git ls-remote` a GitHub | ✅ Funciona |
| TCP 22 (SSH) | ✅ Abierto |
| `curl` / `Invoke-WebRequest` | ❌ Fallan incluso contra `google.com` → limitación del sandbox, no bloqueo a GitHub |

**Conclusión:** la máquina habla perfectamente con GitHub. El problema nunca fue la red.

---

## ✅ Estado final

```
origin  https://github.com/Luis92561/aplicacion-finan-x.git (fetch/push)
main    →  origin/main + los commits nuevos de la corrección
```

La integración se hizo **con base en el repositorio remoto**, para no perder nada:

1. Se partió de `origin/main` (`797c38e`) → se conserva **todo** el trabajo del remoto.
2. Encima se aplicó la **corrección del bug de saldo** (9 archivos, commit `5877ef8`).
3. Se añadió esta carpeta `deep-docs/`.

**Nada se eliminó.** Verificado: el diff solo toca los 9 archivos de la corrección, no hay ningún
archivo borrado y los `.ps1` ASCII quedaron intactos.

### Cómo subirlo

```bash
git push -u origin main
```

Si pide credenciales, en GitHub ya no valen la contraseña: usa un **Personal Access Token** (Settings →
Developer settings → Personal access tokens) como contraseña, o configura SSH.

### Aviso sobre la base de datos ya creada

La corrección incluye la vista `factura_saldo`, pero **`init.sql` solo se ejecuta al crear el volumen
desde cero**. En una base que ya existe hay que reemplazar la vista a mano:

```bash
docker exec -i finanx-db psql -U finanx -d finanx < database/migracion_notas_credito.sql
```

---

*Diagnóstico inicial verificado sobre el sistema de archivos, la configuración de Git y la red;
integrado después con base en el repositorio remoto.*
