from fastapi import FastAPI, HTTPException, Request, Header, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import date, datetime
from decimal import Decimal
import os
import json
import asyncio
import mysql.connector
from mysql.connector import Error as mysql_errors
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

JWT_SECRET = os.getenv('JWT_SECRET', 'dev-secret-change-me')
JWT_ALG = 'HS256'


def get_user_context(x_user_role: str = Header(None), request: Request = None) -> dict:
    """Extract user context from JWT token"""
    try:
        token = request.cookies.get('ollantay_token') if request else None
        if not token:
            return {'role': 'viewer', 'idEmpresa': None, 'id_persona': None}
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return {
            'role': (payload.get('role') or 'viewer').lower(),
            'idEmpresa': payload.get('company_id'),
            'id_persona': payload.get('id_persona'),
            'username': payload.get('username')
        }
    except Exception:
        return {'role': 'viewer', 'idEmpresa': None, 'id_persona': None}


# ========================
# Modelos Pydantic
# ========================

class EntregaDetalleIn(BaseModel):
    idProducto: int
    idLote: Optional[int] = None
    cantidadEnviada: Decimal = Field(gt=0)
    precioUnitario: Decimal = Field(ge=0)
    observaciones: Optional[str] = None


class EntregaDetalleOut(EntregaDetalleIn):
    idDetalle: int
    cantidadDevuelta: Decimal = 0
    cantidadVendida: Decimal = 0
    montoTotal: Decimal = 0
    nombreProducto: Optional[str] = None
    codigoLote: Optional[str] = None


class EntregaIn(BaseModel):
    idRuta: int
    idEncargado: int  # id_persona del chofer/encargado
    fechaSalida: str  # ISO date
    observaciones: Optional[str] = None
    detalles: List[EntregaDetalleIn]


class EntregaOut(BaseModel):
    idEntrega: int
    numeroEntrega: str
    idRuta: int
    nombreRuta: Optional[str] = None
    idEmpresa: int
    idEncargado: int
    nombreEncargado: Optional[str] = None
    fechaSalida: str
    fechaRetorno: Optional[str] = None
    estado: str
    observaciones: Optional[str] = None
    detalles: Optional[List[EntregaDetalleOut]] = None
    created_at: Optional[str] = None
    totalVendido: Optional[Decimal] = 0


class DevolucionIn(BaseModel):
    idDetalle: int
    cantidadDevuelta: Decimal = Field(ge=0)


class FinalizarEntregaIn(BaseModel):
    fechaRetorno: str  # ISO date
    devoluciones: List[DevolucionIn]
    observaciones: Optional[str] = None
    # Se recibe desde frontend; backend actual lo ignora en caja (solo informativo)
    metodo_pago: Optional[str] = None


# ========================
# Tracking en vivo (ubicación)
# ========================

class UbicacionIn(BaseModel):
    lat: float
    lng: float
    accuracy: Optional[float] = None


class UbicacionOut(UbicacionIn):
    updated_at: str


# Mapa de conexiones WebSocket por entrega
ws_conns: Dict[int, List[WebSocket]] = {}


def ensure_ubicacion_table(conn):
    cur = conn.cursor()
    cur.execute(
        '''CREATE TABLE IF NOT EXISTS entrega_ubicacion_O (
            idEntrega INT PRIMARY KEY,
            idEmpresa INT NOT NULL,
            lat DOUBLE NOT NULL,
            lng DOUBLE NOT NULL,
            accuracy DOUBLE NULL,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            CONSTRAINT fk_entrega FOREIGN KEY (idEntrega) REFERENCES entrega_ruta_O(idEntrega) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'''
    )
    conn.commit()
    cur.close()


# ========================
# Endpoints
# ========================

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


