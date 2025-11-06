from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.responses import Response, JSONResponse, HTMLResponse
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
        charset='utf8mb4',
        use_unicode=True
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


def has_permission(request: Request, resource: str, action: Optional[str] = None) -> bool:
    """Check if current user's role has a specific permission for the current company.

    Supports both has_permission(req, 'ventas', 'delete') and has_permission(req, 'ventas:delete').
    Superadmin always has permissions.
    """
    try:
        # Support 'resource:action' as single param
        res = resource
        act = action
        if action is None and ':' in resource:
            parts = resource.split(':', 1)
            res, act = parts[0], parts[1]

        role = get_role(None, request)
        if role == 'superadmin':
            return True
        company_id = get_company_id_from_request(request)
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        # Resolve role id
        cur.execute('SELECT idrole FROM role_O WHERE name = %s', (role,))
        r = cur.fetchone()
        if not r:
            cur.close(); conn.close();
            return False
        if company_id is not None:
            cur.execute('''
                SELECT 1
                FROM role_permission_O rp
                JOIN permission_O p ON rp.perm_id = p.id_perm
                WHERE rp.role_id = %s AND p.resource = %s AND p.action = %s
                  AND (rp.id_empresa = %s OR rp.id_empresa IS NULL)
                LIMIT 1
            ''', (r['idrole'], res, act, company_id))
        else:
            cur.execute('''
                SELECT 1
                FROM role_permission_O rp
                JOIN permission_O p ON rp.perm_id = p.id_perm
                WHERE rp.role_id = %s AND p.resource = %s AND p.action = %s
                  AND rp.id_empresa IS NULL
                LIMIT 1
            ''', (r['idrole'], res, act))
        row = cur.fetchone()
        cur.close(); conn.close()
        return bool(row)
    except Exception:
        return False


# ========================
# Modelos para Ventas
# ========================

class DetalleVentaIn(BaseModel):
    idProducto: int
    cantidad_caja: int = Field(ge=0)
    # precio_unitario and subtotal are accepted but not strictly required from client
    # The server will compute subtotal and may override precio_unitario based on route pricing.
    precio_unitario: Optional[Decimal] = Field(default=None, ge=0)
    subtotal: Optional[Decimal] = None


class DetalleVentaOut(DetalleVentaIn):
    idDetalle: int
    idVenta: int
    nombreProducto: Optional[str] = None


class VentaIn(BaseModel):
    fechaVenta: Optional[str] = None  # ISO date YYYY-MM-DD
    idTipoVenta: int  # 1=mayorista, 2=minorista
    idTipoPago: int  # 1=credito, 2=contado, 7=transferencia bancaria
    idCliente: int  # id_persona
    montoTotal: Decimal = Field(ge=0)
    estado: int = Field(default=1, ge=0, le=1)  # 1=activa, 0=anulada
    observaciones: Optional[str] = Field(None, max_length=500)
    detalles: List[DetalleVentaIn] = []


