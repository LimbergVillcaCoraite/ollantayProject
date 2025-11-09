# Script para aplicar permisos y roles en la base de datos
# Ejecutar desde el directorio raíz del proyecto

$ErrorActionPreference = "Stop"

Write-Host "======================================"  -ForegroundColor Cyan
Write-Host "🔐 Aplicando Permisos y Roles"  -ForegroundColor Cyan
Write-Host "======================================"  -ForegroundColor Cyan
Write-Host ""

# Verificar que el contenedor MySQL está corriendo
Write-Host "1️⃣ Verificando contenedor MySQL..." -ForegroundColor Yellow
$mysqlStatus = docker ps --filter "name=mysql_8_0_32" --format "{{.Status}}"

if (!$mysqlStatus) {
    Write-Host "❌ Contenedor MySQL no está corriendo" -ForegroundColor Red
    Write-Host "Ejecuta: docker-compose up -d mysql8032" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ MySQL corriendo: $mysqlStatus" -ForegroundColor Green
Write-Host ""

# Ejecutar script SQL
Write-Host "2️⃣ Ejecutando backend/roles.sql..." -ForegroundColor Yellow

try {
    $scriptPath = Join-Path $PSScriptRoot "..\backend\roles.sql"
    
    if (!(Test-Path $scriptPath)) {
        Write-Host "❌ Archivo no encontrado: $scriptPath" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "📄 Leyendo: $scriptPath" -ForegroundColor Gray
    $sqlContent = Get-Content $scriptPath -Raw -Encoding UTF8
    
    # Ejecutar SQL en el contenedor
    Write-Host "⚙️ Ejecutando SQL en MySQL..." -ForegroundColor Gray
    $sqlContent | docker exec -i mysql_8_0_32-containerSources mysql -u root -pP4assw@rd SystemaOllantay
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Script SQL ejecutado exitosamente" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Script ejecutado con advertencias (código: $LASTEXITCODE)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error ejecutando SQL: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Verificar permisos creados
Write-Host "3️⃣ Verificando permisos creados..." -ForegroundColor Yellow

$verifySQL = "SELECT r.name as role, COUNT(DISTINCT rp.perm_id) as permissions_count, GROUP_CONCAT(DISTINCT p.resource ORDER BY p.resource SEPARATOR ', ') as resources FROM role_O r LEFT JOIN role_permission_O rp ON r.idrole = rp.role_id LEFT JOIN permission_O p ON rp.perm_id = p.id_perm GROUP BY r.idrole, r.name ORDER BY r.idrole;"

Write-Host ""
Write-Host "Resumen de permisos por rol:" -ForegroundColor Cyan
echo $verifySQL | docker exec -i mysql_8_0_32-containerSources mysql -u root -pP4assw@rd SystemaOllantay

Write-Host ""
Write-Host "======================================"  -ForegroundColor Cyan
Write-Host "✅ Proceso completado" -ForegroundColor Green
Write-Host "======================================"  -ForegroundColor Cyan
Write-Host ""
Write-Host "Próximos pasos:" -ForegroundColor Yellow
Write-Host "1. Reinicia los servicios: docker-compose restart persona_service" -ForegroundColor White
Write-Host "2. Recarga la interfaz web (F5)" -ForegroundColor White
Write-Host "3. Ve a SuperAdmin → Roles para verificar los permisos" -ForegroundColor White
Write-Host ""
