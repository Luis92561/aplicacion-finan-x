/**
 * Evidencia 3 · Especificación de Requisitos de Software (IEEE 830 / ERS)
 *
 * Estructura segun el estandar IEEE 830, adaptada al proyecto real: cada
 * requisito se puede rastrear despues con casos de uso, entidades, endpoints,
 * pantallas y pruebas (ver Evidencia 6, matriz de trazabilidad).
 *
 * Los requisitos salen del software que existe: no hay ningun requisito que no
 * este implementado (la columna "Estado" lo declara y la Evidencia 7 lo prueba).
 *
 * Uso (desde la raiz):  node documentacion/_generador/03-ers.mjs
 */
import { html, portada, escribir, tabla } from './tema.mjs';

// ============================================================
// Requisitos funcionales
// ============================================================
// id, enunciado, actor, prioridad, verificacion (como se comprueba), estado
const RF = [
  ['RF-01', 'El sistema debe permitir <strong>registrar clientes</strong> con tipo (persona o empresa), tipo y número de identificación, nombre o razón social y datos de contacto.', 'Facturador', 'Alta', 'Prueba CP-03', 'Implementado'],
  ['RF-02', 'El sistema debe <strong>impedir clientes duplicados</strong> por combinación de tipo y número de identificación, respondiendo 409.', 'Facturador', 'Alta', 'Prueba CP-03', 'Implementado'],
  ['RF-03', 'El sistema debe permitir <strong>buscar clientes</strong> por nombre, razón social, número de documento o NIT, y filtrar por estado.', 'Facturador, Cajero', 'Media', 'Prueba CP-04', 'Implementado'],
  ['RF-04', 'El sistema debe permitir <strong>activar e inactivar clientes</strong> sin eliminarlos (baja lógica), conservando su historial.', 'Facturador', 'Media', 'Prueba CP-05', 'Implementado'],
  ['RF-05', 'El sistema debe permitir <strong>crear la cuenta de portal de un cliente</strong> (usuario y contraseña) para que acceda a su autoservicio.', 'Facturador', 'Media', 'Prueba CP-06', 'Implementado'],
  ['RF-06', 'El sistema debe permitir <strong>registrar productos</strong> con código único, precio e impuesto (porcentaje entre 0 y 100).', 'Facturador', 'Alta', 'Prueba CP-07', 'Implementado'],
  ['RF-07', 'El sistema debe <strong>rechazar códigos de producto duplicados</strong> (409) y precios negativos o impuestos fuera de rango (400).', 'Facturador', 'Alta', 'Prueba CP-08', 'Implementado'],
  ['RF-08', 'El sistema debe permitir <strong>crear pedidos</strong> con uno o más productos y cantidades para un cliente activo.', 'Cajero, Facturador', 'Alta', 'Prueba CP-09', 'Implementado'],
  ['RF-09', 'El sistema debe <strong>calcular los totales en el servidor</strong> (subtotal, impuestos y total), sin aceptar importes enviados por el navegador.', 'Sistema', 'Crítica', 'Prueba CP-10', 'Implementado'],
  ['RF-10', 'El sistema debe permitir <strong>confirmar o cancelar un pedido</strong>, admitiendo solo las transiciones válidas entre estados.', 'Cajero, Facturador', 'Alta', 'Prueba CP-11', 'Implementado'],
  ['RF-11', 'El sistema debe permitir <strong>modificar un pedido solo mientras esté en borrador</strong>; una vez confirmado debe rechazar la edición (409).', 'Facturador', 'Media', 'Prueba CP-12', 'Implementado'],
  ['RF-12', 'El sistema debe permitir <strong>generar una factura a partir de un pedido confirmado</strong>, copiando sus importes y numerándola de forma única.', 'Facturador', 'Crítica', 'Prueba CP-13', 'Implementado'],
  ['RF-13', 'El sistema debe <strong>impedir facturar un pedido que no esté confirmado</strong>, ya facturado o cancelado (409).', 'Sistema', 'Crítica', 'Prueba CP-14', 'Implementado'],
  ['RF-14', 'El sistema debe permitir <strong>anular una factura indicando el motivo</strong>, de forma lógica (sin borrarla) y conservándola en el historial.', 'Facturador', 'Alta', 'Prueba CP-15', 'Implementado'],
  ['RF-15', 'El sistema debe <strong>impedir anular una factura que tenga pagos registrados</strong> (409).', 'Sistema', 'Crítica', 'Prueba CP-16', 'Implementado'],
  ['RF-16', 'El sistema debe permitir <strong>refacturar un pedido cuya factura fue anulada</strong>, conservando la anulada como historial y admitiendo una sola factura activa por pedido.', 'Facturador', 'Alta', 'Prueba CP-17', 'Implementado'],
  ['RF-17', 'El sistema debe permitir <strong>registrar pagos</strong> contra una factura activa, con método de pago y referencia.', 'Cajero', 'Crítica', 'Prueba CP-18', 'Implementado'],
  ['RF-18', 'El sistema debe <strong>impedir que un pago supere el saldo pendiente</strong> de la factura (400).', 'Sistema', 'Crítica', 'Prueba CP-19', 'Implementado'],
  ['RF-19', 'El sistema debe <strong>calcular automáticamente el estado de pago</strong> de cada factura: PENDIENTE, PAGO_PARCIAL o PAGADA.', 'Sistema', 'Crítica', 'Prueba CP-20', 'Implementado'],
  ['RF-20', 'El sistema debe permitir <strong>consultar el saldo pendiente</strong> de una factura.', 'Todos los internos', 'Alta', 'Prueba CP-21', 'Implementado'],
  ['RF-21', 'El sistema debe permitir <strong>crear notas de crédito</strong> (devoluciones) sobre facturas activas, con motivo obligatorio.', 'Cajero', 'Alta', 'Prueba CP-22', 'Implementado'],
  ['RF-22', 'El sistema debe <strong>impedir devolver más de lo realmente pagado</strong> y no admitir más de una devolución sobre el mismo importe (400/409).', 'Sistema', 'Crítica', 'Prueba CP-23', 'Implementado'],
  ['RF-23', 'El sistema debe <strong>revertir el pago devuelto</strong>: una nota de crédito activa aumenta el saldo de la factura.', 'Sistema', 'Alta', 'Prueba CP-24', 'Implementado'],
  ['RF-24', 'El sistema debe permitir <strong>anular una nota de crédito con motivo</strong>, de forma lógica y una sola vez.', 'Cajero', 'Media', 'Prueba CP-25', 'Implementado'],
  ['RF-25', 'El sistema debe generar <strong>reportes de facturación por rango de fechas</strong>, con totales y desglose por método de pago.', 'Supervisor', 'Alta', 'Prueba CP-26', 'Implementado'],
  ['RF-26', 'El sistema debe mostrar un <strong>resumen del negocio</strong>: clientes y productos activos, pedidos por facturar, facturas activas y anuladas, pagos recibidos y cuentas por cobrar.', 'Supervisor, Administrador', 'Alta', 'Prueba CP-27', 'Implementado'],
  ['RF-27', 'El sistema debe mostrar el <strong>balance y las cuentas por cobrar por cliente</strong>.', 'Supervisor', 'Alta', 'Prueba CP-28', 'Implementado'],
  ['RF-28', 'El sistema debe permitir consultar el <strong>historial financiero de un cliente</strong> (facturas, pagos y notas con su saldo).', 'Supervisor', 'Media', 'Prueba CP-29', 'Implementado'],
  ['RF-29', 'El sistema debe generar el <strong>estado financiero de un cliente en texto</strong> para enviarlo por correo.', 'Facturador', 'Baja', 'Prueba CP-30', 'Implementado'],
  ['RF-30', 'El sistema debe <strong>registrar en auditoría</strong> toda operación sensible, con usuario, tipo, módulo, operación y fecha.', 'Administrador', 'Alta', 'Prueba CP-31', 'Implementado'],
  ['RF-31', 'El sistema debe permitir <strong>consultar la auditoría</strong> filtrando por módulo, usuario y operación.', 'Administrador, Supervisor', 'Media', 'Prueba CP-32', 'Implementado'],
  ['RF-32', 'El sistema debe permitir <strong>gestionar usuarios internos</strong> (crear, listar y habilitar/inhabilitar) con rol asignado, solo al administrador.', 'Administrador', 'Alta', 'Prueba CP-33', 'Implementado'],
  ['RF-33', 'El sistema debe permitir <strong>impedir quedarse sin administradores</strong>: un administrador no puede desactivarse a sí mismo ni al último activo (409).', 'Sistema', 'Media', 'Prueba CP-34', 'Implementado'],
  ['RF-34', 'El sistema debe permitir a un <strong>cliente autoregistrarse</strong> y quedar autenticado para usar el portal de inmediato.', 'Cliente', 'Alta', 'Prueba CP-02', 'Implementado'],
  ['RF-35', 'El sistema debe permitir a un cliente <strong>recuperar su contraseña con un código de un solo uso (OTP)</strong> de 6 dígitos, con caducidad e intentos limitados.', 'Cliente', 'Alta', 'Prueba CP-36', 'Implementado'],
  ['RF-36', 'El sistema debe <strong>aislar los datos entre clientes</strong>: un cliente solo puede ver lo suyo, y una factura ajena responde 404.', 'Sistema', 'Crítica', 'Prueba CP-38', 'Implementado'],
  ['RF-37', 'El sistema debe permitir al cliente <strong>pagar o abonar sus propias facturas en línea</strong>, respetando el saldo pendiente.', 'Cliente', 'Alta', 'Prueba CP-39', 'Implementado'],
  ['RF-38', 'El sistema debe permitir al cliente <strong>consultar su saldo, facturas, compras, pagos y notas de crédito</strong>, y sus datos personales.', 'Cliente', 'Alta', 'Prueba CP-40', 'Implementado'],
  ['RF-39', 'El sistema debe <strong>validar los datos de pago según el método</strong> (tarjeta, transferencia o cheque) y rechazar los inválidos.', 'Sistema', 'Alta', 'Prueba CP-41', 'Implementado'],
  ['RF-40', 'El sistema debe <strong>generar un código de pago en efectivo</strong> para que el cliente pague en un punto físico, sin registrar el pago en el portal.', 'Cliente', 'Media', 'Prueba CP-42', 'Implementado'],
];

