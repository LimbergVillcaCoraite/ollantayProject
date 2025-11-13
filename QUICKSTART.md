# Ollantay Project - Quick Reference

## Start All Services
```powershell
docker-compose up -d --build
```

## Access URLs
- Web App: http://localhost:3000
- API Gateway: http://localhost
- MySQL: localhost:3306

## Mobile App
```bash
cd mobile
npm install
npm start
```

## Useful Commands

### Docker
```powershell
# Stop all
docker-compose down

# Rebuild service
docker-compose up -d --build [service_name]

# View logs
docker-compose logs -f [service_name]

# Restart service
docker-compose restart [service_name]
```

### Database
```powershell
# Connect
docker exec -it mysql_8_0_32-containerSources mysql -u root -pP4assw@rd SystemaOllantay

# Backup
docker exec mysql_8_0_32-containerSources mysqldump -u root -pP4assw@rd SystemaOllantay > backup.sql
```

## Services & Ports
| Service | Port | Path |
|---------|------|------|
| Frontend | 3000 | / |
| Reverse Proxy | 80/443 | / |
| Personas/Auth | 8002 | /api/persona/ |
| Ventas | 8004 | /api/venta/ |
| Productos | 8003 | /api/prestamos/ |
| Compras | 8005 | /api/compra/ |
| Entregas | 8009 | /api/entregas/ |
| Gastos | 8011 | /api/gastos/ |

## Default Users
```
superadmin / admin123
admin1 / admin123
chofer1 / chofer123
cliente1 / cliente123
```

## Documentation
- Mobile: mobile/README.md
- Permissions: PERMISSIONS-AUTO-SYNC.md
- CI/CD: GITHUB_ACTIONS_ORACLE_CLOUD.md
