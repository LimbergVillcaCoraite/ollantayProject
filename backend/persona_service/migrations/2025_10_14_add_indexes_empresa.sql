-- Migration: Add indexes for empresa_O to speed up searches
-- Run this in your MySQL environment if desired.

ALTER TABLE empresa_O
  ADD INDEX idx_empresa_persona (id_persona),
  ADD INDEX idx_empresa_nombre_direccion (nombre_empresa(50), direccion_empresa(50));

-- If you have many text searches consider FULLTEXT (MySQL InnoDB fulltext) on columnas relevantes:
-- ALTER TABLE empresa_O ADD FULLTEXT ft_empresa_nombre_direccion (nombre_empresa, direccion_empresa);

-- Note: FULLTEXT is great for relevancy search but changes query syntax (MATCH...AGAINST).