class VentaOut(BaseModel):
    idVenta: int
    codigoVenta: Optional[str] = None
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
    montoPagado: Optional[Decimal] = 0
    estado_pago: Optional[str] = None
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
    idProducto: Optional[int] = None,
    estado: Optional[int] = None,
    offset: int = 0,
    limit: int = 100,
    x_user_role: str = Header(None),
    request: Request = None
):
    """Listar ventas con filtros. Superadmin ve todas, admin solo de su empresa. Filtro opcional por idProducto."""
    try:
        conn = get_db_connection()
        # Buffered cursor avoids 'Unread result found' when issuing multiple queries
        cur = conn.cursor(dictionary=True, buffered=True)
        role = get_role(x_user_role, request)
        user_company = get_company_id_from_request(request)

        # Base queries con y sin codigoVenta (fallback por esquemas antiguos)
        query_with_code = '''
            SELECT 
                v.idVenta, v.codigoVenta, v.fechaVenta, v.idTipoVenta, tv.nombreTipoVenta AS tipoVenta,
                v.idTipoPago, tp.nombrePago AS tipoPago, v.idCliente,
                CONCAT(p.nombres_persona, ' ', COALESCE(p.apellido_paternoPersona, '')) AS nombreCliente,
                v.idEmpresa, e.nombre_empresa AS nombreEmpresa,
                v.montoTotal, v.montoPagado, v.estado_pago, v.estado, v.observaciones
            FROM venta_O v
            LEFT JOIN tipoVenta tv ON v.idTipoVenta = tv.idTipoVenta
            LEFT JOIN tipoPago tp ON v.idTipoPago = tp.idPago
            LEFT JOIN persona_O p ON v.idCliente = p.id_persona
            LEFT JOIN empresa_O e ON v.idEmpresa = e.id_empresa
        '''
        query_no_code = '''
            SELECT 
                v.idVenta, v.fechaVenta, v.idTipoVenta, tv.nombreTipoVenta AS tipoVenta,
                v.idTipoPago, tp.nombrePago AS tipoPago, v.idCliente,
                CONCAT(p.nombres_persona, ' ', COALESCE(p.apellido_paternoPersona, '')) AS nombreCliente,
                v.idEmpresa, e.nombre_empresa AS nombreEmpresa,
                v.montoTotal, v.montoPagado, v.estado_pago, v.estado, v.observaciones
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
        if idProducto is not None:
            where.append('EXISTS (SELECT 1 FROM detalle_venta_O dv WHERE dv.idVenta = v.idVenta AND dv.idProducto = %s)')
            params.append(idProducto)
        if estado is not None:
            where.append('v.estado = %s')
            params.append(estado)

        if where:
            query_with_code += ' WHERE ' + ' AND '.join(where)
            query_no_code += ' WHERE ' + ' AND '.join(where)

        query_with_code += ' ORDER BY v.fechaVenta DESC, v.idVenta DESC LIMIT %s OFFSET %s'
        query_no_code += ' ORDER BY v.fechaVenta DESC, v.idVenta DESC LIMIT %s OFFSET %s'
        params.extend([limit, offset])

        # Intentar primero con codigoVenta; si falla por columna desconocida, reintentar sin ella
        try:
            cur.execute(query_with_code, tuple(params))
            ventas = cur.fetchall() or []
        except Exception as ex:
            msg = str(ex)
            if 'Unknown column' in msg and 'codigoVenta' in msg:
                cur.execute(query_no_code, tuple(params))
                ventas = cur.fetchall() or []
            else:
                raise

        # Obtener detalles para cada venta
        result = []
        for v in ventas:
            cur.execute('''
                SELECT 
                    dv.idDetalleVenta as idDetalle, dv.idVenta, dv.idProducto, dv.cantidad_caja,
                    dv.precio_unitario, dv.subtotal, pr.nombreProducto
                FROM detalle_venta_O dv
                LEFT JOIN producto_O pr ON dv.idProducto = pr.idProducto
                WHERE dv.idVenta = %s
            ''', (v['idVenta'],))
            detalles = cur.fetchall() or []
            
            v['fechaVenta'] = v['fechaVenta'].isoformat() if v.get('fechaVenta') else None
            v['montoTotal'] = float(v['montoTotal']) if v.get('montoTotal') else 0.0
            # Optional payment fields
            if 'montoPagado' in v:
                v['montoPagado'] = float(v['montoPagado']) if v.get('montoPagado') is not None else 0.0
            # Simplificar estado_pago a solo Pagado / No Pagado
            raw_estado = (v.get('estado_pago') or '').strip().lower()
            if raw_estado == 'pagado':
                v['estado_pago'] = 'Pagado'
            else:
                v['estado_pago'] = 'No Pagado'
            
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
        cur = conn.cursor(dictionary=True, buffered=True)
        role = get_role(x_user_role, request)
        user_company = get_company_id_from_request(request)

        # Intentar con codigoVenta y fallback sin la columna
        try:
            query = '''
                SELECT 
                    v.idVenta, v.codigoVenta, v.fechaVenta, v.idTipoVenta, tv.nombreTipoVenta AS tipoVenta,
                    v.idTipoPago, tp.nombrePago AS tipoPago, v.idCliente,
                    CONCAT(p.nombres_persona, ' ', COALESCE(p.apellido_paternoPersona, '')) AS nombreCliente,
                    v.idEmpresa, e.nombre_empresa AS nombreEmpresa,
                    v.montoTotal, v.montoPagado, v.estado_pago, v.estado, v.observaciones
                FROM venta_O v
                LEFT JOIN tipoVenta tv ON v.idTipoVenta = tv.idTipoVenta
                LEFT JOIN tipoPago tp ON v.idTipoPago = tp.idPago
                LEFT JOIN persona_O p ON v.idCliente = p.id_persona
                LEFT JOIN empresa_O e ON v.idEmpresa = e.id_empresa
                WHERE v.idVenta = %s
            '''
            cur.execute(query, (id,))
        except Exception as e:
            if 'Unknown column' in str(e) and 'codigoVenta' in str(e):
                query = '''
                    SELECT 
                        v.idVenta, v.fechaVenta, v.idTipoVenta, tv.nombreTipoVenta AS tipoVenta,
                        v.idTipoPago, tp.nombrePago AS tipoPago, v.idCliente,
                        CONCAT(p.nombres_persona, ' ', COALESCE(p.apellido_paternoPersona, '')) AS nombreCliente,
                        v.idEmpresa, e.nombre_empresa AS nombreEmpresa,
                        v.montoTotal, v.montoPagado, v.estado_pago, v.estado, v.observaciones
                    FROM venta_O v
                    LEFT JOIN tipoVenta tv ON v.idTipoVenta = tv.idTipoVenta
                    LEFT JOIN tipoPago tp ON v.idTipoPago = tp.idPago
                    LEFT JOIN persona_O p ON v.idCliente = p.id_persona
                    LEFT JOIN empresa_O e ON v.idEmpresa = e.id_empresa
                    WHERE v.idVenta = %s
                '''
                cur.execute(query, (id,))
            else:
                raise
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
                dv.idDetalleVenta as idDetalle, dv.idVenta, dv.idProducto, dv.cantidad_caja,
                dv.precio_unitario, dv.subtotal, pr.nombreProducto
            FROM detalle_venta_O dv
            LEFT JOIN producto_O pr ON dv.idProducto = pr.idProducto
            WHERE dv.idVenta = %s
        ''', (id,))
        detalles = cur.fetchall() or []
        
        venta['fechaVenta'] = venta['fechaVenta'].isoformat() if venta.get('fechaVenta') else None
        venta['montoTotal'] = float(venta['montoTotal']) if venta.get('montoTotal') else 0.0
        if 'montoPagado' in venta:
            venta['montoPagado'] = float(venta['montoPagado']) if venta.get('montoPagado') is not None else 0.0
        # Simplificar estado_pago
        raw_estado = (venta.get('estado_pago') or '').strip().lower()
        if raw_estado == 'pagado':
            venta['estado_pago'] = 'Pagado'
        else:
            venta['estado_pago'] = 'No Pagado'
        
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

        # Validar que el cliente existe y pertenece a la empresa, obtener tipo_cliente y ruta
        cur.execute('SELECT id_persona, id_empresa, tipo_cliente, idRuta FROM persona_O WHERE id_persona = %s', (payload.idCliente,))
        cliente = cur.fetchone()
        if not cliente:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Cliente no existe')
        
        if role != 'superadmin' and cliente['id_empresa'] != target_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Cliente no pertenece a su empresa')
        
        # Determinar idTipoVenta automáticamente basado en tipo_cliente
        tipo_cliente = cliente.get('tipo_cliente', 'minorista')
        cur.execute('SELECT idTipoVenta FROM tipoVenta WHERE nombreTipoVenta = %s', (tipo_cliente.capitalize(),))
        tipo_venta_row = cur.fetchone()
        if tipo_venta_row:
            id_tipo_venta_auto = tipo_venta_row['idTipoVenta']
        else:
            # Fallback to provided or default
            id_tipo_venta_auto = payload.idTipoVenta
        
        # Store cliente's idRuta for price calculation
        id_ruta_cliente = cliente.get('idRuta')

        # Validar tipoVenta y tipoPago
        cur.execute('SELECT idTipoVenta FROM tipoVenta WHERE idTipoVenta = %s', (id_tipo_venta_auto,))
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
        # Generar codigoVenta: EMPRESASLUG-VTA-YYYY-MM-DD-NNN (secuencia por empresa y día)
        try:
            cur.execute('SELECT nombre_empresa FROM empresa_O WHERE id_empresa = %s', (target_company,))
            emp = cur.fetchone() or {}
            nombre_empresa = (emp.get('nombre_empresa') or '').upper()
            empresa_slug = ''.join(ch for ch in nombre_empresa if ch.isalnum())
        except Exception:
            empresa_slug = 'EMPRESA'
        f = datetime.fromisoformat(fechaVenta) if isinstance(fechaVenta, str) else datetime.utcnow()
        prefix = f"{empresa_slug}-VTA-{f.year}-{f.month:02d}-{f.day:02d}-"
        try:
            cur.execute('''
                SELECT MAX(CAST(SUBSTRING_INDEX(codigoVenta, '-', -1) AS UNSIGNED)) AS max_seq
                FROM venta_O
                WHERE idEmpresa = %s AND codigoVenta LIKE %s
            ''', (target_company, prefix + '%'))
            row_seq = cur.fetchone() or {}
            next_seq = int(row_seq.get('max_seq') or 0) + 1
        except Exception:
            next_seq = 1
        codigo_venta = f"{prefix}{next_seq:03d}"
        
        # Generate shorter numeroVenta (max 20 chars): VTA-YYYYMMDD-NNNN
        numero_venta = f"VTA-{f.year}{f.month:02d}{f.day:02d}-{next_seq:04d}"

        ins = conn.cursor()
        # Intentar insertar con columna codigoVenta y numeroVenta; fallback si no existe
        try:
            ins.execute('''
                INSERT INTO venta_O (numeroVenta, codigoVenta, fechaVenta, idTipoVenta, idTipoPago, idCliente, idEmpresa, montoTotal, estado, observaciones)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ''', (numero_venta, codigo_venta, fechaVenta, id_tipo_venta_auto, payload.idTipoPago, payload.idCliente, target_company, 
                  float(payload.montoTotal), 1, payload.observaciones))
        except Exception as e:
            if 'Unknown column' in str(e) and 'codigoVenta' in str(e):
                ins = conn.cursor()
                ins.execute('''
                    INSERT INTO venta_O (numeroVenta, fechaVenta, idTipoVenta, idTipoPago, idCliente, idEmpresa, montoTotal, estado, observaciones)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ''', (numero_venta, fechaVenta, id_tipo_venta_auto, payload.idTipoPago, payload.idCliente, target_company, 
                      float(payload.montoTotal), 1, payload.observaciones))
            else:
                raise
        conn.commit()
        new_id = ins.lastrowid
        ins.close()

        # Use id_ruta_cliente for price calculation (already obtained from cliente query)

        # Insertar detalles y actualizar stock usando FEFO
        for det in payload.detalles:
            # FEFO: Get lotes ordenados por fecha de vencimiento (más próxima primero)
            cur_lotes = conn.cursor(dictionary=True)
            cur_lotes.execute('''
                SELECT idLote, stockActual, precio_minorista, precio_mayorista, precio_especial
                FROM lote_producto
                WHERE idProducto = %s AND idEmpresa = %s AND stockActual > 0
                ORDER BY fechaVencimiento IS NULL, fechaVencimiento ASC, fechaCompra ASC, idLote ASC
                LIMIT 1
            ''', (det.idProducto, target_company))
            primer_lote = cur_lotes.fetchone()
            cur_lotes.close()
            
            # Determine base price: try lote first, fallback to producto
            precio_base = 0
            if primer_lote:
                # Priority 1: Get price from lote based on tipo_cliente
                if tipo_cliente == 'mayorista' and primer_lote.get('precio_mayorista'):
                    precio_base = float(primer_lote['precio_mayorista'])
                elif tipo_cliente == 'especial' and primer_lote.get('precio_especial'):
                    precio_base = float(primer_lote['precio_especial'])
                elif primer_lote.get('precio_minorista'):
                    precio_base = float(primer_lote['precio_minorista'])
            
            # If lote doesn't have price, use producto default prices
            if precio_base == 0:
                cur_prod = conn.cursor(dictionary=True)
                cur_prod.execute('''
                    SELECT precioMinorista, precioMayorista, precioEspecial 
                    FROM producto_O 
                    WHERE idProducto = %s
                ''', (det.idProducto,))
                producto = cur_prod.fetchone()
                cur_prod.close()
                
                if not producto:
                    cur.close(); conn.close()
                    raise HTTPException(status_code=400, detail=f'Producto {det.idProducto} no encontrado')
                
                # Priority 2: Get fallback price from producto
                if tipo_cliente == 'mayorista':
                    precio_base = float(producto.get('precioMayorista', 0))
                elif tipo_cliente == 'especial':
                    precio_base = float(producto.get('precioEspecial', 0))
                else:  # minorista (default)
                    precio_base = float(producto.get('precioMinorista', 0))
            
            # Apply route increments if cliente has idRuta
            incremento_general = 0
            incremento_especifico = 0
            
            if id_ruta_cliente is not None:
                try:
                    # Get general increment from ruta_O (applies to ALL products)
                    cur_rg = conn.cursor(dictionary=True)
                    cur_rg.execute('SELECT incremento_general FROM ruta_O WHERE idRuta = %s', (id_ruta_cliente,))
                    ruta = cur_rg.fetchone()
                    cur_rg.close()
                    if ruta and ruta.get('incremento_general') is not None:
                        incremento_general = float(ruta['incremento_general'])
                    
                    # Get specific increment from ruta_precio (applies only to specific products)
                    cur_re = conn.cursor(dictionary=True)
                    cur_re.execute('SELECT incremento_precio FROM ruta_precio WHERE idRuta = %s AND idProducto = %s', (id_ruta_cliente, det.idProducto))
                    rp = cur_re.fetchone()
                    cur_re.close()
                    if rp and rp.get('incremento_precio') is not None:
                        incremento_especifico = float(rp['incremento_precio'])
                except Exception:
                    # Table may not exist yet or query failed; ignore route pricing
                    incremento_general = 0
                    incremento_especifico = 0
            
            # Final price = base price + general increment + specific increment
            precio_final = precio_base + incremento_general + incremento_especifico
            
            if precio_final <= 0:
                # Price cannot be zero or negative
                cur.close(); conn.close()
                raise HTTPException(status_code=400, detail=f'Precio inválido para producto {det.idProducto}')

            # Compute subtotal (server-side) if not provided
            if getattr(det, 'subtotal', None) is not None:
                subtotal_final = float(det.subtotal)
            else:
                subtotal_final = float(precio_final) * float(det.cantidad_caja)

            ins2 = conn.cursor()
            # Don't insert subtotal - it's a STORED GENERATED column in the DB
            ins2.execute('''
                INSERT INTO detalle_venta_O (idVenta, idProducto, cantidad_caja, precio_unitario)
                VALUES (%s, %s, %s, %s)
            ''', (new_id, det.idProducto, det.cantidad_caja, precio_final))

            # FEFO: descontar stock de lotes ordenados por fecha de vencimiento (más próxima primero)
            cantidad_restante = det.cantidad_caja
            cur_lotes = conn.cursor(dictionary=True)
            cur_lotes.execute('''
                SELECT idLote, stockActual
                FROM lote_producto
                WHERE idProducto = %s AND idEmpresa = %s AND stockActual > 0
                ORDER BY fechaVencimiento IS NULL, fechaVencimiento ASC, fechaCompra ASC, idLote ASC
            ''', (det.idProducto, target_company))
            lotes = cur_lotes.fetchall() or []
            cur_lotes.close()

            for lote in lotes:
                if cantidad_restante <= 0:
                    break
                disponible = lote['stockActual']
                consumir = min(disponible, cantidad_restante)
                ins2.execute('UPDATE lote_producto SET stockActual = stockActual - %s WHERE idLote = %s', (consumir, lote['idLote']))
                cantidad_restante -= consumir

            if cantidad_restante > 0:
                # No debería ocurrir si la validación de stock es correcta
                raise HTTPException(status_code=400, detail=f'Stock insuficiente en lotes para producto {det.idProducto}')

            # El trigger tr_actualizar_stock_producto_update actualizará automáticamente stockCaja del producto
            conn.commit()
            ins2.close()

        # Registrar movimiento en cuenta corriente
        ins3 = conn.cursor()
        if payload.idTipoPago == 1:  # crédito (Pago al credito)
            # Crear movimiento: tipo=cliente, debe=montoTotal (el cliente nos debe)
            ins3.execute('''
                INSERT INTO cuenta_corriente_O 
                (tipo, idPersona, idEmpresa, fechaMovimiento, tipoMovimiento, idReferencia, debe, haber, saldo, descripcion, estado)
                VALUES ('cliente', %s, %s, %s, 'venta', %s, %s, 0, %s, %s, 1)
            ''', (payload.idCliente, target_company, fechaVenta, new_id, 
                  float(payload.montoTotal), float(payload.montoTotal), 
                  f'Venta #{new_id} a crédito'))
        else:  # contado / transferencia: no se registra en cuenta_corriente_O del cliente
            pass
        
        conn.commit()
        ins3.close()

        # Inicializar estado_pago y montoPagado bajo el nuevo esquema simplificado
        try:
            init_cur = conn.cursor()
            if payload.idTipoPago == 1:  # crédito
                init_cur.execute('UPDATE venta_O SET montoPagado = 0, estado_pago = %s WHERE idVenta = %s', ('No Pagado', new_id))
            else:  # contado / transferencia
                init_cur.execute('UPDATE venta_O SET montoPagado = montoTotal, estado_pago = %s WHERE idVenta = %s', ('Pagado', new_id))
            conn.commit()
            init_cur.close()
        except Exception:
            # Si columnas no existen en algún esquema antiguo, ignorar silenciosamente
            pass

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


