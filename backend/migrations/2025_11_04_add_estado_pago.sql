
USE SystemaOllantay;

-- 1. La tabla venta_O ya tiene estado_pago con valores: 'Pagado','Pendiente','Parcial'
-- No necesita alteración, ya está correcta

-- VERIFICAR si compra_O necesita la columna (probablemente también la tenga)
ALTER TABLE compra_O
ADD COLUMN IF NOT EXISTS estado_pago ENUM('Pagado','Pendiente','Parcial')
DEFAULT 'Pendiente'
COMMENT 'Estado del pago: Pendiente (sin pagar), Pagado (completamente pagado), Parcial (pago parcial registrado)'
AFTER montoTotal;

-- 3. Actualizar ventas existentes según método de pago y montoPagado
UPDATE venta_O 
SET estado_pago = CASE 
    WHEN montoPagado >= montoTotal THEN 'Pagado'
    WHEN montoPagado > 0 AND montoPagado < montoTotal THEN 'Parcial'
    ELSE 'Pendiente'
END
WHERE estado = 1;

UPDATE compra_O
SET estado_pago = CASE
    WHEN montoPagado >= montoTotal THEN 'Pagado'
    WHEN montoPagado > 0 AND montoPagado < montoTotal THEN 'Parcial'
    ELSE 'Pendiente'
END
WHERE estado = 1;

CREATE INDEX IF NOT EXISTS idx_venta_estadoPago ON venta_O(estado_pago);
CREATE INDEX IF NOT EXISTS idx_compra_estadoPago ON compra_O(estado_pago);

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
