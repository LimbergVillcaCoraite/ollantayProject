"""
Endpoint para generar comprobantes de pago (recibos)
Genera HTML que se puede abrir en nueva ventana e imprimir
"""
from fastapi import APIRouter, HTTPException, Request, Header
from fastapi.responses import HTMLResponse
from typing import Optional
from datetime import datetime
import os
import mysql.connector

router = APIRouter(prefix="/comprobantes", tags=["comprobantes"])


def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv('DATABASE_HOST', 'mysql8032'),
        port=int(os.getenv('DATABASE_PORT', 3306)),
        user=os.getenv('DATABASE_USER', 'root'),
        password=os.getenv('DATABASE_PASSWORD', os.getenv('MYSQL_ROOT_PASSWORD', 'P4assw@rd')),
        database=os.getenv('DATABASE_NAME', 'SystemaOllantay'),
    )


def format_money(amount):
    """Format money in Bolivianos"""
    return f"Bs. {float(amount):,.2f}"


def numero_a_letras(numero):
    """Convertir número a letras (simplificado, solo para bolivianos)"""
    # Implementación básica - puedes mejorarla con librería como num2words
    entero = int(numero)
    decimal = int((numero - entero) * 100)
    
    unidades = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE']
    decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA']
    centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS']
    
    if entero == 0:
        return f"CERO CON {decimal:02d}/100 BOLIVIANOS"
    
    # Simplificado para números hasta 999
    if entero <= 9:
        texto = unidades[entero]
    elif entero <= 99:
        d = entero // 10
        u = entero % 10
        texto = decenas[d]
        if u > 0:
            texto += f" Y {unidades[u]}"
    elif entero <= 999:
        c = entero // 100
        resto = entero % 100
        texto = 'CIEN' if entero == 100 else centenas[c]
        if resto > 0:
            d = resto // 10
            u = resto % 10
            if resto <= 9:
                texto += f" {unidades[resto]}"
            else:
                texto += f" {decenas[d]}"
                if u > 0:
                    texto += f" Y {unidades[u]}"
    else:
        # Para números mayores, simplemente retornar el número
        texto = str(entero)
    
    return f"{texto} CON {decimal:02d}/100 BOLIVIANOS"


@router.get("/pago-venta/{id_movimiento}", response_class=HTMLResponse)
async def generar_comprobante_pago(
    id_movimiento: int,
    x_user_role: str = Header(None),
    request: Request = None
):
    """
    Genera un comprobante HTML para un pago de venta.
    Se puede abrir en nueva ventana e imprimir desde el navegador.
    
    Parámetros:
    - id_movimiento: ID del registro en cuenta_corriente_O del tipo 'cobro'
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        # Obtener datos del movimiento (cobro)
        cur.execute('''
            SELECT 
                cc.idCuentaCorriente, cc.tipo, cc.idPersona, cc.idEmpresa,
                cc.fechaMovimiento, cc.tipoMovimiento, cc.idReferencia,
                cc.debe, cc.haber, cc.descripcion,
                p.nombres_persona, p.apellido_paternoPersona, p.apellido_maternoPer,
                p.ci_persona, p.direccion, p.telefono1,
                e.nombre_empresa, e.direccion AS direccion_empresa, e.telefono AS telefono_empresa, e.nit AS nit_empresa,
                v.numeroVenta, v.fechaVenta, v.montoTotal, v.montoPagado, v.estado_pago
            FROM cuenta_corriente_O cc
            LEFT JOIN persona_O p ON cc.idPersona = p.id_persona
            LEFT JOIN empresa_O e ON cc.idEmpresa = e.id_empresa
            LEFT JOIN venta_O v ON cc.idReferencia = v.idVenta AND cc.tipoMovimiento = 'cobro'
            WHERE cc.idCuentaCorriente = %s AND cc.tipoMovimiento = 'cobro'
        ''', (id_movimiento,))
        
        movimiento = cur.fetchone()
        cur.close()
        conn.close()
        
        if not movimiento:
            raise HTTPException(status_code=404, detail='Comprobante no encontrado o no es un cobro de venta')
        
        # Datos del comprobante
        monto_cobrado = float(movimiento['haber'])
        fecha = movimiento['fechaMovimiento'].strftime('%d/%m/%Y') if movimiento['fechaMovimiento'] else ''
        hora = datetime.now().strftime('%H:%M:%S')
        
        cliente_nombre = f"{movimiento['nombres_persona'] or ''} {movimiento['apellido_paternoPersona'] or ''} {movimiento['apellido_maternoPer'] or ''}".strip()
        cliente_ci = movimiento['ci_persona'] or ''
        
        empresa_nombre = movimiento['nombre_empresa'] or 'EMPRESA'
        empresa_nit = movimiento['nit_empresa'] or ''
        empresa_direccion = movimiento['direccion_empresa'] or ''
        empresa_telefono = movimiento['telefono_empresa'] or ''
        
        numero_venta = movimiento['numeroVenta'] or f"#{movimiento['idReferencia']}"
        monto_total_venta = float(movimiento['montoTotal'] or 0)
        monto_pagado_previo = float(movimiento['montoPagado'] or 0) - monto_cobrado  # Pagado antes de este cobro
        saldo_pendiente = monto_total_venta - float(movimiento['montoPagado'] or 0)
        
        monto_letras = numero_a_letras(monto_cobrado)
        
        # Generar HTML del comprobante
        html = f"""
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Comprobante de Pago - {numero_venta}</title>
    <style>
        @media print {{
            @page {{ margin: 1cm; }}
            body {{ margin: 0; }}
            .no-print {{ display: none; }}
        }}
        
        body {{
            font-family: 'Courier New', monospace;
            max-width: 800px;
            margin: 20px auto;
            padding: 20px;
            background: white;
        }}
        
        .comprobante {{
            border: 2px solid #000;
            padding: 20px;
        }}
        
        .header {{
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
            margin-bottom: 20px;
        }}
        
        .header h1 {{
            margin: 0;
            font-size: 24px;
            font-weight: bold;
        }}
        
        .header p {{
            margin: 5px 0;
            font-size: 14px;
        }}
        
        .section {{
            margin: 15px 0;
            padding: 10px 0;
        }}
        
        .section-title {{
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 10px;
            text-decoration: underline;
        }}
        
        .row {{
            display: flex;
            justify-content: space-between;
            margin: 5px 0;
            font-size: 14px;
        }}
        
        .row strong {{
            min-width: 200px;
        }}
        
        .monto-principal {{
            font-size: 20px;
            font-weight: bold;
            text-align: center;
            margin: 20px 0;
            padding: 15px;
            background: #f0f0f0;
            border: 2px solid #000;
        }}
        
        .monto-letras {{
            text-align: center;
            font-style: italic;
            margin: 10px 0;
            font-size: 14px;
        }}
        
        .footer {{
            margin-top: 40px;
            padding-top: 20px;
            border-top: 2px solid #000;
            text-align: center;
        }}
        
        .firma {{
            margin-top: 50px;
            display: flex;
            justify-content: space-around;
        }}
        
        .firma-box {{
            text-align: center;
        }}
        
        .firma-line {{
            border-top: 1px solid #000;
            width: 200px;
            margin: 0 auto 5px;
        }}
        
        .buttons {{
            text-align: center;
            margin: 20px 0;
        }}
        
        .btn {{
            padding: 10px 20px;
            margin: 0 10px;
            font-size: 16px;
            cursor: pointer;
            border: 2px solid #000;
            background: white;
        }}
        
        .btn:hover {{
            background: #f0f0f0;
        }}
    </style>
