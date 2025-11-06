# 🔒 Guía de Configuración SSL en Producción (Ubuntu)

Este directorio contiene scripts para configurar certificados SSL de Let's Encrypt en tu servidor Ubuntu.

## 📋 Requisitos Previos

1. **Dominio configurado**: `archsoft-system.duck.dns.org` debe apuntar a la IP pública del servidor
2. **Puertos abiertos**: 80 (HTTP) y 443 (HTTPS) en el firewall
3. **Docker funcionando**: `docker compose ps` muestra todos los servicios corriendo

## 🚀 Instalación Rápida (3 pasos)

### Paso 1: Obtener certificados

```bash
cd reverse-proxy
chmod +x *.sh
./issue-cert.sh archsoft-system.duck.dns.org
```

Este script:
- Verifica que el webroot sea accesible
- Ejecuta certbot para obtener certificados
- Muestra instrucciones para el siguiente paso

### Paso 2: Cambiar a producción

```bash
./switch-to-prod.sh archsoft-system.duck.dns.org
```

Este script:
- Verifica que los certificados existan
- Actualiza `docker-compose.yml` para usar `nginx.prod.conf`
- Reinicia el reverse proxy
- Verifica que HTTPS funcione

### Paso 3: Verificar

```bash
curl https://archsoft-system.duck.dns.org/healthz
# Debe devolver: ok
```

¡Listo! Tu sistema ahora usa HTTPS con certificados válidos.

---

## 📁 Archivos Incluidos

### Scripts Bash (Ubuntu/Linux)
- **`issue-cert.sh`** - Obtener certificados iniciales de Let's Encrypt
- **`renew-certs.sh`** - Renovar certificados manualmente (también se renuevan auto cada 12h)
- **`switch-to-prod.sh`** - Cambiar de certificados dev a producción automáticamente

### Scripts PowerShell (Windows/Dev)
- **`issue-cert.ps1`** - Versión Windows del script de emisión
- **`renew-certs.ps1`** - Versión Windows del script de renovación

### Configuraciones Nginx
- **`nginx.conf`** - Configuración actual (certificados dev por defecto)
- **`nginx.prod.conf`** - Configuración lista para producción (usa Let's Encrypt)

---

## 🔄 Renovación Automática

El contenedor `certbot` ya está configurado para renovar automáticamente cada 12 horas.

**Renovación manual** (si es necesario):
```bash
./renew-certs.sh
```

Este script renueva los certificados y recarga Nginx automáticamente.

---

## 🛠️ Comandos Útiles

### Ver estado de certificados
```bash
docker compose run --rm certbot certbot certificates
```

### Ver logs de certbot
```bash
docker compose logs certbot
```

### Probar renovación (dry-run)
```bash
docker compose run --rm certbot certbot renew --dry-run --webroot -w /var/www/certbot
```

### Recargar Nginx manualmente
```bash
docker compose exec reverse_proxy nginx -s reload
```

### Volver a certificados de desarrollo
```bash
cd ..
# Restaurar backup
cp docker-compose.yml.backup docker-compose.yml
docker compose restart reverse_proxy
```

---

## 🐛 Solución de Problemas

### Error: "Webroot test failed"
**Causa**: Nginx no sirve correctamente `/.well-known/acme-challenge/`

**Solución**:
```bash
# Verificar que reverse_proxy esté corriendo
docker compose ps reverse_proxy

# Ver logs de Nginx
docker compose logs reverse_proxy | tail -50

# Probar acceso manual
curl http://archsoft-system.duck.dns.org/.well-known/acme-challenge/test
```

### Error: "DNS not pointing to this server"
**Causa**: El dominio no resuelve a la IP correcta

**Solución**:
```bash
# Verificar DNS
dig archsoft-system.duck.dns.org +short
# Debe mostrar la IP pública del servidor

# Verificar IP pública del servidor
curl ifconfig.me
```

### Error: "Port 80/443 not accessible"
**Causa**: Firewall bloqueando puertos

**Solución en Ubuntu**:
```bash
# Abrir puertos con UFW
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload

# Verificar estado
sudo ufw status
```

### Error: "Rate limit exceeded"
**Causa**: Demasiados intentos de emisión de certificados

**Solución**:
- Let's Encrypt limita a 5 certificados por semana por dominio
- Espera unas horas o usa el staging server para pruebas:
  ```bash
  docker compose run --rm certbot certbot certonly \
      --webroot -w /var/www/certbot \
      -d archsoft-system.duck.dns.org \
      --staging \
      --agree-tos --register-unsafely-without-email
  ```

### Nginx no arranca con certificados de producción
**Causa**: Certificados no existen o tienen permisos incorrectos

**Solución**:
```bash
# Verificar que existan
ls -la letsencrypt/live/archsoft-system.duck.dns.org/

# Verificar permisos
sudo chmod -R 755 letsencrypt/

# Ver error exacto
docker compose logs reverse_proxy | grep -i error
```

---

## 📊 Estructura de Directorios

```
reverse-proxy/
├── nginx.conf              # Config actual (dev certs)
├── nginx.prod.conf         # Config producción (LE certs)
├── issue-cert.sh          # Script emisión (Ubuntu)
├── renew-certs.sh         # Script renovación (Ubuntu)
├── switch-to-prod.sh      # Script cambio automático (Ubuntu)
├── issue-cert.ps1         # Script emisión (Windows)
├── renew-certs.ps1        # Script renovación (Windows)
├── certs/                 # Certificados dev (auto-firmados)
│   ├── dev.crt
│   └── dev.key
├── letsencrypt/           # Certificados Let's Encrypt
│   └── live/
│       └── archsoft-system.duck.dns.org/
│           ├── fullchain.pem
│           └── privkey.pem
└── certbot-www/           # Webroot para ACME challenge
    └── .well-known/
        └── acme-challenge/
```

---

## 🔐 Seguridad

### Headers de Seguridad Incluidos

Ambas configuraciones (`nginx.conf` y `nginx.prod.conf`) incluyen:

- **HSTS**: Fuerza HTTPS por 2 años
- **X-Content-Type-Options**: Previene MIME sniffing
- **X-Frame-Options**: Protege contra clickjacking
- **Referrer-Policy**: No envía referrer externo
- **CSP**: Content Security Policy permisiva (ajusta según necesites)
- **Permissions-Policy**: Solo permite geolocalización

### Rotación de Certificados

Los certificados se renuevan automáticamente 30 días antes de expirar.

### Backup de Configuración

El script `switch-to-prod.sh` crea automáticamente un backup en `docker-compose.yml.backup`.

---

## 📞 Soporte

Si tienes problemas:

1. Revisa los logs: `docker compose logs certbot reverse_proxy`
2. Verifica DNS: `dig archsoft-system.duck.dns.org`
3. Prueba webroot: `curl http://tu-dominio/.well-known/acme-challenge/test`
4. Crea un issue en el repositorio con los logs

---

**Última actualización**: Noviembre 2025  
**Compatibilidad**: Ubuntu 20.04+, Debian 11+, cualquier Linux con Docker