@app.get('/entregas', response_model=List[EntregaOut])
def list_entregas(
    idRuta: Optional[int] = None,
    idEncargado: Optional[int] = None,
    estado: Optional[str] = None,
    fechaDesde: Optional[str] = None,
    fechaHasta: Optional[str] = None,
    offset: int = 0,
    limit: int = 100,
    x_user_role: str = Header(None),
    request: Request = None
):
    """List deliveries with filters"""
    context = get_user_context(x_user_role, request)
    
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    try:
        query = '''
            SELECT 
                e.idEntrega, e.numeroEntrega, e.idRuta, r.nombreRuta,
                e.idEmpresa, e.idEncargado,
                CONCAT(p.nombres_persona, ' ', COALESCE(p.apellido_paternoPersona, '')) AS nombreEncargado,
                e.fechaSalida, e.fechaRetorno, e.estado, e.observaciones,
                e.created_at
            FROM entrega_ruta_O e
            LEFT JOIN ruta_O r ON e.idRuta = r.idRuta
            LEFT JOIN persona_O p ON e.idEncargado = p.id_persona
            WHERE 1=1
        '''
        
        params = []
        
        # Company scoping
        if context['role'] != 'superadmin' and context['idEmpresa'] is not None:
            query += ' AND e.idEmpresa = %s'
            params.append(context['idEmpresa'])
        
        # Filters
        if idRuta:
            query += ' AND e.idRuta = %s'
            params.append(idRuta)
        
        if idEncargado:
            query += ' AND e.idEncargado = %s'
            params.append(idEncargado)
        
        if estado:
            query += ' AND e.estado = %s'
            params.append(estado)
        
        if fechaDesde:
            query += ' AND e.fechaSalida >= %s'
            params.append(fechaDesde)
        
        if fechaHasta:
            query += ' AND e.fechaSalida <= %s'
            params.append(fechaHasta)
        
        query += ' ORDER BY e.fechaSalida DESC, e.idEntrega DESC LIMIT %s OFFSET %s'
        params.extend([limit, offset])
        
        cur.execute(query, tuple(params))
        entregas = cur.fetchall() or []
        
        # Format dates and calculate totalVendido for each entrega
        for e in entregas:
            e['fechaSalida'] = e['fechaSalida'].isoformat() if e.get('fechaSalida') else None
            e['fechaRetorno'] = e['fechaRetorno'].isoformat() if e.get('fechaRetorno') else None
            e['created_at'] = e['created_at'].isoformat() if e.get('created_at') else None
            
            # Calculate total sold (montoTotal sum from details)
            cur.execute('''
                SELECT COALESCE(SUM(montoTotal), 0) AS totalVendido
                FROM entrega_ruta_detalle_O
                WHERE idEntrega = %s
            ''', (e['idEntrega'],))
            total_row = cur.fetchone()
            e['totalVendido'] = float(total_row['totalVendido']) if total_row else 0.0
        
        cur.close()
        conn.close()
        return entregas
    
    except mysql_errors as e:
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f'Database error: {e}')


