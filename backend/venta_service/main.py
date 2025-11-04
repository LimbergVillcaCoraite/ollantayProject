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
                v.montoTotal, v.estado, v.observaciones
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
                    v.montoTotal, v.estado, v.observaciones
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
                        v.montoTotal, v.estado, v.observaciones
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
        else:  # contado (idTipoPago == 2) o transferencia (idTipoPago == 7)
            # Registrar ingreso a caja: tipo=caja, haber=montoTotal (entrada de efectivo)
            ins3.execute('''
                INSERT INTO cuenta_corriente_O 
                (tipo, idPersona, idEmpresa, fechaMovimiento, tipoMovimiento, idReferencia, debe, haber, saldo, descripcion, estado)
                VALUES ('caja', NULL, %s, %s, 'venta', %s, 0, %s, %s, %s, 1)
            ''', (target_company, fechaVenta, new_id, 
                  float(payload.montoTotal), float(payload.montoTotal),
                  f'Venta #{new_id} al contado'))
        
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
    """Actualizar productos entregados. El chofer marca qué productos entregó."""
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
        
        # Si se especifica método de pago y todos los productos fueron entregados, actualizar venta
        # NOTA: Las columnas metodo_pago y estado_pago no existen en venta_O actual
        # Se usa estado (tinyint) y idTipoPago existentes
        if payload.metodo_pago and todos_entregados:
            # Por ahora solo actualizamos el estado a 1 (activo/completado)
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


