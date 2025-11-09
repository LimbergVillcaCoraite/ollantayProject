# Sistema de Auto-Sincronización de Permisos

## 🎯 Propósito

Este sistema elimina la necesidad de actualizar manualmente la base de datos cuando se agregan nuevas interfaces o funcionalidades al sistema. Los permisos se sincronizan automáticamente desde el código fuente.

## ✨ Características

### 1. **Detección Automática de Páginas**
- El backend lee el mapeo de páginas definido en el código
- Identifica todos los permisos necesarios para cada página
- Compara con los permisos existentes en la base de datos

### 2. **Sincronización con Un Clic**
- Botón "🔄 Sincronizar Permisos" en la interfaz de administración
- Crea automáticamente permisos faltantes
- Genera permisos CRUD completos para cada recurso
- Muestra reporte de permisos creados

### 3. **Mapeo Centralizado**
- Todas las páginas están definidas en un solo lugar
- Evita inconsistencias entre frontend y backend
- Facilita el mantenimiento

## 📋 Endpoints Nuevos

### GET `/permissions/pages`
Devuelve todas las páginas disponibles con sus permisos correspondientes.

**Headers:**
```
X-User-Role: superadmin | admin
```

**Response:**
```json
{
  "pages": {
    "tipos": {
      "resource": "tipos",
      "action": "view",
      "description": "Ver tipos"
    },
    "personas": {
      "resource": "personas",
      "action": "view",
      "description": "Ver personas"
    },
    ...
  },
  "total": 19
}
```

### POST `/permissions/sync`
Sincroniza permisos: crea los que faltan en la base de datos.

**Headers:**
```
X-User-Role: superadmin | admin
Content-Type: application/json
```

**Response:**
```json
{
  "success": true,
  "created_from_pages": [
    {
      "page": "superadmin",
      "permission": "superadmin:access",
      "description": "Acceso SuperAdmin"
    }
  ],
  "created_crud": [
    {
      "permission": "rutas:update",
      "description": "Actualizar rutas"
    }
  ],
  "total_created": 9,
  "message": "Sincronizacion completada: 1 permisos de paginas + 8 permisos CRUD creados"
}
```

## 🚀 Cómo Usar

### Para Administradores

1. **Acceder a Roles y Permisos**
   - Iniciar sesión como admin o superadmin
   - Ir a "Roles y Permisos" en el menú lateral

2. **Sincronizar Permisos**
   - Hacer clic en el botón "🔄 Sincronizar Permisos"
   - El sistema creará automáticamente los permisos faltantes
   - Verá un mensaje con el número de permisos creados

3. **Asignar Permisos a Roles**
   - Los nuevos permisos aparecerán automáticamente en la interfaz
   - Asignarlos a los roles correspondientes

### Para Desarrolladores

#### Agregar una Nueva Página

1. **Crear el componente** en `frontend/src/components/`
   ```jsx
   // NuevaPagina.jsx
   export default function NuevaPagina() {
     return <div>Nueva funcionalidad</div>
   }
   ```

2. **Importar en App.jsx**
   ```jsx
   import NuevaPagina from './components/NuevaPagina'
   ```

3. **Agregar ruta en usePermissions.js**
   ```jsx
   const canViewPage = (viewName) => {
     const viewPermissions = {
       // ... permisos existentes ...
       'nuevapagina': has('nuevapagina', 'view'),
     }
     return viewPermissions[viewName] || false
   }
   ```

4. **Actualizar el mapeo en persona_service/main.py**
   ```python
   @app.get('/permissions/pages')
   def get_available_pages(...):
       page_permissions = {
           # ... páginas existentes ...
           'nuevapagina': {
               'resource': 'nuevapagina',
               'action': 'view',
               'description': 'Ver nueva pagina'
           }
       }
   ```

5. **Agregar botón en App.jsx**
   ```jsx
   {canViewPage('nuevapagina') && (
     <button onClick={() => changeView('nuevapagina')}>
       Nueva Página
     </button>
   )}
   ```

6. **Sincronizar permisos**
   - Hacer clic en "🔄 Sincronizar Permisos" en la UI
   - O ejecutar: `POST http://localhost:8002/permissions/sync`

¡Listo! La nueva página aparecerá automáticamente en la gestión de permisos.

## 🔧 Arquitectura

```
┌─────────────────┐
│   App.jsx       │  Define las rutas y componentes
│  (Frontend)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ usePermissions  │  Mapea páginas → permisos
│     .js         │  canViewPage('compras') → has('compras', 'view')
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ persona_service │  Endpoints de sincronización
│    main.py      │  GET /permissions/pages
│                 │  POST /permissions/sync
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   MySQL DB      │  Tablas: permission_O, role_permission_O
│  SystemaOllantay│
└─────────────────┘
```

## 📊 Páginas Soportadas

