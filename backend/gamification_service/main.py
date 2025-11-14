"""
Gamification Service - Sistema de Puntos, Badges y Rankings
Proporciona endpoints para gestionar la gamificación del sistema
"""
from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import mysql.connector
from mysql.connector import pooling
import os
import jwt
from datetime import datetime, date
from typing import Optional, List

app = FastAPI(title="Gamification Service", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:8000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection pool
db_config = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "ollantay_db"),
    "pool_name": "gamification_pool",
    "pool_size": 5
}

try:
    connection_pool = pooling.MySQLConnectionPool(**db_config)
except mysql.connector.Error as err:
    print(f"❌ Error creating connection pool: {err}")
    connection_pool = None

JWT_SECRET = os.getenv("JWT_SECRET", "supersecretkey123")

def get_db():
    if connection_pool is None:
        raise HTTPException(status_code=500, detail="Database connection pool not initialized")
    try:
        conn = connection_pool.get_connection()
        cursor = conn.cursor(dictionary=True, buffered=True)
        yield cursor, conn
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

def verify_token(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header missing")
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# =============================
# ENDPOINTS DE PUNTOS
# =============================

@app.post("/award-points")
async def award_points(
    request: Request,
    user_data: dict = Depends(verify_token),
    db: tuple = Depends(get_db)
):
    """Otorgar puntos a un usuario por una acción específica"""
    cursor, conn = db
    data = await request.json()
    
    id_user = data.get('id_user')
    puntos = data.get('puntos', 0)
    razon = data.get('razon', 'Actividad del sistema')
    modulo = data.get('modulo', 'General')
    
    if not id_user or puntos <= 0:
        raise HTTPException(status_code=400, detail="Usuario y puntos válidos requeridos")
    
    try:
        # Verificar o crear registro de gamificación
        cursor.execute(
            "SELECT id_gamif, puntos_totales, nivel, racha_dias, ultima_actividad FROM user_gamification_O WHERE id_user = %s",
            (id_user,)
        )
        gamif_record = cursor.fetchone()
        
        hoy = date.today()
        
        if gamif_record:
            # Actualizar puntos y nivel
            nuevos_puntos = gamif_record['puntos_totales'] + puntos
            nuevo_nivel = (nuevos_puntos // 100) + 1  # 100 puntos = 1 nivel
            
            # Calcular racha
            ultima = gamif_record['ultima_actividad']
            if ultima and (hoy - ultima).days == 1:
                nueva_racha = gamif_record['racha_dias'] + 1
            elif ultima and (hoy - ultima).days == 0:
                nueva_racha = gamif_record['racha_dias']  # Mismo día
            else:
                nueva_racha = 1  # Racha rota
            
            cursor.execute("""
                UPDATE user_gamification_O 
                SET puntos_totales = %s, nivel = %s, racha_dias = %s, ultima_actividad = %s
                WHERE id_user = %s
            """, (nuevos_puntos, nuevo_nivel, nueva_racha, hoy, id_user))
            
            # Verificar badges de racha
            if nueva_racha == 7:
                _assign_badge(cursor, id_user, 'Racha de 7 días')
            elif nueva_racha == 30:
                _assign_badge(cursor, id_user, 'Racha de 30 días')
            
        else:
            # Crear registro inicial
            nuevo_nivel = (puntos // 100) + 1
            cursor.execute("""
                INSERT INTO user_gamification_O (id_user, puntos_totales, nivel, racha_dias, ultima_actividad)
                VALUES (%s, %s, %s, 1, %s)
            """, (id_user, puntos, nuevo_nivel, hoy))
            
            # Asignar badge de bienvenida
            _assign_badge(cursor, id_user, 'Bienvenido')
        
        # Registrar en historial
        cursor.execute("""
            INSERT INTO points_history_O (id_user, puntos, razon, modulo)
            VALUES (%s, %s, %s, %s)
        """, (id_user, puntos, razon, modulo))
        
        conn.commit()
        
        return JSONResponse({
            "message": "Puntos otorgados exitosamente",
            "puntos_otorgados": puntos,
            "razon": razon
        })
    
    except mysql.connector.Error as err:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {err}")

def _assign_badge(cursor, id_user: int, nombre_badge: str):
    """Helper para asignar un badge a un usuario"""
    try:
        cursor.execute("SELECT id_badge FROM badge_O WHERE nombre_badge = %s", (nombre_badge,))
        badge = cursor.fetchone()
        if badge:
            cursor.execute("""
                INSERT IGNORE INTO user_badge_O (id_user, id_badge)
                VALUES (%s, %s)
            """, (id_user, badge['id_badge']))
            print(f"✅ Badge '{nombre_badge}' asignado a usuario {id_user}")
    except mysql.connector.Error as err:
        print(f"⚠️ Error asignando badge: {err}")

@app.get("/user-stats/{id_user}")
async def get_user_stats(
    id_user: int,
    user_data: dict = Depends(verify_token),
    db: tuple = Depends(get_db)
):
    """Obtener estadísticas de gamificación de un usuario"""
    cursor, conn = db
    
    try:
        # Obtener stats principales
        cursor.execute("""
            SELECT puntos_totales, nivel, racha_dias, ultima_actividad, fecha_actualizacion
            FROM user_gamification_O
            WHERE id_user = %s
        """, (id_user,))
        stats = cursor.fetchone()
        
        if not stats:
            return JSONResponse({
                "puntos_totales": 0,
                "nivel": 1,
                "racha_dias": 0,
                "badges": [],
                "historial": []
            })
        
        # Obtener badges
        cursor.execute("""
            SELECT b.nombre_badge, b.descripcion, b.icono_badge, b.tipo_badge, ub.fecha_obtencion
            FROM user_badge_O ub
            JOIN badge_O b ON ub.id_badge = b.id_badge
            WHERE ub.id_user = %s
            ORDER BY ub.fecha_obtencion DESC
        """, (id_user,))
        badges = cursor.fetchall()
        
        # Obtener historial reciente
        cursor.execute("""
            SELECT puntos, razon, modulo, fecha_registro
            FROM points_history_O
            WHERE id_user = %s
            ORDER BY fecha_registro DESC
            LIMIT 20
        """, (id_user,))
        historial = cursor.fetchall()
        
        return JSONResponse({
            "puntos_totales": stats['puntos_totales'],
            "nivel": stats['nivel'],
            "racha_dias": stats['racha_dias'],
            "ultima_actividad": str(stats['ultima_actividad']) if stats['ultima_actividad'] else None,
            "badges": badges,
            "historial": historial
        })
    
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Database error: {err}")

@app.get("/rankings")
async def get_rankings(
    limit: int = 50,
    user_data: dict = Depends(verify_token),
    db: tuple = Depends(get_db)
):
    """Obtener ranking de usuarios por puntos"""
    cursor, conn = db
    
    try:
        cursor.execute("""
            SELECT 
                u.id_user,
                u.username,
                COALESCE(p.nombre, u.username) as nombre_display,
                g.puntos_totales,
                g.nivel,
                g.racha_dias,
                COUNT(ub.id_badge) as total_badges
            FROM user_gamification_O g
            JOIN user_O u ON g.id_user = u.id_user
            LEFT JOIN persona_O p ON u.id_persona = p.id_persona
            LEFT JOIN user_badge_O ub ON g.id_user = ub.id_user
            GROUP BY g.id_user
            ORDER BY g.puntos_totales DESC, g.nivel DESC
            LIMIT %s
        """, (limit,))
        
        rankings = cursor.fetchall()
        
        # Agregar posición
        for idx, ranking in enumerate(rankings):
            ranking['posicion'] = idx + 1
        
        return JSONResponse({"rankings": rankings})
    
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Database error: {err}")

@app.get("/badges")
async def list_badges(
    user_data: dict = Depends(verify_token),
    db: tuple = Depends(get_db)
):
    """Listar todos los badges disponibles"""
    cursor, conn = db
    
    try:
        cursor.execute("""
            SELECT id_badge, nombre_badge, descripcion, icono_badge, puntos_requeridos, tipo_badge
            FROM badge_O
            ORDER BY puntos_requeridos ASC, tipo_badge ASC
        """)
        badges = cursor.fetchall()
        
        return JSONResponse({"badges": badges})
    
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Database error: {err}")

# =============================
# TRIGGERS AUTOMÁTICOS
# =============================

@app.post("/trigger/venta")
async def trigger_venta(
    request: Request,
    user_data: dict = Depends(verify_token),
    db: tuple = Depends(get_db)
):
    """Trigger automático cuando se registra una venta"""
    cursor, conn = db
    data = await request.json()
    
    id_user = data.get('id_user')
    
    try:
        # Otorgar puntos base
        await award_points(
            request,
            user_data=user_data,
            db=(cursor, conn)
        )
        
        # Verificar conteo de ventas para badges
        cursor.execute("SELECT COUNT(*) as total FROM venta_O WHERE idUsuarioRegistra = %s", (id_user,))
        result = cursor.fetchone()
        total_ventas = result['total'] if result else 0
        
        if total_ventas == 10:
            _assign_badge(cursor, id_user, 'Vendedor Novato')
            conn.commit()
        elif total_ventas == 50:
            _assign_badge(cursor, id_user, 'Vendedor Experto')
            conn.commit()
        elif total_ventas == 200:
            _assign_badge(cursor, id_user, 'Maestro de Ventas')
            conn.commit()
        
        return JSONResponse({"message": "Trigger de venta procesado"})
    
    except mysql.connector.Error as err:
        raise HTTPException(status_code=500, detail=f"Database error: {err}")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "gamification"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8016)
