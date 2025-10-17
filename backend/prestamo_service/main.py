from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from fastapi import Header
from datetime import date, datetime
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
    idTipocaja: int = Field(...)
    idProducto: Optional[int] = None


class PrestamoOut(PrestamoIn):
    id_prestamo: int
    nombretipo_caja: Optional[str] = None
    nombreProducto: Optional[str] = None





@app.get('/loans', response_model=List[PrestamoOut])
def list_loans(id_persona: Optional[int] = None):
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        # Use JOIN to get tipocaja and producto names
        query = '''
            SELECT 
                p.id_prestamo, p.cantidad_envaseCaja, p.cantidad_prestamoBotellas, 
                p.descripcion_envase, p.fecha_prestamo, p.id_persona, 
                p.estado_prestamo, p.fecha_devolucion, p.chofer, 
                p.idTipocaja, tc.nombretipo_caja,
                p.idProducto, pr.nombreProducto
            FROM prestamo_O p
            LEFT JOIN tipocaja_O tc ON p.idTipocaja = tc.idTipocaja
            LEFT JOIN producto_O pr ON p.idProducto = pr.idProducto
        '''
        if id_persona is not None:
            # Filter by id_persona for cliente view
            query += ' WHERE p.id_persona = %s'
            cur.execute(query, (id_persona,))
        else:
            # Admin/editor view: all loans
            cur.execute(query)
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
        cur.execute('SELECT id_prestamo, cantidad_envaseCaja, cantidad_prestamoBotellas, descripcion_envase, fecha_prestamo, id_persona, estado_prestamo, fecha_devolucion, chofer, idTipocaja, idProducto FROM prestamo_O WHERE id_prestamo = %s', (id,))
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


def get_role(x_user_role: str | None = Header(None)) -> str:
    return (x_user_role or 'admin').lower()


