from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date
from decimal import Decimal
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
    )

# JWT settings
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


# ========================
# Modelos para Cuentas Corrientes
# ========================

class CuentaCorrienteIn(BaseModel):
    idPersona: int
    tipoCuenta: str = Field(..., max_length=1)  # 'C'=por cobrar, 'P'=por pagar
    saldo: Decimal = Field(default=0.0)
    fechaApertura: Optional[str] = None  # ISO date
    estado: int = Field(default=1, ge=0, le=1)


class CuentaCorrienteOut(CuentaCorrienteIn):
    idCuenta: int
    idEmpresa: int
    nombrePersona: Optional[str] = None
    nombreEmpresa: Optional[str] = None


class PagoIn(BaseModel):
    tipo: str = Field(..., max_length=10)  # 'cobro' o 'pago'
    idPersona: Optional[int] = None  # Para cobros (cliente)
    idProveedor: Optional[int] = None  # Para pagos (proveedor)
    monto: Decimal = Field(gt=0)
    idTipoPago: int  # Forma de pago (efectivo, transferencia, etc)
    fechaPago: Optional[str] = None  # ISO date
    numeroReferencia: Optional[str] = Field(None, max_length=50)
    observaciones: Optional[str] = Field(None, max_length=500)


class PagoOut(PagoIn):
    idPago: int
    numeroPago: str
    idEmpresa: int
    created_at: Optional[str] = None


# ========================
# Endpoints de Cuentas Corrientes
# ========================

