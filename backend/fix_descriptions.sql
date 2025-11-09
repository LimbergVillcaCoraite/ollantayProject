-- Script para actualizar descripciones de permisos existentes (sin tildes ni acentos)

-- Actualizar permisos de tipos
UPDATE permission_O SET description = 'Ver tipos de persona' WHERE id_perm = 1;
UPDATE permission_O SET description = 'Crear tipos de persona' WHERE id_perm = 2;
UPDATE permission_O SET description = 'Actualizar tipos de persona' WHERE id_perm = 3;
UPDATE permission_O SET description = 'Eliminar tipos de persona' WHERE id_perm = 4;

-- Actualizar permisos de personas
UPDATE permission_O SET description = 'Ver personas y clientes' WHERE id_perm = 5;
UPDATE permission_O SET description = 'Crear personas y clientes' WHERE id_perm = 6;
UPDATE permission_O SET description = 'Actualizar personas y clientes' WHERE id_perm = 7;
UPDATE permission_O SET description = 'Eliminar personas y clientes' WHERE id_perm = 8;

-- Actualizar permisos de empresas
UPDATE permission_O SET description = 'Ver empresas' WHERE id_perm = 9;
UPDATE permission_O SET description = 'Crear empresas' WHERE id_perm = 10;
UPDATE permission_O SET description = 'Actualizar empresas' WHERE id_perm = 11;
UPDATE permission_O SET description = 'Eliminar empresas' WHERE id_perm = 12;

-- Actualizar permisos de prestamos
UPDATE permission_O SET description = 'Ver prestamos' WHERE id_perm = 13;
UPDATE permission_O SET description = 'Crear prestamos' WHERE id_perm = 14;
UPDATE permission_O SET description = 'Actualizar prestamos' WHERE id_perm = 15;
UPDATE permission_O SET description = 'Eliminar prestamos' WHERE id_perm = 16;
UPDATE permission_O SET description = 'Administrar roles y permisos' WHERE id_perm = 17;

-- Actualizar permisos de tipocajas
UPDATE permission_O SET description = 'Ver tipos de caja' WHERE id_perm = 18;
UPDATE permission_O SET description = 'CRUD tipos de caja' WHERE id_perm = 19;

-- Actualizar permisos de productos
UPDATE permission_O SET description = 'Ver productos' WHERE id_perm = 20;
UPDATE permission_O SET description = 'CRUD productos' WHERE id_perm = 21;

-- Actualizar permisos de ventas
UPDATE permission_O SET description = 'Ver ventas' WHERE id_perm = 22;
UPDATE permission_O SET description = 'Crear ventas' WHERE id_perm = 23;
UPDATE permission_O SET description = 'Actualizar ventas' WHERE id_perm = 24;
UPDATE permission_O SET description = 'Anular ventas' WHERE id_perm = 25;

-- Actualizar permisos de compras
UPDATE permission_O SET description = 'Ver compras' WHERE id_perm = 26;
UPDATE permission_O SET description = 'Crear compras' WHERE id_perm = 27;
UPDATE permission_O SET description = 'Actualizar compras' WHERE id_perm = 28;
UPDATE permission_O SET description = 'Anular compras' WHERE id_perm = 29;

-- Actualizar permisos de proveedores
UPDATE permission_O SET description = 'Ver proveedores' WHERE id_perm = 30;
UPDATE permission_O SET description = 'CRUD proveedores' WHERE id_perm = 31;

-- Actualizar permisos de cuentas
UPDATE permission_O SET description = 'Ver cuentas corrientes' WHERE id_perm = 32;

-- Actualizar permisos de pagos
UPDATE permission_O SET description = 'Registrar pagos y cobros' WHERE id_perm = 33;

-- Actualizar permisos de inventario
UPDATE permission_O SET description = 'Ver movimientos de inventario' WHERE id_perm = 34;

-- Actualizar permisos productos adicionales
UPDATE permission_O SET description = 'Crear productos' WHERE id_perm = 35;
UPDATE permission_O SET description = 'Actualizar productos' WHERE id_perm = 36;
UPDATE permission_O SET description = 'Eliminar productos' WHERE id_perm = 37;

-- Actualizar permisos de caja
UPDATE permission_O SET description = 'Ver reportes de caja y gastos' WHERE id_perm = 38;

-- Actualizar permisos de rutas
UPDATE permission_O SET description = 'Ver rutas' WHERE id_perm = 39;
UPDATE permission_O SET description = 'Crear rutas' WHERE id_perm = 40;
UPDATE permission_O SET description = 'Editar rutas' WHERE id_perm = 41;
UPDATE permission_O SET description = 'Eliminar rutas' WHERE id_perm = 42;

-- Actualizar permisos de cuentas adicionales
UPDATE permission_O SET description = 'Crear cuentas' WHERE id_perm = 44;
UPDATE permission_O SET description = 'Editar cuentas' WHERE id_perm = 45;
UPDATE permission_O SET description = 'Eliminar cuentas' WHERE id_perm = 46;

-- Actualizar permisos de roles
UPDATE permission_O SET description = 'Ver roles' WHERE id_perm = 47;

-- Verificar cambios
SELECT id_perm, resource, action, description 
FROM permission_O 
WHERE id_perm <= 50
ORDER BY id_perm;