@app.get('/entregas/{id}')
def get_entrega(id: int, x_user_role: str = Header(None), request: Request = None):
    """Get delivery by ID with details"""
    context = get_user_context(x_user_role, request)
    
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    try:
        # Get entrega
        cur.execute('''
            SELECT 
                e.idEntrega, e.numeroEntrega, e.idRuta, r.nombreRuta,
                e.idEmpresa, e.idEncargado,
                CONCAT(p.nombres_persona, ' ', COALESCE(p.apellido_paternoPersona, '')) AS nombreEncargado,
                e.fechaSalida, e.fechaRetorno, e.estado, e.observaciones,
                e.created_at
            FROM entrega_ruta_O e
            LEFT JOIN ruta_O r ON e.idRuta = r.idRuta
            LEFT JOIN persona_O p ON e.idEncargado = p.id_persona
            WHERE e.idEntrega = %s
        ''', (id,))
        
        entrega = cur.fetchone()
        
        if not entrega:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Entrega no encontrada')
        
        # Validate access
        if context['role'] != 'superadmin' and entrega['idEmpresa'] != context['idEmpresa']:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No tiene permisos')
        
        # Get details
        cur.execute('''
            SELECT 
                d.idDetalle, d.idProducto, d.idLote,
                d.cantidadEnviada, d.cantidadDevuelta, d.cantidadVendida,
                d.precioUnitario, d.montoTotal, d.observaciones,
                p.nombreProducto,
                l.codigoLote
            FROM entrega_ruta_detalle_O d
            LEFT JOIN producto_O p ON d.idProducto = p.idProducto
            LEFT JOIN lote_producto l ON d.idLote = l.idLote
            WHERE d.idEntrega = %s
            ORDER BY d.idDetalle
        ''', (id,))
        
        detalles = cur.fetchall() or []
        
        # Format
        entrega['fechaSalida'] = entrega['fechaSalida'].isoformat() if entrega.get('fechaSalida') else None
        entrega['fechaRetorno'] = entrega['fechaRetorno'].isoformat() if entrega.get('fechaRetorno') else None
        entrega['created_at'] = entrega['created_at'].isoformat() if entrega.get('created_at') else None
        
        # Calculate totalVendido
        totalVendido = 0.0
        for d in detalles:
            d['cantidadEnviada'] = float(d['cantidadEnviada']) if d.get('cantidadEnviada') is not None else 0.0
            d['cantidadDevuelta'] = float(d['cantidadDevuelta']) if d.get('cantidadDevuelta') is not None else 0.0
            d['cantidadVendida'] = float(d['cantidadVendida']) if d.get('cantidadVendida') is not None else 0.0
            d['precioUnitario'] = float(d['precioUnitario']) if d.get('precioUnitario') is not None else 0.0
            d['montoTotal'] = float(d['montoTotal']) if d.get('montoTotal') is not None else 0.0
            totalVendido += d['montoTotal']
        
        entrega['detalles'] = detalles
        entrega['totalVendido'] = totalVendido
        
        cur.close()
        conn.close()
        return entrega
    
    except HTTPException:
        cur.close()
        conn.close()
        raise
    except mysql_errors as e:
        cur.close()
        conn.close()
        print(f"MySQL Error al obtener entrega {id}: {e}")
        raise HTTPException(status_code=500, detail=f'Database error: {str(e)}')
    except Exception as e:
        cur.close()
        conn.close()
        print(f"Error general al obtener entrega {id}: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Error: {str(e)}')


@app.post('/entregas', response_model=EntregaOut, status_code=201)
def create_entrega(payload: EntregaIn, x_user_role: str = Header(None), request: Request = None):
    """Create new delivery manifest - products go 'en ruta', no caja entry until finalized"""
    context = get_user_context(x_user_role, request)
    
    if context['role'] not in ('admin', 'editor', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    
    if not payload.detalles:
        raise HTTPException(status_code=400, detail='Debe incluir al menos un producto')
    
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    try:
        # Validate route exists
        cur.execute('SELECT idRuta, idEmpresa FROM ruta_O WHERE idRuta = %s', (payload.idRuta,))
        ruta = cur.fetchone()
        
        if not ruta:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Ruta no encontrada')
        
        # Determine target company
        if context['role'] == 'superadmin':
            target_company = ruta['idEmpresa']
        else:
            if context['idEmpresa'] is None or ruta['idEmpresa'] != context['idEmpresa']:
                cur.close()
                conn.close()
                raise HTTPException(status_code=403, detail='No tiene permisos para esta ruta')
            target_company = context['idEmpresa']
        
        # Validate encargado
        cur.execute('SELECT id_persona, id_empresa FROM persona_O WHERE id_persona = %s', (payload.idEncargado,))
        encargado = cur.fetchone()
        
        if not encargado or encargado['id_empresa'] != target_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Encargado no válido')
        
        # Check if encargado already has an active delivery (en_ruta)
        cur.execute('''
            SELECT idEntrega FROM entrega_ruta_O 
            WHERE idEncargado = %s AND estado IN ('pendiente', 'en_ruta')
        ''', (payload.idEncargado,))
        if cur.fetchone():
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='El encargado ya tiene una entrega activa (pendiente o en ruta)')
        
        # Generate unique number
        import random
        numero = f"ENT{target_company}{date.today().strftime('%Y%m%d')}{random.randint(1000, 9999)}"
        
        # Insert entrega with estado 'en_ruta' (truck is on the road)
        ins = conn.cursor()
        ins.execute('''
            INSERT INTO entrega_ruta_O 
            (numeroEntrega, idRuta, idEmpresa, idEncargado, fechaSalida, estado, observaciones)
            VALUES (%s, %s, %s, %s, %s, 'en_ruta', %s)
        ''', (numero, payload.idRuta, target_company, payload.idEncargado, payload.fechaSalida, payload.observaciones))
        
        conn.commit()
        idEntrega = ins.lastrowid
        
        # Insert details and decrease warehouse stock (products now "en ruta")
        for det in payload.detalles:
            ins.execute('''
                INSERT INTO entrega_ruta_detalle_O
                (idEntrega, idProducto, idLote, cantidadEnviada, precioUnitario, observaciones)
                VALUES (%s, %s, %s, %s, %s, %s)
            ''', (idEntrega, det.idProducto, det.idLote, float(det.cantidadEnviada), 
                  float(det.precioUnitario), det.observaciones))
            
            # Update inventory (decrease warehouse stock, now "en ruta" with encargado)
            if det.idLote:
                ins.execute('''
                    UPDATE lote_producto 
                    SET stockActual = stockActual - %s
                    WHERE idLote = %s AND stockActual >= %s
                ''', (float(det.cantidadEnviada), det.idLote, float(det.cantidadEnviada)))
                
                if ins.rowcount == 0:
                    conn.rollback()
                    ins.close()
                    cur.close()
                    conn.close()
                    raise HTTPException(status_code=400, detail=f'Stock insuficiente en lote {det.idLote}')
        
        conn.commit()
        ins.close()
        cur.close()
        conn.close()
        
        # Return created entrega
        return get_entrega(idEntrega, x_user_role, request)
    
    except HTTPException:
        raise
    except mysql_errors as e:
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f'Database error: {e}')


