#!/bin/bash
# Script para configurar SSL Let's Encrypt en Oracle Cloud
# Ejecutar UNA VEZ en el servidor después del primer deploy

set -e

echo "======================================"
echo "🔒 Setup SSL Let's Encrypt"
echo "======================================"

# Variables (ajustar según tu configuración)
DOMAIN="${DOMAIN:-archsoft-system.duck.dns.org}"
EMAIL="${CERTBOT_EMAIL:-admin@example.com}"
PROJECT_DIR="${HOME}/ollantayProject"

echo ""
echo "Dominio: $DOMAIN"
echo "Email: $EMAIL"
echo "Directorio: $PROJECT_DIR"
echo ""

# 1. Verificar que nginx está corriendo
echo "1️⃣ Verificando que nginx está corriendo..."
cd "$PROJECT_DIR"
if ! docker-compose ps reverse_proxy | grep -q "Up"; then
    echo "❌ Nginx no está corriendo. Iniciando servicios..."
    docker-compose up -d reverse_proxy
    sleep 5
fi
echo "✅ Nginx está corriendo"

# 2. Verificar que puerto 80 está accesible
echo ""
echo "2️⃣ Verificando acceso HTTP (puerto 80)..."
if curl -f -s "http://$DOMAIN/.well-known/acme-challenge/" > /dev/null 2>&1; then
    echo "✅ Puerto 80 accesible"
else
    echo "⚠️ Puerto 80 no responde. Verifica firewall:"
    echo "   sudo iptables -L -n | grep 80"
    echo "   sudo firewall-cmd --list-ports"
fi

# 3. Obtener certificado usando certbot container
echo ""
echo "3️⃣ Solicitando certificado SSL a Let's Encrypt..."
docker-compose run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --non-interactive \
    --force-renewal

if [ $? -eq 0 ]; then
    echo "✅ Certificado obtenido exitosamente"
else
    echo "❌ Error al obtener certificado. Verifica:"
    echo "   - Dominio apunta a esta IP"
    echo "   - Puerto 80 está abierto"
    echo "   - Nginx está sirviendo /.well-known/acme-challenge/"
    exit 1
fi

# 4. Verificar certificados generados
echo ""
echo "4️⃣ Verificando certificados generados..."
if [ -f "$PROJECT_DIR/reverse-proxy/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "✅ Certificado encontrado en: reverse-proxy/letsencrypt/live/$DOMAIN/"
    
    # Mostrar info del certificado
    openssl x509 -in "$PROJECT_DIR/reverse-proxy/letsencrypt/live/$DOMAIN/fullchain.pem" -noout -dates -subject
else
    echo "❌ Certificado no encontrado"
    exit 1
fi

# 5. Actualizar nginx.conf para usar Let's Encrypt
echo ""
echo "5️⃣ Actualizando nginx.conf..."
NGINX_CONF="$PROJECT_DIR/reverse-proxy/nginx.conf"

if grep -q "ssl_certificate.*dev.crt" "$NGINX_CONF"; then
    echo "⚠️ Nginx.conf todavía usa certificado dev"
    echo "   Edita manualmente: $NGINX_CONF"
    echo ""
    echo "   Cambia las líneas:"
    echo "   ssl_certificate     /etc/nginx/certs/dev.crt;"
    echo "   ssl_certificate_key /etc/nginx/certs/dev.key;"
    echo ""
    echo "   Por:"
    echo "   ssl_certificate     /etc/letsencrypt/live/$DOMAIN/fullchain.pem;"
    echo "   ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;"
    echo ""
    echo "   Luego ejecuta: docker-compose restart reverse_proxy"
else
    echo "✅ Nginx.conf ya configurado para Let's Encrypt"
fi

# 6. Reiniciar nginx
echo ""
echo "6️⃣ Reiniciando nginx..."
docker-compose restart reverse_proxy
sleep 3

if docker-compose ps reverse_proxy | grep -q "Up"; then
    echo "✅ Nginx reiniciado correctamente"
else
    echo "❌ Error al reiniciar nginx. Verifica logs:"
    echo "   docker logs reverse_proxy"
    exit 1
fi

# 7. Verificar SSL
echo ""
echo "7️⃣ Verificando SSL..."
echo "Probando: https://$DOMAIN"
if curl -f -s "https://$DOMAIN" > /dev/null 2>&1; then
    echo "✅ HTTPS funciona correctamente"
else
    echo "⚠️ HTTPS no responde. Verifica configuración nginx"
fi

echo ""
echo "======================================"
echo "✅ Setup SSL completado"
echo "======================================"
echo ""
echo "Próximos pasos:"
echo "1. Verifica en navegador: https://$DOMAIN"
echo "2. GitHub Actions renovará automáticamente cada semana"
echo "3. Certificado válido por 90 días"
echo ""
echo "Comandos útiles:"
echo "  docker-compose logs reverse_proxy    # Ver logs nginx"
echo "  docker-compose logs certbot          # Ver logs certbot"
echo "  docker exec reverse_proxy nginx -t   # Verificar sintaxis nginx"
echo ""
