from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List
from fastapi import Header
import os
import mysql.connector

app = FastAPI()

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


class TipoIn(BaseModel):
    tipo: str = Field(..., title="Tipo de persona", max_length=100)


class TipoOut(BaseModel):
    id: int
    tipo: str


@app.get('/types', response_model=List[TipoOut])
def list_types():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT idtipoPers AS id, tipoPersona AS tipo FROM tipo_personaO')
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/types/{id}', response_model=TipoOut)
def get_type(id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT idtipoPers AS id, tipoPersona AS tipo FROM tipo_personaO WHERE idtipoPers = %s', (id,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()
        if not row:
            raise HTTPException(status_code=404, detail='Tipo no encontrado')
        return row
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def get_role(x_user_role: str | None = Header(None)) -> str:
    return (x_user_role or 'admin').lower()


@app.post('/types', response_model=TipoOut, status_code=201)
def create_type(payload: TipoIn, x_user_role: str | None = Header(None)):
    role = get_role(x_user_role)
    if role not in ('admin','editor'):
        raise HTTPException(status_code=403, detail='Permission denied')
    # Validate payload (Pydantic already ensures max_length)
    tipo = payload.tipo.strip()
    if not tipo:
        raise HTTPException(status_code=400, detail='El campo tipo no puede estar vacío')

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # Check duplicate
        cursor.execute('SELECT idtipoPers FROM tipo_personaO WHERE tipoPersona = %s', (tipo,))
        exists = cursor.fetchone()
        if exists:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Tipo ya existe')

        cursor = conn.cursor()
        cursor.execute('INSERT INTO tipo_personaO (tipoPersona) VALUES (%s)', (tipo,))
        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return {'id': new_id, 'tipo': tipo}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/types/{id}', response_model=TipoOut)
def update_type(id: int, payload: TipoIn, x_user_role: str | None = Header(None)):
    role = get_role(x_user_role)
    if role not in ('admin','editor'):
        raise HTTPException(status_code=403, detail='Permission denied')
    tipo = payload.tipo.strip()
    if not tipo:
        raise HTTPException(status_code=400, detail='El campo tipo no puede estar vacío')
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # Check duplicate (exclude current id)
        cursor.execute('SELECT idtipoPers FROM tipo_personaO WHERE tipoPersona = %s AND idtipoPers <> %s', (tipo, id))
        exists = cursor.fetchone()
        if exists:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Tipo ya existe')

        cursor = conn.cursor()
        cursor.execute('UPDATE tipo_personaO SET tipoPersona = %s WHERE idtipoPers = %s', (tipo, id))
        conn.commit()
        if cursor.rowcount == 0:
            cursor.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Tipo no encontrado')
        cursor.close()
        conn.close()
        return {'id': id, 'tipo': tipo}
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


@app.delete('/types/{id}', status_code=204)
def delete_type(id: int, x_user_role: str | None = Header(None)):
    role = get_role(x_user_role)
    if role != 'admin':
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('DELETE FROM tipo_personaO WHERE idtipoPers = %s', (id,))
        conn.commit()
        affected = cursor.rowcount
        cursor.close()
        conn.close()
        if affected == 0:
            raise HTTPException(status_code=404, detail='Tipo no encontrado')
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

