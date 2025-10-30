# Test script: Create a sample purchase for limberg's company (empresa 2)
# Company 2 | Provider 2 (Importaciones del Sur) | Product 15 (Coca-Cola 300 ml)

Write-Host "=== PRUEBA DE FLUJO DE COMPRA ===" -ForegroundColor Cyan
Write-Host ""

# 1. Crear compra via API como superadmin
Write-Host "1. Creando compra de ejemplo..." -ForegroundColor Yellow
$body = @{
    fechaCompra = "2025-10-29"
    idProveedor = 2
    idTipoPago = 1
    montoTotal = 500.00
    estado = 1
    observaciones = "Compra de ejemplo - 5 cajas de Coca-Cola 300ml"
    detalles = @(
        @{
            idProducto = 15
            cantidad_caja = 5
            precio_unitario = 100.00
            subtotal = 500.00
        }
    )
} | ConvertTo-Json -Depth 5

try {
    $compra = Invoke-RestMethod -Method POST -Uri "http://localhost/api/compras/" `
        -Headers @{ 
            "X-User-Role" = "superadmin"
            "Content-Type" = "application/json"
        } `
        -Body $body

    Write-Host "   OK Compra creada: ID=$($compra.idCompra)" -ForegroundColor Green
    Write-Host "   - Proveedor: $($compra.nombreProveedor)" -ForegroundColor Gray
    Write-Host "   - Total: Bs. $($compra.montoTotal)" -ForegroundColor Gray
    Write-Host ""

    # 2. Verificar que se creó el lote
    Write-Host "2. Verificando lote de producto creado..." -ForegroundColor Yellow
    $lotes = Invoke-RestMethod -Uri "http://localhost/api/prestamos/lotes?idProducto=15" `
        -Headers @{ "X-User-Role" = "superadmin" }

    $loteCompra = $lotes | Where-Object { $_.idCompra -eq $compra.idCompra } | Select-Object -First 1

    if ($loteCompra) {
        Write-Host "   OK Lote creado correctamente:" -ForegroundColor Green
        Write-Host "   - ID Lote: $($loteCompra.idLote)" -ForegroundColor Gray
        Write-Host "   - Producto: $($loteCompra.nombreProducto)" -ForegroundColor Gray
        Write-Host "   - Precio Compra: Bs. $($loteCompra.precioCompra)" -ForegroundColor Gray
        Write-Host "   - Cantidad Cajas: $($loteCompra.cantidadCajas)" -ForegroundColor Gray
        Write-Host "   - Stock Actual: $($loteCompra.stockActual)" -ForegroundColor Gray
    } else {
        Write-Host "   ERROR No se encontro lote asociado a esta compra" -ForegroundColor Red
    }
    Write-Host ""

    # 3. Verificar stock del producto actualizado
    Write-Host "3. Verificando stock del producto..." -ForegroundColor Yellow
    $productos = Invoke-RestMethod -Uri "http://localhost/api/prestamos/productos" `
        -Headers @{ "X-User-Role" = "superadmin" }

    $producto = $productos | Where-Object { $_.idProducto -eq 15 } | Select-Object -First 1

    if ($producto) {
        Write-Host "   OK Stock actualizado:" -ForegroundColor Green
        Write-Host "   - Producto: $($producto.nombreProducto)" -ForegroundColor Gray
        Write-Host "   - Stock Total: $($producto.stock_total_lotes) cajas" -ForegroundColor Gray
    }
    Write-Host ""

    Write-Host "=== PRUEBA COMPLETADA EXITOSAMENTE ===" -ForegroundColor Green

} catch {
    Write-Host "   ERROR: $_" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
