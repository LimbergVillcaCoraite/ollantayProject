-- Migration: Add idCompra to lote_producto table for purchase traceability
-- Created: 2025-10-29
-- Purpose: Link each product batch (lote) to the specific purchase (compra) that created it

-- Check if column exists before adding
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS 
                   WHERE TABLE_SCHEMA = DATABASE()
                   AND TABLE_NAME = 'lote_producto' 
                   AND COLUMN_NAME = 'idCompra');

-- Add idCompra column if it doesn't exist
SET @sql = IF(@col_exists = 0,
    'ALTER TABLE lote_producto ADD COLUMN idCompra INT DEFAULT NULL AFTER idUsuarioCreador, ADD KEY idx_lote_idCompra (idCompra)',
    'SELECT "Column idCompra already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add foreign key constraint if not exists
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
                  WHERE CONSTRAINT_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'lote_producto' 
                  AND CONSTRAINT_NAME = 'fk_lote_compra');

SET @sql = IF(@fk_exists = 0,
    'ALTER TABLE lote_producto ADD CONSTRAINT fk_lote_compra FOREIGN KEY (idCompra) REFERENCES compra_O(idCompra) ON DELETE SET NULL',
    'SELECT "FK fk_lote_compra already exists" AS message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

