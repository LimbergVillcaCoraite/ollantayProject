-- Migration: Create compra_comprobante_O table
-- Created: 2025-10-29
-- Purpose: Store purchase receipt/invoice attachments

CREATE TABLE IF NOT EXISTS compra_comprobante_O (
    idComprobante INT AUTO_INCREMENT PRIMARY KEY,
    idCompra INT NOT NULL,
    rutaArchivo VARCHAR(500) NOT NULL,
    nombreArchivo VARCHAR(255) NOT NULL,
    mimeType VARCHAR(100) DEFAULT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (idCompra) REFERENCES compra_O(idCompra) ON DELETE CASCADE,
    INDEX idx_comprobante_compra (idCompra)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Purchase receipts and invoices';
