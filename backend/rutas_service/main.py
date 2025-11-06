from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from decimal import Decimal
import os
import mysql.connector
from mysql.connector import errors as mysql_errors
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


# JWT settings (shared with persona_service)
JWT_SECRET = os.getenv('JWT_SECRET', 'dev-secret-change-me')
JWT_ALG = 'HS256'


def get_role(x_user_role: str = Header(None), request: Request = None) -> str:
    """Resolve effective role for the request."""
    if x_user_role:
        return x_user_role.lower()
    try:
        if request is not None:
            token = request.cookies.get('ollantay_token')
            if token:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
                return payload.get('role', 'viewer').lower()
    except Exception:
        pass
    return 'viewer'


def get_user_context(x_user_role: str = Header(None), request: Request = None) -> dict:
    """Extract user context (role, empresa, userId) from request."""
    context = {'role': 'viewer', 'idEmpresa': None, 'userId': None}
    
    if x_user_role:
        context['role'] = x_user_role.lower()
    
    try:
        if request is not None:
            token = request.cookies.get('ollantay_token')
            if token:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
                context['role'] = payload.get('role', 'viewer').lower()
                # JWT uses 'company_id', not 'id_empresa'
                context['idEmpresa'] = payload.get('company_id')
                context['userId'] = payload.get('sub')  # 'sub' is the user_id
    except Exception:
        pass
    
    return context


# ========== Models ==========

class RutaIn(BaseModel):
    nombreRuta: str = Field(min_length=1, max_length=100)
    descripcion: Optional[str] = None
    incremento_general: Optional[Decimal] = Field(default=0)  # Incremento aplicado a TODOS los productos


class RutaOut(BaseModel):
    idRuta: int
    nombreRuta: str
    descripcion: Optional[str]
    incremento_general: Decimal
    idEmpresa: int
    nombreEmpresa: Optional[str]


class RutaPrecioIn(BaseModel):
    idProducto: int
    incremento_precio: Decimal  # Puede ser positivo (aumento) o negativo (descuento)


class RutaPrecioOut(BaseModel):
    idRuta: int
    idProducto: int
    nombreProducto: Optional[str]
    incremento_precio: Decimal
    precio_base: Optional[Decimal]  # Precio del producto sin ruta
    precio_final: Optional[Decimal]  # precio_base + incremento_precio


# ========== Health Check ==========

@app.get('/health')
def health():
    """Health check endpoint"""
    return {'status': 'ok', 'service': 'rutas_service'}


# ========== CRUD Rutas ==========

@app.get('/rutas', response_model=List[RutaOut])
def get_rutas(request: Request, x_user_role: str = Header(None)):
    """Get all routes for the user's empresa"""
    try:
        context = get_user_context(x_user_role, request)
        
        conn = get_db_connection()
        cur = conn.cursor(dictionary=True)
        
        try:
            if context['role'] == 'superadmin':
                # Superadmin sees all routes
                cur.execute('''
                    SELECT r.idRuta, r.nombreRuta, r.descripcion, r.incremento_general, r.idEmpresa, e.nombre_empresa as nombreEmpresa
                    FROM ruta_O r
                    LEFT JOIN empresa_O e ON r.idEmpresa = e.id_empresa
                    ORDER BY e.nombre_empresa, r.nombreRuta
                ''')
            else:
                # Admin/editor/viewer only see their empresa's routes
                if not context['idEmpresa']:
                    # If no empresa assigned, return empty list
                    cur.close()
                    conn.close()
                    return []
                
                cur.execute('''
                    SELECT r.idRuta, r.nombreRuta, r.descripcion, r.incremento_general, r.idEmpresa, e.nombre_empresa as nombreEmpresa
                    FROM ruta_O r
                    LEFT JOIN empresa_O e ON r.idEmpresa = e.id_empresa
                    WHERE r.idEmpresa = %s
                    ORDER BY r.nombreRuta
                ''', (context['idEmpresa'],))
            
            rutas = cur.fetchall() or []
            cur.close()
            conn.close()
            
            return rutas
        
        except mysql_errors.Error as e:
            cur.close()
            conn.close()
            raise HTTPException(status_code=500, detail=f'Database error: {str(e)}')
    
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f'Internal error: {str(e)}')


