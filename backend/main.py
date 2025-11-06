from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from datetime import date, datetime, timedelta
import os
import mysql.connector
import jwt

app = FastAPI()

# Allow CORS from the frontend dev server
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost",
    "http://127.0.0.1",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/hello/{name}")
async def say_hello(name: str):
    return {"message": f"Hello {name}"}


# ========================
# Infra helpers
# ========================

def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv('DATABASE_HOST', 'mysql8032'),
        port=int(os.getenv('DATABASE_PORT', 3306)),
        user=os.getenv('DATABASE_USER', 'root'),
        password=os.getenv('DATABASE_PASSWORD', os.getenv('MYSQL_ROOT_PASSWORD', 'P4assw@rd')),
        database=os.getenv('DATABASE_NAME', 'SystemaOllantay'),
    )

JWT_SECRET = os.getenv('JWT_SECRET', 'dev-secret-change-me')
JWT_ALG = 'HS256'


def get_role(x_user_role: str = Header(None), request: Request = None) -> str:
    if x_user_role:
        return x_user_role.lower()
    try:
        if request is not None:
            token = request.cookies.get('ollantay_token')
            if token:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
                return (payload.get('role') or 'viewer').lower()
    except Exception:
        pass
    return 'viewer'


def get_company_id_from_request(request: Request = None) -> Optional[int]:
    try:
        token = request.cookies.get('ollantay_token') if request is not None else None
        if not token:
            return None
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        cid = payload.get('company_id')
        return int(cid) if cid is not None else None
    except Exception:
        return None


def period_range(period: str, base: date) -> tuple[date, date]:
    """Return [start, end] dates inclusive for the given period anchored at base.
    period in {'day','week','month','year'}
    """
    p = (period or 'day').lower()
    if p == 'day':
        start = base
        end = base
    elif p == 'week':
        # ISO week: Monday=0
        start = base - timedelta(days=base.weekday())
        end = start + timedelta(days=6)
    elif p == 'month':
        start = base.replace(day=1)
        # next month first day then minus one day
        if start.month == 12:
            next_first = start.replace(year=start.year + 1, month=1, day=1)
        else:
            next_first = start.replace(month=start.month + 1, day=1)
        end = next_first - timedelta(days=1)
    elif p == 'year':
        start = base.replace(month=1, day=1)
        end = base.replace(month=12, day=31)
    else:
        start = base
        end = base
    return (start, end)


@app.get('/health')
def health():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT 1')
        cur.fetchone()
        cur.close()
        conn.close()
        return {'status': 'ok', 'db': 'connected'}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f'db error: {e}')


# ========================
# Reportes: Caja
# ========================

