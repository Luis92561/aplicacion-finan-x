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
| **E1_Modelo_Entidad_Relacion** | Docente / desarrolladores | PDF | **Evidencia 1** — Modelo entidad-relación: entidades, atributos, claves primarias y foráneas, relaciones y cardinalidades. Diagrama en notación pata de gallo generado desde el esquema real. |
| **E2_Diccionario_de_Datos** | Docente / desarrolladores | PDF | **Evidencia 2** — Diccionario de datos: cada campo con su tipo, longitud, PK, FK, obligatoriedad y descripción de negocio, incluidas la vista `factura_saldo` y las reglas de integridad. |
| **E3_ERS_IEEE830** | Docente / cliente | PDF | **Evidencia 3** — Especificación de requisitos según IEEE 830: 40 requisitos funcionales, 27 no funcionales, 15 reglas de negocio y 20 criterios de aceptación, todos verificables. |
| **E4_Matriz_Propiedad_Intelectual** | Docente / área legal | PDF | **Evidencia 4** — Matriz de propiedad intelectual: qué es propio del equipo, qué es de terceros y bajo qué licencia. Revisión de las 238 dependencias del proyecto. |
| **E5_Contrato_Licencia_Software** | Docente / área legal | PDF | **Evidencia 5** — Contrato de licencia de uso: el equipo conserva la titularidad y la empresa recibe una licencia no exclusiva de uso interno. Incluye anexo resumen de una página. |
| **E6_Matriz_Trazabilidad** | Docente / equipo | PDF | **Evidencia 6** — Matriz de trazabilidad: cada requisito encadenado a su historia de usuario, caso de uso, endpoint, pantalla, entidad, prueba y requisito no funcional. |
| **E7_Pruebas_Integracion** | Docente / equipo | PDF | **Evidencia 7** — Pruebas de integración: las 154 comprobaciones con su registro de ejecución, 48 casos de control, capturas del sistema y los defectos encontrados y corregidos. |

> **Si quiere recrear el proyecto desde cero con Claude Code u OpenCode:** entregue los tres archivos `SPEC_Funcional.md` + `SPEC_Tecnico.md` + `PLAN_Creacion.md` (en ese orden) como contexto de la sesión, y siga la verificación de cada fase del plan.

## Archivos

```
documentacion/
├── LEEME.md                                ← este índice
├── A_Explicacion_Proyecto.html / .pdf      ← explicación para todos los públicos
├── B_Guia_Tecnica_Desarrolladores.html / .pdf  ← guía para futuros desarrolladores
├── FINAN-X_Documentacion.html / .pdf       ← documentación técnica completa
├── Instrucciones_Despliegue.html / .pdf / .md  ← cómo levantar el sistema y orden de lectura del código
├── E1_Modelo_Entidad_Relacion.pdf          ← evidencias académicas (1 de 7)
├── E2_Diccionario_de_Datos.pdf             ← 2 de 7
├── E3_ERS_IEEE830.pdf                      ← 3 de 7
├── E4_Matriz_Propiedad_Intelectual.pdf     ← 4 de 7
├── E5_Contrato_Licencia_Software.pdf       ← 5 de 7
├── E6_Matriz_Trazabilidad.pdf              ← 6 de 7
├── E7_Pruebas_Integracion.pdf              ← 7 de 7 (incluye capturas del sistema)
├── capturas/                               ← capturas usadas en la Evidencia 7
├── _generador/                             ← scripts que producen las evidencias (ver abajo)
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

### Evidencias académicas (E1 a E7)

Las siete evidencias **no se escriben a mano**: se generan a partir de la base de datos y del
código, de modo que no pueden contradecir a la implementación. Los scripts están en
`documentacion/_generador/`.

```bash
# 1. Extraer el esquema real de la base de datos (necesita PostgreSQL en marcha)
cd backend && node scripts/generar-esquema.mjs && cd ..

# 2. Generar los documentos HTML
node documentacion/_generador/01-mer.mjs
node documentacion/_generador/02-diccionario.mjs
node documentacion/_generador/03-ers.mjs
node documentacion/_generador/04-propiedad-intelectual.mjs
node documentacion/_generador/05-contrato-licencia.mjs
node documentacion/_generador/06-trazabilidad.mjs
node documentacion/_generador/07-pruebas-integracion.mjs

# 3. Convertir a PDF (detecta Chrome o Edge automáticamente)
node documentacion/_generador/a-pdf.mjs

# 4. Comprobar el resultado (coherencia entre documentos y calidad)
node documentacion/_generador/verificar.mjs
```

La Evidencia 7 y la 6 dependen de la **salida real de la suite de pruebas**, que hay que
capturar antes:

```bash
cd backend && npm test > ../deep-docs/_salida-e2e.txt
```

> **Aviso sobre la codificación:** en PowerShell, comprobar que el archivo resultante sea
> UTF-8. Si queda en UTF-16 (con bytes nulos entre los caracteres) se pierden los símbolos
> de aprobado y fallo, y las evidencias 6 y 7 dejarían de poder contrastar las pruebas.

Las licencias de la Evidencia 4 se extraen del árbol de dependencias:

```bash
node deep-docs/generar-licencias.mjs
```

Las capturas de pantalla de la Evidencia 7 se toman controlando Chrome por el protocolo
DevTools (no necesita ninguna dependencia instalada):

```bash
node deep-docs/capturar-pantallas.mjs
```

## Otros documentos del proyecto

- **README.md** (raíz del proyecto) — cómo ejecutar la aplicación (Docker) y las credenciales de demostración.
- **levantar.sh** (raíz del proyecto) — script de arranque (Docker o modo desarrollo) descrito en `Instrucciones_Despliegue`.
- **docker-compose.yml** — orquestación del stack completo (base de datos, API y frontend).
- **backend/scripts/e2e.mjs** — suite de pruebas end-to-end (**154 comprobaciones**).
- **deep-docs/** — notas internas del proyecto (arquitectura, base de datos, API, reglas de negocio, frontend, estado de Git y mejoras aplicadas).

---

*FINAN-X · Octubre de 2026*