@app.get('/rutas/{id}', response_model=RutaOut)
def get_ruta(id: int, request: Request, x_user_role: str = Header(None)):
    """Get a specific route by ID"""
    context = get_user_context(x_user_role, request)
    
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    try:
        cur.execute('''
            SELECT r.idRuta, r.nombreRuta, r.descripcion, r.incremento_general, r.idEmpresa, e.nombre_empresa as nombreEmpresa
            FROM ruta_O r
            LEFT JOIN empresa_O e ON r.idEmpresa = e.id_empresa
            WHERE r.idRuta = %s
        ''', (id,))
        
        ruta = cur.fetchone()
        
        if not ruta:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Ruta no encontrada')
        
        # Validate access - only superadmin or users from same empresa can see
        if context['role'] != 'superadmin' and ruta['idEmpresa'] != context['idEmpresa']:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No tiene permisos para acceder a esta ruta')
        
        cur.close()
        conn.close()
        
        return ruta
    
    except mysql_errors.Error as e:
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f'Database error: {str(e)}')


@app.post('/rutas', response_model=RutaOut)
def create_ruta(ruta: RutaIn, request: Request, x_user_role: str = Header(None)):
    """Create a new route"""
    context = get_user_context(x_user_role, request)
    
    # Only admin and superadmin can create
    if context['role'] not in ['admin', 'superadmin']:
        raise HTTPException(status_code=403, detail='No tiene permisos para crear rutas')
    
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    try:
        # Determine target empresa
        if context['role'] == 'superadmin':
            # Superadmin must have empresa context or it defaults to first empresa (not ideal, but fallback)
            if not context['idEmpresa']:
                cur.execute('SELECT id_empresa FROM empresa_O LIMIT 1')
                emp = cur.fetchone()
                if not emp:
                    cur.close()
                    conn.close()
                    raise HTTPException(status_code=400, detail='No hay empresas disponibles')
                target_empresa = emp['id_empresa']
            else:
                target_empresa = context['idEmpresa']
        else:
            # Admin uses their own empresa
            if not context['idEmpresa']:
                cur.close()
                conn.close()
                raise HTTPException(status_code=400, detail='Usuario sin empresa asignada')
            target_empresa = context['idEmpresa']
        
        # Check for duplicate name in same empresa
        cur.execute('''
            SELECT idRuta FROM ruta_O 
            WHERE nombreRuta = %s AND idEmpresa = %s
        ''', (ruta.nombreRuta, target_empresa))
        
        if cur.fetchone():
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Ya existe una ruta con ese nombre en esta empresa')
        
        # Insert route
        cur.execute('''
            INSERT INTO ruta_O (nombreRuta, descripcion, incremento_general, idEmpresa)
            VALUES (%s, %s, %s, %s)
        ''', (ruta.nombreRuta, ruta.descripcion, ruta.incremento_general, target_empresa))
        
        conn.commit()
        new_id = cur.lastrowid
        
        # Fetch created route
        cur.execute('''
            SELECT r.idRuta, r.nombreRuta, r.descripcion, r.incremento_general, r.idEmpresa, e.nombre_empresa as nombreEmpresa
            FROM ruta_O r
            LEFT JOIN empresa_O e ON r.idEmpresa = e.id_empresa
            WHERE r.idRuta = %s
        ''', (new_id,))
        
        created = cur.fetchone()
        cur.close()
        conn.close()
        
        return created
    
    except mysql_errors.Error as e:
        conn.rollback()
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f'Database error: {str(e)}')


@app.put('/rutas/{id}', response_model=RutaOut)
def update_ruta(id: int, ruta: RutaIn, request: Request, x_user_role: str = Header(None)):
    """Update an existing route"""
    context = get_user_context(x_user_role, request)
    
    # Only admin and superadmin can update
    if context['role'] not in ['admin', 'superadmin']:
        raise HTTPException(status_code=403, detail='No tiene permisos para editar rutas')
    
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    try:
        # Check route exists and validate access
        cur.execute('SELECT idRuta, idEmpresa FROM ruta_O WHERE idRuta = %s', (id,))
        existing = cur.fetchone()
        
        if not existing:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Ruta no encontrada')
        
        # Validate access - only superadmin or users from same empresa
        if context['role'] != 'superadmin' and existing['idEmpresa'] != context['idEmpresa']:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No tiene permisos para editar esta ruta')
        
        # Check for duplicate name (excluding current route)
        cur.execute('''
            SELECT idRuta FROM ruta_O 
            WHERE nombreRuta = %s AND idEmpresa = %s AND idRuta != %s
        ''', (ruta.nombreRuta, existing['idEmpresa'], id))
        
        if cur.fetchone():
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Ya existe otra ruta con ese nombre en esta empresa')
        
        # Update route
        cur.execute('''
            UPDATE ruta_O 
            SET nombreRuta = %s, descripcion = %s, incremento_general = %s
            WHERE idRuta = %s
        ''', (ruta.nombreRuta, ruta.descripcion, ruta.incremento_general, id))
        
        conn.commit()
        
        # Fetch updated route
        cur.execute('''
            SELECT r.idRuta, r.nombreRuta, r.descripcion, r.incremento_general, r.idEmpresa, e.nombre_empresa as nombreEmpresa
            FROM ruta_O r
            LEFT JOIN empresa_O e ON r.idEmpresa = e.id_empresa
            WHERE r.idRuta = %s
        ''', (id,))
        
        updated = cur.fetchone()
        cur.close()
        conn.close()
        
        return updated
    
    except mysql_errors.Error as e:
        conn.rollback()
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f'Database error: {str(e)}')


