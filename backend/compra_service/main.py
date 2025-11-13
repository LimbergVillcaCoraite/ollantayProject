from fastapi import FastAPI, HTTPException, Request, Header, UploadFile, File, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date
from decimal import Decimal
import os
import mysql.connector
from mysql.connector import errors as mysql_errors
import jwt

app = FastAPI()
 # Serve uploads for this service as well (e.g., comprobantes)
# Create uploads directories if they don't exist and mount static paths
os.makedirs("/app/uploads", exist_ok=True)
os.makedirs("/app/uploads/comprobantes", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")
# Backward-compatible mount for existing records that stored rutaArchivo starting with /comprobantes
app.mount("/comprobantes", StaticFiles(directory="/app/uploads/comprobantes"), name="comprobantes")

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
    expose_headers=["X-Total-Count"]
)


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

# JWT settings
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


def get_user_id_from_request(request: Request = None) -> Optional[int]:
    """Extract id_user from JWT if present (to store in compra_O.idUsuario)."""
    try:
        token = request.cookies.get('ollantay_token') if request is not None else None
        if not token:
            return None
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        # El JWT usa 'sub' para el id_user
        uid = payload.get('sub') or payload.get('id_user') or payload.get('user_id')
        return int(uid) if uid is not None else None
    except Exception as e:
        print(f"Error getting user_id from JWT: {e}")
        return None


# ========================
# Modelos para Compras
# ========================

class DetalleCompraIn(BaseModel):
    idProducto: int
    cantidad_caja: int = Field(ge=0)
    precio_unitario: Decimal = Field(ge=0)
    subtotal: Decimal = Field(ge=0)
    fechaVencimiento: Optional[str] = None  # ISO date (YYYY-MM-DD)
    botellas_por_caja: Optional[int] = Field(default=None, ge=1)
    precio_por_botella: Optional[Decimal] = Field(default=None, ge=0)


class DetalleCompraOut(DetalleCompraIn):
    idDetalleCompra: int
    idCompra: int
    nombreProducto: Optional[str] = None


class CompraIn(BaseModel):
    fechaCompra: Optional[str] = None  # ISO date
    idProveedor: int
    idTipoPago: int  # 1=contado, 2=credito
    montoTotal: Decimal = Field(ge=0)
    estado: int = Field(default=1, ge=0, le=1)
    observaciones: Optional[str] = Field(None, max_length=500)
    detalles: List[DetalleCompraIn] = []


class CompraOut(BaseModel):
    idCompra: int
    numeroCompra: Optional[str] = None
    fechaCompra: str
    idProveedor: int
    nombreProveedor: Optional[str] = None
    idTipoPago: int
    tipoPago: Optional[str] = None
    idEmpresa: int
    nombreEmpresa: Optional[str] = None
    montoTotal: Decimal
    estado: int
    observaciones: Optional[str] = None
    detalles: List[DetalleCompraOut] = []
    comprobantes: Optional[List[dict]] = []
    # Campos opcionales para crédito (si existen en la tabla, se llenan; evita excepción si faltan)
    montoPagado: Optional[Decimal] = None
    saldo: Optional[Decimal] = None
    estado_pago: Optional[str] = None

# ========================
# Créditos: pagos de compras a crédito
# ========================

class PagoCompraIn(BaseModel):
    monto: Decimal = Field(gt=0)
    metodo: Optional[str] = Field(default='efectivo', max_length=50)
    observaciones: Optional[str] = Field(default=None, max_length=255)

class PagoCompraOut(BaseModel):
    idPago: int
    idCompra: int
    monto: Decimal
    fecha: str
    metodo: Optional[str] = None
    observaciones: Optional[str] = None

