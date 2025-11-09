# Análisis de Viabilidad: GitHub Actions para Oracle Cloud

## ✅ Respuesta Corta: SÍ, es viable y recomendable

GitHub Actions es perfectamente compatible con Oracle Cloud y es una solución profesional para CI/CD.

---

## 🎯 Ventajas de Implementar GitHub Actions

### 1. **Deployment Automático**
- Push a `main` → Deploy automático en segundos
- Sin necesidad de conectarse manualmente al servidor
- Rollback rápido: revertir commit y push

### 2. **Consistencia y Seguridad**
- Siempre se ejecutan los mismos pasos
- Logs auditables de cada deployment
- Secretos encriptados en GitHub (no expuestos en código)

### 3. **Zero Downtime (opcional)**
- Con docker-compose scale y health checks
- Blue-green deployment posible

### 4. **Gratis para Repositorios Públicos**
- 2000 minutos/mes gratis en privados
- Suficiente para 40-80 deployments/mes

---

## 🏗️ Arquitectura Propuesta para Tu Proyecto

```
GitHub Repo (ft2/productos branch)
    ↓ [push/merge]
GitHub Actions Runner (Ubuntu)
    ↓ [SSH con private key]
Oracle Cloud Instance (Ubuntu/OL)
    ↓ [git pull + docker-compose]
Servicios corriendo (MySQL, backend, frontend, nginx)
```

---

## 📋 Requisitos en Oracle Cloud

### 1. **Firewall y Puertos**
Ya tienes configurado DuckDNS y nginx, solo verificar:
```bash
# Verificar reglas iptables
sudo iptables -L -n | grep -E '80|443|3000|8001|8002|8003|8004'

# Abrir puertos si es necesario (ya deberías tenerlos)
sudo firewall-cmd --permanent --add-port=80/tcp
sudo firewall-cmd --permanent --add-port=443/tcp
sudo firewall-cmd --reload
```

### 2. **SSH Key Setup**
```bash
# En tu servidor Oracle Cloud
ssh-keygen -t rsa -b 4096 -C "github-actions-deploy" -f ~/.ssh/github_deploy
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys

# Copiar la CLAVE PRIVADA (cuidado, muy sensible)
cat ~/.ssh/github_deploy
# Este contenido completo va a GitHub Secrets → SSH_PRIVATE_KEY
```

### 3. **Git Repository en Servidor**
```bash
# Clonar repo si no existe
cd ~
git clone https://github.com/LimbergVillcaCoraite/ollantayProject.git
cd ollantayProject

# Configurar Git para auto-merge en pull
git config pull.rebase false

# Dar permisos Docker al usuario
sudo usermod -aG docker $USER
newgrp docker  # o logout/login
```

### 4. **Variables de Entorno (opcional pero recomendado)**
Crear archivo `.env` en el servidor con secretos:
```bash
# ~/ollantayProject/.env
DATABASE_PASSWORD=P4assw@rd
JWT_SECRET=tu_secreto_jwt
```

---

## 🔐 Configuración de GitHub Secrets

Ve a tu repo en GitHub → **Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Valor | Ejemplo |
|------------|-------|---------|
| `SSH_HOST` | IP pública de Oracle | `132.145.89.123` |
| `SSH_USER` | Usuario del servidor | `ubuntu` o `opc` |
| `SSH_PRIVATE_KEY` | Clave privada completa | `-----BEGIN RSA...` |
| `SSH_PORT` | Puerto SSH (default 22) | `22` |

---

## 🚀 Flujo de Deploy Recomendado

### Opción 1: Deploy Directo (Simple)
```yaml
git pull → docker-compose build → docker-compose up -d
```
✅ Pros: Simple, rápido  
❌ Contras: Downtime de ~30 segundos durante rebuild

### Opción 2: Blue-Green (Zero Downtime)
```yaml
1. Construir nuevas imágenes con tag "blue"
2. Levantar servicios "blue" en puertos alternos
3. Health check
4. Nginx switch upstream blue ↔ green
5. Bajar servicios "green" viejos
```
✅ Pros: Zero downtime  
❌ Contras: Más complejo, requiere doble RAM temporalmente

**Recomendación**: Empezar con Opción 1 (deploy directo). Para tu proyecto es suficiente.

---

## 📊 Estimación de Recursos

### GitHub Actions Minutes
- 1 deployment típico: 2-5 minutos
- 20 deployments/mes: 40-100 minutos
- ✅ Bien dentro del límite gratuito (2000 min/mes)

