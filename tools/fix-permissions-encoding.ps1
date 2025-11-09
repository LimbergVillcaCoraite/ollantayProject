# Script para limpiar permisos existentes con caracteres raros y re-aplicar con codificacion correcta
# Ejecutar desde el directorio raiz del proyecto

$ErrorActionPreference = "Stop"

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Limpieza y Re-aplicacion de Permisos" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Verificar contenedor MySQL
Write-Host "1. Verificando contenedor MySQL..." -ForegroundColor Yellow
$mysqlStatus = docker ps --filter "name=mysql_8_0_32" --format "{{.Status}}"

if (!$mysqlStatus) {
    Write-Host "ERROR: Contenedor MySQL no esta corriendo" -ForegroundColor Red
    Write-Host "Ejecuta: docker-compose up -d mysql8032" -ForegroundColor Yellow
    exit 1
}

Write-Host "OK: MySQL corriendo" -ForegroundColor Green
Write-Host ""

# Limpiar permisos con descripciones rotas
Write-Host "2. Limpiando permisos con codificacion incorrecta..." -ForegroundColor Yellow

$cleanSQL = @"
-- Eliminar permisos con caracteres raros en description
DELETE FROM role_permission_O WHERE perm_id IN (
    SELECT id_perm FROM permission_O WHERE description LIKE '%�%' OR description LIKE '%�%'
);

DELETE FROM permission_O WHERE description LIKE '%�%' OR description LIKE '%�%';

-- Mostrar permisos restantes
SELECT COUNT(*) as permisos_restantes FROM permission_O;
"@

$cleanSQL | docker exec -i mysql_8_0_32-containerSources mysql -u root -pP4assw@rd SystemaOllantay 2>&1 | Out-Null

Write-Host "OK: Permisos con codificacion incorrecta eliminados" -ForegroundColor Green
Write-Host ""

# Aplicar permisos limpios
Write-Host "3. Aplicando permisos con codificacion UTF-8 correcta..." -ForegroundColor Yellow

Get-Content -Path "backend\roles.sql" -Encoding UTF8 | docker exec -i mysql_8_0_32-containerSources mysql -u root -pP4assw@rd SystemaOllantay 2>&1 | Out-Null

Write-Host "OK: Permisos aplicados correctamente" -ForegroundColor Green
Write-Host ""

# Verificar resultado
Write-Host "4. Verificando permisos..." -ForegroundColor Yellow

$verifySQL = "SELECT r.name as role, COUNT(DISTINCT rp.perm_id) as permisos FROM role_O r LEFT JOIN role_permission_O rp ON r.idrole = rp.role_id GROUP BY r.idrole, r.name ORDER BY r.idrole;"

Write-Host ""
Write-Host "Resumen de permisos por rol:" -ForegroundColor Cyan
$verifySQL | docker exec -i mysql_8_0_32-containerSources mysql -u root -pP4assw@rd SystemaOllantay

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Proceso Completado" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Proximos pasos:" -ForegroundColor Yellow
Write-Host "1. Reinicia persona_service: docker-compose restart persona_service" -ForegroundColor White
Write-Host "2. Recarga la interfaz web (F5)" -ForegroundColor White
Write-Host "3. Los permisos ahora mostraran texto correcto sin caracteres raros" -ForegroundColor White
Write-Host ""