@app.get('/cuentas', response_model=List[CuentaCorrienteOut])
def list_cuentas(
    idPersona: Optional[int] = None,
    tipoCuenta: Optional[str] = None,
    estado: Optional[int] = None,
    offset: int = 0,
    limit: int = 100,
    x_user_role: str = Header(None),
    request: Request = None
):
    """Listar cuentas corrientes. Superadmin ve todas, admin solo de su empresa."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        role = get_role(x_user_role, request)
        user_company = get_company_id_from_request(request)

        query = '''
            SELECT 
                cc.idCuentaCorriente AS idCuenta, cc.idPersona, cc.idEmpresa, CASE WHEN cc.tipo='cliente' THEN 'C' ELSE 'P' END AS tipoCuenta,
                cc.saldo, cc.fechaMovimiento AS fechaApertura, cc.estado,
                CONCAT(p.nombres_persona, ' ', COALESCE(p.apellido_paternoPersona, '')) AS nombrePersona,
                e.nombre_empresa AS nombreEmpresa
            FROM cuenta_corriente_O cc
            LEFT JOIN persona_O p ON cc.idPersona = p.id_persona
            LEFT JOIN empresa_O e ON cc.idEmpresa = e.id_empresa
        '''
        
        where = []
        params = []

        # Scoping multiempresa
        if role != 'superadmin' and user_company is not None:
            where.append('cc.idEmpresa = %s')
            params.append(user_company)

        # Filtros
        if idPersona is not None:
            where.append('cc.idPersona = %s')
            params.append(idPersona)
        if tipoCuenta:
            # Mapear filtro de alias ('C'/'P') al campo real ENUM('cliente','proveedor')
            if tipoCuenta == 'C':
                where.append("cc.tipo = 'cliente'")
            elif tipoCuenta == 'P':
                where.append("cc.tipo = 'proveedor'")
            else:
                where.append('1=0')  # fuerza vacío si valor inválido
        if estado is not None:
            where.append('cc.estado = %s')
            params.append(estado)

        if where:
            query += ' WHERE ' + ' AND '.join(where)
        
        # Usar columnas reales en ORDER BY (no alias) y el PK correcto
        query += ' ORDER BY cc.fechaMovimiento DESC, cc.idCuentaCorriente DESC LIMIT %s OFFSET %s'
        params.extend([limit, offset])

        cur.execute(query, tuple(params))
        rows = cur.fetchall() or []
        # Convertir tipos
        for r in rows:
            r['saldo'] = float(r['saldo']) if r.get('saldo') else 0.0
            r['fechaApertura'] = r['fechaApertura'].isoformat() if r.get('fechaApertura') else None

        cur.close()
        conn.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/cuentas/{id}', response_model=CuentaCorrienteOut)
def get_cuenta(id: int, x_user_role: str = Header(None), request: Request = None):
    """Obtener cuenta por ID."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        role = get_role(x_user_role, request)
        user_company = get_company_id_from_request(request)

        query = '''
            SELECT 
                cc.idCuentaCorriente AS idCuenta, cc.idPersona, cc.idEmpresa, CASE WHEN cc.tipo='cliente' THEN 'C' ELSE 'P' END AS tipoCuenta,
                cc.saldo, cc.fechaMovimiento AS fechaApertura, cc.estado,
                CONCAT(p.nombres_persona, ' ', COALESCE(p.apellido_paternoPersona, '')) AS nombrePersona,
                e.nombre_empresa AS nombreEmpresa
            FROM cuenta_corriente_O cc
            LEFT JOIN persona_O p ON cc.idPersona = p.id_persona
            LEFT JOIN empresa_O e ON cc.idEmpresa = e.id_empresa
            WHERE cc.idCuentaCorriente = %s
        '''
        cur.execute(query, (id,))
        cuenta = cur.fetchone()
        
        if not cuenta:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Cuenta no encontrada')

        # Validar scoping
        if role != 'superadmin' and user_company is not None and cuenta['idEmpresa'] != user_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')

        # Convertir tipos
        cuenta['saldo'] = float(cuenta['saldo']) if cuenta.get('saldo') else 0.0
        cuenta['fechaApertura'] = cuenta['fechaApertura'].isoformat() if cuenta.get('fechaApertura') else None

        cur.close()
        conn.close()
        return cuenta
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/cuentas', response_model=CuentaCorrienteOut, status_code=201)
def create_cuenta(payload: CuentaCorrienteIn, x_user_role: str = Header(None), request: Request = None):
    """Crear cuenta corriente."""
    role = get_role(x_user_role, request)
    if role not in ('admin', 'editor', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')

    if payload.tipoCuenta not in ('C', 'P'):
        raise HTTPException(status_code=400, detail='tipoCuenta debe ser C o P')

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        # Determinar empresa
        user_company = get_company_id_from_request(request)
        if role == 'superadmin':
            # Usar empresa de la persona
            cur.execute('SELECT id_empresa FROM persona_O WHERE id_persona = %s', (payload.idPersona,))
            pers = cur.fetchone()
            if not pers or not pers.get('id_empresa'):
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='Persona no tiene empresa asignada')
            target_company = pers['id_empresa']
        else:
            if user_company is None:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='Usuario sin empresa')
            target_company = user_company

        # Validar persona
        cur.execute('SELECT id_persona, id_empresa FROM persona_O WHERE id_persona = %s', (payload.idPersona,))
        pers = cur.fetchone()
        if not pers:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Persona no existe')
        
        if role != 'superadmin' and pers['id_empresa'] != target_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Persona no pertenece a su empresa')

        fechaApertura = payload.fechaApertura or date.today().isoformat()

        # Insertar
        ins = conn.cursor()
        ins.execute('''
            INSERT INTO cuenta_corriente_O (idPersona, idEmpresa, tipoCuenta, saldo, fechaApertura, estado)
            VALUES (%s, %s, %s, %s, %s, %s)
        ''', (payload.idPersona, target_company, payload.tipoCuenta, float(payload.saldo), 
              fechaApertura, payload.estado))
        conn.commit()
        new_id = ins.lastrowid
        ins.close()
        cur.close()
        conn.close()

        return get_cuenta(new_id, x_user_role, request)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put('/cuentas/{id}', response_model=CuentaCorrienteOut)
