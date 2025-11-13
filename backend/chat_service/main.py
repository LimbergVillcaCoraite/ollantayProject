from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Header, Request
from typing import List, Dict
import os, mysql.connector, jwt
from datetime import datetime

app = FastAPI()

JWT_SECRET = os.getenv('JWT_SECRET','dev-secret-change-me')
JWT_ALG = 'HS256'

def get_db():
    return mysql.connector.connect(
        host=os.getenv('DATABASE_HOST','mysql8032'),
        port=int(os.getenv('DATABASE_PORT',3306)),
        user=os.getenv('DATABASE_USER','root'),
        password=os.getenv('DATABASE_PASSWORD', os.getenv('MYSQL_ROOT_PASSWORD','P4assw@rd')),
        database=os.getenv('DATABASE_NAME','SystemaOllantay'),
        charset='utf8mb4'
    )

@app.on_event('startup')
def ensure_tables():
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute('''CREATE TABLE IF NOT EXISTS chat_channel_O (
            id_channel INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(80) NOT NULL,
            id_empresa INT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_channel_empresa (id_empresa)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4''')
        cur.execute('''CREATE TABLE IF NOT EXISTS chat_message_O (
            id_msg INT AUTO_INCREMENT PRIMARY KEY,
            id_channel INT NOT NULL,
            id_empresa INT NULL,
            id_persona INT NULL,
            contenido TEXT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_msg_channel (id_channel),
            INDEX idx_msg_empresa (id_empresa),
            CONSTRAINT fk_channel FOREIGN KEY (id_channel) REFERENCES chat_channel_O(id_channel) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4''')
        conn.commit(); cur.close(); conn.close()
    except Exception as e:
        print('Chat ensure_tables error', e)

# Simple role/company extraction from JWT cookie
def extract_context(request: Request):
    try:
        token = request.cookies.get('ollantay_token')
        if not token: return None, None, None
        data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return data.get('role'), data.get('company_id'), data.get('id_persona')
    except Exception:
        return None, None, None

@app.get('/health')
def health():
    return {'ok': True}

@app.get('/channels')
def list_channels(request: Request):
    role, company_id, _ = extract_context(request)
    try:
        conn = get_db(); cur = conn.cursor(dictionary=True)
        if role == 'superadmin':
            cur.execute('SELECT * FROM chat_channel_O ORDER BY created_at DESC LIMIT 200')
        else:
            if company_id is None:
                return []
            cur.execute('SELECT * FROM chat_channel_O WHERE id_empresa=%s ORDER BY created_at DESC LIMIT 100', (company_id,))
        rows = cur.fetchall(); cur.close(); conn.close(); return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/channels')
def create_channel(nombre: str, request: Request):
    role, company_id, _ = extract_context(request)
    if role not in ('admin','editor','superadmin'):
        raise HTTPException(status_code=403, detail='Forbidden')
    if not nombre.strip():
        raise HTTPException(status_code=400, detail='Nombre requerido')
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute('INSERT INTO chat_channel_O (nombre, id_empresa) VALUES (%s,%s)', (nombre.strip(), None if role=='superadmin' else company_id))
        conn.commit(); new_id = cur.lastrowid; cur.close(); conn.close(); return {'id_channel': new_id, 'nombre': nombre.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get('/channels/{id_channel}/messages')
def list_messages(id_channel: int, request: Request):
    role, company_id, _ = extract_context(request)
    try:
        conn = get_db(); cur = conn.cursor(dictionary=True)
        if role == 'superadmin':
            cur.execute('SELECT * FROM chat_message_O WHERE id_channel=%s ORDER BY created_at DESC LIMIT 200', (id_channel,))
        else:
            cur.execute('SELECT * FROM chat_message_O WHERE id_channel=%s AND (id_empresa=%s OR id_empresa IS NULL) ORDER BY created_at DESC LIMIT 100', (id_channel, company_id))
        rows = cur.fetchall(); cur.close(); conn.close(); return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post('/channels/{id_channel}/messages')
def post_message(id_channel: int, contenido: str, request: Request):
    role, company_id, persona_id = extract_context(request)
    if role not in ('admin','editor','superadmin','viewer'):
        raise HTTPException(status_code=403, detail='Forbidden')
    if not contenido.strip():
        raise HTTPException(status_code=400, detail='Contenido requerido')
    try:
        conn = get_db(); cur = conn.cursor()
        cur.execute('INSERT INTO chat_message_O (id_channel, id_empresa, id_persona, contenido) VALUES (%s,%s,%s,%s)', (id_channel, None if role=='superadmin' else company_id, persona_id, contenido.strip()))
        conn.commit(); mid = cur.lastrowid; cur.close(); conn.close(); return {'id_msg': mid, 'id_channel': id_channel}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# In-memory ws connections per channel
ws_channels: Dict[int, List[WebSocket]] = {}

@app.websocket('/ws/chat/{id_channel}')
async def ws_chat(websocket: WebSocket, id_channel: int):
    await websocket.accept()
    try:
        ws_channels.setdefault(id_channel, []).append(websocket)
        while True:
            msg = await websocket.receive_text()
            # Simple broadcast; in production validate & persist
            for ws in list(ws_channels.get(id_channel, [])):
                try:
                    await ws.send_text(msg)
                except Exception:
                    pass
    except WebSocketDisconnect:
        pass
    finally:
        try:
            ws_channels[id_channel].remove(websocket)
        except Exception:
            pass