@app.post('/entregas/{id}/finalizar', response_model=EntregaOut)
def finalizar_entrega(id: int, payload: FinalizarEntregaIn, x_user_role: str = Header(None), request: Request = None):
    """Finalize delivery: register returns, calculate sold quantities, and create caja entry for cash collected"""
    context = get_user_context(x_user_role, request)
    
    if context['role'] not in ('admin', 'editor', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    try:
        # Validate entrega exists and is en_ruta
        cur.execute('SELECT idEntrega, idEmpresa, idEncargado, estado, numeroEntrega FROM entrega_ruta_O WHERE idEntrega = %s', (id,))
        entrega = cur.fetchone()
        
        if not entrega:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Entrega no encontrada')
        
        if context['role'] != 'superadmin' and entrega['idEmpresa'] != context['idEmpresa']:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No tiene permisos')
        
        if entrega['estado'] != 'en_ruta':
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Solo se pueden finalizar entregas en ruta')
        
        # Update devoluciones and restore returned stock to warehouse
        upd = conn.cursor()
        total_vendido_bs = 0
        
        for dev in payload.devoluciones:
            # Validate detail exists
            cur.execute('''
                SELECT idDetalle, idLote, cantidadEnviada, cantidadDevuelta, precioUnitario
                FROM entrega_ruta_detalle_O
                WHERE idDetalle = %s AND idEntrega = %s
            ''', (dev.idDetalle, id))
            
            detalle = cur.fetchone()
            
            if not detalle:
                conn.rollback()
                upd.close()
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail=f'Detalle {dev.idDetalle} no encontrado')
            
            if float(dev.cantidadDevuelta) > float(detalle['cantidadEnviada']):
                conn.rollback()
                upd.close()
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail=f'Cantidad devuelta excede cantidad enviada en detalle {dev.idDetalle}')
            
            # Calculate sold quantity
            cant_vendida = float(detalle['cantidadEnviada']) - float(dev.cantidadDevuelta)
            monto_vendido = cant_vendida * float(detalle['precioUnitario'])
            total_vendido_bs += monto_vendido
            
            # Update cantidadDevuelta
            upd.execute('''
                UPDATE entrega_ruta_detalle_O
                SET cantidadDevuelta = %s
                WHERE idDetalle = %s
            ''', (float(dev.cantidadDevuelta), dev.idDetalle))
            
            # Return unsold items to warehouse inventory (increase stock)
            if detalle['idLote'] and float(dev.cantidadDevuelta) > 0:
                upd.execute('''
                    UPDATE lote_producto
                    SET stockActual = stockActual + %s
                    WHERE idLote = %s
                ''', (float(dev.cantidadDevuelta), detalle['idLote']))
        
        # Update entrega status to finalizado
        upd.execute('''
            UPDATE entrega_ruta_O
            SET fechaRetorno = %s, estado = 'finalizado', observaciones = CONCAT(COALESCE(observaciones, ''), ' | Retorno: ', COALESCE(%s, ''))
            WHERE idEntrega = %s
        ''', (payload.fechaRetorno, payload.observaciones, id))
        
        # Create caja entry for cash collected from sales (efectivo ingresado)
        # Only if there were sales (total_vendido_bs > 0)
        if total_vendido_bs > 0:
            upd.execute('''
                INSERT INTO cuenta_corriente_O 
                (tipo, idPersona, idEmpresa, fechaMovimiento, tipoMovimiento, idReferencia, debe, haber, saldo, descripcion, estado)
                VALUES ('cliente', %s, %s, %s, 'cobro', %s, 0, %s, %s, %s, 1)
            ''', (
                entrega['idEncargado'], 
                entrega['idEmpresa'], 
                payload.fechaRetorno, 
                id,
                total_vendido_bs,
                total_vendido_bs,
                f'Entrega #{entrega.get("numeroEntrega") or id} finalizada - Efectivo de ventas en ruta'
            ))
        
        conn.commit()
        upd.close()
        cur.close()
        conn.close()
        
        # Return updated entrega
        return get_entrega(id, x_user_role, request)
    
    except HTTPException:
        raise
    except mysql_errors as e:
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f'Database error: {e}')


