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
# Create uploads directory if it doesn't exist
os.makedirs("/app/uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")

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


# ========================
# Endpoints de Compras
# ========================

@app.get('/compras', response_model=List[CompraOut])
def list_compras(
    fecha_inicio: Optional[str] = None,
    fecha_fin: Optional[str] = None,
    idProveedor: Optional[int] = None,
    idTipoPago: Optional[int] = None,
    estado: Optional[int] = None,
    offset: int = 0,
    limit: int = 100,
    x_user_role: str = Header(None),
    request: Request = None,
    response: Response = None
):
    """Listar compras. Superadmin ve todas, admin solo de su empresa."""
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

    # Obtener detalles
        result = []
        for c in compras:
            cur.execute('''
                SELECT 
                    dc.idDetalleCompra, dc.idCompra, dc.idProducto, dc.cantidad_caja,
                    dc.precio_unitario, dc.subtotal, pr.nombreProducto
                FROM detalle_compra_O dc
                LEFT JOIN producto_O pr ON dc.idProducto = pr.idProducto
                WHERE dc.idCompra = %s
            ''', (c['idCompra'],))
            detalles = cur.fetchall() or []
            
            c['fechaCompra'] = c['fechaCompra'].isoformat() if c.get('fechaCompra') else None
            c['montoTotal'] = float(c['montoTotal']) if c.get('montoTotal') else 0.0
            
            for d in detalles:
                d['precio_unitario'] = float(d['precio_unitario']) if d.get('precio_unitario') else 0.0
                d['subtotal'] = float(d['subtotal']) if d.get('subtotal') else 0.0
            
            c['detalles'] = detalles

            # Comprobantes
            cur.execute('''
                SELECT idComprobante, rutaArchivo, nombreArchivo, mimeType, uploaded_at
                FROM compra_comprobante_O WHERE idCompra = %s ORDER BY idComprobante ASC
            ''', (c['idCompra'],))
            comprobantes = cur.fetchall() or []
            c['comprobantes'] = comprobantes
            result.append(c)

        cur.close()
        conn.close()
        return result
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
                dc.precio_unitario, dc.subtotal, pr.nombreProducto
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
    """Elimina un comprobante específico de una compra (borra archivo y registro)."""
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
        
        # Parse date to get year and month
        fecha_obj = date.fromisoformat(fechaCompra)
        anio = fecha_obj.year
        mes = fecha_obj.month

        # Generate numeroCompra in format CMP-YYYY-MM-NNN
        # Find the next available number for this month and year
        numero_del_mes = 1
        while True:
            numero_compra = f"CMP-{anio}-{mes:02d}-{numero_del_mes:03d}"
            cur.execute('SELECT COUNT(*) as existe FROM compra_O WHERE numeroCompra = %s', (numero_compra,))
            existe = cur.fetchone()
            if existe and existe.get('existe', 0) > 0:
                numero_del_mes += 1
            else:
                break
            # Safety check to avoid infinite loop
            if numero_del_mes > 999:
                raise HTTPException(status_code=500, detail='No se pudo generar número de compra único')

        # Insertar compra
        idUsuario = get_user_id_from_request(request) or 1  # Fallback to user 1 if not found
        print(f"DEBUG: Creating compra - idUsuario from JWT: {idUsuario}, role: {role}")
        ins = conn.cursor()
        ins.execute('''
            INSERT INTO compra_O (numeroCompra, fechaCompra, idProveedor, idTipoPago, idEmpresa, montoTotal, estado, observaciones, idUsuario)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (numero_compra, fechaCompra, payload.idProveedor, payload.idTipoPago, target_company, 
              float(payload.montoTotal), payload.estado, payload.observaciones, idUsuario))
        conn.commit()
        new_id = ins.lastrowid
        ins.close()

        # Insertar detalles y actualizar stock
        for det in payload.detalles:
            ins2 = conn.cursor()
            # subtotal es una columna generada (cantidad_caja * precio_unitario), no se debe insertar explícitamente
            ins2.execute('''
                INSERT INTO detalle_compra_O (idCompra, idProducto, cantidad_caja, precio_unitario)
                VALUES (%s, %s, %s, %s)
            ''', (new_id, det.idProducto, det.cantidad_caja, float(det.precio_unitario)))
            
            # Crear lote de producto para rastrear esta compra específica
            # Esto permite FEFO (First Expired First Out) y trazabilidad por compra
            fechaVenc = det.fechaVencimiento if det.fechaVencimiento else None
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

        # Si es compra a crédito, crear movimiento en cuenta corriente
        if payload.idTipoPago == 2:  # crédito
            ins3 = conn.cursor()
            # Obtener idPersona del proveedor (si es persona, no empresa)
            cur.execute('SELECT idPersona, esEmpresa FROM proveedor_O WHERE idProveedor = %s', (payload.idProveedor,))
            prov_data = cur.fetchone()
            id_persona_prov = prov_data.get('idPersona') if prov_data and not prov_data.get('esEmpresa') else None
            
            # Solo crear movimiento si el proveedor es persona (tiene idPersona)
            if id_persona_prov:
                # Crear movimiento: tipo=proveedor, haber=montoTotal (le debemos al proveedor)
                ins3.execute('''
                    INSERT INTO cuenta_corriente_O 
                    (tipo, idPersona, idEmpresa, fechaMovimiento, tipoMovimiento, idReferencia, debe, haber, saldo, descripcion, estado)
                    VALUES ('proveedor', %s, %s, %s, 'compra', %s, 0, %s, %s, %s, 1)
                ''', (id_persona_prov, target_company, fechaCompra, new_id, 
                      float(payload.montoTotal), float(payload.montoTotal), 
                      f'Compra #{new_id} a crédito'))
                conn.commit()
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
    """Actualizar compra (solo estado y observaciones)."""
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

        upd = conn.cursor()
        
        # Si se está anulando la compra (estado = 0), actualizar lotes y poner total en 0
        if payload.estado == 0:
            # Poner stockActual de los lotes en 0
            upd.execute('UPDATE lote_producto SET stockActual = 0 WHERE idCompra = %s', (id,))
            # Actualizar compra: estado = 0, montoTotal = 0, observaciones
            upd.execute('''
                UPDATE compra_O 
                SET estado = %s, montoTotal = 0, observaciones = %s
                WHERE idCompra = %s
            ''', (payload.estado, payload.observaciones, id))
        else:
            # Actualizar solo estado y observaciones (sin cambiar montoTotal)
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
    """Obtener lotes de una compra específica."""
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

        # Obtener lotes de esta compra con información de producto
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
                prov.empresa as nombreProveedor
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




