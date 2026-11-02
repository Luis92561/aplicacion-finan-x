# Abrir FINAN-X en otra computadora

Guía corta para llevar el proyecto a otro equipo (por ejemplo, el de la universidad).
La versión detallada está en `entrega/windows/LEEME-WINDOWS.txt` y
`entrega/mac/LEEME-MAC.txt`.

## 1. Qué llevar

| Elemento | Tamaño aprox. | Para qué |
|---|---|---|
| Carpeta `version final finan-x/` | ~40 MB | Código, documentación y lanzadores. |
| `entrega/windows/paquete-offline/` | ~250 MB | Funcionar **sin internet** en Windows. |
| `entrega/mac/paquete-offline/` | ~250 MB | Funcionar **sin internet** en Mac Intel. |
| `primer-ingreso/Acta-Usuarios-Primer-Ingreso.pdf` | < 1 MB | Claves temporales. |

Cabe en un USB de 1 GB. Formatee el USB en **exFAT** (sirve para Windows y Mac).

## 2. Windows

1. Doble clic en `entrega/windows/ABRIR-FINAN-X.bat`.
2. Si SmartScreen avisa: *Más información → Ejecutar de todas formas*.
3. Esperar a que abra el navegador en <http://localhost:8080>.

Requisito: **Docker Desktop instalado** (una sola vez, con WSL 2). Si no está, el lanzador
avisa y abre la página de descarga.

## 3. Mac (Intel)

1. Doble clic en `entrega/mac/ABRIR-FINAN-X.command`.
2. Si macOS lo bloquea: clic derecho → *Abrir* → *Abrir*.
3. Se abre <http://localhost:8080>.

El paquete de Mac se entrega como `.tar.gz` para conservar el permiso de ejecución.
Requisito: Docker Desktop para Mac instalado una sola vez.

## 4. Sin internet

Los lanzadores cargan automáticamente `paquete-offline/*.tar.gz` si las imágenes no existen.
No se descarga nada. Si el paquete no está, el primer arranque necesita internet para
construir las imágenes.

## 5. Modo seguro (para la sustentación)

`ABRIR-MODO-SEGURO` (Windows/Mac) levanta HTTPS en <https://localhost:8443> con
certificado autofirmado. El navegador pide aceptar la excepción; es lo esperado. Sirve
para mostrar TLS, HSTS, CSP y `X-Frame-Options`.

## 6. Problemas frecuentes

| Síntoma | Solución |
|---|---|
| "Docker no está instalado" | Instalar Docker Desktop y reiniciar. |
| Docker no responde | Abrir Docker Desktop y esperar "Engine running". |
| Puerto 8080 ocupado | Cerrar el programa que lo usa (o usar el modo seguro en 8443). |
| El .bat no se ejecuta | Clic derecho → Propiedades → Desbloquear, o copiar al disco. |
| En Mac no abre el .command | `chmod +x ABRIR-FINAN-X.command` en Terminal, o descomprimir el `.tar.gz`. |
| No aparece la base de datos | No debe aparecer: es intencional (solo red interna). |