def ensure_pagos_table(conn):
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS compra_pago_O (
            idPago INT NOT NULL AUTO_INCREMENT,
            idCompra INT NOT NULL,
            monto DECIMAL(10,2) NOT NULL,
            fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            metodo VARCHAR(50) NULL,
            observaciones VARCHAR(255) NULL,
            idUsuario INT NULL,
            PRIMARY KEY (idPago),
            KEY idx_compra (idCompra),
            CONSTRAINT fk_pago_compra FOREIGN KEY (idCompra) REFERENCES compra_O(idCompra) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ''')
    conn.commit()
    cur.close()


# ========================
# Endpoints de Compras
# ========================

def ensure_compra_indexes(conn):
    """Crea índices útiles para filtros más comunes (idEmpresa + fechaCompra, proveedor, tipoPago).
    Ignora errores si ya existen."""
    try:
        cur = conn.cursor()
        # MySQL 8.0+ soporta IF NOT EXISTS, si no, capturamos Duplicate key
        statements = [
            "CREATE INDEX IF NOT EXISTS idx_compra_empresa_fecha ON compra_O (idEmpresa, fechaCompra)",
            "CREATE INDEX IF NOT EXISTS idx_compra_empresa_proveedor ON compra_O (idEmpresa, idProveedor)",
            "CREATE INDEX IF NOT EXISTS idx_compra_empresa_tipopago ON compra_O (idEmpresa, idTipoPago)",
            "CREATE INDEX IF NOT EXISTS idx_compra_estado_pago ON compra_O (estado_pago)",
        ]
        for st in statements:
            try:
                cur.execute(st)
            except Exception as e:
                # Si el motor no soporta IF NOT EXISTS o ya existe, continuar
                if 'Duplicate' in str(e) or 'exists' in str(e).lower():
                    continue
        conn.commit(); cur.close()
    except Exception:
        # No bloquear solicitud por fallo de índice
        pass

@app.get('/compras', response_model=List[CompraOut])
def list_compras(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    idProveedor: Optional[int] = None,
    idTipoPago: Optional[int] = None,
    idProducto: Optional[int] = None,
    estado: Optional[int] = None,
    offset: int = 0,
    limit: int = 100,
    summary: Optional[str] = None,
    includeDetalles: Optional[str] = None,
    includeComprobantes: Optional[str] = None,
    projection: Optional[str] = None,  # 'basic' | 'full'
    x_user_role: str = Header(None),
    request: Request = None,
    response: Response = None
):
    """Listar compras.

    Rendimiento / parámetros:
    - summary=true  (DEPRECADO en favor de projection=basic) devuelve solo campos principales.
    - projection=basic fuerza omitir detalles y comprobantes y usa una consulta más ligera sin joins innecesarios.
    - includeDetalles / includeComprobantes permiten controlar granularmente (por defecto true salvo en basic/summary).
    - limit se limita internamente a 500 para evitar respuestas demasiado grandes.
    - Índices se crean de forma perezosa (best-effort) en cada llamada si aún no existen.
    """
    import time
    start_time = time.time()
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        ensure_compra_indexes(conn)
        role = get_role(x_user_role, request)
        user_company = get_company_id_from_request(request)

        # Normalizar projection / summary
        truthy = {'1','true','t','yes','y','si','sí'}
        summary_flag = str(summary).lower() in truthy if summary is not None else False
        projection_mode = (projection or ('basic' if summary_flag else 'full')).lower()
        if projection_mode not in ('basic','full'):
            projection_mode = 'full'

        # Restringir límite máximo
        if limit > 500:
            limit = 500

        # Query base: ligera si projection=basic
        if projection_mode == 'basic':
            query = '''
                SELECT c.idCompra, c.numeroCompra, c.fechaCompra, c.idProveedor,
                       c.idTipoPago, c.idEmpresa, c.montoTotal, c.estado, c.observaciones,
                       c.montoPagado, c.saldo, c.estado_pago
                FROM compra_O c
            '''
        else:
            query = '''
                SELECT 
                    c.idCompra, c.numeroCompra, c.fechaCompra, c.idProveedor, prov.nombreComercial AS nombreProveedor,
                    c.idTipoPago, tp.nombrePago AS tipoPago, c.idEmpresa, e.nombre_empresa AS nombreEmpresa,
                    c.montoTotal, c.estado, c.observaciones,
                    c.montoPagado, c.saldo, c.estado_pago
                FROM compra_O c
                LEFT JOIN proveedor_O prov ON c.idProveedor = prov.idProveedor
                LEFT JOIN tipoPago tp ON c.idTipoPago = tp.idPago
                LEFT JOIN empresa_O e ON c.idEmpresa = e.id_empresa
            '''
        
        where = []
        params = []

        # Scoping multiempresa
        if role != 'superadmin' and user_company is not None:
            where.append('c.idEmpresa = %s')
            params.append(user_company)

        # Filtros
        if fecha_inicio:
            where.append('c.fechaCompra >= %s')
            params.append(fecha_inicio)
        if fecha_fin:
            where.append('c.fechaCompra <= %s')
            params.append(fecha_fin)
        if idProveedor is not None:
            where.append('c.idProveedor = %s')
            params.append(idProveedor)
        if idTipoPago is not None:
            where.append('c.idTipoPago = %s')
            params.append(idTipoPago)
        if idProducto is not None:
            where.append('EXISTS (SELECT 1 FROM detalle_compra_O dc WHERE dc.idCompra = c.idCompra AND dc.idProducto = %s)')
            params.append(idProducto)
        if estado is not None:
            where.append('c.estado = %s')
            params.append(estado)

        base_query = query
        base_params = list(params)

        if where:
            base_query += ' WHERE ' + ' AND '.join(where)
        
        # Total count for pagination
        count_query = 'SELECT COUNT(*) as total FROM (' + base_query + ') as t'
        cur.execute(count_query, tuple(base_params))
        total_row = cur.fetchone() or { 'total': 0 }
        total_count = int(total_row.get('total') or 0)
        if response is not None:
            response.headers['X-Total-Count'] = str(total_count)

        # Fetch page
        page_query = base_query + ' ORDER BY c.fechaCompra DESC, c.idCompra DESC LIMIT %s OFFSET %s'
        page_params = base_params + [limit, offset]
        cur.execute(page_query, tuple(page_params))
        compras = cur.fetchall() or []

        # Flags de control (detalles/comprobantes solo si full y no summary)
        detalles_flag = (projection_mode == 'full') and not summary_flag and (includeDetalles is None or str(includeDetalles).lower() in truthy)
        comprobantes_flag = (projection_mode == 'full') and not summary_flag and (includeComprobantes is None or str(includeComprobantes).lower() in truthy)

        result = []
        for c in compras:
            c['fechaCompra'] = c['fechaCompra'].isoformat() if c.get('fechaCompra') else None
            c['montoTotal'] = float(c['montoTotal']) if c.get('montoTotal') else 0.0
            if detalles_flag:
                cur.execute('''
                    SELECT 
                        dc.idDetalleCompra, dc.idCompra, dc.idProducto, dc.cantidad_caja,
                        dc.precio_unitario, dc.subtotal, pr.nombreProducto,
                        dc.precio_paquete, dc.botellas_por_caja, dc.precio_por_botella
                    FROM detalle_compra_O dc
                    LEFT JOIN producto_O pr ON dc.idProducto = pr.idProducto
                    WHERE dc.idCompra = %s
                ''', (c['idCompra'],))
                detalles = cur.fetchall() or []
                for d in detalles:
                    d['precio_unitario'] = float(d['precio_unitario']) if d.get('precio_unitario') else 0.0
                    d['subtotal'] = float(d['subtotal']) if d.get('subtotal') else 0.0
                    if 'precio_paquete' in d:
                        try:
                            d['precio_paquete'] = float(d['precio_paquete']) if d.get('precio_paquete') is not None else None
                        except Exception:
                            d['precio_paquete'] = None
                    if 'precio_por_botella' in d:
                        try:
                            d['precio_por_botella'] = float(d['precio_por_botella']) if d.get('precio_por_botella') is not None else None
                        except Exception:
                            d['precio_por_botella'] = None
                c['detalles'] = detalles
            else:
                c['detalles'] = []

            if comprobantes_flag:
                cur.execute('''
                    SELECT idComprobante, rutaArchivo, nombreArchivo, mimeType, uploaded_at
                    FROM compra_comprobante_O WHERE idCompra = %s ORDER BY idComprobante ASC
                ''', (c['idCompra'],))
                comprobantes = cur.fetchall() or []
                c['comprobantes'] = comprobantes
            else:
                c['comprobantes'] = []
            result.append(c)

        cur.close(); conn.close()
        duration = (time.time() - start_time) * 1000.0
        if duration > 1500:
            print(f"WARN /compras slow query {duration:.1f}ms rows={len(result)} mode={projection_mode} params={page_params}")
        else:
            print(f"DEBUG /compras duration={duration:.1f}ms rows={len(result)} mode={projection_mode}")
        return result
    except Exception as e:
        duration = (time.time() - start_time) * 1000.0
        print(f"ERROR /compras failed after {duration:.1f}ms: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/compras/pendientes', response_model=List[CompraOut])
def list_compras_pendientes(
    offset: int = 0,
    limit: int = 100,
    x_user_role: str = Header(None),
    request: Request = None,
    response: Response = None
):
    """Compras a crédito con estado Pendiente o Parcial."""
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        role = get_role(x_user_role, request)
        user_company = get_company_id_from_request(request)
        where = ["c.estado = 1", "c.estado_pago IN ('Pendiente','Parcial')"]
        params = []
        if role != 'superadmin' and user_company is not None:
            where.append('c.idEmpresa = %s')
            params.append(user_company)
        base = '''
            SELECT c.idCompra, c.numeroCompra, c.fechaCompra, c.idProveedor, prov.nombreComercial AS nombreProveedor,
                   c.idTipoPago, tp.nombrePago AS tipoPago, c.idEmpresa, e.nombre_empresa AS nombreEmpresa,
                   c.montoTotal, c.montoPagado, c.saldo, c.estado_pago, c.estado, c.observaciones
            FROM compra_O c
            LEFT JOIN proveedor_O prov ON c.idProveedor = prov.idProveedor
            LEFT JOIN tipoPago tp ON c.idTipoPago = tp.idPago
            LEFT JOIN empresa_O e ON c.idEmpresa = e.id_empresa
        '''
        if where:
            base += ' WHERE ' + ' AND '.join(where)
        count_q = 'SELECT COUNT(*) total FROM (' + base + ') t'
        cur.execute(count_q, tuple(params)); total = int((cur.fetchone() or {}).get('total', 0))
        if response is not None: response.headers['X-Total-Count'] = str(total)
        page_q = base + ' ORDER BY c.fechaCompra DESC, c.idCompra DESC LIMIT %s OFFSET %s'
        cur.execute(page_q, tuple(params + [limit, offset])); rows = cur.fetchall() or []
        for r in rows:
            r['fechaCompra'] = r['fechaCompra'].isoformat() if r.get('fechaCompra') else None
            for k in ('montoTotal','montoPagado','saldo'): r[k] = float(r[k]) if r.get(k) is not None else 0.0
        cur.close(); conn.close(); return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/compras/{id}', response_model=CompraOut)
def get_compra(id: int, x_user_role: str = Header(None), request: Request = None):
    """Obtener compra por ID."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        role = get_role(x_user_role, request)
        user_company = get_company_id_from_request(request)

        query = '''
            SELECT 
                c.idCompra, c.numeroCompra, c.fechaCompra, c.idProveedor, prov.nombreComercial AS nombreProveedor,
                c.idTipoPago, tp.nombrePago AS tipoPago, c.idEmpresa, e.nombre_empresa AS nombreEmpresa,
                c.montoTotal, c.estado, c.observaciones
            FROM compra_O c
            LEFT JOIN proveedor_O prov ON c.idProveedor = prov.idProveedor
            LEFT JOIN tipoPago tp ON c.idTipoPago = tp.idPago
            LEFT JOIN empresa_O e ON c.idEmpresa = e.id_empresa
            WHERE c.idCompra = %s
        '''
        cur.execute(query, (id,))
        compra = cur.fetchone()
        
        if not compra:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Compra no encontrada')

        # Validar scoping
        if role != 'superadmin' and user_company is not None and compra['idEmpresa'] != user_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')

        # Obtener detalles
        cur.execute('''
            SELECT 
                dc.idDetalleCompra, dc.idCompra, dc.idProducto, dc.cantidad_caja,
                dc.precio_unitario, dc.subtotal, pr.nombreProducto,
                dc.precio_paquete, dc.botellas_por_caja, dc.precio_por_botella
            FROM detalle_compra_O dc
            LEFT JOIN producto_O pr ON dc.idProducto = pr.idProducto
            WHERE dc.idCompra = %s
        ''', (id,))
        detalles = cur.fetchall() or []
        
        compra['fechaCompra'] = compra['fechaCompra'].isoformat() if compra.get('fechaCompra') else None
        compra['montoTotal'] = float(compra['montoTotal']) if compra.get('montoTotal') else 0.0
        
        for d in detalles:
            d['precio_unitario'] = float(d['precio_unitario']) if d.get('precio_unitario') else 0.0
            d['subtotal'] = float(d['subtotal']) if d.get('subtotal') else 0.0
            
            if 'precio_paquete' in d:
                try:
                    d['precio_paquete'] = float(d['precio_paquete']) if d.get('precio_paquete') is not None else None
                except Exception:
                    d['precio_paquete'] = None
            if 'precio_por_botella' in d:
                try:
                    d['precio_por_botella'] = float(d['precio_por_botella']) if d.get('precio_por_botella') is not None else None
                except Exception:
                    d['precio_por_botella'] = None
        
        compra['detalles'] = detalles

        # Comprobantes
        cur.execute('''
            SELECT idComprobante, rutaArchivo, nombreArchivo, mimeType, uploaded_at
            FROM compra_comprobante_O WHERE idCompra = %s ORDER BY idComprobante ASC
        ''', (id,))
        comprobantes = cur.fetchall() or []
        compra['comprobantes'] = comprobantes
        
        cur.close()
        conn.close()
        return compra
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/compras/{id}/pagos', response_model=List[PagoCompraOut])
def listar_pagos_compra(id: int, x_user_role: str = Header(None), request: Request = None):
    """Lista pagos registrados para una compra."""
    try:
        conn = get_db_connection(); ensure_pagos_table(conn)
        cur = conn.cursor(dictionary=True)
        role = get_role(x_user_role, request); user_company = get_company_id_from_request(request)
        cur.execute('SELECT idEmpresa FROM compra_O WHERE idCompra = %s', (id,)); comp = cur.fetchone()
        if not comp: cur.close(); conn.close(); raise HTTPException(status_code=404, detail='Compra no encontrada')
        if role != 'superadmin' and user_company is not None and comp['idEmpresa'] != user_company:
            cur.close(); conn.close(); raise HTTPException(status_code=403, detail='No autorizado')
        cur.execute('SELECT idPago, idCompra, monto, fecha, metodo, observaciones FROM compra_pago_O WHERE idCompra = %s ORDER BY idPago', (id,))
        rows = cur.fetchall() or []
        for r in rows:
            r['monto'] = float(r['monto']) if r.get('monto') is not None else 0.0
            r['fecha'] = r['fecha'].isoformat() if r.get('fecha') else None
        cur.close(); conn.close(); return rows
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))


@app.post('/compras/{id}/pagos', response_model=PagoCompraOut, status_code=201)
def registrar_pago_compra(id: int, payload: PagoCompraIn, x_user_role: str = Header(None), request: Request = None):
    """Registra un abono/pago a una compra a crédito y actualiza estado_pago y montoPagado.
    También registra el movimiento en la tabla pago_O para que aparezca en reportes de caja."""
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection(); ensure_pagos_table(conn)
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)
        
        # Obtener datos de la compra y proveedor
        cur.execute('''
            SELECT c.idEmpresa, c.montoTotal, c.montoPagado, c.idProveedor,
                   pr.idPersona AS proveedorPersonaId
            FROM compra_O c
            LEFT JOIN proveedor_O pr ON c.idProveedor = pr.idProveedor
            WHERE c.idCompra = %s
        ''', (id,))
        comp = cur.fetchone()
        if not comp: cur.close(); conn.close(); raise HTTPException(status_code=404, detail='Compra no encontrada')
        if role != 'superadmin' and user_company is not None and comp['idEmpresa'] != user_company:
            cur.close(); conn.close(); raise HTTPException(status_code=403, detail='No autorizado')

        monto = float(payload.monto)
        if monto <= 0: cur.close(); conn.close(); raise HTTPException(status_code=400, detail='Monto inválido')
        
        # Registrar pago en compra_pago_O
        ins = conn.cursor()
        ins.execute('''
            INSERT INTO compra_pago_O (idCompra, monto, metodo, observaciones, idUsuario)
            VALUES (%s, %s, %s, %s, %s)
        ''', (id, monto, payload.metodo, payload.observaciones, get_user_id_from_request(request)))
        conn.commit(); idPago = ins.lastrowid; ins.close()

        # Actualizar acumulados y estado_pago
        nuevo_pagado = float(comp.get('montoPagado') or 0.0) + monto
        estado_pago = 'Pagado' if nuevo_pagado + 1e-6 >= float(comp.get('montoTotal') or 0.0) else 'Parcial'
        upd = conn.cursor()
        upd.execute('UPDATE compra_O SET montoPagado = %s, estado_pago = %s WHERE idCompra = %s', (nuevo_pagado, estado_pago, id))
        conn.commit(); upd.close()

        # Registrar movimiento en pago_O para reportes de caja
        # Determinar idTipoPago según método (efectivo=2, transferencia=7)
        id_tipo_pago = 7 if payload.metodo and 'transfer' in payload.metodo.lower() else 2
        id_persona_prov = comp.get('proveedorPersonaId')
        
        ins_pago = conn.cursor()
        try:
            ins_pago.execute('''
                INSERT INTO pago_O (tipo, idPersona, idEmpresa, fechaPago, monto, idTipoPago, observaciones)
                VALUES ('pago', %s, %s, NOW(), %s, %s, %s)
            ''', (id_persona_prov, comp['idEmpresa'], monto, id_tipo_pago, 
                  f"Pago compra #{id}" + (f" - {payload.observaciones}" if payload.observaciones else "")))
            conn.commit()
        except Exception as e_pago:
            # Si falla por restricción de idPersona NULL, intentar sin idPersona
            try:
                ins_pago.execute('''
                    INSERT INTO pago_O (tipo, idEmpresa, fechaPago, monto, idTipoPago, observaciones)
                    VALUES ('pago', %s, NOW(), %s, %s, %s)
                ''', (comp['idEmpresa'], monto, id_tipo_pago, 
                      f"Pago compra #{id}" + (f" - {payload.observaciones}" if payload.observaciones else "")))
                conn.commit()
            except Exception:
                # No fallar el pago si no se puede registrar en pago_O
                pass
        ins_pago.close()

        # Responder pago creado
        cur.execute('SELECT idPago, idCompra, monto, fecha, metodo, observaciones FROM compra_pago_O WHERE idPago = %s', (idPago,))
        row = cur.fetchone();
        if row:
            row['monto'] = float(row['monto']) if row.get('monto') is not None else 0.0
            row['fecha'] = row['fecha'].isoformat() if row.get('fecha') else None
        cur.close(); conn.close(); return row or {}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))


@app.post('/compras/{id}/comprobantes')
async def upload_comprobantes(id: int, request: Request, x_user_role: str = Header(None), files: List[UploadFile] = File(...)):
    """Sube comprobantes (imagen/pdf) para una compra existente."""
    role = get_role(x_user_role, request)
    if role not in ('admin', 'editor', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)

        # Verificar compra y scoping
        cur.execute('SELECT idCompra, idEmpresa FROM compra_O WHERE idCompra = %s', (id,))
        compra = cur.fetchone()
        if not compra:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail='Compra no encontrada')
        if role != 'superadmin' and user_company is not None and compra['idEmpresa'] != user_company:
            cur.close(); conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')

        os.makedirs('/app/uploads/comprobantes', exist_ok=True)
        saved = []
        for f in files:
            if not f.filename:
                continue
            mime = f.content_type or ''
            if not (mime.startswith('image/') or mime == 'application/pdf'):
                continue  # saltar tipos no permitidos
            content = await f.read()
            name, ext = os.path.splitext(f.filename)
            ext = ext or ('.pdf' if mime == 'application/pdf' else '.bin')
            safe_name = name.replace(' ', '_').replace('/', '_')
            filename = f"compra_{id}_{int(os.path.getmtime('/app') if os.path.exists('/app') else 0)}_{hash(f.filename)}{ext}"
            rel_path = f"/uploads/comprobantes/{filename}"
            abs_path = f"/app{rel_path}"
            with open(abs_path, 'wb') as out:
                out.write(content)
            # Insert record
            ins = conn.cursor()
            ins.execute('''
                INSERT INTO compra_comprobante_O (idCompra, rutaArchivo, nombreArchivo, mimeType)
                VALUES (%s, %s, %s, %s)
            ''', (id, rel_path, f.filename, mime))
            conn.commit()
            ins.close()
            saved.append({ 'rutaArchivo': rel_path, 'nombreArchivo': f.filename, 'mimeType': mime })
        cur.close(); conn.close()
        return { 'uploaded': saved }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete('/compras/{id}/comprobantes/{comprobante_id}', status_code=204)
def delete_comprobante(id: int, comprobante_id: int, x_user_role: str = Header(None), request: Request = None):
    """Elimina un comprobante espec├¡fico de una compra (borra archivo y registro)."""
    role = get_role(x_user_role, request)
    if role not in ('admin', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)

        # Validar existencia de compra y scoping
        cur.execute('SELECT idCompra, idEmpresa FROM compra_O WHERE idCompra = %s', (id,))
        compra = cur.fetchone()
        if not compra:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail='Compra no encontrada')
        if role != 'superadmin' and user_company is not None and compra['idEmpresa'] != user_company:
            cur.close(); conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')

        # Obtener comprobante
        cur.execute('SELECT idComprobante, rutaArchivo FROM compra_comprobante_O WHERE idComprobante = %s AND idCompra = %s', (comprobante_id, id))
        comp = cur.fetchone()
        if not comp:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail='Comprobante no encontrado')

        # Borrar archivo
        rel_path = comp.get('rutaArchivo') or ''
        abs_path = f"/app{rel_path}" if rel_path.startswith('/') else f"/app/{rel_path}"
        try:
            if os.path.exists(abs_path) and os.path.isfile(abs_path):
                os.remove(abs_path)
        except Exception:
            # No bloquear por errores de filesystem
            pass

        # Borrar registro
        d = conn.cursor()
        d.execute('DELETE FROM compra_comprobante_O WHERE idComprobante = %s', (comprobante_id,))
        conn.commit()
        d.close(); cur.close(); conn.close()
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/compras', response_model=CompraOut, status_code=201)
def create_compra(payload: CompraIn, x_user_role: str = Header(None), request: Request = None):
    """Crear compra."""
    print(f"DEBUG: POST /compras called - payload: {payload}")
    role = get_role(x_user_role, request)
    print(f"DEBUG: Role: {role}")
    if role not in ('admin', 'editor', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        # Determinar empresa
        user_company = get_company_id_from_request(request)
        if role == 'superadmin':
            # Obtener empresa del proveedor (campo idEmpresaProveedor)
            cur.execute('SELECT idEmpresaProveedor FROM proveedor_O WHERE idProveedor = %s', (payload.idProveedor,))
            prov = cur.fetchone()
            if not prov or not prov.get('idEmpresaProveedor'):
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='Proveedor no tiene empresa asignada')
            target_company = prov['idEmpresaProveedor']
        else:
            if user_company is None:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='Usuario sin empresa')
            target_company = user_company

        # Validar proveedor
        cur.execute('SELECT idProveedor, idEmpresaProveedor FROM proveedor_O WHERE idProveedor = %s', (payload.idProveedor,))
        prov = cur.fetchone()
        if not prov:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Proveedor no existe')
        
        if role != 'superadmin' and prov['idEmpresaProveedor'] != target_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Proveedor no pertenece a su empresa')

        # Validar tipoPago
        cur.execute('SELECT idPago FROM tipoPago WHERE idPago = %s', (payload.idTipoPago,))
        if not cur.fetchone():
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Tipo de pago no existe')

        # Validar productos
        for det in payload.detalles:
            cur.execute('SELECT idProducto, idEmpresa FROM producto_O WHERE idProducto = %s', (det.idProducto,))
            prod = cur.fetchone()
            if not prod:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail=f'Producto {det.idProducto} no existe')
            if prod['idEmpresa'] != target_company:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail=f'Producto {det.idProducto} no pertenece a la empresa')

        fechaCompra = payload.fechaCompra or date.today().isoformat()
        
        # Parse date to get year, month, day
        fecha_obj = date.fromisoformat(fechaCompra)
        anio = fecha_obj.year
        mes = fecha_obj.month
        dia = fecha_obj.day

        # Get empresa name for numeroCompra format: ACRONIMO-COMP-YYYY-MM-DD-NNN
        cur.execute('SELECT nombre_empresa FROM empresa_O WHERE id_empresa = %s', (target_company,))
        empresa_row = cur.fetchone()
        if not empresa_row:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Empresa no encontrada')
        
        # Generate acronym from empresa name (first letters of each word, uppercase)
        nombre_empresa = empresa_row['nombre_empresa']
        palabras = nombre_empresa.strip().split()
        if len(palabras) > 0:
            acronimo = ''.join([p[0] for p in palabras if p]).upper()[:5]  # Max 5 chars
        else:
            acronimo = nombre_empresa[:3].upper()  # Fallback to first 3 chars
        
        # Generate numeroCompra in format: ACRONIMO-COMP-YYYY-MM-DD-NNN
        # Find the next available number for this date
        numero_del_dia = 1
        while True:
            numero_compra = f"{acronimo}-COMP-{anio}-{mes:02d}-{dia:02d}-{numero_del_dia:03d}"
            cur.execute('SELECT COUNT(*) as existe FROM compra_O WHERE numeroCompra = %s', (numero_compra,))
            existe = cur.fetchone()
            if existe and existe.get('existe', 0) > 0:
                numero_del_dia += 1
            else:
                break
            # Safety check to avoid infinite loop
            if numero_del_dia > 999:
                raise HTTPException(status_code=500, detail='No se pudo generar número de compra único')

        # Insertar compra
        idUsuario = get_user_id_from_request(request) or 1  # Fallback to user 1 if not found
        print(f"DEBUG: Creating compra - idUsuario from JWT: {idUsuario}, role: {role}")
        ins = conn.cursor()
        try:
            ins.execute('''
                INSERT INTO compra_O (numeroCompra, fechaCompra, idProveedor, idTipoPago, idEmpresa, montoTotal, estado, observaciones, idUsuario)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (numero_compra, fechaCompra, payload.idProveedor, payload.idTipoPago, target_company, 
                  float(payload.montoTotal), payload.estado, payload.observaciones, idUsuario))
        except mysql_errors.DataError as de:
            # Manejar error por longitud insuficiente de la columna numeroCompra
            if 'Data too long for column' in str(de) and 'numeroCompra' in str(de):
                try:
                    print('WARN: numeroCompra demasiado corto. Intentando ampliar columna a VARCHAR(64)')
                    alt = conn.cursor()
                    alt.execute("""
                        ALTER TABLE compra_O
                        MODIFY COLUMN numeroCompra VARCHAR(64) NOT NULL
                    """)
                    conn.commit()
                    alt.close()
                    # Reintentar inserción
                    ins.execute('''
                        INSERT INTO compra_O (numeroCompra, fechaCompra, idProveedor, idTipoPago, idEmpresa, montoTotal, estado, observaciones, idUsuario)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (numero_compra, fechaCompra, payload.idProveedor, payload.idTipoPago, target_company, 
                          float(payload.montoTotal), payload.estado, payload.observaciones, idUsuario))
                except Exception:
                    # Si por alguna razón no podemos alterar, acortar el código como último recurso
                    fallback_numero = numero_compra[:30]
                    ins.execute('''
                        INSERT INTO compra_O (numeroCompra, fechaCompra, idProveedor, idTipoPago, idEmpresa, montoTotal, estado, observaciones, idUsuario)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (fallback_numero, fechaCompra, payload.idProveedor, payload.idTipoPago, target_company, 
                          float(payload.montoTotal), payload.estado, payload.observaciones, idUsuario))
            else:
                raise
        conn.commit()
        new_id = ins.lastrowid
        ins.close()

        # Insertar detalles y actualizar stock
        for det in payload.detalles:
            ins2 = conn.cursor()
            # subtotal es una columna generada (cantidad_caja * precio_unitario), no se debe insertar explícitamente
            # precio_paquete: guardar precio por paquete (caja) como copia explícita del precio_unitario
            # botellas_por_caja y precio_por_botella: guardar si vienen en el payload (opcional)
            # fechaVencimiento: fecha de vencimiento del producto
            fechaVenc = det.fechaVencimiento if det.fechaVencimiento else None
            try:
                ins2.execute('''
                    INSERT INTO detalle_compra_O (
                        idCompra, idProducto, cantidad_caja, precio_unitario, precio_paquete,
                        botellas_por_caja, precio_por_botella, fechaVencimiento
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ''', (
                    new_id, det.idProducto, det.cantidad_caja, float(det.precio_unitario), float(det.precio_unitario),
                    int(det.botellas_por_caja) if det.botellas_por_caja is not None else None,
                    float(det.precio_por_botella) if det.precio_por_botella is not None else None,
                    fechaVenc
                ))
            except mysql_errors.ProgrammingError as pe:
                # Si alguna columna no existe, crearla y reintentar
                if 'Unknown column' in str(pe):
                    try:
                        alt = conn.cursor()
                        # Crear columnas que falten de manera idempotente
                        try:
                            alt.execute("""
                                ALTER TABLE detalle_compra_O
                                ADD COLUMN IF NOT EXISTS precio_paquete DECIMAL(10,2) NULL AFTER precio_unitario
                            """)
                        except Exception:
                            pass
                        try:
                            alt.execute("""
                                ALTER TABLE detalle_compra_O
                                ADD COLUMN IF NOT EXISTS botellas_por_caja INT NULL AFTER cantidad_caja
                            """)
                        except Exception:
                            pass
                        try:
                            alt.execute("""
                                ALTER TABLE detalle_compra_O
                                ADD COLUMN IF NOT EXISTS precio_por_botella DECIMAL(10,4) NULL AFTER precio_paquete
                            """)
                        except Exception:
                            pass
                        conn.commit()
                        alt.close()
                        # Reintentar inserción con columnas nuevas
                        ins2.execute('''
                            INSERT INTO detalle_compra_O (
                                idCompra, idProducto, cantidad_caja, precio_unitario, precio_paquete,
                                botellas_por_caja, precio_por_botella, fechaVencimiento
                            )
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        ''', (
                            new_id, det.idProducto, det.cantidad_caja, float(det.precio_unitario), float(det.precio_unitario),
                            int(det.botellas_por_caja) if det.botellas_por_caja is not None else None,
                            float(det.precio_por_botella) if det.precio_por_botella is not None else None,
                            fechaVenc
                        ))
                    except Exception:
                        # Fallback final: insertar sin columnas opcionales
                        ins2.execute('''
                            INSERT INTO detalle_compra_O (idCompra, idProducto, cantidad_caja, precio_unitario, fechaVencimiento)
                            VALUES (%s, %s, %s, %s, %s)
                        ''', (new_id, det.idProducto, det.cantidad_caja, float(det.precio_unitario), fechaVenc))
                else:
                    # Otros errores, relanzar
                    raise
            
            # Crear lote de producto para rastrear esta compra específica
            # Esto permite FEFO (First Expired First Out) y trazabilidad por compra
            try:
                # Intentar guardar botellasPorCaja también en el lote si existe la columna
                ins2.execute('''
                    INSERT INTO lote_producto 
                    (idProducto, idProveedor, fechaCompra, fechaVencimiento, precioCompra, cantidadCajas, stockActual, idEmpresa, idUsuarioCreador, idCompra, botellasPorCaja)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''', (det.idProducto, payload.idProveedor, fechaCompra, fechaVenc, float(det.precio_unitario), 
                      det.cantidad_caja, det.cantidad_caja, target_company, idUsuario, new_id, 
                      int(det.botellas_por_caja) if det.botellas_por_caja is not None else None))
            except mysql_errors.ProgrammingError as e_lote:
                if 'Unknown column' in str(e_lote) and 'botellasPorCaja' in str(e_lote):
                    try:
                        alt2 = conn.cursor()
                        alt2.execute("""
                            ALTER TABLE lote_producto
                            ADD COLUMN IF NOT EXISTS botellasPorCaja INT NULL AFTER cantidadCajas
                        """)
                        conn.commit()
                        alt2.close()
                        # Reintentar inserción con columna botellasPorCaja
                        ins2.execute('''
                            INSERT INTO lote_producto 
                            (idProducto, idProveedor, fechaCompra, fechaVencimiento, precioCompra, cantidadCajas, stockActual, idEmpresa, idUsuarioCreador, idCompra, botellasPorCaja)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ''', (det.idProducto, payload.idProveedor, fechaCompra, fechaVenc, float(det.precio_unitario), 
                              det.cantidad_caja, det.cantidad_caja, target_company, idUsuario, new_id, 
                              int(det.botellas_por_caja) if det.botellas_por_caja is not None else None))
                    except Exception:
                        # Fallback: insertar sin la columna botellasPorCaja
                        ins2.execute('''
                            INSERT INTO lote_producto 
                            (idProducto, idProveedor, fechaCompra, fechaVencimiento, precioCompra, cantidadCajas, stockActual, idEmpresa, idUsuarioCreador, idCompra)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        ''', (det.idProducto, payload.idProveedor, fechaCompra, fechaVenc, float(det.precio_unitario), 
                              det.cantidad_caja, det.cantidad_caja, target_company, idUsuario, new_id))
                else:
                    # Fallback general para lote_producto si falla por otra razón
                    ins2.execute('''
                        INSERT INTO lote_producto 
                        (idProducto, idProveedor, fechaCompra, fechaVencimiento, precioCompra, cantidadCajas, stockActual, idEmpresa, idUsuarioCreador, idCompra)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (det.idProducto, payload.idProveedor, fechaCompra, fechaVenc, float(det.precio_unitario), 
                          det.cantidad_caja, det.cantidad_caja, target_company, idUsuario, new_id))
            
            # El stock del producto se actualiza automáticamente por el trigger tr_actualizar_stock_producto_insert
            # que suma el stockActual de todos los lotes activos
            conn.commit()
            ins2.close()

        # Registrar movimiento en cuenta corriente
        # Tabla tipoPago: 1=crédito, 2=contado, 7=transferencia bancaria
        ins3 = conn.cursor()
        
        # Obtener datos del proveedor para descripción
        cur.execute('SELECT idPersona, esEmpresa, nombreComercial FROM proveedor_O WHERE idProveedor = %s', (payload.idProveedor,))
        prov_data = cur.fetchone() or {}
        id_persona_prov = prov_data.get('idPersona') if prov_data and not prov_data.get('esEmpresa') else None
        nombre_proveedor = prov_data.get('nombreComercial') or str(payload.idProveedor)
        
        if payload.idTipoPago == 1:  # crédito
            descripcion = f"Compra #{new_id} a crédito - Proveedor: {nombre_proveedor}"
            # Intentar crear movimiento con idPersona si existe
            try:
                ins3.execute('''
                    INSERT INTO cuenta_corriente_O 
                    (tipo, idPersona, idEmpresa, fechaMovimiento, tipoMovimiento, idReferencia, debe, haber, saldo, descripcion, estado)
                    VALUES ('proveedor', %s, %s, %s, 'compra', %s, 0, %s, %s, %s, 1)
                ''', (id_persona_prov, target_company, fechaCompra, new_id,
                      float(payload.montoTotal), float(payload.montoTotal), descripcion))
                conn.commit()
            except Exception as e_cc:
                # Si falla por idPersona NULL o restricción, intentar con 0 como valor neutral
                try:
                    ins3.execute('''
                        INSERT INTO cuenta_corriente_O 
                        (tipo, idPersona, idEmpresa, fechaMovimiento, tipoMovimiento, idReferencia, debe, haber, saldo, descripcion, estado)
                        VALUES ('proveedor', %s, %s, %s, 'compra', %s, 0, %s, %s, %s, 1)
                    ''', (0, target_company, fechaCompra, new_id,
                          float(payload.montoTotal), float(payload.montoTotal), descripcion))
                    conn.commit()
                except Exception:
                    # No bloquear creación de compra si el asiento contable falla
                    pass
        else:  # contado (idTipoPago == 2 o 7)
            descripcion = f"Compra #{new_id} al contado - Proveedor: {nombre_proveedor}"
            # Registrar salida de caja: tipo=caja, debe=montoTotal (salida de efectivo)
            try:
                ins3.execute('''
                    INSERT INTO cuenta_corriente_O 
                    (tipo, idPersona, idEmpresa, fechaMovimiento, tipoMovimiento, idReferencia, debe, haber, saldo, descripcion, estado)
                    VALUES ('caja', NULL, %s, %s, 'compra', %s, %s, 0, %s, %s, 1)
                ''', (target_company, fechaCompra, new_id, 
                      float(payload.montoTotal), 
                      -float(payload.montoTotal),
                      descripcion))
                conn.commit()
            except Exception:
                # No bloquear creación de compra si el asiento contable falla
                pass
        
        ins3.close()

        cur.close()
        conn.close()
        
        return get_compra(new_id, x_user_role, request)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/compras/{id}', response_model=CompraOut)
def update_compra(id: int, payload: CompraIn, x_user_role: str = Header(None), request: Request = None):
    """Actualizar compra: estado, observaciones, y si 'detalles' está presente, reemplazar detalles y lotes."""
    role = get_role(x_user_role, request)
    if role not in ('admin', 'editor', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)

        cur.execute('SELECT idCompra, idEmpresa FROM compra_O WHERE idCompra = %s', (id,))
        compra = cur.fetchone()
        if not compra:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Compra no encontrada')

        if role != 'superadmin' and user_company is not None and compra['idEmpresa'] != user_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')

        upd = conn.cursor()

        # Si se está anulando la compra (estado = 0), actualizar lotes y poner total en 0
        if payload.estado == 0:
            upd.execute('UPDATE lote_producto SET stockActual = 0 WHERE idCompra = %s', (id,))
            upd.execute('''
                UPDATE compra_O 
                SET estado = %s, montoTotal = 0, observaciones = %s
                WHERE idCompra = %s
            ''', (payload.estado, payload.observaciones, id))
        else:
            # Si 'detalles' está presente y no vacío, reemplazar detalles y lotes
            if hasattr(payload, 'detalles') and payload.detalles:
                # Eliminar detalles y lotes existentes
                del_cur = conn.cursor()
                del_cur.execute('DELETE FROM detalle_compra_O WHERE idCompra = %s', (id,))
                del_cur.execute('DELETE FROM lote_producto WHERE idCompra = %s', (id,))
                conn.commit()
                del_cur.close()

                # Insertar nuevos detalles y lotes
                for det in payload.detalles:
                    ins2 = conn.cursor()
                    fechaVenc = det.fechaVencimiento if hasattr(det, 'fechaVencimiento') else None
                    ins2.execute('''
                        INSERT INTO detalle_compra_O (
                            idCompra, idProducto, cantidad_caja, precio_unitario, precio_paquete,
                            botellas_por_caja, precio_por_botella, fechaVencimiento
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (
                        id, det.idProducto, det.cantidad_caja, float(det.precio_unitario), float(det.precio_unitario),
                        int(det.botellas_por_caja) if getattr(det, 'botellas_por_caja', None) is not None else None,
                        float(det.precio_por_botella) if getattr(det, 'precio_por_botella', None) is not None else None,
                        fechaVenc
                    ))
                    # Insertar lote_producto
                    ins2.execute('''
                        INSERT INTO lote_producto 
                        (idProducto, idProveedor, fechaCompra, fechaVencimiento, precioCompra, cantidadCajas, stockActual, idEmpresa, idUsuarioCreador, idCompra, botellasPorCaja)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ''', (
                        det.idProducto, payload.idProveedor, payload.fechaCompra or None, fechaVenc, float(det.precio_unitario),
                        det.cantidad_caja, det.cantidad_caja, compra['idEmpresa'], None, id,
                        int(det.botellas_por_caja) if getattr(det, 'botellas_por_caja', None) is not None else None
                    ))
                    conn.commit()
                    ins2.close()
            # Actualizar estado y observaciones (sin cambiar montoTotal)
            upd.execute('''
                UPDATE compra_O 
                SET estado = %s, observaciones = %s
                WHERE idCompra = %s
            ''', (payload.estado, payload.observaciones, id))

        conn.commit()
        upd.close()
        cur.close()
        conn.close()

        return get_compra(id, x_user_role, request)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete('/compras/{id}', status_code=204)
def delete_compra(id: int, x_user_role: str = Header(None), request: Request = None):
    """Anular/eliminar compra."""
    role = get_role(x_user_role, request)
    if role not in ('admin', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)

        cur.execute('SELECT idCompra, idEmpresa FROM compra_O WHERE idCompra = %s', (id,))
        compra = cur.fetchone()
        if not compra:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Compra no encontrada')

        if role != 'superadmin' and user_company is not None and compra['idEmpresa'] != user_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')

        if role == 'superadmin':
            d1 = conn.cursor()
            d1.execute('DELETE FROM detalle_compra_O WHERE idCompra = %s', (id,))
            d1.close()
            d2 = conn.cursor()
            d2.execute('DELETE FROM compra_O WHERE idCompra = %s', (id,))
            conn.commit()
            d2.close()
        else:
            # Admin/Editor: anular (estado=0, montoTotal=0, stock de lotes=0)
            upd = conn.cursor()
            upd.execute('UPDATE lote_producto SET stockActual = 0 WHERE idCompra = %s', (id,))
            upd.execute('UPDATE compra_O SET estado = 0, montoTotal = 0 WHERE idCompra = %s', (id,))
            conn.commit()
            upd.close()

        cur.close()
        conn.close()
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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


@app.get('/compras/{id}/lotes')
def get_lotes_compra(id: int, x_user_role: str = Header(None), request: Request = None):
    """Obtener lotes de una compra espec├¡fica."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)
        role = get_role(x_user_role, request)

        # Verificar permisos de la compra
        cur.execute('SELECT idEmpresa FROM compra_O WHERE idCompra = %s', (id,))
        compra = cur.fetchone()
        if not compra:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Compra no encontrada')

        if role != 'superadmin' and user_company is not None and compra['idEmpresa'] != user_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')

        # Obtener lotes de esta compra con informaci├│n de producto
        cur.execute('''
            SELECT 
                l.idLote,
                l.idProducto,
                p.nombreProducto,
                l.cantidadCajas,
                l.stockActual,
                l.precioCompra,
                l.fechaCompra,
                l.fechaVencimiento,
                l.idProveedor,
                prov.nombreComercial as nombreProveedor
            FROM lote_producto l
            LEFT JOIN producto_O p ON l.idProducto = p.idProducto
            LEFT JOIN proveedor_O prov ON l.idProveedor = prov.idProveedor
            WHERE l.idCompra = %s
            ORDER BY l.idLote DESC
        ''', (id,))
        lotes = cur.fetchall() or []
        cur.close()
        conn.close()
        return lotes
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/tipos-pago')
def list_tipos_pago(x_user_role: str = Header(None), request: Request = None):
    """Lista tipos de pago disponibles (idPago, nombrePago)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT idPago, nombrePago AS tipoPago FROM tipoPago ORDER BY idPago')
        items = cur.fetchall() or []
        cur.close(); conn.close()
        return items
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))




