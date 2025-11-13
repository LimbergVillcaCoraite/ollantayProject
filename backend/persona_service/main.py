from fastapi import WebSocket, WebSocketDisconnect
import json
import asyncio
# ========== Ubicación en tiempo real de personas (multiempresa) ==========
from typing import Dict
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
import uuid
import segno
import hashlib
import base64

router = APIRouter()

app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://192.168.1.9",
    "http://192.168.1.9:3000",
    "http://192.168.1.9:80",
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
    id_empresa: Optional[int] = Field(None, description="Company ID (required for superadmin, ignored for other roles)")
    tipo_cliente: Optional[str] = Field('minorista', description="Tipo de cliente: minorista, mayorista, especial")
    idRuta: Optional[int] = Field(None, description="ID de la ruta asignada al cliente")


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
    id_empresa: Optional[int] = None
    tipo_cliente: Optional[str] = None
    idRuta: Optional[int] = None


class EmpresaIn(BaseModel):
    nombre_empresa: str = Field(..., max_length=100)
    direccion_empresa: str = Field(..., max_length=100)
    estado_empresa: int = Field(default=1)
    # No owner (propietario) is stored on empresa_O; personas reference empresa via id_empresa


class EmpresaOut(BaseModel):
    id_empresa: int
    nombre_empresa: str
    direccion_empresa: str
    estado_empresa: int
    # Owner is not stored directly on empresa_O; omit id_persona from response


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
    estado: Optional[int] = Field(None, ge=0, le=1)  # 0=inactivo, 1=activo

class SuperAdminUserCreateIn(BaseModel):
    username: str
    password: str
    nombres_persona: str
    apellido_paternoPersona: Optional[str] = None
    apellido_maternoPer: Optional[str] = None
    telefono_persona: Optional[str] = None
    ci_persona: str
    direccion_persona: str
    id_tipoPersona: int
    id_empresa: int  # Superadmin can assign to any company
    role_name: str   # Role name like 'admin', 'chofer', etc.


class RolePermissionsIn(BaseModel):
    perm_ids: List[int] = []

# RBAC models
class RoleIn(BaseModel):
    name: str
    description: Optional[str] = None
    id_empresa: Optional[int] = None  # For superadmin to create company-specific roles

class RoleOut(BaseModel):
    idrole: int
    name: str
    description: Optional[str] = None
    id_empresa: Optional[int] = None
    nombre_empresa: Optional[str] = None

class PermissionOut(BaseModel):
    id_perm: int
    resource: str
    action: str
    description: Optional[str] = None

class RolePermissionsIn(BaseModel):
    perm_ids: List[int]

class SignFirmaIn(BaseModel):
    id_persona: int
    tipo_documento: str = Field(..., max_length=40)  # asistencia | prestamo | otro
    id_referencia: Optional[str] = Field(None, max_length=100)
    data_url: str  # data:image/png;base64,...
    width: Optional[int] = None
    height: Optional[int] = None

class FirmaOut(BaseModel):
    id_firma: int
    id_persona: int
    tipo_documento: str
    id_referencia: Optional[str] = None
    created_at: datetime
    width: Optional[int] = None
    height: Optional[int] = None

# === Rostros (captura facial placeholder) ===
class FaceIn(BaseModel):
    id_persona: int
    data_url: str  # data:image/jpeg;base64,... or png
    tipo_documento: Optional[str] = 'rostro'
    id_referencia: Optional[str] = None

class FaceVerifyIn(BaseModel):
    id_persona: int
    data_url: str

class FaceOut(BaseModel):
    id_face: int
    id_persona: int
    created_at: datetime
    hash_sha256: str


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
    try:
        ensure_firma_table()
    except Exception:
        pass
    try:
        ensure_face_table()
    except Exception:
        pass

# Serve static uploads under /uploads (proxied as /api/personas/uploads via nginx)
app.mount('/uploads', StaticFiles(directory=UPLOAD_DIR), name='uploads')


# ========== Ubicación en tiempo real de personas (multiempresa) ==========
# Nota: esta sección depende de imports y funciones declaradas arriba
ws_persona_conns: Dict[int, list] = {}

class UbicacionPersonaIn(BaseModel):
    id_persona: int
    lat: float
    lng: float
    accuracy: float = 0

class UbicacionPersonaOut(UbicacionPersonaIn):
    updated_at: str