@app.put('/ventas/{id}/anular')
def anular_venta(id: int, x_user_role: str = Header(None), request: Request = None):
    """
    Anular una venta: 
    - Revierte el stock a los lotes
    - Anula los movimientos en cuenta corriente
    - Marca montoTotal=0 y estado=0
    Solo admin/superadmin con permiso ventas:delete
    """
    role = (x_user_role or '').lower()
    if role not in ['admin', 'superadmin']:
        raise HTTPException(status_code=403, detail='Permission denied: admin required')

    # Check explicit permission
    if not has_permission(request, 'ventas:delete'):
        raise HTTPException(status_code=403, detail='Permission denied')

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)

        # Obtener venta con sus detalles y verificar scoping
        cur.execute('SELECT idVenta, idEmpresa, estado, montoTotal, idTipoPago, idCliente FROM venta_O WHERE idVenta = %s', (id,))
        venta = cur.fetchone()
        if not venta:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Venta no encontrada')

        # Validar scoping multi-empresa
        if role != 'superadmin' and user_company is not None and venta['idEmpresa'] != user_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No autorizado para esta empresa')

        # Validar que no esté ya anulada
        if venta['estado'] == 0:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Esta venta ya está anulada')

        # 1. Obtener detalles de la venta antes de anular
        cur.execute('''
            SELECT idDetalleVenta, idProducto, cantidad_caja, precio_unitario
            FROM detalle_venta_O
            WHERE idVenta = %s
        ''', (id,))
        detalles = cur.fetchall() or []

        # 2. Revertir stock a lotes usando FEFO (devolver al lote más próximo a vencer)
        for det in detalles:
            cantidad_a_devolver = det['cantidad_caja']
            
            # Obtener lotes ordenados igual que al vender (FEFO)
            cur_lotes = conn.cursor(dictionary=True)
            cur_lotes.execute('''
                SELECT idLote, stockActual
                FROM lote_producto
                WHERE idProducto = %s AND idEmpresa = %s
                ORDER BY fechaVencimiento IS NULL, fechaVencimiento ASC, fechaCompra ASC, idLote ASC
            ''', (det['idProducto'], venta['idEmpresa']))
            lotes = cur_lotes.fetchall() or []
            cur_lotes.close()

            if not lotes:
                # Si no hay lotes, crear error pero continuar (puede pasar si se eliminaron lotes)
                # O se podría crear un lote genérico, pero por ahora solo logging
                pass

            # Devolver stock a los mismos lotes en orden FEFO
            for lote in lotes:
                if cantidad_a_devolver <= 0:
                    break
                # Devolver todo lo posible a este lote
                upd_lote = conn.cursor()
                upd_lote.execute('UPDATE lote_producto SET stockActual = stockActual + %s WHERE idLote = %s', 
                               (cantidad_a_devolver, lote['idLote']))
                upd_lote.close()
                cantidad_a_devolver = 0  # Devolvemos todo al primer lote disponible
                break

        # 3. Revertir movimientos en cuenta corriente
        # Buscar movimientos de esta venta
        cur.execute('''
            SELECT idCuenta, tipo, debe, haber
            FROM cuenta_corriente_O
            WHERE tipoMovimiento = 'venta' AND idReferencia = %s AND estado = 1
        ''', (id,))
        movimientos = cur.fetchall() or []

        for mov in movimientos:
            # Marcar movimiento original como anulado (estado=0)
            upd_cc = conn.cursor()
            upd_cc.execute('UPDATE cuenta_corriente_O SET estado = 0 WHERE idCuenta = %s', (mov['idCuenta'],))
            
            # Crear movimiento inverso para compensar
            if mov['tipo'] == 'cliente':
                # Era una venta a crédito: revertir la deuda (haber = lo que debe se convierte en crédito)
                upd_cc.execute('''
                    INSERT INTO cuenta_corriente_O 
                    (tipo, idPersona, idEmpresa, fechaMovimiento, tipoMovimiento, idReferencia, debe, haber, saldo, descripcion, estado)
                    VALUES ('cliente', %s, %s, NOW(), 'ajuste', %s, 0, %s, -%s, %s, 1)
                ''', (venta['idCliente'], venta['idEmpresa'], id, mov['debe'], mov['debe'], f'Anulación venta #{id}'))
            elif mov['tipo'] == 'caja':
                # Era venta al contado: revertir el ingreso a caja (debe = salida de efectivo)
                upd_cc.execute('''
                    INSERT INTO cuenta_corriente_O 
                    (tipo, idPersona, idEmpresa, fechaMovimiento, tipoMovimiento, idReferencia, debe, haber, saldo, descripcion, estado)
                    VALUES ('caja', NULL, %s, NOW(), 'ajuste', %s, %s, 0, -%s, %s, 1)
                ''', (venta['idEmpresa'], id, mov['haber'], mov['haber'], f'Anulación venta #{id}'))
            
            upd_cc.close()

        # 4. Marcar venta como anulada: montoTotal=0, estado=0
        upd_venta = conn.cursor()
        upd_venta.execute('UPDATE venta_O SET estado = 0, montoTotal = 0, montoPagado = 0, estado_pago = %s WHERE idVenta = %s', ('No Pagado', id))
        upd_venta.close()

        conn.commit()
        cur.close()
        conn.close()

        return {"message": "Venta anulada exitosamente", "idVenta": id}

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=f'Error al anular venta: {str(e)}')


