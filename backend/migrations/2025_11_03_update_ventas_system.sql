-- Migration: Update ventas system with new features
-- Date: 2025-11-03
-- Description: Add tipo_cliente to personas, update tipoVenta names, add metodo_pago and estado_pago to ventas, create entrega_venta table

USE SystemaOllantay;

-- 1. Update tipoVenta names
UPDATE tipoVenta SET nombreTipoVenta = 'Mayorista', descripcion = 'Venta al por mayor (distribuidores, restaurantes, etc.)' 
WHERE nombreTipoVenta = 'Mayor';

UPDATE tipoVenta SET nombreTipoVenta = 'Minorista', descripcion = 'Venta al por menor (clientes individuales)' 
WHERE nombreTipoVenta = 'Menor';

-- Add Especial type if it doesn't exist
INSERT IGNORE INTO tipoVenta (nombreTipoVenta, descripcion, estado) 
VALUES ('Especial', 'Venta a clientes especiales con precios personalizados', 1);

-- 2. Add metodo_pago and estado_pago to venta_O if they don't exist
ALTER TABLE venta_O 
ADD COLUMN IF NOT EXISTS metodo_pago ENUM('Contado', 'Credito', 'Transferencia') DEFAULT NULL COMMENT 'Método de pago actualizado después de la entrega',
ADD COLUMN IF NOT EXISTS estado_pago ENUM('Pagado', 'Pendiente', 'Parcial') DEFAULT 'Pendiente' COMMENT 'Estado de pago de la venta';

-- 3. Create entrega_venta table for delivery tracking
CREATE TABLE IF NOT EXISTS entrega_venta (
    id_entrega INT PRIMARY KEY AUTO_INCREMENT,
    idVenta INT NOT NULL,
    id_chofer INT NULL COMMENT 'ID de la persona que realiza la entrega (chofer/encargado)',
    productos_entregados JSON NULL COMMENT 'Array de {idProducto, cantidad_entregada, entregado: true/false}',
    fecha_entrega DATETIME NULL,
    estado_entrega ENUM('Pendiente', 'En_Proceso', 'Entregado', 'Parcial') DEFAULT 'Pendiente',
    observaciones TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (idVenta) REFERENCES venta_O(idVenta) ON DELETE CASCADE,
    FOREIGN KEY (id_chofer) REFERENCES persona_O(id_persona) ON DELETE SET NULL,
    INDEX idx_venta (idVenta),
    INDEX idx_chofer (id_chofer),
    INDEX idx_estado (estado_entrega)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Add configuration table for currency exchange rate
CREATE TABLE IF NOT EXISTS configuracion_O (
    id_config INT PRIMARY KEY AUTO_INCREMENT,
    clave VARCHAR(50) UNIQUE NOT NULL,
    valor VARCHAR(255) NOT NULL,
    descripcion TEXT NULL,
    id_empresa INT NULL COMMENT 'NULL = configuración global, valor específico = por empresa',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (id_empresa) REFERENCES empresa_O(id_empresa) ON DELETE CASCADE,
    INDEX idx_clave (clave),
    INDEX idx_empresa (id_empresa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default exchange rate (1 USD = 6.96 Bs as of Nov 2025)
INSERT IGNORE INTO configuracion_O (clave, valor, descripcion, id_empresa) 
VALUES ('tasa_cambio_usd', '6.96', 'Tasa de cambio USD a Bs (Bolivianos)', NULL);

-- 5. Verify persona_O already has tipo_cliente and idRuta (should already exist based on earlier checks)
-- ALTER TABLE persona_O 
-- ADD COLUMN IF NOT EXISTS tipo_cliente ENUM('minorista','mayorista','especial') DEFAULT 'minorista',
-- ADD COLUMN IF NOT EXISTS idRuta INT NULL,
-- ADD FOREIGN KEY IF NOT EXISTS (idRuta) REFERENCES ruta_O(idRuta) ON DELETE SET NULL;

COMMIT;
