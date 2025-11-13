# 🏛️ Sistema Ollantay

**Sistema integral de gestión de préstamos y administración de personas para empresas**

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/ollantay/sistema)
[![Docker](https://img.shields.io/badge/docker-ready-green.svg)](https://docker.com)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-00a393.svg)](https://fastapi.tiangolo.com)
[![React](https://img.shields.io/badge/React-18.2+-61dafb.svg)](https://reactjs.org)

## 🌟 Características Principales

### 💼 Gestión Empresarial
- **Administración de Personas**: Registro completo con fotografías, documentos de identidad y datos de contacto
- **Gestión de Empresas**: Control de entidades empresariales vinculadas a personas
- **Sistema de Préstamos**: Seguimiento integral de préstamos con estados y fechas
- **Tipos de Persona**: Clasificación flexible (Cliente, Proveedor, Empleado, etc.)

### 🔐 Seguridad y Autenticación
- **Sistema RBAC**: Control de acceso basado en roles (Admin, Editor, Viewer)
- **Autenticación JWT**: Sesiones seguras con cookies httpOnly
- **Permisos Granulares**: Control detallado por módulo y acción
- **Gestión de Usuarios**: Administración completa de cuentas de usuario

### 🎨 Interfaz Moderna
- **Diseño Responsivo**: Optimizado para desktop y móvil
- **Modo Oscuro/Claro**: Tema adaptable según preferencias
- **Navegación Intuitiva**: Sidebar colapsible con iconografía clara
- **Componentes Reutilizables**: UI consistente en toda la aplicación

### 📸 Gestión de Archivos
- **Subida de Fotos**: Sistema de carga para fotos de perfil y documentos
- **Almacenamiento Seguro**: Archivos organizados en estructura de directorios
- **Servicio de Imágenes**: Endpoint dedicado para servir contenido multimedia

## 🏗️ Arquitectura del Sistema

### Microservicios Backend
```
📦 Backend (Puerto 8000)
├── 👥 Persona Service (Puerto 8002)
│   ├── Gestión de personas y empresas
│   ├── Autenticación y autorización
│   ├── Subida y gestión de archivos
│   └── Sistema RBAC completo
├── 📋 Tipo Persona Service (Puerto 8001)
│   └── Clasificación y tipos de personas
└── 💰 Préstamo Service (Puerto 8003)
    └── Gestión integral de préstamos
```

### Frontend React
```
📦 Frontend (Puerto 3000)
├── ⚛️ React 18.2 + Vite
├── 🎨 Tailwind CSS
├── 🍞 Sistema de Toasts
├── 📱 Diseño Responsivo
└── 🌙 Soporte Tema Oscuro
```

### Base de Datos
```
🗄️ MySQL 8.0.32 (Puerto 3306)
├── Tablas principales:
│   ├── persona_O (Personas)
│   ├── empresa_O (Empresas)
│   ├── prestamo_O (Préstamos)
│   ├── tipo_personaO (Tipos)
│   ├── user_O (Usuarios)
│   ├── role_O (Roles)
│   └── permission_O (Permisos)
└── Relaciones optimizadas con índices
```

### Proxy Reverso
```
🔄 Nginx (Puerto 80)
├── Frontend: / → ollantay_frontend:3000
├── API Personas: /api/personas/ → persona_service:8002
├── API Tipos: /api/tipos/ → tipo_persona_service:8001
├── API Préstamos: /api/prestamos/ → prestamo_service:8003
└── Archivos Estáticos: /api/personas/uploads/
```

## 🚀 Instalación y Configuración

### Prerrequisitos
- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Git** para clonar el repositorio

### Instalación Rápida

1. **Clonar el repositorio**
```bash
git clone https://github.com/tu-usuario/ollantay-project.git
cd ollantay-project
```

2. **Levantar todos los servicios**
```bash
# Construcción y ejecución en primer plano
docker compose up --build

# O en segundo plano (recomendado)
docker compose up -d --build
```

3. **Verificar servicios**
```bash
# Ver estado de contenedores
docker compose ps

# Ver logs en tiempo real
docker compose logs -f
```

### Acceso al Sistema

| Servicio | URL | Descripción |
|----------|-----|-------------|
| **Aplicación Principal** | http://localhost | Interfaz web completa |
| **API Personas** | http://localhost/api/personas | Gestión de personas y auth |
| **API Tipos** | http://localhost/api/tipos | Tipos de persona |
| **API Préstamos** | http://localhost/api/prestamos | Sistema de préstamos |
| **Base de Datos** | localhost:3306 | MySQL (solo local) |

### Credenciales por Defecto
```
Usuario: admin
Contraseña: <configurar-en-primera-ejecución>
```

## 🛠️ Comandos Útiles

### Gestión de Contenedores
```bash
# Detener servicios
docker compose down

# Reconstruir solo un servicio
docker compose up --build persona_service

# Ver logs de un servicio específico
docker compose logs -f frontend

# Ejecutar comando en contenedor
docker compose exec persona_service bash
```

### Base de Datos
```bash
# Conectar a MySQL
docker compose exec mysql8032 mysql -u root -p SystemaOllantay

# Backup de base de datos
docker compose exec mysql8032 mysqldump -u root -p<password> SystemaOllantay > backup.sql

# Restaurar backup
docker compose exec -T mysql8032 mysql -u root -p<password> SystemaOllantay < backup.sql
```

### Desarrollo
```bash
# Modo desarrollo con hot reload
docker compose -f docker-compose.dev.yml up

# Ejecutar tests
docker compose exec persona_service python -m pytest

# Ver métricas de contenedores
docker stats
```

## 📊 Estructura de Permisos

### Roles Predefinidos

| Rol | Descripción | Permisos |
|-----|-------------|----------|
| **Admin** | Administrador total | Todos los permisos |
| **Editor** | Editor de contenido | Crear, editar, ver |
| **Viewer** | Solo lectura | Solo visualización |

### Módulos de Permisos
- `personas:view` - Ver personas
- `personas:create` - Crear personas
- `personas:edit` - Editar personas
- `personas:delete` - Eliminar personas
- `empresas:*` - Permisos de empresas
- `prestamos:*` - Permisos de préstamos
- `tipos:*` - Permisos de tipos
- `roles:manage` - Gestión de roles y usuarios

## 🔧 Configuración Avanzada

### Variables de Entorno

#### Base de Datos
```env
DATABASE_HOST=mysql8032
DATABASE_PORT=3306
DATABASE_USER=root
DATABASE_PASSWORD=<tu-password-segura>
DATABASE_NAME=SystemaOllantay
```

#### Seguridad
```env
JWT_SECRET=tu-clave-secreta-super-segura
JWT_EXPIRE_MINUTES=60
ALLOW_ORIGIN_REGEX=https?://.*
```

#### Archivos
```env
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=10MB
```

### Personalización de Puertos

Editar `docker-compose.yml`:
```yaml
services:
  frontend:
    ports:
      - "3001:3000"  # Cambiar puerto frontend
  
  reverse_proxy:
    ports:
      - "8080:80"    # Cambiar puerto principal
```

## 📈 Monitoreo y Logs

### Health Checks
```bash
# Verificar estado de servicios
curl http://localhost/api/personas/health
curl http://localhost/api/tipos/health
curl http://localhost/api/prestamos/health
```

### Logs Estructurados
```bash
# Logs por servicio
docker compose logs persona_service
docker compose logs frontend
docker compose logs mysql8032

# Logs en tiempo real con filtros
docker compose logs -f --tail=100 persona_service
```

## 🔒 Seguridad y Mejores Prácticas

### HTTPS y Cabeceras de Seguridad

El reverse proxy (`reverse-proxy/nginx.conf`) ya incluye:
- Certificados Let's Encrypt esperados en `/etc/letsencrypt/live/archsoft-system.duck.dns.org/`.
- Cabeceras: HSTS, CSP (permisiva para evitar romper scripts legacy), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy y COOP/COEP/CORP.

Para emitir certificados inicialmente (si aún no existen):
```bash
docker compose run --rm certbot certbot certonly --webroot -w /var/www/certbot -d archsoft-system.duck.dns.org --agree-tos --register-unsafely-without-email
docker compose restart reverse_proxy
```
La renovación automática corre cada 12h dentro del contenedor `certbot`.

Para Windows/PowerShell incluimos scripts de ayuda:

- Emisión inicial (PowerShell):
  ```powershell
  cd reverse-proxy
  ./issue-cert.ps1 -Domain archsoft-system.duck.dns.org
  docker compose restart reverse_proxy
  ```

- Renovación manual (PowerShell) y recarga de Nginx para aplicar los nuevos certificados:
  ```powershell
  cd reverse-proxy
  ./renew-certs.ps1
  docker compose exec reverse_proxy nginx -s reload
  ```

Configuración alternativa lista para producción: `reverse-proxy/nginx.prod.conf` usa directamente los certificados de Let's Encrypt. Puedes montar este archivo en lugar de `nginx.conf` en producción una vez emitidos los certificados.

### Avatares en el Mapa
Las fotos de personas se sirven desde `persona_service` bajo `/api/personas/uploads/`. El componente `PersonasEnMapa.jsx` crea marcadores con:
- Foto redondeada con gradiente y anillo de estado.
- Fallback a inicial del nombre si no hay foto.
- WebSocket para ubicación en tiempo real.

### Estado de Pago Simplificado
`venta_service` normaliza `estado_pago` a solo `Pagado` o `No Pagado` para simplificar la interfaz. Estados anteriores (Pendiente/Parcial) se muestran ahora como `No Pagado`.

### Recomendaciones de Producción

1. **Cambiar credenciales por defecto**
```bash
# Generar contraseña segura para MySQL
openssl rand -base64 32
```

2. **Configurar HTTPS**
```nginx
server {
    listen 443 ssl;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
}
```

3. **Limitar acceso a base de datos**
```yaml
mysql8032:
  ports:
    - "127.0.0.1:3306:3306"  # Solo localhost
```

4. **Configurar backups automáticos**
```bash
# Cron job para backup diario
0 2 * * * docker compose exec mysql8032 mysqldump -u root -p<password> SystemaOllantay > /backups/$(date +%Y%m%d).sql
```

## 🐛 Solución de Problemas
Si la API necesita detectar HTTPS (por ejemplo construcción de URLs absolutas), se propaga el encabezado `X-Forwarded-Proto` desde Nginx. Asegúrate de usarlo en servicios si debes generar enlaces seguros.

### Problemas Comunes

#### Error de conexión a base de datos
```bash
# Verificar que MySQL esté corriendo
docker compose ps mysql8032

# Reiniciar servicio de base de datos
docker compose restart mysql8032
```

#### Frontend no carga
```bash
# Verificar logs del frontend
docker compose logs frontend

# Reconstruir contenedor frontend
docker compose up --build frontend
```

#### Problemas de permisos de archivos
```bash
# Verificar permisos del directorio uploads
docker compose exec persona_service ls -la /app/uploads

# Corregir permisos
docker compose exec persona_service chmod 755 /app/uploads
```

### Logs de Debug
```bash
# Habilitar logs detallados
export COMPOSE_LOG_LEVEL=DEBUG
docker compose up --build
```

## 🤝 Contribución

### Flujo de Desarrollo
1. Fork del repositorio
2. Crear rama feature: `git checkout -b feature/nueva-funcionalidad`
3. Commit cambios: `git commit -am 'Agregar nueva funcionalidad'`
4. Push a la rama: `git push origin feature/nueva-funcionalidad`
5. Crear Pull Request

### Estándares de Código
- **Backend**: PEP 8 para Python, type hints obligatorios
- **Frontend**: ESLint + Prettier, componentes funcionales
- **Base de Datos**: Nomenclatura consistente, índices optimizados

## 📝 Changelog

### v2.0.0 (Actual)
- ✨ Sistema RBAC completo
- 📸 Gestión de archivos y fotos
- 🎨 Interfaz moderna con Tailwind CSS
- 🔐 Autenticación JWT mejorada
- 📱 Diseño completamente responsivo
- 🌙 Soporte para tema oscuro

### v1.0.0
- 🏗️ Arquitectura de microservicios
- 👥 Gestión básica de personas
- 💰 Sistema de préstamos
- 🐳 Containerización con Docker

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 👥 Equipo de Desarrollo

- **Arquitectura**: Sistema de microservicios con FastAPI
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Base de Datos**: MySQL 8.0 optimizada
- **DevOps**: Docker Compose + Nginx

---

**Sistema Ollantay 2.0** - Sistema de gestion empresarial multiempresa con arquitectura de microservicios.

## Stack Tecnologico

- **Backend**: FastAPI (Python 3.9+)
- **Frontend Web**: React 18 + Vite + Tailwind CSS
- **Mobile**: React Native + Expo
- **Base de Datos**: MySQL 8.0.32
- **Contenedores**: Docker + Docker Compose
- **Proxy**: Nginx con SSL/TLS
- **CI/CD**: GitHub Actions

## Aplicaciones

### Web (React)
- Interfaz administrativa completa
- Gestion de ventas, productos, clientes
- Modulos de contabilidad y reportes
- Sistema de permisos dinamico
- Acceso: http://localhost:3000

### Mobile (React Native/Expo)
- App para vendedores y choferes
- Gestion de entregas en campo
- Vista de mis deudas para clientes
- Sincronizacion con backend
- Ver: [mobile/README.md](mobile/README.md)

## Inicio Rapido

```powershell
# Clonar repositorio
git clone https://github.com/LimbergVillcaCoraite/ollantayProject.git
cd ollantayProject

# Levantar servicios backend y web
docker-compose up -d --build

# Para la app movil
cd mobile
npm install
npm start
```

## Documentacion

- **App Movil**: [mobile/README.md](mobile/README.md)
- **Permisos**: [PERMISSIONS-AUTO-SYNC.md](PERMISSIONS-AUTO-SYNC.md)
- **CI/CD**: [GITHUB_ACTIONS_ORACLE_CLOUD.md](GITHUB_ACTIONS_ORACLE_CLOUD.md)

## Soporte

Para problemas o consultas: [Crear Issue](https://github.com/LimbergVillcaCoraite/ollantayProject/issues)

---