// ============================================================
// Requisitos no funcionales
// ============================================================
const RNF = [
  ['RNF-01', 'Seguridad · contraseñas', 'Las contraseñas y los códigos OTP se almacenan cifrados con <strong>bcrypt</strong> (coste 10). Nunca en texto plano.', 'Crítica', 'Inspección de la base: la columna <code>password_hash</code> no contiene texto legible.'],
  ['RNF-02', 'Seguridad · datos de tarjeta', 'Nunca se almacenan el número completo de la tarjeta ni el CVV. Solo los <strong>últimos 4 dígitos</strong> y la marca (PCI-DSS).', 'Crítica', 'Prueba CP-43: la respuesta de la API no contiene el PAN ni el CVV.'],
  ['RNF-03', 'Seguridad · sesiones', 'La sesión se firma con <strong>JWT</strong> con caducidad de 8 horas.', 'Alta', 'Inspección: el token incluye <code>exp</code>.'],
  ['RNF-04', 'Seguridad · revocación de sesiones', 'Al cambiar la contraseña o desactivar una cuenta, <strong>las sesiones anteriores dejan de ser válidas</strong> de inmediato.', 'Alta', 'Prueba CP-37: el token anterior responde 401.'],
  ['RNF-05', 'Seguridad · fuerza bruta', 'El sistema bloquea temporalmente (429) tras <strong>5 intentos fallidos</strong> de inicio de sesión desde la misma dirección, en una ventana de 15 minutos. Un acceso correcto reinicia el contador.', 'Alta', 'Prueba CP-44.'],
  ['RNF-06', 'Seguridad · autorización', 'Cada operación exige el rol adecuado (RBAC). Un rol sin permiso recibe <strong>403</strong>.', 'Crítica', 'Prueba CP-35.'],
  ['RNF-07', 'Seguridad · fuerza del secreto', 'El sistema <strong>no arranca</strong> sin una clave de firma propia de al menos 32 caracteres, y rechaza los valores de ejemplo publicados en el repositorio.', 'Alta', 'Prueba CP-45: sin clave o con la de ejemplo, el arranque falla.'],
  ['RNF-08', 'Seguridad · exposición del OTP', 'En producción el código OTP <strong>no se devuelve</strong> en la respuesta de la API (solo en modo demostración).', 'Alta', 'Inspección de configuración: el valor por defecto depende del entorno.'],
  ['RNF-09', 'Seguridad · cabeceras HTTP', 'Las respuestas incluyen cabeceras de seguridad (<code>X-Content-Type-Options</code>, <code>X-Frame-Options</code>) y no revelan el servidor.', 'Media', 'Prueba CP-46.'],
  ['RNF-10', 'Seguridad · CORS', 'Solo los orígenes de la lista blanca reciben permiso de CORS.', 'Media', 'Prueba CP-47.'],
  ['RNF-11', 'Integridad · aislamiento de datos', 'El identificador de cliente se toma <strong>siempre del token</strong>, nunca de la petición.', 'Crítica', 'Revisión de código y prueba CP-38.'],
  ['RNF-12', 'Integridad · atomicidad', 'Las operaciones que afectan a varias tablas se ejecutan en <strong>transacción</strong>: o se aplican todas o ninguna.', 'Alta', 'Inspección: <code>BEGIN</code>/<code>COMMIT</code> en las rutas que lo requieren.'],
  ['RNF-13', 'Integridad · concurrencia', 'Dos pagos simultáneos sobre la misma factura no pueden superar el saldo (bloqueo de fila).', 'Alta', 'Inspección: <code>SELECT … FOR UPDATE</code>.'],
  ['RNF-14', 'Integridad · trazabilidad', 'La auditoría se registra <strong>dentro de la misma transacción</strong> que la operación, para que no existan cambios sin rastro.', 'Alta', 'Inspección del código de auditoría.'],
  ['RNF-15', 'Precisión monetaria', 'Los cálculos se redondean a 2 decimales en cada paso para evitar errores de coma flotante.', 'Crítica', 'Inspección de <code>round2()</code> y prueba CP-10.'],
  ['RNF-16', 'Usabilidad · idioma', 'Toda la interfaz y los mensajes de error están en <strong>español</strong>, con mensajes que explican la causa.', 'Media', 'Revisión de la interfaz.'],
  ['RNF-17', 'Usabilidad · formato local', 'Los importes se muestran en formato de moneda colombiana (COP) y las fechas en hora de Colombia.', 'Media', 'Revisión: <code>Intl.NumberFormat(&quot;es-CO&quot;)</code> y zona <code>America/Bogota</code>.'],
  ['RNF-18', 'Usabilidad · adaptabilidad', 'La interfaz es utilizable en pantallas de escritorio y se reordena en pantallas estrechas (una sola hoja de estilos, sin dependencias).', 'Baja', 'Revisión de la hoja de estilos (punto de quiebre a 900 px).'],
  ['RNF-19', 'Rendimiento · tiempo de respuesta', 'Las operaciones habituales responden en menos de <strong>2 segundos</strong> con la base de demostración.', 'Media', 'Ejecución de la suite completa: 154 comprobaciones sin esperas anómalas.'],
  ['RNF-20', 'Rendimiento · listados', 'Los listados están acotados (<code>LIMIT 300</code>) para no degradar la respuesta con volúmenes grandes.', 'Media', 'Inspección de las consultas.'],
  ['RNF-21', 'Portabilidad · despliegue', 'El sistema completo se levanta con <strong>un solo comando</strong> (<code>docker compose up</code>) en cualquier máquina con Docker.', 'Alta', 'Prueba CP-48: los tres contenedores quedan sanos.'],
  ['RNF-22', 'Portabilidad · configuración', 'Toda la configuración se hace por variables de entorno; no hay valores sensibles en el código.', 'Alta', 'Prueba CP-45 e inspección del archivo de composición.'],
  ['RNF-23', 'Mantenibilidad · separación de capas', 'La interfaz, la API y los datos están separados, y se comunican por HTTP con formato JSON.', 'Media', 'Revisión de la estructura del repositorio.'],
  ['RNF-24', 'Mantenibilidad · pruebas', 'Existe una suite de pruebas ejecutable que verifica los requisitos de punta a punta.', 'Alta', 'Ejecución: <code>npm test</code> → 154 aprobadas, 0 fallidas.'],
  ['RNF-25', 'Documentación', 'El proyecto incluye documentación de instalación, guía técnica, documentación funcional y estas evidencias.', 'Media', 'Revisión de la carpeta <code>documentacion/</code>.'],
  ['RNF-26', 'Disponibilidad de datos', 'Los datos persisten entre reinicios del sistema mediante volúmenes de Docker.', 'Alta', 'Inspección: volumen <code>finanx_pgdata</code>.'],
  ['RNF-27', 'Licenciamiento', 'Todas las dependencias usan licencias permisivas compatibles con el uso comercial; ninguna es copyleft fuerte.', 'Alta', 'Evidencia 4: revisión de las 238 dependencias.'],
];

