# Migraciones de Base de Datos - SystemaOllantay

Este directorio contiene las migraciones SQL aplicadas a la base de datos `SystemaOllantay` del proyecto.

## Orden de Aplicación

Las migraciones deben aplicarse en el siguiente orden cronológico:

### 1. `2025_10_19_db_refactors.sql` ✅ APLICADO
**Fecha:** 19 de Octubre, 2025  
**Objetivo:** Correcciones de integridad referencial y constraints básicos

**Cambios aplicados:**
- ✅ Eliminación de FKs duplicadas en `producto_O` (producto_O_ibfk_3)
- ✅ Eliminación de FKs duplicadas en `negocio` (negocio_ibfk_4)
- ✅ UNIQUE constraint en `producto_O(idEmpresa, nombreProducto)`
- ✅ UNIQUE constraint en `tipocaja_O(nombretipo_caja)`
- ✅ CHECK constraint en `producto_O.stockCaja >= 0`
- ✅ Defaults en `prestamo_O` (cantidad_envaseCaja=0, cantidad_prestamoBotellas=0, estado_prestamo=0)

**Impacto:**
- Previene duplicados en productos por empresa
- Previene duplicados en tipos de caja
- Asegura consistencia de datos
- Facilita inserts parciales en préstamos

---

### 2. `2025_10_20_ventas_compras_schema.sql` ✅ APLICADO
**Fecha:** 20 de Octubre, 2025  
**Objetivo:** Implementación completa del módulo de ventas, compras y cuentas corrientes para almacén de bebidas

**Cambios aplicados:**

#### 🆕 Tablas Creadas

**Catálogos:**
- ✅ `tipoVenta` - Tipos de venta (Mayor, Menor)
- ✅ Poblar `tipoPago` con formas de pago (Contado, Crédito, Tarjeta, Transferencia, Cheque)

**Módulo de Proveedores:**
- ✅ `proveedor_O` - Proveedores (empresas o personas particulares)
  - Soporte para proveedores empresa o persona con CHECK constraint
  - Campos: nombreComercial, contacto, teléfono, email, dirección

**Módulo de Ventas:**
- ✅ `venta_O` - Cabecera de ventas
  - Campos: numeroVenta, fechaVenta, idCliente, idEmpresa, idTipoVenta, idTipoPago
  - Montos: montoTotal, montoPagado, saldo (calculado)
  - Estado: activa/anulada
  - Scoping por empresa
- ✅ `detalle_venta_O` - Líneas de detalle de venta
  - Campos: idVenta, idProducto, cantidad, precioUnitario, subtotal (calculado)
  - ON DELETE CASCADE

**Módulo de Compras:**
- ✅ `compra_O` - Cabecera de compras
  - Campos: numeroCompra, fechaCompra, idProveedor, idEmpresa, idTipoPago
  - Montos: montoTotal, montoPagado, saldo (calculado)
  - Estado: activa/anulada
  - Scoping por empresa
- ✅ `detalle_compra_O` - Líneas de detalle de compra
  - Campos: idCompra, idProducto, cantidad, costoUnitario, subtotal (calculado)
  - ON DELETE CASCADE

**Módulo de Cuentas Corrientes:**
- ✅ `pago_O` - Registro de pagos/cobros
  - Tipo: cobro (cliente paga) / pago (empresa paga a proveedor)
  - Campos: numeroPago, fechaPago, tipo, idPersona/idProveedor, monto, idTipoPago
  - CHECK constraint para validar tipo correcto
- ✅ `cuenta_corriente_O` - Movimientos de cuentas corrientes
  - Tipo: cliente / proveedor
  - Campos: tipo, fechaMovimiento, tipoMovimiento, idReferencia, debe, haber, saldo
  - CHECK constraint para validar tipo correcto

#### ♻️ Mejoras en Tablas Existentes

**prestamo_O:**
- ✅ `esRetornable` TINYINT(1) - Indica si el envase es retornable
- ✅ `montoGarantia` DECIMAL(10,2) - Monto de garantía cobrado
- ✅ `garantiaPagada` TINYINT(1) - Si pagó garantía
- ✅ `idEmpresa` INT - Empresa del préstamo para scoping directo
- ✅ FK `fk_prestamo_empresa` → `empresa_O(id_empresa)`
- ✅ Índice `idx_prestamo_empresa_estado` (idEmpresa, estado_prestamo)

#### 🔒 Permisos RBAC

**Nuevos permisos creados:**
- ✅ `ventas` (view, create, update, delete)
- ✅ `compras` (view, create, update, delete)
- ✅ `proveedores` (view, manage)
- ✅ `cuentas` (view)
- ✅ `pagos` (create)
- ✅ `inventario` (view)

**Mapeo a roles:**
- ✅ `admin`: todos los permisos de ventas, compras, proveedores, cuentas, pagos, inventario
- ✅ `superadmin`: todos los permisos de ventas, compras, proveedores, cuentas, pagos, inventario
- ✅ `viewer`: solo view en ventas, compras, proveedores, cuentas, inventario

**Impacto:**
- Soporte completo para ventas al por mayor y menor
- Soporte para ventas al contado y al crédito
- Gestión de proveedores mixtos (empresas y personas)
- Cuentas corrientes para control de créditos
- Registro detallado de pagos y cobros
- Préstamos de envases retornables con garantía
- Scoping multi-tenant por empresa en todas las tablas transaccionales

---

## Cómo Aplicar una Migración

### Desde Host (Windows PowerShell):

```powershell
# Método 1: Pipe desde PowerShell
Get-Content "c:\Users\atthort-win\Documents\ollantayProject\backend\migrations\NOMBRE_MIGRACION.sql" | docker exec -i mysql_8_0_32-containerSources mysql -uroot -pP4assw@rd

# Método 2: Copiar y ejecutar dentro del contenedor
docker cp "c:\Users\atthort-win\Documents\ollantayProject\backend\migrations\NOMBRE_MIGRACION.sql" mysql_8_0_32-containerSources:/tmp/migration.sql
docker exec -i mysql_8_0_32-containerSources mysql -uroot -pP4assw@rd -D SystemaOllantay -e "source /tmp/migration.sql"
```

### Desde dentro del contenedor MySQL:

```bash
# Conectarse al contenedor
docker exec -it mysql_8_0_32-containerSources bash

# Ejecutar migración
mysql -uroot -pP4assw@rd SystemaOllantay < /tmp/migration.sql
```

---

## Verificación Post-Migración

Después de aplicar cada migración, ejecutar:

```sql
-- Listar todas las tablas
SHOW TABLES;

-- Ver estructura de una tabla específica
SHOW CREATE TABLE nombre_tabla;

-- Verificar permisos creados
SELECT id_perm, resource, action, description 
FROM permission_O 
ORDER BY resource, action;

-- Verificar mapeo de permisos a roles
SELECT r.name, p.resource, p.action 
FROM role_permission_O rp
JOIN role_O r ON rp.role_id = r.idrole
JOIN permission_O p ON rp.perm_id = p.id_perm
ORDER BY r.name, p.resource, p.action;
```

---

## Rollback (No Recomendado para Producción)

Si necesitas revertir una migración en desarrollo:

### Rollback de `2025_10_20_ventas_compras_schema.sql`:

```sql
-- Eliminar tablas creadas (en orden inverso por dependencias)
DROP TABLE IF EXISTS cuenta_corriente_O;
DROP TABLE IF EXISTS pago_O;
DROP TABLE IF EXISTS detalle_compra_O;
DROP TABLE IF EXISTS compra_O;
DROP TABLE IF EXISTS detalle_venta_O;
DROP TABLE IF EXISTS venta_O;
DROP TABLE IF EXISTS proveedor_O;
DROP TABLE IF EXISTS tipoVenta;

-- Eliminar columnas agregadas a prestamo_O
ALTER TABLE prestamo_O DROP FOREIGN KEY IF EXISTS fk_prestamo_empresa;
ALTER TABLE prestamo_O DROP INDEX IF EXISTS idx_prestamo_empresa_estado;
ALTER TABLE prestamo_O DROP COLUMN IF EXISTS idEmpresa;
ALTER TABLE prestamo_O DROP COLUMN IF EXISTS garantiaPagada;
ALTER TABLE prestamo_O DROP COLUMN IF EXISTS montoGarantia;
ALTER TABLE prestamo_O DROP COLUMN IF EXISTS esRetornable;

-- Eliminar permisos creados
DELETE FROM role_permission_O WHERE perm_id IN (
  SELECT id_perm FROM permission_O 
  WHERE resource IN ('ventas', 'compras', 'proveedores', 'cuentas', 'pagos', 'inventario')
);
DELETE FROM permission_O WHERE resource IN ('ventas', 'compras', 'proveedores', 'cuentas', 'pagos', 'inventario');
```

### Rollback de `2025_10_19_db_refactors.sql`:

```sql
-- Revertir defaults en prestamo_O
ALTER TABLE prestamo_O 
  MODIFY cantidad_envaseCaja INT DEFAULT NULL,
  MODIFY cantidad_prestamoBotellas INT DEFAULT NULL,
  MODIFY estado_prestamo TINYINT(1) DEFAULT NULL;

-- Eliminar CHECK constraint
ALTER TABLE producto_O DROP CONSTRAINT IF EXISTS chk_stockCaja_nonneg;

-- Eliminar UNIQUE constraints
ALTER TABLE tipocaja_O DROP CONSTRAINT IF EXISTS uq_tipocaja_nombre;
ALTER TABLE producto_O DROP CONSTRAINT IF EXISTS uq_producto_empresa_nombre;

-- Nota: No revertir eliminación de FKs duplicadas (eran incorrectas)
```

---

## Próximas Migraciones Planificadas

### 3. `2025_10_21_movimiento_inventario.sql` (OPCIONAL)
- Tabla `movimiento_inventario_O` para trazabilidad detallada de stock
- Triggers para registrar movimientos automáticos en ventas/compras
- Kardex de inventario

### 4. `2025_10_21_audit_timestamps.sql` (RECOMENDADO)
- Agregar `created_at`, `updated_at` en tablas faltantes
- Triggers `BEFORE UPDATE` para actualizar `updated_at` automáticamente
- Normalizar nomenclatura de timestamps en todo el schema

### 5. `2025_10_22_security_improvements.sql` (CRÍTICO)
- Migrar contraseñas en texto plano de `user_O` a hashing bcrypt
- Agregar columna `last_login` en `user_O`
- Implementar políticas de expiración de password

---

## Buenas Prácticas

1. **Siempre hacer backup antes de aplicar una migración:**
   ```bash
   docker exec mysql_8_0_32-containerSources mysqldump -uroot -pP4assw@rd SystemaOllantay > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Probar migraciones en ambiente de desarrollo primero**

3. **Verificar que no haya errores después de cada migración**

4. **Documentar cambios manuales adicionales no contemplados en el script**

5. **Mantener este README actualizado con cada nueva migración**

---

## Historial de Cambios

| Fecha | Migración | Autor | Estado |
|-------|-----------|-------|--------|
| 2025-10-19 | `2025_10_19_db_refactors.sql` | GitHub Copilot | ✅ Aplicado |
| 2025-10-20 | `2025_10_20_ventas_compras_schema.sql` | GitHub Copilot | ✅ Aplicado |

---

**Última actualización:** 20 de Octubre, 2025  
**Mantenedor:** GitHub Copilot