### Oracle Cloud (Always Free Tier)
- ✅ 2x AMD CPU + 12GB RAM (suficiente para 12 containers)
- ✅ 200GB storage (más que suficiente)
- ⚠️ Única preocupación: memoria durante rebuild simultáneo de todos los servicios

**Tip**: Si ves OOMKiller, rebuilder servicios secuencialmente:
```yaml
docker-compose up -d --no-deps --build venta_service
docker-compose up -d --no-deps --build persona_service
# etc...
```

---

## 🛡️ Estrategia de Rollback

### Método 1: Revertir commit y push
```bash
git revert HEAD
git push origin ft2/productos
# GitHub Actions auto-deploy la versión anterior
```

### Método 2: Deploy manual de commit específico
```bash
# En el servidor
cd ~/ollantayProject
git checkout <commit-hash-anterior>
docker-compose up -d --build
```

### Método 3: Backup automático de DB antes de deploy
Añadir a workflow:
```yaml
- name: Backup DB before deploy
  run: |
    ssh ... << 'ENDSSH'
      docker exec mysql_8_0_32-containerSources \
        mysqldump -u root -pP4assw@rd SystemaOllantay \
        > ~/backups/pre_deploy_$(date +%Y%m%d_%H%M%S).sql
    ENDSSH
```

---

## ⚠️ Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| SSH key comprometida | Baja | Alto | Rotar keys cada 6 meses, usar IP whitelist |
| Out of Memory durante build | Media | Alto | Build secuencial, aumentar swap |
| Database migration falla | Baja | Crítico | Backup pre-deploy + dry-run migrations |
| Nginx config error | Baja | Alto | Validar `nginx -t` antes de reload |
| Docker registry rate limit | Baja | Medio | Usar caché local de imágenes |

---

## 📝 Pasos para Implementar HOY

### 1. Generar SSH Key en Oracle Cloud ✅
```bash
ssh-keygen -t rsa -b 4096 -f ~/.ssh/github_deploy
cat ~/.ssh/github_deploy.pub >> ~/.ssh/authorized_keys
cat ~/.ssh/github_deploy  # Copiar output
```

### 2. Configurar GitHub Secrets ✅
- Ve a repo → Settings → Secrets → Actions
- Agregar SSH_HOST, SSH_USER, SSH_PRIVATE_KEY, SSH_PORT

### 3. Probar workflow manualmente ✅
```bash
# Hacer un cambio menor y push
git add .github/workflows/deploy-oracle-cloud.yml
git commit -m "ci: add GitHub Actions deployment"
git push origin ft2/productos

# Ir a GitHub → Actions → Ver logs del workflow
```

### 4. Monitorear primer deploy 📊
- Ver logs en tiempo real en GitHub Actions tab
- SSH al servidor y verificar: `docker-compose ps`
- Verificar en navegador: https://archsoft-system.duck.dns.org

---

## 🔒 Certificado SSL con GitHub Actions

### ✅ Respuesta: SÍ, totalmente automatizable

GitHub Actions puede:
1. **Verificar** si el certificado SSL existe
2. **Renovar automáticamente** cuando expire (< 30 días)
3. **Recargar nginx** después de renovación
4. **Ejecutarse semanalmente** o manualmente

### 📋 Setup Inicial de SSL (Una vez)

#### 1. En tu servidor Oracle Cloud:
```bash
# Instalar Certbot
sudo apt update
sudo apt install certbot -y  # Ubuntu/Debian
# o
sudo dnf install certbot -y  # Oracle Linux

# Crear directorio para ACME challenge
sudo mkdir -p /var/www/certbot/.well-known/acme-challenge
sudo chown -R $USER:$USER /var/www/certbot

# Verificar que nginx está corriendo y expone puerto 80
docker-compose ps reverse_proxy

# Obtener certificado (primera vez)
sudo certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d archsoft-system.duck.dns.org \
  --email tu@email.com \
  --agree-tos \
  --non-interactive

# Dar permisos Docker para acceder a certificados
sudo chmod 755 /etc/letsencrypt/live
sudo chmod 755 /etc/letsencrypt/archive
```

#### 2. Actualizar docker-compose.yml para montar certificados:
```yaml
reverse_proxy:
  # ... (config existente)
  volumes:
    - ./reverse-proxy/nginx.conf:/etc/nginx/nginx.conf:ro
    - /etc/letsencrypt:/etc/letsencrypt:ro  # ← Añadir esta línea
    - /var/www/certbot:/var/www/certbot:ro  # ← Añadir esta línea
```

