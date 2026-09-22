// Capturas de FINAN-X: Dashboard y tabla de Clientes (logueado como ADMIN)
// Uso: NODE_PATH=<dir con puppeteer-core> node capturas/_captura.cjs
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

    // 1) Login
    console.log('1) abriendo /login');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
    await page.screenshot({ path: `${OUT}/01-login.png` });

    // 2) Entrar como administrador
    console.log('2) login admin@finanx.test');
    await page.type('input[placeholder="usuario@empresa.com"]', 'admin@finanx.test');
    await page.type('input[type="password"]', 'admin123');
    await page.click('form.login-card button.btn-primary');
    await page.waitForSelector('.grid-cards', { timeout: 20000 });
    await sleep(900);
    console.log('   URL tras login:', page.url());
    await page.screenshot({ path: `${OUT}/02-dashboard.png`, fullPage: true });

    // 3) Tabla de Clientes
    console.log('3) abriendo /clientes');
    await page.goto(`${BASE}/clientes`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('tbody tr', { timeout: 20000 });
    await sleep(700);
    await page.screenshot({ path: `${OUT}/03-clientes.png`, fullPage: true });

    // 4) Interacción: buscar por nombre (filtro)
    console.log('4) buscando clientes (filtro q)');
    await page.type('input[placeholder="Buscar por nombre, documento o NIT"]', 'a');
    await page.click('button.btn-ghost[type="submit"]');
    await sleep(1200);
    await page.screenshot({ path: `${OUT}/04-clientes-busqueda.png`, fullPage: true });

    // 5) Interacción: abrir "Editar" del primer cliente con datos
    console.log('5) abriendo formulario Editar del primer cliente');
    const rows = await page.$$('tbody tr');
    let editado = false;
    for (const row of rows) {
      const btn = await row.$('.row-actions button');
      if (btn) {
        const txt = await btn.evaluate((b) => b.textContent.trim());
        if (txt === 'Editar') {
          await btn.click();
          editado = true;
          break;
        }
      }
    }
    if (editado) {
      await page.waitForFunction(() => document.body.innerText.includes('Editar cliente'), { timeout: 15000 });
      await sleep(500);
      await page.screenshot({ path: `${OUT}/05-clientes-editar.png`, fullPage: false });
      console.log('   formulario Editar abierto');
    } else {
      console.log('   no se encontró botón Editar');
    }

    console.log('FIN capturas OK');
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });