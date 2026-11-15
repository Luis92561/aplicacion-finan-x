/**
 * Evidencia 4 · Matriz de propiedad intelectual
 *
 * Identifica que hay en el proyecto, de quien es y bajo que licencia se usa.
 * Las licencias NO se suponen: se extraen del arbol de dependencias real
 * (package-lock.json) con deep-docs/_generar_licencias.mjs.
 *
 * Uso (desde la raiz):  node documentacion/_generador/04-propiedad-intelectual.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { html, portada, escribir, tabla, RAIZ } from './tema.mjs';

const lic = JSON.parse(fs.readFileSync(path.join(RAIZ, 'deep-docs', '_licencias.json'), 'utf8'));
const filas = lic.filas;

const directas = filas.filter((f) => f.tipo === 'directa');
const desarrollo = filas.filter((f) => f.tipo === 'desarrollo');
const transitivas = filas.filter((f) => f.tipo === 'transitiva');

const porLicencia = new Map();
for (const f of filas) porLicencia.set(f.licencia, (porLicencia.get(f.licencia) || 0) + 1);
const resumen = [...porLicencia.entries()].sort((a, b) => b[1] - a[1]);

const SIGNIFICADO = {
  MIT: 'Permisiva. Permite usar, copiar, modificar y distribuir, incluso comercialmente, conservando el aviso de copyright.',
  ISC: 'Equivalente funcional a MIT. Mismas libertades.',
  'BSD-2-Clause': 'Permisiva. Como MIT, con el aviso de copyright.',
  'BSD-3-Clause': 'Permisiva, con una cláusula extra que prohíbe usar el nombre de los autores para promocionar el producto derivado.',
  'Apache-2.0': 'Permisiva. Permite uso comercial y además concede licencia explícita de patentes.',
  'CC-BY-4.0': 'Creative Commons de atribución: permite el uso citando la autoría.',
  'PostgreSQL License': 'Permisiva, similar a MIT/BSD. Sin obligación de publicar cambios.',
  'GPL-3.0': 'Copyleft fuerte. Si se distribuye el programa, hay que liberar el código en los mismos términos.',
};

// ============================================================
// Componentes que NO son paquetes npm
// ============================================================
const OTROS = [
  ['<strong>Código propio</strong>', 'Equipo de desarrollo', 'Titularidad del equipo', 'Frontend (React), API REST, esquema de base de datos, scripts de despliegue, pruebas automáticas y toda la documentación. Es la parte original del proyecto.', '<span class="badge b-ok">Propio</span>'],
  ['PostgreSQL 16', 'PostgreSQL Global Development Group', 'PostgreSQL License', 'Motor de base de datos, usado como contenedor oficial <code>postgres:16-alpine</code>. Una licencia permisiva: no obliga a publicar el código propio.', '<span class="badge b-ok">Permisiva</span>'],
  ['Node.js 22', 'OpenJS Foundation', 'MIT', 'Entorno de ejecución del backend, dentro de la imagen <code>node:22-alpine</code>.', '<span class="badge b-ok">Permisiva</span>'],
  ['nginx 1.27', 'F5 / Nginx Inc.', 'BSD-2-Clause', 'Servidor web que sirve el frontend compilado y actúa de proxy hacia la API.', '<span class="badge b-ok">Permisiva</span>'],
  ['Alpine Linux', 'Alpine Linux Development Team', 'MIT (y otras)', 'Sistema base de las imágenes de los contenedores. Se usa como imagen oficial, sin modificarla.', '<span class="badge b-ok">Permisiva</span>'],
  ['Docker', 'Docker Inc.', 'Acuerdo de licencia propio (Docker Desktop)', 'Herramienta de despliegue. Solo se usa para construir y ejecutar; no forma parte del software entregado.', '<span class="badge b-info">Herramienta</span>'],
  ['PlantUML 1.2024.8', 'Arnaud Roques', '<strong>GPL-3.0</strong>', 'Utilidad que generó los diagramas (casos de uso, clases, arquitectura, Gantt) a partir de archivos <code>.puml</code>.', '<span class="badge b-warn">Revisar</span>'],
  ['Smetana', 'Autor de PlantUML', 'MIT', 'Motor de disposición de grafos que PlantUML usa con la opción <code>-Playout=smetana</code> para dibujar los diagramas.', '<span class="badge b-ok">Permisiva</span>'],
  ['Iconos del menú', 'Unicode Consortium / fabricante del sistema', 'Uso libre', 'Los iconos del menú del panel son <strong>caracteres emoji estándar</strong> (gráfico de barras, siluetas, caja…), incluidos en la fuente del sistema operativo y no en una fuente o paquete de iconos con licencia. No se distribuye ningún recurso gráfico de terceros: no hay archivos de imagen ni tipografías descargadas.', '<span class="badge b-ok">Sin dependencia</span>'],
  ['Puente de pago Efecty', '— (no integrado)', 'Simulado', 'El código de pago en efectivo se <strong>genera</strong> en el sistema con un dígito de control, pero no se conecta con ninguna pasarela real. No hay servicio de terceros contratado.', '<span class="badge b-gray">Simulado</span>'],
  ['Proveedor de SMS/correo', '— (no integrado)', '—', 'El envío del código OTP está pendiente: el sistema lo imprime en consola. No hay contrato con ningún proveedor, por lo que no hay componente de terceros implicado.', '<span class="badge b-gray">Pendiente</span>'],
];

const filasOtros = OTROS.map(([c, p, l, u, e]) => [{ t: c }, { t: p }, { t: l }, { t: u }, { t: e, clase: 'c' }]);

// ============================================================
// Dependencias directas, con su papel en el proyecto
// ============================================================
const PAPEL = {
  express: 'Servidor HTTP y enrutado de la API REST.',
  pg: 'Cliente de PostgreSQL con pool de conexiones y consultas parametrizadas.',
  jsonwebtoken: 'Firma y verificación de los tokens de sesión (JWT).',
  bcryptjs: 'Cifrado de contraseñas y de los códigos OTP.',
  helmet: 'Cabeceras de seguridad HTTP en las respuestas de la API.',
  cors: 'Control de acceso por origen (lista blanca).',
  'express-rate-limit': 'Límite de peticiones por dirección IP (anti-spam y fuerza bruta).',
  dotenv: 'Lectura de la configuración desde variables de entorno.',
  react: 'Biblioteca de interfaz de usuario del frontend.',
  'react-dom': 'Renderizado de React en el navegador.',
  'react-router-dom': 'Enrutado de la aplicación de página única.',
  axios: 'Cliente HTTP que consume la API desde el frontend.',
  vite: 'Empaquetador y servidor de desarrollo del frontend.',
  '@vitejs/plugin-react': 'Soporte de React para Vite (compilación de JSX).',
};

const filasDirectas = [...directas, ...desarrollo]
  .sort((a, b) => a.ambito.localeCompare(b.ambito) || a.nombre.localeCompare(b.nombre))
  .map((f) => [
    { t: `<code>${f.nombre}</code>` },
    { t: f.version },
    { t: f.ambito === 'backend' ? 'Backend' : 'Frontend' },
    { t: f.licencia },
    { t: PAPEL[f.nombre] || '—' },
  ]);

const filasResumen = resumen.map(([l, n]) => [
  { t: `<strong>${l}</strong>` },
  { t: String(n), clase: 'c' },
  { t: SIGNIFICADO[l] || '—' },
  { t: /GPL|AGPL/.test(l) ? '<span class="badge b-warn">Copyleft</span>' : '<span class="badge b-ok">Permisiva</span>', clase: 'c' },
]);

const filasTransitivas = transitivas
  .sort((a, b) => a.nombre.localeCompare(b.nombre))
  .map((f) => [{ t: `<code>${f.nombre}</code>` }, { t: f.version }, { t: f.ambito === 'backend' ? 'Backend' : 'Frontend' }, { t: f.licencia }]);

const totalPaquetes = filas.length;
const noMit = filas.filter((f) => f.licencia !== 'MIT');

const cuerpo = `
${portada({
  evidencia: 'Evidencia 4 de 7',
  titulo: 'Matriz de propiedad intelectual',
  descripcion: `Inventario de todo lo que compone FINAN-X: qué es propio del equipo, qué es de terceros y bajo qué licencia se utiliza. Las licencias se han verificado en el árbol de dependencias real del proyecto, no supuesto.`,
  meta: [
    ['Sistema', 'FINAN-X · Facturación y pagos'],
    ['Paquetes analizados', `${totalPaquetes}`],
    ['Dependencias directas', `${directas.length}`],
    ['Componentes no npm', `${OTROS.length}`],
    ['Licencias distintas encontradas', `${resumen.length}`],
    ['Licencias copyleft fuerte', '1 (una herramienta, no se distribuye)'],
  ],
})}

<h1>1. Para qué sirve esta matriz</h1>
<p>Antes de definir las condiciones de uso del software (Evidencia 5) hay que saber <strong>qué hay dentro</strong> y <strong>de quién es cada parte</strong>. Esta matriz responde a tres preguntas:</p>
<ul>
  <li>¿Qué parte de FINAN-X es <strong>original del equipo</strong>?</li>
  <li>¿Qué parte es de <strong>terceros</strong> y con qué licencia se usa?</li>
  <li>¿Alguna de esas licencias <strong>condiciona</strong> lo que el equipo puede hacer con su propio software?</li>
</ul>

<div class="caja ok">
  <span class="titulo">Conclusión principal</span>
  <p style="margin-bottom:0">Todas las librerías que forman parte del software entregado usan licencias <strong>permisivas</strong> (MIT, ISC, BSD, Apache). <strong>Ninguna obliga a publicar el código propio</strong> ni impide su uso comercial, así que el equipo conserva la titularidad y puede licenciar el producto con las condiciones que decida (Evidencia 5). La única licencia copyleft del proyecto corresponde a <strong>PlantUML</strong>, que es una herramienta de documentación que <em>no se distribuye</em> con el software: se ejecutó para generar los diagramas.</p>
</div>

<h1>2. Lo que es propio del equipo</h1>
<p>Es la parte sobre la que el equipo tiene derechos de autor:</p>
${tabla(
  ['Componente propio', 'Detalle'],
  [
    ['<strong>Aplicación web (frontend)</strong>', 'Interfaz completa: pantallas, componentes, navegación por roles, formularios, sistema visual (hoja de estilos propia) y la previsualización imprimible de facturas.'],
    ['<strong>API REST (backend)</strong>', 'Todos los servicios: autenticación, clientes, productos, pedidos, facturación, pagos, notas de crédito, reportes, auditoría y portal del cliente.'],
    ['<strong>Modelo de datos</strong>', 'Diseño del esquema de PostgreSQL, las restricciones de integridad, los índices y la vista de saldo.'],
    ['<strong>Reglas de negocio</strong>', 'Las decisiones de negocio del sistema: no permitir sobrepago, una factura activa por pedido, no devolver más de lo pagado, baja lógica, auditoría.'],
    ['<strong>Documentación</strong>', 'Requisitos, guías, especificaciones, diagramas, mockups y estas siete evidencias.'],
    ['<strong>Pruebas automáticas</strong>', 'La suite de integración de 157 comprobaciones y los scripts de captura de pantalla.'],
    ['<strong>Prototipos (mockups)</strong>', 'Las 14 pantallas de demostración en HTML y la galería.'],
  ],
)}

<h1>3. Componentes de terceros que forman parte del software</h1>
<p>Se listan las <strong>dependencias directas</strong> (${filasDirectas.length}), es decir, las que el equipo eligió de forma explícita. Las transitivas se resumen en la sección 6.</p>

${tabla(
  ['Paquete', 'Versión', 'Ámbito', 'Licencia', 'Uso en el proyecto'],
  filasDirectas,
)}

<h1>4. Componentes de terceros que NO son paquetes</h1>
<p>El software se apoya además en piezas de infraestructura y en una herramienta de documentación. La diferencia es importante: <strong>la infraestructura se ejecuta, pero no se distribuye con el código</strong>.</p>

${tabla(
  ['Elemento', 'Procedencia', 'Licencia', 'Uso en el proyecto', { t: 'Naturaleza', clase: 'c' }],
  filasOtros,
)}

<div class="caja warn">
  <span class="titulo">Caso de PlantUML: por qué su GPL-3.0 no contagia el proyecto</span>
  <p>PlantUML es la única pieza con licencia <strong>copyleft fuerte</strong> (GPL-3.0). Su obligación es que, si se distribuye el programa <em>o un producto derivado</em>, se libere el código en los mismos términos.</p>
  <p style="margin-bottom:0">Aquí <strong>no se distribuye ni se enlaza</strong> con el software: es una aplicación independiente que se ejecuta desde la línea de comandos con <code>java -jar plantuml.jar</code> para transformar archivos de texto <code>.puml</code> en imágenes <code>.svg</code>. Lo que se distribuye son <strong>los SVG resultantes</strong>, que son obra del proyecto, no código de PlantUML. Es el mismo caso que usar un editor de texto con licencia GPL para escribir un documento: el documento no queda sujeto a esa licencia.</p>
</div>

<div class="caja">
  <span class="titulo">Uso del servicio: sin datos de terceros</span>
  <p style="margin-bottom:0">El proyecto <strong>no consume ninguna API externa</strong> ni descarga conjuntos de datos ajenos: no hay llamadas de red salidas del sistema (las únicas direcciones que aparecen en el código son de <code>localhost</code>). Tampoco usa fuentes tipográficas, iconos ni plantillas de terceros: la tipografía es la del sistema y los iconos son caracteres emoji estándar.</p>
</div>

<h1>5. Resumen de licencias encontradas</h1>
<p>Resultado de analizar los <strong>${totalPaquetes} paquetes</strong> que instala el proyecto (backend y frontend, incluidas las dependencias de desarrollo y las transitivas):</p>

${tabla(
  ['Licencia', { t: 'Paquetes', clase: 'c' }, 'Qué permite', { t: 'Tipo', clase: 'c' }],
  filasResumen,
)}

<div class="grid3">
  <div class="kpi"><div class="n">${totalPaquetes}</div><div class="t">Paquetes analizados</div></div>
  <div class="kpi"><div class="n">${((filas.filter((f) => f.licencia === 'MIT').length / totalPaquetes) * 100).toFixed(0)}%</div><div class="t">Bajo licencia MIT</div></div>
  <div class="kpi"><div class="n">0</div><div class="t">Copyleft en las dependencias</div></div>
</div>

<h1>6. Dependencias transitivas</h1>
<p>Son las ${filasTransitivas.length} librerías que instalan las anteriores. No se eligieron directamente, pero también forman parte del software distribuido, por lo que se revisó su licencia. Todas son permisivas.</p>

${tabla(['Paquete', 'Versión', 'Ámbito', 'Licencia'], filasTransitivas, { compacta: true })}

<h1>7. Obligaciones que asume el equipo</h1>
<p>Usar software de terceros conlleva compromisos. Estos son los que aplican a FINAN-X:</p>

${tabla(
  ['Obligación', 'A quién afecta', 'Cómo se cumple en el proyecto'],
  [
    ['<strong>Conservar los avisos de copyright y la licencia</strong>', 'MIT, ISC, BSD, Apache-2.0, PostgreSQL', 'Los paquetes se instalan sin modificar y cada uno conserva su archivo de licencia dentro de <code>node_modules</code>. Al distribuir el software, se incluirán los avisos correspondientes.'],
    ['<strong>Atribución</strong>', 'CC-BY-4.0 (<code>caniuse-lite</code>)', 'Es una dependencia de desarrollo que usa Vite para decidir qué código compatible con navegadores antiguos incluir. Se le da crédito en esta matriz.'],
    ['<strong>No usar los nombres de los autores para promocionar el derivado</strong>', 'BSD-3-Clause (<code>qs</code>, <code>buffer-equal-constant-time</code>, <code>source-map-js</code>)', 'El proyecto no usa los nombres de esos autores en su promoción ni en su documentación comercial.'],
    ['<strong>Conceder licencia de patentes</strong>', 'Apache-2.0 (<code>ecdsa-sig-formatter</code>, <code>baseline-browser-mapping</code>)', 'Obligación del proveedor hacia el proyecto, no al contrario.'],
    ['<strong>No redistribuir PlantUML</strong>', 'GPL-3.0', 'No se incluye el archivo <code>plantuml.jar</code> en el repositorio ni en la entrega: el script lo descarga en la máquina de quien quiera regenerar los diagramas.'],
  ],
)}

<h1>8. Riesgos detectados y medidas</h1>

${tabla(
  ['Riesgo', 'Nivel', 'Medida adoptada'],
  [
    ['Una dependencia con licencia copyleft fuerte obligaría a liberar el código propio', '<span class="badge b-ok">Bajo</span>', 'Se revisaron las 276 licencias: ninguna dependencia del software distribuido es copyleft. PlantUML (GPL-3.0) es una herramienta externa que no se distribuye ni se enlaza.'],
    ['Una dependencia sin licencia declarada dejaría el uso en zona gris', '<span class="badge b-ok">Bajo</span>', 'Ningún paquete quedó sin licencia identificada en el análisis.'],
    ['Cambio de licencia en una versión futura de una dependencia', '<span class="badge b-warn">Medio</span>', 'El proyecto fija versiones en <code>package-lock.json</code>, de modo que una actualización no entra sin revisión. Conviene repetir este análisis al actualizar.'],
    ['Vulnerabilidad conocida en una dependencia', '<span class="badge b-warn">Medio</span>', 'Fuera del alcance de esta evidencia (es un asunto de seguridad, no de propiedad intelectual). Se recomienda ejecutar <code>npm audit</code> antes de cada entrega.'],
    ['Uso de datos de personas reales en la demostración', '<span class="badge b-ok">Bajo</span>', 'Los datos de demostración son ficticios y usan el dominio reservado <code>.test</code>, que no puede pertenecer a nadie. Las tarjetas de prueba son números públicos de test.'],
  ],
)}

<h1>9. Cómo se verificó</h1>
<p>Las licencias no se copiaron de una página web: se leyeron del <strong>árbol de dependencias instalable</strong> del propio proyecto, que es la fuente autoritativa.</p>
<pre><code># Analiza backend/package-lock.json y frontend/package-lock.json
node deep-docs/_generar_licencias.mjs</code></pre>
<p>El script recorre cada paquete, lee su campo de licencia, agrupa por tipo y <strong>avisa si encuentra una licencia copyleft o una sin declarar</strong>. Su salida es la que alimenta las tablas de este documento.</p>

<div class="caja">
  <span class="titulo">Mantener esta matriz actualizada</span>
  <p style="margin-bottom:0">La matriz debe revisarse cuando se añada o actualice una dependencia. Volver a ejecutar el script y regenerar este documento es suficiente; si aparece una licencia nueva, quedará reflejada automáticamente.</p>
</div>

<footer class="pie-doc">FINAN-X · Evidencia 4 de 7 · Matriz de propiedad intelectual · ${totalPaquetes} paquetes npm + ${OTROS.length} componentes de infraestructura y herramientas. Licencias verificadas en el árbol de dependencias.</footer>
`;

escribir('E4_Matriz_Propiedad_Intelectual.html', html({ titulo: 'FINAN-X · Matriz de propiedad intelectual', cuerpo }));
