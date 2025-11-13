# Ollantay Mobile - Setup Script
# PowerShell script para instalar y configurar la app movil

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Ollantay Mobile Setup" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Verificar Node.js
Write-Host "Verificando Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "  Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  Error: Node.js no esta instalado" -ForegroundColor Red
    Write-Host "  Instalar desde: https://nodejs.org" -ForegroundColor Yellow
    exit 1
}

# Verificar npm
Write-Host "Verificando npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "  npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  Error: npm no esta instalado" -ForegroundColor Red
    exit 1
}

# Cambiar al directorio mobile
Write-Host ""
Write-Host "Navegando a directorio mobile..." -ForegroundColor Yellow
Set-Location mobile

# Instalar dependencias
Write-Host ""
Write-Host "Instalando dependencias..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "  Error: Fallo la instalacion de dependencias" -ForegroundColor Red
    exit 1
}

Write-Host "  Dependencias instaladas correctamente" -ForegroundColor Green

# Crear archivo .env si no existe
if (-not (Test-Path ".env")) {
    Write-Host ""
    Write-Host "Configurando archivo .env..." -ForegroundColor Yellow
    
    # Obtener IP local
    $ipAddress = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254.*"} | Select-Object -First 1).IPAddress
    
    if ($ipAddress) {
        Write-Host "  IP detectada: $ipAddress" -ForegroundColor Cyan
        $useIP = Read-Host "  Usar esta IP? (S/n)"
        
        if ($useIP -ne "n" -and $useIP -ne "N") {
            $apiUrl = "http://${ipAddress}:3000"
        } else {
            $customIP = Read-Host "  Ingrese la IP manualmente"
            $apiUrl = "http://${customIP}:3000"
        }
    } else {
        Write-Host "  No se pudo detectar IP automaticamente" -ForegroundColor Yellow
        $customIP = Read-Host "  Ingrese la IP del servidor"
        $apiUrl = "http://${customIP}:3000"
    }
    
    # Crear archivo .env
    @"
# API Configuration
API_BASE_URL=$apiUrl
API_TIMEOUT=30000

# Environment
NODE_ENV=development
"@ | Out-File -FilePath ".env" -Encoding UTF8
    
    Write-Host "  Archivo .env creado correctamente" -ForegroundColor Green
    Write-Host "  API URL: $apiUrl" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "Archivo .env ya existe" -ForegroundColor Green
}

# Verificar backend
Write-Host ""
Write-Host "Verificando backend..." -ForegroundColor Yellow
$envContent = Get-Content ".env" | Out-String
$apiUrl = ($envContent -split "`n" | Where-Object {$_ -match "^API_BASE_URL="}) -replace "API_BASE_URL=", ""

try {
    $response = Invoke-WebRequest -Uri "$apiUrl/api/persona/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "  Backend accesible en $apiUrl" -ForegroundColor Green
} catch {
    Write-Host "  Advertencia: No se pudo conectar al backend" -ForegroundColor Yellow
    Write-Host "  Asegurate de que Docker este corriendo: docker-compose up -d" -ForegroundColor Yellow
}

# Instrucciones finales
Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Setup completado!" -ForegroundColor Green
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Para iniciar la app:" -ForegroundColor Yellow
Write-Host "  npm start" -ForegroundColor White
Write-Host ""
Write-Host "Luego escanea el codigo QR con Expo Go en tu dispositivo" -ForegroundColor Yellow
Write-Host ""
