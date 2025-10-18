from fastapi import FastAPI, HTTPException, Request, Header, Response, APIRouter, UploadFile, File, Form, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from typing import List, Optional
import os
import mysql.connector
import jwt
from datetime import datetime, timedelta
import bcrypt
from fastapi.responses import JSONResponse

router = APIRouter()

app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
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
JWT_EXPIRE_MINUTES = int(os.getenv('JWT_EXPIRE_MINUTES', '60'))

# Uploads directory (for persona photos)
UPLOAD_DIR = os.getenv('UPLOAD_DIR', '/app/uploads')


class PersonaIn(BaseModel):
    nombres_persona: str = Field(..., max_length=50)
    apellido_paternoPersona: Optional[str] = Field(None, max_length=30)
    apellido_maternoPer: Optional[str] = Field(None, max_length=50)
    telefono_persona: Optional[str] = Field(None, max_length=15)
    id_tipoPersona: int = Field(...)
    ci_persona: str = Field(..., max_length=10)
    direccion_persona: str = Field(..., max_length=100)


class PersonaOut(BaseModel):
    id_persona: int
    nombres_persona: str
    apellido_paternoPersona: Optional[str] = None
    apellido_maternoPer: Optional[str] = None
    telefono_persona: Optional[str] = None
    id_tipoPersona: int
    ci_persona: str
    direccion_persona: str
    fotoPersona: Optional[str] = None


class EmpresaIn(BaseModel):
    nombre_empresa: str = Field(..., max_length=100)
    direccion_empresa: str = Field(..., max_length=100)
    estado_empresa: int = Field(default=1)
    id_persona: int


class EmpresaOut(BaseModel):
    id_empresa: int
    nombre_empresa: str
    direccion_empresa: str
    estado_empresa: int
    id_persona: int


class LoginIn(BaseModel):
    username: str
    password: Optional[str] = None


class RegisterIn(BaseModel):
    username: str
    password: str
    nombres_persona: Optional[str] = None
    ci_persona: Optional[str] = None


class UserUpdateIn(BaseModel):
    username: str
    password: Optional[str] = None
    id_persona: Optional[int] = None
    id_role: Optional[int] = None


class RolePermissionsIn(BaseModel):
    perm_ids: List[int] = []

# RBAC models
class RoleIn(BaseModel):
    name: str
    description: Optional[str] = None

class RoleOut(BaseModel):
    idrole: int
    name: str
    description: Optional[str] = None

class PermissionOut(BaseModel):
    id_perm: int
    resource: str
    action: str
    description: Optional[str] = None

class RolePermissionsIn(BaseModel):
    perm_ids: List[int]


def ensure_schema():
    """Ensure optional columns required by the service exist."""
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        # Check if profile_photo column exists in user_O
        cur.execute("""
            SELECT COUNT(1) AS cnt
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'user_O' AND COLUMN_NAME = 'profile_photo'
        """, (os.getenv('DATABASE_NAME', 'SystemaOllantay'),))
        row = cur.fetchone()
        if not row or row.get('cnt', 0) == 0:
            cur2 = conn.cursor()
            # Use LONGTEXT to store data URLs or image paths
            cur2.execute('ALTER TABLE user_O ADD COLUMN profile_photo LONGTEXT NULL')
            conn.commit()
            cur2.close()
        # Ensure persona_O.fotoPersona exists (VARCHAR(255) is enough for a relative path)
        cur.execute("""
            SELECT COUNT(1) AS cnt
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = %s AND TABLE_NAME = 'persona_O' AND COLUMN_NAME = 'fotoPersona'
        """, (os.getenv('DATABASE_NAME', 'SystemaOllantay'),))
        prow = cur.fetchone()
        if not prow or prow.get('cnt', 0) == 0:
            cur3 = conn.cursor()
            cur3.execute('ALTER TABLE persona_O ADD COLUMN fotoPersona VARCHAR(255) NULL')
            conn.commit()
            cur3.close()
        cur.close(); conn.close()
    except Exception:
        # Non-fatal on startup; logs can be added if necessary
        pass


@app.on_event('startup')
def _startup():
    ensure_schema()
    # Ensure uploads directory exists
    try:
        os.makedirs(UPLOAD_DIR, exist_ok=True)
    except Exception:
        pass

# Serve static uploads under /uploads (proxied as /api/personas/uploads via nginx)
app.mount('/uploads', StaticFiles(directory=UPLOAD_DIR), name='uploads')


