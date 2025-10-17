# Ollantay Project - Docker Compose

Este repositorio contiene un backend en FastAPI y un frontend en React. Este `docker-compose.yml` levanta tres servicios:

- `mysql8032` - MySQL 8.0.32
- `backend` - FastAPI ejecutado con Uvicorn
- `frontend` - React (modo desarrollo con `npm start` usando Vite)

## Requisitos

- Docker y Docker Compose instalados
- PowerShell en Windows (los comandos de ejemplo están en PowerShell)

## Uso (PowerShell)

Para construir y levantar los servicios:

```powershell
docker compose up --build
```

Para ejecutar en background:

```powershell
docker compose up -d --build
```

Para detener y remover contenedores:

```powershell
docker compose down
```

## Notas

- La base de datos expone el puerto 3306 ligado a localhost (127.0.0.1) para limitar el acceso externo.
- El servicio `frontend` asume que en `./frontend` existe una app React. Se incluye una plantilla mínima con Vite.
- Si el `backend` necesita conectar con la DB, use las variables de entorno: `DATABASE_HOST=mysql8032`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`.

Nota sobre el frontend y acceso desde el navegador:

- El servidor de desarrollo Vite, por defecto, escucha en el host local dentro del contenedor y en el puerto 5173. Para que el puerto mapeado en `docker-compose.yml` (3000) funcione y para que el navegador en tu máquina Windows pueda conectarse al contenedor, el servidor debe escuchar en 0.0.0.0 y en el mismo puerto que exponemos.
- Por eso el script `start` se ajustó a `vite --host 0.0.0.0 --port 3000` y `docker-compose.yml` mapea `3000:3000`. Si prefieres usar el puerto por defecto de Vite (5173), actualiza el mapeo en `docker-compose.yml` a `5173:5173`.
# ollantayProject
This's a project for Ollantay enterprice
