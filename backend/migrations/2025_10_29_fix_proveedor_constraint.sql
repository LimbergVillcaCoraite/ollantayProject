-- =====================================================
-- Migration: Fix proveedor_O constraint
-- Date: 2025-10-29
-- Description: 
--   Corrige el constraint de la tabla proveedor_O para permitir:
--   - Proveedores tipo Empresa (esEmpresa=1): tienen idEmpresaProveedor, NO tienen idPersona
--   - Proveedores tipo Persona (esEmpresa=0): tienen idPersona Y idEmpresaProveedor (heredado de la persona)
-- =====================================================

USE SystemaOllantay;

-- Eliminar el constraint antiguo que es muy restrictivo
ALTER TABLE proveedor_O DROP CONSTRAINT IF EXISTS chk_proveedor_tipo;

-- Agregar nuevo constraint más flexible
-- Reglas:
-- 1. Si esEmpresa = 1 (Empresa): debe tener idEmpresaProveedor y NO debe tener idPersona
-- 2. Si esEmpresa = 0 (Persona): debe tener idPersona (idEmpresaProveedor se obtiene de la persona)
ALTER TABLE proveedor_O ADD CONSTRAINT chk_proveedor_tipo CHECK (
  (
    (esEmpresa = 1 AND idEmpresaProveedor IS NOT NULL AND idPersona IS NULL)
    OR
    (esEmpresa = 0 AND idPersona IS NOT NULL)
  )
);

-- Crear índice para mejorar búsquedas
CREATE INDEX IF NOT EXISTS idx_proveedor_tipo ON proveedor_O(esEmpresa, estado);

-- Comentarios sobre la lógica
-- Para EMPRESA:     esEmpresa=1, idEmpresaProveedor=<id_empresa>, idPersona=NULL
-- Para PERSONA:     esEmpresa=0, idPersona=<id_persona>, idEmpresaProveedor=<se hereda de persona_O.id_empresa>

SELECT 'Migration completed: proveedor_O constraint fixed' AS status;