def create_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=JWT_EXPIRE_MINUTES))
    to_encode.update({'exp': expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALG)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def get_permissions_for_role(role_name: str) -> list[str]:
    """Return list like ['module:action'] for a role name."""
    if not role_name:
        return []
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cur.execute('SELECT idrole FROM role_O WHERE name = %s', (role_name,))
        r = cur.fetchone()
        if not r:
            cur.close(); conn.close();
            return []
        cur.execute('SELECT p.resource, p.action FROM role_permission_O rp JOIN permission_O p ON rp.perm_id = p.id_perm WHERE rp.role_id = %s', (r['idrole'],))
        rows = cur.fetchall() or []
        cur.close(); conn.close()
        return [f"{x['resource']}:{x['action']}" for x in rows]
    except Exception:
        return []


@router.options('/auth/login')
def options_login():
    return Response(status_code=204)

@router.post('/auth/login')
async def login(request: Request):
    # Detectar tipo de contenido
    if request.headers.get('content-type', '').startswith('application/json'):
        body = await request.json()
        username = body.get('username')
        password = body.get('password')
    else:
        form = await request.form()
        username = form.get('username')
        password = form.get('password')
    if not username or not password:
        raise HTTPException(status_code=400, detail='Username y password requeridos')
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT u.id_user, u.username, u.password_hash, u.id_persona, u.profile_photo, r.name AS role_name FROM user_O u JOIN role_O r ON u.id_role = r.idrole WHERE u.username = %s', (username,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if not row:
            raise HTTPException(status_code=401, detail='Invalid credentials')
        if row.get('password_hash'):
            if not password or password != row.get('password_hash'):
                raise HTTPException(status_code=401, detail='Invalid credentials')
        token = create_token({'sub': row['id_user'], 'username': row['username'], 'role': row['role_name'], 'id_persona': row.get('id_persona')})
        perms = get_permissions_for_role(row['role_name'])
        photo_url = None
        try:
            if row.get('id_persona'):
                conn2 = get_db_connection(); cur2 = conn2.cursor(dictionary=True)
                cur2.execute('SELECT fotoPersona FROM persona_O WHERE id_persona = %s', (row.get('id_persona'),))
                pr = cur2.fetchone()
                rel = (pr or {}).get('fotoPersona')
                if rel:
                    photo_url = '/api/personas' + rel if rel.startswith('/uploads') else rel
                cur2.close(); conn2.close()
        except Exception:
            photo_url = None
        resp = JSONResponse(content={'username': row['username'], 'role': row['role_name'], 'id_persona': row.get('id_persona'), 'permissions': perms, 'profilePhoto': photo_url})
        resp.set_cookie('ollantay_token', token, httponly=True, samesite='lax', secure=False, path='/')
        return resp
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT u.id_user, u.username, u.password_hash, u.id_persona, u.profile_photo, r.name AS role_name FROM user_O u JOIN role_O r ON u.id_role = r.idrole WHERE u.username = %s', (payload.username,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if not row:
            raise HTTPException(status_code=401, detail='Invalid credentials')
        # naive password check: if password_hash is NULL accept login (seeded admin), otherwise compare plaintext (insecure - replace with hashed verify later)
        if row.get('password_hash'):
            if not payload.password or payload.password != row.get('password_hash'):
                raise HTTPException(status_code=401, detail='Invalid credentials')
        # create JWT and set as httpOnly cookie; include permissions in response for immediate UI gating
        token = create_token({'sub': row['id_user'], 'username': row['username'], 'role': row['role_name'], 'id_persona': row.get('id_persona')})
        perms = get_permissions_for_role(row['role_name'])
        # fetch fotoPersona for this user (if linked)
        photo_url = None
        try:
            if row.get('id_persona'):
                conn2 = get_db_connection(); cur2 = conn2.cursor(dictionary=True)
                cur2.execute('SELECT fotoPersona FROM persona_O WHERE id_persona = %s', (row.get('id_persona'),))
                pr = cur2.fetchone()
                rel = (pr or {}).get('fotoPersona')
                if rel:
                    # Build public URL under API prefix
                    photo_url = '/api/personas' + rel if rel.startswith('/uploads') else rel
                cur2.close(); conn2.close()
        except Exception:
            photo_url = None
        resp = JSONResponse(content={'username': row['username'], 'role': row['role_name'], 'id_persona': row.get('id_persona'), 'permissions': perms, 'profilePhoto': photo_url})
        # set cookie for session
        resp.set_cookie('ollantay_token', token, httponly=True, samesite='lax', secure=False, path='/')
        return resp
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# mount router endpoints
app.include_router(router)


@app.post('/auth/register', status_code=201)
def register(payload: UserUpdateIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    # Only admins can create users
    require_admin(x_user_role, request)
    # basic validation
    if not payload.username or not payload.password:
        raise HTTPException(status_code=400, detail='username and password required')
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # check username unique
        cursor.execute('SELECT id_user FROM user_O WHERE username = %s', (payload.username,))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail='username already exists')

        # Use provided id_persona and id_role
        id_persona = payload.id_persona
        id_role = payload.id_role
        
        # If no role specified, default to viewer
        if not id_role:
            cursor.execute('SELECT idrole FROM role_O WHERE name = %s', ('viewer',))
            role = cursor.fetchone()
            id_role = role['idrole'] if role else None

        pw_hash = hash_password(payload.password)
        curu = conn.cursor()
        curu.execute('INSERT INTO user_O (username, password_hash, id_persona, id_role) VALUES (%s,%s,%s,%s)', (payload.username, pw_hash, id_persona, id_role))
        conn.commit()
        new_user_id = curu.lastrowid
        curu.close()
        cursor.close()
        conn.close()
        return {'username': payload.username, 'id_user': new_user_id, 'id_persona': id_persona, 'id_role': id_role}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/persons', response_model=List[PersonaOut])
def list_persons(tipo: Optional[int] = None):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        if tipo is None:
            cursor.execute('SELECT id_persona, nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci_persona, direccion_persona, fotoPersona FROM persona_O')
            rows = cursor.fetchall()
        else:
            cursor.execute('SELECT id_persona, nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci_persona, direccion_persona, fotoPersona FROM persona_O WHERE id_tipoPersona = %s', (tipo,))
            rows = cursor.fetchall()
        cursor.close()
        conn.close()
        # Normalize fotoPersona to public URL via proxy
        for r in rows or []:
            fp = r.get('fotoPersona')
            if isinstance(fp, str) and fp.startswith('/uploads'):
                r['fotoPersona'] = '/api/personas' + fp
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/empresas')
def list_empresas(q: Optional[str] = None, id_persona: Optional[int] = None, offset: Optional[int] = 0, limit: Optional[int] = 100):
    return list_empresas_paginated(q=q, id_persona=id_persona, offset=offset, limit=limit)


def list_empresas_paginated(q: Optional[str] = None, id_persona: Optional[int] = None, offset: int = 0, limit: int = 100):
    # validate pagination bounds
    try:
        offset = int(offset)
        limit = int(limit)
    except Exception:
        raise HTTPException(status_code=400, detail='offset and limit must be integers')
    if offset < 0 or limit <= 0 or limit > 500:
        raise HTTPException(status_code=400, detail='invalid pagination parameters')
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        params = []
        where_clauses = []
        if q:
            like = f"%{q}%"
            where_clauses.append('(nombre_empresa LIKE %s OR direccion_empresa LIKE %s)')
            params.extend([like, like])
        if id_persona:
            where_clauses.append('id_persona = %s')
            params.append(id_persona)
        where_sql = (' WHERE ' + ' AND '.join(where_clauses)) if where_clauses else ''
        sql = f'SELECT id_empresa, nombre_empresa, direccion_empresa, estado_empresa, id_persona FROM empresa_O{where_sql} ORDER BY id_empresa DESC LIMIT %s OFFSET %s'
        params.extend([limit, offset])
        cursor.execute(sql, tuple(params))
        rows = cursor.fetchall()
        # count total for the same filter
        count_sql = f'SELECT COUNT(1) as total FROM empresa_O{where_sql}'
        cursor.execute(count_sql, tuple(params[:-2]))
        cnt = cursor.fetchone()
        total = cnt['total'] if cnt else 0
        cursor.close()
        conn.close()
        return {'items': rows, 'total': total, 'offset': offset, 'limit': limit}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/empresas/{id}', response_model=EmpresaOut)
def get_empresa(id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT id_empresa, nombre_empresa, direccion_empresa, estado_empresa, id_persona FROM empresa_O WHERE id_empresa = %s', (id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail='Empresa no encontrada')
        return row
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/empresas', response_model=EmpresaOut, status_code=201)
def create_empresa(payload: EmpresaIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ('admin','editor'):
        raise HTTPException(status_code=403, detail='Permission denied')
    # validation
    nombre = payload.nombre_empresa.strip()
    direccion = payload.direccion_empresa.strip()
    if not nombre or not direccion:
        raise HTTPException(status_code=400, detail='Campos requeridos faltantes')
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # check persona exists
        cursor.execute('SELECT id_persona FROM persona_O WHERE id_persona = %s', (payload.id_persona,))
        persona = cursor.fetchone()
        if not persona:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Persona no existe')
        cur2 = conn.cursor()
        cur2.execute('INSERT INTO empresa_O (nombre_empresa, direccion_empresa, estado_empresa, id_persona) VALUES (%s,%s,%s,%s)', (nombre, direccion, int(bool(payload.estado_empresa)), payload.id_persona))
        conn.commit()
        new_id = cur2.lastrowid
        cur2.close()
        cursor.close()
        conn.close()
        return {**payload.dict(), 'id_empresa': new_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/empresas/{id}', response_model=EmpresaOut)
def update_empresa(id: int, payload: EmpresaIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ('admin','editor'):
        raise HTTPException(status_code=403, detail='Permission denied')
    nombre = payload.nombre_empresa.strip()
    direccion = payload.direccion_empresa.strip()
    if not nombre or not direccion:
        raise HTTPException(status_code=400, detail='Campos requeridos faltantes')
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT id_empresa FROM empresa_O WHERE id_empresa = %s', (id,))
        exists = cursor.fetchone()
        if not exists:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Empresa no encontrada')
        # check persona exists
        cursor.execute('SELECT id_persona FROM persona_O WHERE id_persona = %s', (payload.id_persona,))
        persona = cursor.fetchone()
        if not persona:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Persona no existe')
        cur2 = conn.cursor()
        cur2.execute('UPDATE empresa_O SET nombre_empresa=%s, direccion_empresa=%s, estado_empresa=%s, id_persona=%s WHERE id_empresa=%s', (nombre, direccion, int(bool(payload.estado_empresa)), payload.id_persona, id))
        conn.commit()
        cur2.close()
        cursor.close()
        conn.close()
        return {**payload.dict(), 'id_empresa': id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete('/empresas/{id}', status_code=204)
def delete_empresa(id: int, x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role != 'admin':
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM empresa_O WHERE id_empresa = %s', (id,))
        conn.commit()
        affected = cursor.rowcount
        cursor.close()
        conn.close()
        if affected == 0:
            raise HTTPException(status_code=404, detail='Empresa no encontrada')
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/persons/{id}', response_model=PersonaOut)
def get_person(id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT id_persona, nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci_persona, direccion_persona, fotoPersona FROM persona_O WHERE id_persona = %s', (id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail='Persona no encontrada')
        # Normalize fotoPersona to public URL via proxy
        if isinstance(row.get('fotoPersona'), str) and row['fotoPersona'].startswith('/uploads'):
            row['fotoPersona'] = '/api/personas' + row['fotoPersona']
        return row
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def get_role(x_user_role: Optional[str] = Header(None), request: Request = None) -> str:
    """Resolve effective role for the request.
    Priority: X-User-Role header -> JWT cookie -> 'viewer'.
    """
    # 1) Prefer explicit header (useful for dev/local and testing tools)
    if x_user_role:
        return x_user_role.lower()
    # 2) Try cookie-based JWT
    try:
        if request is not None:
            token = request.cookies.get('ollantay_token')
            if token:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
                role = (payload.get('role') or 'viewer').lower()
                if role:
                    return role
    except Exception:
        pass
    # 3) Default viewer
    return 'viewer'

def require_admin(x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role != 'admin':
        raise HTTPException(status_code=403, detail=f'Admin required (role={role})')
    return role


@app.get('/auth/me')
def auth_me(request: Request):
    token = request.cookies.get('ollantay_token')
    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        # fetch permissions for this role
        perms = get_permissions_for_role(payload.get('role'))
        # fetch fotoPersona from persona_O and return as public URL
        profile_photo = None
        try:
            if payload.get('id_persona'):
                conn = get_db_connection(); cur = conn.cursor(dictionary=True)
                cur.execute('SELECT fotoPersona FROM persona_O WHERE id_persona = %s', (payload.get('id_persona'),))
                r = cur.fetchone(); rel = (r or {}).get('fotoPersona')
                if rel:
                    profile_photo = '/api/personas' + rel if rel.startswith('/uploads') else rel
                cur.close(); conn.close()
        except Exception:
            profile_photo = None
        return {'username': payload.get('username'), 'role': payload.get('role'), 'sub': payload.get('sub'), 'id_persona': payload.get('id_persona'), 'permissions': perms, 'profilePhoto': profile_photo}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except Exception:
        raise HTTPException(status_code=401, detail='Invalid token')

@app.post('/auth/logout')
def auth_logout():
    resp = JSONResponse(content={'ok': True})
    resp.delete_cookie('ollantay_token', path='/')
    return resp


class PhotoIn(BaseModel):
    photo: str  # Can be a data URL; server will write file and store relative path in persona_O


@app.post('/users/me/photo')
async def upload_my_photo(request: Request, x_user_role: Optional[str] = Header(None)):
    """Accepts either JSON {photo: dataURL} or multipart 'file'. Saves to /uploads and stores relative path in persona_O.fotoPersona."""
    # authenticate via cookie
    token = request.cookies.get('ollantay_token')
    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload.get('sub')
        if not user_id:
            raise HTTPException(status_code=401, detail='Invalid token')
        content_type = request.headers.get('content-type','')
        photo_bytes: Optional[bytes] = None
        file_ext: str = 'png'
        if 'application/json' in content_type:
            body = await request.json()
            data_url = body.get('photo')
            if isinstance(data_url, str) and data_url.startswith('data:') and ';base64,' in data_url:
                header, b64 = data_url.split(';base64,', 1)
                # try to detect extension
                if header.startswith('data:image/'):
                    file_ext = header[len('data:image/'):].split(';')[0].split('/')[0]
                    if file_ext == 'jpeg':
                        file_ext = 'jpg'
                import base64
                try:
                    photo_bytes = base64.b64decode(b64)
                except Exception:
                    photo_bytes = None
        else:
            try:
                form = await request.form()
                file = form.get('file')
                if file and hasattr(file, 'read'):
                    photo_bytes = await file.read()
                    filename = getattr(file, 'filename', 'upload')
                    file_ext = (filename.rsplit('.', 1)[-1] if '.' in filename else 'png').lower()
            except Exception:
                photo_bytes = None
        if not photo_bytes:
            raise HTTPException(status_code=400, detail='No photo provided')
        # Persist to filesystem
        safe_ext = file_ext if file_ext in ('png','jpg','jpeg','gif','webp') else 'png'
        filename = f"user_{user_id}_{int(datetime.utcnow().timestamp())}.{ 'jpg' if safe_ext=='jpeg' else safe_ext }"
        try:
            os.makedirs(UPLOAD_DIR, exist_ok=True)
            path = os.path.join(UPLOAD_DIR, filename)
            with open(path, 'wb') as f:
                f.write(photo_bytes)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f'Failed to write file: {e}')
        rel_path = f"/uploads/{filename}"
        # update persona_O.fotoPersona
        try:
            # need id_persona to update persona record
            conn = get_db_connection(); cur = conn.cursor(dictionary=True)
            cur.execute('SELECT id_persona FROM user_O WHERE id_user = %s', (user_id,))
            ur = cur.fetchone()
            idp = (ur or {}).get('id_persona')
            if not idp:
                cur.close(); conn.close()
                raise HTTPException(status_code=400, detail='User is not linked to a persona')
            cur2 = conn.cursor()
            cur2.execute('UPDATE persona_O SET fotoPersona=%s WHERE id_persona=%s', (rel_path, idp))
            conn.commit(); cur.close(); conn.close()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        public_url = '/api/personas' + rel_path
        return {'ok': True, 'profilePhoto': public_url, 'path': rel_path}
    except HTTPException:
        raise
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except Exception:
        raise HTTPException(status_code=401, detail='Invalid token')


@app.post('/persons', response_model=PersonaOut, status_code=201)
@app.post('/persons', response_model=PersonaOut, status_code=201)
async def create_person(
    nombres_persona: str = Form(...),
    apellido_paternoPersona: Optional[str] = Form(None),
    apellido_maternoPer: Optional[str] = Form(None),
    telefono_persona: Optional[str] = Form(None),
    id_tipoPersona: int = Form(...),
    ci_persona: str = Form(...),
    direccion_persona: str = Form(...),
    foto: Optional[UploadFile] = File(None),
    x_user_role: Optional[str] = Header(None),
    request: Request = None
):
    role = get_role(x_user_role, request)
    if role not in ('admin','editor'):
        raise HTTPException(status_code=403, detail='Permission denied')
    nombres = nombres_persona.strip()
    ci = ci_persona.strip()
    direccion = direccion_persona.strip()
    if not nombres or not ci or not direccion:
        raise HTTPException(status_code=400, detail='Campos requeridos faltantes')
    foto_path = None
    if foto:
        ext = (foto.filename.rsplit('.', 1)[-1] if '.' in foto.filename else 'png').lower()
        safe_ext = ext if ext in ('png','jpg','jpeg','gif','webp') else 'png'
        filename = f"persona_{ci}_{int(datetime.utcnow().timestamp())}.{ 'jpg' if safe_ext=='jpeg' else safe_ext }"
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        path = os.path.join(UPLOAD_DIR, filename)
        with open(path, 'wb') as f:
            f.write(await foto.read())
        foto_path = f"/uploads/{filename}"
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT idtipoPers FROM tipo_personaO WHERE idtipoPers = %s', (id_tipoPersona,))
        tipo = cursor.fetchone()
        if not tipo:
            cursor.close(); conn.close()
            raise HTTPException(status_code=400, detail='TipoPersona no existe')
        cursor.execute('SELECT id_persona FROM persona_O WHERE ci_persona = %s', (ci,))
        exists = cursor.fetchone()
        if exists:
            cursor.close(); conn.close()
            raise HTTPException(status_code=400, detail='CI ya registrado')
        cur2 = conn.cursor()
        cur2.execute('INSERT INTO persona_O (nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci_persona, direccion_persona, fotoPersona) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)',
            (nombres, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci, direccion, foto_path))
        conn.commit()
        new_id = cur2.lastrowid
        cur2.close(); cursor.close(); conn.close()
        return {
            'id_persona': new_id,
            'nombres_persona': nombres,
            'apellido_paternoPersona': apellido_paternoPersona,
            'apellido_maternoPer': apellido_maternoPer,
            'telefono_persona': telefono_persona,
            'id_tipoPersona': id_tipoPersona,
            'ci_persona': ci,
            'direccion_persona': direccion,
            'fotoPersona': foto_path
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    role = get_role(x_user_role, request)
    if role not in ('admin','editor'):
        raise HTTPException(status_code=403, detail='Permission denied')
    # basic validation
    nombres = payload.nombres_persona.strip()
    ci = payload.ci_persona.strip()
    direccion = payload.direccion_persona.strip()
    if not nombres or not ci or not direccion:
        raise HTTPException(status_code=400, detail='Campos requeridos faltantes')
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # check tipo exists
        cursor.execute('SELECT idtipoPers FROM tipo_personaO WHERE idtipoPers = %s', (payload.id_tipoPersona,))
        tipo = cursor.fetchone()
        if not tipo:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail='TipoPersona no existe')
        # check unique ci
        cursor.execute('SELECT id_persona FROM persona_O WHERE ci_persona = %s', (ci,))
        exists = cursor.fetchone()
        if exists:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail='CI ya registrado')
        # insert
        cur2 = conn.cursor()
        cur2.execute('INSERT INTO persona_O (nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci_persona, direccion_persona) VALUES (%s,%s,%s,%s,%s,%s,%s)',
                     (nombres, payload.apellido_paternoPersona, payload.apellido_maternoPer, payload.telefono_persona, payload.id_tipoPersona, ci, direccion))
        conn.commit()
        new_id = cur2.lastrowid
        cur2.close()
        cursor.close()
        conn.close()
        return {**payload.dict(), 'id_persona': new_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/persons/{id}', response_model=PersonaOut)
@app.put('/persons/{id}', response_model=PersonaOut)
async def update_person(
    id: int,
    nombres_persona: str = Form(...),
    apellido_paternoPersona: Optional[str] = Form(None),
    apellido_maternoPer: Optional[str] = Form(None),
    telefono_persona: Optional[str] = Form(None),
    id_tipoPersona: int = Form(...),
    ci_persona: str = Form(...),
    direccion_persona: str = Form(...),
    foto: Optional[UploadFile] = File(None),
    x_user_role: Optional[str] = Header(None),
    request: Request = None
):
    role = get_role(x_user_role, request)
    if role not in ('admin','editor'):
        raise HTTPException(status_code=403, detail='Permission denied')
    nombres = nombres_persona.strip()
    ci = ci_persona.strip()
    direccion = direccion_persona.strip()
    if not nombres or not ci or not direccion:
        raise HTTPException(status_code=400, detail='Campos requeridos faltantes')
    foto_path = None
    if foto:
        ext = (foto.filename.rsplit('.', 1)[-1] if '.' in foto.filename else 'png').lower()
        safe_ext = ext if ext in ('png','jpg','jpeg','gif','webp') else 'png'
        filename = f"persona_{ci}_{int(datetime.utcnow().timestamp())}.{ 'jpg' if safe_ext=='jpeg' else safe_ext }"
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        path = os.path.join(UPLOAD_DIR, filename)
        with open(path, 'wb') as f:
            f.write(await foto.read())
        foto_path = f"/uploads/{filename}"
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT id_persona FROM persona_O WHERE id_persona = %s', (id,))
        exists_person = cursor.fetchone()
        if not exists_person:
            cursor.close(); conn.close()
            raise HTTPException(status_code=404, detail='Persona no encontrada')
        cursor.execute('SELECT idtipoPers FROM tipo_personaO WHERE idtipoPers = %s', (id_tipoPersona,))
        tipo = cursor.fetchone()
        if not tipo:
            cursor.close(); conn.close()
            raise HTTPException(status_code=400, detail='TipoPersona no existe')
        cur2 = conn.cursor()
        update_sql = 'UPDATE persona_O SET nombres_persona=%s, apellido_paternoPersona=%s, apellido_maternoPer=%s, telefono_persona=%s, id_tipoPersona=%s, ci_persona=%s, direccion_persona=%s'
        params = [nombres, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci, direccion]
        if foto_path:
            update_sql += ', fotoPersona=%s'
            params.append(foto_path)
        update_sql += ' WHERE id_persona=%s'
        params.append(id)
        cur2.execute(update_sql, tuple(params))
        conn.commit()
        cur2.close(); cursor.close(); conn.close()
        return {
            'id_persona': id,
            'nombres_persona': nombres,
            'apellido_paternoPersona': apellido_paternoPersona,
            'apellido_maternoPer': apellido_maternoPer,
            'telefono_persona': telefono_persona,
            'id_tipoPersona': id_tipoPersona,
            'ci_persona': ci,
            'direccion_persona': direccion,
            'fotoPersona': foto_path
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
        tipo = cursor.fetchone()
        if not tipo:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail='TipoPersona no existe')
        # check unique ci excluding current id
        cursor.execute('SELECT id_persona FROM persona_O WHERE ci_persona = %s AND id_persona <> %s', (ci, id))
        dup = cursor.fetchone()
        if dup:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail='CI ya registrado')
        # update
        cur2 = conn.cursor()
        cur2.execute('UPDATE persona_O SET nombres_persona=%s, apellido_paternoPersona=%s, apellido_maternoPer=%s, telefono_persona=%s, id_tipoPersona=%s, ci_persona=%s, direccion_persona=%s WHERE id_persona=%s',
                     (nombres, payload.apellido_paternoPersona, payload.apellido_maternoPer, payload.telefono_persona, payload.id_tipoPersona, ci, direccion, id))
        conn.commit()
        cur2.close()
        cursor.close()
        conn.close()
        return {**payload.dict(), 'id_persona': id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete('/persons/{id}', status_code=204)
async def create_person(
    nombres_persona: str = Form(...),
    apellido_paternoPersona: str = Form(...),
    apellido_maternoPer: str = Form(...),
    telefono_persona: str = Form(...),
    id_tipoPersona: int = Form(...),
    ci_persona: str = Form(...),
    direccion_persona: str = Form(...),
    foto: UploadFile = File(None),
    x_user_role: Optional[str] = Header(None),
    request: Request = None
):
    role = get_role(x_user_role, request)
    if role != 'admin':
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM persona_O WHERE id_persona = %s', (id,))
        conn.commit()
        affected = cursor.rowcount
        cursor.close()
        conn.close()
        if affected == 0:
            raise HTTPException(status_code=404, detail='Persona no encontrada')
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/health')
def health():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT 1')
        cursor.fetchone()
        cursor.close()
        conn.close()
        return {'status': 'ok', 'db': 'connected'}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f'db error: {e}')


# ========================
# RBAC: roles & permissions
# ========================

@app.get('/roles')
def list_roles(x_user_role: Optional[str] = Header(None), request: Request = None):
    require_admin(x_user_role, request)
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT idrole, name, description FROM role_O ORDER BY idrole')
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/roles', status_code=201)
def create_role(payload, x_user_role: Optional[str] = Header(None), request: Request = None):
    require_admin(x_user_role, request)
    name = payload.name.strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail='name required')
    if name in ('admin','editor','viewer'):
        raise HTTPException(status_code=400, detail='Cannot create a built-in role')
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT idrole FROM role_O WHERE name = %s', (name,))
        if cur.fetchone():
            cur.close(); conn.close()
            raise HTTPException(status_code=400, detail='Role name already exists')
        ins = conn.cursor()
        ins.execute('INSERT INTO role_O (name, description) VALUES (%s,%s)', (name, payload.description))
        conn.commit(); new_id = ins.lastrowid
        ins.close(); cur.close(); conn.close()
        return {'idrole': new_id, 'name': name, 'description': payload.description}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/roles/{id}')
async def update_person(
    id: int,
    nombres_persona: str = Form(...),
    apellido_paternoPersona: str = Form(...),
    apellido_maternoPer: str = Form(...),
    telefono_persona: str = Form(...),
    id_tipoPersona: int = Form(...),
    ci_persona: str = Form(...),
    direccion_persona: str = Form(...),
    foto: UploadFile = File(None),
    x_user_role: Optional[str] = Header(None),
    request: Request = None
):
    require_admin(x_user_role, request)
    name = payload.get('name', '').strip().lower() if isinstance(payload, dict) else getattr(payload, 'name', '').strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail='name required')
    if name in ('admin','editor','viewer') and id not in (1,2,3):
        raise HTTPException(status_code=400, detail='Reserved role name')
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT idrole, name FROM role_O WHERE idrole = %s', (id,))
        ex = cur.fetchone()
        if not ex:
            cur.close(); conn.close();
            raise HTTPException(status_code=404, detail='Role not found')
        if ex['name'] in ('admin','editor','viewer') and ex['name'] != name:
            cur.close(); conn.close();
            raise HTTPException(status_code=400, detail='Cannot rename built-in role')
        cur.execute('UPDATE role_O SET name=%s, description=%s WHERE idrole=%s', (name, payload.get('description') if isinstance(payload, dict) else getattr(payload, 'description', None), id))
        conn.commit(); cur.close(); conn.close()
        return {'idrole': id, 'name': name, 'description': payload.get('description') if isinstance(payload, dict) else getattr(payload, 'description', None)}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    if name in ('admin','editor','viewer') and id not in (1,2,3):
        # do not allow renaming some other id to built-in names
        raise HTTPException(status_code=400, detail='Reserved role name')
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT idrole, name FROM role_O WHERE idrole = %s', (id,))
        ex = cur.fetchone()
        if not ex:
            cur.close(); conn.close();
            raise HTTPException(status_code=404, detail='Role not found')
        if ex['name'] in ('admin','editor','viewer') and ex['name'] != name:
            cur.close(); conn.close();
            raise HTTPException(status_code=400, detail='Cannot rename built-in role')
        # unique name check
        cur.execute('SELECT idrole FROM role_O WHERE name = %s AND idrole <> %s', (name, id))
        if cur.fetchone():
            cur.close(); conn.close();
            raise HTTPException(status_code=400, detail='Role name already exists')
        up = conn.cursor()
        up.execute('UPDATE role_O SET name=%s, description=%s WHERE idrole=%s', (name, payload.description, id))
        conn.commit(); up.close(); cur.close(); conn.close()
        return {'idrole': id, 'name': name, 'description': payload.description}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete('/roles/{id}', status_code=204)
def delete_role(id, x_user_role: Optional[str] = Header(None), request: Request = None):
    require_admin(x_user_role, request)
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT name FROM role_O WHERE idrole = %s', (id,))
        r = cur.fetchone()
        if not r:
            cur.close(); conn.close();
            raise HTTPException(status_code=404, detail='Role not found')
        if r['name'] in ('admin','editor','viewer'):
            cur.close(); conn.close();
            raise HTTPException(status_code=400, detail='Cannot delete built-in role')
        # check assigned users
        cur.execute('SELECT COUNT(1) AS cnt FROM user_O WHERE id_role = %s', (id,))
        cnt = cur.fetchone()
        if cnt and cnt['cnt'] > 0:
            cur.close(); conn.close();
            raise HTTPException(status_code=400, detail='Role has assigned users')
        # delete mapping then role
        d1 = conn.cursor(); d1.execute('DELETE FROM role_permission_O WHERE role_id = %s', (id,)); d1.close()
        d2 = conn.cursor(); d2.execute('DELETE FROM role_O WHERE idrole = %s', (id,)); conn.commit(); d2.close();
        cur.close(); conn.close();
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/permissions')
def list_permissions(x_user_role: Optional[str] = Header(None), request: Request = None):
    require_admin(x_user_role, request)
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT id_perm, resource, action, description FROM permission_O ORDER BY resource, action')
        rows = cur.fetchall(); cur.close(); conn.close();
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/roles/{id}/permissions')
def get_role_permissions(id, x_user_role: Optional[str] = Header(None), request: Request = None):
    require_admin(x_user_role, request)
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cur.execute('SELECT perm_id FROM role_permission_O WHERE role_id = %s', (id,))
        rows = cur.fetchall(); cur.close(); conn.close();
        return [r['perm_id'] for r in rows]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/roles/{id}/permissions', status_code=204)
def set_role_permissions(id, payload: RolePermissionsIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    require_admin(x_user_role, request)
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        # basic checks
        cur.execute('SELECT name FROM role_O WHERE idrole = %s', (id,))
        r = cur.fetchone()
        if not r:
            cur.close(); conn.close();
            raise HTTPException(status_code=404, detail='Role not found')
        if r['name'] == 'admin':
            cur.close(); conn.close();
            raise HTTPException(status_code=400, detail='Cannot modify admin permissions')
        # replace mapping
        d = conn.cursor(); d.execute('DELETE FROM role_permission_O WHERE role_id = %s', (id,)); d.close()
        if payload.perm_ids:
            ins = conn.cursor()
            values = [(id, pid) for pid in payload.perm_ids]
            ins.executemany('INSERT INTO role_permission_O (role_id, perm_id) VALUES (%s,%s)', values)
            ins.close()
        conn.commit(); cur.close(); conn.close();
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# User management endpoints
@app.get('/users')
def list_users(x_user_role: Optional[str] = Header(None), request: Request = None):
    require_admin(x_user_role, request)
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT id_user, username, id_persona, id_role FROM user_O ORDER BY id_user')
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/users/{id}')
def update_user(id: int, payload: UserUpdateIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    require_admin(x_user_role, request)
    if not payload.username:
        raise HTTPException(status_code=400, detail='username required')
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # check exists
        cursor.execute('SELECT id_user FROM user_O WHERE id_user = %s', (id,))
        if not cursor.fetchone():
            cursor.close()
            conn.close()
            raise HTTPException(status_code=404, detail='User not found')
        # check username unique (excluding current user)
        cursor.execute('SELECT id_user FROM user_O WHERE username = %s AND id_user <> %s', (payload.username, id))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail='username already exists')
        
        # Update fields
        if payload.password:
            pw_hash = hash_password(payload.password)
            cursor.execute('UPDATE user_O SET username=%s, password_hash=%s, id_persona=%s, id_role=%s WHERE id_user=%s',
                          (payload.username, pw_hash, payload.id_persona, payload.id_role, id))
        else:
            # Don't update password if not provided
            cursor.execute('UPDATE user_O SET username=%s, id_persona=%s, id_role=%s WHERE id_user=%s',
                          (payload.username, payload.id_persona, payload.id_role, id))
        conn.commit()
        cursor.close()
        conn.close()
        return {'username': payload.username, 'id_user': id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete('/users/{id}', status_code=204)
def delete_user(id: int, x_user_role: Optional[str] = Header(None), request: Request = None):
    require_admin(x_user_role, request)
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM user_O WHERE id_user = %s', (id,))
        conn.commit()
        affected = cursor.rowcount
        cursor.close()
        conn.close()
        if affected == 0:
            raise HTTPException(status_code=404, detail='User not found')
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
