-- Migración: Agregar soporte para permisos por empresa
-- Fecha: 2025-10-28
-- Descripción: Permite que cada empresa tenga configuraciones de permisos diferentes para el mismo rol

-- 1. Agregar columna id_empresa a role_permission_O
ALTER TABLE role_permission_O 
ADD COLUMN id_empresa INT NULL COMMENT 'NULL = global (superadmin), valor = específico de empresa';

-- 2. Agregar índice para búsquedas eficientes
ALTER TABLE role_permission_O 
ADD INDEX idx_empresa_role (id_empresa, role_id);

-- 3. Modificar la clave primaria para incluir id_empresa (permitir el mismo rol+permiso en diferentes empresas)
-- Primero eliminamos las foreign keys que dependen de la clave primaria
ALTER TABLE role_permission_O DROP FOREIGN KEY role_permission_O_ibfk_1;
ALTER TABLE role_permission_O DROP FOREIGN KEY role_permission_O_ibfk_2;

-- Ahora eliminamos la clave primaria existente
ALTER TABLE role_permission_O DROP PRIMARY KEY;

-- Agregar nueva clave primaria compuesta que permite NULL en id_empresa
-- Usamos un UNIQUE INDEX en lugar de PRIMARY KEY para permitir NULL
ALTER TABLE role_permission_O 
ADD UNIQUE KEY unique_role_perm_empresa (role_id, perm_id, id_empresa);

-- Restaurar las foreign keys
ALTER TABLE role_permission_O 
ADD CONSTRAINT role_permission_O_ibfk_1 
FOREIGN KEY (role_id) REFERENCES role_O (idrole) ON DELETE CASCADE;

ALTER TABLE role_permission_O 
ADD CONSTRAINT role_permission_O_ibfk_2 
FOREIGN KEY (perm_id) REFERENCES permission_O (id_perm) ON DELETE CASCADE;

-- 4. Agregar foreign key para id_empresa (opcional, solo si existe la tabla empresa_O)
ALTER TABLE role_permission_O 
ADD CONSTRAINT fk_role_permission_empresa 
FOREIGN KEY (id_empresa) REFERENCES empresa_O(id_empresa) ON DELETE CASCADE;

-- 5. Actualizar registros existentes:
-- Los permisos del superadmin deben ser globales (NULL)
UPDATE role_permission_O rp
JOIN role_O r ON rp.role_id = r.idrole
SET rp.id_empresa = NULL
WHERE r.name = 'superadmin';

-- Los permisos de otros roles deben migrar a todas las empresas existentes
-- Nota: Esto duplicará los permisos existentes para cada empresa
INSERT INTO role_permission_O (role_id, perm_id, id_empresa)
SELECT DISTINCT rp.role_id, rp.perm_id, e.id_empresa
FROM role_permission_O rp
CROSS JOIN empresa_O e
JOIN role_O r ON rp.role_id = r.idrole
WHERE rp.id_empresa IS NULL 
  AND r.name != 'superadmin'
ON DUPLICATE KEY UPDATE role_id = rp.role_id;

-- Nota: Si prefieres que cada empresa comience sin permisos configurados,
-- comenta las líneas anteriores y ejecuta solo:
-- UPDATE role_permission_O SET id_empresa = 1 WHERE id_empresa IS NULL;
