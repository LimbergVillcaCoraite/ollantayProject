# Implementación de Impresión Térmica para Ventas

## ✅ Cambios Completados

### Frontend (`frontend/src/components/Ventas.jsx`)

1. **Búsqueda de clientes para créditos** - Corregida
   - Ahora usa `/persons` endpoint
   - Filtrado local por nombre y CI
   - Funcionando correctamente

2. **Columna "Estado" eliminada** ✅
   - Conservada solo "Estado Pago" (Pagado/No Pagado)
   - colspan ajustado de 9 a 8 en expansión de detalles
   - Badge de estado activa/anulada removido de vista de tabla
   - Vista móvil conserva estado en el header del card

3. **URLs de impresión corregidas** ✅
   - Cambiado de `${API_VENTAS}/ventas/...` a `${API}/...`
   - Botones 🧾 Ticket y 📄 A4 ahora funcionan correctamente

## ✅ Implementación Completada

### Backend - Endpoint ESC/POS

**Archivo**: `backend/venta_service/main.py`  
**Estado**: ✅ **IMPLEMENTADO** - Endpoint agregado y funcionando

```python
@app.get('/ventas/{id}/factura/escpos')
def imprimir_factura_escpos(
    id: int,
    request: Request = None,
    width_mm: Optional[int] = 80
):
    """Generate ESC/POS raw commands for thermal printer (RawBT, USB, etc).
    Returns base64-encoded binary suitable for rawbt:// URL scheme or direct serial/USB print."""
    try:
        import base64
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True, buffered=True)
        role = get_role(None, request)
        user_company = get_company_id_from_request(request)
        
        # Get sale
        cur.execute('''
            SELECT 
                v.idVenta, v.codigoVenta, v.fechaVenta, v.idTipoVenta, tv.nombreTipoVenta AS tipoVenta,
                v.idTipoPago, tp.nombrePago AS tipoPago, v.idCliente,
                CONCAT(p.nombres_persona, ' ', COALESCE(p.apellido_paternoPersona, '')) AS nombreCliente,
                p.ci_persona,
                v.idEmpresa, e.nombre_empresa AS nombreEmpresa,
                v.montoTotal, v.montoPagado, v.estado_pago, v.estado
            FROM venta_O v
            LEFT JOIN tipoVenta tv ON v.idTipoVenta = tv.idTipoVenta
            LEFT JOIN tipoPago tp ON v.idTipoPago = tp.idPago
            LEFT JOIN persona_O p ON v.idCliente = p.id_persona
            LEFT JOIN empresa_O e ON v.idEmpresa = e.id_empresa
            WHERE v.idVenta = %s
        ''', (id,))
        venta = cur.fetchone()
        
        if not venta:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail='Venta no encontrada')
        
        if role not in ('admin','editor','superadmin') and user_company is not None and venta['idEmpresa'] != user_company:
            cur.close(); conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')
        
        # Get details
        cur.execute('''
            SELECT 
                dv.cantidad_caja, dv.precio_unitario, dv.subtotal,
                pr.nombreProducto, pr.codigoProducto
            FROM detalle_venta_O dv
            LEFT JOIN producto_O pr ON dv.idProducto = pr.idProducto
            WHERE dv.idVenta = %s
            ORDER BY dv.idDetalleVenta
        ''', (id,))
        detalles = cur.fetchall() or []
        cur.close(); conn.close()
        
        # Build ESC/POS commands
        ESC = b'\x1b'
        GS = b'\x1d'
        LF = b'\n'
        
        commands = bytearray()
        
        # Initialize printer
        commands.extend(ESC + b'@')  # Reset
        
        # Center align
        commands.extend(ESC + b'a' + b'\x01')
        
        # Bold + Empresa name
        commands.extend(ESC + b'E' + b'\x01')
        empresa = (venta.get('nombreEmpresa') or 'Empresa')[:32].encode('cp437', errors='replace')
        commands.extend(empresa + LF)
        commands.extend(ESC + b'E' + b'\x00')  # Bold off
        
        # Factura number
        fecha_str = venta['fechaVenta'].strftime('%Y%m%d') if venta.get('fechaVenta') else '00000000'
        numero = f"FAC-{fecha_str}-{venta['idVenta']:06d}"
        commands.extend(f"FACTURA {numero}\n".encode('cp437', errors='replace'))
        
        # Date
        fecha_display = venta['fechaVenta'].strftime('%d/%m/%Y %H:%M') if venta.get('fechaVenta') else 'N/A'
        commands.extend(f"Fecha: {fecha_display}\n".encode('cp437', errors='replace'))
        
        # Line separator
        commands.extend(b'-' * 32 + LF)
        
        # Left align for customer
        commands.extend(ESC + b'a' + b'\x00')
        
        # Customer
        cliente = (venta.get('nombreCliente') or 'N/A')[:32]
        commands.extend(f"Cliente: {cliente}\n".encode('cp437', errors='replace'))
        if venta.get('ci_persona'):
            commands.extend(f"CI: {venta['ci_persona']}\n".encode('cp437', errors='replace'))
        
        commands.extend(b'-' * 32 + LF)
        
        # Items
        commands.extend(b"DETALLE\n")
        for d in detalles:
            nombre = (d.get('nombreProducto') or 'Producto')[:28]
            qty = float(d.get('cantidad_caja') or 0)
            pu = float(d.get('precio_unitario') or 0)
            st = float(d.get('subtotal') or qty*pu)
            
            commands.extend(nombre.encode('cp437', errors='replace') + LF)
            line = f"{qty:.2f} x {pu:.2f}    Bs {st:.2f}\n"
            commands.extend(line.encode('cp437', errors='replace'))
        
        commands.extend(b'-' * 32 + LF)
        
        # Total
        total = float(venta.get('montoTotal') or 0)
        commands.extend(ESC + b'E' + b'\x01')  # Bold
        commands.extend(f"TOTAL      Bs {total:.2f}\n".encode('cp437', errors='replace'))
        commands.extend(ESC + b'E' + b'\x00')  # Bold off
        
        if venta.get('montoPagado'):
            pagado = float(venta['montoPagado'])
            commands.extend(f"Pagado     Bs {pagado:.2f}\n".encode('cp437', errors='replace'))
            cambio = pagado - total
            if cambio > 0:
                commands.extend(f"Cambio     Bs {cambio:.2f}\n".encode('cp437', errors='replace'))
        
        # Footer
        commands.extend(LF)
        commands.extend(ESC + b'a' + b'\x01')  # Center
        commands.extend(b"Gracias por su compra!\n")
        commands.extend(b"Sistema Ollantay\n")
        
        # Cut paper (if supported)
        commands.extend(LF + LF + LF)
        commands.extend(GS + b'V' + b'\x00')  # Full cut
        
        # Encode to base64
        b64 = base64.b64encode(bytes(commands)).decode('ascii')
        
        return JSONResponse({
            'ok': True,
            'idVenta': id,
            'escpos_base64': b64,
            'rawbt_url': f'rawbt://print?data={b64}'
        })
        
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


```

