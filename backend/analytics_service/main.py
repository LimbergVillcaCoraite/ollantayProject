from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any
import os, time
import mysql.connector
import jwt

app = FastAPI(title="Analytics Service", version="0.1.0")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=os.getenv('ALLOW_ORIGIN_REGEX', r'https?://.*'),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JWT_SECRET = os.getenv('JWT_SECRET', 'dev-secret-change-me')
JWT_ALG = 'HS256'

def get_db():
    return mysql.connector.connect(
        host=os.getenv('DATABASE_HOST', 'mysql8032'),
        port=int(os.getenv('DATABASE_PORT', 3306)),
        user=os.getenv('DATABASE_USER', 'root'),
        password=os.getenv('DATABASE_PASSWORD', os.getenv('MYSQL_ROOT_PASSWORD', 'P4assw@rd')),
        database=os.getenv('DATABASE_NAME', 'SystemaOllantay'),
        charset='utf8mb4',
        use_unicode=True
    )

def get_role(x_user_role: Optional[str], request: Optional[Request]):
    if x_user_role:
        return x_user_role.lower()
    try:
        token = request.cookies.get('ollantay_token') if request else None
        if token:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
            return (payload.get('role') or 'viewer').lower()
    except Exception:
        pass
    return 'viewer'

def get_company_id(request: Optional[Request]):
    try:
        token = request.cookies.get('ollantay_token') if request else None
        if not token: return None
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        cid = payload.get('company_id')
        return int(cid) if cid is not None else None
    except Exception:
        return None

class RealtimeStats(BaseModel):
    prestamos_activos: int
    prestamos_mora: int
    monto_prestamos_vigentes: float
    asistencias_hoy: int
    empleados_activos: int
    ventas_hoy: float
    compras_hoy: float
    gastos_hoy: float
    updated_ms: int

@app.get('/health')
def health():
    return {"status": "ok"}

@app.get('/stats/realtime', response_model=RealtimeStats)
def realtime_stats(x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    company = get_company_id(request)
    try:
        conn = get_db(); cur = conn.cursor(dictionary=True)
        where_company = ''
        params: list[Any] = []
        if role != 'superadmin' and company is not None:
            where_company = ' AND p.idEmpresa = %s'
            params.append(company)
        # Prestamos activos / mora / monto
        cur.execute(f"""
            SELECT 
              SUM(CASE WHEN p.estado=1 THEN 1 ELSE 0 END) activos,
              SUM(CASE WHEN p.estado=1 AND p.fechaVencimiento < CURDATE() THEN 1 ELSE 0 END) mora,
              SUM(CASE WHEN p.estado=1 THEN p.montoRestante ELSE 0 END) monto
            FROM prestamo_O p
            WHERE 1=1 {where_company}
        """, tuple(params))
        row_p = cur.fetchone() or {}
        # Asistencias hoy (entradas registradas)
        asist_query = "SELECT COUNT(*) c FROM asistencia_O a WHERE DATE(a.hora_entrada) = CURDATE()"
        asist_params = ()
        if role != 'superadmin' and company is not None:
            asist_query += " AND a.idEmpresa = %s"
            asist_params = (company,)
        cur.execute(asist_query, asist_params)
        asist_hoy = int((cur.fetchone() or {}).get('c',0))
        
        # Empleados activos
        emp_query = "SELECT COUNT(*) c FROM empleado_info_O e WHERE e.activo = 1"
        emp_params = ()
        if role != 'superadmin' and company is not None:
            emp_query += " AND e.idEmpresa = %s"
            emp_params = (company,)
        cur.execute(emp_query, emp_params)
        empleados = int((cur.fetchone() or {}).get('c',0))
        
        # Ventas hoy
        ventas_query = "SELECT COALESCE(SUM(v.total),0) total FROM venta_O v WHERE DATE(v.fechaVenta)=CURDATE()"
        ventas_params = ()
        if role != 'superadmin' and company is not None:
            ventas_query += " AND v.idEmpresa = %s"
            ventas_params = (company,)
        cur.execute(ventas_query, ventas_params)
        ventas_hoy = float((cur.fetchone() or {}).get('total',0))
        
        # Compras hoy
        compras_query = "SELECT COALESCE(SUM(c.montoTotal),0) total FROM compra_O c WHERE DATE(c.fechaCompra)=CURDATE()"
        compras_params = ()
        if role != 'superadmin' and company is not None:
            compras_query += " AND c.idEmpresa = %s"
            compras_params = (company,)
        cur.execute(compras_query, compras_params)
        compras_hoy = float((cur.fetchone() or {}).get('total',0))
        
        # Gastos hoy
        gastos_query = "SELECT COALESCE(SUM(g.monto),0) total FROM gasto_O g WHERE DATE(g.fecha)=CURDATE()"
        gastos_params = ()
        if role != 'superadmin' and company is not None:
            gastos_query += " AND g.idEmpresa = %s"
            gastos_params = (company,)
        cur.execute(gastos_query, gastos_params)
        gastos_hoy = float((cur.fetchone() or {}).get('total',0))
        cur.close(); conn.close()
        return RealtimeStats(
            prestamos_activos = int(row_p.get('activos') or 0),
            prestamos_mora = int(row_p.get('mora') or 0),
            monto_prestamos_vigentes = float(row_p.get('monto') or 0.0),
            asistencias_hoy = asist_hoy,
            empleados_activos = empleados,
            ventas_hoy = ventas_hoy,
            compras_hoy = compras_hoy,
            gastos_hoy = gastos_hoy,
            updated_ms = int(time.time()*1000)
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class TrendRequest(BaseModel):
    days: int = 30

@app.post('/stats/trends')
def trends(payload: TrendRequest, x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    company = get_company_id(request)
    days = max(1, min(120, payload.days))
    try:
        conn = get_db(); cur = conn.cursor(dictionary=True)
        scope_clause = ''
        scope_params: list[Any] = []
        if role != 'superadmin' and company is not None:
            scope_clause = ' AND {table}.idEmpresa = %s'
            scope_params.append(company)
        # Build queries for prestamos, ventas, compras
        out: Dict[str, Any] = {}
        for name, table, date_col, sum_col in [
            ('prestamos','prestamo_O','fechaPrestamo','montoRestante'),
            ('ventas','venta_O','fechaVenta','total'),
            ('compras','compra_O','fechaCompra','montoTotal'),
            ('gastos','gasto_O','fecha','monto'),
        ]:
            cur.execute(f"""
                SELECT DATE({date_col}) d, COALESCE(SUM({sum_col}),0) total, COUNT(*) n
                FROM {table}
                WHERE {date_col} >= DATE_SUB(CURDATE(), INTERVAL %s DAY){scope_clause.replace('{table}', table)}
                GROUP BY DATE({date_col})
                ORDER BY d ASC
            """, tuple([days] + scope_params))
            out[name] = cur.fetchall() or []
        cur.close(); conn.close()
        return {"range_days": days, **out}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