// ============================================================
// Restricciones, interfaces y reglas de negocio
// ============================================================
const RESTRICCIONES = [
  ['Tecnológica', 'El frontend se desarrolla con <strong>React 18 + Vite</strong>; el backend con <strong>Node.js + Express</strong>; la base de datos es <strong>PostgreSQL 16</strong>. Son las tecnologías vistas en la asignatura.'],
  ['De despliegue', 'El sistema se ejecuta en <strong>contenedores Docker</strong> orquestados con Docker Compose, sobre cualquier máquina con Docker instalado.'],
  ['De entorno', 'Node.js 20 o superior. El proyecto se ha probado con Node 24 y PostgreSQL 16.'],
  ['Legal', 'El software se distribuye bajo licencia de uso; las dependencias de terceros conservan sus licencias (ver Evidencias 4 y 5).'],
  ['De alcance', 'El sistema <strong>no es un ERP</strong>: no incluye contabilidad general, inventario, nómina ni compras a proveedores. La facturación <strong>no tiene validez fiscal</strong> (no emite CUFE ni se integra con la DIAN).'],
  ['De seguridad', 'La recuperación de contraseña por SMS o correo <strong>no envía mensajes reales</strong> en esta versión: el proveedor de mensajería queda como punto de extensión.'],
  ['De integración', 'El código de pago en efectivo es una <strong>simulación</strong>: no se persiste ni se redime contra una pasarela real.'],
  ['Académica', 'Proyecto de la asignatura <em>Integración de Aplicaciones</em>. La variedad de roles, los límites de peticiones y las credenciales de demostración responden a fines didácticos.'],
];

