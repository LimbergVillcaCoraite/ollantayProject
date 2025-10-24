from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, datetime
from decimal import Decimal
import os
import mysql.connector
from mysql.connector import errors as mysql_errors
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


def get_db_connection():
    return mysql.connector.connect(
        host=os.getenv('DATABASE_HOST', 'mysql8032'),
        port=int(os.getenv('DATABASE_PORT', 3306)),
        user=os.getenv('DATABASE_USER', 'root'),
        password=os.getenv('DATABASE_PASSWORD', os.getenv('MYSQL_ROOT_PASSWORD', 'P4assw@rd')),
        database=os.getenv('DATABASE_NAME', 'SystemaOllantay'),
    )

# JWT settings (shared with persona_service)
JWT_SECRET = os.getenv('JWT_SECRET', 'dev-secret-change-me')
JWT_ALG = 'HS256'


def get_role(x_user_role: str = Header(None), request: Request = None) -> str:
    """Resolve effective role for the request."""
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
    """Extract company_id (idEmpresa) from JWT if present."""
    try:
        token = request.cookies.get('ollantay_token') if request is not None else None
        if not token:
            return None
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        cid = payload.get('company_id')
        return int(cid) if cid is not None else None
    except Exception:
        return None


def get_id_persona_from_request(request: Request = None) -> Optional[int]:
    """Extract id_persona from JWT if present."""
    try:
        token = request.cookies.get('ollantay_token') if request is not None else None
        if not token:
            return None
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        pid = payload.get('id_persona')
        return int(pid) if pid is not None else None
    except Exception:
        return None


# ========================
# Modelos para Ventas
# ========================

class DetalleVentaIn(BaseModel):
    idProducto: int
    cantidad_caja: int = Field(ge=0)
    precio_unitario: Decimal = Field(ge=0)
    subtotal: Decimal = Field(ge=0)


class DetalleVentaOut(DetalleVentaIn):
    idDetalle: int
    idVenta: int
    nombreProducto: Optional[str] = None


class VentaIn(BaseModel):
    fechaVenta: Optional[str] = None  # ISO date YYYY-MM-DD
    idTipoVenta: int  # 1=mayorista, 2=minorista
    idTipoPago: int  # 1=contado, 2=credito
    idCliente: int  # id_persona
    montoTotal: Decimal = Field(ge=0)
    estado: int = Field(default=1, ge=0, le=1)  # 1=activa, 0=anulada
    observaciones: Optional[str] = Field(None, max_length=500)
    detalles: List[DetalleVentaIn] = []


class VentaOut(BaseModel):
    idVenta: int
    fechaVenta: str
    idTipoVenta: int
    tipoVenta: Optional[str] = None
    idTipoPago: int
    tipoPago: Optional[str] = None
    idCliente: int
    nombreCliente: Optional[str] = None
    idEmpresa: int
    nombreEmpresa: Optional[str] = None
    montoTotal: Decimal
    estado: int
    observaciones: Optional[str] = None
    detalles: List[DetalleVentaOut] = []


# ========================
# Endpoints de Ventas
# ========================

