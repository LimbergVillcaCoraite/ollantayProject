-- Full database deploy script (structure + core updates)
-- Run with MySQL 8.0+ client from the repository root directory
-- This wraps the base structure and the latest core updates into a single entry point.

-- Ensure DB exists and select it
CREATE DATABASE IF NOT EXISTS `SystemaOllantay` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `SystemaOllantay`;

-- 1) Base structure (tables, keys, minimal constraints)
--    This file is included verbatim. If you already created the DB, it is safe to re-run.
SOURCE database_structure_only.sql;

-- 2) Core updates (new tables and changes used by current services)
--    Idempotent: safe to run multiple times.
SOURCE backend/migrations/2025_11_04_core_updates.sql;

-- 3) Optional: initial seed for tipoPago (contado, credito, transferencia)
INSERT INTO tipoPago (idPago, nombrePago) VALUES 
  (1, 'credito'),
  (2, 'contado'),
  (7, 'transferencia bancaria')
ON DUPLICATE KEY UPDATE nombrePago = VALUES(nombrePago);

-- 4) Optional: roles seed
INSERT INTO role_O (idrole, name, description) VALUES
  (1, 'superadmin', 'Acceso total al sistema'),
  (2, 'admin', 'Administrador de empresa'),
  (3, 'editor', 'Puede crear/editar registros'),
  (4, 'viewer', 'Solo lectura')
ON DUPLICATE KEY UPDATE description = VALUES(description);

-- 5) Optional: permissions seed (add only if your env expects base permissions)
--    Feel free to adjust this list to your modules. Duplicate inserts are ignored.
INSERT IGNORE INTO permission_O (resource, action, description) VALUES
  ('personas','view','Ver personas'), ('personas','create','Crear personas'), ('personas','edit','Editar personas'), ('personas','delete','Eliminar personas'),
  ('empresas','view','Ver empresas'), ('empresas','create','Crear empresas'), ('empresas','edit','Editar empresas'), ('empresas','delete','Eliminar empresas'),
  ('productos','view','Ver productos'), ('productos','create','Crear productos'), ('productos','edit','Editar productos'), ('productos','delete','Eliminar productos'),
  ('prestamos','view','Ver prestamos'), ('prestamos','create','Crear prestamos'), ('prestamos','edit','Editar prestamos'), ('prestamos','delete','Eliminar prestamos'),
  ('ventas','view','Ver ventas'), ('ventas','create','Crear ventas'), ('ventas','edit','Editar ventas'), ('ventas','delete','Eliminar ventas'),
  ('compras','view','Ver compras'), ('compras','create','Crear compras'), ('compras','edit','Editar compras'), ('compras','delete','Eliminar compras'),
  ('proveedores','view','Ver proveedores'), ('proveedores','create','Crear proveedores'), ('proveedores','edit','Editar proveedores'), ('proveedores','delete','Eliminar proveedores'),
  ('rutas','view','Ver rutas'), ('rutas','create','Crear rutas'), ('rutas','edit','Editar rutas'), ('rutas','delete','Eliminar rutas'),
  ('caja','view','Ver caja'), ('cuentas','view','Ver cuentas'), ('roles','manage','Administrar roles y permisos');

-- Note: superadmin no necesita mapeos de role_permission_O (el backend le otorga todos los permisos).
--       Para admin/editor/viewer, asigne permisos por empresa con el endpoint /roles/{role_id}/permissions.
