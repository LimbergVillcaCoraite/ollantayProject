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


def has_permission(request: Request, resource: str, action: str) -> bool:
    """Check if current user's role has a specific permission for the current company.

    Permissions are stored in role_permission_O and permission_O tables.
    Superadmin always has all permissions.
    For company-scoped roles, permission applies when rp.id_empresa equals the user's company or is NULL (global).
    """
    try:
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
            ''', (r['idrole'], resource, action, company_id))
        else:
            cur.execute('''
                SELECT 1
                FROM role_permission_O rp
                JOIN permission_O p ON rp.perm_id = p.id_perm
                WHERE rp.role_id = %s AND p.resource = %s AND p.action = %s
                  AND rp.id_empresa IS NULL
                LIMIT 1
            ''', (r['idrole'], resource, action))
        row = cur.fetchone()
        cur.close(); conn.close()
        return bool(row)
    except Exception:
        return False


# ========================
# Modelos para Proveedores
# ========================

class ProveedorIn(BaseModel):
    nombreComercial: str = Field(..., max_length=100)
    contacto: Optional[str] = Field(None, max_length=100)
    telefono: Optional[str] = Field(None, max_length=15)
    email: Optional[str] = Field(None, max_length=100)
    direccion: Optional[str] = Field(None, max_length=200)
    esEmpresa: int = Field(..., ge=0, le=1)  # 1=empresa, 0=persona (consistente con frontend y DB)
    idPersona: Optional[int] = None  # Si esEmpresa=0, referencia a persona_O.id_persona
    # Para superadmin: permitir especificar empresa destino explícitamente
    idEmpresaProveedor: Optional[int] = None
    estado: int = Field(default=1, ge=0, le=1)


class ProveedorOut(ProveedorIn):
    idProveedor: int
    idEmpresaProveedor: int
    nombreEmpresa: Optional[str] = None
    codigoProveedor: Optional[str] = None


# ========================
# Endpoints de Proveedores
# ========================

@app.get('/proveedores', response_model=List[ProveedorOut])
def list_proveedores(
    q: Optional[str] = None,
    esEmpresa: Optional[int] = None,
    estado: Optional[int] = None,
    offset: int = 0,
    limit: int = 100,
    x_user_role: str = Header(None),
    request: Request = None
):
    """Listar proveedores. Superadmin ve todos, admin solo de su empresa."""
    # Authorization: view permission or default roles admin/editor/superadmin
    role = get_role(x_user_role, request)
    if role not in ('admin', 'editor', 'superadmin') and not has_permission(request, 'proveedores', 'view'):
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        role = get_role(x_user_role, request)
        user_company = get_company_id_from_request(request)

        query = '''
            SELECT 
                p.idProveedor, p.nombreComercial, p.codigoProveedor, p.contacto, p.telefono,
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
        if esEmpresa is not None:
            where.append('p.esEmpresa = %s')
            params.append(int(esEmpresa))
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
                p.idProveedor, p.nombreComercial, p.codigoProveedor, p.contacto, p.telefono,
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
        if role != 'superadmin' and user_company is not None and prov['idEmpresaProveedor'] != user_company:
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
    """Crear proveedor.
    
    Reglas de negocio:
    - Empresa (esEmpresa=1): Requiere idEmpresaProveedor, NO debe tener idPersona
    - Persona (esEmpresa=0): Requiere idPersona, idEmpresaProveedor se obtiene de persona_O.id_empresa
    - Superadmin puede crear proveedores para cualquier empresa
    - Admin/Editor solo pueden crear proveedores para su propia empresa
    """
    role = get_role(x_user_role, request)
    if role not in ('admin', 'editor', 'superadmin') and not has_permission(request, 'proveedores', 'create'):
        raise HTTPException(status_code=403, detail='Permission denied')

    nombre = payload.nombreComercial.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail='nombreComercial requerido')

    # esEmpresa debe ser 0 (Persona) o 1 (Empresa)
    if payload.esEmpresa not in (0, 1):
        raise HTTPException(status_code=400, detail='esEmpresa debe ser 0 (Persona) o 1 (Empresa)')

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        user_company = get_company_id_from_request(request)
        
        # Validar que no exista otro proveedor con el mismo nombre (case-insensitive)
        cur.execute('SELECT idProveedor FROM proveedor_O WHERE LOWER(nombreComercial) = LOWER(%s) AND estado = 1', (nombre,))
        existing = cur.fetchone()
        if existing:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail=f'Ya existe un proveedor activo con el nombre "{nombre}"')
        
        # Determinar empresa objetivo y validar según tipo de proveedor
        if payload.esEmpresa == 1:  # EMPRESA
            # Proveedor tipo EMPRESA
            if role == 'superadmin':
                # Superadmin puede especificar empresa explícitamente vía payload.idEmpresaProveedor
                if payload.idEmpresaProveedor is not None:
                    # Validar que la empresa exista
                    cur.execute('SELECT id_empresa FROM empresa_O WHERE id_empresa = %s', (payload.idEmpresaProveedor,))
                    emp = cur.fetchone()
                    if not emp:
                        cur.close(); conn.close()
                        raise HTTPException(status_code=400, detail='Empresa especificada no existe')
                    target_company = int(payload.idEmpresaProveedor)
                elif user_company is not None:
                    target_company = user_company
                else:
                    cur.close(); conn.close()
                    raise HTTPException(status_code=400, detail='Superadmin debe especificar empresa (idEmpresaProveedor)')
            else:
                # Admin/Editor: usar su empresa
                if user_company is None:
                    cur.close()
                    conn.close()
                    raise HTTPException(status_code=400, detail='Usuario sin empresa asignada')
                target_company = user_company
            
            # Validar que idPersona NO esté presente para tipo empresa
            if payload.idPersona is not None:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='Proveedor tipo Empresa no debe tener idPersona')
            
            id_persona_final = None
            
        else:  # PERSONA (esEmpresa == 0)
            # Proveedor tipo PERSONA: debe tener idPersona
            if not payload.idPersona:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='idPersona requerido para proveedor tipo Persona')
            
            # Obtener empresa de la persona
            cur.execute('SELECT id_persona, id_empresa FROM persona_O WHERE id_persona = %s', (payload.idPersona,))
            pers = cur.fetchone()
            if not pers:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='Persona no existe')
            
            if not pers['id_empresa']:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='Persona no tiene empresa asignada')
            
            # Para admin/editor: validar que la persona pertenece a su empresa
            if role != 'superadmin' and user_company is not None and pers['id_empresa'] != user_company:
                cur.close()
                conn.close()
                raise HTTPException(status_code=403, detail='Persona no pertenece a su empresa')
            
            target_company = pers['id_empresa']
            id_persona_final = payload.idPersona

        # Generar codigoProveedor: EMPRESA-PRV-YYYY-MM-DD-NNN (por empresa destino)
        cur.execute('SELECT nombre_empresa FROM empresa_O WHERE id_empresa = %s', (target_company,))
        emp = cur.fetchone() or {}
        nombre_empresa = (emp.get('nombre_empresa') or '').upper()
        empresa_slug = ''.join(ch for ch in nombre_empresa if ch.isalnum())
        from datetime import datetime
        today = datetime.utcnow()
        y, m, d = today.strftime('%Y'), today.strftime('%m'), today.strftime('%d')
        abbr = 'PRV'
        prefix = f"{empresa_slug}-{abbr}-{y}-{m}-{d}-"
        cur.execute('''
            SELECT MAX(CAST(SUBSTRING_INDEX(codigoProveedor, '-', -1) AS UNSIGNED)) AS max_seq
            FROM proveedor_O
            WHERE codigoProveedor LIKE %s
        ''', (prefix + '%',))
        row = cur.fetchone() or {}
        next_seq = int(row.get('max_seq') or 0) + 1
        codigo = f"{prefix}{next_seq:03d}"

        # Insertar proveedor con código
        ins = conn.cursor()
        ins.execute('''
            INSERT INTO proveedor_O (nombreComercial, codigoProveedor, contacto, telefono, email, direccion, esEmpresa, idPersona, estado, idEmpresaProveedor)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (nombre, codigo, payload.contacto, payload.telefono, payload.email, payload.direccion, 
              payload.esEmpresa, id_persona_final, payload.estado, target_company))
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
    """Actualizar proveedor.
    
    Reglas de negocio:
    - Empresa (esEmpresa=1): Debe tener idEmpresaProveedor, NO debe tener idPersona
    - Persona (esEmpresa=0): Debe tener idPersona, idEmpresaProveedor se hereda de persona_O
    - No se puede cambiar el tipo de proveedor (empresa <-> persona)
    - Admin/Editor solo pueden editar proveedores de su empresa
    """
    role = get_role(x_user_role, request)
    if role not in ('admin', 'editor', 'superadmin') and not has_permission(request, 'proveedores', 'edit'):
        raise HTTPException(status_code=403, detail='Permission denied')

    nombre = payload.nombreComercial.strip()
    if not nombre:
        raise HTTPException(status_code=400, detail='nombreComercial requerido')

    if payload.esEmpresa not in (0, 1):
        raise HTTPException(status_code=400, detail='esEmpresa debe ser 0 (Persona) o 1 (Empresa)')

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)

        # Verificar existencia y scoping
        cur.execute('SELECT idProveedor, idEmpresaProveedor, esEmpresa FROM proveedor_O WHERE idProveedor = %s', (id,))
        prov = cur.fetchone()
        if not prov:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Proveedor no encontrado')

        if role != 'superadmin' and user_company is not None and prov['idEmpresaProveedor'] != user_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No autorizado para editar este proveedor')

        # Validar que no exista otro proveedor con el mismo nombre (case-insensitive) excepto el actual
        cur.execute('SELECT idProveedor FROM proveedor_O WHERE LOWER(nombreComercial) = LOWER(%s) AND idProveedor != %s AND estado = 1', (nombre, id))
        existing = cur.fetchone()
        if existing:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail=f'Ya existe otro proveedor activo con el nombre "{nombre}"')

        # Validar que no se cambie el tipo de proveedor
        if prov['esEmpresa'] != payload.esEmpresa:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='No se puede cambiar el tipo de proveedor (Empresa <-> Persona)')

        # Validar según tipo
        if payload.esEmpresa == 1:  # EMPRESA
            if payload.idPersona is not None:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='Proveedor tipo Empresa no debe tener idPersona')
            id_persona_final = None
        else:  # PERSONA
            if not payload.idPersona:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='idPersona requerido para tipo Persona')
            
            # Validar que la persona existe
            cur.execute('SELECT id_persona, id_empresa FROM persona_O WHERE id_persona = %s', (payload.idPersona,))
            pers = cur.fetchone()
            if not pers:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='Persona no existe')
            
            # Validar permisos sobre la persona
            if role != 'superadmin' and user_company is not None and pers['id_empresa'] != user_company:
                cur.close()
                conn.close()
                raise HTTPException(status_code=403, detail='Persona no pertenece a su empresa')
            
            id_persona_final = payload.idPersona

        # Actualizar
        upd = conn.cursor()
        upd.execute('''
            UPDATE proveedor_O 
            SET nombreComercial=%s, contacto=%s, telefono=%s, email=%s, direccion=%s,
                esEmpresa=%s, idPersona=%s, estado=%s
            WHERE idProveedor=%s
        ''', (nombre, payload.contacto, payload.telefono, payload.email, payload.direccion,
              payload.esEmpresa, id_persona_final, payload.estado, id))
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
    if role not in ('admin', 'superadmin') and not has_permission(request, 'proveedores', 'delete'):
        raise HTTPException(status_code=403, detail='Permission denied')

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)

        cur.execute('SELECT idProveedor, idEmpresaProveedor FROM proveedor_O WHERE idProveedor = %s', (id,))
        prov = cur.fetchone()
        if not prov:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Proveedor no encontrado')

        if role != 'superadmin' and user_company is not None and prov['idEmpresaProveedor'] != user_company:
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