def update_cuenta(id: int, payload: CuentaCorrienteIn, x_user_role: str = Header(None), request: Request = None):
    """Actualizar cuenta (solo saldo y estado)."""
    role = get_role(x_user_role, request)
    if role not in ('admin', 'editor', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)

        cur.execute('SELECT idCuentaCorriente AS idCuenta, idEmpresa FROM cuenta_corriente_O WHERE idCuentaCorriente = %s', (id,))
        cuenta = cur.fetchone()
        if not cuenta:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Cuenta no encontrada')

        if role != 'superadmin' and user_company is not None and cuenta['idEmpresa'] != user_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')

        # Solo actualizar saldo y estado
        upd = conn.cursor()
        upd.execute('''
            UPDATE cuenta_corriente_O 
            SET saldo = %s, estado = %s
            WHERE idCuentaCorriente = %s
        ''', (float(payload.saldo), payload.estado, id))
        conn.commit()
        upd.close()
        cur.close()
        conn.close()

        return get_cuenta(id, x_user_role, request)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete('/cuentas/{id}', status_code=204)
def delete_cuenta(id: int, x_user_role: str = Header(None), request: Request = None):
    """Eliminar/cerrar cuenta."""
    role = get_role(x_user_role, request)
    if role not in ('admin', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)

        cur.execute('SELECT idCuentaCorriente AS idCuenta, idEmpresa FROM cuenta_corriente_O WHERE idCuentaCorriente = %s', (id,))
        cuenta = cur.fetchone()
        if not cuenta:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Cuenta no encontrada')

        if role != 'superadmin' and user_company is not None and cuenta['idEmpresa'] != user_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')

        if role == 'superadmin':
            # Eliminar físicamente
            d = conn.cursor()
            d.execute('DELETE FROM cuenta_corriente_O WHERE idCuentaCorriente = %s', (id,))
            conn.commit()
            d.close()
        else:
            # Cerrar (estado=0)
            upd = conn.cursor()
            upd.execute('UPDATE cuenta_corriente_O SET estado = 0 WHERE idCuentaCorriente = %s', (id,))
            conn.commit()
            upd.close()

        cur.close()
        conn.close()
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# Endpoints de Pagos
# ========================