@app.delete('/rutas/{id}')
def delete_ruta(id: int, request: Request, x_user_role: str = Header(None)):
    """Delete a route"""
    context = get_user_context(x_user_role, request)
    
    # Only admin and superadmin can delete
    if context['role'] not in ['admin', 'superadmin']:
        raise HTTPException(status_code=403, detail='No tiene permisos para eliminar rutas')
    
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    try:
        # Check route exists and validate access
        cur.execute('SELECT idRuta, idEmpresa, nombreRuta FROM ruta_O WHERE idRuta = %s', (id,))
        existing = cur.fetchone()
        
        if not existing:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Ruta no encontrada')
        
        # Validate access - only superadmin or users from same empresa
        if context['role'] != 'superadmin' and existing['idEmpresa'] != context['idEmpresa']:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No tiene permisos para eliminar esta ruta')
        
        # Check if route is assigned to any persona
        cur.execute('SELECT COUNT(*) as count FROM persona_O WHERE idRuta = %s', (id,))
        usage = cur.fetchone()
        
        if usage and usage['count'] > 0:
            cur.close()
            conn.close()
            raise HTTPException(
                status_code=400, 
                detail=f'No se puede eliminar la ruta "{existing["nombreRuta"]}" porque está asignada a {usage["count"]} persona(s)'
            )
        
        # Delete route prices first (FK constraint)
        cur.execute('DELETE FROM ruta_precio WHERE idRuta = %s', (id,))
        
        # Delete route
        cur.execute('DELETE FROM ruta_O WHERE idRuta = %s', (id,))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {'message': f'Ruta "{existing["nombreRuta"]}" eliminada exitosamente'}
    
    except mysql_errors.Error as e:
        conn.rollback()
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f'Database error: {str(e)}')


# ========== Gestión de Precios por Ruta ==========

@app.get('/rutas/{id}/precios', response_model=List[RutaPrecioOut])
def get_ruta_precios(id: int, request: Request, x_user_role: str = Header(None)):
    """Get all product prices for a specific route"""
    context = get_user_context(x_user_role, request)
    
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    try:
        # Validate route access
        cur.execute('SELECT idRuta, idEmpresa FROM ruta_O WHERE idRuta = %s', (id,))
        ruta = cur.fetchone()
        
        if not ruta:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Ruta no encontrada')
        
        # Validate access
        if context['role'] != 'superadmin' and ruta['idEmpresa'] != context['idEmpresa']:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No tiene permisos para acceder a esta ruta')
        
        # Get route prices with product info
        cur.execute('''
            SELECT 
                rp.idRuta, 
                rp.idProducto, 
                p.nombreProducto as nombreProducto,
                rp.incremento_precio,
                p.precioMinorista as precio_base,
                (p.precioMinorista + rp.incremento_precio) as precio_final
            FROM ruta_precio rp
            INNER JOIN producto_O p ON rp.idProducto = p.idProducto
            WHERE rp.idRuta = %s
            ORDER BY p.nombreProducto
        ''', (id,))
        
        precios = cur.fetchall() or []
        cur.close()
        conn.close()
        
        return precios
    
    except mysql_errors.Error as e:
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f'Database error: {str(e)}')


