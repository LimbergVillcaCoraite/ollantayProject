from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
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


# ========================
# Modelos para Proveedores
# ========================

class ProveedorIn(BaseModel):
    nombreComercial: str = Field(..., max_length=100)
    contacto: Optional[str] = Field(None, max_length=100)
    telefono: Optional[str] = Field(None, max_length=15)
    email: Optional[str] = Field(None, max_length=100)
    direccion: Optional[str] = Field(None, max_length=200)
    esEmpresa: str = Field(..., max_length=1)  # 'E'=empresa, 'P'=persona
    idPersona: Optional[int] = None  # Si tipo='P', referencia a persona_O
    estado: int = Field(default=1, ge=0, le=1)


class ProveedorOut(ProveedorIn):
    idProveedor: int
    idEmpresa: int
    nombreEmpresa: Optional[str] = None


# ========================
# Endpoints de Proveedores
# ========================

@app.get('/proveedores', response_model=List[ProveedorOut])
def list_proveedores(
    q: Optional[str] = None,
    esEmpresa: Optional[str] = None,
    estado: Optional[int] = None,
    offset: int = 0,
    limit: int = 100,
    x_user_role: str = Header(None),
    request: Request = None
):
    """Listar proveedores. Superadmin ve todos, admin solo de su empresa."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        role = get_role(x_user_role, request)
        user_company = get_company_id_from_request(request)

        query = '''
            SELECT 
                p.idProveedor, p.nombreComercial, p.contacto, p.telefono,
                p.email, p.direccion, p.esEmpresa, p.idPersona,
                p.estado, p.idEmpresaProveedor, e.nombre_empresa AS nombreEmpresa
            FROM proveedor_O p
            LEFT JOIN empresa_O e ON p.idEmpresaProveedor = e.id_empresa
        '''
        
        where = []
        params = []

        # Scoping multiempresa
        if role != 'superadmin' and user_company is not None:
            where.append('p.idEmpresaProveedor = %s')
            params.append(user_company)

        # Filtros
        if q:
            like = f"%{q}%"
            where.append('(p.nombreComercial LIKE %s OR p.contacto LIKE %s OR p.email LIKE %s)')
            params.extend([like, like, like])
        if esEmpresa:
            where.append('p.esEmpresa = %s')
            params.append(esEmpresa)
        if estado is not None:
            where.append('p.estado = %s')
            params.append(estado)

        if where:
            query += ' WHERE ' + ' AND '.join(where)
        
        query += ' ORDER BY p.nombreComercial ASC LIMIT %s OFFSET %s'
        params.extend([limit, offset])

        cur.execute(query, tuple(params))
        rows = cur.fetchall() or []
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/proveedores/{id}', response_model=ProveedorOut)
def get_proveedor(id: int, x_user_role: str = Header(None), request: Request = None):
    """Obtener proveedor por ID."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        role = get_role(x_user_role, request)
        user_company = get_company_id_from_request(request)

        query = '''
            SELECT 
                p.idProveedor, p.nombreComercial, p.contacto, p.telefono,
                p.email, p.direccion, p.esEmpresa, p.idPersona,
                p.estado, p.idEmpresaProveedor, e.nombre_empresa AS nombreEmpresa
            FROM proveedor_O p
            LEFT JOIN empresa_O e ON p.idEmpresaProveedor = e.id_empresa
            WHERE p.idProveedor = %s
        '''
        cur.execute(query, (id,))
        prov = cur.fetchone()
        
        if not prov:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Proveedor no encontrado')

        # Validar scoping
        if role != 'superadmin' and user_company is not None and prov['idEmpresa'] != user_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')

        cur.close()
        conn.close()
        return prov
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/proveedores', response_model=ProveedorOut, status_code=201)
def create_proveedor(payload: ProveedorIn, x_user_role: str = Header(None), request: Request = None):
    """Crear proveedor."""
    role = get_role(x_user_role, request)
    if role not in ('admin', 'editor', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')

    nombre = payload.nombreComercial.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail='nombreComercial requerido')

    if payload.esEmpresa not in ('E', 'P'):
        raise HTTPException(status_code=400, detail='esEmpresa debe ser E o P')

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        # Determinar empresa
        user_company = get_company_id_from_request(request)
        if role == 'superadmin':
            # Si tipo='P' y hay idPersona, usar empresa de esa persona
            if payload.esEmpresa == 'P' and payload.idPersona:
                cur.execute('SELECT id_empresa FROM persona_O WHERE idPersona = %s', (payload.idPersona,))
                pers = cur.fetchone()
                if not pers or not pers.get('id_empresa'):
                    cur.close()
                    conn.close()
                    raise HTTPException(status_code=400, detail='Persona no tiene empresa asignada')
                target_company = pers['id_empresa']
            else:
                # Superadmin debe especificar empresa de alguna forma; por ahora requerir user_company
                if user_company is None:
                    cur.close()
                    conn.close()
                    raise HTTPException(status_code=400, detail='Empresa requerida para superadmin')
                target_company = user_company
        else:
            if user_company is None:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='Usuario sin empresa')
            target_company = user_company

        # Si tipo='P', validar que idPersona existe y pertenece a la empresa
        if payload.esEmpresa == 'P':
            if not payload.idPersona:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='idPersona requerido para proveedor tipo P')
            cur.execute('SELECT idPersona, id_empresa FROM persona_O WHERE idPersona = %s', (payload.idPersona,))
            pers = cur.fetchone()
            if not pers:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='Persona no existe')
            if role != 'superadmin' and pers['id_empresa'] != target_company:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='Persona no pertenece a su empresa')

        # Insertar
        ins = conn.cursor()
        ins.execute('''
            INSERT INTO proveedor_O (nombreComercial, contacto, telefono, email, direccion, esEmpresa, idPersona, estado, idEmpresa)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (nombre, payload.contacto, payload.telefono, payload.email, payload.direccion, 
              payload.esEmpresa, payload.idPersona, payload.estado, target_company))
        conn.commit()
        new_id = ins.lastrowid
        ins.close()
        cur.close()
        conn.close()

        return get_proveedor(new_id, x_user_role, request)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/proveedores/{id}', response_model=ProveedorOut)
def update_proveedor(id: int, payload: ProveedorIn, x_user_role: str = Header(None), request: Request = None):
    """Actualizar proveedor."""
    role = get_role(x_user_role, request)
    if role not in ('admin', 'editor', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')

    nombre = payload.nombreComercial.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail='nombreComercial requerido')

    if payload.esEmpresa not in ('E', 'P'):
        raise HTTPException(status_code=400, detail='esEmpresa debe ser E o P')

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)

        # Verificar existencia y scoping
        cur.execute('SELECT idProveedor, idEmpresa FROM proveedor_O WHERE idProveedor = %s', (id,))
        prov = cur.fetchone()
        if not prov:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Proveedor no encontrado')

        if role != 'superadmin' and user_company is not None and prov['idEmpresa'] != user_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')

        # Si tipo='P', validar idPersona
        if payload.esEmpresa == 'P':
            if not payload.idPersona:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='idPersona requerido para tipo P')
            cur.execute('SELECT idPersona FROM persona_O WHERE idPersona = %s', (payload.idPersona,))
            if not cur.fetchone():
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='Persona no existe')

        # Actualizar
        upd = conn.cursor()
        upd.execute('''
            UPDATE proveedor_O 
            SET nombreComercial=%s, contacto=%s, telefono=%s, email=%s, direccion=%s,
                esEmpresa=%s, idPersona=%s, estado=%s
            WHERE idProveedor=%s
        ''', (nombre, payload.contacto, payload.telefono, payload.email, payload.direccion,
              payload.esEmpresa, payload.idPersona, payload.estado, id))
        conn.commit()
        upd.close()
        cur.close()
        conn.close()

        return get_proveedor(id, x_user_role, request)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete('/proveedores/{id}', status_code=204)
def delete_proveedor(id: int, x_user_role: str = Header(None), request: Request = None):
    """Eliminar/desactivar proveedor."""
    role = get_role(x_user_role, request)
    if role not in ('admin', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)

        cur.execute('SELECT idProveedor, idEmpresa FROM proveedor_O WHERE idProveedor = %s', (id,))
        prov = cur.fetchone()
        if not prov:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Proveedor no encontrado')

        if role != 'superadmin' and user_company is not None and prov['idEmpresa'] != user_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')

        if role == 'superadmin':
            # Eliminar físicamente
            d = conn.cursor()
            d.execute('DELETE FROM proveedor_O WHERE idProveedor = %s', (id,))
            conn.commit()
            d.close()
        else:
            # Desactivar
            upd = conn.cursor()
            upd.execute('UPDATE proveedor_O SET estado = 0 WHERE idProveedor = %s', (id,))
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