| Página | Recurso | Acción | Descripción |
|--------|---------|--------|-------------|
| tipos | tipos | view | Ver tipos |
| personas | personas | view | Ver personas |
| personas_mapa | personas | view | Ver personas en mapa |
| empresas | empresas | view | Ver empresas |
| prestamos | prestamos | view | Ver prestamos |
| productos | productos | view | Ver productos |
| caja | caja | view | Ver caja |
| ventas | ventas | view | Ver ventas |
| predicciones | ventas | view | Ver predicciones (IA) |
| creditos | ventas | view | Ver creditos (Admin) |
| misdeudas | none | none | Ver mis deudas (todos) |
| compras | compras | view | Ver compras |
| gastos | caja | view | Ver gastos |
| proveedores | proveedores | view | Ver proveedores |
| rutas | rutas | view | Ver rutas |
| cuentas | cuentas | view | Ver cuentas |
| usuarios | roles | manage | Administrar usuarios |
| roles | roles | manage | Administrar roles |
| superadmin | superadmin | access | Acceso SuperAdmin |

## 🔒 Permisos CRUD

Para cada recurso, el sistema crea automáticamente permisos CRUD:
- **view** - Ver/listar registros
- **create** - Crear nuevos registros
- **update** - Actualizar registros existentes
- **delete** - Eliminar registros

Recursos especiales:
- `superadmin` - Solo tiene permiso `access`
- `roles` - Solo tiene permiso `manage`

## ⚙️ Configuración

### Variables de Entorno

No se requiere configuración adicional. El sistema usa las variables existentes:
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_NAME` - Conexión a MySQL
- `ALLOW_ORIGIN_REGEX` - CORS para el API

### Base de Datos

Tablas necesarias (ya existentes):
```sql
-- Permisos disponibles
CREATE TABLE permission_O (
    id_perm INT PRIMARY KEY AUTO_INCREMENT,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,
    description VARCHAR(255),
    UNIQUE KEY unique_permission (resource, action)
);

-- Asignación de permisos a roles
CREATE TABLE role_permission_O (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_id INT NOT NULL,
    perm_id INT NOT NULL,
    id_empresa INT NULL,
    FOREIGN KEY (role_id) REFERENCES role_O(idrole),
    FOREIGN KEY (perm_id) REFERENCES permission_O(id_perm)
);
```

## 🐛 Solución de Problemas

### Los permisos no aparecen en la UI

1. Verificar que los servicios estén corriendo:
   ```powershell
   docker ps
   ```

2. Reiniciar persona_service:
   ```powershell
   docker-compose restart persona_service
   ```

3. Reiniciar frontend:
   ```powershell
   docker-compose restart frontend
   ```

4. Sincronizar permisos desde la UI o con curl:
   ```powershell
   Invoke-WebRequest -Uri "http://localhost:8002/permissions/sync" `
     -Method POST `
     -Headers @{"X-User-Role"="superadmin"; "Content-Type"="application/json"}
   ```

### Error 403 al sincronizar

- Verificar que el usuario tiene rol `admin` o `superadmin`
- Revisar el header `X-User-Role` en la petición

### Permisos duplicados

- El sistema usa `INSERT IGNORE` para evitar duplicados
- Los permisos existentes no se sobrescriben

## 📈 Mantenimiento

### Agregar nuevas acciones CRUD

Editar `persona_service/main.py`, función `sync_permissions`:

```python
crud_actions = ['view', 'create', 'update', 'delete', 'export', 'import']
```

### Cambiar descripciones de permisos

1. Actualizar el mapeo en `get_available_pages()`
2. Ejecutar sincronización (actualizará las descripciones)

### Auditoría de permisos

```sql
-- Ver todos los permisos
SELECT resource, action, description 
FROM permission_O 
ORDER BY resource, action;

-- Ver permisos por rol
SELECT r.name, p.resource, p.action, p.description
FROM role_O r
JOIN role_permission_O rp ON r.idrole = rp.role_id
JOIN permission_O p ON rp.perm_id = p.id_perm
ORDER BY r.name, p.resource, p.action;
```

## 🎉 Beneficios

✅ **Sin edición manual de SQL** - Los permisos se crean automáticamente
✅ **Código como fuente de verdad** - El mapeo está en el código, no en la BD
✅ **Sincronización en un clic** - Interfaz amigable para administradores
✅ **Consistencia garantizada** - Evita permisos faltantes o desactualizados
✅ **Escalable** - Fácil agregar nuevas funcionalidades
✅ **Auditable** - Registro de permisos creados en cada sincronización

## 📝 Ejemplo de Uso Completo

Supongamos que queremos agregar una nueva sección "Inventario":

1. **Backend**: Crear `backend/inventario_service/main.py`
2. **Frontend**: Crear `frontend/src/components/Inventario.jsx`
3. **Routing**: Agregar en `App.jsx`:
   ```jsx
   import Inventario from './components/Inventario'
   // ...
   {view === 'inventario' && canViewPage('inventario') && <Inventario />}
   ```
4. **Permisos**: Agregar en `usePermissions.js`:
   ```jsx
   'inventario': has('inventario', 'view'),
   ```
5. **Mapeo**: Agregar en `persona_service/main.py`:
   ```python
   'inventario': {
       'resource': 'inventario',
       'action': 'view',
       'description': 'Ver inventario'
   }
   ```
6. **Sincronizar**: Click en "🔄 Sincronizar Permisos"
7. **Asignar**: Asignar permiso `inventario:view` a roles deseados

¡Listo! Sin tocar SQL, sin scripts manuales. 🚀

---

**Versión**: 1.0.0  
**Fecha**: 2025-11-09  
**Autor**: Sistema Ollantay  
**Licencia**: Privado