@app.get('/cuentas/{id}/pagos', response_model=List[PagoOut])
def list_pagos(id: int, x_user_role: str = Header(None), request: Request = None):
    """Listar pagos de una cuenta."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        role = get_role(x_user_role, request)
        user_company = get_company_id_from_request(request)

        # Validar que la cuenta existe y tenemos acceso
        cur.execute('SELECT idCuentaCorriente AS idCuenta, idEmpresa FROM cuenta_corriente_O WHERE idCuentaCorriente = %s', (id,))
        cuenta = cur.fetchone()
        if not cuenta:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Cuenta no encontrada')

        if role != 'superadmin' and user_company is not None and cuenta['idEmpresa'] != user_company:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')

        # Obtener pagos
        cur.execute('''
            SELECT idPago, idCuenta, monto, fecha_pago, tipo_pago, observaciones
            FROM pago_O
            WHERE idCuenta = %s
            ORDER BY fecha_pago DESC, idPago DESC
        ''', (id,))
        pagos = cur.fetchall() or []
        
        # Convertir tipos
        for p in pagos:
            p['monto'] = float(p['monto']) if p.get('monto') else 0.0
            p['fecha_pago'] = p['fecha_pago'].isoformat() if p.get('fecha_pago') else None

        cur.close()
        conn.close()
        return pagos
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/pagos', response_model=PagoOut, status_code=201)
def create_pago(payload: PagoIn, x_user_role: str = Header(None), request: Request = None):
    """Registrar un pago/cobro y crear movimiento en cuenta corriente."""
    role = get_role(x_user_role, request)
    if role not in ('admin', 'editor', 'superadmin'):
        raise HTTPException(status_code=403, detail='Permission denied')

    if payload.tipo not in ('cobro', 'pago'):
        raise HTTPException(status_code=400, detail='tipo debe ser "cobro" o "pago"')

    if payload.tipo == 'cobro' and not payload.idPersona:
        raise HTTPException(status_code=400, detail='idPersona requerido para cobros')
    
    if payload.tipo == 'pago' and not payload.idProveedor:
        raise HTTPException(status_code=400, detail='idProveedor requerido para pagos')

    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        user_company = get_company_id_from_request(request)

        # Determinar empresa
        if role == 'superadmin':
            if payload.tipo == 'cobro' and payload.idPersona:
                cur.execute('SELECT id_empresa FROM persona_O WHERE id_persona = %s', (payload.idPersona,))
                pers = cur.fetchone()
                target_company = pers['id_empresa'] if pers else None
            elif payload.tipo == 'pago' and payload.idProveedor:
                cur.execute('SELECT idEmpresaProveedor FROM proveedor_O WHERE idProveedor = %s', (payload.idProveedor,))
                prov = cur.fetchone()
                target_company = prov['idEmpresaProveedor'] if prov else None
            else:
                target_company = user_company
        else:
            if user_company is None:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='Usuario sin empresa')
            target_company = user_company

        if target_company is None:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='No se pudo determinar empresa')

        fechaPago = payload.fechaPago or date.today().isoformat()
        
        # Generar numeroPago único
        import random
        numeroPago = f"PG{target_company}{random.randint(100000, 999999)}"

        # Insertar pago
        ins = conn.cursor()
        ins.execute('''
            INSERT INTO pago_O (numeroPago, fechaPago, tipo, idPersona, idProveedor, idEmpresa, monto, idTipoPago, numeroReferencia, observaciones)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ''', (numeroPago, fechaPago, payload.tipo, payload.idPersona, payload.idProveedor, 
              target_company, float(payload.monto), payload.idTipoPago, payload.numeroReferencia, payload.observaciones))
        conn.commit()
        new_id = ins.lastrowid
        ins.close()

        # Crear movimiento en cuenta corriente
        mov = conn.cursor()
        if payload.tipo == 'cobro':
            # Cobro: haber (reduce deuda del cliente)
            mov.execute('''
                INSERT INTO cuenta_corriente_O 
                (tipo, idPersona, idEmpresa, fechaMovimiento, tipoMovimiento, idReferencia, debe, haber, saldo, descripcion, estado)
                VALUES ('cliente', %s, %s, %s, 'cobro', %s, 0, %s, -%s, %s, 1)
            ''', (payload.idPersona, target_company, fechaPago, new_id, 
                  float(payload.monto), float(payload.monto), 
                  f'Cobro #{numeroPago}'))
        else:  # pago
            # Pago: debe (reduce deuda con proveedor)
            # Necesitamos idPersona del proveedor si es persona
            cur.execute('SELECT idPersona FROM proveedor_O WHERE idProveedor = %s', (payload.idProveedor,))
            prov_data = cur.fetchone()
            id_persona_prov = prov_data.get('idPersona') if prov_data else None
            
            if id_persona_prov:
                mov.execute('''
                    INSERT INTO cuenta_corriente_O 
                    (tipo, idPersona, idEmpresa, fechaMovimiento, tipoMovimiento, idReferencia, debe, haber, saldo, descripcion, estado)
                    VALUES ('proveedor', %s, %s, %s, 'pago', %s, %s, 0, -%s, %s, 1)
                ''', (id_persona_prov, target_company, fechaPago, new_id, 
                      float(payload.monto), float(payload.monto), 
                      f'Pago #{numeroPago}'))
        
        conn.commit()
        mov.close()
        cur.close()
        conn.close()

        # Retornar pago creado
        return {
            'idPago': new_id,
            'numeroPago': numeroPago,
            'tipo': payload.tipo,
            'idPersona': payload.idPersona,
            'idProveedor': payload.idProveedor,
            'idEmpresa': target_company,
            'monto': float(payload.monto),
            'idTipoPago': payload.idTipoPago,
            'fechaPago': fechaPago,
            'numeroReferencia': payload.numeroReferencia,
            'observaciones': payload.observaciones,
            'created_at': fechaPago
        }
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
        cur.close()
        conn.close()
        return {'status': 'ok', 'db': 'connected'}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f'db error: {e}')





