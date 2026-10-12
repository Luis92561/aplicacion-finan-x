/**
 * Evidencia 5 · Contrato de licencia de software
 *
 * Escenario de la actividad: una empresa contrato al equipo para desarrollar el
 * software. El contrato define bajo que condiciones el cliente puede usarlo.
 *
 * Decision adoptada (consultada al equipo):
 *   - El EQUIPO conserva la titularidad (derechos patrimoniales).
 *   - La EMPRESA recibe una licencia de uso NO EXCLUSIVA, para su operacion interna.
 *   - Duracion indefinida, territorio Colombia.
 *
 * Los datos de las partes (nombres, documentos, NIT, domicilio) se entregan como
 * lineas EN BLANCO con su etiqueta, para completarlos a mano.
 *
 * Uso (desde la raiz):  node documentacion/_generador/05-contrato-licencia.mjs
 */
import { html, portada, escribir, tabla } from './tema.mjs';

/**
 * Linea en blanco para completar a mano.
 *
 * Los datos de las partes no llevan raya: se entregan como espacio en blanco dentro
 * de su celda, conservando la franja y el borde de la tabla, que es lo que indica
 * donde va cada cosa. Antes llevaban un marcador resaltado ("[Nombre completo 1]").
 */
const vacio = (alto = 1.3) => `<span class="hueco"${alto !== 1.3 ? ` style="height:${alto}em"` : ''}></span>`;

/**
 * Linea para firmar. Aqui si se dibuja una raya: no es un hueco de relleno, es la
 * linea sobre la que se firma, y sin ella las firmas quedarian sin referencia.
 */
const lineaFirma = (alto = 2.6) => `<span class="linea-firma" style="height:${alto}em"></span>`;

/** Fila de etiqueta y valor. `valor` puede ser un texto o una lista de renglones. */
const fila = (etiqueta, valor) => {
  const v = Array.isArray(valor) ? valor.join('<br>') : valor;
  const celdas = `<td class="c-etiqueta">${etiqueta}</td><td>${v}</td>`;
  return `<tr>${celdas}</tr>`;
};

const PARTES = [
  ['EL LICENCIANTE (el equipo desarrollador)', [
    ['Integrantes', [vacio(), vacio(), vacio()]],
    ['Documento de identidad', [vacio(), vacio(), vacio()]],
    ['Domicilio', vacio()],
    ['Correo de contacto', vacio()],
    ['En adelante', '<strong>«EL EQUIPO»</strong> o <strong>«EL LICENCIANTE»</strong>'],
  ]],
  ['EL LICENCIATARIO (la empresa contratante)', [
    ['Razón social', vacio()],
    ['NIT', vacio()],
    ['Representante legal', vacio()],
    ['Documento del representante', vacio()],
    ['Domicilio', vacio()],
    ['En adelante', '<strong>«LA EMPRESA»</strong> o <strong>«EL LICENCIATARIO»</strong>'],
  ]],
];

