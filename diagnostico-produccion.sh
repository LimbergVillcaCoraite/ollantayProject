#!/bin/bash
# Script de diagnóstico para servidor de producción
# Ejecutar con: bash diagnostico-produccion.sh

echo "=== DIAGNÓSTICO SERVIDOR OLLANTAY ==="
echo ""

echo "1. ✅ Estado de Docker:"
systemctl status docker | head -n 5
echo ""

echo "2. 🐳 Contenedores en ejecución:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo "3. 🔍 Logs del reverse proxy (últimas 20 líneas):"
docker logs --tail 20 ollantay_reverse_proxy 2>&1
echo ""

echo "4. 🌐 Puertos en escucha:"
netstat -tlnp | grep -E ':(80|443|3000|8001|8002|8003)'
echo ""

echo "5. 🔥 Reglas de firewall (iptables):"
sudo iptables -L INPUT -n --line-numbers | grep -E '(80|443|dpt:80|dpt:443)'
echo ""

echo "6. 📦 Estado de contenedores clave:"
for container in ollantay_reverse_proxy ollantay_frontend persona_service; do
    echo "  - $container:"
    docker inspect $container --format '{{.State.Status}}' 2>/dev/null || echo "    ❌ No encontrado"
done
echo ""

echo "7. 🧪 Test de conectividad interna:"
echo "  - Frontend (localhost:3000):"
curl -s -o /dev/null -w "    HTTP %{http_code} - %{time_total}s\n" http://localhost:3000 || echo "    ❌ No responde"
echo "  - Reverse proxy (localhost:80):"
curl -s -o /dev/null -w "    HTTP %{http_code} - %{time_total}s\n" http://localhost || echo "    ❌ No responde"
echo ""

echo "8. 🔑 Certificados SSL:"
ls -lh /ruta/al/proyecto/reverse-proxy/certs/ 2>/dev/null || echo "  ⚠️  Directorio de certificados no encontrado"
echo ""

echo "=== FIN DIAGNÓSTICO ==="
echo ""
echo "📋 Acciones recomendadas:"
echo "   - Si los contenedores no están corriendo: docker-compose up -d"
echo "   - Si el puerto 443 está bloqueado: sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT"
echo "   - Si es Oracle Cloud: sudo netfilter-persistent save"
