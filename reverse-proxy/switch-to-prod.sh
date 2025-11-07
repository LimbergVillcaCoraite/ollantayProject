#!/bin/bash
# Script to switch from dev certificates to production Let's Encrypt certificates
# Run this AFTER issuing certificates with issue-cert.sh

DOMAIN="${1:-archsoft-system.duckdns.org}"

echo "=================================================="
echo "Switching to Production SSL Certificates"
echo "=================================================="

# Check if LE certificates exist
if [ ! -f "./letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    echo "✗ Let's Encrypt certificates not found!"
    echo "  Expected: ./letsencrypt/live/$DOMAIN/fullchain.pem"
    echo ""
    echo "Run ./issue-cert.sh first to obtain certificates."
    exit 1
fi

echo "✓ Let's Encrypt certificates found"
echo ""

# Backup current docker-compose.yml
if [ ! -f "docker-compose.yml.backup" ]; then
    echo "Creating backup: docker-compose.yml.backup"
    cp ../docker-compose.yml ../docker-compose.yml.backup
fi

# Update docker-compose.yml to use nginx.prod.conf
echo "Updating docker-compose.yml to use nginx.prod.conf..."
cd ..
sed -i 's|./reverse-proxy/nginx.conf:/etc/nginx/nginx.conf:ro|./reverse-proxy/nginx.prod.conf:/etc/nginx/nginx.conf:ro|g' docker-compose.yml

if grep -q "nginx.prod.conf" docker-compose.yml; then
    echo "✓ docker-compose.yml updated"
else
    echo "⚠️  Failed to update docker-compose.yml"
    echo "   Please manually edit docker-compose.yml:"
    echo "   Change: ./reverse-proxy/nginx.conf:/etc/nginx/nginx.conf:ro"
    echo "   To:     ./reverse-proxy/nginx.prod.conf:/etc/nginx/nginx.conf:ro"
    exit 1
fi

echo ""
echo "Restarting reverse_proxy with production configuration..."
docker compose restart reverse_proxy

if [ $? -eq 0 ]; then
    echo ""
    echo "=================================================="
    echo "✓ Successfully switched to production SSL!"
    echo "=================================================="
    echo ""
    echo "Verifying HTTPS..."
    sleep 3
    
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN/healthz 2>/dev/null)
    if [ "$HTTP_CODE" = "200" ]; then
        echo "✓ HTTPS is working! (HTTP $HTTP_CODE)"
        echo ""
        echo "Your system is now running with Let's Encrypt certificates."
        echo "Certificates will auto-renew every 12 hours."
    else
        echo "⚠️  HTTPS verification returned HTTP $HTTP_CODE"
        echo "   Check logs: docker compose logs reverse_proxy"
    fi
else
    echo "✗ Failed to restart reverse_proxy"
    echo "  Restoring backup..."
    cp docker-compose.yml.backup docker-compose.yml
    docker compose restart reverse_proxy
    exit 1
fi