</head>
<body>
    <div class="buttons no-print">
        <button class="btn" onclick="window.print()">🖨️ Imprimir</button>
        <button class="btn" onclick="window.close()">❌ Cerrar</button>
    </div>

    <div class="comprobante">
        <div class="header">
            <h1>{empresa_nombre}</h1>
            <p>NIT: {empresa_nit}</p>
            <p>{empresa_direccion}</p>
            <p>Tel: {empresa_telefono}</p>
            <p style="margin-top: 15px; font-size: 18px; font-weight: bold;">COMPROBANTE DE PAGO</p>
            <p>Nº {id_movimiento:06d}</p>
        </div>

        <div class="section">
            <div class="row">
                <strong>Fecha:</strong>
                <span>{fecha}</span>
            </div>
            <div class="row">
                <strong>Hora:</strong>
                <span>{hora}</span>
            </div>
        </div>

        <div class="section">
            <div class="section-title">DATOS DEL CLIENTE</div>
            <div class="row">
                <strong>Nombre:</strong>
                <span>{cliente_nombre}</span>
            </div>
            <div class="row">
                <strong>CI:</strong>
                <span>{cliente_ci}</span>
            </div>
        </div>

        <div class="section">
            <div class="section-title">DETALLE DEL PAGO</div>
            <div class="row">
                <strong>Venta Nº:</strong>
                <span>{numero_venta}</span>
            </div>
            <div class="row">
                <strong>Fecha Venta:</strong>
                <span>{movimiento['fechaVenta'].strftime('%d/%m/%Y') if movimiento.get('fechaVenta') else ''}</span>
            </div>
            <div class="row">
                <strong>Monto Total Venta:</strong>
                <span>{format_money(monto_total_venta)}</span>
            </div>
            <div class="row">
                <strong>Pagado Anteriormente:</strong>
                <span>{format_money(monto_pagado_previo)}</span>
            </div>
        </div>

        <div class="monto-principal">
            MONTO PAGADO: {format_money(monto_cobrado)}
        </div>

        <div class="monto-letras">
            SON: {monto_letras}
        </div>

        <div class="section">
            <div class="row">
                <strong>Saldo Pendiente:</strong>
                <span style="color: {'red' if saldo_pendiente > 0 else 'green'}; font-weight: bold;">
                    {format_money(saldo_pendiente)}
                </span>
            </div>
            <div class="row">
                <strong>Estado:</strong>
                <span style="font-weight: bold;">
                    {movimiento.get('estado_pago', 'Actualizado')}
                </span>
            </div>
        </div>

        <div class="section" style="margin-top: 20px; padding: 10px; background: #f9f9f9; border: 1px dashed #999;">
            <p style="margin: 0; font-size: 12px; text-align: center;">
                <strong>Observaciones:</strong> {movimiento.get('descripcion', 'Pago de venta')}
            </p>
        </div>

        <div class="firma">
            <div class="firma-box">
                <div class="firma-line"></div>
                <p>Cajero/Encargado</p>
            </div>
            <div class="firma-box">
                <div class="firma-line"></div>
                <p>Cliente</p>
            </div>
        </div>

        <div class="footer">
            <p style="font-size: 12px;">¡Gracias por su preferencia!</p>
            <p style="font-size: 10px;">Este comprobante es válido como constancia de pago</p>
            <p style="font-size: 10px;">Comprobante generado el {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}</p>
        </div>
    </div>
</body>
</html>
        """
        
        return HTMLResponse(content=html)
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Error generando comprobante: {str(e)}')


# Health check
@router.get("/health")
def health():
    return {"status": "ok", "service": "comprobantes"}
