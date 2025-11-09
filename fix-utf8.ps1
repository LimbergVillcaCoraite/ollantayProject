# Script PowerShell para agregar charset UTF-8 a todos los servicios
$services = @(
    "backend\prestamo_service\main.py",
    "backend\tipo_persona_service\main.py",
    "backend\venta_service\main.py",
    "backend\proveedores_service\main.py",
    "backend\rutas_service\main.py",
    "backend\cuentas_service\main.py",
    "backend\entregas_service\main.py"
)

$oldPattern = "        database=os.getenv\('DATABASE_NAME', 'SystemaOllantay'\),`n    \)"
$newPattern = "        database=os.getenv('DATABASE_NAME', 'SystemaOllantay'),`n        charset='utf8mb4',`n        use_unicode=True`n    )"

foreach ($service in $services) {
    if (Test-Path $service) {
        $content = Get-Content $service -Raw -Encoding UTF8
        
        # Verificar si ya tiene charset
        if ($content -notmatch "charset='utf8mb4'") {
            $content = $content -replace "database=os\.getenv\('DATABASE_NAME', 'SystemaOllantay'\),\s*\)", "database=os.getenv('DATABASE_NAME', 'SystemaOllantay'),`n        charset='utf8mb4',`n        use_unicode=True`n    )"
            Set-Content $service -Value $content -Encoding UTF8 -NoNewline
            Write-Host "✅ Fixed $service" -ForegroundColor Green
        } else {
            Write-Host "✓  $service already OK" -ForegroundColor Gray
        }
    } else {
        Write-Host "⚠️  Skipping $service - not found" -ForegroundColor Yellow
    }
}

Write-Host "`n🎉 UTF-8 fix applied!" -ForegroundColor Cyan
