// Vuelca el contenido real del Dashboard y de la tabla de Clientes (logueado como ADMIN)
const puppeteer = require('puppeteer-core');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const BASE = 'http://localhost:8080';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    defaultViewport: { width: 1440, height: 950 },
  });
  try {
    const page = await browser.newPage();
    page.setDefaultTimeout(30000);

    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle2' });
    await page.type('input[placeholder="usuario@empresa.com"]', 'admin@finanx.test');
    await page.type('input[type="password"]', 'admin123');
    await page.click('form.login-card button.btn-primary');
    await page.waitForSelector('.grid-cards', { timeout: 20000 });
    await sleep(800);

    console.log('===== DASHBOARD (tarjetas de resumen) =====');
    const cards = await page.$$eval('.grid-cards .stat', (els) =>
      els.map((el) => `${el.querySelector('.label').textContent.trim()}: ${el.querySelector('.value').textContent.trim()}`)
    );
    cards.forEach((c) => console.log('  •', c));

    const ops = await page.$$eval('table tbody tr', (rows) =>
      rows.slice(0, 8).map((r) => Array.from(r.querySelectorAll('td')).map((td) => td.textContent.trim()).join(' | '))
    );
    console.log('===== DASHBOARD · Operaciones recientes (auditoría, 8) =====');
    ops.forEach((r) => console.log('  ', r));

    await page.goto(`${BASE}/clientes`, { waitUntil: 'networkidle2' });
    await page.waitForSelector('tbody tr', { timeout: 20000 });
    await sleep(700);

    const header = await page.$$eval('thead th', (ths) => ths.map((th) => th.textContent.trim()));
    const rows = await page.$$eval('tbody tr', (trs) =>
      trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent.trim().replace(/\s+/g, ' ')))
    );
    console.log('===== CLIENTES · tabla =====');
    console.log('  Columnas:', header.join(' | '));
    rows.slice(0, 12).forEach((r) => console.log('  →', r.slice(0, 8).join(' | '), '| acciones:', r[8] ? r[8] : ''));

    console.log(`  Total filas: ${rows.length}`);
  } finally {
    await browser.close();
  }
}
main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });