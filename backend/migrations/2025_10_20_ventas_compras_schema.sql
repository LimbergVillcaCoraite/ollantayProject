-- ============================================================================
-- MIGRACIÓN: Sistema de Ventas, Compras, Proveedores y Cuentas Corrientes
-- Fecha: 20 de Octubre, 2025
-- Proyecto: SystemaOllantay - Almacén de Bebidas
-- Autor: GitHub Copilot
-- ============================================================================

-- IMPORTANTE: Ejecutar en orden, verificar cada sección antes de continuar

USE SystemaOllantay;

-- ============================================================================
-- SECCIÓN 1: CATÁLOGOS BASE
-- ============================================================================

-- Tabla: tipoVenta (Mayor/Menor)
CREATE TABLE IF NOT EXISTS tipoVenta (
  idTipoVenta INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombreTipoVenta VARCHAR(50) NOT NULL UNIQUE,
  descripcion VARCHAR(255),
  estado TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Tipos de venta: Mayor, Menor';

-- Poblar tipoVenta
INSERT INTO tipoVenta (nombreTipoVenta, descripcion) VALUES
  ('Mayor', 'Venta al por mayor (distribuidores, restaurantes, etc.)'),
  ('Menor', 'Venta al por menor (clientes individuales)')
ON DUPLICATE KEY UPDATE descripcion=VALUES(descripcion);

-- Poblar tipoPago si está vacío
INSERT INTO tipoPago (nombrePago) VALUES
  ('Contado'),
  ('Crédito'),
  ('Tarjeta de Crédito'),
  ('Tarjeta de Débito'),
  ('Transferencia Bancaria'),
  ('Cheque')
ON DUPLICATE KEY UPDATE nombrePago=nombrePago;


-- ============================================================================
-- SECCIÓN 2: MÓDULO DE PROVEEDORES
-- ============================================================================

-- Tabla: proveedor_O
CREATE TABLE IF NOT EXISTS proveedor_O (
  idProveedor INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  idPersona INT,                                      -- FK a persona_O (proveedor particular)
  idEmpresaProveedor INT,                             -- FK a empresa_O (proveedor empresa)
  nombreComercial VARCHAR(100),
  contacto VARCHAR(100),
  telefono VARCHAR(15),
  email VARCHAR(100),
  direccion VARCHAR(255),
  esEmpresa TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1=empresa, 0=persona',
  estado TINYINT(1) NOT NULL DEFAULT 1,
  observaciones TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_proveedor_persona FOREIGN KEY (idPersona) REFERENCES persona_O(id_persona),
  CONSTRAINT fk_proveedor_empresa FOREIGN KEY (idEmpresaProveedor) REFERENCES empresa_O(id_empresa),
  CONSTRAINT chk_proveedor_tipo CHECK (
    (esEmpresa = 1 AND idEmpresaProveedor IS NOT NULL AND idPersona IS NULL) OR
    (esEmpresa = 0 AND idPersona IS NOT NULL AND idEmpresaProveedor IS NULL)
  ),
  INDEX idx_proveedor_empresa (idEmpresaProveedor),
  INDEX idx_proveedor_persona (idPersona),
  INDEX idx_proveedor_estado (estado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Proveedores: empresas o personas particulares';


-- ============================================================================
-- SECCIÓN 3: MÓDULO DE VENTAS
-- ============================================================================

-- Tabla: venta_O (cabecera de venta)
CREATE TABLE IF NOT EXISTS venta_O (
  idVenta INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  numeroVenta VARCHAR(20) NOT NULL UNIQUE,
  fechaVenta DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  idCliente INT NOT NULL,                             -- FK a persona_O
  idEmpresa INT NOT NULL,                             -- FK a empresa_O (scoping)
  idTipoVenta INT NOT NULL,                           -- FK a tipoVenta
  idTipoPago INT NOT NULL,                            -- FK a tipoPago
  montoTotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  montoPagado DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  saldo DECIMAL(10,2) GENERATED ALWAYS AS (montoTotal - montoPagado) STORED,
  estado TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=activa, 0=anulada',
  observaciones TEXT,
  idUsuario INT,                                       -- FK a user_O (vendedor)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_venta_cliente FOREIGN KEY (idCliente) REFERENCES persona_O(id_persona),
  CONSTRAINT fk_venta_empresa FOREIGN KEY (idEmpresa) REFERENCES empresa_O(id_empresa),
  CONSTRAINT fk_venta_tipoventa FOREIGN KEY (idTipoVenta) REFERENCES tipoVenta(idTipoVenta),
  CONSTRAINT fk_venta_tipopago FOREIGN KEY (idTipoPago) REFERENCES tipoPago(idPago),
  CONSTRAINT fk_venta_usuario FOREIGN KEY (idUsuario) REFERENCES user_O(id_user),
  INDEX idx_venta_fecha_empresa (fechaVenta, idEmpresa),
  INDEX idx_venta_cliente (idCliente),
  INDEX idx_venta_saldo (saldo),
  INDEX idx_venta_numero (numeroVenta)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Ventas (cabecera): mayor/menor, contado/crédito';

-- Tabla: detalle_venta_O (detalle de venta)
CREATE TABLE IF NOT EXISTS detalle_venta_O (
  idDetalleVenta INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  idVenta INT NOT NULL,                               -- FK a venta_O
  idProducto INT NOT NULL,                            -- FK a producto_O
  cantidad INT NOT NULL CHECK (cantidad > 0),
  precioUnitario DECIMAL(10,2) NOT NULL CHECK (precioUnitario >= 0),
  subtotal DECIMAL(10,2) GENERATED ALWAYS AS (cantidad * precioUnitario) STORED,
  CONSTRAINT fk_detalle_venta FOREIGN KEY (idVenta) REFERENCES venta_O(idVenta) ON DELETE CASCADE,
  CONSTRAINT fk_detalle_producto FOREIGN KEY (idProducto) REFERENCES producto_O(idProducto),
  INDEX idx_detalle_venta (idVenta),
  INDEX idx_detalle_producto (idProducto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Detalle de ventas (líneas de venta)';


-- ============================================================================
-- SECCIÓN 4: MÓDULO DE COMPRAS
-- ============================================================================

-- Tabla: compra_O (cabecera de compra)
CREATE TABLE IF NOT EXISTS compra_O (
  idCompra INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  numeroCompra VARCHAR(20) NOT NULL UNIQUE,
  fechaCompra DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  idProveedor INT NOT NULL,                           -- FK a proveedor_O
  idEmpresa INT NOT NULL,                             -- FK a empresa_O (scoping)
  idTipoPago INT NOT NULL,                            -- FK a tipoPago
  montoTotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  montoPagado DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  saldo DECIMAL(10,2) GENERATED ALWAYS AS (montoTotal - montoPagado) STORED,
  estado TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=activa, 0=anulada',
  observaciones TEXT,
  idUsuario INT,                                       -- FK a user_O
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_compra_proveedor FOREIGN KEY (idProveedor) REFERENCES proveedor_O(idProveedor),
  CONSTRAINT fk_compra_empresa FOREIGN KEY (idEmpresa) REFERENCES empresa_O(id_empresa),
  CONSTRAINT fk_compra_tipopago FOREIGN KEY (idTipoPago) REFERENCES tipoPago(idPago),
  CONSTRAINT fk_compra_usuario FOREIGN KEY (idUsuario) REFERENCES user_O(id_user),
  INDEX idx_compra_fecha_empresa (fechaCompra, idEmpresa),
  INDEX idx_compra_proveedor (idProveedor),
  INDEX idx_compra_saldo (saldo),
  INDEX idx_compra_numero (numeroCompra)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Compras (cabecera)';

-- Tabla: detalle_compra_O (detalle de compra)
CREATE TABLE IF NOT EXISTS detalle_compra_O (
  idDetalleCompra INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  idCompra INT NOT NULL,                              -- FK a compra_O
  idProducto INT NOT NULL,                            -- FK a producto_O
  cantidad INT NOT NULL CHECK (cantidad > 0),
  costoUnitario DECIMAL(10,2) NOT NULL CHECK (costoUnitario >= 0),
  subtotal DECIMAL(10,2) GENERATED ALWAYS AS (cantidad * costoUnitario) STORED,
  CONSTRAINT fk_detalle_compra FOREIGN KEY (idCompra) REFERENCES compra_O(idCompra) ON DELETE CASCADE,
  CONSTRAINT fk_detalle_compra_producto FOREIGN KEY (idProducto) REFERENCES producto_O(idProducto),
  INDEX idx_detalle_compra (idCompra),
  INDEX idx_detalle_compra_producto (idProducto)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Detalle de compras (líneas de compra)';


-- ============================================================================
-- SECCIÓN 5: MÓDULO DE PAGOS Y CUENTAS CORRIENTES
-- ============================================================================

-- Tabla: pago_O (pagos de clientes y a proveedores)
CREATE TABLE IF NOT EXISTS pago_O (
  idPago INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  numeroPago VARCHAR(20) NOT NULL UNIQUE,
  fechaPago DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tipo ENUM('cobro', 'pago') NOT NULL COMMENT 'cobro=cliente paga, pago=empresa paga a proveedor',
  idPersona INT,                                      -- FK a persona_O (si es cobro)
  idProveedor INT,                                    -- FK a proveedor_O (si es pago)
  idEmpresa INT NOT NULL,                             -- FK a empresa_O
  monto DECIMAL(10,2) NOT NULL CHECK (monto > 0),
  idTipoPago INT NOT NULL,                            -- FK a tipoPago
  numeroReferencia VARCHAR(50) COMMENT 'Nro. de transacción/cheque',
  observaciones TEXT,
  idUsuario INT,                                       -- FK a user_O
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pago_persona FOREIGN KEY (idPersona) REFERENCES persona_O(id_persona),
  CONSTRAINT fk_pago_proveedor FOREIGN KEY (idProveedor) REFERENCES proveedor_O(idProveedor),
  CONSTRAINT fk_pago_empresa FOREIGN KEY (idEmpresa) REFERENCES empresa_O(id_empresa),
  CONSTRAINT fk_pago_tipopago FOREIGN KEY (idTipoPago) REFERENCES tipoPago(idPago),
  CONSTRAINT fk_pago_usuario FOREIGN KEY (idUsuario) REFERENCES user_O(id_user),
  CONSTRAINT chk_pago_tipo CHECK (
    (tipo = 'cobro' AND idPersona IS NOT NULL AND idProveedor IS NULL) OR
    (tipo = 'pago' AND idProveedor IS NOT NULL AND idPersona IS NULL)
  ),
  INDEX idx_pago_fecha_empresa (fechaPago, idEmpresa),
  INDEX idx_pago_persona (idPersona),
  INDEX idx_pago_proveedor (idProveedor),
  INDEX idx_pago_numero (numeroPago)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Pagos (cobros de clientes / pagos a proveedores)';

-- Tabla: cuenta_corriente_O (movimientos de cuenta corriente)
CREATE TABLE IF NOT EXISTS cuenta_corriente_O (
  idCuentaCorriente INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  tipo ENUM('cliente', 'proveedor') NOT NULL,
  idPersona INT,                                      -- FK a persona_O (cliente)
  idProveedor INT,                                    -- FK a proveedor_O
  idEmpresa INT NOT NULL,                             -- FK a empresa_O (scoping)
  fechaMovimiento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tipoMovimiento ENUM('venta', 'compra', 'pago', 'cobro', 'ajuste') NOT NULL,
  idReferencia INT COMMENT 'ID de venta_O, compra_O, pago_O según tipo',
  debe DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Monto a favor del cliente/proveedor',
  haber DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Monto a favor de la empresa',
  saldo DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT 'Saldo acumulado',
  descripcion VARCHAR(255),
  estado TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ctacte_persona FOREIGN KEY (idPersona) REFERENCES persona_O(id_persona),
  CONSTRAINT fk_ctacte_proveedor FOREIGN KEY (idProveedor) REFERENCES proveedor_O(idProveedor),
  CONSTRAINT fk_ctacte_empresa FOREIGN KEY (idEmpresa) REFERENCES empresa_O(id_empresa),
  CONSTRAINT chk_ctacte_tipo CHECK (
    (tipo = 'cliente' AND idPersona IS NOT NULL AND idProveedor IS NULL) OR
    (tipo = 'proveedor' AND idProveedor IS NOT NULL AND idPersona IS NULL)
  ),
  INDEX idx_ctacte_persona (idPersona, fechaMovimiento),
  INDEX idx_ctacte_proveedor (idProveedor, fechaMovimiento),
  INDEX idx_ctacte_empresa (idEmpresa, tipo),
  INDEX idx_ctacte_fecha (fechaMovimiento)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Cuenta corriente (movimientos de clientes y proveedores)';


-- ============================================================================
-- SECCIÓN 6: MEJORAS EN PRÉSTAMOS DE ENVASES
-- ============================================================================

-- Agregar campos para préstamos retornables con garantía (con verificación)
SET @col_exists_esRetornable = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'SystemaOllantay' AND TABLE_NAME = 'prestamo_O' AND COLUMN_NAME = 'esRetornable');
SET @sql = IF(@col_exists_esRetornable = 0, 
  'ALTER TABLE prestamo_O ADD COLUMN esRetornable TINYINT(1) NOT NULL DEFAULT 1 COMMENT ''1=retornable, 0=no retornable'' AFTER idProducto',
  'SELECT "Columna esRetornable ya existe" AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists_montoGarantia = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'SystemaOllantay' AND TABLE_NAME = 'prestamo_O' AND COLUMN_NAME = 'montoGarantia');
SET @sql = IF(@col_exists_montoGarantia = 0, 
  'ALTER TABLE prestamo_O ADD COLUMN montoGarantia DECIMAL(10,2) DEFAULT 0.00 COMMENT ''Monto cobrado como garantía'' AFTER esRetornable',
  'SELECT "Columna montoGarantia ya existe" AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists_garantiaPagada = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'SystemaOllantay' AND TABLE_NAME = 'prestamo_O' AND COLUMN_NAME = 'garantiaPagada');
SET @sql = IF(@col_exists_garantiaPagada = 0, 
  'ALTER TABLE prestamo_O ADD COLUMN garantiaPagada TINYINT(1) DEFAULT 0 COMMENT ''1=pagó garantía, 0=sin garantía'' AFTER montoGarantia',
  'SELECT "Columna garantiaPagada ya existe" AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @col_exists_idEmpresa = (SELECT COUNT(*) FROM information_schema.COLUMNS 
  WHERE TABLE_SCHEMA = 'SystemaOllantay' AND TABLE_NAME = 'prestamo_O' AND COLUMN_NAME = 'idEmpresa');
SET @sql = IF(@col_exists_idEmpresa = 0, 
  'ALTER TABLE prestamo_O ADD COLUMN idEmpresa INT COMMENT ''Empresa del préstamo para scoping directo'' AFTER garantiaPagada',
  'SELECT "Columna idEmpresa ya existe" AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Agregar FK si no existe
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS 
  WHERE CONSTRAINT_NAME = 'fk_prestamo_empresa' AND TABLE_SCHEMA = 'SystemaOllantay' AND TABLE_NAME = 'prestamo_O');
SET @sql = IF(@fk_exists = 0, 
  'ALTER TABLE prestamo_O ADD CONSTRAINT fk_prestamo_empresa FOREIGN KEY (idEmpresa) REFERENCES empresa_O(id_empresa)',
  'SELECT "FK fk_prestamo_empresa ya existe" AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Agregar índice si no existe
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS 
  WHERE TABLE_SCHEMA = 'SystemaOllantay' AND TABLE_NAME = 'prestamo_O' AND INDEX_NAME = 'idx_prestamo_empresa_estado');
SET @sql = IF(@idx_exists = 0, 
  'ALTER TABLE prestamo_O ADD INDEX idx_prestamo_empresa_estado (idEmpresa, estado_prestamo)',
  'SELECT "Índice idx_prestamo_empresa_estado ya existe" AS info');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;


-- ============================================================================
-- SECCIÓN 7: PERMISOS RBAC PARA NUEVOS MÓDULOS
-- ============================================================================

-- Insertar permisos para ventas
INSERT INTO permission_O (resource, action, description) VALUES
  ('ventas', 'view', 'Ver módulo Ventas'),
  ('ventas', 'create', 'Crear ventas'),
  ('ventas', 'update', 'Actualizar ventas'),
  ('ventas', 'delete', 'Anular ventas')
ON DUPLICATE KEY UPDATE description=VALUES(description);

-- Insertar permisos para compras
INSERT INTO permission_O (resource, action, description) VALUES
  ('compras', 'view', 'Ver módulo Compras'),
  ('compras', 'create', 'Crear compras'),
  ('compras', 'update', 'Actualizar compras'),
  ('compras', 'delete', 'Anular compras')
ON DUPLICATE KEY UPDATE description=VALUES(description);

-- Insertar permisos para proveedores
INSERT INTO permission_O (resource, action, description) VALUES
  ('proveedores', 'view', 'Ver proveedores'),
  ('proveedores', 'manage', 'CRUD proveedores')
ON DUPLICATE KEY UPDATE description=VALUES(description);

-- Insertar permisos para cuentas corrientes
INSERT INTO permission_O (resource, action, description) VALUES
  ('cuentas', 'view', 'Ver cuentas corrientes'),
  ('pagos', 'create', 'Registrar pagos/cobros')
ON DUPLICATE KEY UPDATE description=VALUES(description);

-- Insertar permisos para inventario
INSERT INTO permission_O (resource, action, description) VALUES
  ('inventario', 'view', 'Ver movimientos de inventario')
ON DUPLICATE KEY UPDATE description=VALUES(description);


-- ============================================================================
-- SECCIÓN 8: MAPEO DE PERMISOS A ROLES
-- ============================================================================

-- Obtener IDs de permisos nuevos
SET @perm_ventas_view = (SELECT id_perm FROM permission_O WHERE resource='ventas' AND action='view');
SET @perm_ventas_create = (SELECT id_perm FROM permission_O WHERE resource='ventas' AND action='create');
SET @perm_ventas_update = (SELECT id_perm FROM permission_O WHERE resource='ventas' AND action='update');
SET @perm_ventas_delete = (SELECT id_perm FROM permission_O WHERE resource='ventas' AND action='delete');

SET @perm_compras_view = (SELECT id_perm FROM permission_O WHERE resource='compras' AND action='view');
SET @perm_compras_create = (SELECT id_perm FROM permission_O WHERE resource='compras' AND action='create');
SET @perm_compras_update = (SELECT id_perm FROM permission_O WHERE resource='compras' AND action='update');
SET @perm_compras_delete = (SELECT id_perm FROM permission_O WHERE resource='compras' AND action='delete');

SET @perm_proveedores_view = (SELECT id_perm FROM permission_O WHERE resource='proveedores' AND action='view');
SET @perm_proveedores_manage = (SELECT id_perm FROM permission_O WHERE resource='proveedores' AND action='manage');

SET @perm_cuentas_view = (SELECT id_perm FROM permission_O WHERE resource='cuentas' AND action='view');
SET @perm_pagos_create = (SELECT id_perm FROM permission_O WHERE resource='pagos' AND action='create');

SET @perm_inventario_view = (SELECT id_perm FROM permission_O WHERE resource='inventario' AND action='view');

-- Obtener IDs de roles
SET @role_admin = (SELECT idrole FROM role_O WHERE name='admin');
SET @role_superadmin = (SELECT idrole FROM role_O WHERE name='superadmin');
SET @role_viewer = (SELECT idrole FROM role_O WHERE name='viewer');

-- Mapear permisos de ventas a admin y superadmin
INSERT INTO role_permission_O (role_id, perm_id) VALUES
  (@role_admin, @perm_ventas_view),
  (@role_admin, @perm_ventas_create),
  (@role_admin, @perm_ventas_update),
  (@role_admin, @perm_ventas_delete),
  (@role_superadmin, @perm_ventas_view),
  (@role_superadmin, @perm_ventas_create),
  (@role_superadmin, @perm_ventas_update),
  (@role_superadmin, @perm_ventas_delete),
  (@role_viewer, @perm_ventas_view)
ON DUPLICATE KEY UPDATE role_id=role_id;

-- Mapear permisos de compras a admin y superadmin
INSERT INTO role_permission_O (role_id, perm_id) VALUES
  (@role_admin, @perm_compras_view),
  (@role_admin, @perm_compras_create),
  (@role_admin, @perm_compras_update),
  (@role_admin, @perm_compras_delete),
  (@role_superadmin, @perm_compras_view),
  (@role_superadmin, @perm_compras_create),
  (@role_superadmin, @perm_compras_update),
  (@role_superadmin, @perm_compras_delete),
  (@role_viewer, @perm_compras_view)
ON DUPLICATE KEY UPDATE role_id=role_id;

-- Mapear permisos de proveedores a admin y superadmin
INSERT INTO role_permission_O (role_id, perm_id) VALUES
  (@role_admin, @perm_proveedores_view),
  (@role_admin, @perm_proveedores_manage),
  (@role_superadmin, @perm_proveedores_view),
  (@role_superadmin, @perm_proveedores_manage),
  (@role_viewer, @perm_proveedores_view)
ON DUPLICATE KEY UPDATE role_id=role_id;

-- Mapear permisos de cuentas y pagos a admin y superadmin
INSERT INTO role_permission_O (role_id, perm_id) VALUES
  (@role_admin, @perm_cuentas_view),
  (@role_admin, @perm_pagos_create),
  (@role_superadmin, @perm_cuentas_view),
  (@role_superadmin, @perm_pagos_create),
  (@role_viewer, @perm_cuentas_view)
ON DUPLICATE KEY UPDATE role_id=role_id;

-- Mapear permisos de inventario a admin y superadmin
INSERT INTO role_permission_O (role_id, perm_id) VALUES
  (@role_admin, @perm_inventario_view),
  (@role_superadmin, @perm_inventario_view),
  (@role_viewer, @perm_inventario_view)
ON DUPLICATE KEY UPDATE role_id=role_id;


-- ============================================================================
-- FIN DE LA MIGRACIÓN
-- ============================================================================

-- Verificar tablas creadas
SELECT 
  TABLE_NAME, 
  TABLE_ROWS, 
  CREATE_TIME 
FROM information_schema.TABLES 
WHERE TABLE_SCHEMA = 'SystemaOllantay' 
  AND TABLE_NAME IN (
    'tipoVenta', 'venta_O', 'detalle_venta_O',
    'proveedor_O', 'compra_O', 'detalle_compra_O',
    'pago_O', 'cuenta_corriente_O'
  )
ORDER BY TABLE_NAME;

-- Verificar permisos creados
SELECT id_perm, resource, action, description 
FROM permission_O 
WHERE resource IN ('ventas', 'compras', 'proveedores', 'cuentas', 'pagos', 'inventario')
ORDER BY resource, action;
