-- Script para inicializar permisos del sistema Ollantay
-- Ejecutar una sola vez después de crear las tablas

-- ============================================
-- 1. INSERTAR PERMISOS (si no existen)
-- ============================================

INSERT IGNORE INTO permission_O (id_perm, resource, action, description) VALUES
-- Tipos de Persona
(1, 'tipos', 'view', 'Ver tipos de persona'),
(2, 'tipos', 'create', 'Crear tipos de persona'),
(3, 'tipos', 'edit', 'Editar tipos de persona'),
(4, 'tipos', 'delete', 'Eliminar tipos de persona'),

-- Personas/Clientes
(5, 'personas', 'view', 'Ver personas y clientes'),
(6, 'personas', 'create', 'Crear personas y clientes'),
(7, 'personas', 'edit', 'Editar personas y clientes'),
(8, 'personas', 'delete', 'Eliminar personas y clientes'),

-- Empresas
(9, 'empresas', 'view', 'Ver empresas'),
(10, 'empresas', 'create', 'Crear empresas'),
(11, 'empresas', 'edit', 'Editar empresas'),
(12, 'empresas', 'delete', 'Eliminar empresas'),

-- Prestamos
(13, 'prestamos', 'view', 'Ver prestamos'),
(14, 'prestamos', 'create', 'Crear prestamos'),
(15, 'prestamos', 'edit', 'Editar prestamos'),
(16, 'prestamos', 'delete', 'Eliminar prestamos'),
(17, 'prestamos', 'approve', 'Aprobar prestamos'),

-- Productos
(18, 'productos', 'view', 'Ver productos'),
(19, 'productos', 'create', 'Crear productos'),
(20, 'productos', 'edit', 'Editar productos'),
(21, 'productos', 'delete', 'Eliminar productos'),

-- Caja (incluye Gastos)
(22, 'caja', 'view', 'Ver caja y gastos'),
(23, 'caja', 'create', 'Registrar movimientos de caja'),
(24, 'caja', 'edit', 'Editar movimientos de caja'),
(25, 'caja', 'delete', 'Eliminar movimientos de caja'),

-- Ventas (incluye Predicciones y Creditos admin)
(26, 'ventas', 'view', 'Ver ventas'),
(27, 'ventas', 'create', 'Crear ventas'),
(28, 'ventas', 'edit', 'Editar ventas'),
(29, 'ventas', 'delete', 'Anular ventas'),
(30, 'ventas', 'pay', 'Registrar pagos de ventas'),

-- Compras
(31, 'compras', 'view', 'Ver compras'),
(32, 'compras', 'create', 'Crear compras'),
(33, 'compras', 'edit', 'Editar compras'),
(34, 'compras', 'delete', 'Eliminar compras'),

-- Proveedores
(35, 'proveedores', 'view', 'Ver proveedores'),
(36, 'proveedores', 'create', 'Crear proveedores'),
(37, 'proveedores', 'edit', 'Editar proveedores'),
(38, 'proveedores', 'delete', 'Eliminar proveedores'),

-- Rutas
(39, 'rutas', 'view', 'Ver rutas'),
(40, 'rutas', 'create', 'Crear rutas'),
(41, 'rutas', 'edit', 'Editar rutas'),
(42, 'rutas', 'delete', 'Eliminar rutas'),

-- Cuentas
(43, 'cuentas', 'view', 'Ver cuentas'),
(44, 'cuentas', 'create', 'Crear cuentas'),
(45, 'cuentas', 'edit', 'Editar cuentas'),
(46, 'cuentas', 'delete', 'Eliminar cuentas'),

-- Roles y Permisos
(47, 'roles', 'view', 'Ver roles'),
(48, 'roles', 'manage', 'Administrar roles y permisos (incluye usuarios)');

-- ============================================
-- 2. ASIGNAR PERMISOS A ROLES (si no existen)
-- ============================================

-- SUPERADMIN: Todos los permisos (id_empresa = NULL = global)
INSERT IGNORE INTO role_permission_O (role_id, perm_id, id_empresa)
SELECT r.idrole, p.id_perm, NULL
FROM role_O r
CROSS JOIN permission_O p
WHERE r.name = 'superadmin';

-- ADMIN: Todos los permisos excepto gestión de empresas (id_empresa específico por empresa)
INSERT IGNORE INTO role_permission_O (role_id, perm_id, id_empresa)
SELECT r.idrole, p.id_perm, NULL
FROM role_O r
CROSS JOIN permission_O p
WHERE r.name = 'admin'
AND p.resource != 'empresas';  -- Admin no puede crear/editar empresas

-- EDITOR: Permisos de lectura/escritura (sin delete, sin aprobar préstamos)
INSERT IGNORE INTO role_permission_O (role_id, perm_id, id_empresa)
SELECT r.idrole, p.id_perm, NULL
FROM role_O r
CROSS JOIN permission_O p
WHERE r.name = 'editor'
AND p.action IN ('view', 'create', 'edit', 'pay')
AND p.action != 'delete'
AND p.id_perm != 17;  -- No puede aprobar préstamos

-- VIEWER: Solo lectura
INSERT IGNORE INTO role_permission_O (role_id, perm_id, id_empresa)
SELECT r.idrole, p.id_perm, NULL
FROM role_O r
CROSS JOIN permission_O p
WHERE r.name = 'viewer'
AND p.action = 'view';

-- CLIENTE: Sin permisos en permission_O (misdeudas está disponible para todos los autenticados)
-- Los clientes no necesitan permisos explícitos en permission_O

-- ============================================
-- 3. VERIFICACION
-- ============================================

-- Ver todos los permisos creados
SELECT 
  id_perm,
  CONCAT(resource, ':', action) as permission,
  description
FROM permission_O
ORDER BY id_perm;

-- Ver permisos asignados por rol
SELECT 
  r.name as role,
  COUNT(rp.perm_id) as permissions_count
FROM role_O r
LEFT JOIN role_permission_O rp ON r.idrole = rp.role_id
GROUP BY r.idrole, r.name
ORDER BY r.idrole;

-- Ver detalle de permisos por rol
SELECT 
  r.name as role,
  p.resource,
  p.action,
  p.description
FROM role_O r
JOIN role_permission_O rp ON r.idrole = rp.role_id
JOIN permission_O p ON rp.perm_id = p.id_perm
ORDER BY r.name, p.resource, p.action;