def ensure_ubicacion_persona_table():
    try:
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS persona_ubicacion_O (
                id_persona INT PRIMARY KEY,
                lat DOUBLE NOT NULL,
                lng DOUBLE NOT NULL,
                accuracy DOUBLE DEFAULT 0,
                updated_at DATETIME NOT NULL,
                id_empresa INT NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ''')
        conn.commit(); cur.close(); conn.close()
    except Exception as e:
        print(f"Error ensure_ubicacion_persona_table: {e}")

@app.on_event('startup')
def _startup_ubicacion_persona():
    ensure_ubicacion_persona_table()
    try:
        ensure_firma_table()
    except Exception:
        pass
    try:
        ensure_face_table()
    except Exception:
        pass

@app.on_event('startup')
def _auto_sync_permissions():
    """Auto-sincroniza permisos al iniciar el servicio para que nuevas interfaces aparezcan automáticamente"""
    try:
        print("🔄 Auto-sync: Verificando permisos...")
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Mapeo completo de páginas (debe coincidir con usePermissions.js)
        # Si agregas una nueva interfaz, añádela aquí para que se auto-genere el permiso base.
        page_permissions = {
            'dashboard': {'resource': 'analytics', 'action': 'view', 'description': 'Ver dashboard analítico'},
            'tipos': {'resource': 'tipos', 'action': 'view', 'description': 'Ver tipos'},
            'tipocajas': {'resource': 'tipocajas', 'action': 'view', 'description': 'Ver tipos de caja'},
            'personas': {'resource': 'personas', 'action': 'view', 'description': 'Ver personas'},
            'personas_mapa': {'resource': 'personas', 'action': 'view', 'description': 'Ver personas en mapa'},
            'empresas': {'resource': 'empresas', 'action': 'view', 'description': 'Ver empresas'},
            'prestamos': {'resource': 'prestamos', 'action': 'view', 'description': 'Ver prestamos'},
            'productos': {'resource': 'productos', 'action': 'view', 'description': 'Ver productos'},
            'productos_lotes': {'resource': 'lotes', 'action': 'view', 'description': 'Ver lotes de productos'},
            'caja': {'resource': 'caja', 'action': 'view', 'description': 'Ver caja'},
            'ventas': {'resource': 'ventas', 'action': 'view', 'description': 'Ver ventas'},
            'predicciones': {'resource': 'ventas', 'action': 'view', 'description': 'Ver predicciones IA'},
            'ai': {'resource': 'ai', 'action': 'view', 'description': 'Ver módulo IA'},
            'creditos': {'resource': 'creditos', 'action': 'view', 'description': 'Ver créditos Admin'},
            'misdeudas': {'resource': 'misdeudas', 'action': 'view', 'description': 'Ver mis deudas'},
            'compras': {'resource': 'compras', 'action': 'view', 'description': 'Ver compras'},
            'gastos': {'resource': 'gastos', 'action': 'view', 'description': 'Ver gastos'},
            'proveedores': {'resource': 'proveedores', 'action': 'view', 'description': 'Ver proveedores'},
            'rutas': {'resource': 'rutas', 'action': 'view', 'description': 'Ver rutas'},
            'cuentas': {'resource': 'cuentas', 'action': 'view', 'description': 'Ver cuentas'},
            'entregas': {'resource': 'entregas', 'action': 'view', 'description': 'Ver entregas'},
            'reportes': {'resource': 'reportes', 'action': 'view', 'description': 'Ver reportes'},
            'chat': {'resource': 'chat', 'action': 'view', 'description': 'Ver chat interno'},
            'usuarios': {'resource': 'roles', 'action': 'manage', 'description': 'Administrar usuarios'},
            'roles': {'resource': 'roles', 'action': 'manage', 'description': 'Administrar roles'},
            'superadmin': {'resource': 'superadmin', 'action': 'access', 'description': 'Acceso SuperAdmin'}
        }
        
        # Obtener permisos existentes
        cursor.execute('SELECT resource, action FROM permission_O')
        existing_perms = {(row['resource'], row['action']) for row in cursor.fetchall()}
        
        # Crear permisos faltantes de páginas
        created_count = 0
        for page, perm_data in page_permissions.items():
            resource = perm_data['resource']
            action = perm_data['action']
            
            if resource == 'none':
                continue
            
            if (resource, action) not in existing_perms:
                try:
                    cursor.execute(
                        'INSERT INTO permission_O (resource, action, description) VALUES (%s, %s, %s)',
                        (resource, action, perm_data['description'])
                    )
                    created_count += 1
                    print(f"  ✅ Creado permiso: {resource}:{action}")
                except Exception as e:
                    print(f"  ⚠️ No se pudo crear {resource}:{action}: {e}")
        
        # Crear permisos CRUD para cada recurso
        resources = {p['resource'] for p in page_permissions.values() if p['resource'] not in ['none', 'superadmin', 'roles']}
        crud_actions = ['view', 'create', 'update', 'delete']
        
        for resource in resources:
            for action in crud_actions:
                if (resource, action) not in existing_perms:
                    try:
                        description = f"Ver {resource}" if action == 'view' else f"{action.capitalize()} {resource}"
                        cursor.execute(
                            'INSERT INTO permission_O (resource, action, description) VALUES (%s, %s, %s)',
                            (resource, action, description)
                        )
                        created_count += 1
                        print(f"  ✅ Creado permiso CRUD: {resource}:{action}")
                    except Exception as e:
                        print(f"  ⚠️ No se pudo crear CRUD {resource}:{action}: {e}")
        
        conn.commit()
        cursor.close()
        conn.close()
        
        if created_count > 0:
            print(f"✅ Auto-sync completado: {created_count} permisos creados")
        else:
            print("✅ Auto-sync: Todos los permisos ya existen")
    except Exception as e:
        print(f"❌ Error en auto-sync de permisos: {e}")
    # Ensure firma table after permissions sync
    try:
        ensure_firma_table()
    except Exception as e:
        print(f"⚠️ No se pudo asegurar tabla firmas: {e}")
    try:
        ensure_face_table()
    except Exception as e:
        print(f"⚠️ No se pudo asegurar tabla rostros: {e}")

# POST: Actualizar ubicación de persona
@app.post('/persons/{id}/ubicacion', response_model=UbicacionPersonaOut)
async def actualizar_ubicacion_persona(id: int, body: UbicacionPersonaIn, request: Request):
    # Auth: persona puede actualizar su propia ubicación, admin/editor/superadmin de la empresa también
    role = get_role(None, request)
    jwt_company_id = get_company_id_from_request(request)
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cur.execute('SELECT id_empresa FROM persona_O WHERE id_persona = %s', (id,))
        row = cur.fetchone()
        if not row:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail='Persona no encontrada')
        id_empresa = row['id_empresa']
        # Validar que la persona tiene empresa asignada
        if id_empresa is None:
            cur.close(); conn.close()
            raise HTTPException(status_code=400, detail='La persona no tiene empresa asignada. Contacte al administrador.')
        # Permisos: superadmin, admin/editor de la empresa, o la propia persona
        persona_id = None
        try:
            token = request.cookies.get('ollantay_token')
            if token:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
                persona_id = payload.get('id_persona')
        except Exception:
            pass
        if not (
            role == 'superadmin' or
            (role in ('admin','editor') and jwt_company_id == id_empresa) or
            (persona_id == id)
        ):
            cur.close(); conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')
        # Upsert ubicación
        now_dt = datetime.utcnow()
        now = now_dt.strftime('%Y-%m-%d %H:%M:%S')
        now_iso = now_dt.isoformat() + 'Z'  # Formato ISO con Z para UTC
        cur2 = conn.cursor()
        cur2.execute('REPLACE INTO persona_ubicacion_O (id_persona, lat, lng, accuracy, updated_at, id_empresa) VALUES (%s,%s,%s,%s,%s,%s)',
            (id, body.lat, body.lng, body.accuracy, now, id_empresa))
        conn.commit(); cur2.close(); cur.close(); conn.close()
        # Broadcast a todos los clientes conectados de la empresa (usando ISO format para consistencia)
        msg = json.dumps({ 'id_persona': id, 'lat': body.lat, 'lng': body.lng, 'accuracy': body.accuracy, 'updated_at': now_iso })
        # Enviar a la empresa específica
        for ws in ws_persona_conns.get(id_empresa, []):
            try:
                await ws.send_text(msg)
            except Exception:
                pass
        # Si hay superadmins conectados (company_id = -1), también enviarles
        for ws in ws_persona_conns.get(-1, []):
            try:
                await ws.send_text(msg)
            except Exception:
                pass
        return { 'id_persona': id, 'lat': body.lat, 'lng': body.lng, 'accuracy': body.accuracy, 'updated_at': now_iso }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# GET: Última ubicación de persona
@app.get('/persons/{id}/ubicacion', response_model=UbicacionPersonaOut)
def obtener_ubicacion_persona(id: int, request: Request):
    role = get_role(None, request)
    jwt_company_id = get_company_id_from_request(request)
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cur.execute('SELECT * FROM persona_ubicacion_O WHERE id_persona = %s', (id,))
        row = cur.fetchone(); cur.close(); conn.close()
        if not row:
            raise HTTPException(status_code=404, detail='Sin ubicación')
        # Permisos: superadmin, admin/editor de la empresa, o la propia persona
        id_empresa = row['id_empresa']
        persona_id = None
        try:
            token = request.cookies.get('ollantay_token')
            if token:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
                persona_id = payload.get('id_persona')
        except Exception:
            pass
        if not (
            role == 'superadmin' or
            (role in ('admin','editor') and jwt_company_id == id_empresa) or
            (persona_id == id)
        ):
            raise HTTPException(status_code=403, detail='No autorizado')
        return row
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# GET: Todas las ubicaciones de personas de la empresa
@app.get('/persons/ubicaciones/all')
def obtener_ubicaciones_empresa(request: Request):
    """Obtiene todas las ubicaciones de personas de la empresa del usuario"""
    role = get_role(None, request)
    jwt_company_id = get_company_id_from_request(request)
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        
        if role == 'superadmin':
            # Superadmin ve todas las ubicaciones
            cur.execute('SELECT id_persona, lat, lng, accuracy, updated_at FROM persona_ubicacion_O')
        elif jwt_company_id is not None:
            # Otros roles ven solo las de su empresa
            cur.execute('SELECT id_persona, lat, lng, accuracy, updated_at FROM persona_ubicacion_O WHERE id_empresa = %s', (jwt_company_id,))
        else:
            cur.close(); conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')
        
        rows = cur.fetchall() or []
        cur.close(); conn.close()
        
        # Convertir a diccionario {id_persona: ubicacion}
        result = {}
        for row in rows:
            # Asegurar formato ISO con Z para UTC
            updated_at_iso = None
            if row['updated_at']:
                if hasattr(row['updated_at'], 'isoformat'):
                    updated_at_iso = row['updated_at'].isoformat() + 'Z'
                else:
                    # Si es string, parsearlo y convertir a ISO
                    try:
                        dt = datetime.strptime(str(row['updated_at']), '%Y-%m-%d %H:%M:%S')
                        updated_at_iso = dt.isoformat() + 'Z'
                    except:
                        updated_at_iso = str(row['updated_at'])
            
            result[row['id_persona']] = {
                'id_persona': row['id_persona'],
                'lat': row['lat'],
                'lng': row['lng'],
                'accuracy': row['accuracy'],
                'updated_at': updated_at_iso
            }
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# WebSocket: Ubicaciones en tiempo real de todas las personas de la empresa
@app.websocket('/ws/ubicaciones')
async def ws_ubicaciones_personas(websocket: WebSocket):
    # Autenticación por token: query ?token=..., cookie 'ollantay_token', o primer mensaje
    await websocket.accept()
    token = None
    try:
        # 1) Intentar query param
        token = websocket.query_params.get('token') if hasattr(websocket, 'query_params') else None
        # 2) Intentar cookie HttpOnly (en el handshake)
        if not token:
            try:
                token = websocket.cookies.get('ollantay_token') if hasattr(websocket, 'cookies') else None
            except Exception:
                token = None
        # 3) Como último recurso, esperar primer mensaje como token
        if not token:
            try:
                token = (await websocket.receive_text()).strip()
            except Exception:
                token = None
        if not token:
            await websocket.close(); return
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        role = payload.get('role', '').lower()
        company_id = payload.get('company_id')
        
        # Superadmin sin empresa: usar company_id especial -1 para broadcast global
        if role == 'superadmin' and not company_id:
            company_id = -1  # Clave especial para superadmin
        elif not company_id:
            await websocket.close(); return
            
        company_id = int(company_id)
        ws_persona_conns.setdefault(company_id, []).append(websocket)
        try:
            while True:
                await asyncio.sleep(60)  # Mantener conexión
        except WebSocketDisconnect:
            pass
        finally:
            try:
                ws_persona_conns[company_id].remove(websocket)
            except Exception:
                pass
    except Exception:
        try:
            await websocket.close()
        except Exception:
            pass


def create_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=JWT_EXPIRE_MINUTES))
    to_encode.update({'exp': expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALG)


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def get_permissions_for_role(role_name: str, company_id: int = None) -> list[str]:
    """Return list like ['module:action'] for a role name.
    
    Args:
        role_name: Name of the role (e.g., 'admin', 'cliente')
        company_id: ID of the company. If None, gets global permissions only.
                   Superadmin always gets all permissions regardless of company_id.
    """
    if not role_name:
        return []
    try:
        # Superadmin: grant all permissions without mapping lookups
        if role_name.lower() == 'superadmin':
            conn = get_db_connection(); cur = conn.cursor(dictionary=True)
            cur.execute('SELECT resource, action FROM permission_O')
            rows = cur.fetchall() or []
            cur.close(); conn.close()
            return [f"{x['resource']}:{x['action']}" for x in rows]
        
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        cur.execute('SELECT idrole FROM role_O WHERE name = %s', (role_name,))
        r = cur.fetchone()
        if not r:
            cur.close(); conn.close();
            return []
        
        # Get permissions for this role filtered by company
        # If company_id is provided, get permissions for that specific company OR global permissions (id_empresa IS NULL)
        if company_id is not None:
            cur.execute('''
                SELECT p.resource, p.action 
                FROM role_permission_O rp 
                JOIN permission_O p ON rp.perm_id = p.id_perm 
                WHERE rp.role_id = %s 
                  AND (rp.id_empresa = %s OR rp.id_empresa IS NULL)
            ''', (r['idrole'], company_id))
        else:
            # No company context - only get global permissions (superadmin scenario)
            cur.execute('''
                SELECT p.resource, p.action 
                FROM role_permission_O rp 
                JOIN permission_O p ON rp.perm_id = p.id_perm 
                WHERE rp.role_id = %s AND rp.id_empresa IS NULL
            ''', (r['idrole'],))
        
        rows = cur.fetchall() or []
        cur.close(); conn.close()
        return [f"{x['resource']}:{x['action']}" for x in rows]
    except Exception as e:
        print(f"Error in get_permissions_for_role: {e}")
        return []


@router.options('/auth/login')
def options_login():
    return Response(status_code=204)

@router.post('/auth/login')
async def login(request: Request):
    """Accepts JSON or form data. Reads body only once to avoid stream errors."""
    content_type = (request.headers.get('content-type') or '').lower()
    username = None
    password = None
    
    # Try JSON first if content-type indicates it
    if content_type.startswith('application/json'):
        try:
            body = await request.json()
            if isinstance(body, dict):
                username = body.get('username')
                password = body.get('password')
        except Exception:
            raise HTTPException(status_code=400, detail='Invalid JSON payload')
    # Otherwise try form data
    else:
        try:
            form = await request.form()
            username = form.get('username')
            password = form.get('password')
        except Exception:
            raise HTTPException(status_code=400, detail='Invalid form data')
    
    if not username or not password:
        raise HTTPException(status_code=400, detail='Username y password requeridos')
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('''
            SELECT u.id_user, u.username, u.password_hash, u.id_persona, u.profile_photo,
                   u.estado, r.name AS role_name, p.id_empresa, p.fotoPersona
            FROM user_O u
            JOIN role_O r   ON u.id_role = r.idrole
            LEFT JOIN persona_O p ON u.id_persona = p.id_persona
            WHERE u.username = %s
        ''', (username,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if not row:
            raise HTTPException(status_code=401, detail='Invalid credentials')
        
        # Verificar si el usuario está activo
        if row.get('estado') == 0:
            raise HTTPException(status_code=403, detail='Usuario inactivo. Contacte al administrador.')
        # Password verification supports both bcrypt hashes and legacy plaintext
        stored = row.get('password_hash') or ''
        if stored:
            ok = False
            try:
                # bcrypt hashes start with $2a$ or $2b$ typically
                if stored.startswith('$2a$') or stored.startswith('$2b$') or stored.startswith('$2y$'):
                    ok = bcrypt.checkpw((password or '').encode('utf-8'), stored.encode('utf-8'))
                else:
                    # legacy plaintext fallback
                    ok = (password or '') == stored
            except Exception:
                ok = False
            if not ok:
                raise HTTPException(status_code=401, detail='Invalid credentials')
        token = create_token({
            'sub': str(row['id_user']),
            'username': row['username'],
            'role': row['role_name'],
            'id_persona': row.get('id_persona'),
            'company_id': row.get('id_empresa')
        })
        perms = get_permissions_for_role(row['role_name'], row.get('id_empresa'))
        # Build profile photo URL from joined data
        rel = (row or {}).get('fotoPersona')
        photo_url = ('/api/personas' + rel) if (isinstance(rel, str) and rel.startswith('/uploads')) else rel
        resp = JSONResponse(content={'username': row['username'], 'role': row['role_name'], 'id_persona': row.get('id_persona'), 'company_id': row.get('id_empresa'), 'permissions': perms, 'profilePhoto': photo_url})
        resp.set_cookie('ollantay_token', token, httponly=True, samesite='lax', secure=False, path='/')
        return resp
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Temporary endpoint to regenerate token with company_id
@app.get('/debug/regenerate-token')
def regenerate_token(request: Request):
    """Temporary endpoint to regenerate JWT with company_id for debugging"""
    try:
        old_token = request.cookies.get('ollantay_token')
        if not old_token:
            return JSONResponse(content={'error': 'No token found'}, status_code=401)
        
        try:
            old_payload = jwt.decode(old_token, JWT_SECRET, algorithms=[JWT_ALG])
            user_id = old_payload.get('sub')
            
            # Convert to int if it's a string
            if isinstance(user_id, str):
                user_id = int(user_id)
        except Exception as e:
            return JSONResponse(content={'error': f'Invalid token: {str(e)}'}, status_code=401)
        
        if not user_id:
            return JSONResponse(content={'error': 'No user ID in token'}, status_code=401)
        
        # Fetch user data with company info
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('''
            SELECT u.id_user, u.username, r.name AS role_name, u.id_persona, p.id_empresa
            FROM user_O u
            JOIN role_O r ON u.id_role = r.idrole
            LEFT JOIN persona_O p ON u.id_persona = p.id_persona
            WHERE u.id_user = %s
        ''', (user_id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if not row:
            return JSONResponse(content={'error': 'User not found'}, status_code=404)
        
        # Create new token with company_id
        new_token = create_token({
            'sub': str(row['id_user']),
            'username': row['username'],
            'role': row['role_name'],
            'id_persona': row.get('id_persona'),
            'company_id': row.get('id_empresa')
        })
        
        resp = JSONResponse(content={
            'message': 'Token regenerated successfully', 
            'company_id': row.get('id_empresa'),
            'username': row['username'],
            'role': row['role_name']
        })
        resp.set_cookie('ollantay_token', new_token, httponly=True, samesite='lax', secure=False, path='/')
        return resp
        
    except Exception as e:
        return JSONResponse(content={'error': f'Server error: {str(e)}'}, status_code=500)

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
def list_persons(tipo: Optional[int] = None, company_id: Optional[int] = None, request: Request = None):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        role = get_role(None, request)
        jwt_company_id = get_company_id_from_request(request)
        base_sql = 'SELECT id_persona, nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci_persona, direccion_persona, fotoPersona, id_empresa, tipo_cliente, idRuta FROM persona_O'
        params = []
        where = []
        if tipo is not None:
            where.append('id_tipoPersona = %s')
            params.append(tipo)
        # Multi-empresa security: ALWAYS filter by company for non-superadmin users
        if role == 'superadmin':
            # Superadmin can see all companies or filter by specific company_id
            if company_id is not None:
                where.append('id_empresa = %s')
                params.append(company_id)
        else:
            # All other roles MUST be scoped to their own company
            if jwt_company_id is not None:
                where.append('id_empresa = %s')
                params.append(jwt_company_id)
            else:
                # Fallback: if no company_id in JWT, return empty result for security
                where.append('1 = 0')  # This will return no results
        sql = base_sql + ((' WHERE ' + ' AND '.join(where)) if where else '')
        cursor.execute(sql, tuple(params))
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
def list_empresas(q: Optional[str] = None, id_persona: Optional[int] = None, offset: Optional[int] = 0, limit: Optional[int] = 100, include_counts: Optional[int] = 0, request: Request = None):
    return list_empresas_paginated(q=q, id_persona=id_persona, offset=offset, limit=limit, request=request, include_counts=include_counts)


def list_empresas_paginated(q: Optional[str] = None, id_persona: Optional[int] = None, offset: int = 0, limit: int = 100, request: Request = None, include_counts: Optional[int] = 0):
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
        # role-based scoping
        role = get_role(None, request)
        company_id = get_company_id_from_request(request)
        # Superadmin (no tiene empresa, company_id es NULL): ve todas las empresas
        # Admin (tiene empresa): solo ve su empresa
        if role != 'superadmin' and company_id is not None:
            where_clauses.append('id_empresa = %s')
            params.append(company_id)
        if q:
            like = f"%{q}%"
            where_clauses.append('(nombre_empresa LIKE %s OR direccion_empresa LIKE %s)')
            params.extend([like, like])
        # empresa_O does not hold id_persona directly; skip filtering by id_persona
        where_sql = (' WHERE ' + ' AND '.join(where_clauses)) if where_clauses else ''
        # main page query
        if include_counts:
            sql = (
                'SELECT e.id_empresa, e.nombre_empresa, e.direccion_empresa, e.estado_empresa, '
                '(SELECT COUNT(1) FROM persona_O p WHERE p.id_empresa = e.id_empresa) AS personas_count '
                f'FROM empresa_O e{where_sql.replace(" FROM empresa_O", " FROM empresa_O e")} ORDER BY e.id_empresa DESC LIMIT %s OFFSET %s'
            )
        else:
            sql = (
                'SELECT id_empresa, nombre_empresa, direccion_empresa, estado_empresa '
                f'FROM empresa_O{where_sql} ORDER BY id_empresa DESC LIMIT %s OFFSET %s'
            )
        params_with_pagination = params + [limit, offset]
        cursor.execute(sql, tuple(params_with_pagination))
        rows = cursor.fetchall()
        # count total for the same filter (without pagination params)
        count_sql = f'SELECT COUNT(1) as total FROM empresa_O{where_sql}'
        cursor.execute(count_sql, tuple(params))
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
        cursor.execute('SELECT id_empresa, nombre_empresa, direccion_empresa, estado_empresa FROM empresa_O WHERE id_empresa = %s', (id,))
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
    # Only superadmin can create new companies
    if role != 'superadmin':
        raise HTTPException(status_code=403, detail='Solo el superadmin puede crear empresas')
    # validation
    nombre = payload.nombre_empresa.strip()
    direccion = payload.direccion_empresa.strip()
    if not nombre or not direccion:
        raise HTTPException(status_code=400, detail='Campos requeridos faltantes')
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cur2 = conn.cursor()
        cur2.execute('INSERT INTO empresa_O (nombre_empresa, direccion_empresa, estado_empresa) VALUES (%s,%s,%s)', (nombre, direccion, int(bool(payload.estado_empresa))))
        conn.commit()
        new_id = cur2.lastrowid
        cur2.close()
        
        print(f"✅ Empresa {new_id} creada. Iniciando seed de permisos...")
        
        # Post-creation: seed company-specific role_permission entries to avoid blank permission sets
        try:
            # Fetch global roles and their permissions
            rcur = conn.cursor(dictionary=True)
            rcur.execute('SELECT idrole, name FROM role_O WHERE id_empresa IS NULL')
            global_roles = rcur.fetchall() or []
            
            # Map global permissions for each role
            for gr in global_roles:
                # Get all permissions for this global role
                pcur = conn.cursor(dictionary=True)
                pcur.execute('SELECT perm_id FROM role_permission_O WHERE role_id=%s AND id_empresa IS NULL', (gr['idrole'],))
                perm_rows = pcur.fetchall() or []
                
                # Insert company-scoped permissions
                for pr in perm_rows:
                    ins = conn.cursor()
                    try:
                        ins.execute('INSERT INTO role_permission_O (role_id, perm_id, id_empresa) VALUES (%s,%s,%s) ON DUPLICATE KEY UPDATE id_empresa=id_empresa', 
                                    (gr['idrole'], pr['perm_id'], new_id))
                        print(f"  ✅ Seeded permission perm_id={pr['perm_id']} for role={gr['name']} (id={gr['idrole']}) in empresa {new_id}")
                    except Exception as ie:
                        print(f"  ⚠️ Failed to seed permission perm_id={pr['perm_id']} for role {gr['name']}: {ie}")
                    finally:
                        ins.close()
                pcur.close()
            
            conn.commit()
            rcur.close()
            print(f"✅ Seed de permisos completado para empresa {new_id}")
        except Exception as se:
            print(f"❌ Seed roles for empresa {new_id} falló: {se}")
            # Don't fail the entire operation if seed fails
        
        # Trigger permission auto-sync to ensure new pages permissions exist
        try:
            _auto_sync_permissions()
        except Exception as synce:
            print(f"⚠️ Auto-sync post empresa falló: {synce}")
        
        cursor.close()
        conn.close()
        return {'id_empresa': new_id, 'nombre_empresa': nombre, 'direccion_empresa': direccion, 'estado_empresa': int(bool(payload.estado_empresa))}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/empresas/{id}', response_model=EmpresaOut)
def update_empresa(id: int, payload: EmpresaIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    jwt_company_id = get_company_id_from_request(request)
    
    # Superadmin can update any company
    if role == 'superadmin':
        pass  # No restrictions
    # Admin can only update their own company
    elif role in ('admin', 'editor'):
        if jwt_company_id is None:
            raise HTTPException(status_code=400, detail='No se pudo determinar la empresa del usuario')
        if id != jwt_company_id:
            raise HTTPException(status_code=403, detail='Solo puede editar su propia empresa')
    else:
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
        cur2 = conn.cursor()
        cur2.execute('UPDATE empresa_O SET nombre_empresa=%s, direccion_empresa=%s, estado_empresa=%s WHERE id_empresa=%s', (nombre, direccion, int(bool(payload.estado_empresa)), id))
        conn.commit()
        cur2.close()
        cursor.close()
        conn.close()
        return {'id_empresa': id, 'nombre_empresa': nombre, 'direccion_empresa': direccion, 'estado_empresa': int(bool(payload.estado_empresa))}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/empresas/{id}/assign-persona')
def assign_persona_to_empresa(id: int, body: Dict[str, int], request: Request):
    """Asigna una persona existente a una empresa. Solo superadmin o admin de su propia empresa.
    body: { "id_persona": int }
    Si la persona tenía otra empresa, se actualiza. No altera roles, asume que permisos están sembrados.
    """
    role = get_role(None, request)
    jwt_company_id = get_company_id_from_request(request)
    id_persona = body.get('id_persona') if body else None
    if not id_persona:
        raise HTTPException(status_code=400, detail='id_persona requerido')
    # Autorización:
    # superadmin puede asignar a cualquier empresa
    # admin/editor solo a su propia empresa
    if role != 'superadmin':
        if role not in ('admin','editor'):
            raise HTTPException(status_code=403, detail='Permission denied')
        if jwt_company_id is None or jwt_company_id != id:
            raise HTTPException(status_code=403, detail='Solo puede asignar personas a su propia empresa')
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        # validar empresa destino
        cur.execute('SELECT id_empresa FROM empresa_O WHERE id_empresa=%s', (id,))
        dest = cur.fetchone()
        if not dest:
            cur.close(); conn.close(); raise HTTPException(status_code=404, detail='Empresa no encontrada')
        # validar persona
        cur.execute('SELECT id_persona, id_empresa FROM persona_O WHERE id_persona=%s', (id_persona,))
        persona_row = cur.fetchone()
        if not persona_row:
            cur.close(); conn.close(); raise HTTPException(status_code=404, detail='Persona no encontrada')
        # update
        upd = conn.cursor()
        upd.execute('UPDATE persona_O SET id_empresa=%s WHERE id_persona=%s', (id, id_persona))
        conn.commit(); upd.close()
        # devolver persona actualizada
        cur.execute('SELECT id_persona, nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci_persona, direccion_persona, fotoPersona, id_empresa FROM persona_O WHERE id_persona=%s', (id_persona,))
        updated = cur.fetchone()
        cur.close(); conn.close()
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete('/empresas/{id}', status_code=204)
def delete_empresa(id: int, x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ('admin','superadmin'):
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
def get_person(id: int, request: Request):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Multi-empresa security: filter by company
        role = get_role(None, request)
        jwt_company_id = get_company_id_from_request(request)
        
        if role == 'superadmin':
            # Superadmin can access any person
            cursor.execute('SELECT id_persona, nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci_persona, direccion_persona, fotoPersona, id_empresa FROM persona_O WHERE id_persona = %s', (id,))
        else:
            # All other roles MUST be scoped to their own company
            if jwt_company_id is not None:
                cursor.execute('SELECT id_persona, nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci_persona, direccion_persona, fotoPersona, id_empresa FROM persona_O WHERE id_persona = %s AND id_empresa = %s', (id, jwt_company_id))
            else:
                # No company_id available, deny access for security
                cursor.close(); conn.close()
                raise HTTPException(status_code=404, detail='Persona no encontrada')
        
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

def get_company_id_from_request(request: Request) -> Optional[int]:
    """Extract company_id (id_empresa) from JWT if present."""
    try:
        token = request.cookies.get('ollantay_token') if request is not None else None
        if not token:
            return None
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        cid = payload.get('company_id')
        return int(cid) if cid is not None else None
    except Exception:
        return None


def require_admin(x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ('admin', 'superadmin'):
        raise HTTPException(status_code=403, detail=f'Admin required (role={role})')
    return role

# ========================
# Empleados: información laboral
# ========================

def ensure_empleado_info_table(conn):
    cur = conn.cursor()
    cur.execute('''
        CREATE TABLE IF NOT EXISTS empleado_info_O (
            id_persona INT NOT NULL PRIMARY KEY,
            cargo VARCHAR(100) NULL,
            salario DECIMAL(10,2) NULL,
            fecha_ingreso DATE NULL,
            estado INT NOT NULL DEFAULT 1,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_empleado_persona FOREIGN KEY (id_persona) REFERENCES persona_O(id_persona) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ''')
    conn.commit(); cur.close()

class EmpleadoInfoIn(BaseModel):
    cargo: Optional[str] = Field(default=None, max_length=100)
    salario: Optional[float] = Field(default=None, ge=0)
    fecha_ingreso: Optional[str] = None  # YYYY-MM-DD
    estado: Optional[int] = Field(default=1, ge=0, le=1)
    set_as_empleado: Optional[bool] = Field(default=True)

@app.get('/empleados')
def list_empleados(q: Optional[str] = None, estado: Optional[int] = None, x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection(); ensure_empleado_info_table(conn)
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)
        sql = '''
            SELECT p.id_persona, p.nombres_persona, p.apellido_paternoPersona, p.apellido_maternoPer,
                   p.ci_persona, p.telefono_persona,
                   p.direccion_persona, p.id_tipoPersona, p.id_empresa,
                   ei.cargo, ei.salario, ei.fecha_ingreso, ei.estado
            FROM persona_O p
            LEFT JOIN empleado_info_O ei ON ei.id_persona = p.id_persona
        '''
        where = ['(p.id_tipoPersona = 3 OR ei.id_persona IS NOT NULL)']
        params = []
        if role != 'superadmin' and user_company is not None:
            where.append('p.id_empresa = %s'); params.append(user_company)
        if estado is not None:
            where.append('(ei.estado = %s OR ei.estado IS NULL)'); params.append(estado)
        if q:
            like = f"%{q}%"; where.append('(p.nombres_persona LIKE %s OR p.apellido_paternoPersona LIKE %s OR p.apellido_maternoPer LIKE %s OR p.ci_persona LIKE %s)'); params.extend([like, like, like, like])
        if where:
            sql += ' WHERE ' + ' AND '.join(where)
        sql += ' ORDER BY p.nombres_persona ASC'
        cur.execute(sql, tuple(params)); rows = cur.fetchall() or []
        for r in rows:
            if r.get('salario') is not None:
                try: r['salario'] = float(r['salario'])
                except: r['salario'] = None
            if r.get('fecha_ingreso'):
                try: r['fecha_ingreso'] = r['fecha_ingreso'].isoformat()
                except: r['fecha_ingreso'] = str(r['fecha_ingreso'])
            if r.get('id_tipoPersona') == 3 and r.get('estado') is None:
                r['estado'] = 1
        cur.close(); conn.close(); return rows
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.put('/empleados/{id_persona}/info')
def upsert_empleado_info(id_persona: int, payload: EmpleadoInfoIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection(); ensure_empleado_info_table(conn)
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)
        if role != 'superadmin' and user_company is not None:
            cur.execute('SELECT id_persona, id_tipoPersona FROM persona_O WHERE id_persona=%s AND id_empresa=%s', (id_persona, user_company))
        else:
            cur.execute('SELECT id_persona, id_tipoPersona FROM persona_O WHERE id_persona=%s', (id_persona,))
        p = cur.fetchone()
        if not p: cur.close(); conn.close(); raise HTTPException(status_code=404, detail='Persona no encontrada')
        upd = conn.cursor(); upd.execute('UPDATE empleado_info_O SET cargo=%s, salario=%s, fecha_ingreso=%s, estado=%s WHERE id_persona=%s', (payload.cargo, payload.salario, payload.fecha_ingreso, payload.estado if payload.estado is not None else 1, id_persona))
        if upd.rowcount == 0:
            upd.execute('INSERT INTO empleado_info_O (id_persona, cargo, salario, fecha_ingreso, estado) VALUES (%s,%s,%s,%s,%s)', (id_persona, payload.cargo, payload.salario, payload.fecha_ingreso, payload.estado if payload.estado is not None else 1))
        conn.commit(); upd.close()
        if payload.set_as_empleado and int(p.get('id_tipoPersona') or 0) != 3:
            cur2 = conn.cursor(); cur2.execute('UPDATE persona_O SET id_tipoPersona=3 WHERE id_persona=%s', (id_persona,)); conn.commit(); cur2.close()
        cur.execute('SELECT p.id_persona, p.nombres_persona, p.apellido_paternoPersona, p.apellido_maternoPer, p.ci_persona, ei.cargo, ei.salario, ei.fecha_ingreso, ei.estado FROM persona_O p LEFT JOIN empleado_info_O ei ON ei.id_persona=p.id_persona WHERE p.id_persona=%s', (id_persona,))
        row = cur.fetchone() or {}
        if row.get('salario') is not None:
            try: row['salario'] = float(row['salario'])
            except: row['salario'] = None
        if row.get('fecha_ingreso'):
            try: row['fecha_ingreso'] = row['fecha_ingreso'].isoformat()
            except: row['fecha_ingreso'] = str(row['fecha_ingreso'])
        cur.close(); conn.close(); return row
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

# ========================
# Asistencia (entrada/salida)
# ========================

def ensure_asistencia_table(conn):
    cur = conn.cursor(); cur.execute('''
        CREATE TABLE IF NOT EXISTS asistencia_O (
            id INT NOT NULL AUTO_INCREMENT,
            id_persona INT NOT NULL,
            tipo ENUM('entrada','salida') NOT NULL,
            timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            geo_lat DECIMAL(9,6) NULL,
            geo_lng DECIMAL(9,6) NULL,
            nota VARCHAR(255) NULL,
            PRIMARY KEY (id),
            KEY idx_persona_time (id_persona, timestamp),
            CONSTRAINT fk_asist_persona FOREIGN KEY (id_persona) REFERENCES persona_O(id_persona) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    '''); conn.commit(); cur.close()

def ensure_empresa_geofence_columns(conn):
    try:
        cur = conn.cursor()
        cur.execute("""
            ALTER TABLE empresa_O
            ADD COLUMN IF NOT EXISTS geo_lat DECIMAL(9,6) NULL,
            ADD COLUMN IF NOT EXISTS geo_lng DECIMAL(9,6) NULL,
            ADD COLUMN IF NOT EXISTS geo_radius_m INT NULL
        """)
        conn.commit(); cur.close()
    except Exception:
        try:
            # Fallback for MySQL versions without IF NOT EXISTS per-column
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=%s AND TABLE_NAME='empresa_O' AND COLUMN_NAME='geo_lat'", (os.getenv('DATABASE_NAME','SystemaOllantay'),))
            if not cur.fetchone():
                cur.execute("ALTER TABLE empresa_O ADD COLUMN geo_lat DECIMAL(9,6) NULL")
            cur.execute("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=%s AND TABLE_NAME='empresa_O' AND COLUMN_NAME='geo_lng'", (os.getenv('DATABASE_NAME','SystemaOllantay'),))
            if not cur.fetchone():
                cur.execute("ALTER TABLE empresa_O ADD COLUMN geo_lng DECIMAL(9,6) NULL")
            cur.execute("SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=%s AND TABLE_NAME='empresa_O' AND COLUMN_NAME='geo_radius_m'", (os.getenv('DATABASE_NAME','SystemaOllantay'),))
            if not cur.fetchone():
                cur.execute("ALTER TABLE empresa_O ADD COLUMN geo_radius_m INT NULL")
            conn.commit(); cur.close()
        except Exception:
            pass

def _haversine_m(lat1, lon1, lat2, lon2):
    from math import radians, sin, cos, sqrt, atan2
    R = 6371000.0
    dlat = radians((lat2 or 0) - (lat1 or 0))
    dlon = radians((lon2 or 0) - (lon1 or 0))
    a = sin(dlat/2)**2 + cos(radians(lat1 or 0))*cos(radians(lat2 or 0))*sin(dlon/2)**2
    c = 2*atan2(sqrt(a), sqrt(1-a))
    return R*c

def ensure_asistencia_token_table(conn):
    cur = conn.cursor(); cur.execute('''
        CREATE TABLE IF NOT EXISTS asistencia_token_O (
            jti VARCHAR(64) PRIMARY KEY,
            id_persona INT NOT NULL,
            issued_at DATETIME NOT NULL,
            expires_at DATETIME NOT NULL,
            used_at DATETIME NULL,
            KEY idx_persona_exp (id_persona, expires_at),
            CONSTRAINT fk_asist_token_persona FOREIGN KEY (id_persona) REFERENCES persona_O(id_persona) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    '''); conn.commit(); cur.close()

class CheckInOutIn(BaseModel):
    id_persona: int
    geo_lat: Optional[float] = None
    geo_lng: Optional[float] = None
    nota: Optional[str] = Field(default=None, max_length=255)

class ScanQRIn(BaseModel):
    token: str
    geo_lat: Optional[float] = None
    geo_lng: Optional[float] = None
    nota: Optional[str] = Field(default=None, max_length=255)

@app.post('/asistencia/checkin')
def asistencia_checkin(payload: CheckInOutIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection(); ensure_asistencia_table(conn)
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)
        if role != 'superadmin' and user_company is not None:
            cur.execute('SELECT id_persona FROM persona_O WHERE id_persona=%s AND id_empresa=%s', (payload.id_persona, user_company))
        else:
            cur.execute('SELECT id_persona FROM persona_O WHERE id_persona=%s', (payload.id_persona,))
        pr = cur.fetchone()
        if not pr: cur.close(); conn.close(); raise HTTPException(status_code=404, detail='Persona no encontrada')
        # Geofencing: if empresa has geo fence configured, require location within radius
        ensure_empresa_geofence_columns(conn)
        cur.execute('SELECT e.geo_lat, e.geo_lng, e.geo_radius_m FROM empresa_O e JOIN persona_O p ON p.id_empresa=e.id_empresa WHERE p.id_persona=%s', (payload.id_persona,))
        geo = cur.fetchone() or {}
        if geo and geo.get('geo_lat') is not None and geo.get('geo_lng') is not None and geo.get('geo_radius_m'):
            if payload.geo_lat is None or payload.geo_lng is None:
                cur.close(); conn.close(); raise HTTPException(status_code=400, detail='Se requiere ubicación para validar geocerca')
            dist = _haversine_m(float(geo['geo_lat']), float(geo['geo_lng']), float(payload.geo_lat), float(payload.geo_lng))
            if dist > float(geo['geo_radius_m']):
                cur.close(); conn.close(); raise HTTPException(status_code=403, detail='Fuera de zona laboral')
        ins = conn.cursor(); ins.execute('INSERT INTO asistencia_O (id_persona, tipo, geo_lat, geo_lng, nota) VALUES (%s,\'entrada\',%s,%s,%s)', (payload.id_persona, payload.geo_lat, payload.geo_lng, payload.nota)); conn.commit(); ins.close(); cur.close(); conn.close(); return {'status':'ok'}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post('/asistencia/checkout')
def asistencia_checkout(payload: CheckInOutIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection(); ensure_asistencia_table(conn)
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)
        if role != 'superadmin' and user_company is not None:
            cur.execute('SELECT id_persona FROM persona_O WHERE id_persona=%s AND id_empresa=%s', (payload.id_persona, user_company))
        else:
            cur.execute('SELECT id_persona FROM persona_O WHERE id_persona=%s', (payload.id_persona,))
        if not cur.fetchone(): cur.close(); conn.close(); raise HTTPException(status_code=404, detail='Persona no encontrada')
        # Geofencing
        ensure_empresa_geofence_columns(conn)
        cur.execute('SELECT e.geo_lat, e.geo_lng, e.geo_radius_m FROM empresa_O e JOIN persona_O p ON p.id_empresa=e.id_empresa WHERE p.id_persona=%s', (payload.id_persona,))
        geo = cur.fetchone() or {}
        if geo and geo.get('geo_lat') is not None and geo.get('geo_lng') is not None and geo.get('geo_radius_m'):
            if payload.geo_lat is None or payload.geo_lng is None:
                cur.close(); conn.close(); raise HTTPException(status_code=400, detail='Se requiere ubicación para validar geocerca')
            dist = _haversine_m(float(geo['geo_lat']), float(geo['geo_lng']), float(payload.geo_lat), float(payload.geo_lng))
            if dist > float(geo['geo_radius_m']):
                cur.close(); conn.close(); raise HTTPException(status_code=403, detail='Fuera de zona laboral')
        ins = conn.cursor(); ins.execute('INSERT INTO asistencia_O (id_persona, tipo, geo_lat, geo_lng, nota) VALUES (%s,\'salida\',%s,%s,%s)', (payload.id_persona, payload.geo_lat, payload.geo_lng, payload.nota)); conn.commit(); ins.close(); cur.close(); conn.close(); return {'status':'ok'}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get('/asistencia/qr/{id_persona}')
def generate_qr(id_persona: int, ttl: Optional[int] = 60, x_user_role: Optional[str] = Header(None), request: Request = None):
    """Genera un token QR efímero (JWT) para asistencia y devuelve SVG embebido."""
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin','viewer'):
        raise HTTPException(status_code=403, detail='Permission denied')
    ttl = max(15, min(600, int(ttl or 60)))  # 15s..10m
    try:
        # Validar que persona pertenece a la empresa (si no es superadmin)
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)
        if role != 'superadmin' and user_company is not None:
            cur.execute('SELECT id_persona FROM persona_O WHERE id_persona=%s AND id_empresa=%s', (id_persona, user_company))
        else:
            cur.execute('SELECT id_persona FROM persona_O WHERE id_persona=%s', (id_persona,))
        pr = cur.fetchone();
        if not pr: cur.close(); conn.close(); raise HTTPException(status_code=404, detail='Persona no encontrada')
        # Crear JWT con jti, exp
        jti = uuid.uuid4().hex[:32]
        payload = {
            'typ': 'asistencia-qr',
            'sub': str(id_persona),
            'jti': jti,
            'exp': int((datetime.utcnow() + timedelta(seconds=ttl)).timestamp())
        }
        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)
        # Persistir registro emitido (para evitar reuso)
        ensure_asistencia_token_table(conn)
        cur2 = conn.cursor()
        cur2.execute('INSERT INTO asistencia_token_O (jti, id_persona, issued_at, expires_at) VALUES (%s,%s,UTC_TIMESTAMP(), DATE_ADD(UTC_TIMESTAMP(), INTERVAL %s SECOND))', (jti, id_persona, ttl))
        conn.commit(); cur2.close(); cur.close(); conn.close()
        # Generar QR SVG (contenido = token)
        q = segno.make(token, error='M')
        svg = q.svg_inline(scale=4)
        return {'token': token, 'svg': svg, 'expires_in': ttl}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post('/asistencia/scan')
def scan_qr(payload: ScanQRIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    """Valida token QR y registra entrada/salida alternando, con geofencing."""
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        # Decodificar y validar token
        data = jwt.decode(payload.token, JWT_SECRET, algorithms=[JWT_ALG])
        if data.get('typ') != 'asistencia-qr':
            raise HTTPException(status_code=400, detail='Token inválido')
        id_persona = int(data.get('sub'))
        jti = data.get('jti')
        conn = get_db_connection(); ensure_asistencia_table(conn); ensure_asistencia_token_table(conn)
        cur = conn.cursor(dictionary=True)
        # Validar scoping empresa
        user_company = get_company_id_from_request(request)
        if role != 'superadmin' and user_company is not None:
            cur.execute('SELECT id_persona FROM persona_O WHERE id_persona=%s AND id_empresa=%s', (id_persona, user_company))
        else:
            cur.execute('SELECT id_persona FROM persona_O WHERE id_persona=%s', (id_persona,))
        if not cur.fetchone(): cur.close(); conn.close(); raise HTTPException(status_code=404, detail='Persona no encontrada')
        # Validar jti no usado y no expirado
        cur.execute('SELECT jti, used_at, expires_at FROM asistencia_token_O WHERE jti=%s', (jti,))
        row = cur.fetchone()
        if not row: cur.close(); conn.close(); raise HTTPException(status_code=400, detail='Token no reconocido')
        if row.get('used_at') is not None: cur.close(); conn.close(); raise HTTPException(status_code=400, detail='Token ya utilizado')
        # Geofencing
        ensure_empresa_geofence_columns(conn)
        cur.execute('SELECT e.geo_lat, e.geo_lng, e.geo_radius_m FROM empresa_O e JOIN persona_O p ON p.id_empresa=e.id_empresa WHERE p.id_persona=%s', (id_persona,))
        geo = cur.fetchone() or {}
        if geo and geo.get('geo_lat') is not None and geo.get('geo_lng') is not None and geo.get('geo_radius_m'):
            if payload.geo_lat is None or payload.geo_lng is None:
                cur.close(); conn.close(); raise HTTPException(status_code=400, detail='Se requiere ubicación para validar geocerca')
            dist = _haversine_m(float(geo['geo_lat']), float(geo['geo_lng']), float(payload.geo_lat), float(payload.geo_lng))
            if dist > float(geo['geo_radius_m']):
                cur.close(); conn.close(); raise HTTPException(status_code=403, detail='Fuera de zona laboral')
        # Determinar acción: si última marca del día es 'entrada' sin salida posterior, registrar 'salida', sino 'entrada'
        cur.execute('''
            SELECT tipo FROM asistencia_O 
            WHERE id_persona=%s AND DATE(timestamp)=CURDATE() 
            ORDER BY timestamp DESC LIMIT 1
        ''', (id_persona,))
        last = cur.fetchone()
        next_tipo = 'salida' if (last and last.get('tipo') == 'entrada') else 'entrada'
        ins = conn.cursor(); ins.execute('INSERT INTO asistencia_O (id_persona, tipo, geo_lat, geo_lng, nota) VALUES (%s,%s,%s,%s,%s)', (id_persona, next_tipo, payload.geo_lat, payload.geo_lng, payload.nota)); conn.commit(); ins.close()
        # Marcar token como usado
        up = conn.cursor(); up.execute('UPDATE asistencia_token_O SET used_at=UTC_TIMESTAMP() WHERE jti=%s', (jti,)); conn.commit(); up.close(); cur.close(); conn.close()
        return {'status':'ok', 'accion': next_tipo}
    except HTTPException: raise
    except jwt.ExpiredSignatureError: raise HTTPException(status_code=400, detail='Token expirado')
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get('/asistencia/estadisticas')
def asistencia_estadisticas(desde: Optional[str] = None, hasta: Optional[str] = None, id_persona: Optional[int] = None, x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection(); ensure_asistencia_table(conn)
        cur = conn.cursor(dictionary=True)
        sql = 'SELECT id_persona, tipo, timestamp, geo_lat, geo_lng FROM asistencia_O'
        where = []; params = []
        if id_persona:
            where.append('id_persona=%s'); params.append(id_persona)
        if desde:
            where.append('timestamp >= %s'); params.append(desde)
        if hasta:
            where.append('timestamp <= %s'); params.append(hasta)
        if where:
            sql += ' WHERE ' + ' AND '.join(where)
        sql += ' ORDER BY id_persona ASC, timestamp ASC'
        cur.execute(sql, tuple(params)); rows = cur.fetchall() or []
        stats = {}
        for r in rows:
            pid = r['id_persona']; stats.setdefault(pid, {'id_persona': pid, 'entradas': 0, 'salidas': 0})
            if r['tipo'] == 'entrada': stats[pid]['entradas'] += 1
            else: stats[pid]['salidas'] += 1
        cur.close(); conn.close(); return {'items': list(stats.values()), 'total': len(stats)}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))


@app.get('/asistencia/registros')
def asistencia_registros(desde: Optional[str] = None, hasta: Optional[str] = None, id_persona: Optional[int] = None, x_user_role: Optional[str] = Header(None), request: Request = None):
    """Retorna registros detallados individuales de asistencia (no solo estadísticas agregadas)"""
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection(); ensure_asistencia_table(conn)
        cur = conn.cursor(dictionary=True)
        
        # Query base para obtener registros con información del empleado
        sql = '''
            SELECT 
                a.id_asistencia,
                a.id_persona,
                a.tipo,
                a.timestamp,
                a.geo_lat,
                a.geo_lng,
                a.nota,
                p.nombre,
                p.apellido_paterno,
                p.apellido_materno
            FROM asistencia_O a
            LEFT JOIN persona_O p ON a.id_persona = p.id_persona
        '''
        
        where = []; params = []
        
        # Filtros opcionales
        if id_persona:
            where.append('a.id_persona=%s'); params.append(id_persona)
        if desde:
            where.append('a.timestamp >= %s'); params.append(desde)
        if hasta:
            where.append('a.timestamp <= %s'); params.append(hasta)
        
        if where:
            sql += ' WHERE ' + ' AND '.join(where)
        
        sql += ' ORDER BY a.timestamp DESC'
        
        cur.execute(sql, tuple(params))
        rows = cur.fetchall() or []
        
        # Formatear resultados
        registros = []
        for r in rows:
            nombre_completo = f"{r['nombre'] or ''} {r['apellido_paterno'] or ''} {r['apellido_materno'] or ''}".strip()
            registros.append({
                'id_asistencia': r['id_asistencia'],
                'id_persona': r['id_persona'],
                'nombre_empleado': nombre_completo,
                'tipo': r['tipo'],
                'timestamp': r['timestamp'].isoformat() if r['timestamp'] else None,
                'geo_lat': float(r['geo_lat']) if r['geo_lat'] else None,
                'geo_lng': float(r['geo_lng']) if r['geo_lng'] else None,
                'nota': r['nota']
            })
        
        cur.close(); conn.close()
        return {'items': registros, 'total': len(registros)}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))


@app.get('/auth/me')
def auth_me(request: Request):
    token = request.cookies.get('ollantay_token')
    if not token:
        raise HTTPException(status_code=401, detail='Not authenticated')
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        profile_photo = None
        company_id = None
        try:
            if payload.get('id_persona'):
                conn = get_db_connection()
                cur = conn.cursor(dictionary=True)
                cur.execute('SELECT fotoPersona, id_empresa FROM persona_O WHERE id_persona = %s', (payload.get('id_persona'),))
                r = cur.fetchone()
                if r:
                    rel = r.get('fotoPersona')
                    if rel:
                        profile_photo = '/api/personas' + rel if rel.startswith('/uploads') else rel
                    company_id = r.get('id_empresa')
                cur.close()
                conn.close()
        except Exception:
            profile_photo = None
        perms = get_permissions_for_role(payload.get('role'), company_id or payload.get('company_id'))
        return {'username': payload.get('username'), 'role': payload.get('role'), 'sub': payload.get('sub'), 'id_persona': payload.get('id_persona'), 'company_id': company_id or payload.get('company_id'), 'permissions': perms, 'profilePhoto': profile_photo}
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


@app.post('/persons-json', response_model=PersonaOut, status_code=201)
async def create_person_json(payload: PersonaIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    """Create person from JSON payload (no photo upload)"""
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin','viewer'):
        raise HTTPException(status_code=403, detail=f'Permission denied. Role: {role}')
    
    nombres = payload.nombres_persona.strip()
    ci = payload.ci_persona.strip()
    direccion = payload.direccion_persona.strip()
    if not nombres or not ci or not direccion:
        raise HTTPException(status_code=400, detail='Campos requeridos faltantes')
    
    # Get company_id from JWT token
    company_id = get_company_id_from_request(request)
    
    # For superadmin, company_id can be null (they select the target company)
    if role != 'superadmin' and company_id is None:
        raise HTTPException(status_code=400, detail='No se pudo determinar la empresa del usuario')
    
    # For superadmin, use id_empresa from payload; for others, use their company_id
    target_company_id = payload.id_empresa if role == 'superadmin' else company_id
    if target_company_id is None:
        raise HTTPException(status_code=400, detail='Debe especificar la empresa destino')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT idtipoPers FROM tipo_personaO WHERE idtipoPers = %s', (payload.id_tipoPersona,))
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
        cur2.execute('INSERT INTO persona_O (nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci_persona, direccion_persona, fotoPersona, id_empresa, tipo_cliente, idRuta) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
            (nombres, payload.apellido_paternoPersona, payload.apellido_maternoPer, payload.telefono_persona, payload.id_tipoPersona, ci, direccion, None, target_company_id, payload.tipo_cliente, payload.idRuta))
        conn.commit()
        new_id = cur2.lastrowid
        cur2.close(); cursor.close(); conn.close()
        
        return {
            'id_persona': new_id,
            'nombres_persona': nombres,
            'apellido_paternoPersona': payload.apellido_paternoPersona,
            'apellido_maternoPer': payload.apellido_maternoPer,
            'telefono_persona': payload.telefono_persona,
            'id_tipoPersona': payload.id_tipoPersona,
            'ci_persona': ci,
            'direccion_persona': direccion,
            'fotoPersona': None,
            'id_empresa': company_id
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/persons', response_model=PersonaOut, status_code=201)
async def create_person(
    nombres_persona: str = Form(...),
    apellido_paternoPersona: Optional[str] = Form(None),
    apellido_maternoPer: Optional[str] = Form(None),
    telefono_persona: Optional[str] = Form(None),
    id_tipoPersona: int = Form(...),
    ci_persona: str = Form(...),
    direccion_persona: str = Form(...),
    tipo_cliente: Optional[str] = Form('minorista'),
    idRuta: Optional[int] = Form(None),
    id_empresa: Optional[int] = Form(None),
    foto: Optional[UploadFile] = File(None),
    x_user_role: Optional[str] = Header(None),
    request: Request = None
):
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
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
        # Determine company for insertion
        jwt_company_id = get_company_id_from_request(request)
        target_company_id = None
        if role == 'superadmin':
            target_company_id = id_empresa
            if target_company_id is None:
                cursor.close(); conn.close()
                raise HTTPException(status_code=400, detail='Debe especificar la empresa destino')
        else:
            target_company_id = jwt_company_id
            if target_company_id is None:
                cursor.close(); conn.close()
                raise HTTPException(status_code=400, detail='No se pudo determinar la empresa del usuario')
        
        cur2.execute('INSERT INTO persona_O (nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci_persona, direccion_persona, fotoPersona, id_empresa, tipo_cliente, idRuta) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
            (nombres, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci, direccion, foto_path, target_company_id, tipo_cliente, idRuta))
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
        # Get company_id from JWT token  
        company_id = get_company_id_from_request(request)
        if company_id is None:
            cursor.close(); conn.close()
            raise HTTPException(status_code=400, detail='No se pudo determinar la empresa del usuario')
        
        cur2.execute('INSERT INTO persona_O (nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci_persona, direccion_persona, fotoPersona, id_empresa) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)',
                     (nombres, payload.apellido_paternoPersona, payload.apellido_maternoPer, payload.telefono_persona, payload.id_tipoPersona, ci, direccion, None, company_id))
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
async def update_person(
    id: int,
    nombres_persona: str = Form(...),
    apellido_paternoPersona: Optional[str] = Form(None),
    apellido_maternoPer: Optional[str] = Form(None),
    telefono_persona: Optional[str] = Form(None),
    id_tipoPersona: int = Form(...),
    ci_persona: str = Form(...),
    direccion_persona: str = Form(...),
    tipo_cliente: Optional[str] = Form('minorista'),
    idRuta: Optional[int] = Form(None),
    foto: Optional[UploadFile] = File(None),
    x_user_role: Optional[str] = Header(None),
    request: Request = None
):
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    nombres = nombres_persona.strip()
    ci = ci_persona.strip()
    direccion = direccion_persona.strip()
    if not nombres or not ci or not direccion:
        raise HTTPException(status_code=400, detail='Campos requeridos faltantes')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Multi-empresa security: validate person belongs to user's company
        jwt_company_id = get_company_id_from_request(request)
        if role != 'superadmin':
            if jwt_company_id is None:
                cursor.close(); conn.close()
                raise HTTPException(status_code=400, detail='No se pudo determinar la empresa del usuario')
            cursor.execute('SELECT id_persona, fotoPersona FROM persona_O WHERE id_persona = %s AND id_empresa = %s', (id, jwt_company_id))
        else:
            cursor.execute('SELECT id_persona, fotoPersona FROM persona_O WHERE id_persona = %s', (id,))
            
        exists_person = cursor.fetchone()
        if not exists_person:
            cursor.close(); conn.close()
            raise HTTPException(status_code=404, detail='Persona no encontrada o no pertenece a su empresa')
        
        old_foto = exists_person.get('fotoPersona')
        
        cursor.execute('SELECT idtipoPers FROM tipo_personaO WHERE idtipoPers = %s', (id_tipoPersona,))
        tipo = cursor.fetchone()
        if not tipo:
            cursor.close(); conn.close()
            raise HTTPException(status_code=400, detail='TipoPersona no existe')
        
        # Procesar nueva foto si se proporciona
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
            
            # Eliminar foto anterior si existe
            if old_foto:
                old_foto_filename = old_foto.split('/')[-1] if '/' in old_foto else old_foto
                old_foto_path = os.path.join(UPLOAD_DIR, old_foto_filename)
                try:
                    if os.path.exists(old_foto_path):
                        os.remove(old_foto_path)
                        print(f"✅ Foto anterior eliminada: {old_foto_path}")
                except Exception as e:
                    print(f"⚠️  Error al eliminar foto anterior: {e}")
        
        cur2 = conn.cursor()
        update_sql = 'UPDATE persona_O SET nombres_persona=%s, apellido_paternoPersona=%s, apellido_maternoPer=%s, telefono_persona=%s, id_tipoPersona=%s, ci_persona=%s, direccion_persona=%s, tipo_cliente=%s, idRuta=%s'
        params = [nombres, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci, direccion, tipo_cliente, idRuta]
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


@app.put('/persons-json/{id}', response_model=PersonaOut)
async def update_person_json(id: int, payload: PersonaIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    """Update person from JSON payload (no photo upload)"""
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    
    nombres = payload.nombres_persona.strip()
    ci = payload.ci_persona.strip()
    direccion = payload.direccion_persona.strip()
    if not nombres or not ci or not direccion:
        raise HTTPException(status_code=400, detail='Campos requeridos faltantes')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Multi-empresa security: validate person belongs to user's company
        jwt_company_id = get_company_id_from_request(request)
        if role != 'superadmin':
            if jwt_company_id is None:
                cursor.close(); conn.close()
                raise HTTPException(status_code=400, detail='No se pudo determinar la empresa del usuario')
            cursor.execute('SELECT id_persona FROM persona_O WHERE id_persona = %s AND id_empresa = %s', (id, jwt_company_id))
        else:
            cursor.execute('SELECT id_persona FROM persona_O WHERE id_persona = %s', (id,))
            
        exists_person = cursor.fetchone()
        if not exists_person:
            cursor.close(); conn.close()
            raise HTTPException(status_code=404, detail='Persona no encontrada o no pertenece a su empresa')
        
        cursor.execute('SELECT idtipoPers FROM tipo_personaO WHERE idtipoPers = %s', (payload.id_tipoPersona,))
        tipo = cursor.fetchone()
        if not tipo:
            cursor.close(); conn.close()
            raise HTTPException(status_code=400, detail='TipoPersona no existe')
        
        # Check unique CI excluding current id
        cursor.execute('SELECT id_persona FROM persona_O WHERE ci_persona = %s AND id_persona <> %s', (ci, id))
        dup = cursor.fetchone()
        if dup:
            cursor.close(); conn.close()
            raise HTTPException(status_code=400, detail='CI ya registrado')
        
        cur2 = conn.cursor()
        cur2.execute('UPDATE persona_O SET nombres_persona=%s, apellido_paternoPersona=%s, apellido_maternoPer=%s, telefono_persona=%s, id_tipoPersona=%s, ci_persona=%s, direccion_persona=%s, tipo_cliente=%s, idRuta=%s WHERE id_persona=%s',
            (nombres, payload.apellido_paternoPersona, payload.apellido_maternoPer, payload.telefono_persona, payload.id_tipoPersona, ci, direccion, payload.tipo_cliente, payload.idRuta, id))
        conn.commit()
        cur2.close(); cursor.close(); conn.close()
        
        return {**payload.dict(), 'id_persona': id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete('/persons/{id}', status_code=204)
async def delete_person(
    id: int,
    x_user_role: Optional[str] = Header(None),
    request: Request = None
):
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Multi-empresa security: only delete persons from user's company
        jwt_company_id = get_company_id_from_request(request)
        if role != 'superadmin':
            if jwt_company_id is None:
                cursor.close(); conn.close()
                raise HTTPException(status_code=400, detail='No se pudo determinar la empresa del usuario')
            cursor.execute('DELETE FROM persona_O WHERE id_persona = %s AND id_empresa = %s', (id, jwt_company_id))
        else:
            cursor.execute('DELETE FROM persona_O WHERE id_persona = %s', (id,))
            
        conn.commit()
        affected = cursor.rowcount
        cursor.close()
        conn.close()
        if affected == 0:
            raise HTTPException(status_code=404, detail='Persona no encontrada o no pertenece a su empresa')
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
    role = get_role(x_user_role, request)
    if role not in ['admin', 'superadmin']:
        raise HTTPException(status_code=403, detail='Acceso denegado')
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        if role == 'superadmin':
            # Superadmin ve todos los roles (globales y de todas las empresas)
            cur.execute('''
                SELECT r.idrole, r.name, r.description, r.id_empresa, e.nombre_empresa
                FROM role_O r
                LEFT JOIN empresa_O e ON r.id_empresa = e.id_empresa
                ORDER BY r.id_empresa IS NULL DESC, e.nombre_empresa, r.idrole
            ''')
        else:
            # Admin solo ve roles globales (base) y los de su empresa
            company_id = get_company_id_from_request(request)
            if company_id is None:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='No se pudo determinar la empresa del usuario')
            
            cur.execute('''
                SELECT r.idrole, r.name, r.description, r.id_empresa, e.nombre_empresa
                FROM role_O r
                LEFT JOIN empresa_O e ON r.id_empresa = e.id_empresa
                WHERE (r.id_empresa IS NULL AND r.name != 'superadmin') OR r.id_empresa = %s
                ORDER BY r.id_empresa IS NULL DESC, r.idrole
            ''', (company_id,))
        
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/roles', status_code=201)
def create_role(payload: RoleIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ['admin', 'superadmin']:
        raise HTTPException(status_code=403, detail='Acceso denegado')
    
    name = payload.name.strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail='name required')
    if name in ('admin','editor','viewer','superadmin'):
        raise HTTPException(status_code=400, detail='Cannot create a built-in role')
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        # Determinar id_empresa
        if role == 'superadmin':
            # Superadmin puede crear roles globales (NULL) o para una empresa específica
                id_empresa = payload.id_empresa
        else:
            # Admin solo puede crear roles para su propia empresa
            id_empresa = get_company_id_from_request(request)
            if id_empresa is None:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='No se pudo determinar la empresa del usuario')
        
        # Verificar unicidad del nombre dentro del contexto (empresa o global)
        if id_empresa:
            cur.execute('SELECT idrole FROM role_O WHERE name = %s AND id_empresa = %s', (name, id_empresa))
        else:
            cur.execute('SELECT idrole FROM role_O WHERE name = %s AND id_empresa IS NULL', (name,))
        
        if cur.fetchone():
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Role name already exists in this context')
        
        ins = conn.cursor()
        ins.execute('INSERT INTO role_O (name, description, id_empresa) VALUES (%s,%s,%s)', 
                   (name, payload.description, id_empresa))
        conn.commit()
        new_id = ins.lastrowid
        ins.close()
        cur.close()
        conn.close()
        
        return {'idrole': new_id, 'name': name, 'description': payload.description, 'id_empresa': id_empresa}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/roles/{id}')
def update_role(id: int, payload: RoleIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ['admin', 'superadmin']:
        raise HTTPException(status_code=403, detail='Acceso denegado')
    
    name = payload.name.strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail='name required')
    if name in ('admin','editor','viewer','superadmin') and id not in (1,2,3,4):
        raise HTTPException(status_code=400, detail='Reserved role name')
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        # Obtener el rol existente
        cur.execute('SELECT idrole, name, id_empresa FROM role_O WHERE idrole = %s', (id,))
        ex = cur.fetchone()
        if not ex:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Role not found')
        
        # Verificar permisos de acceso
        if role != 'superadmin':
            # Admin solo puede editar roles de su empresa
            company_id = get_company_id_from_request(request)
            if company_id is None:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='No se pudo determinar la empresa del usuario')
            
            if ex['id_empresa'] != company_id:
                cur.close()
                conn.close()
                raise HTTPException(status_code=403, detail='No tiene permisos para editar este rol')
        
        # No permitir renombrar roles built-in
        if ex['name'] in ('admin','editor','viewer','superadmin') and ex['name'] != name:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Cannot rename built-in role')
        
        # Verificar unicidad del nombre
        if ex['id_empresa']:
            cur.execute('SELECT idrole FROM role_O WHERE name = %s AND id_empresa = %s AND idrole <> %s', 
                       (name, ex['id_empresa'], id))
        else:
            cur.execute('SELECT idrole FROM role_O WHERE name = %s AND id_empresa IS NULL AND idrole <> %s', 
                       (name, id))
        
        if cur.fetchone():
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Role name already exists')
        
        up = conn.cursor()
        up.execute('UPDATE role_O SET name=%s, description=%s WHERE idrole=%s', (name, payload.description, id))
        conn.commit()
        up.close()
        cur.close()
        conn.close()
        
        return {'idrole': id, 'name': name, 'description': payload.description, 'id_empresa': ex['id_empresa']}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete('/roles/{id}', status_code=204)
def delete_role(id, x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ['admin', 'superadmin']:
        raise HTTPException(status_code=403, detail='Acceso denegado')
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        cur.execute('SELECT name, id_empresa FROM role_O WHERE idrole = %s', (id,))
        r = cur.fetchone()
        if not r:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Role not found')
        
        # No se pueden eliminar roles built-in
        if r['name'] in ('admin','editor','viewer','superadmin'):
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Cannot delete built-in role')
        
        # Verificar permisos de acceso
        if role != 'superadmin':
            company_id = get_company_id_from_request(request)
            if company_id is None:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='No se pudo determinar la empresa del usuario')
            
            if r['id_empresa'] != company_id:
                cur.close()
                conn.close()
                raise HTTPException(status_code=403, detail='No tiene permisos para eliminar este rol')
        
        # Verificar usuarios asignados
        cur.execute('SELECT COUNT(1) AS cnt FROM user_O WHERE id_role = %s', (id,))
        cnt = cur.fetchone()
        if cnt and cnt['cnt'] > 0:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Role has assigned users')
        
        # Eliminar permisos asociados y luego el rol
        d1 = conn.cursor()
        d1.execute('DELETE FROM role_permission_O WHERE role_id = %s', (id,))
        d1.close()
        
        d2 = conn.cursor()
        d2.execute('DELETE FROM role_O WHERE idrole = %s', (id,))
        conn.commit()
        d2.close()
        
        cur.close()
        conn.close()
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
    """Return permission ids for a role, filtered by company context for admins; superadmin returns global (NULL) perms."""
    role = get_role(x_user_role, request)
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        if role == 'superadmin':
            # Superadmin: global permissions only
            cur.execute('SELECT perm_id FROM role_permission_O WHERE role_id = %s AND id_empresa IS NULL', (id,))
        else:
            company_id = get_company_id_from_request(request)
            if company_id is None:
                cur.close(); conn.close()
                raise HTTPException(status_code=400, detail='No se pudo determinar la empresa del usuario')
            cur.execute('SELECT perm_id FROM role_permission_O WHERE role_id = %s AND (id_empresa = %s OR id_empresa IS NULL)', (id, company_id))
        rows = cur.fetchall(); cur.close(); conn.close();
        return [r['perm_id'] for r in rows]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/roles/matrix')
def get_roles_matrix(company_id: Optional[int] = None, x_user_role: Optional[str] = Header(None), request: Request = None):
    """Devuelve una matriz roles x permisos para una empresa (o global si company_id es null).
    Formato: { roles: [...], permissions: [...], assignments: { [role_id]: [perm_id,...] } }
    Superadmin: puede pasar cualquier company_id (o omitido para global). Admin: sólo su propia empresa.
    """
    role = get_role(x_user_role, request)
    if role not in ['admin','superadmin']:
        raise HTTPException(status_code=403, detail='Acceso denegado')
    if role != 'superadmin':
        # For admin force company_id to its own
        user_company_id = get_company_id_from_request(request)
        if user_company_id is None:
            raise HTTPException(status_code=400, detail='No se pudo determinar la empresa del usuario')
        company_id = user_company_id
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        # Roles disponibles en este contexto (similar a list_roles lógica simplificada)
        if role == 'superadmin' and company_id is None:
            cur.execute('''SELECT idrole, name, description, id_empresa FROM role_O WHERE id_empresa IS NULL ORDER BY idrole''')
        elif role == 'superadmin':
            # company-specific + global (excluye superadmin global aparte de list)
            cur.execute('''SELECT idrole, name, description, id_empresa FROM role_O WHERE id_empresa IS NULL OR id_empresa = %s ORDER BY id_empresa IS NULL DESC, idrole''', (company_id,))
        else:
            cur.execute('''SELECT idrole, name, description, id_empresa FROM role_O WHERE (id_empresa IS NULL AND name != 'superadmin') OR id_empresa = %s ORDER BY id_empresa IS NULL DESC, idrole''', (company_id,))
        roles = cur.fetchall()
        # Permisos base
        pcur = conn.cursor(dictionary=True); pcur.execute('SELECT id_perm, resource, action, description FROM permission_O ORDER BY resource, action'); permissions = pcur.fetchall(); pcur.close()
        # Asignaciones (solo scoped a la empresa si company_id especificado, si global company_id None usamos id_empresa IS NULL)
        matrix = {}
        for r in roles:
            rc = conn.cursor(dictionary=True)
            if company_id is None:
                rc.execute('SELECT perm_id FROM role_permission_O WHERE role_id=%s AND id_empresa IS NULL', (r['idrole'],))
            else:
                # incluir también global (NULL) para que se visualicen heredados? -> Mantener sólo propios a la empresa para simplificar UI; heredados se pueden ver aparte
                rc.execute('SELECT perm_id FROM role_permission_O WHERE role_id=%s AND (id_empresa = %s OR id_empresa IS NULL)', (r['idrole'], company_id))
            matrix[r['idrole']] = [row['perm_id'] for row in rc.fetchall()] ; rc.close()
        cur.close(); conn.close()
        return {'roles': roles, 'permissions': permissions, 'assignments': matrix, 'company_id': company_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class RoleMatrixUpdate(BaseModel):
    company_id: Optional[int]
    changes: List[Dict[str, Dict[str, int]]]  # each dict contains role_id, perm_id, assigned (as 0/1 or bool)

@app.post('/roles/matrix/update')
def update_roles_matrix(payload: RoleMatrixUpdate, x_user_role: Optional[str] = Header(None), request: Request = None):
    """Actualiza asignaciones de permisos en lote para una empresa.
    Cada cambio indica si debe existir (assigned true) o eliminarse (assigned false) una fila en role_permission_O.
    Reglas:
      - Admin sólo su empresa.
      - Superadmin puede global (company_id null) o cualquier empresa.
    """
    role = get_role(x_user_role, request)
    if role not in ['admin','superadmin']:
        raise HTTPException(status_code=403, detail='Acceso denegado')
    target_company_id = payload.company_id
    if role != 'superadmin':
        user_company_id = get_company_id_from_request(request)
        if user_company_id is None:
            raise HTTPException(status_code=400, detail='No se pudo determinar la empresa del usuario')
        if target_company_id is not None and target_company_id != user_company_id:
            raise HTTPException(status_code=403, detail='Solo puede modificar su propia empresa')
        target_company_id = user_company_id  # force
    # Validar lista
    if not payload.changes:
        return {'updated': 0}
    try:
        conn = get_db_connection(); updated = 0
        for ch in payload.changes:
            role_id = ch.get('role_id'); perm_id = ch.get('perm_id'); assigned = ch.get('assigned')
            if not role_id or not perm_id or assigned not in [True, False]:
                continue
            cursor = conn.cursor()
            if assigned:
                # Insert IGNORE para evitar duplicados
                if target_company_id is None:
                    cursor.execute('INSERT IGNORE INTO role_permission_O (role_id, perm_id, id_empresa) VALUES (%s,%s,NULL)', (role_id, perm_id))
                else:
                    cursor.execute('INSERT IGNORE INTO role_permission_O (role_id, perm_id, id_empresa) VALUES (%s,%s,%s)', (role_id, perm_id, target_company_id))
                updated += cursor.rowcount
            else:
                # Delete tanto scoped como global si company_id None
                if target_company_id is None:
                    cursor.execute('DELETE FROM role_permission_O WHERE role_id=%s AND perm_id=%s AND id_empresa IS NULL', (role_id, perm_id))
                else:
                    cursor.execute('DELETE FROM role_permission_O WHERE role_id=%s AND perm_id=%s AND (id_empresa=%s OR id_empresa IS NULL)', (role_id, perm_id, target_company_id))
                updated += cursor.rowcount
            cursor.close()
        conn.commit(); conn.close()
        return {'updated': updated}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Removed legacy set_role_permissions to avoid duplicate route and 204 responses; use update_role_permissions instead.


# User management endpoints
@app.get('/users')
def list_users(x_user_role: Optional[str] = Header(None), request: Request = None):
    require_admin(x_user_role, request)
    try:
        role = get_role(x_user_role, request)
        company_id = get_company_id_from_request(request)
        
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        # Include company information for proper display in RoleManagement
        # Superadmin: see all users INCLUDING other superadmins
        # Admin: only see users from their company, EXCLUDING superadmins
        if role == 'superadmin':
            # Superadmin ve todos los usuarios (incluyendo otros superadmins)
            cur.execute('''
                SELECT u.id_user, u.username, u.id_persona, u.id_role, u.estado,
                       p.nombres_persona, p.apellido_paternoPersona, 
                       p.ci_persona, p.id_empresa, p.fotoPersona,
                       e.nombre_empresa, r.name as role_name
                FROM user_O u
                LEFT JOIN persona_O p ON u.id_persona = p.id_persona
                LEFT JOIN empresa_O e ON p.id_empresa = e.id_empresa
                LEFT JOIN role_O r ON u.id_role = r.idrole
                ORDER BY FIELD(r.name, 'superadmin', 'admin', 'cliente'), e.nombre_empresa, u.id_user
            ''')
        else:
            # Admin: solo usuarios de su empresa, excluyendo superadmins
            cur.execute('''
                SELECT u.id_user, u.username, u.id_persona, u.id_role, u.estado,
                       p.nombres_persona, p.apellido_paternoPersona, 
                       p.ci_persona, p.id_empresa, p.fotoPersona,
                       e.nombre_empresa, r.name as role_name
                FROM user_O u
                LEFT JOIN persona_O p ON u.id_persona = p.id_persona
                LEFT JOIN empresa_O e ON p.id_empresa = e.id_empresa
                LEFT JOIN role_O r ON u.id_role = r.idrole
                WHERE p.id_empresa = %s AND r.name != 'superadmin'
                ORDER BY u.id_user
            ''', (company_id,))
        
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/users/{id}')
def update_user(id: int, payload: UserUpdateIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    # Only admin/superadmin can update users at all
    role = get_role(x_user_role, request)
    if role not in ('admin', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')

    if not payload.username:
        raise HTTPException(status_code=400, detail='username required')
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Check target user exists and get their company via persona
        cursor.execute('''
            SELECT u.id_user, u.username, u.id_persona, u.id_role, u.estado, p.id_empresa AS target_company
            FROM user_O u
            LEFT JOIN persona_O p ON u.id_persona = p.id_persona
            WHERE u.id_user = %s
        ''', (id,))
        target = cursor.fetchone()
        if not target:
            cursor.close(); conn.close()
            raise HTTPException(status_code=404, detail='User not found')

        # Username uniqueness (excluding current)
        cursor.execute('SELECT id_user FROM user_O WHERE username = %s AND id_user <> %s', (payload.username, id))
        if cursor.fetchone():
            cursor.close(); conn.close()
            raise HTTPException(status_code=400, detail='username already exists')

        # Estado update restrictions: admin (same company) OR superadmin (any)
        estado_to_set = payload.estado
        if estado_to_set is not None:
                if role == 'admin':
                    admin_company = get_company_id_from_request(request)
                    if admin_company is None or (target.get('target_company') is not None and target['target_company'] != admin_company):
                        cursor.close(); conn.close()
                        raise HTTPException(status_code=403, detail='Solo puede cambiar estado de usuarios de su empresa')
                elif role == 'superadmin':
                    # superadmin puede cambiar estado de cualquier usuario
                    pass
                else:
                    cursor.close(); conn.close()
                    raise HTTPException(status_code=403, detail='No tiene permisos para cambiar el estado de usuarios')

        # Build update dynamically
        params = []
        set_clauses = ['username=%s']
        params.append(payload.username)

        if payload.password:
            pw_hash = hash_password(payload.password)
            set_clauses.append('password_hash=%s')
            params.append(pw_hash)

        set_clauses.append('id_persona=%s')
        params.append(payload.id_persona)
        set_clauses.append('id_role=%s')
        params.append(payload.id_role)

        # Only include estado if allowed by previous check
        if estado_to_set is not None:
            set_clauses.append('estado=%s')
            params.append(int(estado_to_set))

        sql = f"UPDATE user_O SET {', '.join(set_clauses)} WHERE id_user=%s"
        params.append(id)
        cursor.execute(sql, tuple(params))
        conn.commit()
        cursor.close(); conn.close()
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


# ============== SUPERADMIN SPECIFIC FUNCTIONS ==============

@app.post('/admin/users', status_code=201)
def superadmin_create_user(payload: SuperAdminUserCreateIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    """Superadmin can create users for any company with any role"""
    role = get_role(x_user_role, request)
    if role != 'superadmin':
        raise HTTPException(status_code=403, detail='Solo el superadmin puede crear usuarios para cualquier empresa')
    
    # Validate input
    if not payload.username.strip() or not payload.password or not payload.nombres_persona.strip():
        raise HTTPException(status_code=400, detail='Campos requeridos faltantes')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Check if username exists
        cursor.execute('SELECT id_user FROM user_O WHERE username = %s', (payload.username,))
        if cursor.fetchone():
            cursor.close(); conn.close()
            raise HTTPException(status_code=400, detail='El nombre de usuario ya existe')
        
        # Check if CI exists
        cursor.execute('SELECT id_persona FROM persona_O WHERE ci_persona = %s', (payload.ci_persona,))
        if cursor.fetchone():
            cursor.close(); conn.close()
            raise HTTPException(status_code=400, detail='El CI ya está registrado')
        
        # Validate company exists
        cursor.execute('SELECT id_empresa FROM empresa_O WHERE id_empresa = %s', (payload.id_empresa,))
        if not cursor.fetchone():
            cursor.close(); conn.close()
            raise HTTPException(status_code=400, detail='La empresa especificada no existe')
        
        # Validate tipo_persona exists
        cursor.execute('SELECT idtipoPers FROM tipo_personaO WHERE idtipoPers = %s', (payload.id_tipoPersona,))
        if not cursor.fetchone():
            cursor.close(); conn.close()
            raise HTTPException(status_code=400, detail='El tipo de persona no existe')
        
        # Get role ID
        cursor.execute('SELECT idrole FROM role_O WHERE name = %s', (payload.role_name,))
        role_record = cursor.fetchone()
        if not role_record:
            cursor.close(); conn.close()
            raise HTTPException(status_code=400, detail=f'El rol "{payload.role_name}" no existe')
        
        # Create person first
        cur2 = conn.cursor()
        cur2.execute('''INSERT INTO persona_O 
                       (nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, 
                        id_tipoPersona, ci_persona, direccion_persona, fotoPersona, id_empresa) 
                       VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)''',
                    (payload.nombres_persona, payload.apellido_paternoPersona, payload.apellido_maternoPer,
                     payload.telefono_persona, payload.id_tipoPersona, payload.ci_persona,
                     payload.direccion_persona, None, payload.id_empresa))
        
        persona_id = cur2.lastrowid
        
        # Create user
        password_hash = hash_password(payload.password)
        cur2.execute('INSERT INTO user_O (username, password_hash, id_persona, id_role) VALUES (%s,%s,%s,%s)',
                    (payload.username, password_hash, persona_id, role_record['idrole']))
        
        user_id = cur2.lastrowid
        conn.commit()
        cur2.close(); cursor.close(); conn.close()
        
        return {
            'id_user': user_id,
            'username': payload.username,
            'id_persona': persona_id,
            'role_name': payload.role_name,
            'id_empresa': payload.id_empresa,
            'message': f'Usuario creado exitosamente para la empresa ID {payload.id_empresa} con rol {payload.role_name}'
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/admin/users')
def superadmin_list_all_users(x_user_role: Optional[str] = Header(None), request: Request = None):
    """Superadmin can see all users from all companies"""
    role = get_role(x_user_role, request)
    if role != 'superadmin':
        raise HTTPException(status_code=403, detail='Solo el superadmin puede ver usuarios de todas las empresas')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute('''
            SELECT u.id_user, u.username, p.nombres_persona, p.apellido_paternoPersona, 
                   p.ci_persona, e.nombre_empresa, r.name as role_name, p.id_empresa
            FROM user_O u
            JOIN persona_O p ON u.id_persona = p.id_persona
            JOIN empresa_O e ON p.id_empresa = e.id_empresa
            JOIN role_O r ON u.id_role = r.idrole
            ORDER BY e.nombre_empresa, u.username
        ''')
        
        users = cursor.fetchall()
        cursor.close(); conn.close()
        
        return {'users': users}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# === ENDPOINTS PARA ADMINISTRACIÓN DE ROLES Y PERMISOS ===

@app.get('/permissions')
def list_permissions(x_user_role: Optional[str] = Header(None), request: Request = None):
    """List all permissions available in the system"""
    role = get_role(x_user_role, request)
    if role not in ['admin', 'superadmin']:
        raise HTTPException(status_code=403, detail='Acceso denegado')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT id_perm, resource, action FROM permission_O ORDER BY resource, action')
        permissions = cursor.fetchall()
        cursor.close()
        conn.close()
        return permissions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/role-permissions')
def list_role_permissions(x_user_role: Optional[str] = Header(None), request: Request = None):
    """List role-permission mappings filtered by user's company (admin) or all (superadmin)"""
    role = get_role(x_user_role, request)
    if role not in ['admin', 'superadmin']:
        raise HTTPException(status_code=403, detail='Acceso denegado')
    
    company_id = get_company_id_from_request(request)
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        if role == 'superadmin':
            # Superadmin ve todos los permisos (globales y de todas las empresas)
            cursor.execute('''
                SELECT rp.role_id, rp.perm_id, rp.id_empresa, r.name as role_name, p.resource, p.action,
                       e.nombre_empresa
                FROM role_permission_O rp
                JOIN role_O r ON rp.role_id = r.idrole
                JOIN permission_O p ON rp.perm_id = p.id_perm
                LEFT JOIN empresa_O e ON rp.id_empresa = e.id_empresa
                ORDER BY rp.id_empresa, r.name, p.resource, p.action
            ''')
        else:
            # Admin solo ve permisos de su empresa
            cursor.execute('''
                SELECT rp.role_id, rp.perm_id, rp.id_empresa, r.name as role_name, p.resource, p.action,
                       e.nombre_empresa
                FROM role_permission_O rp
                JOIN role_O r ON rp.role_id = r.idrole
                JOIN permission_O p ON rp.perm_id = p.id_perm
                LEFT JOIN empresa_O e ON rp.id_empresa = e.id_empresa
                WHERE rp.id_empresa = %s OR rp.id_empresa IS NULL
                ORDER BY rp.id_empresa, r.name, p.resource, p.action
            ''', (company_id,))
        
        role_permissions = cursor.fetchall()
        cursor.close()
        conn.close()
        return role_permissions
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put('/roles/{role_id}/permissions', status_code=204)
def update_role_permissions(
    role_id: int,
    payload: dict,
    x_user_role: Optional[str] = Header(None),
    request: Request = None
):
    """Update permissions for a specific role for a specific company or globally (superadmin)"""
    print(f"🎯 ENTRY: update_role_permissions called with role_id={role_id}")
    role = get_role(x_user_role, request)
    if role not in ['admin', 'superadmin']:
        raise HTTPException(status_code=403, detail='Acceso denegado')
    
    # Get company_id from JWT token
    company_id = get_company_id_from_request(request)
    
    # Superadmin can set global permissions (id_empresa = NULL) or for any company
    # Admin can only set permissions for their own company
    if role != 'superadmin' and company_id is None:
        raise HTTPException(status_code=400, detail='No se pudo determinar la empresa del usuario')
    
    # Support both 'permission_ids' and 'perm_ids' for backwards compatibility
    permission_ids = payload.get('permission_ids', payload.get('perm_ids', []))
    print(f"🔍 DEBUG: Updating permissions for role_id={role_id}, company_id={company_id}, user_role={role}")
    print(f"🔍 DEBUG: Received payload: {payload}")
    print(f"🔍 DEBUG: Extracted permission_ids: {permission_ids}")
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Verificar que el rol existe
        cursor.execute('SELECT name FROM role_O WHERE idrole = %s', (role_id,))
        role_data = cursor.fetchone()
        if not role_data:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Rol no encontrado')
        
        # Admin no puede modificar superadmin
        if role == 'admin' and role_data['name'] == 'superadmin':
            cursor.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No puedes modificar permisos del superadmin')
        
        # Nota importante sobre PK: role_permission_O tiene PK (role_id, perm_id) en esta base.
        # Para evitar errores 500 por duplicidad entre global (NULL) y por empresa, antes de insertar
        # siempre eliminamos por (role_id, perm_id) sin importar empresa.
        # Primero, si recibimos una lista vacía, eliminamos TODOS los permisos de ese ámbito.
        if role == 'superadmin':
            target_company = payload.get('target_company_id', None)
            if target_company is None:
                # Limpiar globales (NULL) para el rol
                cursor.execute('DELETE FROM role_permission_O WHERE role_id = %s AND id_empresa IS NULL', (role_id,))
            else:
                # Limpiar permisos de la empresa específica
                cursor.execute('DELETE FROM role_permission_O WHERE role_id = %s AND id_empresa = %s', (role_id, target_company))
        else:
            cursor.execute('DELETE FROM role_permission_O WHERE role_id = %s AND id_empresa = %s', (role_id, company_id))
        
        # Agregar nuevos permisos
        if permission_ids:
            target_company = company_id
            if role == 'superadmin':
                # Superadmin puede establecer permisos globales o para una empresa específica
                target_company = payload.get('target_company_id', None)
            
            # Validate permission IDs before insertion to prevent 500 errors
            valid_perm_ids = []
            for perm_id in permission_ids:
                if not isinstance(perm_id, int):
                    continue  # Skip non-integer IDs
                # Check if permission exists in the database
                cursor.execute('SELECT id_perm FROM permission_O WHERE id_perm = %s', (perm_id,))
                if cursor.fetchone():
                    valid_perm_ids.append(perm_id)
                else:
                    print(f"⚠️ WARNING: Permission ID {perm_id} not found in permission_O - skipping")
            
            if not valid_perm_ids and permission_ids:
                # If user sent IDs but none were valid, return 400
                cursor.close()
                conn.close()
                raise HTTPException(status_code=400, detail='No se encontraron permisos válidos en la base de datos')
            
            # Para cada permiso, eliminar cualquier fila existente (cualquier empresa o NULL) y luego insertar
            for perm_id in valid_perm_ids:
                cursor.execute('DELETE FROM role_permission_O WHERE role_id = %s AND perm_id = %s', (role_id, perm_id))
                cursor.execute(
                    'INSERT INTO role_permission_O (role_id, perm_id, id_empresa) VALUES (%s, %s, %s)',
                    (role_id, perm_id, target_company)
                )
        
        conn.commit()
        cursor.close()
        conn.close()
        
        # Return 204 No Content for compatibility with existing frontend
        return Response(status_code=204)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ ERROR updating role permissions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ========== AUTO-SYNC PERMISSIONS SYSTEM ==========

@app.get('/permissions/pages')
def get_available_pages(x_user_role: Optional[str] = Header(None), request: Request = None):
    """
    Returns all pages defined in the frontend App.jsx with their corresponding permissions.
    This endpoint reads the usePermissions.js mapping to discover all available pages.
    """
    require_admin(x_user_role, request)
    
    # Define the canonical mapping between pages and permissions
    # This should match the logic in frontend/src/hooks/usePermissions.js
    page_permissions = {
        'tipos': {'resource': 'tipos', 'action': 'view', 'description': 'Ver tipos'},
        'personas': {'resource': 'personas', 'action': 'view', 'description': 'Ver personas'},
        'personas_mapa': {'resource': 'personas', 'action': 'view', 'description': 'Ver personas en mapa'},
        'empleados': {'resource': 'personas', 'action': 'view', 'description': 'Ver empleados'},
        'empresas': {'resource': 'empresas', 'action': 'view', 'description': 'Ver empresas'},
        'prestamos': {'resource': 'prestamos', 'action': 'view', 'description': 'Ver prestamos'},
        'productos': {'resource': 'productos', 'action': 'view', 'description': 'Ver productos'},
        'caja': {'resource': 'caja', 'action': 'view', 'description': 'Ver caja'},
        'ventas': {'resource': 'ventas', 'action': 'view', 'description': 'Ver ventas'},
        'predicciones': {'resource': 'ventas', 'action': 'view', 'description': 'Ver predicciones (IA)'},
        'creditos': {'resource': 'ventas', 'action': 'view', 'description': 'Ver creditos (Admin)'},
        'misdeudas': {'resource': 'none', 'action': 'none', 'description': 'Ver mis deudas (todos los usuarios)'},
        'compras': {'resource': 'compras', 'action': 'view', 'description': 'Ver compras'},
        'gastos': {'resource': 'caja', 'action': 'view', 'description': 'Ver gastos'},
        'proveedores': {'resource': 'proveedores', 'action': 'view', 'description': 'Ver proveedores'},
        'rutas': {'resource': 'rutas', 'action': 'view', 'description': 'Ver rutas'},
        'cuentas': {'resource': 'cuentas', 'action': 'view', 'description': 'Ver cuentas'},
        'usuarios': {'resource': 'roles', 'action': 'manage', 'description': 'Administrar usuarios'},
        'roles': {'resource': 'roles', 'action': 'manage', 'description': 'Administrar roles y permisos'},
        'superadmin': {'resource': 'superadmin', 'action': 'access', 'description': 'Acceso SuperAdmin'}
    }
    
    return {
        'pages': page_permissions,
        'total': len(page_permissions)
    }


@app.post('/permissions/sync')
def sync_permissions(x_user_role: Optional[str] = Header(None), request: Request = None):
    """
    Synchronizes permissions in the database with the pages defined in the frontend.
    Creates missing permissions automatically based on the page definitions.
    Returns a report of created permissions.
    """
    require_admin(x_user_role, request)
    
    try:
        # Get all defined pages and their permissions
        pages_data = get_available_pages(x_user_role, request)
        page_permissions = pages_data['pages']
        
        # Connect to database
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Get existing permissions
        cursor.execute('SELECT resource, action FROM permission_O')
        existing_perms = {(row['resource'], row['action']) for row in cursor.fetchall()}
        
        # Find missing permissions
        missing_perms = []
        for page, perm_data in page_permissions.items():
            resource = perm_data['resource']
            action = perm_data['action']
            
            # Skip special cases that don't need database permissions
            if resource == 'none':
                continue
            
            if (resource, action) not in existing_perms:
                missing_perms.append({
                    'page': page,
                    'resource': resource,
                    'action': action,
                    'description': perm_data['description']
                })
        
        # Create missing permissions
        created = []
        for perm in missing_perms:
            cursor.execute(
                'INSERT INTO permission_O (resource, action, description) VALUES (%s, %s, %s)',
                (perm['resource'], perm['action'], perm['description'])
            )
            created.append({
                'page': perm['page'],
                'permission': f"{perm['resource']}:{perm['action']}",
                'description': perm['description']
            })
        
        conn.commit()
        
        # Also ensure all CRUD operations exist for each resource
        resources = set()
        for page, perm_data in page_permissions.items():
            if perm_data['resource'] != 'none':
                resources.add(perm_data['resource'])
        
        # Standard CRUD actions for each resource
        crud_actions = ['view', 'create', 'update', 'delete']
        crud_created = []
        
        for resource in resources:
            # Skip special resources that don't need full CRUD
            if resource in ['superadmin', 'roles']:
                continue
            
            for action in crud_actions:
                if (resource, action) not in existing_perms:
                    # Check if we already created it
                    already_created = any(p['resource'] == resource and p['action'] == action for p in missing_perms)
                    if not already_created:
                        description = f"{action.capitalize()} {resource}"
                        if action == 'view':
                            description = f"Ver {resource}"
                        elif action == 'create':
                            description = f"Crear {resource}"
                        elif action == 'update':
                            description = f"Actualizar {resource}"
                        elif action == 'delete':
                            description = f"Eliminar {resource}"
                        
                        cursor.execute(
                            'INSERT INTO permission_O (resource, action, description) VALUES (%s, %s, %s)',
                            (resource, action, description)
                        )
                        crud_created.append({
                            'permission': f"{resource}:{action}",
                            'description': description
                        })
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            'success': True,
            'created_from_pages': created,
            'created_crud': crud_created,
            'total_created': len(created) + len(crud_created),
            'message': f"Sincronizacion completada: {len(created)} permisos de paginas + {len(crud_created)} permisos CRUD creados"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ ERROR syncing permissions: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ================== FIRMAS DIGITALES ==================

def ensure_firma_table():
    try:
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS firma_documento_O (
                id_firma INT AUTO_INCREMENT PRIMARY KEY,
                id_empresa INT NOT NULL,
                id_persona INT NOT NULL,
                tipo_documento VARCHAR(40) NOT NULL,
                id_referencia VARCHAR(100) NULL,
                data_png MEDIUMTEXT NOT NULL,
                hash_sha256 CHAR(64) NOT NULL,
                width INT NULL,
                height INT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_firma_empresa_persona (id_empresa, id_persona),
                INDEX idx_firma_tipo (tipo_documento)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ''')
        conn.commit(); cur.close(); conn.close()
    except Exception as e:
        print(f"Error ensure_firma_table: {e}")

def ensure_face_table():
    try:
        conn = get_db_connection(); cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS persona_face_O (
                id_face INT AUTO_INCREMENT PRIMARY KEY,
                id_empresa INT NOT NULL,
                id_persona INT NOT NULL,
                data_jpg MEDIUMTEXT NOT NULL,
                hash_sha256 CHAR(64) NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_face_empresa_persona (id_empresa, id_persona)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        ''')
        conn.commit(); cur.close(); conn.close()
    except Exception as e:
        print(f"Error ensure_face_table: {e}")


@app.post('/firmas', response_model=FirmaOut)
def crear_firma(payload: SignFirmaIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    """Registra una firma digital PNG (data URL) asociada a una persona y tipo de documento."""
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    if not payload.data_url.startswith('data:image'):
        raise HTTPException(status_code=400, detail='Formato data_url inválido')
    # Extraer base64
    try:
        b64_part = payload.data_url.split(',')[1]
    except Exception:
        raise HTTPException(status_code=400, detail='data_url mal formado')
    # Validar tamaño (< 2MB)
    try:
        raw_bytes = base64.b64decode(b64_part)
    except Exception:
        raise HTTPException(status_code=400, detail='Base64 inválido')
    if len(raw_bytes) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail='Firma demasiado grande (max 2MB)')
    sha = hashlib.sha256(raw_bytes).hexdigest()
    # Scope empresa
    user_company = get_company_id_from_request(request)
    try:
        conn = get_db_connection(); ensure_firma_table(); cur = conn.cursor(dictionary=True)
        # Validar persona pertenece a empresa (si no superadmin)
        if role != 'superadmin' and user_company is not None:
            cur.execute('SELECT id_persona, id_empresa FROM persona_O WHERE id_persona=%s AND id_empresa=%s', (payload.id_persona, user_company))
        else:
            cur.execute('SELECT id_persona, id_empresa FROM persona_O WHERE id_persona=%s', (payload.id_persona,))
        pr = cur.fetchone()
        if not pr:
            cur.close(); conn.close(); raise HTTPException(status_code=404, detail='Persona no encontrada')
        id_empresa = pr['id_empresa']
        ins = conn.cursor()
        ins.execute('''
            INSERT INTO firma_documento_O (id_empresa, id_persona, tipo_documento, id_referencia, data_png, hash_sha256, width, height)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
        ''', (id_empresa, payload.id_persona, payload.tipo_documento, payload.id_referencia, payload.data_url, sha, payload.width, payload.height))
        conn.commit()
        new_id = ins.lastrowid
        ins.close(); cur.close(); conn.close()
        return {
            'id_firma': new_id,
            'id_persona': payload.id_persona,
            'tipo_documento': payload.tipo_documento,
            'id_referencia': payload.id_referencia,
            'created_at': datetime.utcnow(),
            'width': payload.width,
            'height': payload.height
        }
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/firmas', response_model=List[FirmaOut])
def listar_firmas(id_persona: Optional[int] = None, tipo_documento: Optional[str] = None, limit: int = 50, x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    limit = max(1, min(200, limit))
    user_company = get_company_id_from_request(request)
    try:
        conn = get_db_connection(); ensure_firma_table(); cur = conn.cursor(dictionary=True)
        base = 'SELECT id_firma, id_persona, tipo_documento, id_referencia, created_at, width, height FROM firma_documento_O WHERE 1=1'
        params = []
        if role != 'superadmin' and user_company is not None:
            base += ' AND id_empresa=%s'; params.append(user_company)
        if id_persona:
            base += ' AND id_persona=%s'; params.append(id_persona)
        if tipo_documento:
            base += ' AND tipo_documento=%s'; params.append(tipo_documento)
        base += ' ORDER BY created_at DESC LIMIT %s'; params.append(limit)
        cur.execute(base, params)
        rows = cur.fetchall(); cur.close(); conn.close()
        return rows
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/firmas/{id_firma}')
def obtener_firma(id_firma: int, x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    user_company = get_company_id_from_request(request)
    try:
        conn = get_db_connection(); ensure_firma_table(); cur = conn.cursor(dictionary=True)
        if role != 'superadmin' and user_company is not None:
            cur.execute('SELECT id_firma, id_persona, tipo_documento, id_referencia, created_at, width, height, data_png FROM firma_documento_O WHERE id_firma=%s AND id_empresa=%s', (id_firma, user_company))
        else:
            cur.execute('SELECT id_firma, id_persona, tipo_documento, id_referencia, created_at, width, height, data_png FROM firma_documento_O WHERE id_firma=%s', (id_firma,))
        row = cur.fetchone(); cur.close(); conn.close()
        if not row: raise HTTPException(status_code=404, detail='Firma no encontrada')
        return row
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ================== ROSTROS (FACE CAPTURE PLACEHOLDER) ==================

@app.post('/faces', response_model=FaceOut)
def crear_face(payload: FaceIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    if not payload.data_url.startswith('data:image'):
        raise HTTPException(status_code=400, detail='Formato data_url inválido')
    try:
        b64_part = payload.data_url.split(',')[1]
    except Exception:
        raise HTTPException(status_code=400, detail='data_url mal formado')
    try:
        raw_bytes = base64.b64decode(b64_part)
    except Exception:
        raise HTTPException(status_code=400, detail='Base64 inválido')
    if len(raw_bytes) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail='Imagen demasiado grande (max 2MB)')
    sha = hashlib.sha256(raw_bytes).hexdigest()
    user_company = get_company_id_from_request(request)
    try:
        conn = get_db_connection(); ensure_face_table(); cur = conn.cursor(dictionary=True)
        if role != 'superadmin' and user_company is not None:
            cur.execute('SELECT id_persona, id_empresa FROM persona_O WHERE id_persona=%s AND id_empresa=%s', (payload.id_persona, user_company))
        else:
            cur.execute('SELECT id_persona, id_empresa FROM persona_O WHERE id_persona=%s', (payload.id_persona,))
        pr = cur.fetchone()
        if not pr:
            cur.close(); conn.close(); raise HTTPException(status_code=404, detail='Persona no encontrada')
        id_empresa = pr['id_empresa']
        ins = conn.cursor()
        ins.execute('INSERT INTO persona_face_O (id_empresa, id_persona, data_jpg, hash_sha256) VALUES (%s,%s,%s,%s)', (id_empresa, payload.id_persona, payload.data_url, sha))
        conn.commit(); new_id = ins.lastrowid; ins.close(); cur.close(); conn.close()
        return {'id_face': new_id, 'id_persona': payload.id_persona, 'created_at': datetime.utcnow(), 'hash_sha256': sha}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.get('/faces/{id_persona}', response_model=List[FaceOut])
def listar_faces(id_persona: int, limit: int = 5, x_user_role: Optional[str] = Header(None), request: Request = None):
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    limit = max(1, min(20, limit))
    user_company = get_company_id_from_request(request)
    try:
        conn = get_db_connection(); ensure_face_table(); cur = conn.cursor(dictionary=True)
        base = 'SELECT id_face, id_persona, created_at, hash_sha256 FROM persona_face_O WHERE id_persona=%s'
        params = [id_persona]
        if role != 'superadmin' and user_company is not None:
            base += ' AND id_empresa=%s'; params.append(user_company)
        base += ' ORDER BY created_at DESC LIMIT %s'; params.append(limit)
        cur.execute(base, params)
        rows = cur.fetchall(); cur.close(); conn.close(); return rows
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

@app.post('/faces/verify')
def verificar_face(payload: FaceVerifyIn, x_user_role: Optional[str] = Header(None), request: Request = None):
    """Placeholder de verificación: compara hash SHA256 de la imagen enviada con el último rostro capturado."""
    role = get_role(x_user_role, request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        b64_part = payload.data_url.split(',')[1]
        raw_bytes = base64.b64decode(b64_part)
        sha_in = hashlib.sha256(raw_bytes).hexdigest()
    except Exception:
        raise HTTPException(status_code=400, detail='Imagen inválida')
    user_company = get_company_id_from_request(request)
    try:
        conn = get_db_connection(); ensure_face_table(); cur = conn.cursor(dictionary=True)
        if role != 'superadmin' and user_company is not None:
            cur.execute('SELECT hash_sha256 FROM persona_face_O WHERE id_persona=%s AND id_empresa=%s ORDER BY created_at DESC LIMIT 1', (payload.id_persona, user_company))
        else:
            cur.execute('SELECT hash_sha256 FROM persona_face_O WHERE id_persona=%s ORDER BY created_at DESC LIMIT 1', (payload.id_persona,))
        row = cur.fetchone(); cur.close(); conn.close()
        if not row:
            raise HTTPException(status_code=404, detail='No hay rostro registrado')
        match = (row['hash_sha256'] == sha_in)
        return {'match': match, 'hash_input': sha_in, 'hash_stored': row['hash_sha256']}
    except HTTPException: raise
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))
