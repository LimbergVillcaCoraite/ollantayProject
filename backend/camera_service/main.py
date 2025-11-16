"""
Camera Service - Sistema de Integración con Cámaras de Seguridad
Gestión de cámaras IP, RTSP streams, eventos y grabaciones
"""
from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
import mysql.connector
from mysql.connector import pooling
import os
import jwt
from datetime import datetime
from typing import Optional, List
import cv2
import asyncio
import io
from PIL import Image

app = FastAPI(title="Camera Service", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://localhost"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection pool
db_config = {
    "host": os.getenv("DB_HOST", "localhost"),
    "user": os.getenv("DB_USER", "root"),
    "password": os.getenv("DB_PASSWORD", ""),
    "database": os.getenv("DB_NAME", "SystemaOllantay"),
    "pool_name": "camera_pool",
    "pool_size": 5
}

try:
    connection_pool = pooling.MySQLConnectionPool(**db_config)
    print("✅ Database connection pool created successfully")
except mysql.connector.Error as err:
    print(f"❌ Error creating connection pool: {err}")
    connection_pool = None

JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-change-me")

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

def verify_token(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# =============================
# ENDPOINTS DE CÁMARAS
# =============================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "camera_service", "version": "1.0.0"}

@app.get("/cameras")
async def get_cameras(
    user_data: dict = Depends(verify_token),
    db: tuple = Depends(get_db)
):
    """Obtener todas las cámaras de la empresa del usuario"""
    cursor, conn = db
    id_empresa = user_data.get('id_empresa')
    
    cursor.execute("""
        SELECT c.*, 
               rc.grabacion_continua, rc.grabacion_por_evento,
               rc.calidad, rc.fps, rc.resolucion
        FROM camera_O c
        LEFT JOIN camera_recording_config_O rc ON c.id_camera = rc.id_camera
        WHERE c.id_empresa = %s
        ORDER BY c.nombre_camera
    """, (id_empresa,))
    
    cameras = cursor.fetchall()
    
    # Convertir datetime a string
    for camera in cameras:
        if camera.get('fecha_registro'):
            camera['fecha_registro'] = camera['fecha_registro'].isoformat()
        if camera.get('fecha_actualizacion'):
            camera['fecha_actualizacion'] = camera['fecha_actualizacion'].isoformat()
        if camera.get('ultimo_check'):
            camera['ultimo_check'] = camera['ultimo_check'].isoformat() if camera['ultimo_check'] else None
    
    return {"cameras": cameras}

@app.post("/cameras")
async def create_camera(
    camera_data: dict,
    user_data: dict = Depends(verify_token),
    db: tuple = Depends(get_db)
):
    """Crear una nueva cámara"""
    cursor, conn = db
    id_empresa = user_data.get('id_empresa')
    
    try:
        cursor.execute("""
            INSERT INTO camera_O (
                nombre_camera, descripcion, tipo_camera, ip_address, puerto,
                usuario, password, rtsp_url, ubicacion, id_empresa, estado
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            camera_data.get('nombre_camera'),
            camera_data.get('descripcion'),
            camera_data.get('tipo_camera', 'ip'),
            camera_data.get('ip_address'),
            camera_data.get('puerto', 554),
            camera_data.get('usuario'),
            camera_data.get('password'),
            camera_data.get('rtsp_url'),
            camera_data.get('ubicacion'),
            id_empresa,
            camera_data.get('estado', 'inactiva')
        ))
        
        id_camera = cursor.lastrowid
        
        # Crear configuración de grabación por defecto
        cursor.execute("""
            INSERT INTO camera_recording_config_O (
                id_camera, grabacion_continua, grabacion_por_evento,
                duracion_pre_evento, duracion_post_evento,
                calidad, fps, resolucion, dias_retencion
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            id_camera,
            camera_data.get('grabacion_continua', False),
            camera_data.get('grabacion_por_evento', True),
            camera_data.get('duracion_pre_evento', 5),
            camera_data.get('duracion_post_evento', 10),
            camera_data.get('calidad', 'media'),
            camera_data.get('fps', 15),
            camera_data.get('resolucion', '1280x720'),
            camera_data.get('dias_retencion', 30)
        ))
        
        conn.commit()
        
        return {"success": True, "id_camera": id_camera, "message": "Cámara creada exitosamente"}
    
    except mysql.connector.Error as err:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear cámara: {str(err)}")

@app.put("/cameras/{id_camera}")
async def update_camera(
    id_camera: int,
    camera_data: dict,
    user_data: dict = Depends(verify_token),
    db: tuple = Depends(get_db)
):
    """Actualizar una cámara existente"""
    cursor, conn = db
    id_empresa = user_data.get('id_empresa')
    
    try:
        cursor.execute("""
            UPDATE camera_O SET
                nombre_camera = %s,
                descripcion = %s,
                tipo_camera = %s,
                ip_address = %s,
                puerto = %s,
                usuario = %s,
                password = %s,
                rtsp_url = %s,
                ubicacion = %s,
                estado = %s
            WHERE id_camera = %s AND id_empresa = %s
        """, (
            camera_data.get('nombre_camera'),
            camera_data.get('descripcion'),
            camera_data.get('tipo_camera'),
            camera_data.get('ip_address'),
            camera_data.get('puerto'),
            camera_data.get('usuario'),
            camera_data.get('password'),
            camera_data.get('rtsp_url'),
            camera_data.get('ubicacion'),
            camera_data.get('estado'),
            id_camera,
            id_empresa
        ))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Cámara no encontrada")
        
        conn.commit()
        return {"success": True, "message": "Cámara actualizada exitosamente"}
    
    except mysql.connector.Error as err:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error al actualizar cámara: {str(err)}")

@app.delete("/cameras/{id_camera}")
async def delete_camera(
    id_camera: int,
    user_data: dict = Depends(verify_token),
    db: tuple = Depends(get_db)
):
    """Eliminar una cámara"""
    cursor, conn = db
    id_empresa = user_data.get('id_empresa')
    
    try:
        cursor.execute("""
            DELETE FROM camera_O 
            WHERE id_camera = %s AND id_empresa = %s
        """, (id_camera, id_empresa))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Cámara no encontrada")
        
        conn.commit()
        return {"success": True, "message": "Cámara eliminada exitosamente"}
    
    except mysql.connector.Error as err:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error al eliminar cámara: {str(err)}")

@app.post("/cameras/{id_camera}/test")
async def test_camera_connection(
    id_camera: int,
    user_data: dict = Depends(verify_token),
    db: tuple = Depends(get_db)
):
    """Probar conexión con una cámara"""
    cursor, conn = db
    id_empresa = user_data.get('id_empresa')
    
    cursor.execute("""
        SELECT * FROM camera_O 
        WHERE id_camera = %s AND id_empresa = %s
    """, (id_camera, id_empresa))
    
    camera = cursor.fetchone()
    if not camera:
        raise HTTPException(status_code=404, detail="Cámara no encontrada")
    
    # Intentar conectar con la cámara
    try:
        rtsp_url = camera['rtsp_url']
        if not rtsp_url and camera['ip_address']:
            # Construir URL RTSP genérica
            rtsp_url = f"rtsp://{camera['usuario']}:{camera['password']}@{camera['ip_address']}:{camera['puerto']}/stream"
        
        if rtsp_url:
            cap = cv2.VideoCapture(rtsp_url)
            success, frame = cap.read()
            cap.release()
            
            if success:
                # Actualizar estado y último check
                cursor.execute("""
                    UPDATE camera_O 
                    SET estado = 'activa', ultimo_check = NOW()
                    WHERE id_camera = %s
                """, (id_camera,))
                conn.commit()
                
                return {"success": True, "message": "Conexión exitosa", "estado": "activa"}
            else:
                cursor.execute("""
                    UPDATE camera_O 
                    SET estado = 'error', ultimo_check = NOW()
                    WHERE id_camera = %s
                """, (id_camera,))
                conn.commit()
                
                return {"success": False, "message": "No se pudo leer el stream", "estado": "error"}
        else:
            return {"success": False, "message": "URL RTSP no configurada", "estado": "error"}
    
    except Exception as e:
        cursor.execute("""
            UPDATE camera_O 
            SET estado = 'error', ultimo_check = NOW()
            WHERE id_camera = %s
        """, (id_camera,))
        conn.commit()
        
        return {"success": False, "message": f"Error de conexión: {str(e)}", "estado": "error"}

@app.get("/cameras/{id_camera}/snapshot")
async def get_camera_snapshot(
    id_camera: int,
    user_data: dict = Depends(verify_token),
    db: tuple = Depends(get_db)
):
    """Capturar snapshot de una cámara"""
    cursor, conn = db
    id_empresa = user_data.get('id_empresa')
    
    cursor.execute("""
        SELECT * FROM camera_O 
        WHERE id_camera = %s AND id_empresa = %s
    """, (id_camera, id_empresa))
    
    camera = cursor.fetchone()
    if not camera:
        raise HTTPException(status_code=404, detail="Cámara no encontrada")
    
    try:
        rtsp_url = camera['rtsp_url']
        if not rtsp_url and camera['ip_address']:
            rtsp_url = f"rtsp://{camera['usuario']}:{camera['password']}@{camera['ip_address']}:{camera['puerto']}/stream"
        
        if not rtsp_url:
            raise HTTPException(status_code=400, detail="URL RTSP no configurada")
        
        cap = cv2.VideoCapture(rtsp_url)
        success, frame = cap.read()
        cap.release()
        
        if not success:
            raise HTTPException(status_code=500, detail="No se pudo capturar el frame")
        
        # Convertir frame a JPEG
        _, buffer = cv2.imencode('.jpg', frame)
        
        return StreamingResponse(
            io.BytesIO(buffer.tobytes()),
            media_type="image/jpeg",
            headers={"Content-Disposition": f"inline; filename=camera_{id_camera}_snapshot.jpg"}
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al capturar snapshot: {str(e)}")

# =============================
# ENDPOINTS DE EVENTOS
# =============================

@app.get("/events")
async def get_camera_events(
    id_camera: Optional[int] = None,
    tipo_evento: Optional[str] = None,
    limit: int = 50,
    user_data: dict = Depends(verify_token),
    db: tuple = Depends(get_db)
):
    """Obtener eventos de cámaras"""
    cursor, conn = db
    id_empresa = user_data.get('id_empresa')
    
    query = """
        SELECT ce.*, c.nombre_camera, c.ubicacion
        FROM camera_event_O ce
        JOIN camera_O c ON ce.id_camera = c.id_camera
        WHERE c.id_empresa = %s
    """
    params = [id_empresa]
    
    if id_camera:
        query += " AND ce.id_camera = %s"
        params.append(id_camera)
    
    if tipo_evento:
        query += " AND ce.tipo_evento = %s"
        params.append(tipo_evento)
    
    query += " ORDER BY ce.fecha_evento DESC LIMIT %s"
    params.append(limit)
    
    cursor.execute(query, tuple(params))
    events = cursor.fetchall()
    
    # Convertir datetime a string
    for event in events:
        if event.get('fecha_evento'):
            event['fecha_evento'] = event['fecha_evento'].isoformat()
    
    return {"events": events}

@app.post("/events")
async def create_camera_event(
    event_data: dict,
    user_data: dict = Depends(verify_token),
    db: tuple = Depends(get_db)
):
    """Crear un evento de cámara"""
    cursor, conn = db
    
    try:
        cursor.execute("""
            INSERT INTO camera_event_O (
                id_camera, tipo_evento, descripcion, snapshot_url, video_url,
                id_referencia, modulo_referencia
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            event_data.get('id_camera'),
            event_data.get('tipo_evento', 'manual'),
            event_data.get('descripcion'),
            event_data.get('snapshot_url'),
            event_data.get('video_url'),
            event_data.get('id_referencia'),
            event_data.get('modulo_referencia')
        ))
        
        id_event = cursor.lastrowid
        conn.commit()
        
        return {"success": True, "id_event": id_event, "message": "Evento registrado"}
    
    except mysql.connector.Error as err:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error al crear evento: {str(err)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8017, reload=True)
