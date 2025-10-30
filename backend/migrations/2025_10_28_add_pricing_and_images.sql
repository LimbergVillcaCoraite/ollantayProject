-- ============================================================================
-- MIGRACIÓN: Sistema de Precios de Productos e Imágenes
-- Fecha: 28 de Octubre, 2025
-- Proyecto: SystemaOllantay
-- ============================================================================

USE SystemaOllantay;

-- ============================================================================
-- SECCIÓN 1: TABLA DE PRECIOS DE PRODUCTOS
-- ============================================================================

CREATE TABLE IF NOT EXISTS precio_producto_O (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  idProducto INT NOT NULL,
  tipoPrecio ENUM('minorista', 'mayorista', 'especial') NOT NULL,
  precio DECIMAL(10,2) NOT NULL CHECK (precio >= 0),
  fechaCreacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  fechaActualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_precio_producto FOREIGN KEY (idProducto) REFERENCES producto_O(idProducto) ON DELETE CASCADE,
  UNIQUE KEY uq_producto_tipo_precio (idProducto, tipoPrecio),
  INDEX idx_precio_producto (idProducto),
  INDEX idx_tipo_precio (tipoPrecio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Precios de productos: minorista, mayorista y especial';

-- ============================================================================
-- SECCIÓN 2: COLUMNA DE IMAGEN EN PRODUCTOS
-- ============================================================================

-- Agregar columna imagen_producto si no existe
SET @col_exists_imagen = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'SystemaOllantay' AND TABLE_NAME = 'producto_O' AND COLUMN_NAME = 'imagen_producto');
SET @sql = IF(@col_exists_imagen = 0, 
  'ALTER TABLE producto_O ADD COLUMN imagen_producto VARCHAR(255) NULL COMMENT ''Ruta relativa de la imagen del producto'' AFTER nombreProducto',
  'SELECT "Columna imagen_producto ya existe" AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- SECCIÓN 3: ALINEACIÓN DE COLUMNAS EN DETALLE_VENTA_O
-- ============================================================================

-- Renombrar columnas en detalle_venta_O para consistencia
SET @col_exists_cantidad = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'SystemaOllantay' AND TABLE_NAME = 'detalle_venta_O' AND COLUMN_NAME = 'cantidad');

SET @sql = IF(@col_exists_cantidad > 0, 
  'ALTER TABLE detalle_venta_O CHANGE COLUMN cantidad cantidad_caja INT NOT NULL CHECK (cantidad_caja > 0)',
  'SELECT "Columna cantidad ya es cantidad_caja" AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists_precio = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'SystemaOllantay' AND TABLE_NAME = 'detalle_venta_O' AND COLUMN_NAME = 'precioUnitario');

SET @sql = IF(@col_exists_precio > 0, 
  'ALTER TABLE detalle_venta_O CHANGE COLUMN precioUnitario precio_unitario DECIMAL(10,2) NOT NULL CHECK (precio_unitario >= 0)',
  'SELECT "Columna precioUnitario ya es precio_unitario" AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- SECCIÓN 4: ALINEACIÓN DE COLUMNAS EN DETALLE_COMPRA_O
-- ============================================================================

-- Renombrar columnas en detalle_compra_O para consistencia
SET @col_exists_cantidad_compra = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'SystemaOllantay' AND TABLE_NAME = 'detalle_compra_O' AND COLUMN_NAME = 'cantidad');

SET @sql = IF(@col_exists_cantidad_compra > 0, 
  'ALTER TABLE detalle_compra_O CHANGE COLUMN cantidad cantidad_caja INT NOT NULL CHECK (cantidad_caja > 0)',
  'SELECT "Columna cantidad ya es cantidad_caja" AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists_costo = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'SystemaOllantay' AND TABLE_NAME = 'detalle_compra_O' AND COLUMN_NAME = 'costoUnitario');

SET @sql = IF(@col_exists_costo > 0, 
  'ALTER TABLE detalle_compra_O CHANGE COLUMN costoUnitario precio_unitario DECIMAL(10,2) NOT NULL CHECK (precio_unitario >= 0)',
  'SELECT "Columna costoUnitario ya es precio_unitario" AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- SECCIÓN 5: CAMPOS DE DESCUENTO EN VENTA_O
-- ============================================================================

-- Agregar campos de descuento si no existen
SET @col_exists_porcentaje_desc = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'SystemaOllantay' AND TABLE_NAME = 'venta_O' AND COLUMN_NAME = 'porcentaje_descuento');
SET @sql = IF(@col_exists_porcentaje_desc = 0, 
  'ALTER TABLE venta_O ADD COLUMN porcentaje_descuento DECIMAL(5,2) DEFAULT 0.00 CHECK (porcentaje_descuento >= 0 AND porcentaje_descuento <= 100) COMMENT ''Porcentaje de descuento aplicado'' AFTER montoTotal',
  'SELECT "Columna porcentaje_descuento ya existe" AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists_monto_desc = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'SystemaOllantay' AND TABLE_NAME = 'venta_O' AND COLUMN_NAME = 'monto_descuento');
SET @sql = IF(@col_exists_monto_desc = 0, 
  'ALTER TABLE venta_O ADD COLUMN monto_descuento DECIMAL(10,2) DEFAULT 0.00 CHECK (monto_descuento >= 0) COMMENT ''Monto fijo de descuento aplicado'' AFTER porcentaje_descuento',
  'SELECT "Columna monto_descuento ya existe" AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- SECCIÓN 6: COLUMNA TIPO_CLIENTE EN PERSONA_O
-- ============================================================================

-- Agregar tipo_cliente para distinguir mayorista/minorista/especial
SET @col_exists_tipo_cliente = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'SystemaOllantay' AND TABLE_NAME = 'persona_O' AND COLUMN_NAME = 'tipo_cliente');
SET @sql = IF(@col_exists_tipo_cliente = 0, 
  'ALTER TABLE persona_O ADD COLUMN tipo_cliente ENUM(''minorista'', ''mayorista'', ''especial'') DEFAULT ''minorista'' COMMENT ''Tipo de cliente para precios'' AFTER id_empresa',
  'SELECT "Columna tipo_cliente ya existe" AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================

-- Verificar tablas creadas/modificadas
SELECT 
  TABLE_NAME, 
  COLUMN_NAME,
  COLUMN_TYPE
FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'SystemaOllantay' 
  AND (
    (TABLE_NAME = 'precio_producto_O') OR
    (TABLE_NAME = 'producto_O' AND COLUMN_NAME = 'imagen_producto') OR
    (TABLE_NAME = 'detalle_venta_O' AND COLUMN_NAME IN ('cantidad_caja', 'precio_unitario')) OR
    (TABLE_NAME = 'detalle_compra_O' AND COLUMN_NAME IN ('cantidad_caja', 'precio_unitario')) OR
    (TABLE_NAME = 'venta_O' AND COLUMN_NAME IN ('porcentaje_descuento', 'monto_descuento')) OR
    (TABLE_NAME = 'persona_O' AND COLUMN_NAME = 'tipo_cliente')
  )
ORDER BY TABLE_NAME, COLUMN_NAME;
