# Documentación de FINAN-X · Índice

> **Versión:** 1.0.0 · **Fecha:** noviembre de 2026
> Este índice reemplaza al antiguo `LEEME.md`. La documentación está organizada por
> propósito: académica, técnica, operación, seguridad, usuarios y anexos.

## 00 · Guía del docente

| Documento | Contenido |
|---|---|
| `00-guia-docente/Guia_Entregables_Integracion_de_Aplicaciones_UNISABANETA.docx` | Guía oficial de entregables y evidencias del curso. |

## 01 · Académica (evidencias E1–E7)

| Documento | Contenido |
|---|---|
| `01-academica/FINAN-X_Documentacion.pdf` | Documentación general del proyecto. |
| `01-academica/A_Explicacion_Proyecto.pdf` | Explicación del proyecto y su alcance. |
| `01-academica/B_Guia_Tecnica_Desarrolladores.pdf` | Guía técnica para desarrolladores. |
| `01-academica/E1_Modelo_Entidad_Relacion` | Modelo entidad-relación (HTML y PDF). |
| `01-academica/E2_Diccionario_de_Datos` | Diccionario de datos. |
| `01-academica/E3_ERS_IEEE830` | Especificación de requisitos IEEE 830. |
| `01-academica/E4_Matriz_Propiedad_Intelectual` | Matriz de propiedad intelectual. |
| `01-academica/E5_Contrato_Licencia_Software` | Contrato de licencia. |
| `01-academica/E6_Matriz_Trazabilidad` | Matriz de trazabilidad requisitos ↔ implementación. |
| `01-academica/E7_Pruebas_Integracion` | Evidencias de pruebas de integración. |

## 02 · Técnica

| Documento | Contenido |
|---|---|
| `02-tecnica/SPEC_Funcional.md` | Especificación funcional. |
| `02-tecnica/SPEC_Tecnico.md` | Especificación técnica. |
| `02-tecnica/PLAN_Creacion.md` | Plan de creación del proyecto. |
| `02-tecnica/DASHBOARD.md` | Métricas, datos y comportamiento del panel de control. |
| `02-tecnica/GUIA_CODIGO_COMPLETO.md` | Guía de código (documento extenso). |
| `02-tecnica/FINAN-X_Diagrama_Clases.pdf` | Diagrama de clases. |
| `02-tecnica/diagrams/` | Diagramas UML y de arquitectura (fuentes y SVG). |
| `02-tecnica/generador-documentos/` | Scripts que generan las evidencias E1–E7. |
| `../refactor.md` (raíz del proyecto) | Plan de refactor por fases y deuda técnica priorizada. |
| `../capacidad.md` (raíz del proyecto) | Plan de capacidad para 600–1.000 clientes y para 600–1.000 empresas (SaaS), con umbrales y checklist. |

## 03 · Operación y despliegue

| Documento | Contenido |
|---|---|
| `03-operacion/Instrucciones_Despliegue.md` / `.pdf` | Cómo desplegar y verificar el sistema. |
| `03-operacion/CHECKLIST-DESPLIEGUE.md` | Lista de verificación antes de publicar. |
| `03-operacion/ABRIR-EN-OTRA-PC.md` | Cómo llevar la aplicación a otro equipo (Windows/Mac). |

## 04 · Seguridad

| Documento | Contenido |
|---|---|
| `04-seguridad/01-Informe-Auditoria-Seguridad-FINAN-X.md` / `.pdf` | Auditoría de seguridad (32 hallazgos). |
| `04-seguridad/02-Hallazgos.csv` | Hallazgos en formato de tabla. |
| `04-seguridad/03-Metodologia-y-Evidencias.md` | Método, comandos y hashes de la auditoría. |
| `04-seguridad/04-Estado-de-Remediacion.md` | Qué se corrigió y cómo se verificó. |
| `04-seguridad/05-Revision-Lanzamiento-GO-NO-GO.md` | Revisión del comité de lanzamiento (QA, DevOps, Tech Lead y Producto) con veredicto GO/NO-GO. |

## 05 · Usuarios

| Documento | Contenido |
|---|---|
| `05-usuarios/Acta-Usuarios-Primer-Ingreso.md` / `.pdf` | Cuentas iniciales, claves temporales y cambio obligatorio. |

## 06 · Anexos

| Documento | Contenido |
|---|---|
| `06-anexos/mockups/` | Prototipos de pantallas (HTML/CSS y PDF). |
| `06-anexos/capturas/` | Capturas de la aplicación. |

## 07 · Notas internas

| Documento | Contenido |
|---|---|
| `07-notas-internas/` | Notas de desarrollo, decisiones y revisiones anteriores. |

---

**Nota sobre documentos PDF:** los PDF de las evidencias E1–E7 y de las guías A/B se
conservan tal como se entregaron. Si cambia el código, la referencia vigente es este
`README`, `Instrucciones_Despliegue` y `SPEC_*.md`; los PDF no se regeneran
automáticamente.
