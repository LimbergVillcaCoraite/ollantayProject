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

-- permissions table (resource/action pairs)
CREATE TABLE IF NOT EXISTS permission_O (
  id_perm INT AUTO_INCREMENT PRIMARY KEY,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(20) NOT NULL,
  description VARCHAR(255),
  UNIQUE(resource, action)
);

-- role to permission mapping
CREATE TABLE IF NOT EXISTS role_permission_O (
  role_id INT NOT NULL,
  perm_id INT NOT NULL,
  PRIMARY KEY (role_id, perm_id),
  FOREIGN KEY (role_id) REFERENCES role_O(idrole) ON DELETE CASCADE,
  FOREIGN KEY (perm_id) REFERENCES permission_O(id_perm) ON DELETE CASCADE
);

-- seed basic roles
INSERT IGNORE INTO role_O (idrole, name, description) VALUES
(1, 'admin', 'Full access'),
(2, 'editor', 'Can create and update but not delete'),
(3, 'viewer', 'Read-only');

-- seed permissions (modules + CRUD)
INSERT IGNORE INTO permission_O (id_perm, resource, action, description) VALUES
  (1, 'tipos', 'view', 'Ver módulo Tipos'),
  (2, 'tipos', 'create', 'Crear tipos'),
  (3, 'tipos', 'update', 'Actualizar tipos'),
  (4, 'tipos', 'delete', 'Eliminar tipos'),
  (5, 'personas', 'view', 'Ver módulo Personas'),
  (6, 'personas', 'create', 'Crear personas'),
  (7, 'personas', 'update', 'Actualizar personas'),
  (8, 'personas', 'delete', 'Eliminar personas'),
  (9, 'empresas', 'view', 'Ver módulo Empresas'),
  (10,'empresas', 'create', 'Crear empresas'),
  (11,'empresas', 'update', 'Actualizar empresas'),
  (12,'empresas', 'delete', 'Eliminar empresas'),
  (13,'prestamos','view', 'Ver módulo Préstamos'),
  (14,'prestamos','create','Crear préstamos'),
  (15,'prestamos','update','Actualizar préstamos'),
  (16,'prestamos','delete','Eliminar préstamos'),
  (17,'roles',   'manage','Administrar roles y permisos');

-- grant default permissions
-- admin: all
INSERT IGNORE INTO role_permission_O (role_id, perm_id)
SELECT r.idrole, p.id_perm FROM role_O r CROSS JOIN permission_O p WHERE r.name = 'admin';

-- editor: view all + create/update, no delete, no manage roles
INSERT IGNORE INTO role_permission_O (role_id, perm_id)
SELECT r.idrole, p.id_perm
FROM role_O r
JOIN permission_O p ON (
  (p.action IN ('view','create','update') AND p.resource IN ('tipos','personas','empresas','prestamos'))
)
WHERE r.name = 'editor';

-- viewer: view only
INSERT IGNORE INTO role_permission_O (role_id, perm_id)
SELECT r.idrole, p.id_perm
FROM role_O r
JOIN permission_O p ON (p.action = 'view' AND p.resource IN ('tipos','personas','empresas','prestamos'))
WHERE r.name = 'viewer';

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