@app.get('/reportes/caja/resumen')
def caja_resumen(
    period: str = 'day',
    fecha: Optional[str] = None,
    idEmpresa: Optional[int] = None,
    x_user_role: str = Header(None),
    request: Request = None
):
    """Resumen de caja para el periodo indicado.
    ingresos = ventas contado + cobros; egresos = compras contado + pagos.
    """
    role = get_role(x_user_role, request)
    user_company = get_company_id_from_request(request)

    # Resolver empresa efectiva: non-superadmin solo su empresa
    effective_company: Optional[int] = idEmpresa if (role == 'superadmin' and idEmpresa) else user_company

    # Para usuarios sin empresa, permitir global si superadmin; para otros, exigir empresa
    if role != 'superadmin' and effective_company is None:
        raise HTTPException(status_code=400, detail='Usuario sin empresa asignada')

    # Rango de fechas
    try:
        base = datetime.strptime(fecha, '%Y-%m-%d').date() if fecha else date.today()
    except Exception:
        raise HTTPException(status_code=400, detail='Fecha inválida, use YYYY-MM-DD')
    start, end = period_range(period, base)

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # Ventas contado (detecta Contado por nombre, no por id)
        q_vc = """
            SELECT COALESCE(SUM(v.montoTotal),0)
            FROM venta_O v
            LEFT JOIN tipoPago tp ON v.idTipoPago = tp.idPago
            WHERE v.estado = 1 AND v.fechaVenta BETWEEN %s AND %s AND LOWER(tp.nombrePago) LIKE '%contado%'
        """
        params = [start, end]
        if effective_company is not None:
            q_vc += ' AND v.idEmpresa = %s'
            params.append(effective_company)
        cur.execute(q_vc, tuple(params))
        ventas_contado = float(cur.fetchone()[0] or 0)

        # Ventas a crédito (NO suman a ingresos de caja, se muestran aparte)
        q_vcred = """
            SELECT COALESCE(SUM(v.montoTotal),0)
            FROM venta_O v
            LEFT JOIN tipoPago tp ON v.idTipoPago = tp.idPago
            WHERE v.estado = 1 AND v.fechaVenta BETWEEN %s AND %s AND LOWER(tp.nombrePago) LIKE '%credito%'
        """
        params = [start, end]
        if effective_company is not None:
            q_vcred += ' AND v.idEmpresa = %s'
            params.append(effective_company)
        cur.execute(q_vcred, tuple(params))
        ventas_credito = float(cur.fetchone()[0] or 0)

        # Ventas en ruta (entregas finalizadas): sumar montoTotal de detalles
        q_vr = """
            SELECT COALESCE(SUM(d.montoTotal),0)
            FROM entrega_ruta_O e
            JOIN entrega_ruta_detalle_O d ON d.idEntrega = e.idEntrega
            WHERE e.estado = 'finalizado' AND e.fechaRetorno BETWEEN %s AND %s
        """
        params = [start, end]
        if effective_company is not None:
            q_vr += ' AND e.idEmpresa = %s'
            params.append(effective_company)
        cur.execute(q_vr, tuple(params))
        ventas_ruta = float(cur.fetchone()[0] or 0)

        # Cobros efectivo (ingresos)
        q_cob_efectivo = """
            SELECT COALESCE(SUM(p.monto),0) FROM pago_O p
            LEFT JOIN tipoPago tp ON p.idTipoPago = tp.idPago
            WHERE p.tipo = 'cobro' AND p.fechaPago BETWEEN %s AND %s 
            AND (tp.nombrePago IS NULL OR LOWER(tp.nombrePago) NOT LIKE '%transfer%')
        """
        params = [start, end]
        if effective_company is not None:
            q_cob_efectivo += ' AND p.idEmpresa = %s'
            params.append(effective_company)
        cur.execute(q_cob_efectivo, tuple(params))
        cobros_efectivo = float(cur.fetchone()[0] or 0)

        # Cobros transferencia (ingresos)
        q_cob_transfer = """
            SELECT COALESCE(SUM(p.monto),0) FROM pago_O p
            LEFT JOIN tipoPago tp ON p.idTipoPago = tp.idPago
            WHERE p.tipo = 'cobro' AND p.fechaPago BETWEEN %s AND %s 
            AND LOWER(tp.nombrePago) LIKE '%transfer%'
        """
        params = [start, end]
        if effective_company is not None:
            q_cob_transfer += ' AND p.idEmpresa = %s'
            params.append(effective_company)
        cur.execute(q_cob_transfer, tuple(params))
        cobros_transferencia = float(cur.fetchone()[0] or 0)

        # Compras contado (detecta Contado por nombre, no por id)
        q_cc = """
            SELECT COALESCE(SUM(c.montoTotal),0)
            FROM compra_O c
            LEFT JOIN tipoPago tp ON c.idTipoPago = tp.idPago
            WHERE c.estado = 1 AND c.fechaCompra BETWEEN %s AND %s AND LOWER(tp.nombrePago) LIKE '%contado%'
        """
        params = [start, end]
        if effective_company is not None:
            q_cc += ' AND c.idEmpresa = %s'
            params.append(effective_company)
        cur.execute(q_cc, tuple(params))
        compras_contado = float(cur.fetchone()[0] or 0)

        # Pagos efectivo (egresos)
        q_pag_efectivo = """
            SELECT COALESCE(SUM(p.monto),0) FROM pago_O p
            LEFT JOIN tipoPago tp ON p.idTipoPago = tp.idPago
            WHERE p.tipo = 'pago' AND p.fechaPago BETWEEN %s AND %s
            AND (tp.nombrePago IS NULL OR LOWER(tp.nombrePago) NOT LIKE '%transfer%')
        """
        params = [start, end]
        if effective_company is not None:
            q_pag_efectivo += ' AND p.idEmpresa = %s'
            params.append(effective_company)
        cur.execute(q_pag_efectivo, tuple(params))
        pagos_efectivo = float(cur.fetchone()[0] or 0)

        # Pagos transferencia (egresos)
        q_pag_transfer = """
            SELECT COALESCE(SUM(p.monto),0) FROM pago_O p
            LEFT JOIN tipoPago tp ON p.idTipoPago = tp.idPago
            WHERE p.tipo = 'pago' AND p.fechaPago BETWEEN %s AND %s
            AND LOWER(tp.nombrePago) LIKE '%transfer%'
        """
        params = [start, end]
        if effective_company is not None:
            q_pag_transfer += ' AND p.idEmpresa = %s'
            params.append(effective_company)
        cur.execute(q_pag_transfer, tuple(params))
        pagos_transferencia = float(cur.fetchone()[0] or 0)

        # Totales
        ingresos = ventas_contado + ventas_ruta + cobros_efectivo + cobros_transferencia  # crédito NO suma a ingresos
        egresos = compras_contado + pagos_efectivo + pagos_transferencia
        balance = ingresos - egresos

        cur.close()
        conn.close()

        return {
            'period': period,
            'desde': start.isoformat(),
            'hasta': end.isoformat(),
            'idEmpresa': effective_company,
            'ingresos': round(ingresos, 2),
            'ingresosVentasContado': round(ventas_contado, 2),
            'ingresosVentasRuta': round(ventas_ruta, 2),
            'ingresosCobrosEfectivo': round(cobros_efectivo, 2),
            'ingresosCobrosTransferencia': round(cobros_transferencia, 2),
            'ventasCredito': round(ventas_credito, 2),
            'egresos': round(egresos, 2),
            'egresosComprasContado': round(compras_contado, 2),
            'egresosPagosEfectivo': round(pagos_efectivo, 2),
            'egresosPagosTransferencia': round(pagos_transferencia, 2),
            'balance': round(balance, 2),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# Reportes: Caja Detalle
# ========================

@app.get('/reportes/caja/detalle')
def caja_detalle(
    period: str = 'day',
    fecha: Optional[str] = None,
    idEmpresa: Optional[int] = None,
    x_user_role: str = Header(None),
    request: Request = None
):
    """Detalle de movimientos de caja en el periodo indicado.
    ventasContado, cobros (pago_O.tipo='cobro'), comprasContado, pagos (pago_O.tipo='pago').
    """
    role = get_role(x_user_role, request)
    user_company = get_company_id_from_request(request)

    effective_company: Optional[int] = idEmpresa if (role == 'superadmin' and idEmpresa) else user_company
    if role != 'superadmin' and effective_company is None:
        raise HTTPException(status_code=400, detail='Usuario sin empresa asignada')

    try:
        base = datetime.strptime(fecha, '%Y-%m-%d').date() if fecha else date.today()
    except Exception:
        raise HTTPException(status_code=400, detail='Fecha inválida, use YYYY-MM-DD')
    start, end = period_range(period, base)

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

     # Ventas contado
        q_v = '''
            SELECT v.idVenta, v.fechaVenta, v.montoTotal, v.idTipoPago, tp.nombrePago AS tipoPago,
                   v.codigoVenta, v.numeroVenta,
                   v.idCliente, CONCAT(p.nombres_persona, ' ', COALESCE(p.apellido_paternoPersona,'')) AS nombreCliente,
                   v.idEmpresa
            FROM venta_O v
            LEFT JOIN tipoPago tp ON v.idTipoPago = tp.idPago
            LEFT JOIN persona_O p ON v.idCliente = p.id_persona
              WHERE v.estado = 1 AND v.fechaVenta BETWEEN %s AND %s AND LOWER(tp.nombrePago) LIKE '%contado%'
        '''
        params = [start, end]
        if effective_company is not None:
            q_v += ' AND v.idEmpresa = %s'
            params.append(effective_company)
        q_v += ' ORDER BY v.fechaVenta DESC, v.idVenta DESC'
        cur.execute(q_v, tuple(params))
        ventas = cur.fetchall() or []
        for v in ventas:
            v['montoTotal'] = float(v.get('montoTotal') or 0)
            v['fechaVenta'] = v['fechaVenta'].isoformat() if v.get('fechaVenta') else None

        # Ventas a crédito
        q_vc = '''
            SELECT v.idVenta, v.fechaVenta, v.montoTotal, v.idTipoPago, tp.nombrePago AS tipoPago,
                   v.codigoVenta, v.numeroVenta,
                   v.idCliente, CONCAT(p.nombres_persona, ' ', COALESCE(p.apellido_paternoPersona,'')) AS nombreCliente,
                   v.idEmpresa
            FROM venta_O v
            LEFT JOIN tipoPago tp ON v.idTipoPago = tp.idPago
            LEFT JOIN persona_O p ON v.idCliente = p.id_persona
              WHERE v.estado = 1 AND v.fechaVenta BETWEEN %s AND %s AND LOWER(tp.nombrePago) LIKE '%credito%'
        '''
        params = [start, end]
        if effective_company is not None:
            q_vc += ' AND v.idEmpresa = %s'
            params.append(effective_company)
        q_vc += ' ORDER BY v.fechaVenta DESC, v.idVenta DESC'
        cur.execute(q_vc, tuple(params))
        ventas_credito = cur.fetchall() or []
        for vc in ventas_credito:
            vc['montoTotal'] = float(vc.get('montoTotal') or 0)
            vc['fechaVenta'] = vc['fechaVenta'].isoformat() if vc.get('fechaVenta') else None

        # Ventas en ruta (detalle consolidado por entrega)
        q_vruta = '''
            SELECT e.idEntrega, e.numeroEntrega, e.fechaRetorno, e.idEmpresa,
                   r.nombreRuta,
                   CONCAT(pe.nombres_persona,' ',COALESCE(pe.apellido_paternoPersona,'')) AS nombreEncargado,
                   COALESCE(SUM(d.montoTotal),0) AS totalVendido
            FROM entrega_ruta_O e
            LEFT JOIN entrega_ruta_detalle_O d ON d.idEntrega = e.idEntrega
            LEFT JOIN ruta_O r ON e.idRuta = r.idRuta
            LEFT JOIN persona_O pe ON e.idEncargado = pe.id_persona
            WHERE e.estado = 'finalizado' AND e.fechaRetorno BETWEEN %s AND %s
        '''
        params = [start, end]
        if effective_company is not None:
            q_vruta += ' AND e.idEmpresa = %s'
            params.append(effective_company)
        q_vruta += ' GROUP BY e.idEntrega ORDER BY e.fechaRetorno DESC, e.idEntrega DESC'
        cur.execute(q_vruta, tuple(params))
        ventas_ruta = cur.fetchall() or []
        for vr in ventas_ruta:
            vr['totalVendido'] = float(vr.get('totalVendido') or 0)
            vr['fechaRetorno'] = vr['fechaRetorno'].isoformat() if vr.get('fechaRetorno') else None

        # Cobros efectivo
        q_cob_e = '''
            SELECT pg.idPago, pg.numeroPago, pg.fechaPago, pg.monto, pg.idTipoPago, tp.nombrePago AS tipoPago,
                   pg.idPersona, CONCAT(p.nombres_persona,' ',COALESCE(p.apellido_paternoPersona,'')) AS nombrePersona,
                   pg.idEmpresa
            FROM pago_O pg
            LEFT JOIN tipoPago tp ON pg.idTipoPago = tp.idPago
            LEFT JOIN persona_O p ON pg.idPersona = p.id_persona
            WHERE pg.tipo = 'cobro' AND pg.fechaPago BETWEEN %s AND %s
              AND (tp.nombrePago IS NULL OR LOWER(tp.nombrePago) NOT LIKE '%transfer%')
        '''
        params = [start, end]
        if effective_company is not None:
            q_cob_e += ' AND pg.idEmpresa = %s'
            params.append(effective_company)
        q_cob_e += ' ORDER BY pg.fechaPago DESC, pg.idPago DESC'
        cur.execute(q_cob_e, tuple(params))
        cobros_efectivo = cur.fetchall() or []
        for c in cobros_efectivo:
            c['monto'] = float(c.get('monto') or 0)
            c['fechaPago'] = c['fechaPago'].isoformat() if c.get('fechaPago') else None

        # Cobros transferencia
        q_cob_t = '''
            SELECT pg.idPago, pg.numeroPago, pg.fechaPago, pg.monto, pg.idTipoPago, tp.nombrePago AS tipoPago,
                   pg.idPersona, CONCAT(p.nombres_persona,' ',COALESCE(p.apellido_paternoPersona,'')) AS nombrePersona,
                   pg.idEmpresa
            FROM pago_O pg
            LEFT JOIN tipoPago tp ON pg.idTipoPago = tp.idPago
            LEFT JOIN persona_O p ON pg.idPersona = p.id_persona
            WHERE pg.tipo = 'cobro' AND pg.fechaPago BETWEEN %s AND %s
              AND LOWER(tp.nombrePago) LIKE '%transfer%'
        '''
        params = [start, end]
        if effective_company is not None:
            q_cob_t += ' AND pg.idEmpresa = %s'
            params.append(effective_company)
        q_cob_t += ' ORDER BY pg.fechaPago DESC, pg.idPago DESC'
        cur.execute(q_cob_t, tuple(params))
        cobros_transferencia = cur.fetchall() or []
        for c in cobros_transferencia:
            c['monto'] = float(c.get('monto') or 0)
            c['fechaPago'] = c['fechaPago'].isoformat() if c.get('fechaPago') else None

        # Compras contado
        q_cc = '''
            SELECT c.idCompra, c.fechaCompra, c.montoTotal, c.idTipoPago, tp.nombrePago AS tipoPago,
                   pr.idProveedor, pr.nombreComercial AS nombreProveedor, c.idEmpresa
            FROM compra_O c
            LEFT JOIN tipoPago tp ON c.idTipoPago = tp.idPago
            LEFT JOIN proveedor_O pr ON c.idProveedor = pr.idProveedor
              WHERE c.estado = 1 AND c.fechaCompra BETWEEN %s AND %s AND LOWER(tp.nombrePago) LIKE '%contado%'
        '''
        params = [start, end]
        if effective_company is not None:
            q_cc += ' AND c.idEmpresa = %s'
            params.append(effective_company)
        q_cc += ' ORDER BY c.fechaCompra DESC, c.idCompra DESC'
        cur.execute(q_cc, tuple(params))
        compras = cur.fetchall() or []
        for c in compras:
            c['montoTotal'] = float(c.get('montoTotal') or 0)
            c['fechaCompra'] = c['fechaCompra'].isoformat() if c.get('fechaCompra') else None

        # Pagos efectivo
        q_pag_e = '''
            SELECT pg.idPago, pg.numeroPago, pg.fechaPago, pg.monto, pg.idTipoPago, tp.nombrePago AS tipoPago,
                   pg.idProveedor, pr.nombreComercial AS nombreProveedor, pg.idEmpresa
            FROM pago_O pg
            LEFT JOIN tipoPago tp ON pg.idTipoPago = tp.idPago
            LEFT JOIN proveedor_O pr ON pg.idProveedor = pr.idProveedor
            WHERE pg.tipo = 'pago' AND pg.fechaPago BETWEEN %s AND %s
              AND (tp.nombrePago IS NULL OR LOWER(tp.nombrePago) NOT LIKE '%transfer%')
        '''
        params = [start, end]
        if effective_company is not None:
            q_pag_e += ' AND pg.idEmpresa = %s'
            params.append(effective_company)
        q_pag_e += ' ORDER BY pg.fechaPago DESC, pg.idPago DESC'
        cur.execute(q_pag_e, tuple(params))
        pagos_efectivo = cur.fetchall() or []
        for p in pagos_efectivo:
            p['monto'] = float(p.get('monto') or 0)
            p['fechaPago'] = p['fechaPago'].isoformat() if p.get('fechaPago') else None

        # Pagos transferencia
        q_pag_t = '''
            SELECT pg.idPago, pg.numeroPago, pg.fechaPago, pg.monto, pg.idTipoPago, tp.nombrePago AS tipoPago,
                   pg.idProveedor, pr.nombreComercial AS nombreProveedor, pg.idEmpresa
            FROM pago_O pg
            LEFT JOIN tipoPago tp ON pg.idTipoPago = tp.idPago
            LEFT JOIN proveedor_O pr ON pg.idProveedor = pr.idProveedor
            WHERE pg.tipo = 'pago' AND pg.fechaPago BETWEEN %s AND %s
              AND LOWER(tp.nombrePago) LIKE '%transfer%'
        '''
        params = [start, end]
        if effective_company is not None:
            q_pag_t += ' AND pg.idEmpresa = %s'
            params.append(effective_company)
        q_pag_t += ' ORDER BY pg.fechaPago DESC, pg.idPago DESC'
        cur.execute(q_pag_t, tuple(params))
        pagos_transferencia = cur.fetchall() or []
        for p in pagos_transferencia:
            p['monto'] = float(p.get('monto') or 0)
            p['fechaPago'] = p['fechaPago'].isoformat() if p.get('fechaPago') else None

        cur.close()
        conn.close()
        # Unificados para compatibilidad
        cobros = (cobros_efectivo or []) + (cobros_transferencia or [])
        pagos = (pagos_efectivo or []) + (pagos_transferencia or [])

        return {
            'period': period,
            'desde': start.isoformat(),
            'hasta': end.isoformat(),
            'idEmpresa': effective_company,
            'ventasContado': ventas,
            'ventasCredito': ventas_credito,
            'ventasRuta': ventas_ruta,
            'cobros': cobros,
            'cobrosEfectivo': cobros_efectivo,
            'cobrosTransferencia': cobros_transferencia,
            'comprasContado': compras,
            'pagos': pagos,
            'pagosEfectivo': pagos_efectivo,
            'pagosTransferencia': pagos_transferencia,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

