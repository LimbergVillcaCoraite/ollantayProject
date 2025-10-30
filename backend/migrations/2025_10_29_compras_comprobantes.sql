-- Migration: add table for compra receipts (comprobantes)
-- Creates table to store file attachments for purchases

CREATE TABLE IF NOT EXISTS compra_comprobante_O (
  idComprobante INT AUTO_INCREMENT PRIMARY KEY,
  idCompra INT NOT NULL,
  rutaArchivo VARCHAR(255) NOT NULL,
  nombreArchivo VARCHAR(150) NOT NULL,
  mimeType VARCHAR(100) NOT NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_compra_comprobante_compra FOREIGN KEY (idCompra)
    REFERENCES compra_O(idCompra)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE INDEX idx_compra_comprobante_compra ON compra_comprobante_O(idCompra);
