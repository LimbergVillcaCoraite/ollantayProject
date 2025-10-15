# Sistema Ollantay

> Aplicación web full-stack para Ollantay Enterprise

## 🏗️ Arquitectura

Este proyecto utiliza una arquitectura de microservicios con:

- **Frontend**: React + Vite (Puerto 3000)
- **Backend**: FastAPI + Uvicorn (Puerto 8000)
- **Base de datos**: MySQL 8.0.32 (Puerto 3306)

## 📋 Requisitos

- [Docker](https://www.docker.com/get-started) >= 20.10
- [Docker Compose](https://docs.docker.com/compose/install/) >= 2.0
- Git

## 🚀 Inicio rápido

1. **Clonar el repositorio**
   ```bash
   git clone <repository-url>
   cd ollantayProject
   ```

2. **Levantar los servicios**
   ```bash
   docker compose up --build
   ```

3. **Acceder a la aplicación**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - Documentación API: http://localhost:8000/docs

## 🛠️ Comandos útiles

```bash
# Ejecutar en segundo plano
docker compose up -d

# Ver logs
docker compose logs -f

# Reconstruir servicios
docker compose up --build

# Detener servicios
docker compose down

# Limpiar volúmenes (⚠️ elimina datos de BD)
docker compose down -v
```

## 🗄️ Base de datos

**Credenciales por defecto:**
- Usuario: `root`
- Contraseña: `P4assw@rd`
- Base de datos: `SistemaOllantay`
- Host: `mysql8032` (desde contenedores) / `localhost` (desde host)

## 🔧 Desarrollo
   
### Variables de entorno

El backend utiliza estas variables:
```
DATABASE_URL=mysql+pymysql://root:P4assw@rd@mysql8032:3306/SistemaOllantay
```

### Hot reload

- **Frontend**: Habilitado automáticamente con Vite
- **Backend**: Configurado con `--reload` en FastAPI

## 📁 Estructura del proyecto

```
ollantayProject/
├── backend/          # API FastAPI
├── frontend/         # Aplicación React
├── docker-compose.yml
└── README.md
```

## 🐛 Solución de problemas

**Puerto ocupado:**
```bash
# Verificar puertos en uso
netstat -ano | findstr :3000
netstat -ano | findstr :8000
netstat -ano | findstr :3306
```

**Problemas de conexión a BD:**
- Verificar que el contenedor MySQL esté ejecutándose
- Comprobar las credenciales en docker-compose.yml

**Limpiar caché de Docker desde consola:**
```bash
docker system prune -a
```