@app.post('/rutas/{id}/precios', response_model=RutaPrecioOut)
def create_ruta_precio(id: int, precio: RutaPrecioIn, request: Request, x_user_role: str = Header(None)):
    """Add or update a product price for a route"""
    context = get_user_context(x_user_role, request)
    
    # Only admin and superadmin can manage prices
    if context['role'] not in ['admin', 'superadmin']:
        raise HTTPException(status_code=403, detail='No tiene permisos para gestionar precios de rutas')
    
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    try:
        # Validate route access
        cur.execute('SELECT idRuta, idEmpresa FROM ruta_O WHERE idRuta = %s', (id,))
        ruta = cur.fetchone()
        
        if not ruta:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Ruta no encontrada')
        
        # Validate access
        if context['role'] != 'superadmin' and ruta['idEmpresa'] != context['idEmpresa']:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No tiene permisos para modificar esta ruta')
        
        # Validate product exists and belongs to same empresa
        cur.execute('''
            SELECT idProducto, nombreProducto, precioMinorista 
            FROM producto_O 
            WHERE idProducto = %s AND idEmpresa = %s
        ''', (precio.idProducto, ruta['idEmpresa']))
        
        producto = cur.fetchone()
        
        if not producto:
            cur.close()
            conn.close()
            raise HTTPException(status_code=400, detail='Producto no encontrado en esta empresa')
        
        # Insert or update price
        cur.execute('''
            INSERT INTO ruta_precio (idRuta, idProducto, incremento_precio)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE incremento_precio = VALUES(incremento_precio)
        ''', (id, precio.idProducto, float(precio.incremento_precio)))
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {
            'idRuta': id,
            'idProducto': precio.idProducto,
            'nombreProducto': producto['nombreProducto'],
            'incremento_precio': precio.incremento_precio,
            'precio_base': producto['precioMinorista'],
            'precio_final': Decimal(str(producto['precioMinorista'])) + precio.incremento_precio
        }
    
    except mysql_errors.Error as e:
        conn.rollback()
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f'Database error: {str(e)}')


@app.delete('/rutas/{id}/precios/{idProducto}')
def delete_ruta_precio(id: int, idProducto: int, request: Request, x_user_role: str = Header(None)):
    """Remove a product price override for a route"""
    context = get_user_context(x_user_role, request)
    
    # Only admin and superadmin can manage prices
    if context['role'] not in ['admin', 'superadmin']:
        raise HTTPException(status_code=403, detail='No tiene permisos para gestionar precios de rutas')
    
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    try:
        # Validate route access
        cur.execute('SELECT idRuta, idEmpresa FROM ruta_O WHERE idRuta = %s', (id,))
        ruta = cur.fetchone()
        
        if not ruta:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Ruta no encontrada')
        
        # Validate access
        if context['role'] != 'superadmin' and ruta['idEmpresa'] != context['idEmpresa']:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No tiene permisos para modificar esta ruta')
        
        # Delete price override
        cur.execute('''
            DELETE FROM ruta_precio 
            WHERE idRuta = %s AND idProducto = %s
        ''', (id, idProducto))
        
        if cur.rowcount == 0:
            conn.rollback()
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Precio de ruta no encontrado')
        
        conn.commit()
        cur.close()
        conn.close()
        
        return {'message': 'Precio de ruta eliminado exitosamente'}
    
    except mysql_errors.Error as e:
        conn.rollback()
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f'Database error: {str(e)}')


# ========== Personas de Ruta ==========

@app.get('/rutas/{id}/personas')
def get_personas_ruta(id: int, request: Request, x_user_role: str = Header(None)):
    """Get all personas assigned to a specific route"""
    context = get_user_context(x_user_role, request)
    
    conn = get_db_connection()
    cur = conn.cursor(dictionary=True)
    
    try:
        # Validate route exists and access
        cur.execute('SELECT idRuta, idEmpresa FROM ruta_O WHERE idRuta = %s', (id,))
        ruta = cur.fetchone()
        
        if not ruta:
            cur.close()
            conn.close()
            raise HTTPException(status_code=404, detail='Ruta no encontrada')
        
        # Validate access
        if context['role'] != 'superadmin' and ruta['idEmpresa'] != context['idEmpresa']:
            cur.close()
            conn.close()
            raise HTTPException(status_code=403, detail='No tiene permisos para acceder a esta ruta')
        
        # Get all personas with this route
        cur.execute('''
            SELECT 
                p.id_persona,
                p.nombres_persona,
                p.apellido_paternoPersona,
                p.apellido_maternoPer,
                p.ci_persona,
                p.telefono_persona,
                p.direccion_persona,
                p.tipo_cliente,
                tp.tipoPersona as tipo_persona_desc
            FROM persona_O p
            LEFT JOIN tipo_personaO tp ON p.id_tipoPersona = tp.idtipoPers
            WHERE p.idRuta = %s AND p.id_empresa = %s
            ORDER BY p.nombres_persona, p.apellido_paternoPersona
        ''', (id, ruta['idEmpresa']))
        
        personas = cur.fetchall() or []
        cur.close()
        conn.close()
        
        return personas
    
    except mysql_errors.Error as e:
        cur.close()
        conn.close()
        raise HTTPException(status_code=500, detail=f'Database error: {str(e)}')


if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8008)