@app.put('/entregas/{id}/estado')
def update_estado(id: int, estado: str, x_user_role: str = Header(None), request: Request = None):
    """Update delivery status (pendiente -> en_ruta -> finalizado)"""
    context = get_user_context(x_user_role, request)
    
    if context['role'] not in ('admin', 'editor', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    
    if estado not in ('pendiente', 'en_ruta', 'finalizado', 'cancelado'):
        raise HTTPException(status_code=400, detail='Estado inválido')
    
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    try:
        cur.execute('SELECT idEntrega, idEmpresa FROM entrega_ruta_O WHERE idEntrega = %s', (id,))
        entrega = cur.fetchone()
        
        if not entrega:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Entrega no encontrada')
        
        if context['role'] != 'superadmin' and entrega['idEmpresa'] != context['idEmpresa']:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No tiene permisos')
        
        upd = conn.cursor()
        upd.execute('UPDATE entrega_ruta_O SET estado = %s WHERE idEntrega = %s', (estado, id))
        conn.commit()
        upd.close()
        cur.close()
        conn.close()
        
        return {'idEntrega': id, 'estado': estado}
    
    except mysql_errors as e:
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f'Database error: {e}')


@app.delete('/entregas/{id}', status_code=204)
def delete_entrega(id: int, x_user_role: str = Header(None), request: Request = None):
    """Delete delivery (only if pendiente or en_ruta, and restore stock)"""
    context = get_user_context(x_user_role, request)
    
    if context['role'] not in ('admin', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    try:
        cur.execute('SELECT idEntrega, idEmpresa, estado FROM entrega_ruta_O WHERE idEntrega = %s', (id,))
        entrega = cur.fetchone()
        
        if not entrega:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Entrega no encontrada')
        
        if context['role'] != 'superadmin' and entrega['idEmpresa'] != context['idEmpresa']:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No tiene permisos')
        
        if entrega['estado'] not in ('pendiente', 'en_ruta'):
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Solo se pueden eliminar entregas pendientes o en ruta')
        
        # Restore inventory before deleting
        cur.execute('''
            SELECT idDetalle, idLote, cantidadEnviada
            FROM entrega_ruta_detalle_O
            WHERE idEntrega = %s AND idLote IS NOT NULL
        ''', (id,))
        
        detalles = cur.fetchall() or []
        
        upd = conn.cursor()
        for det in detalles:
            upd.execute('''
                UPDATE lote_producto
                SET stockActual = stockActual + %s
                WHERE idLote = %s
            ''', (float(det['cantidadEnviada']), det['idLote']))
        
        # Delete (cascade will handle details)
        upd.execute('DELETE FROM entrega_ruta_O WHERE idEntrega = %s', (id,))
        conn.commit()
        upd.close()
        cur.close()
        conn.close()
        
        return None
    
    except mysql_errors as e:
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f'Database error: {e}')