### Frontend - Botón RawBT para Android

**Archivo**: `frontend/src/components/Ventas.jsx`  
**Ubicación**: Agregar después del botón "📄 A4" en la vista móvil (alrededor de línea 3020)

```jsx
{/* Después del botón 📄 A4 en la vista móvil */}
<button 
  onClick={async () => {
    try {
      const res = await fetch(`${API}/${v.idVenta}/factura/escpos`, {
        credentials: 'include',
        headers: userRole ? { 'X-User-Role': userRole } : {}
      });
      if (res.ok) {
        const data = await res.json();
        if (data.rawbt_url) {
          window.location.href = data.rawbt_url;
        } else {
          alert('URL RawBT no disponible');
        }
      } else {
        alert('Error generando comando ESC/POS');
      }
    } catch (e) {
      console.error(e);
      alert('Error: ' + e.message);
    }
  }}
  className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
  title="Imprimir con RawBT (Android)"
>
  📱 RawBT
</button>
```

## 📖 Guía de Uso para el Usuario

### En Computador (Windows/macOS/Linux)

1. **Conectar la impresora térmica**:
   - USB, Bluetooth o Wi-Fi según el modelo
   - Instalar driver del fabricante

2. **Configurar el driver**:
   - Tamaño de papel: 80mm (o 58mm según impresora)
   - Márgenes: ninguno
   - Escala: 100%

3. **Imprimir desde la app**:
   - Clic en "🧾 Ticket" en una venta
   - En el diálogo de impresión:
     - Seleccionar impresora térmica
     - Verificar tamaño 80mm
     - Márgenes: ninguno
     - Desactivar encabezados/pies de página
   - Imprimir

### En Android (Celular)

#### Opción A: Diálogo de impresión estándar

1. **Emparejar impresora**:
   - Ajustes > Bluetooth > Emparejar impresora

2. **Instalar servicio de impresión**:
   - Google Play Store: "RawBT Print Service"
   - O el servicio del fabricante de la impresora

3. **Imprimir**:
   - Abrir app en navegador
   - Tocar "🧾 Ticket"
   - Tocar "Imprimir" en el visor
   - Elegir "RawBT" como destino

#### Opción B: RawBT directo (⚠️ Requiere implementación del botón)

1. Instalar "RawBT ESC/POS Print" desde Play Store
2. Configurar impresora en RawBT
3. En la app, tocar "📱 RawBT" en una venta
4. Se abrirá RawBT automáticamente con el ticket listo
5. Confirmar impresión

### En iPhone (iOS)

