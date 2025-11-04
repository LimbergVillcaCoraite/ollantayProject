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

        # Cobros (ingresos)
        q_cob = """
            SELECT COALESCE(SUM(monto),0) FROM pago_O 
            WHERE tipo = 'cobro' AND fechaPago BETWEEN %s AND %s
        """
        params = [start, end]
        if effective_company is not None:
            q_cob += ' AND idEmpresa = %s'
            params.append(effective_company)
        cur.execute(q_cob, tuple(params))
        cobros = float(cur.fetchone()[0] or 0)

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

        # Pagos (egresos)
        q_pag = """
            SELECT COALESCE(SUM(monto),0) FROM pago_O 
            WHERE tipo = 'pago' AND fechaPago BETWEEN %s AND %s
        """
        params = [start, end]
        if effective_company is not None:
            q_pag += ' AND idEmpresa = %s'
            params.append(effective_company)
        cur.execute(q_pag, tuple(params))
        pagos = float(cur.fetchone()[0] or 0)

        cur.close()
        conn.close()

        ingresos = ventas_contado + cobros
        egresos = compras_contado + pagos
        balance = ingresos - egresos

        return {
            'period': period,
            'desde': start.isoformat(),
            'hasta': end.isoformat(),
            'idEmpresa': effective_company,
            'ingresos': round(ingresos, 2),
            'ingresosVentasContado': round(ventas_contado, 2),
            'ingresosCobros': round(cobros, 2),
            'egresos': round(egresos, 2),
            'egresosComprasContado': round(compras_contado, 2),
            'egresosPagos': round(pagos, 2),
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

        # Cobros
        q_cob = '''
            SELECT pg.idPago, pg.numeroPago, pg.fechaPago, pg.monto, pg.idTipoPago, tp.nombrePago AS tipoPago,
                   pg.idPersona, CONCAT(p.nombres_persona,' ',COALESCE(p.apellido_paternoPersona,'')) AS nombrePersona,
                   pg.idEmpresa
            FROM pago_O pg
            LEFT JOIN tipoPago tp ON pg.idTipoPago = tp.idPago
            LEFT JOIN persona_O p ON pg.idPersona = p.id_persona
            WHERE pg.tipo = 'cobro' AND pg.fechaPago BETWEEN %s AND %s
        '''
        params = [start, end]
        if effective_company is not None:
            q_cob += ' AND pg.idEmpresa = %s'
            params.append(effective_company)
        q_cob += ' ORDER BY pg.fechaPago DESC, pg.idPago DESC'
        cur.execute(q_cob, tuple(params))
        cobros = cur.fetchall() or []
        for c in cobros:
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

        # Pagos
        q_pag = '''
            SELECT pg.idPago, pg.numeroPago, pg.fechaPago, pg.monto, pg.idTipoPago, tp.nombrePago AS tipoPago,
                   pg.idProveedor, pr.nombreComercial AS nombreProveedor, pg.idEmpresa
            FROM pago_O pg
            LEFT JOIN tipoPago tp ON pg.idTipoPago = tp.idPago
            LEFT JOIN proveedor_O pr ON pg.idProveedor = pr.idProveedor
            WHERE pg.tipo = 'pago' AND pg.fechaPago BETWEEN %s AND %s
        '''
        params = [start, end]
        if effective_company is not None:
            q_pag += ' AND pg.idEmpresa = %s'
            params.append(effective_company)
        q_pag += ' ORDER BY pg.fechaPago DESC, pg.idPago DESC'
        cur.execute(q_pag, tuple(params))
        pagos = cur.fetchall() or []
        for p in pagos:
            p['monto'] = float(p.get('monto') or 0)
            p['fechaPago'] = p['fechaPago'].isoformat() if p.get('fechaPago') else None

        cur.close()
        conn.close()
        return {
            'period': period,
            'desde': start.isoformat(),
            'hasta': end.isoformat(),
            'idEmpresa': effective_company,
            'ventasContado': ventas,
            'cobros': cobros,
            'comprasContado': compras,
            'pagos': pagos,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

