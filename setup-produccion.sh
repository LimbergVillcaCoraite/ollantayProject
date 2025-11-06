# Script de configuración inicial para servidor de producción Oracle Cloud
# Ejecutar con privilegios de administrador: sudo bash setup-produccion.sh

echo "🚀 Configurando servidor de producción Ollantay en Oracle Cloud..."
echo ""

# 1. Abrir puertos en iptables (Oracle Cloud)
echo "📡 Abriendo puertos 80, 443 y 3000 en iptables..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT

# Guardar reglas de iptables
echo "💾 Guardando reglas de iptables..."
if command -v netfilter-persistent &> /dev/null; then
    sudo netfilter-persistent save
elif [ -f /etc/oracle-cloud-agent/iptables-save ]; then
    sudo service iptables save
else
    sudo iptables-save | sudo tee /etc/iptables/rules.v4
fi

# 2. Si usa firewalld (CentOS/RHEL)
if command -v firewall-cmd &> /dev/null; then
    echo "🔥 Configurando firewalld..."
    sudo firewall-cmd --permanent --add-service=http
    sudo firewall-cmd --permanent --add-service=https
    sudo firewall-cmd --permanent --add-port=3000/tcp
    sudo firewall-cmd --reload
fi

# 3. Verificar Docker
echo "🐳 Verificando Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose no está instalado"
    exit 1
fi

# 4. Iniciar contenedores
echo "📦 Iniciando contenedores..."
docker-compose up -d

# 5. Esperar y verificar
echo "⏳ Esperando 10 segundos para que los servicios inicien..."
sleep 10

echo ""
echo "✅ Configuración completada"
echo ""
echo "⚠️  IMPORTANTE: También debes configurar Security List en Oracle Cloud:"
echo ""
echo "   1. Ve a: https://cloud.oracle.com"
echo "   2. Networking → Virtual Cloud Networks → Tu VCN"
echo "   3. Security Lists → Default Security List"
echo "   4. Agregar Ingress Rules:"
echo "      - Source CIDR: 0.0.0.0/0"
echo "      - Destination Port: 80"
echo "      - Protocol: TCP"
echo ""
echo "      - Source CIDR: 0.0.0.0/0"
echo "      - Destination Port: 443"
echo "      - Protocol: TCP"
echo ""
echo "📊 Estado de servicios:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "🧪 Prueba de acceso:"
echo "   - HTTP local: curl http://localhost"
echo "   - HTTPS local: curl -k https://localhost"
echo "   - Externo: http://archsoft-system.duckdns.org"
echo ""
echo "📝 Logs del reverse proxy:"
echo "   docker logs ollantay_reverse_proxy"
