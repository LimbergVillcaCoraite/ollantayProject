#!/bin/bash
# Script to manually renew Let's Encrypt certificates
# The certbot container already runs automatic renewal every 12h
# Use this for manual/forced renewal

echo "=================================================="
echo "Renewing Let's Encrypt certificates..."
echo "=================================================="

docker compose run --rm certbot certbot renew \
    --webroot \
    -w /var/www/certbot \
    --non-interactive

if [ $? -eq 0 ]; then
    echo ""
    echo "✓ Certificate renewal successful"
    echo ""
    echo "Reloading Nginx to apply new certificates..."
    docker compose exec reverse_proxy nginx -s reload
    
    if [ $? -eq 0 ]; then
        echo "✓ Nginx reloaded successfully"
        echo ""
        echo "HTTPS certificates updated and active!"
    else
        echo "⚠️  Failed to reload Nginx"
        echo "   Try manually: docker compose restart reverse_proxy"
    fi
else
    echo ""
    echo "⚠️  Certificate renewal failed or no renewal needed"
    echo "   Certificates are valid for 90 days and renew automatically"
    echo "   Check logs: docker compose logs certbot"
fi
