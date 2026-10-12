/**
 * Tema y utilidades compartidas para generar las evidencias en HTML.
 *
 * Los documentos se generan como HTML con un CSS de impresión cuidado y luego
 * se convierten a PDF con Chrome headless (el mismo metodo que usa el proyecto).
 *
 * Paleta tomada de frontend/src/styles.css para que la documentacion y la
 * aplicacion se vean como el mismo producto.
 */
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
export const SALIDA = path.join(RAIZ, 'documentacion');

export const CSS = `
  @page { size: A4; margin: 18mm 16mm 20mm; }
  :root{
    --primary:#1e3a8a; --primary-dark:#172554; --accent:#2563eb;
    --success:#15803d; --success-light:#dcfce7; --warning:#b45309; --warning-light:#fef3c7;
    --danger:#b91c1c; --danger-light:#fee2e2; --purple:#6d28d9; --purple-light:#ede9fe;
    --gray:#64748b; --gray-light:#e2e8f0; --bg:#f8fafc; --border:#e2e8f0; --muted:#64748b;
  }
  *{box-sizing:border-box}
  body{
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;
    color:#0f172a; margin:0; font-size:10.5pt; line-height:1.55; background:#fff;
  }
  .doc{max-width:100%;}

  /* ---------- Portada ---------- */
  .portada{
    min-height:245mm; display:flex; flex-direction:column; justify-content:center;
    text-align:center; page-break-after:always; padding:0 10mm;
  }
  .portada .marca{font-size:34pt; font-weight:800; color:var(--primary); letter-spacing:-1px; margin:0}
  .portada .marca span{color:var(--accent)}
  .portada .sub{font-size:13pt; color:var(--muted); margin:6px 0 30px}
  .portada h1{font-size:21pt; color:var(--primary-dark); margin:0 0 8px; line-height:1.25}
  .portada .evidencia{
    display:inline-block; background:var(--primary); color:#fff; font-weight:700;
    padding:5px 16px; border-radius:999px; font-size:10pt; margin-bottom:22px;
  }
  .portada .desc{font-size:11pt; color:#334155; max-width:140mm; margin:0 auto 32px}
  .portada table.meta{margin:0 auto; border-collapse:collapse; font-size:9.5pt; text-align:left}
  .portada table.meta td{padding:4px 10px; border-bottom:1px solid var(--border)}
  .portada table.meta td:first-child{color:var(--muted); font-weight:600; white-space:nowrap}
  .portada .pie{margin-top:38px; font-size:9pt; color:var(--muted)}

  /* ---------- Encabezados ---------- */
  h1{font-size:16pt; color:var(--primary-dark); margin:0 0 4px; padding-bottom:6px; border-bottom:2.5px solid var(--primary)}
  h2{font-size:13pt; color:var(--primary); margin:20px 0 8px; padding-bottom:4px; border-bottom:1px solid var(--border); page-break-after:avoid}
  h3{font-size:11.5pt; color:var(--primary-dark); margin:14px 0 6px; page-break-after:avoid}
  h4{font-size:10.5pt; color:#334155; margin:11px 0 4px; page-break-after:avoid}
  p{margin:6px 0}
  ul,ol{margin:6px 0 6px 18px; padding:0}
  li{margin:2.5px 0}
  a{color:var(--accent); text-decoration:none}
  code{font-family:'Cascadia Mono',Consolas,'Courier New',monospace; font-size:9pt; background:#f1f5f9; padding:1px 4px; border-radius:4px; color:#0f172a}
  pre{
    background:#0f172a; color:#e2e8f0; padding:9px 12px; border-radius:7px; font-size:8.5pt;
    overflow-wrap:anywhere; white-space:pre-wrap; font-family:'Cascadia Mono',Consolas,monospace;
    page-break-inside:avoid; margin:8px 0; line-height:1.45;
  }
  pre code{background:none; color:inherit; padding:0}

  /* ---------- Tablas ---------- */
  table{width:100%; border-collapse:collapse; margin:9px 0; font-size:9pt; page-break-inside:auto}
  thead{display:table-header-group}
  tr{page-break-inside:avoid}
  th{
    background:var(--primary); color:#fff; text-align:left; padding:5px 7px;
    font-size:8.5pt; font-weight:700; text-transform:uppercase; letter-spacing:.3px;
  }
  td{padding:4.5px 7px; border-bottom:1px solid var(--border); vertical-align:top}
  tbody tr:nth-child(even){background:#f8fafc}
  td.num,th.num{text-align:right; white-space:nowrap}
  td.c,th.c{text-align:center}
  table.compacta td,table.compacta th{padding:3.5px 6px; font-size:8.5pt}

  /* ---------- Cajas ---------- */
  .caja{border-left:4px solid var(--accent); background:#eff6ff; padding:8px 12px; border-radius:0 7px 7px 0; margin:9px 0; page-break-inside:avoid}
  .caja.ok{border-color:var(--success); background:var(--success-light)}
  .caja.warn{border-color:var(--warning); background:var(--warning-light)}
  .caja.err{border-color:var(--danger); background:var(--danger-light)}
  .caja.purple{border-color:var(--purple); background:var(--purple-light)}
  .caja p:first-child{margin-top:0}
  .caja p:last-child{margin-bottom:0}
  .caja .titulo{font-weight:700; display:block; margin-bottom:2px}

  .badge{display:inline-block; padding:1px 8px; border-radius:999px; font-size:7.5pt; font-weight:700; white-space:nowrap}
  .b-ok{background:var(--success-light); color:var(--success)}
  .b-no{background:var(--danger-light); color:var(--danger)}
  .b-warn{background:var(--warning-light); color:var(--warning)}
  .b-info{background:#dbeafe; color:var(--primary)}
  .b-gray{background:var(--gray-light); color:var(--gray)}
  .b-purple{background:var(--purple-light); color:var(--purple)}

  .grid2{display:grid; grid-template-columns:1fr 1fr; gap:10px}
  .grid3{display:grid; grid-template-columns:1fr 1fr 1fr; gap:9px}
  .kpi{border:1px solid var(--border); border-radius:8px; padding:8px 10px; text-align:center; background:var(--bg)}
  .kpi .n{font-size:17pt; font-weight:800; color:var(--primary); line-height:1.1}
  .kpi .t{font-size:8pt; color:var(--muted); text-transform:uppercase; letter-spacing:.4px}

  .captura{border:1px solid var(--border); border-radius:8px; overflow:hidden; margin:9px 0; page-break-inside:avoid}
  .captura img{width:100%; display:block}
  .captura .pie{background:var(--bg); padding:5px 9px; font-size:8pt; color:var(--muted); border-top:1px solid var(--border)}

  .salto{page-break-before:always}
  .evitar-corte{page-break-inside:avoid}
  .indice{font-size:10pt}
  .indice li{margin:3px 0}
  .firma{margin-top:38px; display:grid; grid-template-columns:1fr 1fr; gap:28px}
  .firma .l{border-top:1px solid #334155; padding-top:5px; font-size:9pt; color:#334155}
  .placeholder{background:#fef3c7; border-bottom:1px dashed var(--warning); padding:0 3px; font-weight:600}
  footer.pie-doc{margin-top:26px; border-top:1px solid var(--border); padding-top:7px; font-size:8pt; color:var(--muted)}
`;

/** Envuelve el cuerpo en un documento HTML completo con el tema aplicado. */
export function html({ titulo, cuerpo }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${titulo}</title>
<style>${CSS}</style>
</head>
<body><div class="doc">
${cuerpo}
</div></body>
</html>`;
}

/** Portada estandar de las evidencias. */
export function portada({ evidencia, titulo, descripcion, meta = [] }) {
  const filas = meta.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('\n');
  return `<section class="portada">
  <p class="marca">FINAN<span>·X</span></p>
  <p class="sub">Sistema de facturación y pagos</p>
  <div class="evidencia">${evidencia}</div>
  <h1>${titulo}</h1>
  <p class="desc">${descripcion}</p>
  <table class="meta">${filas}</table>
  <p class="pie">Proyecto académico · Integración de Aplicaciones · Sexto semestre</p>
</section>`;
}

export function escribir(nombre, contenido) {
  fs.mkdirSync(SALIDA, { recursive: true });
  const destino = path.join(SALIDA, nombre);
  fs.writeFileSync(destino, contenido, 'utf8');
  console.log(`  ${nombre}  (${(Buffer.byteLength(contenido, 'utf8') / 1024).toFixed(1)} KB)`);
  return destino;
}

/** Celda: acepta una cadena o un objeto { t, clase }. Nunca emite class="undefined". */
function celda(c) {
  if (typeof c === 'string') return `<td>${c}</td>`;
  const clase = typeof c?.clase === 'string' && c.clase ? ` class="${c.clase}"` : '';
  return `<td${clase}>${c?.t ?? ''}</td>`;
}

/** Cabecera: acepta una cadena o un objeto { t, clase }. */
function cabeceraCelda(c) {
  if (typeof c === 'string') return `<th>${c}</th>`;
  const clase = typeof c?.clase === 'string' && c.clase ? ` class="${c.clase}"` : '';
  return `<th${clase}>${c?.t ?? ''}</th>`;
}

/** Tabla a partir de cabeceras y filas (celdas ya escapadas por quien la usa). */
export function tabla(cabeceras, filas, { clases = '', compacta = false } = {}) {
  const th = cabeceras.map(cabeceraCelda).join('');
  const tr = filas.map((f) => `<tr>${f.map(celda).join('')}</tr>`).join('\n');
  return `<table class="${compacta ? 'compacta ' : ''}${clases}"><thead><tr>${th}</tr></thead><tbody>\n${tr}\n</tbody></table>`;
}
