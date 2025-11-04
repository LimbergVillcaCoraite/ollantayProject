-- Core schema updates for multi-empresa RBAC, compras, lotes, rutas y entregas
-- Safe to run multiple times on MySQL 8.0+

-- 1) compras: permitir números más largos
ALTER TABLE compra_O
  MODIFY COLUMN numeroCompra VARCHAR(64) NOT NULL;

-- 2) detalle_compra_O: nuevas columnas compatibles con la app actual
ALTER TABLE detalle_compra_O
  ADD COLUMN IF NOT EXISTS cantidad_caja INT NULL AFTER idProducto,
  ADD COLUMN IF NOT EXISTS precio_unitario DECIMAL(10,2) NULL AFTER cantidad_caja,
  ADD COLUMN IF NOT EXISTS precio_paquete DECIMAL(10,2) NULL AFTER precio_unitario,
  ADD COLUMN IF NOT EXISTS botellas_por_caja INT NULL AFTER precio_paquete,
  ADD COLUMN IF NOT EXISTS precio_por_botella DECIMAL(10,4) NULL AFTER botellas_por_caja,
  ADD COLUMN IF NOT EXISTS fechaVencimiento DATE NULL AFTER precio_por_botella;

-- Asegurar subtotal basado en nuevas/anteriores columnas (si existe, se actualiza)
ALTER TABLE detalle_compra_O
  MODIFY COLUMN subtotal DECIMAL(10,2)
  GENERATED ALWAYS AS ((COALESCE(cantidad_caja, cantidad) * COALESCE(precio_unitario, costoUnitario))) STORED;

-- 3) Tabla de lotes de productos (usada para FEFO y entregas)
CREATE TABLE IF NOT EXISTS lote_producto (
  idLote INT NOT NULL AUTO_INCREMENT,
  idProducto INT NOT NULL,
  idProveedor INT NULL,
  fechaCompra DATE NULL,
  fechaVencimiento DATE NULL,
  precioCompra DECIMAL(10,2) NULL,
  cantidadCajas INT NULL,
  stockActual DECIMAL(10,2) NULL DEFAULT 0,
  codigoLote VARCHAR(50) NULL,
  idEmpresa INT NULL,
  idUsuarioCreador INT NULL,
  idCompra INT NULL,
  botellasPorCaja INT NULL,
  PRIMARY KEY (idLote),
  KEY idx_lote_producto (idProducto, idEmpresa),
  CONSTRAINT fk_lote_producto_producto FOREIGN KEY (idProducto) REFERENCES producto_O (idProducto),
  CONSTRAINT fk_lote_producto_proveedor FOREIGN KEY (idProveedor) REFERENCES proveedor_O (idProveedor),
  CONSTRAINT fk_lote_producto_empresa FOREIGN KEY (idEmpresa) REFERENCES empresa_O (id_empresa),
  CONSTRAINT fk_lote_producto_compra FOREIGN KEY (idCompra) REFERENCES compra_O (idCompra) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4) Rutas y precios por ruta
