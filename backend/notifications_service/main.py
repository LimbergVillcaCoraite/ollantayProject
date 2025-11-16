from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta
import os
import mysql.connector
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
    try:
        token = request.cookies.get('ollantay_token') if request is not None else None
        if not token:
            return None
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        uid = payload.get('sub') or payload.get('id_user') or payload.get('user_id')
        return int(uid) if uid is not None else None
    except Exception:
        return None

def ensure_tables(conn):
    """Crea tablas necesarias para notificaciones y dispositivos."""
    cur = conn.cursor()
    # Tabla de tokens de dispositivos (web push / FCM)
    cur.execute('''
        CREATE TABLE IF NOT EXISTS device_token_O (
            idToken INT NOT NULL AUTO_INCREMENT,
            idUsuario INT NOT NULL,
            idEmpresa INT NOT NULL,
            token TEXT NOT NULL,
            platform VARCHAR(20) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_used DATETIME NULL,
            active TINYINT NOT NULL DEFAULT 1,
            PRIMARY KEY (idToken),
            KEY idx_usuario (idUsuario),
            KEY idx_empresa (idEmpresa),
            KEY idx_active (active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ''')
    # Tabla de notificaciones
    cur.execute('''
        CREATE TABLE IF NOT EXISTS notification_O (
            idNotification INT NOT NULL AUTO_INCREMENT,
            idEmpresa INT NOT NULL,
            idUsuario INT NULL,
            tipo VARCHAR(50) NOT NULL,
            titulo VARCHAR(255) NOT NULL,
            mensaje TEXT NOT NULL,
            data JSON NULL,
            prioridad VARCHAR(20) NOT NULL DEFAULT 'normal',
            leida TINYINT NOT NULL DEFAULT 0,
            enviada TINYINT NOT NULL DEFAULT 0,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            read_at DATETIME NULL,
            PRIMARY KEY (idNotification),
            KEY idx_empresa_usuario (idEmpresa, idUsuario),
            KEY idx_leida (leida),
            KEY idx_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    ''')
    conn.commit()
    cur.close()

# Modelos
class DeviceTokenIn(BaseModel):
    token: str
    platform: str = Field(pattern='^(web|android|ios)$')

class NotificationIn(BaseModel):
    tipo: str = Field(max_length=50)
    titulo: str = Field(max_length=255)
    mensaje: str
    idUsuario: Optional[int] = None  # Si null, broadcast a toda la empresa
    data: Optional[dict] = None
    prioridad: str = Field(default='normal', pattern='^(alta|normal|baja)$')

class NotificationOut(BaseModel):
    idNotification: int
    idEmpresa: int
    idUsuario: Optional[int]
    tipo: str
    titulo: str
    mensaje: str
    data: Optional[dict]
    prioridad: str
    leida: bool
    enviada: bool
    created_at: str
    read_at: Optional[str]

# Endpoints