const INTERFACES = [
  ['Interfaz de usuario', 'Aplicación web de página única (SPA) servida por nginx. Dos áreas: <strong>panel interno</strong> (personal de la empresa) y <strong>portal del cliente</strong> (autoservicio). Accesible desde un navegador actual, sin instalación.'],
  ['Interfaz de programación (API)', '<strong>API REST</strong> con formato JSON. Autenticación por <code>Authorization: Bearer &lt;token&gt;</code>. Los errores devuelven siempre <code>{ "error": "mensaje" }</code>. Se documenta en la Evidencia 6.'],
  ['Interfaz de datos', 'PostgreSQL por el puerto 5432 con consultas SQL parametrizadas. El acceso se hace mediante un <strong>pool de conexiones</strong> (máximo 10) y una única vista de lectura (<code>factura_saldo</code>).'],
  ['Interfaz de correo', 'El envío del estado financiero se resuelve con un enlace <code>mailto:</code> generado por la aplicación: no requiere servidor de correo.'],
  ['Interfaz de notificaciones', 'La entrega del código OTP está <strong>aislada en un único módulo</strong> (<code>notificar.js</code>) para poder conectar un proveedor real (SMS o correo) sin tocar el resto del sistema.'],
  ['Interfaz de hardware', 'No aplica: no hay dispositivos específicos. Se usa un navegador estándar en un equipo convencional.'],
];

