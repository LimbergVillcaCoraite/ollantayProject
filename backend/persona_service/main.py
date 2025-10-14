from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List
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


@app.get('/persons', response_model=List[PersonaOut])
def list_persons():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute('SELECT id_persona, nombres_persona, apellido_paternoPersona, apellido_maternoPer, telefono_persona, id_tipoPersona, ci_persona, direccion_persona FROM persona_O')
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return rows
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


@app.post('/persons', response_model=PersonaOut, status_code=201)
def create_person(payload: PersonaIn):
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
def update_person(id: int, payload: PersonaIn):
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
def delete_person(id: int):
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
