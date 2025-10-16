from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from fastapi import Header, Response
from pydantic import BaseModel
import os
import mysql.connector
import jwt
from datetime import datetime, timedelta
import bcrypt
from fastapi.responses import JSONResponse

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


class PersonaIn(BaseModel):
    nombres_persona: str = Field(..., max_length=50)
    apellido_paternoPersona: str | None = Field(None, max_length=30)
    apellido_maternoPer: str | None = Field(None, max_length=50)
    telefono_persona: str | None = Field(None, max_length=15)
    id_tipoPersona: int = Field(...)
    ci_persona: str = Field(..., max_length=10)
    direccion_persona: str = Field(..., max_length=100)


class PersonaOut(PersonaIn):
    id_persona: int


class EmpresaIn(BaseModel):
    nombre_empresa: str = Field(..., max_length=100)
    direccion_empresa: str = Field(..., max_length=100)
    estado_empresa: int = Field(1)
    id_persona: int


class EmpresaOut(EmpresaIn):
    id_empresa: int


class LoginIn(BaseModel):
    username: str
    password: str | None = None


class RegisterIn(BaseModel):
    username: str
    password: str
    nombres_persona: str | None = None
    ci_persona: str | None = None


def create_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=JWT_EXPIRE_MINUTES))
    to_encode.update({'exp': expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALG)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


@app.post('/auth/login')
def login(payload: LoginIn):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT u.id_user, u.username, u.password_hash, u.id_persona, r.name AS role_name FROM user_O u JOIN role_O r ON u.id_role = r.idrole WHERE u.username = %s', (payload.username,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if not row:
            raise HTTPException(status_code=401, detail='Invalid credentials')
        # naive password check: if password_hash is NULL accept login (seeded admin), otherwise compare plaintext (insecure - replace with hashed verify later)
        if row.get('password_hash'):
            if not payload.password or payload.password != row.get('password_hash'):
                raise HTTPException(status_code=401, detail='Invalid credentials')
        # create JWT and set as httpOnly cookie
        token = create_token({'sub': row['id_user'], 'username': row['username'], 'role': row['role_name']})
        resp = JSONResponse(content={'username': row['username'], 'role': row['role_name'], 'id_persona': row.get('id_persona')})
        resp.set_cookie('ollantay_token', token, httponly=True, samesite='lax', path='/')
        return resp
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/auth/register', status_code=201)
def register(payload: RegisterIn):
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

        id_persona = None
        # optionally create persona
        if payload.nombres_persona and payload.ci_persona:
            curp = conn.cursor()
            curp.execute('INSERT INTO persona_O (nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci_persona, direccion_persona) VALUES (%s,%s,%s,%s,%s,%s,%s)',
                         (payload.nombres_persona, None, None, None, None, payload.ci_persona, None))
            conn.commit()
            id_persona = curp.lastrowid
            curp.close()

        # find role id for 'viewer' or default to NULL
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
        return {'username': payload.username, 'id_user': new_user_id, 'id_persona': id_persona}
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
            cursor.execute('SELECT id_persona, nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci_persona, direccion_persona FROM persona_O')
            rows = cursor.fetchall()
        else:
            cursor.execute('SELECT id_persona, nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci_persona, direccion_persona FROM persona_O WHERE id_tipoPersona = %s', (tipo,))
            rows = cursor.fetchall()
        cursor.close()
        conn.close()
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
def create_empresa(payload: EmpresaIn, x_user_role: str | None = Header(None)):
    role = get_role(x_user_role)
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
def update_empresa(id: int, payload: EmpresaIn, x_user_role: str | None = Header(None)):
    role = get_role(x_user_role)
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
def delete_empresa(id: int, x_user_role: str | None = Header(None)):
    role = get_role(x_user_role)
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
        cursor.execute('SELECT id_persona, nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci_persona, direccion_persona FROM persona_O WHERE id_persona = %s', (id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail='Persona no encontrada')
        return row
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def get_role(x_user_role: str | None = Header(None), request: Request | None = None) -> str:
    # prefer explicit header (for backward compatibility). Otherwise try cookie JWT
    if x_user_role:
        return x_user_role.lower()
    try:
        if request:
            token = request.cookies.get('ollantay_token')
            if token:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
                return (payload.get('role') or 'viewer').lower()
    except Exception:
        return 'viewer'
    return 'viewer'


@app.get('/auth/me')
def auth_me(request: Request):
    token = request.cookies.get('ollantay_token')
    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return {'username': payload.get('username'), 'role': payload.get('role'), 'sub': payload.get('sub')}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Token expired')
    except Exception:
        raise HTTPException(status_code=401, detail='Invalid token')


@app.post('/auth/logout')
def auth_logout():
    resp = JSONResponse(content={'ok': True})
    resp.delete_cookie('ollantay_token', path='/')
    return resp


@app.post('/persons', response_model=PersonaOut, status_code=201)
def create_person(payload: PersonaIn, x_user_role: str | None = Header(None)):
    role = get_role(x_user_role)
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
def update_person(id: int, payload: PersonaIn, x_user_role: str | None = Header(None)):
    role = get_role(x_user_role)
    if role not in ('admin','editor'):
        raise HTTPException(status_code=403, detail='Permission denied')
    nombres = payload.nombres_persona.strip()
    ci = payload.ci_persona.strip()
    direccion = payload.direccion_persona.strip()
    if not nombres or not ci or not direccion:
        raise HTTPException(status_code=400, detail='Campos requeridos faltantes')
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # check exists
        cursor.execute('SELECT id_persona FROM persona_O WHERE id_persona = %s', (id,))
        exists_person = cursor.fetchone()
        if not exists_person:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Persona no encontrada')
        # check tipo exists
        cursor.execute('SELECT idtipoPers FROM tipo_personaO WHERE idtipoPers = %s', (payload.id_tipoPersona,))
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
def delete_person(id: int, x_user_role: str | None = Header(None)):
    role = get_role(x_user_role)
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