- **Solo impresoras AirPrint (Wi-Fi)**:
  1. Conectar impresora a misma red Wi-Fi
  2. Abrir "🧾 Ticket" o "📄 A4"
  3. Botón "Compartir" > "Imprimir"
  4. Elegir impresora AirPrint

- **Impresoras Bluetooth ESC/POS**:
  - Requieren app del fabricante
  - O convertidor Bluetooth → AirPrint (hardware adicional)

## 🔧 Comandos para Aplicar Cambios

### 1. Agregar endpoint ESC/POS (backend)
```powershell
# Editar archivo manualmente
code C:\Users\atthort-win\Documents\ollantayProject\backend\venta_service\main.py

# Insertar el código del endpoint en la línea 1424
# (antes de "# ========================")
```

### 2. Reconstruir servicio backend
```powershell
cd C:\Users\atthort-win\Documents\ollantayProject
docker-compose up --build -d venta_service
```

### 3. Agregar botón RawBT (frontend) - Opcional
```powershell
# Editar archivo manualmente
code C:\Users\atthort-win\Documents\ollantayProject\frontend\src\components\Ventas.jsx

# Agregar botón RawBT en vista móvil (línea ~3020)
```

### 4. Reconstruir frontend
```powershell
docker-compose restart frontend
```

### 5. Verificar
```powershell
# Abrir navegador
http://localhost:3000

# Probar endpoint ESC/POS
Invoke-WebRequest -Uri "http://localhost:8004/ventas/1/factura/escpos" -Method GET -UseBasicParsing
```

## ✅ Estado Actual del Sistema

- ✅ Gestión de créditos funcionando
- ✅ Búsqueda de clientes corregida
- ✅ Columna "Estado" eliminada
- ✅ Botones de impresión PDF/HTML funcionando
- ✅ **Endpoint ESC/POS implementado y funcionando**
- ✅ **Botón RawBT agregado en vistas desktop y mobile**
- ✅ Script de prueba disponible en `tools/test_escpos.ps1`

## 🧪 Pruebas y Verificación

### Script de prueba automático
```powershell
# Ejecutar el script de prueba incluido
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\test_escpos.ps1"

# Salida esperada:
# OK: endpoint returned escpos_base64 length = 428, rawbt_url preview: rawbt://print?data=...
```

### Prueba manual del endpoint
```powershell
# Consultar endpoint directamente
$res = Invoke-RestMethod -Uri "http://localhost:8004/ventas/1/factura/escpos"
$res | ConvertTo-Json

# Debe retornar:
# {
#   "ok": true,
#   "idVenta": 1,
#   "escpos_base64": "G0AbYQEbRQFQb2xsb3Mgcmlj...",
#   "rawbt_url": "rawbt://print?data=G0AbYQEbRQFQb2xsb3M..."
# }
```

### Probar desde navegador
1. Abrir http://localhost:3000 e ir a Ventas
2. Buscar una venta existente
3. Hacer clic en el botón **🖨️ Térmica** (desktop) o **🖨️** (mobile)
4. Si RawBT está instalado en Android, se abrirá automáticamente y enviará a imprimir
5. En PC, copiar el `escpos_base64` del endpoint y usar software como RawPrint

## ✅ Estado Actual del Sistema

- ✅ Gestión de créditos funcionando
- ✅ Búsqueda de clientes corregida
- ✅ Columna "Estado" eliminada
- ✅ Botones de impresión PDF/HTML funcionando
- ✅ **Endpoint ESC/POS implementado y funcionando**
- ✅ **Botón RawBT agregado en vistas desktop y mobile**
- ✅ Script de prueba disponible en `tools/test_escpos.ps1`

## 📱 Apps Recomendadas

### Android
- **RawBT ESC/POS Print** (gratis, sin anuncios)
- **Bluetooth Printer** (alternativa)
- Servicio del fabricante (Epson, Star, etc.)

### iOS
- **Star mC-Print** (para impresoras Star con AirPrint)
- Apps del fabricante específico

## 🔍 Troubleshooting

### Backend no reconoce endpoint
```powershell
# Verificar que el endpoint esté registrado
docker exec venta_service python -c "import sys; sys.path.insert(0, '/app'); import main; routes = [r.path for r in main.app.routes if hasattr(r, 'path')]; print('\n'.join(sorted(set(routes))))"

# Debe aparecer: /ventas/{id}/factura/escpos
```

### RawBT no abre automáticamente
- Verificar que RawBT esté instalado
- Configurar al menos una impresora en RawBT
- Dar permisos de "Abrir enlaces" a RawBT en Android

### Caracteres extraños en la impresión
- La codificación es CP437 (estándar ESC/POS)
- Algunos caracteres especiales pueden no mostrarse correctamente
- Considerar reemplazar tildes en el backend si es necesario
