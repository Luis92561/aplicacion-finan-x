-- =====================================================================
-- FINAN-X · Catálogo de productos tecnológicos (OPCIONAL)
--
-- Productos de informática con precios de referencia en COP (2026), IVA del 19 %
-- y descripción de características. Es idempotente: si el código ya existe, no
-- lo duplica ni cambia el precio.
--
-- Uso:
--   docker compose cp base/productos-tecnologicos.sql db:/tmp/productos.sql
--   docker compose exec -T db psql -U postgres -d finanx -f /tmp/productos.sql
-- =====================================================================
BEGIN;

INSERT INTO productos (codigo, nombre, descripcion, categoria, precio, impuesto, unidad_medida)
VALUES
('TEC-001', 'Portátil Lenovo ThinkPad E14 Gen 5',
 'Portátil 14" FHD (1920x1080), AMD Ryzen 5 7530U, 16 GB RAM DDR4, SSD 512 GB NVMe, Windows 11 Pro, Wi-Fi 6, Bluetooth 5.1, HDMI 2.1, 2x USB-C, 2x USB-A, RJ45, lector de huellas, teclado retroiluminado. Garantía 1 año.',
 'Portátiles', 4299000, 19, 'UND'),

('TEC-002', 'Portátil Dell Latitude 3440',
 'Portátil 14" FHD, Intel Core i5-1335U (10 núcleos), 16 GB DDR4, SSD 512 GB NVMe, Windows 11 Pro, Wi-Fi 6E, HDMI 1.4, USB-C con DisplayPort, 2x USB-A, RJ45, cámara HD con obturador. Garantía 1 año.',
 'Portátiles', 3899000, 19, 'UND'),

('TEC-003', 'MacBook Air 13" chip M3',
 'Portátil 13.6" Liquid Retina (2560x1664), chip Apple M3 de 8 núcleos, 8 GB memoria unificada, SSD 256 GB, macOS Sonoma, Wi-Fi 6E, Bluetooth 5.3, 2x Thunderbolt/USB 4, MagSafe, hasta 18 horas de batería. Garantía 1 año.',
 'Portátiles', 6799000, 19, 'UND'),

('TEC-004', 'Monitor LG UltraFine 27" 4K',
 'Monitor 27" IPS 4K UHD (3840x2160), 60 Hz, HDR10, 99 % sRGB, USB-C con 90 W de carga, 2x HDMI 2.0, DisplayPort, hub USB 3.0, ajuste de altura, pivot y VESA 100x100. Garantía 3 años.',
 'Monitores', 1899000, 19, 'UND'),

('TEC-005', 'Monitor Samsung Odyssey G5 27" QHD',
 'Monitor gamer 27" VA QHD (2560x1440), 165 Hz, 1 ms MPRT, FreeSync Premium, HDR10, 2x DisplayPort 1.2, HDMI 2.0, ajuste de inclinación, VESA 100x100. Garantía 1 año.',
 'Monitores', 1249000, 19, 'UND'),

('TEC-006', 'Monitor Dell P2422H 24" FHD',
 'Monitor 23.8" IPS Full HD (1920x1080), 60 Hz, 99 % sRGB, HDMI, DisplayPort, VGA, hub USB 3.2 (4 puertos), ajuste de altura, pivot, giro e inclinación, VESA 100x100. Garantía 3 años.',
 'Monitores', 749000, 19, 'UND'),

('TEC-007', 'Teclado Logitech MX Mechanical',
 'Teclado inalámbrico Bluetooth LE y Logi Bolt, switches táctiles silenciosos, retroiluminación inteligente, conexión a 3 dispositivos, teclas multimedia, batería de hasta 15 días con luz, estructura de aluminio. Garantía 2 años.',
 'Periféricos', 649000, 19, 'UND'),

('TEC-008', 'Mouse Logitech MX Master 3S',
 'Mouse inalámbrico ergonómico, sensor 8000 DPI, clics silenciosos, rueda MagSpeed, 7 botones programables, Bluetooth y Logi Bolt, carga USB-C, compatible con Windows, macOS y Linux. Garantía 2 años.',
 'Periféricos', 469000, 19, 'UND'),