@app.post('/tokens', status_code=201)
def register_device_token(payload: DeviceTokenIn, x_user_role: str = Header(None), request: Request = None):
    """Registra/actualiza token de dispositivo para notificaciones push."""
    role = get_role(x_user_role, request)
    if role == 'viewer':
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection()
        ensure_tables(conn)
        cur = conn.cursor(dictionary=True)
        user_id = get_user_id_from_request(request)
        company_id = get_company_id_from_request(request)
        if not user_id or not company_id:
            cur.close(); conn.close()
            raise HTTPException(status_code=400, detail='Usuario o empresa no identificado')
        # Desactivar tokens antiguos del mismo usuario/plataforma
        upd = conn.cursor()
        upd.execute('UPDATE device_token_O SET active = 0 WHERE idUsuario = %s AND platform = %s', (user_id, payload.platform))
        conn.commit()
        upd.close()
        # Insertar nuevo token
        ins = conn.cursor()
        ins.execute('''
            INSERT INTO device_token_O (idUsuario, idEmpresa, token, platform, last_used)
            VALUES (%s, %s, %s, %s, NOW())
        ''', (user_id, company_id, payload.token, payload.platform))
        conn.commit()
        ins.close()
        cur.close(); conn.close()
        return {'status': 'ok', 'message': 'Token registrado'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/notifications', response_model=List[NotificationOut])
def list_notifications(
    leida: Optional[int] = None,
    limit: int = 50,
    offset: int = 0,
    x_user_role: str = Header(None),
    request: Request = None
):
    """Lista notificaciones del usuario actual."""
    role = get_role(x_user_role, request)
    try:
        conn = get_db_connection()
        ensure_tables(conn)
        cur = conn.cursor(dictionary=True)
        user_id = get_user_id_from_request(request)
        company_id = get_company_id_from_request(request)
        if not user_id or not company_id:
            cur.close(); conn.close()
            return []
        where = ['n.idEmpresa = %s', '(n.idUsuario = %s OR n.idUsuario IS NULL)']
        params = [company_id, user_id]
        if leida is not None:
            where.append('n.leida = %s')
            params.append(leida)
        query = f'''
            SELECT n.idNotification, n.idEmpresa, n.idUsuario, n.tipo, n.titulo, n.mensaje,
                   n.data, n.prioridad, n.leida, n.enviada, n.created_at, n.read_at
            FROM notification_O n
            WHERE {' AND '.join(where)}
            ORDER BY n.created_at DESC
            LIMIT %s OFFSET %s
        '''
        params.extend([limit, offset])
        cur.execute(query, tuple(params))
        rows = cur.fetchall() or []
        for r in rows:
            r['leida'] = bool(r.get('leida'))
            r['enviada'] = bool(r.get('enviada'))
            r['created_at'] = r['created_at'].isoformat() if r.get('created_at') else None
            r['read_at'] = r['read_at'].isoformat() if r.get('read_at') else None
            if r.get('data'):
                import json
                try:
                    r['data'] = json.loads(r['data']) if isinstance(r['data'], str) else r['data']
                except:
                    r['data'] = None
        cur.close(); conn.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.put('/notifications/{id}/read', status_code=204)
def mark_notification_read(id: int, x_user_role: str = Header(None), request: Request = None):
    """Marca notificación como leída."""
    try:
        conn = get_db_connection()
        ensure_tables(conn)
        cur = conn.cursor(dictionary=True)
        user_id = get_user_id_from_request(request)
        company_id = get_company_id_from_request(request)
        # Validar que la notificación pertenece al usuario
        cur.execute('SELECT idNotification FROM notification_O WHERE idNotification = %s AND idEmpresa = %s AND (idUsuario = %s OR idUsuario IS NULL)', (id, company_id, user_id))
        if not cur.fetchone():
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail='Notificación no encontrada')
        upd = conn.cursor()
        upd.execute('UPDATE notification_O SET leida = 1, read_at = NOW() WHERE idNotification = %s', (id,))
        conn.commit()
        upd.close()
        cur.close(); conn.close()
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/notifications', status_code=201)
def create_notification(payload: NotificationIn, x_user_role: str = Header(None), request: Request = None):
    """Crea notificación (admin/editor)."""
    role = get_role(x_user_role, request)
    if role not in ('admin', 'editor', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection()
        ensure_tables(conn)
        company_id = get_company_id_from_request(request)
        if not company_id:
            conn.close()
            raise HTTPException(status_code=400, detail='Empresa no identificada')
        ins = conn.cursor()
        import json
        data_json = json.dumps(payload.data) if payload.data else None
        ins.execute('''
            INSERT INTO notification_O (idEmpresa, idUsuario, tipo, titulo, mensaje, data, prioridad)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        ''', (company_id, payload.idUsuario, payload.tipo, payload.titulo, payload.mensaje, data_json, payload.prioridad))
        conn.commit()
        new_id = ins.lastrowid
        ins.close()
        conn.close()
        # TODO: Enviar push real usando FCM/Web Push API
        return {'idNotification': new_id, 'status': 'created'}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/unread/count')
def unread_count(x_user_role: str = Header(None), request: Request = None):
    """Retorna conteo de notificaciones no leídas."""
    try:
        conn = get_db_connection()
        ensure_tables(conn)
        cur = conn.cursor(dictionary=True)
        user_id = get_user_id_from_request(request)
        company_id = get_company_id_from_request(request)
        if not user_id or not company_id:
            cur.close(); conn.close()
            return {'count': 0}
        cur.execute('''
            SELECT COUNT(*) as cnt FROM notification_O
            WHERE idEmpresa = %s AND (idUsuario = %s OR idUsuario IS NULL) AND leida = 0
        ''', (company_id, user_id))
        row = cur.fetchone()
        count = int(row.get('cnt') or 0) if row else 0
        cur.close(); conn.close()
        return {'count': count}
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
