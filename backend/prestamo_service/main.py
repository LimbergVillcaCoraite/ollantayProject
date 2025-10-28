from fastapi import FastAPI, HTTPException, Request, Header, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, datetime
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
    # basic validations: chofer must exist, id_persona if provided must exist
    try:
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
        if payload.id_persona is not None:
            cur.execute('SELECT id_persona FROM persona_O WHERE id_persona = %s', (payload.id_persona,))
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

        # insert
        ins = conn.cursor()
        ins.execute('INSERT INTO prestamo_O (cantidad_envaseCaja, cantidad_prestamoBotellas, descripcion_envase, fecha_prestamo, id_persona, estado_prestamo, fecha_devolucion, chofer, idTipocaja, idProducto) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
                    (payload.cantidad_envaseCaja, payload.cantidad_prestamoBotellas, payload.descripcion_envase, payload.fecha_prestamo, payload.id_persona, estado_prestamo, payload.fecha_devolucion, payload.chofer, payload.idTipocaja, payload.idProducto))
        conn.commit()
        new_id = ins.lastrowid
        ins.close(); cur.close(); conn.close()
        out = {**payload.dict(), 'id_prestamo': new_id, 'estado_prestamo': estado_prestamo}
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
            # Superadmin ve todos los productos con info de empresa
            query = """
            SELECT p.*, tb.tipoBotella, e.nombre_empresa,
                   pp_min.precio as precio_minorista,
                   pp_may.precio as precio_mayorista,
                   pp_esp.precio as precio_especial
            FROM producto_O p
            LEFT JOIN tipoBotella tb ON p.idTipoBotella = tb.idTipoBotella
            LEFT JOIN empresa_O e ON p.idEmpresa = e.id_empresa
            LEFT JOIN precio_producto_O pp_min ON p.idProducto = pp_min.idProducto AND pp_min.tipoPrecio = 'minorista'
            LEFT JOIN precio_producto_O pp_may ON p.idProducto = pp_may.idProducto AND pp_may.tipoPrecio = 'mayorista'
            LEFT JOIN precio_producto_O pp_esp ON p.idProducto = pp_esp.idProducto AND pp_esp.tipoPrecio = 'especial'
            ORDER BY p.idProducto
            """
            cur.execute(query)
        else:
            # Otros roles ven solo productos de su empresa
            query = """
            SELECT p.*, tb.tipoBotella,
                   pp_min.precio as precio_minorista,
                   pp_may.precio as precio_mayorista,
                   pp_esp.precio as precio_especial
            FROM producto_O p
            LEFT JOIN tipoBotella tb ON p.idTipoBotella = tb.idTipoBotella
            LEFT JOIN precio_producto_O pp_min ON p.idProducto = pp_min.idProducto AND pp_min.tipoPrecio = 'minorista'
            LEFT JOIN precio_producto_O pp_may ON p.idProducto = pp_may.idProducto AND pp_may.tipoPrecio = 'mayorista'
            LEFT JOIN precio_producto_O pp_esp ON p.idProducto = pp_esp.idProducto AND pp_esp.tipoPrecio = 'especial'
            WHERE p.idEmpresa = %s
            ORDER BY p.idProducto
            """
            cur.execute(query, (company_id,))
        
        rows = cur.fetchall()
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
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Manejar imagen
        imagen_path = None
        if imagen_producto and imagen_producto.filename:
            # Crear directorio si no existe
            os.makedirs('/app/uploads/productos', exist_ok=True)
            
            # Generar nombre único
            ext = os.path.splitext(imagen_producto.filename)[1]
            filename = f"producto_{int(time.time())}_{hash(imagen_producto.filename)}{ext}"
            imagen_path = f"/uploads/productos/{filename}"
            
            # Guardar archivo
            with open(f"/app{imagen_path}", "wb") as buffer:
                content = await imagen_producto.read()
                buffer.write(content)
        
        # Insertar producto
        cur.execute("""
            INSERT INTO producto_O (nombreProducto, stockCaja, idEmpresa, idTipoBotella, imagen_producto)
            VALUES (%s, %s, %s, %s, %s)
        """, (nombreProducto, stockCaja, target_company_id, idTipoBotella, imagen_path))
        
        producto_id = cur.lastrowid
        
        # Insertar precios si se proporcionan
        precios = [
            ('minorista', precio_minorista),
            ('mayorista', precio_mayorista),
            ('especial', precio_especial)
        ]
        
        for tipo_precio, precio in precios:
            if precio is not None and precio > 0:
                cur.execute("""
                    INSERT INTO precio_producto_O (idProducto, tipoPrecio, precio, fechaCreacion)
                    VALUES (%s, %s, %s, NOW())
                """, (producto_id, tipo_precio, precio))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {"message": "Producto creado exitosamente", "idProducto": producto_id}
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
        
        # Manejar imagen
        imagen_path = producto['imagen_producto']
        if imagen_producto and imagen_producto.filename:
            # Eliminar imagen anterior si existe
            if imagen_path and os.path.exists(f"/app{imagen_path}"):
                os.remove(f"/app{imagen_path}")
            
            # Crear directorio si no existe
            os.makedirs('/app/uploads/productos', exist_ok=True)
            
            # Generar nombre único
            ext = os.path.splitext(imagen_producto.filename)[1]
            filename = f"producto_{int(time.time())}_{hash(imagen_producto.filename)}{ext}"
            imagen_path = f"/uploads/productos/{filename}"
            
            # Guardar archivo
            with open(f"/app{imagen_path}", "wb") as buffer:
                content = await imagen_producto.read()
                buffer.write(content)
        
        # Actualizar producto
        cur.execute("""
            UPDATE producto_O 
            SET nombreProducto = %s, stockCaja = %s, idTipoBotella = %s, imagen_producto = %s
            WHERE idProducto = %s
        """, (nombreProducto, stockCaja, idTipoBotella, imagen_path, producto_id))
        
        # Actualizar precios
        precios = [
            ('minorista', precio_minorista),
            ('mayorista', precio_mayorista),
            ('especial', precio_especial)
        ]
        
        for tipo_precio, precio in precios:
            if precio is not None:
                if precio > 0:
                    # Insertar o actualizar precio
                    cur.execute("""
                        INSERT INTO precio_producto_O (idProducto, tipoPrecio, precio, fechaCreacion)
                        VALUES (%s, %s, %s, NOW())
                        ON DUPLICATE KEY UPDATE precio = VALUES(precio), fechaCreacion = NOW()
                    """, (producto_id, tipo_precio, precio))
                else:
                    # Eliminar precio si es 0
                    cur.execute("""
                        DELETE FROM precio_producto_O 
                        WHERE idProducto = %s AND tipoPrecio = %s
                    """, (producto_id, tipo_precio))
        
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
        
        # Eliminar imagen si existe
        if producto['imagen_producto'] and os.path.exists(f"/app{producto['imagen_producto']}"):
            os.remove(f"/app{producto['imagen_producto']}")
        
        # Eliminar precios relacionados
        cur.execute("DELETE FROM precio_producto_O WHERE idProducto = %s", (producto_id,))
        
        # Eliminar producto
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
        cur.execute('SELECT id_empresa, nombre_empresa FROM empresa_O ORDER BY nombre_empresa')
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
        cur.close(); conn.close()
        return {'status': 'ok', 'db': 'connected'}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f'db error: {e}')