@app.get('/ventas', response_model=List[VentaOut])
def list_ventas(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    idCliente: Optional[int] = None,
    idTipoVenta: Optional[int] = None,
    idTipoPago: Optional[int] = None,
    estado: Optional[int] = None,
    offset: int = 0,
    limit: int = 100,
    x_user_role: str = Header(None),
    request: Request = None
):
    """Listar ventas con filtros. Superadmin ve todas, admin solo de su empresa."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        role = get_role(x_user_role, request)
        user_company = get_company_id_from_request(request)

        # Base query con JOINs para obtener nombres
        query = '''
            SELECT 
                v.idVenta, v.fechaVenta, v.idTipoVenta, tv.nombreTipoVenta AS tipoVenta,
                v.idTipoPago, tp.nombrePago AS tipoPago, v.idCliente,
                CONCAT(p.nombres_persona, ' ', COALESCE(p.apellido_paternoPersona, '')) AS nombreCliente,
                v.idEmpresa, e.nombre_empresa AS nombreEmpresa,
                v.montoTotal, v.estado, v.observaciones
            FROM venta_O v
            LEFT JOIN tipoVenta tv ON v.idTipoVenta = tv.idTipoVenta
            LEFT JOIN tipoPago tp ON v.idTipoPago = tp.idPago
            LEFT JOIN persona_O p ON v.idCliente = p.id_persona
            LEFT JOIN empresa_O e ON v.idEmpresa = e.id_empresa
        '''
        
        where = []
        params = []

        # Scoping multiempresa: superadmin ve todo, admin solo su empresa
        if role != 'superadmin' and user_company is not None:
            where.append('v.idEmpresa = %s')
            params.append(user_company)

        # Filtros opcionales
        if fecha_inicio:
            where.append('v.fechaVenta >= %s')
            params.append(fecha_inicio)
        if fecha_fin:
            where.append('v.fechaVenta <= %s')
            params.append(fecha_fin)
        if idCliente is not None:
            where.append('v.idCliente = %s')
            params.append(idCliente)
        if idTipoVenta is not None:
            where.append('v.idTipoVenta = %s')
            params.append(idTipoVenta)
        if idTipoPago is not None:
            where.append('v.idTipoPago = %s')
            params.append(idTipoPago)
        if estado is not None:
            where.append('v.estado = %s')
            params.append(estado)

        if where:
            query += ' WHERE ' + ' AND '.join(where)
        
        query += ' ORDER BY v.fechaVenta DESC, v.idVenta DESC LIMIT %s OFFSET %s'
        params.extend([limit, offset])

        cur.execute(query, tuple(params))
        ventas = cur.fetchall() or []

        # Obtener detalles para cada venta
        result = []
        for v in ventas:
            cur.execute('''
                SELECT 
                    dv.idDetalle, dv.idVenta, dv.idProducto, dv.cantidad_caja,
                    dv.precio_unitario, dv.subtotal, pr.nombreProducto
                FROM detalle_venta_O dv
                LEFT JOIN producto_O pr ON dv.idProducto = pr.idProducto
                WHERE dv.idVenta = %s
            ''', (v['idVenta'],))
            detalles = cur.fetchall() or []
            
            v['fechaVenta'] = v['fechaVenta'].isoformat() if v.get('fechaVenta') else None
            v['montoTotal'] = float(v['montoTotal']) if v.get('montoTotal') else 0.0
            
            for d in detalles:
                d['subtotal'] = float(d['subtotal']) if d.get('subtotal') else 0.0
            
            v['detalles'] = detalles
            result.append(v)
        cur.close()
        conn.close()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/ventas/{id}', response_model=VentaOut)
def get_venta(id: int, x_user_role: str = Header(None), request: Request = None):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        role = get_role(x_user_role, request)
        user_company = get_company_id_from_request(request)

        query = '''
            SELECT 
                v.idVenta, v.fechaVenta, v.idTipoVenta, tv.nombreTipoVenta AS tipoVenta,
                v.idTipoPago, tp.nombrePago AS tipoPago, v.idCliente,
                CONCAT(p.nombres_persona, ' ', COALESCE(p.apellido_paternoPersona, '')) AS nombreCliente,
                v.idEmpresa, e.nombre_empresa AS nombreEmpresa,
                v.montoTotal, v.estado, v.observaciones
            FROM venta_O v
            LEFT JOIN tipoVenta tv ON v.idTipoVenta = tv.idTipoVenta
            LEFT JOIN tipoPago tp ON v.idTipoPago = tp.idPago
            LEFT JOIN persona_O p ON v.idCliente = p.id_persona
            LEFT JOIN empresa_O e ON v.idEmpresa = e.id_empresa
            WHERE v.idVenta = %s
        '''
        cur.execute(query, (id,))
        venta = cur.fetchone()
        
        if not venta:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Venta no encontrada')
        
        if role != 'superadmin' and user_company is not None and venta['idEmpresa'] != user_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No autorizado para ver esta venta')

        # Obtener detalles
        cur.execute('''
            SELECT 
                dv.idDetalle, dv.idVenta, dv.idProducto, dv.cantidad_caja,
                dv.precio_unitario, dv.subtotal, pr.nombreProducto
            FROM detalle_venta_O dv
            LEFT JOIN producto_O pr ON dv.idProducto = pr.idProducto
            WHERE dv.idVenta = %s
        ''', (id,))
        detalles = cur.fetchall() or []
        
        venta['fechaVenta'] = venta['fechaVenta'].isoformat() if venta.get('fechaVenta') else None
        venta['montoTotal'] = float(venta['montoTotal']) if venta.get('montoTotal') else 0.0
        
        for d in detalles:
            d['precio_unitario'] = float(d['precio_unitario']) if d.get('precio_unitario') else 0.0
            d['subtotal'] = float(d['subtotal']) if d.get('subtotal') else 0.0
        
        venta['detalles'] = detalles
        
        cur.close()
        conn.close()
        return venta
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/ventas', response_model=VentaOut, status_code=201)
def create_venta(payload: VentaIn, x_user_role: str = Header(None), request: Request = None):
    """Crear una nueva venta. Admin crea en su empresa, superadmin en cualquiera."""
    role = get_role(x_user_role, request)
    if role not in ('admin', 'editor', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        # Determinar empresa target
        user_company = get_company_id_from_request(request)
        if role == 'superadmin':
            # Superadmin podría especificar empresa via cliente
            cur.execute('SELECT id_empresa FROM persona_O WHERE id_persona = %s', (payload.idCliente,))
            cliente = cur.fetchone()
            if not cliente or not cliente.get('id_empresa'):
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='Cliente no tiene empresa asignada')
            target_company = cliente['id_empresa']
        else:
            # Admin/editor: forzar a su empresa
            if user_company is None:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='Usuario sin empresa asignada')
            target_company = user_company

        # Validar que el cliente existe y pertenece a la empresa
        cur.execute('SELECT id_persona, id_empresa FROM persona_O WHERE id_persona = %s', (payload.idCliente,))
        cliente = cur.fetchone()
        if not cliente:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Cliente no existe')
        
        if role != 'superadmin' and cliente['id_empresa'] != target_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Cliente no pertenece a su empresa')

        # Validar tipoVenta y tipoPago
        cur.execute('SELECT idTipoVenta FROM tipoVenta WHERE idTipoVenta = %s', (payload.idTipoVenta,))
        if not cur.fetchone():
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Tipo de venta no existe')

        cur.execute('SELECT idPago FROM tipoPago WHERE idPago = %s', (payload.idTipoPago,))
        if not cur.fetchone():
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Tipo de pago no existe')

        # Validar que todos los productos existen y pertenecen a la empresa
        for det in payload.detalles:
            cur.execute('SELECT idProducto, idEmpresa, stockCaja FROM producto_O WHERE idProducto = %s', (det.idProducto,))
            prod = cur.fetchone()
            if not prod:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail=f'Producto {det.idProducto} no existe')
            if prod['idEmpresa'] != target_company:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail=f'Producto {det.idProducto} no pertenece a la empresa')
            # Validar stock suficiente
            if prod['stockCaja'] < det.cantidad_caja:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail=f'Stock insuficiente para producto {det.idProducto}')

        # Fecha por defecto hoy
        fechaVenta = payload.fechaVenta or date.today().isoformat()

        # Insertar venta
        ins = conn.cursor()
        ins.execute('''
            INSERT INTO venta_O (fechaVenta, idTipoVenta, idTipoPago, idCliente, idEmpresa, montoTotal, estado, observaciones)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ''', (fechaVenta, payload.idTipoVenta, payload.idTipoPago, payload.idCliente, target_company, 
              float(payload.montoTotal), payload.estado, payload.observaciones))
        conn.commit()
        new_id = ins.lastrowid
        ins.close()

        # Insertar detalles y actualizar stock
        for det in payload.detalles:
            ins2 = conn.cursor()
            ins2.execute('''
                INSERT INTO detalle_venta_O (idVenta, idProducto, cantidad_caja, precio_unitario, subtotal)
                VALUES (%s, %s, %s, %s, %s)
            ''', (new_id, det.idProducto, det.cantidad_caja, float(det.precio_unitario), float(det.subtotal)))
            # Actualizar stock
            ins2.execute('UPDATE producto_O SET stockCaja = stockCaja - %s WHERE idProducto = %s', 
                        (det.cantidad_caja, det.idProducto))
            conn.commit()
            ins2.close()

        # Si es venta a crédito, crear movimiento en cuenta corriente
        if payload.idTipoPago == 2:  # crédito
            ins3 = conn.cursor()
            # Crear movimiento: tipo=cliente, debe=montoTotal (el cliente nos debe)
            ins3.execute('''
                INSERT INTO cuenta_corriente_O 
                (tipo, idPersona, idEmpresa, fechaMovimiento, tipoMovimiento, idReferencia, debe, haber, saldo, descripcion, estado)
                VALUES ('cliente', %s, %s, %s, 'venta', %s, %s, 0, %s, %s, 1)
            ''', (payload.idCliente, target_company, fechaVenta, new_id, 
                  float(payload.montoTotal), float(payload.montoTotal), 
                  f'Venta #{new_id} a crédito'))
            conn.commit()
            ins3.close()

        cur.close()
        conn.close()
        
        # Retornar venta creada
        return get_venta(new_id, x_user_role, request)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/ventas/{id}', response_model=VentaOut)
def update_venta(id: int, payload: VentaIn, x_user_role: str = Header(None), request: Request = None):
    """Actualizar venta (solo estado y observaciones). Admin/superadmin."""
    role = get_role(x_user_role, request)
    if role not in ('admin', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)

        # Verificar que existe
        cur.execute('SELECT idVenta, idEmpresa FROM venta_O WHERE idVenta = %s', (id,))
        venta = cur.fetchone()
        if not venta:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Venta no encontrada')

        # Validar scoping
        if role != 'superadmin' and user_company is not None and venta['idEmpresa'] != user_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No autorizado para modificar esta venta')

        # Solo permitir cambio de estado y observaciones (no items ni montos)
        upd = conn.cursor()
        upd.execute('''
            UPDATE venta_O 
            SET estado = %s, observaciones = %s
            WHERE idVenta = %s
        ''', (payload.estado, payload.observaciones, id))
        conn.commit()
        upd.close()
        cur.close()
        conn.close()

        return get_venta(id, x_user_role, request)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete('/ventas/{id}', status_code=204)
def delete_venta(id: int, x_user_role: str = Header(None), request: Request = None):
    """Anular/eliminar venta. Solo superadmin puede eliminar físicamente."""
    role = get_role(x_user_role, request)
    if role not in ('admin', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)

        # Verificar que existe
        cur.execute('SELECT idVenta, idEmpresa, estado FROM venta_O WHERE idVenta = %s', (id,))
        venta = cur.fetchone()
        if not venta:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Venta no encontrada')

        # Validar scoping
        if role != 'superadmin' and user_company is not None and venta['idEmpresa'] != user_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')

        if role == 'superadmin':
            # Superadmin puede eliminar físicamente
            # Primero eliminar detalles
            d1 = conn.cursor()
            d1.execute('DELETE FROM detalle_venta_O WHERE idVenta = %s', (id,))
            d1.close()
            # Luego la venta
            d2 = conn.cursor()
            d2.execute('DELETE FROM venta_O WHERE idVenta = %s', (id,))
            conn.commit()
            d2.close()
        else:
            # Admin solo anula
            upd = conn.cursor()
            upd.execute('UPDATE venta_O SET estado = 0 WHERE idVenta = %s', (id,))
            conn.commit()
            upd.close()

        cur.close()
        conn.close()
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# Endpoints auxiliares
# ========================

@app.get('/tipos-venta')
def list_tipos_venta():
    """Listar tipos de venta (mayorista/minorista)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT idTipoVenta, nombreTipoVenta AS tipoVenta FROM tipoVenta ORDER BY idTipoVenta')
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/tipos-pago')
def list_tipos_pago():
    """Listar tipos de pago (contado/credito)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT idPago, nombrePago AS tipoPago FROM tipoPago ORDER BY idPago')
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
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

