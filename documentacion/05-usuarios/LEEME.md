# Usuarios iniciales

El acta con las cuentas y las **claves temporales** vive en la carpeta operativa:

- `primer-ingreso/Acta-Usuarios-Primer-Ingreso.pdf`
- `primer-ingreso/Acta-Usuarios-Primer-Ingreso.md`

Se mantiene en `primer-ingreso/` (y no aquí) porque contiene secretos de un solo uso y se
entrega junto con `usuarios-iniciales.json`, que está excluido del control de versiones.

Resumen del flujo:

1. El operador ejecuta `npm run init:usuarios` (o el lanzador de `entrega/`).
2. Cada cuenta nace con `debe_cambiar_clave = true`.
3. En el primer ingreso la aplicación obliga a cambiar la contraseña.
4. Un ADMIN puede restablecer claves desde **Usuarios → Restablecer clave**.

Detalle funcional: `../02-tecnica/SPEC_Funcional.md` y
`../04-seguridad/04-Estado-de-Remediacion.md`.
