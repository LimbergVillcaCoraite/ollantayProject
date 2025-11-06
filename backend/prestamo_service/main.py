from fastapi import FastAPI, HTTPException, Request, Header, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, datetime
from PIL import Image
from io import BytesIO
import os
import time
import mysql.connector
import jwt

app = FastAPI()

# Servir archivos estáticos
app.mount("/uploads", StaticFiles(directory="/app/uploads"), name="uploads")

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
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

def get_id_persona_from_request(request: Request = None) -> Optional[int]:
    try:
        token = request.cookies.get('ollantay_token') if request is not None else None
        if not token:
            return None
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        pid = payload.get('id_persona')
        return int(pid) if pid is not None else None
    except Exception:
        return None


async def process_product_image(image_file: UploadFile) -> bytes:
    """
    Procesa la imagen del producto:
    - Optimiza el tamaño de la imagen
    - Mantiene formato original
    """
    content = await image_file.read()
    
    try:
        img = Image.open(BytesIO(content))
        
        # Redimensionar si es muy grande (max 1200px)
        max_size = 1200
        if img.width > max_size or img.height > max_size:
            img.thumbnail((max_size, max_size), Image.Resampling.LANCZOS)
        
        # Mantener formato original
        buffer = BytesIO()
        format = img.format or 'PNG'
        img.save(buffer, format=format, optimize=True)
        return buffer.getvalue()
    except Exception as e:
        print(f"⚠️ Error optimizando imagen: {e}, guardando original")
        return content


class PrestamoIn(BaseModel):
    cantidad_envaseCaja: Optional[int] = Field(None, ge=0)
    cantidad_prestamoBotellas: Optional[int] = Field(None, ge=0)
    descripcion_envase: Optional[str] = Field(None, max_length=500)
    fecha_prestamo: Optional[str] = None  # ISO date string
    id_persona: Optional[int] = None
    estado_prestamo: Optional[int] = Field(None, ge=0, le=1)
    fecha_devolucion: Optional[str] = None  # ISO datetime
    chofer: int = Field(...)
    idTipocaja: int = Field(...)
    idProducto: Optional[int] = None


class PrestamoOut(PrestamoIn):
    id_prestamo: int
    nombretipo_caja: Optional[str] = None
    nombreProducto: Optional[str] = None
    chofer_empresa: Optional[int] = None
    nombreEmpresaChofer: Optional[str] = None


# Modelo para actualizaciones parciales
class PrestamoUpdateIn(BaseModel):
    cantidad_envaseCaja: Optional[int] = Field(None, ge=0)
    cantidad_prestamoBotellas: Optional[int] = Field(None, ge=0)
    descripcion_envase: Optional[str] = Field(None, max_length=500)
    fecha_prestamo: Optional[str] = None
    id_persona: Optional[int] = None
    estado_prestamo: Optional[int] = Field(None, ge=0, le=1)
    fecha_devolucion: Optional[str] = None
    chofer: Optional[int] = None
    idTipocaja: Optional[int] = None
    idProducto: Optional[int] = None





