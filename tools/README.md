# Tools / Herramientas

Scripts útiles para administración del sistema Ollantay.

## 📜 Scripts Disponibles

### 1. `test_escpos.ps1` (PowerShell - Windows)
**Propósito**: Probar endpoint de impresión térmica ESC/POS

**Uso**:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\test_escpos.ps1
```

**Output esperado**:
```
OK: endpoint returned escpos_base64 length = 428, rawbt_url preview: rawbt://print?data=...
```

---

### 2. `setup-ssl.sh` (Bash - Linux/Oracle Cloud)
**Propósito**: Configurar certificado SSL Let's Encrypt en el servidor

**Requisitos previos**:
- Dominio apuntando a la IP del servidor
- Puerto 80 y 443 abiertos en firewall
- Docker y Docker Compose instalados
- Nginx corriendo (reverse_proxy)

**Uso**:
```bash
# En el servidor Oracle Cloud
cd ~/ollantayProject
chmod +x tools/setup-ssl.sh

# Configurar variables (opcional)
export DOMAIN="archsoft-system.duck.dns.org"
export CERTBOT_EMAIL="tu@email.com"

# Ejecutar
./tools/setup-ssl.sh
```

**Qué hace**:
1. ✅ Verifica que nginx está corriendo
2. ✅ Verifica acceso al puerto 80
3. ✅ Solicita certificado SSL a Let's Encrypt
4. ✅ Verifica certificados generados
5. ✅ Te indica cómo actualizar nginx.conf
6. ✅ Reinicia nginx
7. ✅ Verifica HTTPS funcionando

**Output esperado**:
```
======================================
✅ Setup SSL completado
======================================

Próximos pasos:
1. Verifica en navegador: https://archsoft-system.duck.dns.org
2. GitHub Actions renovará automáticamente cada semana
3. Certificado válido por 90 días
```

---

## 🔄 Mantenimiento Automático

Después del setup inicial, **GitHub Actions** se encarga automáticamente de:

- ✅ Renovación de SSL cada domingo a las 3 AM
- ✅ Deploy automático en cada push a `main`
- ✅ Health checks de servicios
- ✅ Limpieza de imágenes Docker viejas

Ver workflows en `.github/workflows/`:
- `deploy-oracle-cloud.yml` - Deploy automático
- `renew-ssl.yml` - Renovación SSL semanal

---

## 🆘 Troubleshooting

### SSL no funciona después del setup

```bash
# 1. Verificar que el certificado existe
ls -la reverse-proxy/letsencrypt/live/archsoft-system.duck.dns.org/

# 2. Verificar sintaxis nginx
docker exec reverse_proxy nginx -t

# 3. Ver logs nginx
docker logs reverse_proxy

# 4. Verificar que nginx usa el certificado correcto
docker exec reverse_proxy cat /etc/nginx/nginx.conf | grep ssl_certificate
```

### Renovación manual de SSL

```bash
cd ~/ollantayProject

# Renovación forzada
docker-compose run --rm certbot renew --force-renewal

# Reiniciar nginx
docker-compose restart reverse_proxy
```

### Endpoint ESC/POS no responde

```bash
# Verificar que venta_service está corriendo
docker-compose ps venta_service

# Ver logs
docker logs venta_service

# Rebuild si es necesario
docker-compose up -d --no-deps --build venta_service
```

---

## 📚 Documentación Adicional

- `IMPLEMENTACION_IMPRESION.md` - Guía de impresión térmica
- `GITHUB_ACTIONS_ORACLE_CLOUD.md` - Guía completa de CI/CD y SSL
- `README.md` - Documentación general del proyecto