const REGLAS = [
  ['RN-01', 'Un cliente no puede repetirse por tipo y número de identificación.', 'Restricción <code>UNIQUE</code> + validación previa → 409.'],
  ['RN-02', 'Los importes de un pedido los calcula <strong>siempre el servidor</strong> a partir del precio del catálogo.', 'El navegador nunca envía totales; el precio se lee de la base.'],
  ['RN-03', 'Un pago no puede superar el saldo pendiente.', 'Validación contra la vista <code>factura_saldo</code> → 400.'],
  ['RN-04', 'El saldo de una factura <strong>no se almacena</strong>: se deriva de los pagos y las devoluciones.', 'Vista <code>factura_saldo</code>.'],
  ['RN-05', 'Como mucho <strong>una factura activa</strong> por pedido; las anuladas se conservan como historial.', 'Índice único parcial <code>uq_factura_activa_por_pedido</code>.'],
  ['RN-06', 'Solo se puede facturar un pedido <strong>confirmado</strong>.', 'Validación de estado → 409.'],
  ['RN-07', 'Un pedido facturado no se puede modificar.', 'El pedido pasa a FACTURADO y la edición exige BORRADOR → 409.'],
  ['RN-08', 'La anulación de facturas y notas de crédito es <strong>lógica</strong> y exige motivo.', 'Se marca el estado y se guarda el motivo → 400 si falta.'],
  ['RN-09', 'No se puede anular una factura <strong>con pagos</strong>.', 'Comprobación → 409.'],
  ['RN-10', 'Una nota de crédito <strong>no puede devolver más de lo pagado</strong> menos lo ya devuelto.', 'Cálculo del disponible → 400/409.'],
  ['RN-11', 'Una nota de crédito activa <strong>aumenta</strong> el saldo de la factura (revierte el pago devuelto).', 'Fórmula de la vista.'],
  ['RN-12', 'El <code>clienteId</code> de una consulta del portal <strong>se toma del token</strong>, nunca de la petición.', 'Guarda <code>requireCliente</code> + filtro por <code>cliente_id</code>.'],
  ['RN-13', 'Ningún dato se elimina: la baja es lógica (se cambia el estado).', '<code>PATCH /estado</code> y anulaciones.'],
  ['RN-14', 'Toda operación sensible queda <strong>auditada</strong> en la misma transacción.', 'Módulo de auditoría.'],
  ['RN-15', 'El número completo de la tarjeta y el CVV <strong>nunca</strong> se almacenan.', 'Validación que descarta esos campos antes de guardar.'],
];

// ============================================================
// Criterios de aceptación
// ============================================================
const CRITERIOS = [
  ['CA-01', 'Un cliente duplicado (mismo tipo y número de identificación) se rechaza con 409 y el sistema no crea la fila.', 'CP-03'],
  ['CA-02', 'Los totales de un pedido coinciden exactamente con la aritmética calculada sobre los precios del catálogo.', 'CP-10'],
  ['CA-03', 'Un pago superior al saldo se rechaza con 400 y el saldo no cambia.', 'CP-19'],
  ['CA-04', 'Tras pagar el total, la factura queda en estado PAGADA y el saldo es 0.', 'CP-20'],
  ['CA-05', 'Un pago parcial deja la factura en PAGO_PARCIAL con el saldo correcto.', 'CP-20'],
  ['CA-06', 'No se puede anular una factura con pagos: responde 409.', 'CP-16'],
  ['CA-07', 'Una nota de crédito de un importe superior a lo pagado se rechaza con 400.', 'CP-23'],
  ['CA-08', 'Tras una nota de crédito, el saldo de la factura aumenta exactamente en el importe devuelto.', 'CP-24'],
  ['CA-09', 'Un cliente no puede leer ni pagar una factura ajena: responde 404.', 'CP-38'],
  ['CA-10', 'Anular una factura permite emitir una nueva del mismo pedido, con otro número, y la anulada sigue consultable.', 'CP-17'],
  ['CA-11', 'El código OTP caduca, admite un número limitado de intentos y no se puede reutilizar.', 'CP-36'],
  ['CA-12', 'Las solicitudes de recuperación no revelan si una cuenta existe.', 'CP-36'],
  ['CA-13', 'Tras cambiar la contraseña, los tokens emitidos antes dejan de funcionar (401).', 'CP-37'],
  ['CA-14', 'Cinco intentos fallidos de acceso desde la misma dirección producen 429.', 'CP-44'],
  ['CA-15', 'Las respuestas de pago no contienen el número completo de la tarjeta ni el CVV.', 'CP-43'],
  ['CA-16', 'Un rol sin permiso recibe 403 en las operaciones restringidas.', 'CP-35'],
  ['CA-17', 'El sistema no arranca sin una clave de firma válida.', 'CP-45'],
  ['CA-18', 'Los tres servicios (base de datos, API y frontend) quedan disponibles con un solo comando.', 'CP-48'],
  ['CA-19', 'La suite de pruebas finaliza con 0 fallos.', 'Todas'],
  ['CA-20', 'Toda operación auditada aparece registrada con usuario, módulo, operación y fecha.', 'CP-31'],
];