@app.get('/entregas/encargado/{id_encargado}/stock')
def get_stock_encargado(id_encargado: int, x_user_role: str = Header(None), request: Request = None):
    """Get available stock for encargado in their active delivery (en_ruta)"""
    context = get_user_context(x_user_role, request)
    
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    try:
        # Find active delivery (en_ruta) for this encargado
        cur.execute('''
            SELECT idEntrega, idEmpresa 
            FROM entrega_ruta_O 
            WHERE idEncargado = %s AND estado = 'en_ruta'
            LIMIT 1
        ''', (id_encargado,))
        
        entrega = cur.fetchone()
        
        if not entrega:
            cur.close()
            conn.close()
            return {'idEntrega': None, 'stock': []}
        
        # Validate access
        if context['role'] != 'superadmin' and entrega['idEmpresa'] != context['idEmpresa']:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No tiene permisos')
        
        # Get stock available (cantidadEnviada - cantidadDevuelta - cantidadVendida)
        cur.execute('''
            SELECT 
                d.idProducto,
                p.nombreProducto,
                d.idLote,
                l.codigoLote,
                d.cantidadEnviada,
                d.cantidadDevuelta,
                d.cantidadVendida,
                (d.cantidadEnviada - d.cantidadDevuelta - d.cantidadVendida) AS stockDisponible,
                d.precioUnitario
            FROM entrega_ruta_detalle_O d
            LEFT JOIN producto_O p ON d.idProducto = p.idProducto
            LEFT JOIN lote_producto l ON d.idLote = l.idLote
            WHERE d.idEntrega = %s
            ORDER BY d.idDetalle
        ''', (entrega['idEntrega'],))
        
        stock = cur.fetchall() or []
        
        # Format
        for s in stock:
            s['cantidadEnviada'] = float(s['cantidadEnviada'])
            s['cantidadDevuelta'] = float(s['cantidadDevuelta'])
            s['cantidadVendida'] = float(s['cantidadVendida'])
            s['stockDisponible'] = float(s['stockDisponible'])
            s['precioUnitario'] = float(s['precioUnitario'])
        
        cur.close()
        conn.close()
        
        return {
            'idEntrega': entrega['idEntrega'],
            'stock': stock
        }
    
    except HTTPException:
        raise
    except mysql_errors as e:
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f'Database error: {e}')


