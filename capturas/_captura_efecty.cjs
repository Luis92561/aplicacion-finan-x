// Capturas del flujo "pago en efectivo con código Efecty" en el portal del cliente
// Uso: NODE_PATH=<dir con puppeteer-core> node capturas/_captura_efecty.cjs
const puppeteer = require('puppeteer-core');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:8080';
const OUT = '/Users/luis/Documents/Project Facturacion Finan-x/capturas';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--disable-background-networking'],
    defaultViewport: { width: 1440, height: 950, deviceScaleFactor: 1.5 },
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

    console.log('1) login como cliente@finanx.test');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
    await page.type('input[placeholder="usuario@empresa.com"]', 'cliente@finanx.test');
    await page.type('input[type="password"]', 'cliente123');
    await page.click('form.login-card button.btn-primary');
    await page.waitForSelector('.balance-hero', { timeout: 20000 });
    await sleep(900);
    console.log('   URL:', page.url());

    console.log('2) abrir Pagar en la primera factura pendiente');
    const abierto = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.card tbody button')].find((b) => /Pagar/.test(b.textContent));
      if (!btn) return false;
      btn.click();
      return true;
    });
    if (!abierto) throw new Error('No hay facturas pendientes para pagar');
    await page.waitForSelector('.overlay .modal', { timeout: 15000 });
    await sleep(700);

    const tieneEfecto = await page.evaluate(() => document.body.innerText.includes('Generar código de pago Efecty'));
    const sinRegistrar = await page.evaluate(() => !document.body.innerText.includes('Registrar pago'));
    console.log('   EFECTIVO por defecto: panel Efecty visible =', tieneEfecto, '· botón "Registrar pago" oculto =', sinRegistrar);
    if (!(tieneEfecto && sinRegistrar)) throw new Error('El modal no bloquea el botón Pagar para efectivo');
    await page.screenshot({ path: `${OUT}/06-portal-pagar-efectivo.png`, fullPage: false });

    console.log('3) cargar saldo completo y generar el código Efecty');
    await page.evaluate(() => {
      const link = [...document.querySelectorAll('.modal button, .modal a')].find((b) => /Pagar saldo completo/.test(b.textContent));
      link && link.click();
    });
    await sleep(400);
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.modal button')].find((b) => b.textContent.includes('Generar código de pago Efecty'));
      btn && btn.click();
    });
    await page.waitForFunction(() => /tu c[oó]digo de pago efecty/i.test(document.body.innerText), { timeout: 15000 });
    await sleep(700);
    const codigo = await page.evaluate(() => {
      const el = [...document.querySelectorAll('div')].find((d) => /EFY-\d{16}/.test(d.textContent || ''));
      return el ? el.textContent.trim() : '';
    });
    console.log('   código Efecty en pantalla:', codigo);
    await page.screenshot({ path: `${OUT}/07-portal-pagar-codigo-efecty.png`, fullPage: false });

    console.log('4) cambiar a TARJETA: debe reaparecer "Registrar pago"');
    await page.evaluate(() => {
      const sel = document.querySelector('.modal select');
      if (sel) {
        sel.value = 'TARJETA';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(600);
    const vuelveRegistrar = await page.evaluate(() => document.body.innerText.includes('Registrar pago'));
    console.log('   "Registrar pago" visible con TARJETA =', vuelveRegistrar);

    console.log('FIN capturas Efecty OK');
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });