// Réplica en JS de la semántica del JOIN de la vista factura_saldo.
// No toca la base de datos: simula el producto cartesiano de los dos LEFT JOIN.
//
// Vista real (database/init.sql, líneas 181-207):
//   FROM facturas f
//   LEFT JOIN pagos p          ON p.factura_id = f.factura_id
//   LEFT JOIN notas_credito nc ON nc.factura_id = f.factura_id AND nc.estado = 'ACTIVA'
//   GROUP BY f.factura_id

const total = 100;

// --- Caso A: factura de 100, con 2 pagos de 50 y 1 nota de crédito ACTIVA de 30 ---
// Valores correctos esperados: pagado=100, notas=30, saldo=100-100+30=30
const pagos = [50, 50];
const notas = [30];

// Producto cartesiano: cada pago se combina con cada nota => pagos*notas filas
const filas = [];
for (const p of pagos) for (const n of notas) filas.push({ p, n });

const sumP = filas.reduce((s, f) => s + f.p, 0);
const sumN = filas.reduce((s, f) => s + f.n, 0);
const saldo = total - sumP + sumN;

console.log('=== Caso A: 2 pagos (50+50) y 1 nota (30) sobre factura de 100 ===');
console.log(`Filas del JOIN: ${filas.length} (esperado 2 = 2 pagos x 1 nota)`);
console.log(`valor_pagado  => ${sumP}   (correcto: 100)  ${sumP === 100 ? 'OK' : 'MAL'}`);
console.log(`notas_credito => ${sumN}    (correcto: 30)  ${sumN === 30 ? 'OK' : 'MAL <-- FAN-OUT'}`);
console.log(`saldo         => ${saldo}    (correcto: 30)  ${saldo === 30 ? 'OK' : 'MAL <-- SALDO INFLADO'}`);

// --- Caso B: factura de 100, 1 pago de 40 y 2 notas de 10 ---
const pagosB = [40];
const notasB = [10, 10];
const filasB = [];
for (const p of pagosB) for (const n of notasB) filasB.push({ p, n });
const sumPB = filasB.reduce((s, f) => s + f.p, 0);
const sumNB = filasB.reduce((s, f) => s + f.n, 0);
const saldoB = total - sumPB + sumNB;

console.log('\n=== Caso B: 1 pago (40) y 2 notas (10+10) sobre factura de 100 ===');
console.log(`Filas del JOIN: ${filasB.length} (esperado 2 = 1 pago x 2 notas)`);
console.log(`valor_pagado  => ${sumPB}   (correcto: 40)   ${sumPB === 40 ? 'OK' : 'MAL <-- FAN-OUT'}`);
console.log(`notas_credito => ${sumNB}   (correcto: 20)   ${sumNB === 20 ? 'OK' : 'MAL'}`);
console.log(`saldo         => ${saldoB}   (correcto: 80)   ${saldoB === 80 ? 'OK' : 'MAL'}`);

// --- Demostración de la fórmula general ---
console.log('\n=== Fórmula general ===');
console.log('Con P pagos y N notas activas, el JOIN produce P*N filas:');
console.log('  SUM(p.valor)  se multiplica por N');
console.log('  SUM(nc.valor) se multiplica por P');
console.log('=> Solo es correcto si P<=1 o N<=1 (uno de los dos conjuntos tiene 0 o 1 elemento).');
console.log('=> La suite e2e pasa porque ninguna factura probada acumula a la vez >1 pago y >1 nota.');
