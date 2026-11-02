/**
 * Capturas de pantalla de FINAN-X controladas por el protocolo DevTools de Chrome.
 *
 * No necesita dependencias (puppeteer u otras): usa el WebSocket nativo de Node.
 * Se lanza Chrome con --remote-debugging-port y se le habla por CDP.
 *
 * Uso:
 *   node deep-docs/_capturar.mjs
 *
 * Requiere que la aplicación esté levantada en http://localhost:8080
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.env.APP_URL || 'http://localhost:8080';
const PUERTO = 9333;
// fileURLToPath es imprescindible en Windows: URL.pathname devuelve "/C:/..." y la ruta queda mal.
const RAIZ = fileURLToPath(new URL('../', import.meta.url));
const OUT = path.join(RAIZ, 'capturas');

fs.mkdirSync(OUT, { recursive: true });

const perfil = path.join(process.env.TEMP || '.', `finanx-captura-${Date.now()}`);

// ---------- Lanzar Chrome ----------
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PUERTO}`,
  '--headless=new',
  `--user-data-dir=${perfil}`,
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--hide-scrollbars',
  '--window-size=1440,1000',
], { stdio: 'ignore' });

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Esperar al endpoint de depuración ----------
async function esperarChrome() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PUERTO}/json/version`);
      if (r.ok) return (await r.json()).webSocketDebuggerUrl;
    } catch { /* todavía no */ }
    await dormir(250);
  }
  throw new Error('Chrome no expuso el puerto de depuración');
}

// ---------- Cliente CDP mínimo ----------
class CDP {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pendientes = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pendientes.has(msg.id)) {
        const { resolve, reject } = this.pendientes.get(msg.id);
        this.pendientes.delete(msg.id);
        if (msg.error) reject(new Error(JSON.stringify(msg.error)));
        else resolve(msg.result);
      }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.ws.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => {
      this.pendientes.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pendientes.has(id)) { this.pendientes.delete(id); reject(new Error(`Timeout en ${method}`)); }
      }, 30000);
    });
  }
}

async function conectar(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('No se pudo abrir el WebSocket de CDP')), { once: true });
  });
  return new CDP(ws);
}

async function main() {
  const browserWsUrl = await esperarChrome();
  const cdp = await conectar(browserWsUrl);

  // Crear una pestaña y adjuntarse
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });

  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1000, deviceScaleFactor: 1.5, mobile: false }, sessionId);

  const evaluar = async (expresion) => {
    const r = await cdp.send('Runtime.evaluate',
      { expression: expresion, awaitPromise: true, returnByValue: true }, sessionId);
    if (r.exceptionDetails) throw new Error('Error al evaluar: ' + JSON.stringify(r.exceptionDetails.exception?.description || r.exceptionDetails));
    return r.result?.value;
  };

  const ir = async (ruta) => {
    await cdp.send('Page.navigate', { url: `${BASE}${ruta}` }, sessionId);
    // Esperar a que la red quede tranquila
    await dormir(1200);
    for (let i = 0; i < 40; i++) {
      const listo = await evaluar('document.readyState === "complete"');
      if (listo) break;
      await dormir(250);
    }
    await dormir(600);
  };

  const capturar = async (nombre, completa = true) => {
    let clip;
    if (completa) {
      const m = await cdp.send('Page.getLayoutMetrics', {}, sessionId);
      const cs = m.cssContentSize || m.contentSize;
      clip = { x: 0, y: 0, width: 1440, height: Math.min(Math.ceil(cs.height), 6000), scale: 1 };
    }
    const { data } = await cdp.send('Page.captureScreenshot',
      { format: 'png', captureBeyondViewport: completa, ...(clip ? { clip } : {}) }, sessionId);
    const destino = path.join(OUT, nombre);
    fs.writeFileSync(destino, Buffer.from(data, 'base64'));
    console.log(`   guardada ${nombre}`);
  };

  const escribir = async (selector, texto) => evaluar(`
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(el, ${JSON.stringify(texto)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    })()
  `);

  const clic = async (selector) => evaluar(`
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      el.click();
      return true;
    })()
  `);

  console.log('Capturando pantallas de FINAN-X...\n');

  // ---------- 1. Login ----------
  await ir('/login');
  await capturar('10-login.png');
  console.log('1) login');

  // ---------- 2. Entrar como administrador ----------
  await escribir('input[placeholder="usuario@empresa.com"]', 'admin@finanx.test');
  await escribir('input[type="password"]', 'admin123');
  await clic('form.login-card button.btn-primary');
  for (let i = 0; i < 40; i++) {
    if (await evaluar('!!document.querySelector(".grid-cards")')) break;
    await dormir(500);
  }
  await dormir(900);
  await capturar('11-dashboard.png');
  console.log('2) dashboard (admin)');

  // ---------- 3. Clientes ----------
  await ir('/clientes');
  await dormir(900);
  await capturar('12-clientes.png');
  console.log('3) clientes');

  // ---------- 4. Facturas ----------
  await ir('/facturas');
  await dormir(900);
  await capturar('13-facturas.png');
  console.log('4) facturas');

  // ---------- 5. Pagos (con la columna "Registrado por" nueva) ----------
  await ir('/pagos');
  await dormir(900);
  await capturar('14-pagos.png');
  console.log('5) pagos');

  // ---------- 6. Balance por cliente ----------
  await ir('/balance-clientes');
  await dormir(1100);
  await capturar('15-balance-clientes.png');
  console.log('6) balance por cliente');

  // ---------- 7. Auditoria ----------
  await ir('/auditoria');
  await dormir(900);
  await capturar('16-auditoria.png');
  console.log('7) auditoria');

  // ---------- 8. Detalle de una factura (saldo, pagos, notas) ----------
  const idFactura = await evaluar(`
    (async () => {
      const r = await fetch('/api/facturas', { headers: { Authorization: 'Bearer ' + localStorage.getItem('fx_token') } });
      const d = await r.json();
      return Array.isArray(d) && d.length ? d[0].factura_id : null;
    })()
  `);
  if (idFactura) {
    await ir(`/facturas/${idFactura}`);
    await dormir(1200);
    await capturar('17-factura-detalle.png');
    console.log(`8) detalle de factura ${idFactura}`);
  } else {
    console.log('8) no hay facturas para abrir el detalle');
  }

  // ---------- 9. Portal del cliente ----------
  await evaluar('localStorage.clear()');
  await ir('/login');
  await escribir('input[placeholder="usuario@empresa.com"]', 'cliente@finanx.test');
  await escribir('input[type="password"]', 'cliente123');
  await clic('form.login-card button.btn-primary');
  for (let i = 0; i < 40; i++) {
    if (await evaluar('location.pathname.startsWith("/portal")')) break;
    await dormir(500);
  }
  await dormir(1200);
  await capturar('18-portal-saldo.png');
  console.log('9) portal del cliente (mi saldo)');

  await ir('/portal/facturas');
  await dormir(1000);
  await capturar('19-portal-facturas.png');
  console.log('10) portal (mis facturas)');

  console.log('\nCapturas terminadas.');
  chrome.kill();
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('ERROR:', e.message);
    try { chrome.kill(); } catch { /* ya estaba muerto */ }
    process.exit(1);
  });