@app.get('/loans', response_model=List[PrestamoOut])
def list_loans(id_persona: Optional[int] = None, company_id: Optional[int] = None, x_user_role: str = Header(None), request: Request = None):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        role = get_role(x_user_role, request)
        user_company = get_company_id_from_request(request)
        user_persona = get_id_persona_from_request(request)

        # Base query with joins to get company of chofer and optional company name
        query = '''
            SELECT 
                p.id_prestamo, p.cantidad_envaseCaja, p.cantidad_prestamoBotellas,
                p.descripcion_envase, p.fecha_prestamo, p.id_persona, 
                p.estado_prestamo, p.fecha_devolucion, p.chofer,
                p.idTipocaja, tc.nombretipo_caja,
                p.idProducto, pr.nombreProducto,
                ch.id_empresa AS chofer_empresa,
                e.nombre_empresa AS nombreEmpresaChofer
            FROM prestamo_O p
            LEFT JOIN tipocaja_O tc ON p.idTipocaja = tc.idTipocaja
            LEFT JOIN producto_O pr ON p.idProducto = pr.idProducto
            LEFT JOIN persona_O ch ON p.chofer = ch.id_persona
            LEFT JOIN empresa_O e ON ch.id_empresa = e.id_empresa
        '''
        where = []
        params: list = []

        # If client role: force own id_persona
        if role == 'cliente':
            if user_persona is not None:
                where.append('p.id_persona = %s')
                params.append(user_persona)
            # Allow optional company filter (by chofer empresa)
            if company_id is not None:
                where.append('ch.id_empresa = %s')
                params.append(company_id)
        else:
            # Non-superadmin scoping by company via chofer
            if role != 'superadmin' and user_company is not None:
                where.append('ch.id_empresa = %s')
                params.append(user_company)
            # Optional filter by explicit id_persona
            if id_persona is not None:
                where.append('p.id_persona = %s')
                params.append(id_persona)

        if where:
            query += ' WHERE ' + ' AND '.join(where)
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        # serialize date/datetime values to ISO strings
        for row in rows:
            for f in ('fecha_prestamo', 'fecha_devolucion'):
                if row.get(f) is not None:
                    try:
                        row[f] = row[f].isoformat()
                    except Exception:
                        row[f] = str(row[f])
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/loans/{id}', response_model=PrestamoOut)
def get_loan(id: int):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT id_prestamo, cantidad_envaseCaja, cantidad_prestamoBotellas, descripcion_envase, fecha_prestamo, id_persona, estado_prestamo, fecha_devolucion, chofer, idTipocaja, idProducto FROM prestamo_O WHERE id_prestamo = %s', (id,))
        row = cur.fetchone()
        cur.close()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail='Prestamo no encontrado')
        for f in ('fecha_prestamo', 'fecha_devolucion'):
            if row.get(f) is not None:
                try:
                    row[f] = row[f].isoformat()
                except Exception:
                    row[f] = str(row[f])
        return row
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/loans', response_model=PrestamoOut, status_code=201)
def create_loan(payload: PrestamoIn, x_user_role: str = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    
    try:
        # Si el usuario NO es admin ni superadmin, auto-completar id_persona con el usuario actual
        id_persona_final = payload.id_persona
        if role not in ('admin', 'superadmin'):
            # Obtener id_persona del usuario actual desde JWT
            id_persona_actual = get_id_persona_from_request(request)
            if id_persona_actual:
                id_persona_final = id_persona_actual
            elif payload.id_persona is None:
                raise HTTPException(status_code=400, detail='No se pudo determinar la persona que presta')
        
        # validate fecha_prestamo is not in the future (if provided)
        if payload.fecha_prestamo:
            try:
                fp = date.fromisoformat(payload.fecha_prestamo)
            except Exception:
                raise HTTPException(status_code=400, detail='fecha_prestamo must be ISO date YYYY-MM-DD')
            if fp > date.today():
                raise HTTPException(status_code=400, detail='fecha_prestamo cannot be in the future')
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        # check chofer exists
        cur.execute('SELECT id_persona FROM persona_O WHERE id_persona = %s', (payload.chofer,))
        ch = cur.fetchone()
        if not ch:
            cur.close(); conn.close();
            raise HTTPException(status_code=400, detail='Chofer no existe')
        # check id_persona if provided
        if id_persona_final is not None:
            cur.execute('SELECT id_persona FROM persona_O WHERE id_persona = %s', (id_persona_final,))
            pas = cur.fetchone()
            if not pas:
                cur.close(); conn.close();
                raise HTTPException(status_code=400, detail='Persona (cliente) no existe')

        # check idTipocaja exists
        cur.execute('SELECT idTipocaja FROM tipocaja_O WHERE idTipocaja = %s', (payload.idTipocaja,))
        tipoc = cur.fetchone()
        if not tipoc:
            cur.close(); conn.close();
            raise HTTPException(status_code=400, detail='Tipocaja no existe')
        # check idProducto if provided
        if payload.idProducto is not None:
            cur.execute('SELECT idProducto FROM producto_O WHERE idProducto = %s', (payload.idProducto,))
            prod = cur.fetchone()
            if not prod:
                cur.close(); conn.close();
                raise HTTPException(status_code=400, detail='Producto no existe')

        # estado_prestamo por defecto activo (0) si no se envía
        estado_prestamo = payload.estado_prestamo if payload.estado_prestamo is not None else 0

        # insert con id_persona_final
        ins = conn.cursor()
        ins.execute('INSERT INTO prestamo_O (cantidad_envaseCaja, cantidad_prestamoBotellas, descripcion_envase, fecha_prestamo, id_persona, estado_prestamo, fecha_devolucion, chofer, idTipocaja, idProducto) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
                    (payload.cantidad_envaseCaja, payload.cantidad_prestamoBotellas, payload.descripcion_envase, payload.fecha_prestamo, id_persona_final, estado_prestamo, payload.fecha_devolucion, payload.chofer, payload.idTipocaja, payload.idProducto))
        conn.commit()
        new_id = ins.lastrowid
        ins.close(); cur.close(); conn.close()
        out = {**payload.dict(), 'id_prestamo': new_id, 'estado_prestamo': estado_prestamo, 'id_persona': id_persona_final}
        for f in ('fecha_prestamo', 'fecha_devolucion'):
            if out.get(f) is not None:
                try:
                    out[f] = out[f].isoformat()
                except Exception:
                    out[f] = str(out[f])
        return out
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/loans/{id}', response_model=PrestamoOut)
def update_loan(id: int, payload: PrestamoUpdateIn, x_user_role: str = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        # check exists
        cur.execute('SELECT * FROM prestamo_O WHERE id_prestamo = %s', (id,))
        existing = cur.fetchone()
        if not existing:
            cur.close(); conn.close();
            raise HTTPException(status_code=404, detail='Prestamo no encontrado')

        # Admin can edit all fields, editor only estado_prestamo and fecha_devolucion
        if role == 'admin':
            # Admin: allow full edit
            cantidad_envaseCaja = payload.cantidad_envaseCaja if payload.cantidad_envaseCaja is not None else existing.get('cantidad_envaseCaja')
            cantidad_prestamoBotellas = payload.cantidad_prestamoBotellas if payload.cantidad_prestamoBotellas is not None else existing.get('cantidad_prestamoBotellas')
            descripcion_envase = payload.descripcion_envase if payload.descripcion_envase is not None else existing.get('descripcion_envase')
            fecha_prestamo = payload.fecha_prestamo if payload.fecha_prestamo is not None else existing.get('fecha_prestamo')
            id_persona = payload.id_persona if payload.id_persona is not None else existing.get('id_persona')
            chofer = payload.chofer if payload.chofer is not None else existing.get('chofer')
            idTipocaja = payload.idTipocaja if payload.idTipocaja is not None else existing.get('idTipocaja')
            idProducto = payload.idProducto if payload.idProducto is not None else existing.get('idProducto')
        else:
            # Editor: preserve non-editable fields
            cantidad_envaseCaja = existing.get('cantidad_envaseCaja')
            cantidad_prestamoBotellas = existing.get('cantidad_prestamoBotellas')
            descripcion_envase = existing.get('descripcion_envase')
            fecha_prestamo = existing.get('fecha_prestamo')
            id_persona = existing.get('id_persona')
            chofer = existing.get('chofer')
            idTipocaja = existing.get('idTipocaja')
            idProducto = existing.get('idProducto')
        
        # Both can edit estado and fecha_devolucion
        estado_prestamo = payload.estado_prestamo if payload.estado_prestamo is not None else existing.get('estado_prestamo')
        fecha_devolucion = payload.fecha_devolucion if payload.fecha_devolucion is not None else existing.get('fecha_devolucion')

        upd = conn.cursor()
        upd.execute('UPDATE prestamo_O SET cantidad_envaseCaja=%s, cantidad_prestamoBotellas=%s, descripcion_envase=%s, fecha_prestamo=%s, id_persona=%s, estado_prestamo=%s, fecha_devolucion=%s, chofer=%s, idTipocaja=%s, idProducto=%s WHERE id_prestamo=%s',
                    (cantidad_envaseCaja, cantidad_prestamoBotellas, descripcion_envase, fecha_prestamo, id_persona, estado_prestamo, fecha_devolucion, chofer, idTipocaja, idProducto, id))
        conn.commit()
        upd.close(); cur.close(); conn.close()

        out = {
            'cantidad_envaseCaja': cantidad_envaseCaja,
            'cantidad_prestamoBotellas': cantidad_prestamoBotellas,
            'descripcion_envase': descripcion_envase,
            'fecha_prestamo': fecha_prestamo,
            'id_persona': id_persona,
            'estado_prestamo': estado_prestamo,
            'fecha_devolucion': fecha_devolucion,
            'chofer': chofer,
            'idTipocaja': idTipocaja,
            'idProducto': idProducto,
            'id_prestamo': id
        }
        for f in ('fecha_prestamo', 'fecha_devolucion'):
            if out.get(f) is not None:
                try:
                    out[f] = out[f].isoformat()
                except Exception:
                    out[f] = str(out[f])
        return out
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete('/loans/{id}', status_code=204)
def delete_loan(id: int, x_user_role: str = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ('admin','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('DELETE FROM prestamo_O WHERE id_prestamo = %s', (id,))
        conn.commit()
        affected = cur.rowcount
        cur.close(); conn.close()
        if affected == 0:
            raise HTTPException(status_code=404, detail='Prestamo no encontrado')
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/tipocajas')
def list_tipocajas():
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT idTipocaja, nombretipo_caja FROM tipocaja_O ORDER BY idTipocaja')
        rows = cur.fetchall()

        cur.close()
        conn.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/productos')
def list_productos(request: Request):
    try:
        # Multi-empresa security
        user_role = request.headers.get('x-user-role', '').lower()
        
        # Verificar autenticación y autorización ANTES de obtener conexión DB
        if user_role != 'superadmin':
            # Otros roles necesitan JWT token válido
            token = request.cookies.get('ollantay_token')
            if not token:
                raise HTTPException(status_code=401, detail="Sesión expirada o no autenticado")
            
            # Obtener company_id del JWT
            try:
                company_id = get_company_id_from_request(request)
                if not company_id:
                    raise HTTPException(status_code=403, detail="No se pudo determinar la empresa del usuario")
            except Exception as jwt_error:
                print(f"JWT Error: {jwt_error}")
                raise HTTPException(status_code=401, detail="Token JWT inválido")
        else:
            company_id = None  # Superadmin no necesita company_id
        
        # Authentication and authorization validated
        
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        if user_role == 'superadmin':
            # Superadmin ve todos los productos con info de empresa y lotes
            try:
                query = """
                SELECT 
                    idProducto, nombreProducto, stockCaja, imagen_producto, 
                    idTipoBotella, tipoBotella, idEmpresa, idUsuarioCreador,
                    lote_activo_id, idProveedor, nombreProveedor,
                    fecha_vencimiento_proxima, precio_compra_actual,
                    precio_minorista, precio_mayorista, precio_especial,
                    stock_total_lotes
                FROM v_producto_info_completa
                ORDER BY nombreProducto
                """
                cur.execute(query)
            except Exception as view_err:
                # Fallback a producto_O básico si la vista no existe o falla
                print(f"WARN: usando fallback productos (vista no disponible): {view_err}")
                query = """
                SELECT p.idProducto, p.nombreProducto, p.stockCaja, p.imagen_producto,
                       p.idTipoBotella, tb.tipoBotella, p.idEmpresa, p.idUsuarioCreador,
                       NULL AS lote_activo_id, NULL AS idProveedor, NULL AS nombreProveedor,
                       NULL AS fecha_vencimiento_proxima, NULL AS precio_compra_actual,
                       p.precioMinorista AS precio_minorista, 
                       p.precioMayorista AS precio_mayorista, 
                       p.precioEspecial AS precio_especial,
                       p.stockCaja AS stock_total_lotes
                FROM producto_O p
                LEFT JOIN tipoBotella tb ON p.idTipoBotella = tb.idTipoBotella
                ORDER BY p.nombreProducto
                """
                cur.execute(query)
        else:
            # Otros roles ven solo productos de su empresa
            try:
                query = """
                SELECT 
                    idProducto, nombreProducto, stockCaja, imagen_producto, 
                    idTipoBotella, tipoBotella, idEmpresa, idUsuarioCreador,
                    lote_activo_id, idProveedor, nombreProveedor,
                    fecha_vencimiento_proxima, precio_compra_actual,
                    precio_minorista, precio_mayorista, precio_especial,
                    stock_total_lotes
                FROM v_producto_info_completa
                WHERE idEmpresa = %s
                ORDER BY nombreProducto
                """
                cur.execute(query, (company_id,))
            except Exception as view_err:
                print(f"WARN: usando fallback productos empresa (vista no disponible): {view_err}")
                query = """
                SELECT p.idProducto, p.nombreProducto, p.stockCaja, p.imagen_producto,
                       p.idTipoBotella, tb.tipoBotella, p.idEmpresa, p.idUsuarioCreador,
                       NULL AS lote_activo_id, NULL AS idProveedor, NULL AS nombreProveedor,
                       NULL AS fecha_vencimiento_proxima, NULL AS precio_compra_actual,
                       p.precioMinorista AS precio_minorista, 
                       p.precioMayorista AS precio_mayorista, 
                       p.precioEspecial AS precio_especial,
                       p.stockCaja AS stock_total_lotes
                FROM producto_O p
                LEFT JOIN tipoBotella tb ON p.idTipoBotella = tb.idTipoBotella
                WHERE p.idEmpresa = %s
                ORDER BY p.nombreProducto
                """
                cur.execute(query, (company_id,))
        
        rows = cur.fetchall()

        # Sobrescribir con precios manuales de precio_producto_O si existen (prioridad sobre calculados)
        try:
            for row in rows:
                pid = row.get('idProducto')
                if not pid:
                    continue
                cur.execute(
                    """
                    SELECT tipoPrecio, precio
                    FROM precio_producto_O
                    WHERE idProducto = %s AND activo = 1
                    """,
                    (pid,),
                )
                precios_manuales = cur.fetchall() or []
                for pm in precios_manuales:
                    t = (pm.get('tipoPrecio') or '').lower()
                    if t == 'minorista':
                        row['precio_minorista'] = pm.get('precio')
                    elif t == 'mayorista':
                        row['precio_mayorista'] = pm.get('precio')
                    elif t == 'especial':
                        row['precio_especial'] = pm.get('precio')
        except Exception as _e:
            # No bloquear listado si la tabla no existe en algunas instalaciones
            print(f"WARN: precios manuales no aplicados: {_e}")

        cur.close()
        conn.close()
        return rows
    except HTTPException:
        # Re-raise HTTP exceptions sin modificar
        raise
    except Exception as e:
        # Log del error interno para debugging
        print(f"Internal error in list_productos: {e}")
        raise HTTPException(status_code=500, detail="Error interno del servidor")


@app.post('/productos')
async def create_producto(
    request: Request,
    nombreProducto: str = Form(...),
    stockCaja: int = Form(default=0),
    idTipoBotella: int = Form(...),
    idEmpresa: int = Form(None),
    imagen_producto: UploadFile = File(None),
    precio_minorista: float = Form(None),
    precio_mayorista: float = Form(None),
    precio_especial: float = Form(None)
):
    # Multi-empresa security
    company_id = get_company_id_from_request(request)
    id_persona = get_id_persona_from_request(request)
    user_role = request.headers.get('x-user-role', '').lower()
    
    # Determinar empresa objetivo
    if user_role == 'superadmin':
        if not idEmpresa:
            raise HTTPException(status_code=400, detail="Superadmin debe especificar idEmpresa")
        target_company_id = idEmpresa
    else:
        if not company_id:
            raise HTTPException(status_code=403, detail="No se pudo determinar la empresa del usuario")
        target_company_id = company_id
    
    if not id_persona:
        raise HTTPException(status_code=403, detail="No se pudo determinar el usuario creador")
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        # Obtener nombre de la empresa para generar código
        cur.execute("SELECT nombre_empresa FROM empresa_O WHERE id_empresa = %s", (target_company_id,))
        row_emp = cur.fetchone()
        if not row_emp:
            raise HTTPException(status_code=404, detail="Empresa no encontrada")
        nombre_empresa = row_emp.get('nombre_empresa') or ''
        empresa_slug = ''.join(c for c in nombre_empresa if c.isalnum()).upper()
        from datetime import datetime
        today = datetime.utcnow()
        y, m, d = today.strftime('%Y'), today.strftime('%m'), today.strftime('%d')
        abbr = 'PRD'

        # Calcular siguiente secuencia del día por empresa para productos
        prefix = f"{empresa_slug}-{abbr}-{y}-{m}-{d}-"
        # Buscar códigos existentes con ese prefijo y obtener el máximo sufijo numérico
        cur.execute("""
            SELECT MAX(CAST(SUBSTRING_INDEX(codigoProducto, '-', -1) AS UNSIGNED)) AS max_seq
            FROM producto_O
            WHERE idEmpresa = %s AND codigoProducto LIKE %s
        """, (target_company_id, prefix + '%'))
        row_seq = cur.fetchone() or {}
        next_seq = int(row_seq.get('max_seq') or 0) + 1
        codigo = f"{prefix}{next_seq:03d}"
        
        # Manejar imagen
        imagen_path = None
        if imagen_producto and imagen_producto.filename:
            # Crear directorio si no existe
            os.makedirs('/app/uploads/productos', exist_ok=True)
            
            # Procesar imagen (optimizar tamaño)
            processed_content = await process_product_image(imagen_producto)
            
            # Generar nombre único manteniendo extensión original
            ext = os.path.splitext(imagen_producto.filename)[1]
            if not ext:
                ext = '.png'
            
            filename = f"producto_{int(time.time())}_{hash(imagen_producto.filename)}{ext}"
            imagen_path = f"/uploads/productos/{filename}"
            
            # Guardar archivo procesado
            with open(f"/app{imagen_path}", "wb") as buffer:
                buffer.write(processed_content)
        
        # Insertar producto con usuario creador y código
        # Nota: algunas instalaciones pueden no tener columna imagen_producto; si falla, capturaremos y reintentaremos sin la columna
        try:
            cur.execute("""
                INSERT INTO producto_O (nombreProducto, codigoProducto, stockCaja, idEmpresa, idTipoBotella, imagen_producto, idUsuarioCreador)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (nombreProducto, codigo, stockCaja, target_company_id, idTipoBotella, imagen_path, id_persona))
        except Exception as e:
            # Reintentar sin imagen_producto si la columna no existe en la BD
            if 'Unknown column' in str(e) and 'imagen_producto' in str(e):
                cur = conn.cursor()
                cur.execute("""
                    INSERT INTO producto_O (nombreProducto, codigoProducto, stockCaja, idEmpresa, idTipoBotella, idUsuarioCreador)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (nombreProducto, codigo, stockCaja, target_company_id, idTipoBotella, id_persona))
            else:
                raise
        
        producto_id = cur.lastrowid
        
        # DEPRECATED: Ya no insertamos precios aquí, se manejan por lotes
        # Los precios se calcularán automáticamente desde lote_producto con márgenes
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {"message": "Producto creado exitosamente. Agregue un lote para establecer precios.", "idProducto": producto_id, "codigoProducto": codigo}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/productos/{producto_id}')
async def update_producto(
    producto_id: int,
    request: Request,
    nombreProducto: str = Form(...),
    stockCaja: int = Form(default=0),
    idTipoBotella: int = Form(...),
    imagen_producto: UploadFile = File(None),
    precio_minorista: float = Form(None),
    precio_mayorista: float = Form(None),
    precio_especial: float = Form(None)
):
    # Multi-empresa security
    company_id = get_company_id_from_request(request)
    id_persona = get_id_persona_from_request(request)
    user_role = request.headers.get('x-user-role', '').lower()
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        # Verificar que el producto existe y el usuario tiene permisos
        if user_role == 'superadmin':
            cur.execute("SELECT * FROM producto_O WHERE idProducto = %s", (producto_id,))
        else:
            if not company_id:
                raise HTTPException(status_code=403, detail="No se pudo determinar la empresa del usuario")
            cur.execute("SELECT * FROM producto_O WHERE idProducto = %s AND idEmpresa = %s", (producto_id, company_id))
        
        producto = cur.fetchone()
        if not producto:
            raise HTTPException(status_code=404, detail="Producto no encontrado")

        # Permisos: administradores y editores de la misma empresa o superadmin pueden editar
        if user_role not in ('admin', 'editor', 'superadmin'):
            raise HTTPException(status_code=403, detail="Solo administradores o editores pueden editar productos")
        
        # Manejar imagen
        imagen_path = producto.get('imagen_producto')
        if imagen_producto and imagen_producto.filename:
            # Eliminar imagen anterior si existe
            if imagen_path and os.path.exists(f"/app{imagen_path}"):
                os.remove(f"/app{imagen_path}")
            
            # Crear directorio si no existe
            os.makedirs('/app/uploads/productos', exist_ok=True)
            
            # Procesar imagen (optimizar tamaño)
            processed_content = await process_product_image(imagen_producto)
            
            # Generar nombre único manteniendo extensión original
            ext = os.path.splitext(imagen_producto.filename)[1]
            if not ext:
                ext = '.png'
            
            filename = f"producto_{int(time.time())}_{hash(imagen_producto.filename)}{ext}"
            imagen_path = f"/uploads/productos/{filename}"
            
            # Guardar archivo procesado
            with open(f"/app{imagen_path}", "wb") as buffer:
                buffer.write(processed_content)
        
        # Actualizar producto con tolerancia si la columna imagen_producto no existe en algunas instalaciones
        try:
            cur.execute(
                """
                UPDATE producto_O 
                SET nombreProducto = %s, stockCaja = %s, idTipoBotella = %s, imagen_producto = %s
                WHERE idProducto = %s
                """,
                (nombreProducto, stockCaja, idTipoBotella, imagen_path, producto_id),
            )
        except Exception as e:
            if 'Unknown column' in str(e) and 'imagen_producto' in str(e):
                # Reintentar sin la columna de imagen
                cur.execute(
                    """
                    UPDATE producto_O 
                    SET nombreProducto = %s, stockCaja = %s, idTipoBotella = %s
                    WHERE idProducto = %s
                    """,
                    (nombreProducto, stockCaja, idTipoBotella, producto_id),
                )
            else:
                raise
        
        # Actualizar precios en precio_producto_O si se proporcionan
        if precio_minorista is not None or precio_mayorista is not None or precio_especial is not None:
            # Desactivar precios anteriores
            cur.execute("UPDATE precio_producto_O SET activo = 0 WHERE idProducto = %s", (producto_id,))
        
            # Insertar nuevos precios activos
            if precio_minorista is not None and precio_minorista > 0:
                cur.execute("""
                    INSERT INTO precio_producto_O (idProducto, tipoPrecio, precio, activo)
                    VALUES (%s, 'minorista', %s, 1)
                """, (producto_id, precio_minorista))
        
            if precio_mayorista is not None and precio_mayorista > 0:
                cur.execute("""
                    INSERT INTO precio_producto_O (idProducto, tipoPrecio, precio, activo)
                    VALUES (%s, 'mayorista', %s, 1)
                """, (producto_id, precio_mayorista))
        
            if precio_especial is not None and precio_especial > 0:
                cur.execute("""
                    INSERT INTO precio_producto_O (idProducto, tipoPrecio, precio, activo)
                    VALUES (%s, 'especial', %s, 1)
                """, (producto_id, precio_especial))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {"message": "Producto actualizado exitosamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete('/productos/{producto_id}')
def delete_producto(producto_id: int, request: Request):
    # Multi-empresa security
    company_id = get_company_id_from_request(request)
    user_role = request.headers.get('x-user-role', '').lower()
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        # Verificar que el producto existe y el usuario tiene permisos
        if user_role == 'superadmin':
            cur.execute("SELECT * FROM producto_O WHERE idProducto = %s", (producto_id,))
        else:
            if not company_id:
                raise HTTPException(status_code=403, detail="No se pudo determinar la empresa del usuario")
            cur.execute("SELECT * FROM producto_O WHERE idProducto = %s AND idEmpresa = %s", (producto_id, company_id))
        
        producto = cur.fetchone()
        if not producto:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
        
        # Eliminar todas las referencias foreign key antes de eliminar el producto
        # 1. Eliminar registros de negocio que referencian este producto
        cur.execute("DELETE FROM negocio WHERE idProducto = %s", (producto_id,))
        
        # 2. Eliminar registros de detalle_venta_O
        cur.execute("DELETE FROM detalle_venta_O WHERE idProducto = %s", (producto_id,))
        
        # 3. Eliminar registros de detalle_compra_O
        cur.execute("DELETE FROM detalle_compra_O WHERE idProducto = %s", (producto_id,))
        
        # 4. Eliminar imagen si existe
        if producto['imagen_producto'] and os.path.exists(f"/app{producto['imagen_producto']}"):
            os.remove(f"/app{producto['imagen_producto']}")
        
        # 5. Eliminar precios relacionados
        cur.execute("DELETE FROM precio_producto_O WHERE idProducto = %s", (producto_id,))
        
        # 6. Finalmente eliminar el producto
        cur.execute("DELETE FROM producto_O WHERE idProducto = %s", (producto_id,))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {"message": "Producto eliminado exitosamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/tipobotellas')
def list_tipo_botellas():
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT idTipoBotella, tipoBotella FROM tipoBotella ORDER BY idTipoBotella')
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/empresas')
def list_empresas(request: Request):
    user_role = request.headers.get('x-user-role', '').lower()
    
    if user_role != 'superadmin':
        raise HTTPException(status_code=403, detail="Solo superadmin puede ver todas las empresas")
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT id_empresa, nombre_empresa FROM empresa_O WHERE estado_empresa = 1 ORDER BY nombre_empresa')
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ==================== ENDPOINTS DE LOTES ====================

@app.get('/lotes')
def list_lotes(request: Request, idProducto: int = None):
    """Lista todos los lotes (compras) de productos"""
    company_id = get_company_id_from_request(request)
    user_role = request.headers.get('x-user-role', '').lower()
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        if user_role == 'superadmin':
            if idProducto:
                cur.execute("""
                    SELECT l.*, p.nombreProducto, prov.nombreComercial as nombreProveedor
                    FROM lote_producto l
                    LEFT JOIN producto_O p ON l.idProducto = p.idProducto
                    LEFT JOIN proveedor_O prov ON l.idProveedor = prov.idProveedor
                    WHERE l.idProducto = %s AND l.stockActual > 0
                    ORDER BY l.fechaVencimiento ASC, l.fechaCompra ASC
                """, (idProducto,))
            else:
                cur.execute("""
                    SELECT l.*, p.nombreProducto, prov.nombreComercial as nombreProveedor
                    FROM lote_producto l
                    LEFT JOIN producto_O p ON l.idProducto = p.idProducto
                    LEFT JOIN proveedor_O prov ON l.idProveedor = prov.idProveedor
                    WHERE l.stockActual > 0
                    ORDER BY l.fechaVencimiento ASC
                """)
        else:
            if not company_id:
                raise HTTPException(status_code=403, detail="No se pudo determinar la empresa del usuario")
            
            if idProducto:
                cur.execute("""
                    SELECT l.*, p.nombreProducto, prov.nombreComercial as nombreProveedor
                    FROM lote_producto l
                    LEFT JOIN producto_O p ON l.idProducto = p.idProducto
                    LEFT JOIN proveedor_O prov ON l.idProveedor = prov.idProveedor
                    WHERE l.idEmpresa = %s AND l.idProducto = %s AND l.stockActual > 0
                    ORDER BY l.fechaVencimiento ASC, l.fechaCompra ASC
                """, (company_id, idProducto))
            else:
                cur.execute("""
                    SELECT l.*, p.nombreProducto, prov.nombreComercial as nombreProveedor
                    FROM lote_producto l
                    LEFT JOIN producto_O p ON l.idProducto = p.idProducto
                    LEFT JOIN proveedor_O prov ON l.idProveedor = prov.idProveedor
                    WHERE l.idEmpresa = %s AND l.stockActual > 0
                    ORDER BY l.fechaVencimiento ASC
                """, (company_id,))
        
        lotes = cur.fetchall()
        cur.close()
        conn.close()
        return lotes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/productos/{idProducto}/precios-proveedor')
def precios_por_proveedor(idProducto: int, request: Request, idProveedor: int = None, company_id: int = None):
    """
    Devuelve el último precio de compra por proveedor para un producto dado.
    - Si el usuario no es superadmin, se limita a su empresa (JWT company_id)
    - Si es superadmin y se pasa company_id, se filtra por esa empresa; si no, incluye todas
    Respuesta: [{ idProveedor, nombreProveedor, precioCompra, fechaCompra }]
    """
    user_role = request.headers.get('x-user-role', '').lower()
    user_company = get_company_id_from_request(request)

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)

        where = ['lp.idProducto = %s']
        params = [idProducto]

        # Scoping por empresa
        if user_role == 'superadmin':
            if company_id is not None:
                where.append('lp.idEmpresa = %s')
                params.append(company_id)
        else:
            if not user_company:
                cur.close(); conn.close()
                raise HTTPException(status_code=403, detail="No se pudo determinar la empresa del usuario")
            where.append('lp.idEmpresa = %s')
            params.append(user_company)

        # Filtro por proveedor (opcional)
        if idProveedor is not None:
            where.append('lp.idProveedor = %s')
            params.append(idProveedor)

        # Obtener el último precio por proveedor usando subconsulta de max(fechaCompra)
        query = f'''
            SELECT lp.idProveedor, prov.nombreComercial AS nombreProveedor, lp.precioCompra, lp.fechaCompra
            FROM lote_producto lp
            LEFT JOIN proveedor_O prov ON prov.idProveedor = lp.idProveedor
            JOIN (
                SELECT idProveedor, MAX(fechaCompra) AS maxFecha
                FROM lote_producto
                WHERE idProducto = %s {' AND idEmpresa = %s' if (user_role != 'superadmin' or company_id is not None) else ''} {' AND idProveedor = %s' if idProveedor is not None else ''}
                GROUP BY idProveedor
            ) t ON t.idProveedor = lp.idProveedor AND t.maxFecha = lp.fechaCompra
            WHERE {' AND '.join(where)}
            ORDER BY lp.fechaCompra DESC
        '''

        # Construir params para la subconsulta + consulta principal en el mismo orden de los placeholders
        sub_params = [idProducto]
        if user_role != 'superadmin' or company_id is not None:
            sub_params.append(company_id if user_role == 'superadmin' else user_company)
        if idProveedor is not None:
            sub_params.append(idProveedor)
        all_params = sub_params + params

        cur.execute(query, tuple(all_params))
        rows = cur.fetchall()
        cur.close(); conn.close()

        # Normalizar tipos
        for r in rows:
            if r.get('fechaCompra') is not None:
                try:
                    r['fechaCompra'] = r['fechaCompra'].isoformat()
                except Exception:
                    r['fechaCompra'] = str(r['fechaCompra'])
            r['precioCompra'] = float(r.get('precioCompra') or 0)

        return rows
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/lotes')
async def create_lote(
    request: Request,
    idProducto: int = Form(...),
    idProveedor: int = Form(None),
    fechaCompra: str = Form(...),
    fechaVencimiento: str = Form(None),
    precioCompra: float = Form(...),
    cantidadCajas: int = Form(...),
    precio_minorista: float = Form(None),
    precio_mayorista: float = Form(None),
    precio_especial: float = Form(None)
):
    """Crea un nuevo lote (registra una compra de producto)"""
    company_id = get_company_id_from_request(request)
    id_persona = get_id_persona_from_request(request)
    user_role = request.headers.get('x-user-role', '').lower()
    
    if not company_id:
        raise HTTPException(status_code=403, detail="No se pudo determinar la empresa del usuario")
    
    if not id_persona:
        raise HTTPException(status_code=403, detail="No se pudo determinar el usuario")
    
    if precioCompra <= 0:
        raise HTTPException(status_code=400, detail="El precio de compra debe ser mayor a 0")
    
    if cantidadCajas <= 0:
        raise HTTPException(status_code=400, detail="La cantidad debe ser mayor a 0")
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        # Verificar que el producto existe y pertenece a la empresa del usuario
        if user_role == 'superadmin':
            cur.execute("SELECT * FROM producto_O WHERE idProducto = %s", (idProducto,))
        else:
            cur.execute("SELECT * FROM producto_O WHERE idProducto = %s AND idEmpresa = %s", (idProducto, company_id))
        
        producto = cur.fetchone()
        if not producto:
            raise HTTPException(status_code=404, detail="Producto no encontrado o no pertenece a su empresa")
        
        # Preparar código de lote: EMPRESASLUG-LOT-YYYY-MM-DD-NNN
        cur.execute("SELECT nombre_empresa FROM empresa_O WHERE id_empresa = %s", (company_id,))
        emp = cur.fetchone() or {}
        nombre_empresa = (emp.get('nombre_empresa') or '').upper()
        empresa_slug = ''.join(ch for ch in nombre_empresa if ch.isalnum())
        from datetime import datetime as _dt
        f = _dt.fromisoformat(fechaCompra) if fechaCompra else _dt.utcnow()
        prefix = f"{empresa_slug}-LOT-{f.year}-{f.month:02d}-{f.day:02d}-"
        # Secuencia para el día/empresa
        try:
            cur.execute("""
                SELECT MAX(CAST(SUBSTRING_INDEX(codigoLote, '-', -1) AS UNSIGNED)) AS max_seq
                FROM lote_producto
                WHERE idEmpresa = %s AND codigoLote LIKE %s
            """, (company_id, prefix + '%'))
            row_seq = cur.fetchone() or {}
            seq = int(row_seq.get('max_seq') or 0) + 1
        except Exception:
            seq = 1

        codigo_lote = f"{prefix}{seq:03d}"

        # Insertar lote (con fallback si la columna no existe)
        try:
            # Intentar insertar con todos los campos incluyendo precios
            cur.execute("""
                INSERT INTO lote_producto 
                (idProducto, idProveedor, fechaCompra, fechaVencimiento, precioCompra, cantidadCajas, stockActual, 
                 idEmpresa, idUsuarioCreador, codigoLote, precio_minorista, precio_mayorista, precio_especial)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (idProducto, idProveedor, fechaCompra, fechaVencimiento, precioCompra, cantidadCajas, cantidadCajas, 
                  company_id, id_persona, codigo_lote, precio_minorista, precio_mayorista, precio_especial))
        except Exception as e:
            if 'Unknown column' in str(e):
                # Si faltan columnas de precios, crear y reintentar
                alt = conn.cursor()
                for col in ['precio_minorista', 'precio_mayorista', 'precio_especial', 'codigoLote']:
                    try:
                        if col == 'codigoLote':
                            alt.execute(f"ALTER TABLE lote_producto ADD COLUMN {col} VARCHAR(100) NULL")
                        else:
                            alt.execute(f"ALTER TABLE lote_producto ADD COLUMN {col} DECIMAL(10,2) NULL")
                    except Exception:
                        pass
                conn.commit()
                alt.close()
                # Reintentar inserción completa
                cur.execute("""
                    INSERT INTO lote_producto 
                    (idProducto, idProveedor, fechaCompra, fechaVencimiento, precioCompra, cantidadCajas, stockActual, 
                     idEmpresa, idUsuarioCreador, codigoLote, precio_minorista, precio_mayorista, precio_especial)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (idProducto, idProveedor, fechaCompra, fechaVencimiento, precioCompra, cantidadCajas, cantidadCajas, 
                      company_id, id_persona, codigo_lote, precio_minorista, precio_mayorista, precio_especial))
            else:
                raise
        
        lote_id = cur.lastrowid
        
        # El trigger tr_actualizar_stock_producto_insert actualizará automáticamente el stock del producto
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {"message": "Lote creado exitosamente", "idLote": lote_id, "codigoLote": codigo_lote}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/lotes/{id}')
async def update_lote(
    id: int,
    request: Request,
    precio_minorista: float = Form(None),
    precio_mayorista: float = Form(None),
    precio_especial: float = Form(None)
):
    """Actualiza los precios de un lote específico"""
    company_id = get_company_id_from_request(request)
    user_role = request.headers.get('x-user-role', '').lower()
    
    if not company_id and user_role != 'superadmin':
        raise HTTPException(status_code=403, detail="No se pudo determinar la empresa del usuario")
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        # Verificar que el lote existe y pertenece a la empresa
        if user_role == 'superadmin':
            cur.execute("SELECT * FROM lote_producto WHERE idLote = %s", (id,))
        else:
            cur.execute("SELECT * FROM lote_producto WHERE idLote = %s AND idEmpresa = %s", (id, company_id))
        
        lote = cur.fetchone()
        if not lote:
            raise HTTPException(status_code=404, detail="Lote no encontrado o no pertenece a su empresa")
        
        # Construir SET dinámico
        updates = []
        params = []
        if precio_minorista is not None:
            updates.append('precio_minorista = %s')
            params.append(precio_minorista)
        if precio_mayorista is not None:
            updates.append('precio_mayorista = %s')
            params.append(precio_mayorista)
        if precio_especial is not None:
            updates.append('precio_especial = %s')
            params.append(precio_especial)
        
        if not updates:
            raise HTTPException(status_code=400, detail="No se proporcionaron precios para actualizar")
        
        params.append(id)
        
        # Intentar actualizar (con fallback si columnas no existen)
        try:
            cur.execute(f"UPDATE lote_producto SET {', '.join(updates)} WHERE idLote = %s", tuple(params))
            conn.commit()
        except Exception as e:
            if 'Unknown column' in str(e):
                # Crear columnas si no existen
                alt = conn.cursor()
                for col in ['precio_minorista', 'precio_mayorista', 'precio_especial']:
                    try:
                        alt.execute(f"ALTER TABLE lote_producto ADD COLUMN {col} DECIMAL(10,2) NULL")
                    except Exception:
                        pass
                conn.commit()
                alt.close()
                # Reintentar
                cur.execute(f"UPDATE lote_producto SET {', '.join(updates)} WHERE idLote = %s", tuple(params))
                conn.commit()
            else:
                raise
        
        cur.close()
        conn.close()
        
        return {"message": "Precios del lote actualizados exitosamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/margenes')
def get_margenes(request: Request):
    """Obtiene los márgenes de ganancia configurados para la empresa"""
    company_id = get_company_id_from_request(request)
    user_role = request.headers.get('x-user-role', '').lower()
    
    if not company_id and user_role != 'superadmin':
        raise HTTPException(status_code=403, detail="No se pudo determinar la empresa del usuario")
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        if user_role == 'superadmin':
            cur.execute("""
                SELECT m.*, e.nombre_empresa 
                FROM margen_ganancia m
                LEFT JOIN empresa_O e ON m.idEmpresa = e.id_empresa
                ORDER BY e.nombre_empresa, m.tipoCliente
            """)
        else:
            cur.execute("""
                SELECT * FROM margen_ganancia 
                WHERE idEmpresa = %s
                ORDER BY tipoCliente
            """, (company_id,))
        
        margenes = cur.fetchall()
        cur.close()
        conn.close()
        return margenes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/margenes/{tipo_cliente}')
async def update_margen(
    tipo_cliente: str,
    request: Request,
    porcentajeMargen: float = Form(...)
):
    """Actualiza el margen de ganancia para un tipo de cliente"""
    company_id = get_company_id_from_request(request)
    user_role = request.headers.get('x-user-role', '').lower()
    
    if not company_id:
        raise HTTPException(status_code=403, detail="No se pudo determinar la empresa del usuario")
    
    if tipo_cliente not in ['minorista', 'mayorista', 'especial']:
        raise HTTPException(status_code=400, detail="Tipo de cliente inválido")
    
    if porcentajeMargen < 0 or porcentajeMargen > 100:
        raise HTTPException(status_code=400, detail="El margen debe estar entre 0 y 100")
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("""
            UPDATE margen_ganancia 
            SET porcentajeMargen = %s
            WHERE idEmpresa = %s AND tipoCliente = %s
        """, (porcentajeMargen, company_id, tipo_cliente))
        
        conn.commit()
        affected = cur.rowcount
        cur.close()
        conn.close()
        
        if affected == 0:
            raise HTTPException(status_code=404, detail="Margen no encontrado")
        
        return {"message": f"Margen {tipo_cliente} actualizado exitosamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/health')
def health():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT 1')
        cur.fetchone()
        cur.close(); conn.close()
        return {'status': 'ok', 'db': 'connected'}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f'db error: {e}')
