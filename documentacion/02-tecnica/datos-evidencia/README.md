# Datos de evidencia

Insumos que usan los generadores de `documentacion/02-tecnica/generador-documentos/` para construir
las evidencias **E1–E7**. No son documentación de lectura: son datos de entrada reproducibles.

| Archivo | Para qué sirve | Cómo se regenera |
|---|---|---|
| `deep-docs/_esquema.json` | Esquema real (columnas, PK, FK, UNIQUE, CHECK, índices, vistas) | `node backend/scripts/generar-esquema.mjs` |
| `deep-docs/_descripciones.json` | Descripción de negocio de cada columna | Edición manual (es la única fuente) |
| `deep-docs/_licencias.json` | Dependencias y licencias de backend y frontend | `node documentacion/02-tecnica/datos-evidencia/deep-docs/generar-licencias.mjs` |
| `deep-docs/_salida-e2e.txt` | Salida de la suite end-to-end que citan E6 y E7 | `cd backend && node scripts/e2e.mjs > ../documentacion/02-tecnica/datos-evidencia/deep-docs/_salida-e2e.txt` |

Los dos scripts `_prueba-*.sql` y `_verificacion-fanout.mjs` son las comprobaciones aritméticas del
error de saldo que se documenta en E3 y E5.