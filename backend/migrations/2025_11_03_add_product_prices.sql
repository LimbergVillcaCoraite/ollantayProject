-- Migration: Add price fields to producto_O
-- Date: 2025-11-03
-- Description: Add precioMinorista, precioMayorista, precioEspecial to producto_O

USE SystemaOllantay;

-- Add price columns if they don't exist
SET @dbname = 'SystemaOllantay';
SET @tablename = 'producto_O';

SET @col_exists_min = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'precioMinorista');
SET @col_exists_may = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'precioMayorista');
SET @col_exists_esp = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = @dbname AND TABLE_NAME = @tablename AND COLUMN_NAME = 'precioEspecial');

SET @sql_min = IF(@col_exists_min = 0, 
    'ALTER TABLE producto_O ADD COLUMN precioMinorista DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT ''Precio para clientes minoristas''', 
    'SELECT ''Column precioMinorista already exists'' AS msg');
PREPARE stmt_min FROM @sql_min;
EXECUTE stmt_min;
DEALLOCATE PREPARE stmt_min;

SET @sql_may = IF(@col_exists_may = 0, 
    'ALTER TABLE producto_O ADD COLUMN precioMayorista DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT ''Precio para clientes mayoristas''', 
    'SELECT ''Column precioMayorista already exists'' AS msg');
PREPARE stmt_may FROM @sql_may;
EXECUTE stmt_may;
DEALLOCATE PREPARE stmt_may;

SET @sql_esp = IF(@col_exists_esp = 0, 
    'ALTER TABLE producto_O ADD COLUMN precioEspecial DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT ''Precio para clientes especiales''', 
    'SELECT ''Column precioEspecial already exists'' AS msg');
PREPARE stmt_esp FROM @sql_esp;
EXECUTE stmt_esp;
DEALLOCATE PREPARE stmt_esp;

COMMIT;