const cuerpo = `
${portada({
  evidencia: 'Evidencia 5 de 7',
  titulo: 'Contrato de licencia de software',
  descripcion: 'Condiciones bajo las cuales la empresa contratante puede utilizar el sistema FINAN-X. El contrato distingue expresamente entre <strong>ser dueño del software</strong> y <strong>tener derecho a usarlo</strong>, que no son lo mismo.',
  meta: [
    ['Objeto', 'Licencia de uso del software FINAN-X'],
    ['Titularidad', 'Del equipo desarrollador (EL LICENCIANTE)'],
    ['Tipo de licencia', 'No exclusiva · uso interno · no transferible'],
    ['Duración', 'Indefinida, sujeta a las causales de terminación'],
    ['Territorio', 'República de Colombia'],
    ['Finalidad', 'Académica (asignatura Integración de Aplicaciones)'],
  ],
})}

<div class="caja err">
  <span class="titulo">Advertencia importante sobre el alcance de este documento</span>
  <p>Este contrato se elabora como <strong>ejercicio académico</strong> para la asignatura Integración de Aplicaciones, a partir de un escenario supuesto: una empresa contrata al equipo para desarrollar el software.</p>
  <p style="margin-bottom:0">El software está protegido por las <strong>normas de derecho de autor colombianas</strong> (Ley 23 de 1982 y Ley 44 de 1993, entre otras). Un contrato destinado a una relación comercial real debe ser <strong>revisado y ajustado por un profesional del derecho</strong>, y este documento no sustituye esa asesoría.</p>
</div>

<h1>Contrato de licencia de uso de software</h1>
<p>Entre los suscritos, a saber:</p>

${PARTES.map(([titulo, campos]) => `
<h3>${titulo}</h3>
<table class="compacta formulario"><tbody>
${campos.map(([etiqueta, valor]) => fila(etiqueta, valor)).join('\n')}
</tbody></table>`).join('\n')}

<p>Se ha convenido celebrar el presente <strong>contrato de licencia de uso de software</strong>, que se regirá por las siguientes cláusulas:</p>

<h2>PRIMERA. Identificación del software</h2>
<p>EL LICENCIANTE desarrolló una aplicación informática denominada <strong>FINAN-X</strong> (en adelante, «EL SOFTWARE»), cuyas características son:</p>

${tabla(
  ['Aspecto', 'Descripción'],
  [
    ['<strong>Nombre</strong>', 'FINAN-X — Sistema de facturación y pagos'],
    ['<strong>Finalidad</strong>', 'Gestionar el ciclo de venta y cobro de una empresa: clientes, productos, pedidos, facturación, pagos, devoluciones, reportes y auditoría, con un portal de autoservicio para el cliente.'],
    ['<strong>Componentes</strong>', 'Aplicación web (frontend), interfaz de programación de servicios (API REST), esquema de base de datos y documentación técnica y de usuario.'],
    ['<strong>Tecnologías</strong>', 'React y Vite (interfaz); Node.js y Express (servicios); PostgreSQL 16 (datos); Docker para el despliegue.'],
    ['<strong>Entrega</strong>', 'Código fuente, esquema de base de datos, scripts de instalación, documentación y pruebas automatizadas.'],
    ['<strong>Versión</strong>', 'Versión 1.0 — la identificada en el repositorio al momento de la entrega.'],
    ['<strong>Ubicación del código</strong>', `${vacio()}<br><span style="font-size:8pt;color:#64748b">URL del repositorio o del medio de entrega</span>`],
  ],
)}

<h2>SEGUNDA. Titularidad del software</h2>
<p><strong>EL SOFTWARE es de titularidad de EL LICENCIANTE</strong>, quien conserva la totalidad de los derechos patrimoniales de autor sobre el código fuente, la arquitectura, el modelo de datos, las reglas de negocio, la documentación y los elementos gráficos originales.</p>
<p>Este contrato <strong>NO transfiere ni cede</strong> la titularidad del software, ni ninguno de los derechos patrimoniales derivados de él. LA EMPRESA recibe únicamente un <strong>derecho de uso</strong> en los términos de la cláusula TERCERA.</p>

<div class="caja">
  <span class="titulo">Diferencia entre ser dueño y tener derecho a usar</span>
  <p>Esta distinción es el eje del contrato:</p>
  <ul style="margin-bottom:0">
    <li><strong>Titularidad (ceder el software):</strong> el dueño puede venderlo, licenciarlo a otros, modificarlo libremente y decidir su futuro. Es lo que conserva EL LICENCIANTE.</li>
    <li><strong>Licencia de uso (recibir el software):</strong> el usuario puede utilizarlo en las condiciones pactadas, pero no es su dueño ni puede explotarlo como propio. Es lo que recibe LA EMPRESA.</li>
  </ul>
  <p style="margin-bottom:0">Si las partes quisieran transferir la propiedad, sería necesario un contrato de <strong>cesión de derechos patrimoniales</strong>, que no es el presente documento.</p>
</div>

<h2>TERCERA. Derechos de uso otorgados</h2>
<p>EL LICENCIANTE otorga a LA EMPRESA una licencia de uso de EL SOFTWARE con las siguientes características:</p>

${tabla(
  ['Característica', 'Condición'],
  [
    ['<strong>Alcance</strong>', 'Uso del software para la <strong>operación interna</strong> de LA EMPRESA: facturación y cobro a sus propios clientes.'],
    ['<strong>Usuarios</strong>', 'El personal de LA EMPRESA y sus clientes, a través del portal de autoservicio, sin límite de número de usuarios.'],
    ['<strong>Instalaciones</strong>', 'Los servidores propios de LA EMPRESA o los que contrate para ello (servicios en la nube).'],
    ['<strong>Copias</strong>', 'Se permite realizar las copias necesarias para la instalación, el funcionamiento y el respaldo de la información.'],
    ['<strong>Exclusividad</strong>', '<strong>NO EXCLUSIVA.</strong> EL LICENCIANTE conserva el derecho de usar, licenciar y comercializar EL SOFTWARE con otros clientes, y de reutilizar sus componentes en otros desarrollos.'],
    ['<strong>Territorio</strong>', 'República de Colombia. Su uso fuera de este territorio requerirá autorización escrita de EL LICENCIANTE.'],
    ['<strong>Duración</strong>', 'Indefinida, salvo terminación anticipada conforme a la cláusula DÉCIMA.'],
    ['<strong>Transferibilidad</strong>', '<strong>NO TRANSFERIBLE.</strong> LA EMPRESA no puede ceder ni sublicenciar la licencia a terceros sin autorización escrita de EL LICENCIANTE.'],
  ],
)}

<h2>CUARTA. Restricciones</h2>
<p>LA EMPRESA se obliga a <strong>no</strong> realizar, directa ni indirectamente, las siguientes conductas:</p>
<ol>
  <li><strong>Comercializar</strong> EL SOFTWARE: venderlo, alquilarlo, licenciarlo, sublicenciarlo o cederlo a terceros, total o parcialmente.</li>
  <li><strong>Ofrecerlo como servicio</strong> a terceros (por ejemplo, facturar a otras empresas usando EL SOFTWARE como producto propio).</li>
  <li><strong>Retirar, ocultar o alterar</strong> los avisos de autoría, de titularidad o de licencia que acompañan al software.</li>
  <li><strong>Usar el nombre o las marcas</strong> de EL LICENCIANTE para promocionar productos o servicios sin autorización escrita.</li>
  <li><strong>Eludir las medidas de seguridad</strong> del software o utilizarlo para fines ilícitos, incluido el tratamiento de datos personales sin la autorización de sus titulares.</li>
</ol>

<h2>QUINTA. Distribución y modificación</h2>
<ul>
  <li><strong>Distribución:</strong> LA EMPRESA no puede distribuir EL SOFTWARE ni sus componentes a terceros. Se entiende por distribución la entrega a personas distintas de su personal y sus clientes autorizados.</li>
  <li><strong>Modificación:</strong> LA EMPRESA <strong>puede modificar</strong> el software para adaptarlo a sus necesidades internas, así como desarrollar módulos complementarios, siempre que no los distribuya ni los comercialice como producto independiente.</li>
  <li><strong>Mejoras:</strong> salvo pacto en contrario, las modificaciones realizadas por LA EMPRESA <strong>no transfieren titularidad</strong> a EL LICENCIANTE sobre el código original, ni de EL LICENCIANTE a LA EMPRESA sobre el software base.</li>
  <li><strong>Nuevas versiones:</strong> esta licencia cubre la versión 1.0 identificada en la cláusula PRIMERA. Las mejoras y nuevas versiones que EL LICENCIANTE desarrolle podrán licenciarse en condiciones separadas.</li>
</ul>

<h2>SEXTA. Uso comercial y explotación</h2>
<p>El uso que LA EMPRESA haga del software es <strong>para sí misma</strong>, en su condición de usuario, y ese uso puede tener finalidad lucrativa en el marco de su actividad (facturar a sus clientes es su negocio). Lo que <strong>no</strong> está permitido es explotar EL SOFTWARE como producto: venderlo, licenciarlo o cobrar a terceros por su uso.</p>

${tabla(
  ['Situación', '¿Permitido?', 'Aclaración'],
  [
    ['LA EMPRESA usa el sistema para facturar a sus clientes', '<span class="badge b-ok">Sí</span>', 'Es exactamente la finalidad del software y el objeto del contrato.'],
    ['LA EMPRESA cobra a un tercero por «instalarle» el sistema', '<span class="badge b-no">No</span>', 'Sería distribución o sublicenciamiento, prohibido en la cláusula CUARTA.'],
    ['LA EMPRESA lo ofrece como servicio en línea a otras empresas', '<span class="badge b-no">No</span>', 'Constituiría explotación comercial del software ajeno.'],
    ['LA EMPRESA modifica el sistema para su operación', '<span class="badge b-ok">Sí</span>', 'Permitido por la cláusula QUINTA, mientras no lo distribuya.'],
    ['EL EQUIPO licencia el mismo software a otra empresa', '<span class="badge b-ok">Sí</span>', 'La licencia es NO EXCLUSIVA: es un derecho que conserva EL LICENCIANTE.'],
  ],
)}

<h2>SÉPTIMA. Propiedad intelectual</h2>
<ul>
  <li>EL SOFTWARE es una <strong>obra protegida por el derecho de autor</strong>. La titularidad de EL LICENCIANTE consta desde el momento de su creación, sin necesidad de registro; el registro solo sirve como medio de prueba.</li>
  <li>Esta licencia <strong>no implica cesión</strong> de derechos morales (que son irrenunciables) ni patrimoniales.</li>
  <li>Los <strong>datos que LA EMPRESA introduzca</strong> en el sistema (clientes, productos, facturas, pagos) son de su exclusiva propiedad y responsabilidad. EL LICENCIANTE no los utiliza ni los trata con otra finalidad.</li>
  <li>La documentación, los diagramas, los prototipos y las pruebas son obra de EL LICENCIANTE y quedan cubiertos por esta misma licencia de uso.</li>
</ul>

<h2>OCTAVA. Componentes de terceros</h2>
<p>EL SOFTWARE incorpora componentes de código abierto de terceros. La titularidad de esos componentes corresponde a sus respectivos autores y su uso se rige por <strong>sus propias licencias</strong>, no por este contrato. EL LICENCIANTE declara que:</p>
<ul>
  <li>Todos los componentes utilizados tienen licencias <strong>permisivas</strong> (MIT, ISC, BSD, Apache-2.0) compatibles con el uso comercial.</li>
  <li><strong>Ningún componente</strong> que forme parte del software entregado está sujeto a licencias copyleft que obliguen a publicar el código fuente.</li>
  <li>Se entrega el detalle completo en la <strong>Evidencia 4 · Matriz de propiedad intelectual</strong>, que forma parte de la documentación del proyecto.</li>
</ul>

<div class="caja">
  <span class="titulo">Herramientas de documentación</span>
  <p style="margin-bottom:0">La herramienta <strong>PlantUML</strong>, usada para generar los diagramas, tiene licencia GPL-3.0. Se usó como programa independiente y <strong>no se distribuye</strong> con EL SOFTWARE ni se enlaza con él, por lo que su licencia no alcanza al producto entregado.</p>
</div>

<h2>NOVENA. Soporte y mantenimiento</h2>
<p>El presente contrato <strong>no incluye</strong> soporte técnico, mantenimiento, corrección de errores ni actualizaciones, salvo pacto escrito adicional. Si las partes lo desean, podrán suscribir un acuerdo de soporte separado con el alcance, los tiempos de respuesta y la contraprestación correspondiente.</p>
<p>Se entrega, junto con el software, la documentación de instalación y uso, que permite a LA EMPRESA poner el sistema en funcionamiento por sus propios medios.</p>

<h2>DÉCIMA. Terminación de la licencia</h2>
<p>Esta licencia puede terminar por:</p>
<ol>
  <li><strong>Mutuo acuerdo</strong> de las partes, por escrito.</li>
  <li><strong>Incumplimiento</strong> de cualquiera de las obligaciones de la cláusula CUARTA (restricciones). En ese caso, EL LICENCIANTE podrá exigir el cese inmediato del uso.</li>
  <li><strong>Decisión unilateral</strong> de LA EMPRESA, comunicada por escrito, sin penalidad.</li>
</ol>
<p>Terminada la licencia, LA EMPRESA deberá <strong>cesar el uso</strong> de EL SOFTWARE y eliminar las copias que obren en su poder, salvo aquellas que deba conservar por obligaciones legales, contables o tributarias.</p>

<div class="caja warn">
  <span class="titulo">Cláusula importante: los datos no desaparecen por terminar el contrato</span>
  <p style="margin-bottom:0">La terminación de la licencia <strong>no faculta a borrar la información de LA EMPRESA</strong>. Al finalizar, EL LICENCIANTE entregará una <strong>copia completa de los datos</strong> en un formato abierto y estándar (por ejemplo, un volcado de la base de datos y los documentos generados), para que LA EMPRESA pueda conservarlos y cumplir con sus obligaciones contables y tributarias.</p>
</div>

<h2>DÉCIMO PRIMERA. Protección de datos personales</h2>
<p>EL SOFTWARE trata datos personales de clientes (nombre, identificación, contacto). LA EMPRESA actúa como <strong>responsable del tratamiento</strong> y se obliga a dar cumplimiento a la normativa colombiana de protección de datos personales (Ley 1581 de 2012 y sus decretos reglamentarios). EL LICENCIANTE, en su calidad de desarrollador, actúa como <strong>encargado del tratamiento</strong> únicamente en lo necesario para la puesta en funcionamiento y no utiliza los datos con fines distintos.</p>

<h2>DÉCIMO SEGUNDA. Garantías y limitación de responsabilidad</h2>
<p>EL LICENCIANTE entrega EL SOFTWARE en el estado en que se encuentra, con la documentación y las pruebas descritas en la documentación del proyecto. No garantiza que el software esté libre de errores ni que satisfaga necesidades distintas de las especificadas en la Evidencia 3 (Especificación de Requisitos).</p>
<p>EL LICENCIANTE no será responsable de los perjuicios derivados del uso indebido del software, de la pérdida de datos por causas ajenas a su control (fallos de hardware, de red o de terceros) ni del incumplimiento por parte de LA EMPRESA de sus obligaciones legales, contables o tributarias.</p>
<p><strong>Aclaración necesaria:</strong> EL SOFTWARE genera documentos de cobro con finalidad de gestión interna. <strong>No constituye un documento con validez fiscal</strong> mientras no se integre con los servicios de facturación electrónica exigidos por la DIAN.</p>

<h2>DÉCIMO TERCERA. Modificaciones al contrato</h2>
<p>Cualquier modificación de este contrato deberá constar por <strong>escrito</strong> y ser suscrita por ambas partes.</p>

<h2>DÉCIMO CUARTA. Ley aplicable y solución de controversias</h2>
<p>Este contrato se rige por las leyes de la <strong>República de Colombia</strong>. Las partes intentarán resolver de buena fe cualquier controversia derivada de su interpretación o cumplimiento, y de no lograrlo acudirán a los jueces competentes de ${vacio()}.</p>

<h2>DÉCIMO QUINTA. Aceptación</h2>
<p>Las partes manifiestan que han leído y comprendido el contenido de este contrato y lo aceptan en su integridad, y en constancia firman:</p>

<div class="firma">
  <div>
    <div class="l">
      ${lineaFirma(3.4)}
      <strong>EL LICENCIANTE</strong>
      <span class="firma-datos">Nombre: ${vacio(1.2)}</span>
      <span class="firma-datos">CC: ${vacio(1.2)}</span>
      En representación del equipo desarrollador
    </div>
  </div>
  <div>
    <div class="l">
      ${lineaFirma(3.4)}
      <strong>EL LICENCIATARIO</strong>
      <span class="firma-datos">Nombre: ${vacio(1.3)}</span>
      <span class="firma-datos">CC: ${vacio(1.3)}</span>
      Representante legal de ${vacio(1.3)}<br>
      <span class="firma-datos">NIT: ${vacio(1.3)}</span>
    </div>
  </div>
</div>

<p style="margin-top:22px">Firmado en:</p>
<table class="compacta formulario"><tbody>
${fila('Ciudad', vacio())}
${fila('Día', vacio())}
${fila('Mes', vacio())}
${fila('Año', vacio())}
</tbody></table>

<h1>Anexo · Resumen de la licencia en una página</h1>
${tabla(
  ['Pregunta', 'Respuesta'],
  [
    ['¿Quién es el dueño del software?', '<strong>El equipo desarrollador (EL LICENCIANTE).</strong> Conserva todos los derechos patrimoniales.'],
    ['¿Qué recibe LA EMPRESA?', 'Una <strong>licencia de uso</strong>: puede usarlo para su operación interna, sin ser su dueña.'],
    ['¿Es exclusiva?', '<strong>No.</strong> El equipo puede licenciar el mismo software a otros clientes.'],
    ['¿Puede LA EMPRESA venderlo o revenderlo?', '<strong>No.</strong> Tampoco ofrecerlo como servicio a terceros.'],
    ['¿Puede modificarlo?', '<strong>Sí</strong>, para su uso interno, pero no distribuirlo.'],
    ['¿Por cuánto tiempo?', 'De forma <strong>indefinida</strong>, salvo incumplimiento o decisión de la empresa.'],
    ['¿Dónde puede usarlo?', 'En <strong>Colombia</strong>.'],
    ['¿Qué pasa con los datos de la empresa?', 'Son <strong>suyos</strong>. Al terminar el contrato se le entrega una copia completa.'],
    ['¿Los componentes de terceros cambian algo?', 'No. Todos son de licencia permisiva; el equipo puede licenciar su software como decida.'],
    ['¿Quién responde por las obligaciones fiscales?', '<strong>LA EMPRESA.</strong> El software no emite documentos con validez fiscal mientras no se integre con la DIAN.'],
  ],
)}

<footer class="pie-doc">FINAN-X · Evidencia 5 de 7 · Contrato de licencia de software · Documento con finalidad académica.</footer>
`;

escribir('E5_Contrato_Licencia_Software.html', html({ titulo: 'FINAN-X · Contrato de licencia de software', cuerpo }));
