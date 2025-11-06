from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date
import os
import mysql.connector
import jwt

app = FastAPI()

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

# JWT
JWT_SECRET = os.getenv('JWT_SECRET', 'dev-secret-change-me')
JWT_ALG = 'HS256'


def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv('DATABASE_HOST', 'mysql8032'),
        port=int(os.getenv('DATABASE_PORT', 3306)),
        user=os.getenv('DATABASE_USER', 'root'),
        password=os.getenv('DATABASE_PASSWORD', os.getenv('MYSQL_ROOT_PASSWORD', 'P4assw@rd')),
        database=os.getenv('DATABASE_NAME', 'SystemaOllantay'),
        charset='utf8mb4',
        use_unicode=True
    )


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


class GastoIn(BaseModel):
    fecha: Optional[str] = None  # YYYY-MM-DD
    categoria: str = Field(..., max_length=50)
    descripcion: Optional[str] = Field(None, max_length=255)
    monto: float = Field(..., gt=0)
    metodo_pago: Optional[str] = Field(None, max_length=30)
    estado: int = Field(default=1, ge=0, le=1)


class GastoOut(GastoIn):
    idGasto: int
    idEmpresa: int


@app.on_event('startup')
def ensure_schema():
    try:
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS gasto_O (
                idGasto INT AUTO_INCREMENT PRIMARY KEY,
                idEmpresa INT NOT NULL,
                fecha DATE NOT NULL,
                categoria VARCHAR(50) NOT NULL,
                descripcion VARCHAR(255) NULL,
                monto DECIMAL(12,2) NOT NULL,
                metodo_pago VARCHAR(30) NULL,
                estado TINYINT NOT NULL DEFAULT 1,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ''')
        conn.commit(); cur.close(); conn.close()
    except Exception:
        pass


@app.get('/health')
def health():
    try:
        conn = get_db_connection(); cur = conn.cursor(); cur.execute('SELECT 1'); cur.fetchone(); cur.close(); conn.close()
        return { 'status': 'ok' }
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get('/gastos', response_model=List[GastoOut])
def list_gastos(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    categoria: Optional[str] = None,
    estado: Optional[int] = None,
    idEmpresa: Optional[int] = None,
    offset: int = 0,
    limit: int = 100,
    request: Request = None,
    x_user_role: str = Header(None)
):
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        where = []; params = []
        
        # Si es superadmin y se especifica idEmpresa, usar ese
        # Si no, usar el company_id del token (empresa del usuario)
        if x_user_role == 'superadmin' and idEmpresa is not None:
            where.append('idEmpresa = %s'); params.append(idEmpresa)
        else:
            cid = get_company_id_from_request(request)
            if cid is not None:
                where.append('idEmpresa = %s'); params.append(cid)
        
        if fecha_inicio:
            where.append('fecha >= %s'); params.append(fecha_inicio)
        if fecha_fin:
            where.append('fecha <= %s'); params.append(fecha_fin)
        if categoria:
            where.append('categoria = %s'); params.append(categoria)
        if estado is not None:
            where.append('estado = %s'); params.append(estado)
        sql = 'SELECT idGasto, idEmpresa, DATE_FORMAT(fecha, "%Y-%m-%d") AS fecha, categoria, descripcion, monto, metodo_pago, estado FROM gasto_O'
        if where:
            sql += ' WHERE ' + ' AND '.join(where)
        sql += ' ORDER BY fecha DESC, idGasto DESC LIMIT %s OFFSET %s'
        params.extend([limit, offset])
        cur.execute(sql, tuple(params))
        rows = cur.fetchall() or []
        cur.close(); conn.close()
        for r in rows:
            if isinstance(r.get('monto'), (int, float)):
                pass
            else:
                try: r['monto'] = float(r['monto'])
                except: r['monto'] = 0.0
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/gastos', response_model=GastoOut, status_code=201)
def create_gasto(payload: GastoIn, request: Request = None, x_user_role: str = Header(None)):
    try:
        conn = get_db_connection(); cur = conn.cursor()
        cid = get_company_id_from_request(request)
        if cid is None:
            raise HTTPException(status_code=400, detail='Usuario sin empresa asignada')
        fecha = payload.fecha or date.today().isoformat()
        cur.execute('''
            INSERT INTO gasto_O (idEmpresa, fecha, categoria, descripcion, monto, metodo_pago, estado)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        ''', (cid, fecha, payload.categoria, payload.descripcion, float(payload.monto), payload.metodo_pago, payload.estado))
        conn.commit(); new_id = cur.lastrowid; cur.close(); conn.close()
        return {
            'idGasto': new_id,
            'idEmpresa': cid,
            'fecha': fecha,
            'categoria': payload.categoria,
            'descripcion': payload.descripcion,
            'monto': float(payload.monto),
            'metodo_pago': payload.metodo_pago,
            'estado': payload.estado
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/gastos/{id}', response_model=GastoOut)
def update_gasto(id: int, payload: GastoIn, request: Request = None, x_user_role: str = Header(None)):
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cid = get_company_id_from_request(request)
        cur.execute('SELECT idGasto, idEmpresa FROM gasto_O WHERE idGasto = %s', (id,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close(); raise HTTPException(status_code=404, detail='Gasto no encontrado')
        if cid is not None and row['idEmpresa'] != cid:
            cur.close(); conn.close(); raise HTTPException(status_code=403, detail='No autorizado')
        fecha = payload.fecha or date.today().isoformat()
        upd = conn.cursor()
        upd.execute('''
            UPDATE gasto_O SET fecha=%s, categoria=%s, descripcion=%s, monto=%s, metodo_pago=%s, estado=%s
            WHERE idGasto=%s
        ''', (fecha, payload.categoria, payload.descripcion, float(payload.monto), payload.metodo_pago, payload.estado, id))
        conn.commit(); upd.close(); cur.close(); conn.close()
        return {
            'idGasto': id,
            'idEmpresa': row['idEmpresa'],
            'fecha': fecha,
            'categoria': payload.categoria,
            'descripcion': payload.descripcion,
            'monto': float(payload.monto),
            'metodo_pago': payload.metodo_pago,
            'estado': payload.estado
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete('/gastos/{id}', status_code=204)
def delete_gasto(id: int, request: Request = None, x_user_role: str = Header(None)):
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cid = get_company_id_from_request(request)
        cur.execute('SELECT idGasto, idEmpresa FROM gasto_O WHERE idGasto = %s', (id,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close(); raise HTTPException(status_code=404, detail='Gasto no encontrado')
        if cid is not None and row['idEmpresa'] != cid:
            cur.close(); conn.close(); raise HTTPException(status_code=403, detail='No autorizado')
        d = conn.cursor(); d.execute('DELETE FROM gasto_O WHERE idGasto = %s', (id,)); conn.commit(); d.close(); cur.close(); conn.close()
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
