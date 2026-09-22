# 📚 Documentación de FINAN-X

Bienvenido(a) a la carpeta donde vive **toda** la documentación del proyecto FINAN-X.
Elija el documento según sus necesidades:

| Documento | Para quién | Formato | Qué contiene |
|---|---|---|---|
| **A_Explicacion_Proyecto** | Cualquier persona, **sin conocimientos técnicos** | PDF / HTML | Qué es FINAN-X, por qué se construyó así, para qué sirve cada pieza, roles, seguridad, glosario sencillo. |
| **B_Guia_Tecnica_Desarrolladores** | **Futuros desarrolladores** del proyecto | PDF / HTML | Constancia técnica: arquitectura, modelo de datos, API, reglas de negocio, cómo levantar, probar y extender el sistema. Incluye resumen de historias de usuario (§2.3). |
| **FINAN-X_Documentacion** | Lectores técnicos | PDF / HTML | Documentación técnica completa: arquitectura, modelo de datos, API, casos de uso, seguridad, pruebas, trazabilidad e **historias de usuario (backlog §2.4)**. |
| **Instrucciones_Despliegue** | Cualquier persona que necesite **poner a correr el sistema** | MD / HTML / PDF | Cómo abrir FINAN-X en el navegador (Docker o modo desarrollo), uso del script `levantar.sh`, credenciales demo, **orden recomendado para leer el código** (backend y frontend) y solución de problemas. |
| **SPEC_Funcional** | Agentes de IA (Claude Code / OpenCode) y analistas | Markdown | Especificación funcional para **recrear el proyecto**: qué hace, actores, **historias de usuario (§2.3)**, módulos, reglas de negocio, requisitos de OTP y datos de pago, criterios de aceptación. |
| **SPEC_Tecnico** | Agentes de IA (Claude Code / OpenCode) y desarrolladores | Markdown | Especificación técnica para **recrear el proyecto**: stack, estructura, esquema SQL completo, contrato de la API, seguridad, configuración, Docker y pruebas. |
| **PLAN_Creacion** | Agentes de IA (Claude Code / OpenCode) | Markdown | **Plan paso a paso** (12 fases) en que se construyó FINAN-X, con verificación en cada fase. Se ejecuta junto con las dos specs. |
| **../mockups/** | Cliente / interesados | HTML + PDF | **Prototipos de demostración** (14 pantallas wireframe "tipo demo") para validar estructura y flujos sin usar la aplicación final. Entrar por `mockups/index.html`; versión imprimible en `mockups/FINAN-X_Mockups_Demo.pdf` (galería + pantallas). |
| **diagrams/** | Todos | .puml / .svg | Diagramas PlantUML fuente y sus versiones renderizadas: casos de uso, clases, secuencias, **arquitectura hexagonal** (`FINAN_X_Arquitectura_Hexagonal.svg`) y **Gantt simulado del proyecto** (`FINAN_X_Diagrama_Gantt.svg`, 21 ago – 28 sep 2026). |

> **Si quiere recrear el proyecto desde cero con Claude Code u OpenCode:** entregue los tres archivos `SPEC_Funcional.md` + `SPEC_Tecnico.md` + `PLAN_Creacion.md` (en ese orden) como contexto de la sesión, y siga la verificación de cada fase del plan.

## Archivos

```
documentacion/
├── LEEME.md                                ← este índice
├── A_Explicacion_Proyecto.html / .pdf      ← explicación para todos los públicos
├── B_Guia_Tecnica_Desarrolladores.html / .pdf  ← guía para futuros desarrolladores
├── FINAN-X_Documentacion.html / .pdf       ← documentación técnica completa
├── Instrucciones_Despliegue.html / .pdf / .md  ← cómo levantar el sistema y orden de lectura del código
├── SPEC_Funcional.md                       ← spec funcional (recrear el proyecto)
├── SPEC_Tecnico.md                         ← spec técnico (recrear el proyecto)
├── PLAN_Creacion.md                        ← plan paso a paso de la creación
├── diagrams/                               ← diagramas PlantUML (.puml) y SVG
│   ├── 14_diagrama_gantt.puml              ← Gantt simulado (21 ago – 28 sep 2026)
│   ├── FINAN_X_Diagrama_Gantt.svg          ← render del Gantt
│   ├── FINAN_X_Arquitectura_Hexagonal.svg  ← render de la arquitectura hexagonal
│   └── render.sh                           ← script para regenerar los SVG
```

Además, en `../mockups/`:
- `FINAN-X_Mockups_Demo.pdf` — **versión PDF de la galería de mockups** (portada + 14 pantallas).

## Cómo se regenera esta documentación

1. **Diagramas** (requiere Java y descarga automática de `plantuml.jar`):
   ```bash
   bash documentacion/diagrams/render.sh
   ```
2. **PDFs** (los PDFs se generan desde los HTML con Google Chrome en modo headless):
   ```bash
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
     --headless --disable-gpu --no-sandbox \
     --print-to-pdf="documentacion/A_Explicacion_Proyecto.pdf" --no-pdf-header-footer \
     "file://$PWD/documentacion/A_Explicacion_Proyecto.html"
   # Repetir para B_Guia_Tecnica_Desarrolladores.html, FINAN-X_Documentacion.html e Instrucciones_Despliegue.html
   ```

## Otros documentos del proyecto

- **README.md** (raíz del proyecto) — cómo ejecutar la aplicación (Docker) y las credenciales de demostración.
- **levantar.sh** (raíz del proyecto) — script de arranque (Docker o modo desarrollo) descrito en `Instrucciones_Despliegue`.
- **docker-compose.yml** — orquestación del stack completo (base de datos, API y frontend).
- **backend/scripts/e2e.mjs** — suite de pruebas end-to-end (**99 casos**).

---

*FINAN-X · Septiembre de 2026*