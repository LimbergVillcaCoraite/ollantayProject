#!/bin/bash
# Script to issue Let's Encrypt certificate for production
# Usage: ./issue-cert.sh [domain]

DOMAIN="${1:-archsoft-system.duckdns.org}"

echo "=================================================="
echo "Issuing Let's Encrypt certificate for: $DOMAIN"
echo "=================================================="
echo ""
echo "Prerequisites:"
echo "  1. DNS for $DOMAIN must point to this server's public IP"
echo "  2. Ports 80 and 443 must be open in firewall"
echo "  3. Nginx must be running with HTTP webroot configured"
echo ""
read -p "Are you ready to proceed? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
# Check if we're in the right directory
if [ ! -f "../docker-compose.yml" ]; then
    echo "✗ Error: docker-compose.yml not found in parent directory"
    echo "  Please run this script from the reverse-proxy directory:"
    echo "  cd reverse-proxy && ./issue-cert.sh"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "../docker-compose.yml" ]; then
    echo "✗ Error: docker-compose.yml not found in parent directory"
    echo "  Please run this script from the reverse-proxy directory:"
    echo "  cd reverse-proxy && ./issue-cert.sh"
    exit 1
fi

echo "Creating webroot directory if not exists..."
mkdir -p ./certbot-www/.well-known/acme-challenge

echo ""
echo "Testing webroot access (should return 200)..."
echo "test" > ./certbot-www/.well-known/acme-challenge/test.txt
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN/.well-known/acme-challenge/test.txt)
if [ "$HTTP_CODE" != "200" ]; then
    echo "⚠️  WARNING: Webroot test failed (HTTP $HTTP_CODE)"
    echo "   Make sure Nginx is running and serving /.well-known/acme-challenge/"
    echo "   Continuing anyway..."
else
    echo "✓ Webroot accessible (HTTP 200)"
fi
rm -f ./certbot-www/.well-known/acme-challenge/test.txt

echo ""
echo "Running certbot to obtain certificate..."
echo "Command: docker compose -f ../docker-compose.yml run --rm --entrypoint certbot certbot certonly ..."
echo ""

cd ..
docker compose run --rm --entrypoint certbot certbot certonly \
    --webroot \
    -w /var/www/certbot \
    -d "$DOMAIN" \
    --agree-tos \
    --register-unsafely-without-email \
    --non-interactive

CERTBOT_EXIT=$?
cd reverse-proxy

if [ $CERTBOT_EXIT -eq 0 ]; then
    echo ""
    echo "=================================================="
    echo "✓ Certificate issued successfully!"
    echo "=================================================="
    echo ""
    echo "Certificate files are in:"
    echo "  ./letsencrypt/live/$DOMAIN/fullchain.pem"
    echo "  ./letsencrypt/live/$DOMAIN/privkey.pem"
    echo ""
    echo "Next steps:"
    echo "  1. Run the switch-to-prod script:"
    echo "     ./switch-to-prod.sh $DOMAIN"
    echo ""
    echo "  OR manually:"
    echo "  1. Edit docker-compose.yml to use nginx.prod.conf:"
    echo "     Change: ./reverse-proxy/nginx.conf:/etc/nginx/nginx.conf:ro"
    echo "     To:     ./reverse-proxy/nginx.prod.conf:/etc/nginx/nginx.conf:ro"
    echo ""
    echo "  2. Restart reverse proxy:"
    echo "     docker compose restart reverse_proxy"
    echo ""
    echo "  3. Verify HTTPS:"
    echo "     curl https://$DOMAIN/healthz"
    echo ""
else
    echo ""
    echo "=================================================="
    echo "✗ Certificate issuance failed"
    echo "=================================================="
    echo ""
    echo "Common issues:"
    echo "  - DNS not pointing to this server"
    echo "  - Firewall blocking ports 80/443"
    echo "  - Nginx not serving /.well-known/acme-challenge/"
    echo "  - Domain already has rate limit (Let's Encrypt)"
    echo ""
    echo "Check logs with: docker compose logs certbot"
    exit 1
fi
