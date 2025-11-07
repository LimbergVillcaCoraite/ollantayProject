#!/bin/bash
# Quick diagnostic script to verify SSL certificate requirements
# Usage: ./check-ssl-ready.sh [domain]

DOMAIN="${1:-archsoft-system.duckdns.org}"

echo "=================================================="
echo "SSL Certificate Readiness Check"
echo "Domain: $DOMAIN"
echo "=================================================="
echo ""

FAILED=0

# 1. Check DNS resolution
echo "[1/6] Checking DNS resolution..."
DNS_IP=$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1}')
if [ -z "$DNS_IP" ]; then
    echo "    ✗ FAILED: Domain does not resolve"
    echo "      Fix: Update DuckDNS or your DNS provider"
    FAILED=$((FAILED+1))
else
    echo "    ✓ Domain resolves to: $DNS_IP"
fi
echo ""

# 2. Check if it's our public IP
echo "[2/6] Checking public IP..."
PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s icanhazip.com 2>/dev/null)
if [ -z "$PUBLIC_IP" ]; then
    echo "    ⚠️  WARNING: Could not determine public IP"
else
    echo "    Public IP: $PUBLIC_IP"
    if [ "$DNS_IP" = "$PUBLIC_IP" ]; then
        echo "    ✓ DNS points to this server"
    else
        echo "    ✗ FAILED: DNS IP ($DNS_IP) != Public IP ($PUBLIC_IP)"
        echo "      Fix: Update DuckDNS to point to $PUBLIC_IP"
        FAILED=$((FAILED+1))
    fi
fi
echo ""

# 3. Check Docker Compose
echo "[3/6] Checking Docker Compose..."
if ! docker compose version >/dev/null 2>&1; then
    echo "    ✗ FAILED: docker compose not available"
    FAILED=$((FAILED+1))
else
    echo "    ✓ docker compose available"
fi
echo ""

# 4. Check reverse_proxy running
echo "[4/6] Checking reverse_proxy container..."
if docker compose ps reverse_proxy 2>/dev/null | grep -q "Up"; then
    echo "    ✓ reverse_proxy is running"
else
    echo "    ✗ FAILED: reverse_proxy not running"
    echo "      Fix: cd .. && docker compose up -d reverse_proxy"
    FAILED=$((FAILED+1))
fi
echo ""

# 5. Check webroot directory
echo "[5/6] Checking webroot directory..."
if [ -d "./certbot-www/.well-known/acme-challenge" ]; then
    echo "    ✓ Webroot directory exists"
else
    echo "    ⚠️  Creating webroot directory..."
    mkdir -p ./certbot-www/.well-known/acme-challenge
fi
echo ""

# 6. Check HTTP access from outside
echo "[6/6] Checking HTTP accessibility..."
echo "test-$(date +%s)" > ./certbot-www/.well-known/acme-challenge/test.txt
echo "    Testing: http://$DOMAIN/.well-known/acme-challenge/test.txt"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN/.well-known/acme-challenge/test.txt" 2>/dev/null)
if [ "$HTTP_CODE" = "200" ]; then
    echo "    ✓ HTTP webroot is accessible (HTTP $HTTP_CODE)"
else
    echo "    ✗ FAILED: HTTP webroot returned HTTP $HTTP_CODE"
    echo "      Expected: 200"
    echo "      Fix: Check nginx logs and firewall (port 80)"
    FAILED=$((FAILED+1))
fi
rm -f ./certbot-www/.well-known/acme-challenge/test.txt
echo ""

# Summary
echo "=================================================="
if [ $FAILED -eq 0 ]; then
    echo "✓ All checks passed! Ready to issue certificate."
    echo ""
    echo "Next step:"
    echo "  ./issue-cert.sh $DOMAIN"
else
    echo "✗ $FAILED check(s) failed. Fix the issues above first."
    echo ""
    echo "Common fixes:"
    echo "  - DNS: Update DuckDNS with your public IP"
    echo "  - Firewall: sudo ufw allow 80/tcp && sudo ufw allow 443/tcp"
    echo "  - Docker: cd .. && docker compose up -d"
fi
echo "=================================================="
