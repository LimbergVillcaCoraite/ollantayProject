-- ===================================================
-- MIGRACIÓN: Agregar campos de estadoPago a compras
-- Fecha: 2025-11-04
-- Objetivo: Permitir tracking de pagos parciales y completos
-- NOTA: venta_O ya tiene estado_pago
-- ===================================================

USE SystemaOllantay;

-- 1. Agregar columna estado_pago a tabla compra_O
ALTER TABLE compra_O
ADD COLUMN estado_pago ENUM('Pagado','Pendiente','Parcial')
DEFAULT 'Pendiente'
COMMENT 'Estado del pago: Pendiente (sin pagar), Pagado (completamente pagado), Parcial (pago parcial registrado)'
AFTER montoTotal;

-- 2. Actualizar ventas existentes según montoPagado
UPDATE venta_O 
SET estado_pago = CASE 
    WHEN montoPagado >= montoTotal THEN 'Pagado'
    WHEN montoPagado > 0 AND montoPagado < montoTotal THEN 'Parcial'
    ELSE 'Pendiente'
END
WHERE estado = 1;

-- 3. Actualizar compras existentes de manera similar
UPDATE compra_O
SET estado_pago = CASE
    WHEN montoPagado >= montoTotal THEN 'Pagado'
    WHEN montoPagado > 0 AND montoPagado < montoTotal THEN 'Parcial'
    ELSE 'Pendiente'
END
WHERE estado = 1;

-- 4. Crear índices para mejorar consultas de cuentas pendientes
CREATE INDEX idx_venta_estadoPago ON venta_O(estado_pago);
CREATE INDEX idx_compra_estadoPago ON compra_O(estado_pago);

-- 5. Verificación
SELECT 'Ventas por estado de pago:' AS resultado;
SELECT estado_pago, COUNT(*) as total, SUM(montoTotal) as monto_total
FROM venta_O
WHERE estado = 1
GROUP BY estado_pago;

SELECT 'Compras por estado de pago:' AS resultado;
SELECT estado_pago, COUNT(*) as total, SUM(montoTotal) as monto_total
FROM compra_O
WHERE estado = 1
GROUP BY estado_pago;
