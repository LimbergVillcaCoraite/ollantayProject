-- ============================================================================
-- MIGRACIÓN: Refactors de Integridad y Constraints
-- Fecha: 19 de Octubre, 2025
-- Proyecto: SystemaOllantay - Almacén de Bebidas
-- Autor: GitHub Copilot
-- Estado: ✅ APLICADO
-- ============================================================================

USE SystemaOllantay;

-- ============================================================================
-- SECCIÓN 1: ELIMINACIÓN DE CLAVES FORÁNEAS DUPLICADAS
-- ============================================================================

-- producto_O tenía 2 FKs hacia tipoBotella (producto_O_ibfk_2 y producto_O_ibfk_3)
-- Eliminar la duplicada producto_O_ibfk_3
ALTER TABLE producto_O DROP FOREIGN KEY IF EXISTS producto_O_ibfk_3;

-- negocio tenía 2 FKs hacia tipoNegocio (negocio_ibfk_3 y negocio_ibfk_4)
-- Eliminar la duplicada negocio_ibfk_4
ALTER TABLE negocio DROP FOREIGN KEY IF EXISTS negocio_ibfk_4;


-- ============================================================================
-- SECCIÓN 2: CONSTRAINTS DE UNICIDAD
-- ============================================================================

-- Evitar productos duplicados por nombre dentro de la misma empresa
ALTER TABLE producto_O ADD CONSTRAINT uq_producto_empresa_nombre UNIQUE (idEmpresa, nombreProducto);

-- Evitar tipos de caja duplicados por nombre
ALTER TABLE tipocaja_O ADD CONSTRAINT uq_tipocaja_nombre UNIQUE (nombretipo_caja);


-- ============================================================================
-- SECCIÓN 3: CHECK CONSTRAINTS
-- ============================================================================

-- Asegurar que stockCaja nunca sea negativo
ALTER TABLE producto_O ADD CONSTRAINT chk_stockCaja_nonneg CHECK (stockCaja >= 0);


-- ============================================================================
-- SECCIÓN 4: VALORES POR DEFECTO
-- ============================================================================

-- Establecer defaults útiles en prestamo_O para facilitar inserts parciales
ALTER TABLE prestamo_O 
  MODIFY cantidad_envaseCaja INT DEFAULT 0,
  MODIFY cantidad_prestamoBotellas INT DEFAULT 0,
  MODIFY estado_prestamo TINYINT(1) DEFAULT 0;


-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================

-- Verificar constraints aplicados en producto_O
SHOW CREATE TABLE producto_O;

-- Verificar constraints aplicados en tipocaja_O
SHOW CREATE TABLE tipocaja_O;

-- Verificar defaults aplicados en prestamo_O
SHOW CREATE TABLE prestamo_O;

-- Verificar FKs restantes en producto_O (debe quedar solo producto_O_ibfk_2 y producto_O_ibfk_4)
SELECT 
  CONSTRAINT_NAME, 
  COLUMN_NAME, 
  REFERENCED_TABLE_NAME, 
  REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'SystemaOllantay'
  AND TABLE_NAME = 'producto_O'
  AND REFERENCED_TABLE_NAME IS NOT NULL;

-- Verificar FKs restantes en negocio (debe quedar solo negocio_ibfk_1, _2, _3)
SELECT 
  CONSTRAINT_NAME, 
  COLUMN_NAME, 
  REFERENCED_TABLE_NAME, 
  REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'SystemaOllantay'
  AND TABLE_NAME = 'negocio'
  AND REFERENCED_TABLE_NAME IS NOT NULL;