# ========================
# Endpoints auxiliares
# ========================

@app.get('/tipos-venta')
def list_tipos_venta(request: Request = None):
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
def list_tipos_pago(request: Request = None):
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


# ========================
# Sistema de Entrega (Chofer)
# ========================

class ProductoEntregado(BaseModel):
    idProducto: int
    cantidad: int
    entregado: bool = False


class EntregaIn(BaseModel):
    idVenta: int
    id_chofer: Optional[int] = None
    productos: List[ProductoEntregado]
    observaciones: Optional[str] = None


class EntregaUpdate(BaseModel):
    productos: List[ProductoEntregado]
    metodo_pago: Optional[str] = None  # 'Contado', 'Credito', 'Transferencia'
    observaciones: Optional[str] = None


@app.post('/ventas/{id_venta}/entrega')
def crear_entrega(id_venta: int, payload: EntregaIn, x_user_role: str = Header(None), request: Request = None):
    """Iniciar proceso de entrega para una venta. El chofer podrá marcar productos como entregados."""
    role = get_role(x_user_role, request)
    if role not in ('admin', 'editor', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        # Verificar que la venta existe
        cur.execute('SELECT idVenta, idEmpresa FROM venta_O WHERE idVenta = %s', (id_venta,))
        venta = cur.fetchone()
        if not venta:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail='Venta no encontrada')
        
        # Verificar que no exista ya una entrega para esta venta
        cur.execute('SELECT id_entrega FROM entrega_venta WHERE idVenta = %s', (id_venta,))
        if cur.fetchone():
            cur.close(); conn.close()
            raise HTTPException(status_code=400, detail='Ya existe una entrega para esta venta')
        
        # Crear JSON con productos
        import json
        productos_json = json.dumps([p.dict() for p in payload.productos])
        
        # Insertar entrega
        ins = conn.cursor()
        ins.execute('''
            INSERT INTO entrega_venta (idVenta, id_chofer, productos_entregados, estado_entrega, observaciones)
            VALUES (%s, %s, %s, %s, %s)
        ''', (id_venta, payload.id_chofer, productos_json, 'Pendiente', payload.observaciones))
        conn.commit()
        id_entrega = ins.lastrowid
        ins.close()
        cur.close()
        conn.close()
        
        return {'id_entrega': id_entrega, 'idVenta': id_venta, 'estado': 'Pendiente'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/ventas/{id_venta}/entrega')
def obtener_entrega(id_venta: int, x_user_role: str = Header(None), request: Request = None):
    """Obtener información de entrega de una venta."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        cur.execute('''
            SELECT e.*, p.nombres_persona, p.apellido_paternoPersona
            FROM entrega_venta e
            LEFT JOIN persona_O p ON e.id_chofer = p.id_persona
            WHERE e.idVenta = %s
        ''', (id_venta,))
        entrega = cur.fetchone()
        cur.close()
        conn.close()
        
        if not entrega:
            raise HTTPException(status_code=404, detail='Entrega no encontrada')
        
        # Parse JSON
        import json
        if entrega.get('productos_entregados'):
            entrega['productos_entregados'] = json.loads(entrega['productos_entregados'])
        
        return entrega
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/ventas/{id_venta}/entrega')
def actualizar_entrega(id_venta: int, payload: EntregaUpdate, x_user_role: str = Header(None), request: Request = None):
    """Actualizar productos entregados. El chofer marca qué productos entregó.
    
    Si metodo_pago es 'Contado' o 'Transferencia' y todos los productos fueron entregados,
    registra el pago automáticamente en cuenta_corriente_O y actualiza montoPagado/estado_pago.
    """
    role = get_role(x_user_role, request)
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        # Obtener entrega actual
        cur.execute('SELECT id_entrega FROM entrega_venta WHERE idVenta = %s', (id_venta,))
        entrega = cur.fetchone()
        if not entrega:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail='Entrega no encontrada')
        
        # Calcular estado de entrega basado en productos
        import json
        todos_entregados = all(p.entregado for p in payload.productos)
        alguno_entregado = any(p.entregado for p in payload.productos)
        
        if todos_entregados:
            estado = 'Entregado'
        elif alguno_entregado:
            estado = 'Parcial'
        else:
            estado = 'Pendiente'
        
        productos_json = json.dumps([p.dict() for p in payload.productos])
        
        # Actualizar entrega
        upd = conn.cursor()
        upd.execute('''
            UPDATE entrega_venta 
            SET productos_entregados = %s, estado_entrega = %s, observaciones = %s, fecha_entrega = NOW()
            WHERE idVenta = %s
        ''', (productos_json, estado, payload.observaciones, id_venta))
        
        # Si método de pago es Contado o Transferencia y todos entregados, registrar pago
        metodo_lower = (payload.metodo_pago or '').lower()
        if metodo_lower in ('contado', 'transferencia') and todos_entregados:
            # Obtener venta completa para registrar pago
            cur.execute('''
                SELECT idVenta, idEmpresa, idCliente, montoTotal, montoPagado, estado_pago
                FROM venta_O WHERE idVenta = %s
            ''', (id_venta,))
            venta = cur.fetchone()
            if venta:
                monto_total = float(venta.get('montoTotal') or 0)
                pagado_actual = float(venta.get('montoPagado') or 0)
                monto_pago = monto_total - pagado_actual  # Pagar el saldo restante
                
                if monto_pago > 0:
                    nuevo_pagado = monto_total  # Pagado completo
                    nuevo_estado = 'Pagado'
                    
                    fecha_mov = datetime.utcnow().strftime('%Y-%m-%d')
                    descripcion = f"Pago en entrega #{id_venta} ({payload.metodo_pago})"
                    
                    # Actualizar venta
                    upd.execute('''
                        UPDATE venta_O
                        SET montoPagado = %s, estado_pago = %s, estado = 1
                        WHERE idVenta = %s
                    ''', (nuevo_pagado, nuevo_estado, id_venta))
                    
                    # Insertar movimiento en cuenta corriente (cobro)
                    upd.execute('''
                        INSERT INTO cuenta_corriente_O 
                        (tipo, idPersona, idEmpresa, fechaMovimiento, tipoMovimiento, idReferencia, debe, haber, saldo, descripcion, estado)
                        VALUES ('cliente', %s, %s, %s, 'cobro', %s, 0, %s, -%s, %s, 1)
                    ''', (venta['idCliente'], venta['idEmpresa'], fecha_mov, id_venta, monto_pago, monto_pago, descripcion))
        elif payload.metodo_pago and todos_entregados:
            # Si es crédito u otro, solo marcar la entrega como completada sin registrar pago
            upd.execute('''
                UPDATE venta_O 
                SET estado = 1
                WHERE idVenta = %s
            ''', (id_venta,))
        
        conn.commit()
        upd.close()
        cur.close()
        conn.close()
        
        return {'ok': True, 'estado': estado, 'metodo_pago': payload.metodo_pago if todos_entregados else None}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# Registro de pagos/cobros de ventas (créditos)
# ========================

class PagoVentaIn(BaseModel):
    monto: Decimal = Field(..., gt=0)
    metodo: Optional[str] = Field(None, description="contado|transferencia|otro")
    referencia: Optional[str] = Field(None, max_length=100)
    observaciones: Optional[str] = Field(None, max_length=300)
    fecha: Optional[str] = Field(None, description="ISO date YYYY-MM-DD (opcional)")


@app.post('/ventas/{id}/registrar-pago')
def registrar_pago_venta(id: int, payload: PagoVentaIn, x_user_role: str = Header(None), request: Request = None):
    """Registrar un pago/cobro de una venta.

    - Actualiza montoPagado y estado_pago en venta_O.
    - Inserta movimiento en cuenta_corriente_O para el cliente (haber) reduciendo la deuda.
    - Inserta movimiento en caja (haber) como ingreso.
    - Respeta el scoping multiempresa.
    """
    role = get_role(x_user_role, request)
    if role not in ('admin', 'editor', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)

        # 1) Obtener venta y validar scoping
        cur.execute('''
            SELECT idVenta, idEmpresa, idCliente, montoTotal, montoPagado, estado, idTipoPago
            FROM venta_O WHERE idVenta = %s
        ''', (id,))
        venta = cur.fetchone()
        if not venta:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail='Venta no encontrada')

        if role != 'superadmin' and user_company is not None and venta['idEmpresa'] != user_company:
            cur.close(); conn.close()
            raise HTTPException(status_code=403, detail='No autorizado para esta empresa')

        if venta['estado'] == 0:
            cur.close(); conn.close()
            raise HTTPException(status_code=400, detail='La venta está anulada')

        # 2) Calcular nuevos montos y estado
        monto_total = float(venta.get('montoTotal') or 0)
        pagado_actual = float(venta.get('montoPagado') or 0)
        pago = float(payload.monto)
        nuevo_pagado = pagado_actual + pago
        if nuevo_pagado < 0:
            nuevo_pagado = 0
        # Simplificar a dos estados
        if monto_total > 0 and nuevo_pagado >= monto_total:
            nuevo_pagado = monto_total
            estado_pago = 'Pagado'
        else:
            estado_pago = 'No Pagado'

        # 3) Iniciar transacción
        upd = conn.cursor()

        # 3.a) Actualizar venta
        upd.execute('''
            UPDATE venta_O
            SET montoPagado = %s, estado_pago = %s
            WHERE idVenta = %s
        ''', (nuevo_pagado, estado_pago, id))

        # 3.b) Insertar movimiento en cuenta corriente (cliente - haber)
        fecha_mov = payload.fecha or datetime.utcnow().strftime('%Y-%m-%d')
        descripcion_cli = f"Cobro venta #{id}"
        if payload.metodo:
            descripcion_cli += f" ({payload.metodo})"
        if payload.referencia:
            descripcion_cli += f" Ref:{payload.referencia}"
        if payload.observaciones:
            descripcion_cli += f" - {payload.observaciones}"

        ins_cc = conn.cursor()
        ins_cc.execute('''
            INSERT INTO cuenta_corriente_O 
            (tipo, idPersona, idEmpresa, fechaMovimiento, tipoMovimiento, idReferencia, debe, haber, saldo, descripcion, estado)
            VALUES ('cliente', %s, %s, %s, 'cobro', %s, 0, %s, -%s, %s, 1)
        ''', (venta['idCliente'], venta['idEmpresa'], fecha_mov, id, pago, pago, descripcion_cli))
        mov_id = ins_cc.lastrowid

        # Generate a simple receipt number: RCB-YYYYMMDD-######
        fecha_compact = fecha_mov.replace('-', '')
        numero_recibo = f"RCB-{fecha_compact}-{mov_id:06d}"

        # 3.c) (Opcional) Registrar ingreso en un módulo de caja/banco si existe. No se registra en cuenta_corriente_O.

        conn.commit()
        ins_cc.close(); upd.close(); cur.close(); conn.close()

        # Retornar datos para impresión de recibo y venta actualizada
        venta_actualizada = get_venta(id, x_user_role, request)
        return JSONResponse({
            'ok': True,
            'idMovimiento': mov_id,
            'numeroRecibo': numero_recibo,
            'venta': venta_actualizada
        })
    except HTTPException:
        raise
    except Exception as e:
        try:
            conn.rollback()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/ventas/{id}/recibo/{mov_id}')
def obtener_recibo_pago(id: int, mov_id: int, x_user_role: str = Header(None), request: Request = None, format: Optional[str] = 'html'):
    """Devuelve un recibo imprimible para un pago de venta específico.

    - Verifica scoping multiempresa.
    - Construye HTML simple con datos de empresa, cliente, venta y pago.
    """
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        role = get_role(x_user_role, request)
        user_company = get_company_id_from_request(request)

        # Obtener venta
        cur.execute('''
            SELECT v.idVenta, v.idEmpresa, v.idCliente, v.fechaVenta, v.montoTotal,
                   e.nombre_empresa AS nombreEmpresa,
                   CONCAT(p.nombres_persona, ' ', COALESCE(p.apellido_paternoPersona, '')) AS nombreCliente
            FROM venta_O v
            LEFT JOIN empresa_O e ON v.idEmpresa = e.id_empresa
            LEFT JOIN persona_O p ON v.idCliente = p.id_persona
            WHERE v.idVenta = %s
        ''', (id,))
        venta = cur.fetchone()
        if not venta:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail='Venta no encontrada')

        if role != 'superadmin' and user_company is not None and venta['idEmpresa'] != user_company:
            cur.close(); conn.close()
            raise HTTPException(status_code=403, detail='No autorizado para esta empresa')

        # Obtener movimiento del pago
        cur.execute('''
            SELECT idCuentaCorriente AS id, fechaMovimiento, haber AS monto, descripcion
            FROM cuenta_corriente_O
            WHERE idCuentaCorriente = %s AND tipoMovimiento = 'cobro' AND idReferencia = %s AND estado = 1
        ''', (mov_id, id))
        mov = cur.fetchone()
        if not mov:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail='Movimiento de pago no encontrado')

        # Generar número de recibo
        fmov = mov['fechaMovimiento']
        if hasattr(fmov, 'isoformat'):
            fecha_mov_str = fmov.date().isoformat()
        else:
            fecha_mov_str = str(fmov)[:10]
        numero_recibo = f"RCB-{fecha_mov_str.replace('-', '')}-{mov['id']:06d}"

        # Construir HTML simple
        html = f"""
<!DOCTYPE html>
<html lang=\"es\">
<head>
    <meta charset=\"utf-8\" />
    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
    <title>Recibo {numero_recibo}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 24px; color: #111; }}
        .header {{ display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }}
        .empresa {{ font-size: 18px; font-weight: bold; }}
        .recibo {{ font-family: monospace; background:#f5f5f5; padding:8px 12px; border-radius:6px; }}
        table {{ width:100%; border-collapse: collapse; margin-top: 12px; }}
        td, th {{ padding: 8px; border-bottom: 1px solid #ddd; text-align:left; }}
        .right {{ text-align:right; }}
        .total {{ font-weight:bold; font-size: 16px; }}
        .muted {{ color:#555; }}
        .small {{ font-size: 12px; }}
        .print {{ margin-top: 16px; }}
    </style>
    <script>window.addEventListener('load',()=>{{ setTimeout(()=>window.print(), 300); }});</script>
</head>
<body>
    <div class=\"header\">
        <div class=\"empresa\">{venta.get('nombreEmpresa', 'Sistema Ollantay')}</div>
        <div class=\"recibo\">Recibo: {numero_recibo}</div>
    </div>
    <h2>Comprobante de Pago</h2>
    <table>
        <tr><td class=\"muted\">Cliente:</td><td>{venta.get('nombreCliente', 'Sin nombre')}</td></tr>
        <tr><td class=\"muted\">Venta #:</td><td>{venta['idVenta']}</td></tr>
        <tr><td class=\"muted\">Fecha Venta:</td><td>{venta['fechaVenta']}</td></tr>
        <tr><td class=\"muted\">Fecha Pago:</td><td>{fecha_mov_str}</td></tr>
        <tr><td class=\"muted\">Monto Total:</td><td class=\"right\">{venta['montoTotal']:.2f}</td></tr>
        <tr><td class=\"muted\">Monto Pagado:</td><td class=\"right total\">{mov['monto']:.2f}</td></tr>
        <tr><td class=\"muted\">Descripción:</td><td class=\"small\">{mov.get('descripcion', '')}</td></tr>
    </table>
    <div class=\"print small muted\" style=\"margin-top:32px; text-align:center;\">
        Generado automáticamente por Sistema Ollantay
    </div>
</body>
</html>
"""

        cur.close()
        conn.close()

        if format == 'json':
            return {'ok': True, 'numeroRecibo': numero_recibo, 'venta': dict(venta), 'movimiento': dict(mov)}
        
        return HTMLResponse(content=html, status_code=200)
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ENTREGA ====================

class ProductoEntregado(BaseModel):
    idProducto: int
    cantidad: int
    entregado: bool = False


class EntregaIn(BaseModel):
    idVenta: int
    id_chofer: Optional[int] = None
    productos: List[ProductoEntregado]
    observaciones: Optional[str] = None


class EntregaUpdate(BaseModel):
    productos: List[ProductoEntregado]
    metodo_pago: Optional[str] = None  # 'Contado', 'Credito', 'Transferencia'
    observaciones: Optional[str] = None


@app.post('/ventas/{id_venta}/entrega')
def crear_entrega(id_venta: int, payload: EntregaIn, x_user_role: str = Header(None), request: Request = None):
    """Iniciar proceso de entrega para una venta. El chofer podrá marcar productos como entregados."""
    role = get_role(x_user_role, request)
    if role not in ('admin', 'editor', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        # Verificar que la venta existe
        cur.execute('SELECT idVenta, idEmpresa FROM venta_O WHERE idVenta = %s', (id_venta,))
        venta = cur.fetchone()
        if not venta:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail='Venta no encontrada')
        
        # Verificar que no exista ya una entrega para esta venta
        cur.execute('SELECT id_entrega FROM entrega_venta WHERE idVenta = %s', (id_venta,))
        if cur.fetchone():
            cur.close(); conn.close()
            raise HTTPException(status_code=400, detail='Ya existe una entrega para esta venta')
        
        # Crear JSON con productos
        import json
        productos_json = json.dumps([p.dict() for p in payload.productos])
        
        # Insertar entrega
        ins = conn.cursor()
        ins.execute('''
            INSERT INTO entrega_venta (idVenta, id_chofer, productos_entregados, estado_entrega, observaciones)
            VALUES (%s, %s, %s, %s, %s)
        ''', (id_venta, payload.id_chofer, productos_json, 'Pendiente', payload.observaciones))
        conn.commit()
        id_entrega = ins.lastrowid
        ins.close()
        cur.close()
        conn.close()
        
        return {'id_entrega': id_entrega, 'idVenta': id_venta, 'estado': 'Pendiente'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/ventas/{id_venta}/entrega')
def obtener_entrega(id_venta: int, x_user_role: str = Header(None), request: Request = None):
    """Obtener información de entrega de una venta."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        cur.execute('''
            SELECT e.*, p.nombres_persona, p.apellido_paternoPersona
            FROM entrega_venta e
            LEFT JOIN persona_O p ON e.id_chofer = p.id_persona
            WHERE e.idVenta = %s
        ''', (id_venta,))
        entrega = cur.fetchone()
        cur.close()
        conn.close()
        
        if not entrega:
            raise HTTPException(status_code=404, detail='Entrega no encontrada')
        
        # Parse JSON
        import json
        if entrega.get('productos_entregados'):
            entrega['productos_entregados'] = json.loads(entrega['productos_entregados'])
        
        return entrega
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/ventas/{id_venta}/entrega')
def actualizar_entrega(id_venta: int, payload: EntregaUpdate, x_user_role: str = Header(None), request: Request = None):
    """Actualizar productos entregados. El chofer marca qué productos entregó.
    
    Si metodo_pago es 'Contado' o 'Transferencia' y todos los productos fueron entregados,
    registra el pago automáticamente en cuenta_corriente_O y actualiza montoPagado/estado_pago.
    """
    role = get_role(x_user_role, request)
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        # Obtener entrega actual
        cur.execute('SELECT id_entrega FROM entrega_venta WHERE idVenta = %s', (id_venta,))
        entrega = cur.fetchone()
        if not entrega:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail='Entrega no encontrada')
        
        # Calcular estado de entrega basado en productos
        import json
        todos_entregados = all(p.entregado for p in payload.productos)
        alguno_entregado = any(p.entregado for p in payload.productos)
        
        if todos_entregados:
            estado = 'Entregado'
        elif alguno_entregado:
            estado = 'Parcial'
        else:
            estado = 'Pendiente'
        
        productos_json = json.dumps([p.dict() for p in payload.productos])
        
        # Actualizar entrega
        upd = conn.cursor()
        upd.execute('''
            UPDATE entrega_venta 
            SET productos_entregados = %s, estado_entrega = %s, observaciones = %s, fecha_entrega = NOW()
            WHERE idVenta = %s
        ''', (productos_json, estado, payload.observaciones, id_venta))
        
        # Si método de pago es Contado o Transferencia y todos entregados, registrar pago
        metodo_lower = (payload.metodo_pago or '').lower()
        if metodo_lower in ('contado', 'transferencia') and todos_entregados:
            # Obtener venta completa para registrar pago
            cur.execute('''
                SELECT idVenta, idEmpresa, idCliente, montoTotal, montoPagado, estado_pago
                FROM venta_O WHERE idVenta = %s
            ''', (id_venta,))
            venta = cur.fetchone()
            if venta:
                monto_total = float(venta.get('montoTotal') or 0)
                pagado_actual = float(venta.get('montoPagado') or 0)
                monto_pago = monto_total - pagado_actual  # Pagar el saldo restante
                
                if monto_pago > 0:
                    nuevo_pagado = monto_total  # Pagado completo
                    nuevo_estado = 'Pagado'
                    
                    fecha_mov = datetime.utcnow().strftime('%Y-%m-%d')
                    descripcion = f"Pago en entrega #{id_venta} ({payload.metodo_pago})"
                    
                    # Actualizar venta
                    upd.execute('''
                        UPDATE venta_O
                        SET montoPagado = %s, estado_pago = %s, estado = 1
                        WHERE idVenta = %s
                    ''', (nuevo_pagado, nuevo_estado, id_venta))
                    
                    # Insertar movimiento en cuenta corriente (cobro)
                    upd.execute('''
                        INSERT INTO cuenta_corriente_O 
                        (tipo, idPersona, idEmpresa, fechaMovimiento, tipoMovimiento, idReferencia, debe, haber, saldo, descripcion, estado)
                        VALUES ('cliente', %s, %s, %s, 'cobro', %s, 0, %s, -%s, %s, 1)
                    ''', (venta['idCliente'], venta['idEmpresa'], fecha_mov, id_venta, monto_pago, monto_pago, descripcion))
        elif payload.metodo_pago and todos_entregados:
            # Si es crédito u otro, solo marcar la entrega como completada sin registrar pago
            upd.execute('''
                UPDATE venta_O 
                SET estado = 1
                WHERE idVenta = %s
            ''', (id_venta,))
        
        conn.commit()
        upd.close()
        cur.close()
        conn.close()
        
        return {'ok': True, 'estado': estado, 'metodo_pago': payload.metodo_pago if todos_entregados else None}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# Registro de pagos/cobros de ventas (créditos)
# ========================

class PagoVentaIn(BaseModel):
    monto: Decimal = Field(..., gt=0)
    metodo: Optional[str] = Field(None, description="contado|transferencia|otro")
    referencia: Optional[str] = Field(None, max_length=100)
    observaciones: Optional[str] = Field(None, max_length=300)
    fecha: Optional[str] = Field(None, description="ISO date YYYY-MM-DD (opcional)")