#### 3. Actualizar nginx.conf para usar certificados Let's Encrypt:
```nginx
server {
  listen 443 ssl;
  server_name archsoft-system.duck.dns.org;
  
  # Cambiar de dev certificates a Let's Encrypt
  ssl_certificate     /etc/letsencrypt/live/archsoft-system.duck.dns.org/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/archsoft-system.duck.dns.org/privkey.pem;
  
  # Comentar las dev certificates:
  # ssl_certificate     /etc/nginx/certs/dev.crt;
  # ssl_certificate_key /etc/nginx/certs/dev.key;
  
  # ... resto de config
}
```

#### 4. Reiniciar nginx:
```bash
cd ~/ollantayProject
docker-compose restart reverse_proxy
docker-compose ps  # Verificar que esté "Up"
```

#### 5. Verificar SSL en navegador:
```
https://archsoft-system.duck.dns.org
# Debería mostrar candado verde y certificado válido
```

### 🤖 Renovación Automática con GitHub Actions

He creado el workflow `.github/workflows/renew-ssl.yml` que:

- ✅ Se ejecuta **cada domingo a las 3 AM** automáticamente
- ✅ Verifica días hasta expiración
- ✅ Renueva si quedan menos de 30 días
- ✅ Recarga nginx después de renovar
- ✅ Se puede ejecutar manualmente cuando quieras

### 📊 Secrets Adicionales para SSL

Agregar en GitHub → Settings → Secrets → Actions:

| Secret Name | Valor | Ejemplo |
|------------|-------|---------|
| `DOMAIN` | Tu dominio | `archsoft-system.duck.dns.org` |
| `CERTBOT_EMAIL` | Email para notificaciones | `tu@email.com` |

### � Workflows Incluidos

1. **`deploy-oracle-cloud.yml`** - Deploy automático + check SSL
2. **`renew-ssl.yml`** - Renovación automática semanal

### 🧪 Probar Renovación SSL Manualmente

```bash
# Desde GitHub:
# Actions → Renew SSL Certificate → Run workflow

# O desde servidor Oracle Cloud:
sudo certbot renew --dry-run  # Simula renovación
sudo certbot renew --force-renewal  # Forzar renovación
```

### ⚠️ Troubleshooting SSL

#### Error: "Certificate not found"
```bash
# Verificar path
sudo ls -la /etc/letsencrypt/live/archsoft-system.duck.dns.org/

# Si no existe, obtener certificado:
sudo certbot certonly --webroot -w /var/www/certbot -d archsoft-system.duck.dns.org --email tu@email.com --agree-tos
```

#### Error: "Nginx failed to reload"
```bash
# Verificar sintaxis nginx
docker exec reverse_proxy nginx -t

# Ver logs
docker logs reverse_proxy
```

#### Certificado expira pero no renueva
```bash
# Verificar cron de certbot
sudo systemctl status certbot.timer

# Forzar renovación manual
sudo certbot renew --force-renewal
docker-compose restart reverse_proxy
```

### 📅 Timeline de Renovación

```
Día 0   → Certificado emitido (válido 90 días)
Día 60  → GitHub Actions detecta < 30 días, renueva automáticamente
Día 90  → Nuevo certificado válido por otros 90 días
```

### 💰 Costo

**GRATIS** - Let's Encrypt es 100% gratuito y GitHub Actions tiene 2000 minutos/mes gratis.

---

## �🎓 Recursos Adicionales

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Docker Compose Best Practices](https://docs.docker.com/compose/production/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [Certbot User Guide](https://eff-certbot.readthedocs.io/)
- [Oracle Cloud SSH Access](https://docs.oracle.com/en-us/iaas/Content/Compute/Tasks/accessinginstance.htm)

---

## 💡 Conclusión

**SÍ, implementa GitHub Actions ahora mismo**. Es la forma profesional de hacer deploys y te ahorrará:
- 15-20 minutos por deploy manual
- Errores humanos (olvidar rebuild de un servicio)
- Historial completo de cambios en producción

El workflow que te proporcioné está **listo para usar**. Solo necesitas configurar los 4 secrets en GitHub.

**Next steps**:
1. Generar SSH key (5 min)
2. Configurar secrets en GitHub (2 min)
3. Push workflow file (1 min)
4. Hacer primer deploy automático 🚀

¿Alguna pregunta específica sobre la configuración de Oracle Cloud o GitHub Actions?