@app.post('/entregas/{id_entrega}/registrar-venta')
def registrar_venta_encargado(
    id_entrega: int, 
    idProducto: int, 
    idLote: Optional[int] = None,
    cantidad: float = 0,
    x_user_role: str = Header(None), 
    request: Request = None
):
    """Register a sale from encargado's delivery stock (updates cantidadVendida)"""
    context = get_user_context(x_user_role, request)
    
    if context['role'] not in ('admin', 'editor', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')
    
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    try:
        # Validate entrega exists and is en_ruta
        cur.execute('SELECT idEntrega, idEmpresa, estado FROM entrega_ruta_O WHERE idEntrega = %s', (id_entrega,))
        entrega = cur.fetchone()
        
        if not entrega:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Entrega no encontrada')
        
        if entrega['estado'] != 'en_ruta':
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='La entrega debe estar en ruta para registrar ventas')
        
        # Find the detail line for this product/lote
        if idLote:
            cur.execute('''
                SELECT idDetalle, cantidadEnviada, cantidadDevuelta, cantidadVendida
                FROM entrega_ruta_detalle_O
                WHERE idEntrega = %s AND idProducto = %s AND idLote = %s
            ''', (id_entrega, idProducto, idLote))
        else:
            cur.execute('''
                SELECT idDetalle, cantidadEnviada, cantidadDevuelta, cantidadVendida
                FROM entrega_ruta_detalle_O
                WHERE idEntrega = %s AND idProducto = %s AND idLote IS NULL
            ''', (id_entrega, idProducto))
        
        detalle = cur.fetchone()
        
        if not detalle:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Producto no encontrado en esta entrega')
        
        # Calculate available stock
        disponible = float(detalle['cantidadEnviada']) - float(detalle['cantidadDevuelta']) - float(detalle['cantidadVendida'])
        
        if cantidad > disponible:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail=f'Stock insuficiente. Disponible: {disponible}')
        
        # Update cantidadVendida
        upd = conn.cursor()
        upd.execute('''
            UPDATE entrega_ruta_detalle_O
            SET cantidadVendida = cantidadVendida + %s
            WHERE idDetalle = %s
        ''', (cantidad, detalle['idDetalle']))
        
        conn.commit()
        upd.close()
        cur.close()
        conn.close()
        
        return {'ok': True, 'message': 'Venta registrada en entrega', 'cantidadVendida': cantidad}
    
    except HTTPException:
        raise
    except mysql_errors as e:
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f'Database error: {e}')


# ========================
# Endpoints de rastreo en vivo
# ========================

@app.post('/entregas/{id}/ubicacion', response_model=UbicacionOut)
def actualizar_ubicacion(id: int, payload: UbicacionIn, x_user_role: str = Header(None), request: Request = None):
    """Actualiza la última ubicación de la entrega y la transmite por WebSocket"""
    context = get_user_context(x_user_role, request)

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute('SELECT idEntrega, idEmpresa, idEncargado, estado FROM entrega_ruta_O WHERE idEntrega = %s', (id,))
        entrega = cur.fetchone()
        if not entrega:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail='Entrega no encontrada')

        # Scoping multiempresa
        if context['role'] != 'superadmin' and entrega['idEmpresa'] != context['idEmpresa']:
            cur.close(); conn.close()
            raise HTTPException(status_code=403, detail='No tiene permisos')

        # Permisos: admin/editor/superadmin o el propio encargado
        if context['role'] not in ('admin', 'editor', 'superadmin') and context.get('id_persona') != entrega['idEncargado']:
            cur.close(); conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')

        ensure_ubicacion_table(conn)

        ins = conn.cursor()
        # upsert por PK idEntrega
        ins.execute(
            '''INSERT INTO entrega_ubicacion_O (idEntrega, idEmpresa, lat, lng, accuracy)
               VALUES (%s, %s, %s, %s, %s)
               ON DUPLICATE KEY UPDATE lat=VALUES(lat), lng=VALUES(lng), accuracy=VALUES(accuracy), updated_at=CURRENT_TIMESTAMP''',
            (id, entrega['idEmpresa'], float(payload.lat), float(payload.lng), (None if payload.accuracy is None else float(payload.accuracy)))
        )
        conn.commit()

        # Obtener fila actualizada
        cur.execute('SELECT idEntrega, lat, lng, accuracy, updated_at FROM entrega_ubicacion_O WHERE idEntrega = %s', (id,))
        row = cur.fetchone()
        cur.close(); conn.close()

        data = {
            'idEntrega': id,
            'lat': float(row['lat']),
            'lng': float(row['lng']),
            'accuracy': (None if row['accuracy'] is None else float(row['accuracy'])),
            'updated_at': row['updated_at'].isoformat() if row.get('updated_at') else datetime.utcnow().isoformat()
        }

        # Broadcast a clientes WebSocket conectados
        for ws in list(ws_conns.get(id, [])):
            try:
                asyncio.create_task(ws.send_text(json.dumps(data)))
            except RuntimeError:
                # conexión posiblemente cerrada
                try:
                    ws_conns.get(id, []).remove(ws)
                except Exception:
                    pass

        return data
    except HTTPException:
        raise
    except Exception as e:
        try:
            cur.close(); conn.close()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f'Error: {e}')


