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

        # Agregar resumen de movimientos pendientes por persona y empresa
        query = '''
            SELECT 
                cc.idPersona, cc.idEmpresa,
                CASE WHEN cc.tipo = 'cliente' THEN 'C' ELSE 'P' END AS tipoCuenta,
                SUM(CASE WHEN cc.tipo = 'cliente' THEN cc.debe ELSE 0 END) - 
                SUM(CASE WHEN cc.tipo = 'cliente' THEN cc.haber ELSE 0 END) AS saldo,
                MIN(cc.fechaMovimiento) AS fechaApertura,
                MAX(cc.estado) AS estado,
                CONCAT(p.nombres_persona, ' ', COALESCE(p.apellido_paternoPersona, '')) AS nombrePersona,
                e.nombre_empresa AS nombreEmpresa
            FROM cuenta_corriente_O cc
            LEFT JOIN persona_O p ON cc.idPersona = p.id_persona
            LEFT JOIN empresa_O e ON cc.idEmpresa = e.id_empresa
        '''
        
        where = []
        params = []

        # MULTI-EMPRESA: Filtrado obligatorio por empresa para roles no superadmin
        if role != 'superadmin':
            if user_company is not None:
                where.append('cc.idEmpresa = %s')
                params.append(user_company)
            else:
                # Sin empresa asignada = sin acceso a cuentas
                where.append('1 = 0')  # Retorna vacío por seguridad
        
        # Solo mostrar movimientos activos
        where.append('cc.estado = 1')

        # Filtros
        if idPersona is not None:
            where.append('cc.idPersona = %s')
            params.append(idPersona)
        if tipoCuenta:
            # Mapear filtro de alias ('C'/'P') al campo real ENUM('cliente','proveedor','caja')
            if tipoCuenta == 'C':
                where.append("cc.tipo = 'cliente'")
            elif tipoCuenta == 'P':
                where.append("cc.tipo = 'proveedor'")
            else:
                where.append('1=0')  # fuerza vacío si valor inválido

        if where:
            query += ' WHERE ' + ' AND '.join(where)
        
        # GROUP BY para consolidar movimientos por persona y empresa
        query += ' GROUP BY cc.idPersona, cc.idEmpresa, cc.tipo HAVING saldo != 0'
        query += ' ORDER BY nombrePersona ASC LIMIT %s OFFSET %s'
        params.extend([limit, offset])

        cur.execute(query, tuple(params))
        rows = cur.fetchall() or []
        # Convertir tipos y agregar idCuenta virtual (usamos idPersona como identificador)
        for r in rows:
            r['idCuenta'] = r['idPersona']  # Usar idPersona como identificador de la cuenta
            r['saldo'] = float(r['saldo']) if r.get('saldo') else 0.0
            r['fechaApertura'] = r['fechaApertura'].isoformat() if r.get('fechaApertura') else None

        cur.close()
        conn.close()
        return rows
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/cuentas/persona/{id_persona}', response_model=CuentaCorrienteOut)
def get_cuenta_by_persona(id_persona: int, x_user_role: str = Header(None), request: Request = None):
    """Obtener resumen de cuenta por ID de persona (suma de movimientos)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        role = get_role(x_user_role, request)
        user_company = get_company_id_from_request(request)

        # Calcular saldo actual sumando movimientos
        query = '''
            SELECT 
                cc.idPersona,
                cc.idEmpresa,
                CASE WHEN cc.tipo = 'cliente' THEN 'C' ELSE 'P' END AS tipoCuenta,
                SUM(CASE WHEN cc.tipo = 'cliente' THEN cc.debe - cc.haber ELSE cc.haber - cc.debe END) AS saldo,
                MIN(cc.fechaMovimiento) AS fechaApertura,
                MAX(cc.estado) AS estado,
                CONCAT(p.nombres_persona, ' ', COALESCE(p.apellido_paternoPersona, '')) AS nombrePersona,
                e.nombre_empresa AS nombreEmpresa
            FROM cuenta_corriente_O cc
            LEFT JOIN persona_O p ON cc.idPersona = p.id_persona
            LEFT JOIN empresa_O e ON cc.idEmpresa = e.id_empresa
            WHERE cc.idPersona = %s AND cc.estado = 1
            GROUP BY cc.idPersona, cc.idEmpresa, cc.tipo
        '''
        cur.execute(query, (id_persona,))
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

        # Convertir tipos y agregar idCuenta virtual
        cuenta['idCuenta'] = cuenta['idPersona']
        cuenta['saldo'] = float(cuenta['saldo']) if cuenta.get('saldo') else 0.0
        cuenta['fechaApertura'] = cuenta['fechaApertura'].isoformat() if cuenta.get('fechaApertura') else None

        cur.close()
        conn.close()
        return cuenta
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get('/cuentas/persona/{id_persona}/movimientos')
def get_movimientos_persona(id_persona: int, x_user_role: str = Header(None), request: Request = None):
    """Obtener todos los movimientos de una persona (historial de cuenta corriente)."""
    try:
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        role = get_role(x_user_role, request)
        user_company = get_company_id_from_request(request)

        # Validar acceso a la persona
        cur.execute('SELECT id_persona, id_empresa FROM persona_O WHERE id_persona = %s', (id_persona,))
        persona = cur.fetchone()
        if not persona:
            cur.close(); conn.close()
            raise HTTPException(status_code=404, detail='Persona no encontrada')
        
        if role != 'superadmin' and user_company is not None and persona['id_empresa'] != user_company:
            cur.close(); conn.close()
            raise HTTPException(status_code=403, detail='No autorizado')

        # Obtener movimientos ordenados por fecha
        cur.execute('''
            SELECT 
                idCuentaCorriente AS idCuenta, tipo, fechaMovimiento, tipoMovimiento, idReferencia,
                debe, haber, saldo AS saldoMovimiento, descripcion, estado
            FROM cuenta_corriente_O
            WHERE idPersona = %s AND idEmpresa = %s
            ORDER BY fechaMovimiento DESC, idCuentaCorriente DESC
        ''', (id_persona, persona['id_empresa']))
        
        movimientos = cur.fetchall() or []
        
        # Calcular saldo acumulado
        saldo_acumulado = 0
        for mov in reversed(movimientos):  # Calcular desde el más antiguo
            debe = float(mov['debe']) if mov.get('debe') else 0.0
            haber = float(mov['haber']) if mov.get('haber') else 0.0
            if mov['tipo'] == 'cliente':
                saldo_acumulado += debe - haber
            else:
                saldo_acumulado += haber - debe
            mov['saldoAcumulado'] = saldo_acumulado
            mov['debe'] = debe
            mov['haber'] = haber
            mov['fechaMovimiento'] = mov['fechaMovimiento'].isoformat() if mov.get('fechaMovimiento') else None
        
        # Revertir para mostrar más recientes primero
        movimientos.reverse()
        
        cur.close(); conn.close()
        return {'persona': persona, 'movimientos': movimientos, 'saldoActual': saldo_acumulado}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# Las cuentas se crean automáticamente al registrar ventas/compras a crédito
# No se crean manualmente


# ========================
# Endpoints de Pagos y Cobros
# ========================

@app.post('/pagos-cobros', status_code=201)
def registrar_pago_cobro(payload: PagoIn, x_user_role: str = Header(None), request: Request = None):
    """Registrar pago o cobro de una cuenta corriente (reduce el saldo pendiente)."""
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
        
        # Generar numeroPago único: EMPRESA-TIPO-YYYY-MM-DD-NNN
        cur.execute('SELECT nombre_empresa FROM empresa_O WHERE id_empresa = %s', (target_company,))
        emp = cur.fetchone() or {}
        nombre_empresa = (emp.get('nombre_empresa') or '').upper()
        empresa_slug = ''.join(ch for ch in nombre_empresa if ch.isalnum())[:5]
        from datetime import datetime
        f = datetime.fromisoformat(fechaPago) if isinstance(fechaPago, str) else datetime.utcnow()
        tipo_abbr = 'COB' if payload.tipo == 'cobro' else 'PAG'
        prefix = f"{empresa_slug}-{tipo_abbr}-{f.year}-{f.month:02d}-{f.day:02d}-"
        
        # Obtener secuencia
        cur.execute('''
            SELECT MAX(CAST(SUBSTRING_INDEX(descripcion, '-', -1) AS UNSIGNED)) AS max_seq
            FROM cuenta_corriente_O
            WHERE descripcion LIKE %s
        ''', (prefix + '%',))
        row = cur.fetchone() or {}
        next_seq = int(row.get('max_seq') or 0) + 1
        numeroPago = f"{prefix}{next_seq:03d}"

        # Crear movimiento en cuenta corriente que REDUCE la deuda
        mov = conn.cursor()
        if payload.tipo == 'cobro':
            # Cobro: haber (reduce deuda del cliente)
            # Los clientes tienen debe (lo que deben), el haber reduce esa deuda
            mov.execute('''
                INSERT INTO cuenta_corriente_O 
                (tipo, idPersona, idEmpresa, fechaMovimiento, tipoMovimiento, idReferencia, debe, haber, saldo, descripcion, estado)
                VALUES ('cliente', %s, %s, %s, 'cobro', NULL, 0, %s, -%s, %s, 1)
            ''', (payload.idPersona, target_company, fechaPago, 
                  float(payload.monto), float(payload.monto), 
                  f'{numeroPago} - {payload.observaciones or "Cobro de cuenta"}'))
            
            # No registramos 'caja' en este módulo; se debe manejar en módulo de caja/banco.
        else:  # pago
            # Pago: debe (reduce deuda con proveedor)
            # Los proveedores tienen haber (lo que les debemos), el debe reduce esa deuda
            cur.execute('SELECT idPersona FROM proveedor_O WHERE idProveedor = %s', (payload.idProveedor,))
            prov_data = cur.fetchone()
            id_persona_prov = prov_data.get('idPersona') if prov_data else None
            
            if id_persona_prov:
                mov.execute('''
                    INSERT INTO cuenta_corriente_O 
                    (tipo, idPersona, idEmpresa, fechaMovimiento, tipoMovimiento, idReferencia, debe, haber, saldo, descripcion, estado)
                    VALUES ('proveedor', %s, %s, %s, 'pago', NULL, %s, 0, -%s, %s, 1)
                ''', (id_persona_prov, target_company, fechaPago, 
                      float(payload.monto), float(payload.monto), 
                      f'{numeroPago} - {payload.observaciones or "Pago a proveedor"}'))
            
            # No registramos 'caja' en este módulo; se debe manejar en módulo de caja/banco.
        
        conn.commit()
        mov.close()
        cur.close()
        conn.close()

        msg = ('Cobro' if payload.tipo == 'cobro' else 'Pago') + ' registrado exitosamente'
        return {
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
            'message': msg
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