// ============================================================
// Documento
// ============================================================
const filasRF = RF.map(([id, enunciado, actor, prio, verif, estado]) => [
  { t: `<strong>${id}</strong>` },
  { t: enunciado },
  { t: actor },
  { t: prio === 'Crítica' ? '<span class="badge b-no">Crítica</span>' : (prio === 'Alta' ? '<span class="badge b-warn">Alta</span>' : '<span class="badge b-gray">' + prio + '</span>'), clase: 'c' },
  { t: verif },
  { t: '<span class="badge b-ok">' + estado + '</span>', clase: 'c' },
]);

const cuerpo = `
${portada({
  evidencia: 'Evidencia 3 de 7',
  titulo: 'Especificación de Requisitos de Software',
  descripcion: 'Documento de requisitos elaborado siguiendo la estructura del estándar IEEE 830. Define qué debe hacer el sistema FINAN-X y bajo qué condiciones debe funcionar, con requisitos verificables y trazables al software realmente construido.',
  meta: [
    ['Sistema', 'FINAN-X · Facturación y pagos'],
    ['Estándar de referencia', 'IEEE 830 (estructura de una ERS)'],
    ['Requisitos funcionales', `${RF.length}`],
    ['Requisitos no funcionales', `${RNF.length}`],
    ['Reglas de negocio', `${REGLAS.length}`],
    ['Criterios de aceptación', `${CRITERIOS.length}`],
  ],
})}

<h1>1. Introducción</h1>

<h2>1.1 Propósito</h2>
<p>Este documento especifica los requisitos de <strong>FINAN-X</strong>, un sistema de facturación y pagos con portal de autoservicio para el cliente. Está dirigido a:</p>
<ul>
  <li>El <strong>equipo de desarrollo</strong>, como contrato de lo que debe construirse.</li>
  <li>El <strong>docente evaluador</strong> o un revisor externo, para verificar que lo entregado corresponde a lo especificado.</li>
  <li>Un <strong>desarrollador futuro</strong> que reciba el proyecto, para entender qué hace y por qué.</li>
</ul>
<p>Responde a la pregunta guía de la evidencia: <em>¿qué debe hacer exactamente el sistema y bajo qué condiciones debe funcionar?</em></p>

<h2>1.2 Alcance</h2>
<p>FINAN-X cubre el <strong>ciclo de venta y cobro</strong> de una empresa que factura a sus clientes:</p>
<pre><code>Cliente → Pedido → Factura → Pago → (Nota de crédito si hay devolución)</code></pre>
<p>El sistema ofrece dos áreas diferenciadas: un <strong>panel interno</strong> para el personal de la empresa (administrador, facturador, cajero y supervisor) y un <strong>portal del cliente</strong> para que cada cliente consulte y pague sus propias facturas.</p>

<div class="caja warn">
  <span class="titulo">Fuera de alcance</span>
  <p style="margin-bottom:0">FINAN-X <strong>no es un sistema ERP</strong>. Quedan expresamente fuera: contabilidad general, gestión de inventario y stock, nómina, compras a proveedores, y la integración fiscal con la DIAN (el documento de factura es informativo, no tiene validez tributaria). Ver la sección 7, Restricciones.</p>
</div>

<h2>1.3 Definiciones y abreviaturas</h2>
${tabla(
  ['Término', 'Significado en este documento'],
  [
    ['<strong>Pedido</strong>', 'Documento interno que registra qué productos pidió un cliente, antes de facturarse.'],
    ['<strong>Factura</strong>', 'Documento de cobro emitido a partir de un pedido confirmado.'],
    ['<strong>Pago</strong>', 'Abono contra una factura. Puede ser parcial o total.'],
    ['<strong>Saldo</strong>', 'Lo que queda por cobrar de una factura: total − pagos + devoluciones.'],
    ['<strong>Nota de crédito</strong>', 'Devolución de dinero sobre una factura ya pagada.'],
    ['<strong>OTP</strong>', 'One-Time Password: código de un solo uso para recuperar la contraseña.'],
    ['<strong>RBAC</strong>', 'Control de acceso basado en roles.'],
    ['<strong>JWT</strong>', 'Token firmado que identifica la sesión del usuario.'],
    ['<strong>Baja lógica</strong>', 'Marcar un registro como inactivo sin eliminarlo, para conservar el historial.'],
    ['<strong>API REST</strong>', 'Interfaz de programación sobre HTTP con formato JSON.'],
  ],
)}

<h2>1.4 Referencias</h2>
<ul>
  <li>IEEE Std 830-1998 — <em>Recommended Practice for Software Requirements Specifications</em> (estructura seguida).</li>
  <li><code>documentacion/SPEC_Funcional.md</code> — especificación funcional e historias de usuario (HU-01 a HU-22).</li>
  <li><code>documentacion/SPEC_Tecnico.md</code> — especificación técnica: esquema, contrato de la API y seguridad.</li>
  <li><code>database/init.sql</code> — esquema real de la base de datos.</li>
  <li><code>backend/scripts/e2e.mjs</code> — suite de pruebas que verifica estos requisitos.</li>
</ul>

<h1>2. Descripción general</h1>

<h2>2.1 Perspectiva del producto</h2>
<p>FINAN-X es un producto <strong>independiente y autocontenido</strong>: se levanta con un solo comando y no depende de servicios externos. Se compone de tres piezas que se comunican por HTTP:</p>
<pre><code>Navegador  →  Frontend (React)  →  API REST (Node/Express)  →  PostgreSQL 16</code></pre>

<h2>2.2 Funciones principales</h2>
${tabla(
  ['Grupo de funciones', 'Qué incluye'],
  [
    ['Autenticación y seguridad', 'Acceso interno y de cliente, autoregistro, recuperación de contraseña con OTP, cierre de sesiones, control por roles.'],
    ['Clientes', 'Alta, edición, búsqueda, activar/inactivar y creación de la cuenta de portal.'],
    ['Productos', 'Catálogo con precio, impuesto, unidad de medida y baja lógica.'],
    ['Pedidos', 'Creación con líneas, cálculo de totales en el servidor, confirmación y cancelación.'],
    ['Facturación', 'Emisión desde un pedido, consulta, saldo, anulación con motivo y refacturación.'],
    ['Pagos', 'Registro con distintos medios, control de saldo y estado de pago automático.'],
    ['Notas de crédito', 'Devoluciones con motivo y anulación lógica.'],
    ['Reportes', 'Resumen del negocio, facturación por rango, balance por cliente e historial.'],
    ['Auditoría', 'Registro y consulta de todas las operaciones sensibles.'],
    ['Portal del cliente', 'Consulta de saldo, compras, facturas, pagos, notas y datos propios, y pago en línea.'],
  ],
)}

<h2>2.3 Usuarios del sistema</h2>
<p>El sistema distingue <strong>cinco tipos de usuario</strong>. Los cuatro primeros son personal interno de la empresa y se reparten las tareas; el quinto es el cliente, que solo accede a su propia información.</p>
${tabla(
  ['Rol', 'Quién es', 'Qué puede hacer', 'Qué NO puede hacer'],
  [
    ['<strong>Administrador</strong>', 'Responsable del sistema', 'Todo lo del sistema y, además, la gestión de usuarios internos. Consulta la auditoría.', 'Nada restringido, salvo desactivarse a sí mismo o al último administrador.'],
    ['<strong>Facturador</strong>', 'Área comercial', 'Clientes, productos, pedidos, emisión y anulación de facturas, reportes, envío del estado financiero.', 'Gestionar usuarios. Consultar la auditoría.'],
    ['<strong>Cajero</strong>', 'Área de caja', 'Registrar pagos y notas de crédito, consultar facturas, clientes y pedidos.', 'Gestionar usuarios, consultar la auditoría ni emitir facturas.'],
    ['<strong>Supervisor</strong>', 'Área de control', 'Consultar todo, reportes, balances e historial. Consultar la auditoría.', 'Registrar pagos, emitir facturas ni gestionar usuarios.'],
    ['<strong>Cliente</strong>', 'Cliente de la empresa', 'Ver y pagar <strong>sus propias</strong> facturas, consultar su saldo, sus compras, sus pagos y sus datos.', 'Ver información de otros clientes, ni acceder al panel interno.'],
  ],
)}

<h2>2.4 Entorno de operación</h2>
<ul>
  <li><strong>Servidor:</strong> cualquier equipo con Docker. Tres contenedores: PostgreSQL 16, la API en Node.js y el frontend servido por nginx.</li>
  <li><strong>Cliente:</strong> navegador web actual (Chrome, Edge, Firefox o Safari). No requiere instalación.</li>
  <li><strong>Base de datos:</strong> PostgreSQL 16 con un volumen persistente para los datos.</li>
</ul>

<h2>2.5 Restricciones de diseño y supuestos</h2>
${tabla(['Tipo', 'Descripción'], RESTRICCIONES.map(([t, d]) => [{ t: `<strong>${t}</strong>` }, { t: d }]))}
<p><strong>Supuestos:</strong> el equipo dispone de Docker; el cliente final tiene acceso a un navegador; la entrega del OTP por SMS o correo se sustituye por el modo demostración mientras no se contrate un proveedor.</p>

<h1>3. Requisitos funcionales</h1>
<p>Se especifican <strong>${RF.length} requisitos funcionales</strong>. Cada uno declara el actor que lo usa, su prioridad, cómo se verifica y su estado. <strong>No hay requisitos «pendientes»</strong>: todo lo especificado aquí está construido y probado, y lo que no existe figura en el alcance como fuera de alcance en lugar de como requisito incumplido.</p>
<p>La columna «Verificación» enlaza con los casos de prueba de la <strong>Evidencia 7</strong> y con la matriz de trazabilidad de la <strong>Evidencia 6</strong>.</p>

${tabla(['ID', 'Enunciado del requisito', 'Actor', { t: 'Prioridad', clase: 'c' }, 'Verificación', { t: 'Estado', clase: 'c' }], filasRF)}

<h1>4. Requisitos no funcionales</h1>
<p>Los requisitos no funcionales describen <strong>cómo</strong> debe comportarse el sistema, no qué hace. Se agrupan por atributo de calidad.</p>

${tabla(
  ['ID', 'Categoría', 'Requisito', { t: 'Prioridad', clase: 'c' }, 'Cómo se verifica'],
  RNF.map(([id, cat, req, prio, verif]) => [
    { t: `<strong>${id}</strong>` },
    { t: cat },
    { t: req },
    { t: prio === 'Crítica' ? '<span class="badge b-no">Crítica</span>' : (prio === 'Alta' ? '<span class="badge b-warn">Alta</span>' : '<span class="badge b-gray">' + prio + '</span>'), clase: 'c' },
    { t: verif },
  ]),
)}

<h1>5. Interfaces</h1>
${tabla(['Interfaz', 'Descripción'], INTERFACES.map(([t, d]) => [{ t: `<strong>${t}</strong>` }, { t: d }]))}

<h1>6. Reglas de negocio</h1>
<p>Las reglas de negocio son las invariantes del sistema: condiciones que deben cumplirse <strong>siempre</strong>, independientemente de quién ejecute la operación o desde dónde. Se aplican en la base de datos y en la API, no solo en la interfaz.</p>

${tabla(['ID', 'Regla', 'Dónde se aplica'], REGLAS.map(([id, r, d]) => [{ t: `<strong>${id}</strong>` }, { t: r }, { t: d }]))}

<h1>7. Criterios de aceptación</h1>
<p>Un requisito está cumplido cuando se puede comprobar de forma objetiva. Estos son los criterios de aceptación del sistema; cada uno se verifica con un caso de prueba concreto de la Evidencia 7.</p>

${tabla(['ID', 'Criterio de aceptación', 'Se verifica con'], CRITERIOS.map(([id, c, p]) => [{ t: `<strong>${id}</strong>` }, { t: c }, { t: `<code>${p}</code>` }]), { compacta: true })}

<h1>8. Trazabilidad</h1>
<p>Este documento no es un elemento aislado: eslabona con el resto de la documentación.</p>
<pre><code>REQUISITOS (esta ERS)
    ↓
CASOS DE USO (documentación técnica)
    ↓
CLASES Y MER (Evidencia 1)
    ↓
DICCIONARIO DE DATOS (Evidencia 2)
    ↓
IMPLEMENTACIÓN (backend/ y frontend/)
    ↓
PRUEBAS DE INTEGRACIÓN (Evidencia 7)
    ↓
LICENCIAMIENTO (Evidencias 4 y 5)</code></pre>
<p>Como ejemplo, el requisito <strong>RF-22</strong> («no devolver más de lo pagado») se puede seguir por toda la cadena:</p>
<ul>
  <li>Especificado aquí como RF-22, con prioridad Crítica y criterio de aceptación CA-07.</li>
  <li>Implementado en <code>backend/src/routes/notas-credito.js</code>.</li>
  <li>Apoyado en la entidad <code>notas_credito</code> y en la vista <code>factura_saldo</code> (Evidencia 1 y 2).</li>
  <li>Expuesto en <code>POST /api/notas-credito</code>.</li>
  <li>Visible en la pantalla de notas de crédito (prototipo y aplicación).</li>
  <li>Verificado por el caso de prueba <strong>CP-23</strong> de la Evidencia 7.</li>
</ul>

<footer class="pie-doc">FINAN-X · Evidencia 3 de 7 · Especificación de Requisitos de Software (IEEE 830) · ${RF.length} requisitos funcionales, ${RNF.length} no funcionales, ${REGLAS.length} reglas de negocio, ${CRITERIOS.length} criterios de aceptación.</footer>
`;

escribir('E3_ERS_IEEE830.html', html({ titulo: 'FINAN-X · Especificación de Requisitos (IEEE 830)', cuerpo }));
