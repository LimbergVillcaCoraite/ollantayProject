from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
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


class PrestamoIn(BaseModel):
    cantidad_envaseCaja: Optional[int] = Field(None, ge=0, le=127)
    cantidad_prestamoBotellas: Optional[int] = Field(None, ge=0, le=127)
    descripcion_envase: Optional[str] = Field(None, max_length=500)
    fecha_prestamo: Optional[str] = None  # ISO date string
    id_persona: Optional[int] = None
    estado_prestamo: Optional[int] = Field(None, ge=0, le=1)
    fecha_devolucion: Optional[str] = None  # ISO datetime
    chofer: int = Field(...)


class PrestamoOut(PrestamoIn):
    id_prestamo: int


@app.get('/loans', response_model=List[PrestamoOut])
def list_loans():
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT id_prestamo, cantidad_envaseCaja, cantidad_prestamoBotellas, descripcion_envase, fecha_prestamo, id_persona, estado_prestamo, fecha_devolucion, chofer FROM prestamo_O')
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
        cur.execute('SELECT id_prestamo, cantidad_envaseCaja, cantidad_prestamoBotellas, descripcion_envase, fecha_prestamo, id_persona, estado_prestamo, fecha_devolucion, chofer FROM prestamo_O WHERE id_prestamo = %s', (id,))
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
def create_loan(payload: PrestamoIn):
    # basic validations: chofer must exist, id_persona if provided must exist
    try:
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

        # insert
        ins = conn.cursor()
        ins.execute('INSERT INTO prestamo_O (cantidad_envaseCaja, cantidad_prestamoBotellas, descripcion_envase, fecha_prestamo, id_persona, estado_prestamo, fecha_devolucion, chofer) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)',
                    (payload.cantidad_envaseCaja, payload.cantidad_prestamoBotellas, payload.descripcion_envase, payload.fecha_prestamo, payload.id_persona, payload.estado_prestamo, payload.fecha_devolucion, payload.chofer))
        conn.commit()
        new_id = ins.lastrowid
        ins.close(); cur.close(); conn.close()
        out = {**payload.dict(), 'id_prestamo': new_id}
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
def update_loan(id: int, payload: PrestamoIn):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        # check exists
        cur.execute('SELECT id_prestamo FROM prestamo_O WHERE id_prestamo = %s', (id,))
        ex = cur.fetchone()
        if not ex:
            cur.close(); conn.close();
            raise HTTPException(status_code=404, detail='Prestamo no encontrado')
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

        upd = conn.cursor()
        upd.execute('UPDATE prestamo_O SET cantidad_envaseCaja=%s, cantidad_prestamoBotellas=%s, descripcion_envase=%s, fecha_prestamo=%s, id_persona=%s, estado_prestamo=%s, fecha_devolucion=%s, chofer=%s WHERE id_prestamo=%s',
                    (payload.cantidad_envaseCaja, payload.cantidad_prestamoBotellas, payload.descripcion_envase, payload.fecha_prestamo, payload.id_persona, payload.estado_prestamo, payload.fecha_devolucion, payload.chofer, id))
        conn.commit()
        upd.close(); cur.close(); conn.close()
        out = {**payload.dict(), 'id_prestamo': id}
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
def delete_loan(id: int):
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