('TEC-009', 'Diadema Jabra Evolve2 40 UC',
 'Diadema USB-A para oficina, cancelación pasiva de ruido, 3 micrófonos con brazo abatible, certificada para Microsoft Teams y Zoom, controles en el cable, almohadillas de espuma viscoelástica. Garantía 2 años.',
 'Periféricos', 829000, 19, 'UND'),

('TEC-010', 'Webcam Logitech Brio 4K',
 'Cámara 4K UHD a 30 fps, HDR, autofoco, campo de visión de 90 grados, 5x zoom digital, USB-C, obturador de privacidad, micrófonos duales, compatible con Windows Hello. Garantía 2 años.',
 'Periféricos', 789000, 19, 'UND'),

('TEC-011', 'Router TP-Link Archer AX55 WiFi 6',
 'Router AX3000 dual band (2402 Mbps en 5 GHz + 574 Mbps en 2.4 GHz), 4 antenas, OFDMA, MU-MIMO, 1 puerto WAN 2.5 Gbps, 4 LAN Gigabit, VPN, control parental, WPA3. Garantía 3 años.',
 'Redes', 479000, 19, 'UND'),

('TEC-012', 'Switch TP-Link TL-SG1024 24 puertos',
 'Switch Gigabit de 24 puertos 10/100/1000 Mbps, montaje en rack de 19", plug and play, QoS 802.1p, control de flujo, carcasa de acero, consumo máximo 13 W. Garantía 5 años.',
 'Redes', 649000, 19, 'UND'),

('TEC-013', 'Access Point Ubiquiti UniFi U6+',
 'Punto de acceso WiFi 6 AX3000, 2x2 MIMO, PoE 802.3af, gestión centralizada UniFi, montaje en techo o pared, hasta 140 m2 de cobertura, WPA3. Garantía 1 año.',
 'Redes', 789000, 19, 'UND'),

('TEC-014', 'SSD Samsung 990 PRO 1 TB NVMe',
 'Unidad de estado sólido M.2 2280 PCIe 4.0 x4, lectura 7450 MB/s, escritura 6900 MB/s, 600 TBW, controlador Samsung, disipador opcional, garantía limitada de 5 años.',
 'Almacenamiento', 629000, 19, 'UND'),

('TEC-015', 'Disco externo Seagate Expansion 2 TB',
 'Disco portátil 2.5" USB 3.0, 2 TB de capacidad, plug and play, compatible con Windows y macOS, incluye cable USB, 2 años de garantía.',
 'Almacenamiento', 389000, 19, 'UND'),

('TEC-016', 'Memoria RAM Kingston Fury Beast 16 GB DDR4 3200',
 'Módulo de 16 GB DDR4 3200 MHz, CL16, 1.35 V, disipador de aluminio, perfil XMP 2.0, compatible con Intel y AMD. Garantía limitada de por vida.',
 'Componentes', 279000, 19, 'UND'),

('TEC-017', 'Impresora HP LaserJet Pro M404dn',
 'Impresora láser monocromática, 40 ppm, dúplex automático, Ethernet 10/100/1000, 250 hojas de entrada, 150 hojas de salida, ciclo mensual de 80 000 páginas, tóner de 3 000 páginas incluido. Garantía 1 año.',
 'Impresión', 1499000, 19, 'UND'),

('TEC-018', 'UPS APC Back-UPS 650VA',
 'UPS de 650 VA / 390 W, 4 tomas con respaldo, regulación automática de voltaje (AVR), puerto USB, autonomía aproximada de 15 minutos a media carga, protección contra sobretensiones. Garantía 2 años.',
 'Energía', 429000, 19, 'UND'),

('TEC-019', 'Cámara IP Hikvision DS-2CD1043G2 4 MP',
 'Cámara IP domo 4 MP (2560x1440), infrarrojo hasta 30 m, PoE, resistencia IP67, compresión H.265+, ranura microSD hasta 256 GB, ONVIF, visión nocturna. Garantía 2 años.',
 'Videovigilancia', 399000, 19, 'UND'),

('TEC-020', 'Docking Station USB-C Lenovo 40B5',
 'Base de acople USB-C con 2x HDMI 4K, 3x USB-A 3.2, 1x USB-C, RJ45 Gigabit, audio combinado, carga de 65 W al portátil, compatible con ThinkPad y portátiles USB-C. Garantía 1 año.',
 'Accesorios', 459000, 19, 'UND')
ON CONFLICT (codigo) DO NOTHING;

COMMIT;
