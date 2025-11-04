-- Migration: Sistema de entregas por ruta
-- Date: 2025-11-03
-- Description: Tablas para control de entregas a rutas con inventario y devoluciones

-- Tabla principal de entregas (manifiestos)
CREATE TABLE IF NOT EXISTS entrega_ruta_O (
    idEntrega INT AUTO_INCREMENT PRIMARY KEY,
    numeroEntrega VARCHAR(50) UNIQUE NOT NULL,
    idRuta INT NOT NULL,
    idEmpresa INT NOT NULL,
    idEncargado INT NOT NULL COMMENT 'id_persona del chofer/encargado',
    fechaSalida DATE NOT NULL,
    fechaRetorno DATE NULL,
    estado ENUM('pendiente', 'en_ruta', 'finalizado', 'cancelado') DEFAULT 'pendiente',
    observaciones TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_entrega_ruta (idRuta),
    INDEX idx_entrega_empresa (idEmpresa),
    INDEX idx_entrega_encargado (idEncargado),
    INDEX idx_entrega_estado (estado),
    FOREIGN KEY (idRuta) REFERENCES ruta_O(idRuta) ON DELETE RESTRICT,
    FOREIGN KEY (idEmpresa) REFERENCES empresa_O(id_empresa) ON DELETE RESTRICT,
    FOREIGN KEY (idEncargado) REFERENCES persona_O(id_persona) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Detalle de productos enviados en la entrega
CREATE TABLE IF NOT EXISTS entrega_ruta_detalle_O (
    idDetalle INT AUTO_INCREMENT PRIMARY KEY,
    idEntrega INT NOT NULL,
    idProducto INT NOT NULL,
    idLote INT NULL COMMENT 'Lote específico del que se sacaron los productos',
    cantidadEnviada DECIMAL(10,2) NOT NULL,
    cantidadDevuelta DECIMAL(10,2) DEFAULT 0,
    cantidadVendida DECIMAL(10,2) AS (cantidadEnviada - cantidadDevuelta) STORED,
    precioUnitario DECIMAL(10,2) NOT NULL COMMENT 'Precio según ruta al momento del envío',
    montoTotal DECIMAL(12,2) AS (cantidadVendida * precioUnitario) STORED,
    observaciones TEXT NULL,
    INDEX idx_detalle_entrega (idEntrega),
    INDEX idx_detalle_producto (idProducto),
    INDEX idx_detalle_lote (idLote),
    FOREIGN KEY (idEntrega) REFERENCES entrega_ruta_O(idEntrega) ON DELETE CASCADE,
    FOREIGN KEY (idProducto) REFERENCES producto_O(idProducto) ON DELETE RESTRICT,
    FOREIGN KEY (idLote) REFERENCES lote_producto(idLote) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabla de ventas generadas desde entregas (referencia)
-- Esto vincula ventas con entregas específicas para trazabilidad
CREATE TABLE IF NOT EXISTS entrega_venta_vinculo_O (
    id INT AUTO_INCREMENT PRIMARY KEY,
    idEntrega INT NOT NULL,
    idVenta INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_vinculo_entrega (idEntrega),
    INDEX idx_vinculo_venta (idVenta),
    UNIQUE KEY uk_entrega_venta (idEntrega, idVenta),
    FOREIGN KEY (idEntrega) REFERENCES entrega_ruta_O(idEntrega) ON DELETE CASCADE,
    FOREIGN KEY (idVenta) REFERENCES venta_O(idVenta) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Índices adicionales para reportes y búsquedas
CREATE INDEX idx_entrega_fechas ON entrega_ruta_O(fechaSalida, fechaRetorno);
CREATE INDEX idx_detalle_cantidades ON entrega_ruta_detalle_O(cantidadEnviada, cantidadDevuelta);
