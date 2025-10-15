-- roles.sql
-- Run this against the SystemaOllantay database to add basic role/user tables.

CREATE TABLE IF NOT EXISTS role_O (
  idrole INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS user_O (
  id_user INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,
  id_role INT NOT NULL,
  id_persona INT NULL,
  FOREIGN KEY (id_role) REFERENCES role_O(idrole),
  FOREIGN KEY (id_persona) REFERENCES persona_O(id_persona)
);

-- seed basic roles
INSERT IGNORE INTO role_O (idrole, name, description) VALUES
(1, 'admin', 'Full access'),
(2, 'editor', 'Can create and update but not delete'),
(3, 'viewer', 'Read-only');

-- seed an admin persona (only if a persona with CI '00000000' doesn't exist)
INSERT INTO persona_O (nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci_persona, direccion_persona)
SELECT 'Administrador', '', '', NULL, 1, '00000000', 'Cuenta administrativa'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM persona_O WHERE ci_persona = '00000000');

-- seed an admin user linked to the persona above (username 'admin')
INSERT INTO user_O (username, password_hash, id_role, id_persona)
SELECT 'admin', NULL, (SELECT idrole FROM role_O WHERE name='admin'), (SELECT id_persona FROM persona_O WHERE ci_persona = '00000000')
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM user_O WHERE username = 'admin');
