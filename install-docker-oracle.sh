#!/bin/bash
# Script de instalación completa para Oracle Cloud Ubuntu
# Ejecutar con: sudo bash install-docker-oracle.sh

set -e  # Salir si hay error

echo "🚀 Instalación completa de Docker y Sistema Ollantay en Oracle Cloud"
echo "=================================================================="
echo ""

# 1. Actualizar sistema
echo "📦 Actualizando sistema..."
sudo apt-get update -y

# 2. Instalar prerequisitos
echo "📦 Instalando prerequisitos..."
sudo apt-get install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git

# 3. Agregar repositorio oficial de Docker
echo "🐳 Configurando repositorio de Docker..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# 4. Instalar Docker
echo "🐳 Instalando Docker..."
sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# 5. Agregar usuario al grupo docker
echo "👤 Configurando permisos de Docker..."
sudo usermod -aG docker $USER

# 6. Instalar docker-compose standalone
echo "📦 Instalando docker-compose..."
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 7. Iniciar Docker
echo "▶️  Iniciando Docker..."
sudo systemctl start docker
sudo systemctl enable docker

# 8. Verificar instalación
echo ""
echo "✅ Verificando instalación de Docker..."
docker --version
docker-compose --version

# 9. Configurar iptables para Oracle Cloud
echo ""
echo "🔥 Configurando firewall (iptables)..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT

# 10. Instalar iptables-persistent para guardar reglas
echo "💾 Instalando iptables-persistent..."
echo iptables-persistent iptables-persistent/autosave_v4 boolean true | sudo debconf-set-selections
echo iptables-persistent iptables-persistent/autosave_v6 boolean true | sudo debconf-set-selections
sudo apt-get install -y iptables-persistent

# 11. Guardar reglas
sudo netfilter-persistent save

echo ""
echo "=================================================================="
echo "✅ ¡Instalación completada!"
echo "=================================================================="
echo ""
echo "📋 Próximos pasos:"
echo ""
echo "1. CERRAR SESIÓN SSH y volver a conectar para aplicar permisos:"
echo "   exit"
echo "   ssh ubuntu@129.151.98.178"
echo ""
echo "2. Ir al directorio del proyecto y descargar código:"
echo "   cd ~"
echo "   git clone https://github.com/LimbergVillcaCoraite/ollantayProject.git"
echo "   cd ollantayProject"
echo ""
echo "3. Iniciar servicios:"
echo "   docker-compose up -d"
echo ""
echo "4. Verificar servicios:"
echo "   docker ps"
echo ""
echo "5. Ver logs:"
echo "   docker-compose logs -f"
echo ""
echo "⚠️  IMPORTANTE: También configura Security List en Oracle Cloud:"
echo "   https://cloud.oracle.com → Networking → VCN → Security Lists"
echo "   Agregar reglas Ingress para puertos 80 y 443"
echo ""
