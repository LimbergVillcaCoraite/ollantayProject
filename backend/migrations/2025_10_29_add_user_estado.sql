-- Migración: Agregar campo estado a user_O
-- Fecha: 2025-10-29
-- Descripción: Permite activar/desactivar usuarios para controlar acceso al sistema

USE SystemaOllantay;

-- Agregar columna estado si no existe
SET @col_exist = (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
                  WHERE TABLE_SCHEMA = 'SystemaOllantay' 
                  AND TABLE_NAME = 'user_O' 
                  AND COLUMN_NAME = 'estado');

SET @sql = IF(@col_exist = 0,
    'ALTER TABLE user_O ADD COLUMN estado TINYINT NOT NULL DEFAULT 1 COMMENT ''1=activo, 0=inactivo'' AFTER id_persona',
    'SELECT ''Campo estado ya existe en user_O'' AS mensaje');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Actualizar todos los usuarios existentes a activo por defecto
UPDATE user_O SET estado = 1 WHERE estado IS NULL OR estado NOT IN (0,1);

SELECT 'Migración completada: campo estado agregado a user_O' AS resultado;