@app.post('/loans', response_model=PrestamoOut, status_code=201)
def create_loan(payload: PrestamoIn, x_user_role: str | None = Header(None)):
    role = get_role(x_user_role)
    if role not in ('admin','editor'):
        raise HTTPException(status_code=403, detail='Permission denied')
    # basic validations: chofer must exist, id_persona if provided must exist
    try:
        # validate fecha_prestamo is not in the future (if provided)
        if payload.fecha_prestamo:
            try:
                fp = date.fromisoformat(payload.fecha_prestamo)
            except Exception:
                raise HTTPException(status_code=400, detail='fecha_prestamo must be ISO date YYYY-MM-DD')
            if fp > date.today():
                raise HTTPException(status_code=400, detail='fecha_prestamo cannot be in the future')
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

        # check idTipocaja exists
        cur.execute('SELECT idTipocaja FROM tipocaja_O WHERE idTipocaja = %s', (payload.idTipocaja,))
        tipoc = cur.fetchone()
        if not tipoc:
            cur.close(); conn.close();
            raise HTTPException(status_code=400, detail='Tipocaja no existe')
        # check idProducto if provided
        if payload.idProducto is not None:
            cur.execute('SELECT idProducto FROM producto_O WHERE idProducto = %s', (payload.idProducto,))
            prod = cur.fetchone()
            if not prod:
                cur.close(); conn.close();
                raise HTTPException(status_code=400, detail='Producto no existe')

        # estado_prestamo por defecto activo (0) si no se envía
        estado_prestamo = payload.estado_prestamo if payload.estado_prestamo is not None else 0

        # insert
        ins = conn.cursor()
        ins.execute('INSERT INTO prestamo_O (cantidad_envaseCaja, cantidad_prestamoBotellas, descripcion_envase, fecha_prestamo, id_persona, estado_prestamo, fecha_devolucion, chofer, idTipocaja, idProducto) VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)',
                    (payload.cantidad_envaseCaja, payload.cantidad_prestamoBotellas, payload.descripcion_envase, payload.fecha_prestamo, payload.id_persona, estado_prestamo, payload.fecha_devolucion, payload.chofer, payload.idTipocaja, payload.idProducto))
        conn.commit()
        new_id = ins.lastrowid
        ins.close(); cur.close(); conn.close()
        out = {**payload.dict(), 'id_prestamo': new_id, 'estado_prestamo': estado_prestamo}
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
def update_loan(id: int, payload: PrestamoIn, x_user_role: str | None = Header(None)):
    role = get_role(x_user_role)
    if role not in ('admin','editor'):
        raise HTTPException(status_code=403, detail='Permission denied')
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        # check exists
        cur.execute('SELECT * FROM prestamo_O WHERE id_prestamo = %s', (id,))
        existing = cur.fetchone()
        if not existing:
            cur.close(); conn.close();
            raise HTTPException(status_code=404, detail='Prestamo no encontrado')

        # Admin can edit all fields, editor only estado_prestamo and fecha_devolucion
        if role == 'admin':
            # Admin: allow full edit
            cantidad_envaseCaja = payload.cantidad_envaseCaja if payload.cantidad_envaseCaja is not None else existing.get('cantidad_envaseCaja')
            cantidad_prestamoBotellas = payload.cantidad_prestamoBotellas if payload.cantidad_prestamoBotellas is not None else existing.get('cantidad_prestamoBotellas')
            descripcion_envase = payload.descripcion_envase if payload.descripcion_envase is not None else existing.get('descripcion_envase')
            fecha_prestamo = payload.fecha_prestamo if payload.fecha_prestamo is not None else existing.get('fecha_prestamo')
            id_persona = payload.id_persona if payload.id_persona is not None else existing.get('id_persona')
            chofer = payload.chofer if payload.chofer is not None else existing.get('chofer')
            idTipocaja = payload.idTipocaja if payload.idTipocaja is not None else existing.get('idTipocaja')
            idProducto = payload.idProducto if payload.idProducto is not None else existing.get('idProducto')
        else:
            # Editor: preserve non-editable fields
            cantidad_envaseCaja = existing.get('cantidad_envaseCaja')
            cantidad_prestamoBotellas = existing.get('cantidad_prestamoBotellas')
            descripcion_envase = existing.get('descripcion_envase')
            fecha_prestamo = existing.get('fecha_prestamo')
            id_persona = existing.get('id_persona')
            chofer = existing.get('chofer')
            idTipocaja = existing.get('idTipocaja')
            idProducto = existing.get('idProducto')
        
        # Both can edit estado and fecha_devolucion
        estado_prestamo = payload.estado_prestamo if payload.estado_prestamo is not None else existing.get('estado_prestamo')
        fecha_devolucion = payload.fecha_devolucion if payload.fecha_devolucion is not None else existing.get('fecha_devolucion')

        upd = conn.cursor()
        upd.execute('UPDATE prestamo_O SET cantidad_envaseCaja=%s, cantidad_prestamoBotellas=%s, descripcion_envase=%s, fecha_prestamo=%s, id_persona=%s, estado_prestamo=%s, fecha_devolucion=%s, chofer=%s, idTipocaja=%s, idProducto=%s WHERE id_prestamo=%s',
                    (cantidad_envaseCaja, cantidad_prestamoBotellas, descripcion_envase, fecha_prestamo, id_persona, estado_prestamo, fecha_devolucion, chofer, idTipocaja, idProducto, id))
        conn.commit()
        upd.close(); cur.close(); conn.close()

        out = {
            'cantidad_envaseCaja': cantidad_envaseCaja,
            'cantidad_prestamoBotellas': cantidad_prestamoBotellas,
            'descripcion_envase': descripcion_envase,
            'fecha_prestamo': fecha_prestamo,
            'id_persona': id_persona,
            'estado_prestamo': estado_prestamo,
            'fecha_devolucion': fecha_devolucion,
            'chofer': chofer,
            'idTipocaja': idTipocaja,
            'idProducto': idProducto,
            'id_prestamo': id
        }
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
def delete_loan(id: int, x_user_role: str | None = Header(None)):
    role = get_role(x_user_role)
    if role != 'admin':
        raise HTTPException(status_code=403, detail='Permission denied')
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


@app.get('/tipocajas')
def list_tipocajas():
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT idTipocaja, nombretipo_caja FROM tipocaja_O ORDER BY idTipocaja')
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/productos')
def list_productos():
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT idProducto, nombreProducto FROM producto_O ORDER BY idProducto')
        rows = cur.fetchall()
        cur.close()
        conn.close()
        return rows
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