CREATE TABLE IF NOT EXISTS ruta_O (
  idRuta INT NOT NULL AUTO_INCREMENT,
  nombreRuta VARCHAR(100) NOT NULL,
  descripcion TEXT NULL,
  incremento_general DECIMAL(10,2) NOT NULL DEFAULT 0,
  idEmpresa INT NOT NULL,
  PRIMARY KEY (idRuta),
  UNIQUE KEY uq_ruta_empresa_nombre (idEmpresa, nombreRuta),
  KEY idx_ruta_empresa (idEmpresa),
  CONSTRAINT fk_ruta_empresa FOREIGN KEY (idEmpresa) REFERENCES empresa_O (id_empresa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS ruta_precio (
  idRuta INT NOT NULL,
  idProducto INT NOT NULL,
  incremento_precio DECIMAL(10,2) NOT NULL DEFAULT 0,
  PRIMARY KEY (idRuta, idProducto),
  CONSTRAINT fk_ruta_precio_ruta FOREIGN KEY (idRuta) REFERENCES ruta_O (idRuta) ON DELETE CASCADE,
  CONSTRAINT fk_ruta_precio_producto FOREIGN KEY (idProducto) REFERENCES producto_O (idProducto) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5) Entregas por ruta
CREATE TABLE IF NOT EXISTS entrega_ruta_O (
  idEntrega INT NOT NULL AUTO_INCREMENT,
  numeroEntrega VARCHAR(30) NOT NULL,
  idRuta INT NOT NULL,
  idEmpresa INT NOT NULL,
  idEncargado INT NOT NULL,
  fechaSalida DATE NOT NULL,
  fechaRetorno DATE NULL,
  estado ENUM('pendiente','en_ruta','finalizado','cancelado') NOT NULL DEFAULT 'en_ruta',
  observaciones TEXT NULL,
  created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idEntrega),
  UNIQUE KEY uq_entrega_numero (numeroEntrega),
  KEY idx_entrega_empresa_fecha (idEmpresa, fechaSalida),
  CONSTRAINT fk_entrega_ruta FOREIGN KEY (idRuta) REFERENCES ruta_O (idRuta),
  CONSTRAINT fk_entrega_empresa FOREIGN KEY (idEmpresa) REFERENCES empresa_O (id_empresa),
  CONSTRAINT fk_entrega_encargado FOREIGN KEY (idEncargado) REFERENCES persona_O (id_persona)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS entrega_ruta_detalle_O (
  idDetalle INT NOT NULL AUTO_INCREMENT,
  idEntrega INT NOT NULL,
  idProducto INT NOT NULL,
  idLote INT NULL,
  cantidadEnviada DECIMAL(10,2) NOT NULL,
  cantidadDevuelta DECIMAL(10,2) NOT NULL DEFAULT 0,
  cantidadVendida DECIMAL(10,2) NOT NULL DEFAULT 0,
  precioUnitario DECIMAL(10,2) NOT NULL,
  montoTotal DECIMAL(10,2) GENERATED ALWAYS AS (cantidadVendida * precioUnitario) STORED,
  observaciones TEXT NULL,
  PRIMARY KEY (idDetalle),
  KEY idx_det_entrega (idEntrega),
  KEY idx_det_producto (idProducto),
  CONSTRAINT fk_det_entrega FOREIGN KEY (idEntrega) REFERENCES entrega_ruta_O (idEntrega) ON DELETE CASCADE,
  CONSTRAINT fk_det_producto FOREIGN KEY (idProducto) REFERENCES producto_O (idProducto),
  CONSTRAINT fk_det_lote FOREIGN KEY (idLote) REFERENCES lote_producto (idLote)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6) Persona: foto opcional, ruta asignada, tipo de cliente
ALTER TABLE persona_O
  MODIFY COLUMN fotoPersona VARCHAR(255) NULL,
  ADD COLUMN IF NOT EXISTS tipo_cliente VARCHAR(20) NULL DEFAULT 'minorista' AFTER id_empresa,
  ADD COLUMN IF NOT EXISTS idRuta INT NULL AFTER tipo_cliente,
  ADD KEY IF NOT EXISTS idx_persona_ruta (idRuta),
  ADD CONSTRAINT IF NOT EXISTS fk_persona_ruta FOREIGN KEY (idRuta) REFERENCES ruta_O (idRuta);

-- 7) Producto: precios base para integrarse con rutas
ALTER TABLE producto_O
  ADD COLUMN IF NOT EXISTS precioMinorista DECIMAL(10,2) NULL DEFAULT 0 AFTER nombreProducto,
  ADD COLUMN IF NOT EXISTS precioMayorista DECIMAL(10,2) NULL DEFAULT 0 AFTER precioMinorista;

-- 8) RBAC: permisos por empresa (global y por empresa)
-- Agregar scoping por empresa y normalizador para UNIQUE que trate NULL como -1
ALTER TABLE role_permission_O
  ADD COLUMN IF NOT EXISTS id_empresa INT NULL AFTER perm_id,
  ADD COLUMN IF NOT EXISTS id_empresa_norm INT GENERATED ALWAYS AS (IFNULL(id_empresa, -1)) STORED AFTER id_empresa;

-- Cambiar PK a un id autoincrement y evitar colisión por (role_id, perm_id)
ALTER TABLE role_permission_O
  DROP PRIMARY KEY,
  ADD COLUMN IF NOT EXISTS id INT NOT NULL AUTO_INCREMENT PRIMARY KEY FIRST;

-- Unicidad por (rol,permiso,empresa/null)
CREATE UNIQUE INDEX IF NOT EXISTS uq_role_perm_scope
  ON role_permission_O (role_id, perm_id, id_empresa_norm);
CREATE INDEX IF NOT EXISTS idx_role_perm_empresa
  ON role_permission_O (id_empresa);

-- 9) Caja/contabilidad: permitir tipo='caja' en cuenta_corriente
ALTER TABLE cuenta_corriente_O
  MODIFY COLUMN tipo ENUM('cliente','proveedor','caja') NOT NULL;

-- 10) Comprobantes de compras (archivos adjuntos)
CREATE TABLE IF NOT EXISTS compra_comprobante_O (
  idComprobante INT NOT NULL AUTO_INCREMENT,
  idCompra INT NOT NULL,
  rutaArchivo VARCHAR(255) NOT NULL,
  nombreArchivo VARCHAR(255) NULL,
  mimeType VARCHAR(100) NULL,
  uploaded_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idComprobante),
  KEY idx_compra_comprobante (idCompra),
  CONSTRAINT fk_comprobante_compra FOREIGN KEY (idCompra) REFERENCES compra_O (idCompra) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