@app.get('/entregas/{id}/ubicacion/ultima', response_model=Optional[UbicacionOut])
def obtener_ultima_ubicacion(id: int, x_user_role: str = Header(None), request: Request = None):
    """Devuelve la última ubicación registrada para una entrega"""
    context = get_user_context(x_user_role, request)

    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute('SELECT idEntrega, idEmpresa FROM entrega_ruta_O WHERE idEntrega = %s', (id,))
        entrega = cur.fetchone()
        if not entrega:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail='Entrega no encontrada')

        if context['role'] != 'superadmin' and entrega['idEmpresa'] != context['idEmpresa']:
            cur.close(); conn.close()
            raise HTTPException(status_code=403, detail='No tiene permisos')

        ensure_ubicacion_table(conn)
        cur.execute('SELECT lat, lng, accuracy, updated_at FROM entrega_ubicacion_O WHERE idEntrega = %s', (id,))
        row = cur.fetchone()
        cur.close(); conn.close()
        if not row:
            return None
        return {
            'lat': float(row['lat']),
            'lng': float(row['lng']),
            'accuracy': (None if row['accuracy'] is None else float(row['accuracy'])),
            'updated_at': row['updated_at'].isoformat() if row.get('updated_at') else datetime.utcnow().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        try:
            cur.close(); conn.close()
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f'Error: {e}')


@app.websocket('/ws/entregas/{id}/ubicacion')
async def ws_entrega_ubicacion(websocket: WebSocket, id: int):
    # Autenticación: token como query param o primer mensaje
    token = websocket.query_params.get('token')
    await websocket.accept()
    try:
        if not token:
            # esperar primer mensaje con {token}
            msg = await websocket.receive_text()
            try:
                obj = json.loads(msg)
                token = obj.get('token')
            except Exception:
                token = None
        if not token:
            await websocket.send_text(json.dumps({'error': 'auth required'}))
            await websocket.close()
            return

        # Validar JWT y scoping empresa vs entrega
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        except Exception:
            await websocket.send_text(json.dumps({'error': 'invalid token'}))
            await websocket.close()
            return

        idEmpresa = payload.get('company_id')
        role = (payload.get('role') or 'viewer').lower()

        # Validar contra la entrega
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute('SELECT idEntrega, idEmpresa FROM entrega_ruta_O WHERE idEntrega = %s', (id,))
        entrega = cur.fetchone()
        cur.close(); conn.close()
        if not entrega:
            await websocket.send_text(json.dumps({'error': 'Entrega no encontrada'}))
            await websocket.close()
            return
        if role != 'superadmin' and entrega['idEmpresa'] != idEmpresa:
            await websocket.send_text(json.dumps({'error': 'forbidden'}))
            await websocket.close()
            return

        # Registrar conexión
        ws_conns.setdefault(id, []).append(websocket)
        await websocket.send_text(json.dumps({'ok': True, 'message': 'connected', 'idEntrega': id}))

        # Esperar mensajes del cliente (pings) y mantener viva la conexión
        while True:
            try:
                _ = await websocket.receive_text()
                # Ignorar; los updates vienen desde REST y se hacen broadcast
            except WebSocketDisconnect:
                break
            except Exception:
                # Si el cliente no envía nada, dormir un poco para mantener el loop
                await asyncio.sleep(5)
    finally:
        # Limpiar conexión
        try:
            if id in ws_conns and websocket in ws_conns[id]:
                ws_conns[id].remove(websocket)
        except Exception:
            pass
