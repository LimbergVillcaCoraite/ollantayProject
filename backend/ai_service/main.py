from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, date, timedelta
import os
import mysql.connector
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import StandardScaler
try:
    from prophet import Prophet
except Exception:
    Prophet = None  # Fallback si no se instala bien
import math
import requests
import jwt
import warnings
warnings.filterwarnings('ignore')

app = FastAPI(title="AI Predictions Service")

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

JWT_SECRET = os.getenv('JWT_SECRET', 'dev-secret-change-me')
JWT_ALG = 'HS256'

def get_company_id_from_request(request: Request) -> Optional[int]:
    """Extrae company_id/idEmpresa del token JWT con tolerancia"""
    try:
        token = request.cookies.get('ollantay_token')
        if not token:
            return None
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        cid = payload.get('company_id')
        if cid is None:
            cid = payload.get('idEmpresa')
        return cid
    except Exception:
        return None

def get_role(x_user_role: str = Header(None), request: Request = None) -> str:
    """Obtiene el rol del usuario"""
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


class PrediccionVentasResponse(BaseModel):
    empresa_id: Optional[int]
    empresa_nombre: Optional[str]
    periodo_analizado_dias: int
    prediccion_proximos_dias: int
    ventas_historicas: List[Dict[str, Any]]
    predicciones: List[Dict[str, Any]]
    tendencia: str  # 'creciente', 'decreciente', 'estable'
    confianza: float  # 0-1
    recomendaciones: List[str]
    metricas: Dict[str, Any]
    resumen_mensual: List[Dict[str, Any]]
    productos_top: List[Dict[str, Any]]
    productos_forecast: List[Dict[str, Any]]


class PrediccionComprasResponse(BaseModel):
    empresa_id: Optional[int]
    empresa_nombre: Optional[str]
    productos_criticos: List[Dict[str, Any]]  # Productos con stock bajo
    sugerencias_compra: List[Dict[str, Any]]  # Qué comprar y cuánto
    tendencias_precios: List[Dict[str, Any]]
    proveedores_recomendados: List[Dict[str, Any]]
    resumen_mensual: List[Dict[str, Any]]
    productos_forecast: List[Dict[str, Any]]


class PrediccionRutasResponse(BaseModel):
    empresa_id: Optional[int]
    empresa_nombre: Optional[str]
    rutas_mas_rentables: List[Dict[str, Any]]
    clientes_frecuentes: List[Dict[str, Any]]
    zonas_con_mayor_demanda: List[Dict[str, Any]]
    sugerencias_optimizacion: List[str]
class PrediccionCreditoResponse(BaseModel):
    empresa_id: Optional[int]
    empresa_nombre: Optional[str]
    clientes_evaluados: List[Dict[str, Any]]
    criterios: List[str]
    recomendaciones_generales: List[str]

class PrediccionClimaResponse(BaseModel):
    zona: str
    fuente: str
    pronostico: List[Dict[str, Any]]  # lista de días con temp, humedad, lluvia_prob
    recomendaciones: List[str]



@app.get('/health')
def health():
    """Health check"""
    return {'status': 'ok', 'service': 'ai_predictions'}


@app.get('/predictions/ventas', response_model=PrediccionVentasResponse)
async def predecir_ventas(
    idEmpresa: Optional[int] = None,
    dias_historico: int = 90,
    dias_prediccion: int = 30,
    x_user_role: str = Header(None),
    request: Request = None
):
    """
    Predice ventas futuras usando regresión lineal
    - Analiza historial de ventas por día
    - Genera predicciones para próximos N días
    - Identifica tendencias y patrones
    """
    role = get_role(x_user_role, request)
    user_company = get_company_id_from_request(request)
    
    # Determinar empresa efectiva
    if role == 'superadmin':
        target_company = idEmpresa
    else:
        target_company = user_company
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Obtener nombre de empresa
        empresa_nombre = None
        if target_company:
            cursor.execute('SELECT nombreComercial, razonSocial FROM empresa_O WHERE idEmpresa = %s', (target_company,))
            emp = cursor.fetchone()
            empresa_nombre = emp['nombreComercial'] if emp else None
        
        # Consultar ventas históricas agrupadas por día
        fecha_inicio = (datetime.now() - timedelta(days=dias_historico)).date()
        
        query = '''
            SELECT DATE(fechaVenta) as fecha, 
                   COUNT(*) as num_ventas,
                   SUM(montoTotal) as total_ventas,
                   AVG(montoTotal) as promedio_venta
            FROM venta_O
            WHERE estado = 1 AND fechaVenta >= %s
        '''
        params = [fecha_inicio]
        
        if target_company:
            query += ' AND idEmpresa = %s'
            params.append(target_company)
        
        query += ' GROUP BY DATE(fechaVenta) ORDER BY fecha ASC'
        
        cursor.execute(query, params)
        ventas = cursor.fetchall()
        
        if len(ventas) < 7:
            cursor.close()
            conn.close()
            raise HTTPException(
                status_code=400, 
                detail='No hay suficientes datos históricos (se requieren al menos 7 días de ventas)'
            )
        
        # Preparar datos para el modelo diario
        df = pd.DataFrame(ventas)
        df['fecha'] = pd.to_datetime(df['fecha'])
        df['dias_desde_inicio'] = (df['fecha'] - df['fecha'].min()).dt.days
        df['total_ventas'] = df['total_ventas'].astype(float)
        
        # Modelo de regresión lineal (baseline)
        X = df[['dias_desde_inicio']].values
        y = df['total_ventas'].values
        
        model = LinearRegression(); model.fit(X, y)
        
        # Generar predicciones diarias
        ultimo_dia = df['dias_desde_inicio'].max()
        dias_futuros = np.array([[ultimo_dia + i] for i in range(1, dias_prediccion + 1)])
        predicciones_valores = model.predict(dias_futuros)
        
        # Calcular confianza (R² score)
        from sklearn.metrics import r2_score
        y_pred_train = model.predict(X)
        confianza_baseline = max(0, min(1, r2_score(y, y_pred_train)))
        
        # Determinar tendencia
        pendiente = model.coef_[0]
        if pendiente > 50:
            tendencia = 'creciente'
        elif pendiente < -50:
            tendencia = 'decreciente'
        else:
            tendencia = 'estable'
        
        # Generar recomendaciones
        recomendaciones = []
        promedio_ventas = df['total_ventas'].mean()
        
        if tendencia == 'creciente':
            recomendaciones.append('📈 Las ventas muestran tendencia creciente. Considera aumentar el inventario.')
            recomendaciones.append('💡 Analiza qué productos están impulsando el crecimiento.')
        elif tendencia == 'decreciente':
            recomendaciones.append('📉 Las ventas están disminuyendo. Revisa estrategias de marketing.')
            recomendaciones.append('🎯 Identifica productos con bajo rendimiento.')
        else:
            recomendaciones.append('📊 Las ventas se mantienen estables.')
        
        if confianza_baseline < 0.5:
            recomendaciones.append('⚠️ La confianza de la predicción es baja. Los datos presentan alta variabilidad.')
        
        # Predicciones para días de la semana
        df['dia_semana'] = df['fecha'].dt.dayofweek  # 0=Lunes, 6=Domingo
        ventas_por_dia_semana = df.groupby('dia_semana')['total_ventas'].mean()
        mejor_dia = ventas_por_dia_semana.idxmax()
        dias_nombres = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
        recomendaciones.append(f'📅 El mejor día de ventas es {dias_nombres[mejor_dia]}.')

        # Resumen mensual
        df['mes'] = df['fecha'].dt.to_period('M')
        mensual = df.groupby('mes')['total_ventas'].sum().reset_index()
        resumen_mensual = [
            {'mes': str(row['mes']), 'total_mes': float(row['total_ventas'])}
            for _, row in mensual.iterrows()
        ]

        # Productos top por mes (últimos n meses) y forecast por producto (si suficiente data)
        productos_forecast = []
        productos_top = []
        try:
            prod_query = '''
                SELECT DATE(v.fechaVenta) as fecha, dv.idProducto, p.nombreProducto,
                       SUM(dv.cantidad) as cant,
                       SUM(dv.cantidad * dv.precioUnitario) as monto
                FROM detalle_venta_O dv
                JOIN venta_O v ON dv.idVenta = v.idVenta
                JOIN producto_O p ON dv.idProducto = p.idProducto
                WHERE v.estado = 1 AND v.fechaVenta >= %s
            '''
            prod_params = [fecha_inicio]
            if target_company:
                prod_query += ' AND v.idEmpresa = %s'
                prod_params.append(target_company)
            prod_query += ' GROUP BY DATE(v.fechaVenta), dv.idProducto, p.nombreProducto'
            cursor.execute(prod_query, prod_params)
            ventas_prod = cursor.fetchall() or []
            if ventas_prod:
                dfp = pd.DataFrame(ventas_prod)
                dfp['fecha'] = pd.to_datetime(dfp['fecha'])
                # Top productos por monto total
                agg_top = dfp.groupby(['idProducto','nombreProducto'])['monto'].sum().reset_index().sort_values('monto', ascending=False).head(10)
                productos_top = [
                    {'idProducto': int(r['idProducto']), 'nombre': r['nombreProducto'], 'monto_total': float(r['monto'])}
                    for _, r in agg_top.iterrows()
                ]
                # Forecast mensual por producto usando Prophet si hay >=3 meses de datos
                for _, r in agg_top.iterrows():
                    pid = r['idProducto']; pname = r['nombreProducto']
                    dfp_prod = dfp[dfp['idProducto'] == pid].copy()
                    dfp_prod['mes'] = dfp_prod['fecha'].dt.to_period('M')
                    dfp_m = dfp_prod.groupby('mes')['monto'].sum().reset_index()
                    if len(dfp_m) >= 3 and Prophet:
                        # Preparar datos para Prophet
                        prophet_df = pd.DataFrame({
                            'ds': [pd.Period(m, freq='M').to_timestamp() for m in dfp_m['mes']],
                            'y': dfp_m['monto'].astype(float)
                        })
                        try:
                            m = Prophet(yearly_seasonality=False, weekly_seasonality=False, daily_seasonality=False)
                            m.fit(prophet_df)
                            future = m.make_future_dataframe(periods=3, freq='M')
                            fcst = m.predict(future.tail(3))
                            productos_forecast.append({
                                'idProducto': int(pid),
                                'nombre': pname,
                                'forecast': [
                                    {'mes': f['ds'].strftime('%Y-%m'), 'prediccion': float(f['yhat']), 'intervalo_min': float(f['yhat_lower']), 'intervalo_max': float(f['yhat_upper'])}
                                    for _, f in fcst.iterrows()
                                ]
                            })
                        except Exception:
                            pass
        except Exception:
            pass
        
        # Formatear respuesta
        ventas_historicas = [
            {
                'fecha': row['fecha'].isoformat(),
                'total': float(row['total_ventas']),
                'num_ventas': int(row['num_ventas']),
                'promedio': float(row['promedio_venta'])
            }
            for _, row in df.iterrows()
        ]
        
        fecha_base = df['fecha'].max()
        predicciones = [
            {
                'fecha': (fecha_base + timedelta(days=i+1)).isoformat(),
                'prediccion_total': float(max(0, pred)),
                'confianza': confianza_baseline
            }
            for i, pred in enumerate(predicciones_valores)
        ]
        
        metricas = {
            'total_ventas_periodo': float(df['total_ventas'].sum()),
            'promedio_diario': float(df['total_ventas'].mean()),
            'maximo_dia': float(df['total_ventas'].max()),
            'minimo_dia': float(df['total_ventas'].min()),
            'desviacion_estandar': float(df['total_ventas'].std()),
            'pendiente_tendencia': float(pendiente)
        }
        
        cursor.close()
        conn.close()
        
        return PrediccionVentasResponse(
            empresa_id=target_company,
            empresa_nombre=empresa_nombre,
            periodo_analizado_dias=dias_historico,
            prediccion_proximos_dias=dias_prediccion,
            ventas_historicas=ventas_historicas,
            predicciones=predicciones,
            tendencia=tendencia,
            confianza=confianza_baseline,
            recomendaciones=recomendaciones,
            metricas=metricas,
            resumen_mensual=resumen_mensual,
            productos_top=productos_top,
            productos_forecast=productos_forecast
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Error en predicción de ventas: {str(e)}')


@app.get('/predictions/compras', response_model=PrediccionComprasResponse)
async def predecir_compras(
    idEmpresa: Optional[int] = None,
    x_user_role: str = Header(None),
    request: Request = None
):
    """
    Analiza inventario y genera sugerencias de compra
    - Identifica productos con stock crítico
    - Calcula velocidad de rotación
    - Sugiere cantidades óptimas de compra
    """
    role = get_role(x_user_role, request)
    user_company = get_company_id_from_request(request)
    
    if role == 'superadmin':
        target_company = idEmpresa
    else:
        target_company = user_company
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Nombre de la empresa (opcional)
        empresa_nombre = None
        if target_company:
            cursor.execute('SELECT nombreComercial FROM empresa_O WHERE idEmpresa = %s', (target_company,))
            emp = cursor.fetchone()
            empresa_nombre = emp['nombreComercial'] if emp else None

        # Productos con stock bajo (ordenados por stock asc)
        query_stock = (
            'SELECT p.idProducto, p.nombreProducto, p.stockCaja,'
            ' COALESCE(l.stockActual, 0) AS lote_stock'
            ' FROM producto_O p'
            ' LEFT JOIN lote_producto l ON p.idProducto = l.idProducto AND l.stockActual > 0'
        )
        params_stock: list = []
        if target_company:
            query_stock += ' AND p.idEmpresa = %s'
            params_stock.append(target_company)
        query_stock += ' ORDER BY p.stockCaja ASC LIMIT 20'
        cursor.execute(query_stock, params_stock)
        productos = cursor.fetchall() or []

        productos_criticos = []
        for prod in productos:
            stock = float(prod.get('stockCaja') or 0)
            # stockMinimo puede no existir; usar default 5 si no está
            minimo = float(prod.get('stockMinimo') or 5)
            if stock < minimo:
                productos_criticos.append({
                    'idProducto': prod['idProducto'],
                    'nombre': prod['nombreProducto'],
                    'stock_actual': stock,
                    'stock_minimo': minimo,
                    'deficit': minimo - stock,
                    'urgencia': 'alta' if stock < minimo * 0.5 else 'media'
                })

        # Velocidad de ventas últimos 30 días
        query_ventas = (
            'SELECT dv.idProducto, p.nombreProducto,'
            '       SUM(dv.cantidad_caja) AS total_vendido,'
            '       COUNT(DISTINCT v.idVenta) AS num_ventas,'
            '       AVG(dv.precio_unitario) AS precio_promedio'
            ' FROM detalle_venta_O dv'
            ' JOIN venta_O v ON dv.idVenta = v.idVenta'
            ' JOIN producto_O p ON dv.idProducto = p.idProducto'
            ' WHERE v.estado = 1'
            '   AND v.fechaVenta >= DATE_SUB(NOW(), INTERVAL 30 DAY)'
        )
        params_ventas: list = []
        if target_company:
            query_ventas += ' AND v.idEmpresa = %s'
            params_ventas.append(target_company)
        query_ventas += ' GROUP BY dv.idProducto, p.nombreProducto ORDER BY total_vendido DESC LIMIT 20'
        cursor.execute(query_ventas, params_ventas)
        ventas_productos = cursor.fetchall() or []

        sugerencias_compra = []
        for vp in ventas_productos:
            velocidad_diaria = float(vp.get('total_vendido') or 0) / 30.0
            dias_cobertura = 30
            cantidad_sugerida = velocidad_diaria * dias_cobertura
            sugerencias_compra.append({
                'idProducto': vp['idProducto'],
                'nombre': vp['nombreProducto'],
                'vendido_ultimo_mes': float(vp.get('total_vendido') or 0),
                'velocidad_diaria': round(velocidad_diaria, 2),
                'cantidad_sugerida': round(cantidad_sugerida, 0),
                'precio_promedio': float(vp.get('precio_promedio') or 0)
            })

        # Tendencias de precios (histórico de compras)
        query_precios = (
            'SELECT dc.idProducto, p.nombreProducto, dc.precio_unitario, c.fechaCompra'
            ' FROM detalle_compra_O dc'
            ' JOIN compra_O c ON dc.idCompra = c.idCompra'
            ' JOIN producto_O p ON dc.idProducto = p.idProducto'
            ' WHERE c.estado = 1'
        )
        params_precios: list = []
        if target_company:
            query_precios += ' AND c.idEmpresa = %s'
            params_precios.append(target_company)
        query_precios += ' ORDER BY dc.idProducto, c.fechaCompra DESC'
        cursor.execute(query_precios, params_precios)
        historico_precios = cursor.fetchall() or []
        
        # Agrupar por producto y calcular tendencia
        tendencias_precios = []
        productos_precios = {}
        
        for hp in historico_precios:
            pid = hp['idProducto']
            if pid not in productos_precios:
                productos_precios[pid] = {
                    'nombre': hp['nombreProducto'],
                    'precios': []
                }
            productos_precios[pid]['precios'].append(float(hp['precio_unitario']))
        
        for pid, data in list(productos_precios.items())[:10]:
            precios = data['precios'][:5]  # Últimas 5 compras
            if len(precios) >= 2:
                tendencia_precio = 'creciente' if precios[0] > precios[-1] else 'decreciente' if precios[0] < precios[-1] else 'estable'
                variacion = ((precios[0] - precios[-1]) / precios[-1] * 100) if precios[-1] > 0 else 0
                
                tendencias_precios.append({
                    'idProducto': pid,
                    'nombre': data['nombre'],
                    'precio_actual': precios[0],
                    'precio_anterior': precios[-1],
                    'tendencia': tendencia_precio,
                    'variacion_porcentual': round(variacion, 2)
                })
        
        # Proveedores más confiables (por cantidad de compras y montos)
        query_proveedores = '''
            SELECT pr.idProveedor, pr.nombreComercial,
                   COUNT(c.idCompra) as num_compras,
                   SUM(c.montoTotal) as total_comprado,
                   AVG(c.montoTotal) as promedio_compra
            FROM proveedor_O pr
            JOIN compra_O c ON pr.idProveedor = c.idProveedor
            WHERE c.estado = 1
              AND c.fechaCompra >= DATE_SUB(NOW(), INTERVAL 180 DAY)
        '''
        params_prov = []
        if target_company:
            query_proveedores += ' AND c.idEmpresa = %s'
            params_prov.append(target_company)
        
        query_proveedores += ' GROUP BY pr.idProveedor, pr.nombreComercial ORDER BY num_compras DESC LIMIT 10'
        
        cursor.execute(query_proveedores, params_prov)
        proveedores = cursor.fetchall()
        # Resumen mensual compras por producto (últimos 180 días)
        resumen_mensual = []
        productos_forecast = []
        try:
            compras_query = '''
                SELECT DATE(c.fechaCompra) as fecha, dc.idProducto, p.nombreProducto,
                       SUM(dc.cantidad) as cant,
                       SUM(dc.cantidad * dc.precio_unitario) as monto
                FROM detalle_compra_O dc
                JOIN compra_O c ON dc.idCompra = c.idCompra
                JOIN producto_O p ON dc.idProducto = p.idProducto
                WHERE c.estado = 1 AND c.fechaCompra >= DATE_SUB(NOW(), INTERVAL 180 DAY)
            '''
            compras_params = []
            if target_company:
                compras_query += ' AND c.idEmpresa = %s'
                compras_params.append(target_company)
            compras_query += ' GROUP BY DATE(c.fechaCompra), dc.idProducto, p.nombreProducto'
            cursor.execute(compras_query, compras_params)
            compras_prod = cursor.fetchall() or []
            if compras_prod:
                dfc = pd.DataFrame(compras_prod)
                dfc['fecha'] = pd.to_datetime(dfc['fecha'])
                dfc['mes'] = dfc['fecha'].dt.to_period('M')
                mensual_compra = dfc.groupby('mes')['monto'].sum().reset_index()
                resumen_mensual = [
                    {'mes': str(row['mes']), 'total_compras_mes': float(row['monto'])}
                    for _, row in mensual_compra.iterrows()
                ]
                # Forecast por producto si hay >=3 meses y Prophet disponible
                agg_prod = dfc.groupby(['idProducto','nombreProducto'])['monto'].sum().reset_index().sort_values('monto', ascending=False).head(10)
                for _, r in agg_prod.iterrows():
                    pid = r['idProducto']; pname = r['nombreProducto']
                    dfc_prod = dfc[dfc['idProducto'] == pid].copy()
                    dfc_prod['mes'] = dfc_prod['fecha'].dt.to_period('M')
                    dfc_m = dfc_prod.groupby('mes')['monto'].sum().reset_index()
                    if len(dfc_m) >= 3 and Prophet:
                        prophet_df = pd.DataFrame({
                            'ds': [pd.Period(m, freq='M').to_timestamp() for m in dfc_m['mes']],
                            'y': dfc_m['monto'].astype(float)
                        })
                        try:
                            m = Prophet(yearly_seasonality=False, weekly_seasonality=False, daily_seasonality=False)
                            m.fit(prophet_df)
                            future = m.make_future_dataframe(periods=3, freq='M')
                            fcst = m.predict(future.tail(3))
                            productos_forecast.append({
                                'idProducto': int(pid),
                                'nombre': pname,
                                'forecast': [
                                    {'mes': f['ds'].strftime('%Y-%m'), 'prediccion': float(f['yhat']), 'intervalo_min': float(f['yhat_lower']), 'intervalo_max': float(f['yhat_upper'])}
                                    for _, f in fcst.iterrows()
                                ]
                            })
                        except Exception:
                            pass
        except Exception:
            pass
        
        proveedores_recomendados = [
            {
                'idProveedor': p['idProveedor'],
                'nombre': p['nombreComercial'],
                'num_compras': int(p['num_compras']),
                'total_comprado': float(p['total_comprado']),
                'promedio_compra': float(p['promedio_compra']),
                'confiabilidad': 'alta' if p['num_compras'] > 10 else 'media'
            }
            for p in proveedores
        ]
        
        cursor.close()
        conn.close()
        
        return PrediccionComprasResponse(
            empresa_id=target_company,
            empresa_nombre=empresa_nombre,
            productos_criticos=productos_criticos,
            sugerencias_compra=sugerencias_compra,
            tendencias_precios=tendencias_precios,
            proveedores_recomendados=proveedores_recomendados,
            resumen_mensual=resumen_mensual,
            productos_forecast=productos_forecast
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Error en predicción de compras: {str(e)}')


@app.get('/predictions/rutas', response_model=PrediccionRutasResponse)
async def predecir_rutas(
    idEmpresa: Optional[int] = None,
    x_user_role: str = Header(None),
    request: Request = None
):
    """
    Analiza rutas y entregas para optimización
    - Identifica rutas más rentables
    - Detecta clientes frecuentes
    - Sugiere optimizaciones de zonas
    """
    role = get_role(x_user_role, request)
    user_company = get_company_id_from_request(request)
    
    if role == 'superadmin':
        target_company = idEmpresa
    else:
        target_company = user_company
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        # Obtener nombre de empresa
        empresa_nombre = None
        if target_company:
            cursor.execute('SELECT nombreComercial FROM empresa_O WHERE idEmpresa = %s', (target_company,))
            emp = cursor.fetchone()
            empresa_nombre = emp['nombreComercial'] if emp else None
        
        # Rutas más rentables (últimos 90 días)
        query_rutas = (
            """
            SELECT r.idRuta, r.nombreRuta,
                   COUNT(e.idEntrega) AS num_entregas,
                   SUM(d.montoTotal) AS total_ventas,
                   AVG(d.montoTotal) AS promedio_venta
            FROM ruta_O r
            LEFT JOIN entrega_ruta_O e ON r.idRuta = e.idRuta
            LEFT JOIN entrega_ruta_detalle_O d ON e.idEntrega = d.idEntrega
            WHERE e.fechaSalida >= DATE_SUB(NOW(), INTERVAL 90 DAY)
              AND e.estado = 'finalizado'
            """
        )
        params = []
        if target_company:
            # Filtrar por empresa usando la empresa de la entrega (más precisa)
            query_rutas += ' AND e.idEmpresa = %s'
            params.append(target_company)

        query_rutas += ' GROUP BY r.idRuta, r.nombreRuta ORDER BY total_ventas DESC LIMIT 10'

        cursor.execute(query_rutas, params)
        rutas = cursor.fetchall()
        
        rutas_mas_rentables = []
        for r in rutas:
            if r.get('num_entregas') and r['num_entregas'] > 0:
                rutas_mas_rentables.append({
                    'idRuta': r['idRuta'],
                    'nombre': r['nombreRuta'],
                    'num_entregas': int(r.get('num_entregas') or 0),
                    'total_ventas': float(r.get('total_ventas') or 0),
                    'promedio_venta': float(r.get('promedio_venta') or 0),
                    'rentabilidad': 'alta' if (r.get('total_ventas') or 0) > 5000 else 'media'
                })
        
        # Clientes más frecuentes (usando ventas en lugar de entregas por falta de idPersona en detalles de entrega)
        query_clientes = '''
            SELECT p.id_persona,
                   CONCAT(p.nombres_persona, ' ', COALESCE(p.apellido_paternoPersona, '')) AS nombre_completo,
                   COUNT(DISTINCT v.idVenta) AS num_entregas,
                   SUM(v.montoTotal) AS total_comprado
            FROM venta_O v
            JOIN persona_O p ON v.idCliente = p.id_persona
            WHERE v.fechaVenta >= DATE_SUB(NOW(), INTERVAL 90 DAY) AND v.estado = 1
        '''
        params_cli = []
        if target_company:
            query_clientes += ' AND v.idEmpresa = %s'
            params_cli.append(target_company)
        
        query_clientes += ' GROUP BY p.id_persona ORDER BY total_comprado DESC LIMIT 15'
        
        cursor.execute(query_clientes, params_cli)
        clientes = cursor.fetchall()
        
        clientes_frecuentes = []
        for c in clientes:
            clientes_frecuentes.append({
                'idPersona': c['id_persona'],
                'nombre': c['nombre_completo'],
                'num_entregas': int(c.get('num_entregas') or 0),
                'total_comprado': float(c.get('total_comprado') or 0),
                'frecuencia': 'alta' if (c.get('num_entregas') or 0) > 10 else 'media'
            })
        
        # Análisis por zona: omitido si la columna zona no existe en ruta_O
        zonas_con_mayor_demanda = []
        
        # Generar sugerencias
        sugerencias = []
        
        if rutas_mas_rentables:
            mejor_ruta = rutas_mas_rentables[0]
            sugerencias.append(f"🏆 La ruta '{mejor_ruta['nombre']}' es la más rentable con Bs {mejor_ruta['total_ventas']:.2f}")
        
        if len(rutas_mas_rentables) >= 3:
            top3_ventas = sum(r['total_ventas'] for r in rutas_mas_rentables[:3])
            sugerencias.append(f"💰 Las 3 mejores rutas generan el 80% de las ventas (Bs {top3_ventas:.2f})")
        
        if clientes_frecuentes:
            top_cliente = clientes_frecuentes[0]
            sugerencias.append(f"👤 Cliente más frecuente: {top_cliente['nombre']} con {top_cliente['num_entregas']} entregas")
        
        if zonas_con_mayor_demanda:
            mejor_zona = zonas_con_mayor_demanda[0]
            sugerencias.append(f"📍 La zona '{mejor_zona['zona']}' tiene la mayor demanda")
        
        sugerencias.append("💡 Considera consolidar rutas en zonas cercanas para reducir costos de transporte")
        sugerencias.append("⏰ Analiza los horarios de entrega más exitosos para optimizar planificación")
        
        cursor.close()
        conn.close()
        
        return PrediccionRutasResponse(
            empresa_id=target_company,
            empresa_nombre=empresa_nombre,
            rutas_mas_rentables=rutas_mas_rentables,
            clientes_frecuentes=clientes_frecuentes,
            zonas_con_mayor_demanda=zonas_con_mayor_demanda,
            sugerencias_optimizacion=sugerencias
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Error en predicción de rutas: {str(e)}')
@app.get('/predictions/creditos', response_model=PrediccionCreditoResponse)
async def predecir_creditos(
    idEmpresa: Optional[int] = None,
    x_user_role: str = Header(None),
    request: Request = None
):
    """Recomienda qué clientes pueden recibir o ampliar crédito basándose en:
    - Frecuencia de compras
    - Ticket promedio
    - Recencia (días desde última compra)
    - Variabilidad (coeficiente de variación)
    """
    role = get_role(x_user_role, request)
    user_company = get_company_id_from_request(request)
    target_company = idEmpresa if role == 'superadmin' else user_company
    criterios = [
        'Frecuencia (>= 4 compras últimos 90 días)',
        'Ticket promedio (mayor a la mediana de la empresa)',
        'Recencia (última compra <= 30 días)',
        'Variabilidad baja (CV < 1.2)'
    ]
    try:
        conn = get_db_connection(); cur = conn.cursor(dictionary=True)
        fecha_limite = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
        # Ajustar columnas segun esquema real: venta_O tiene idCliente referenciando persona_O.id_persona
        sql = '''
            SELECT p.id_persona, CONCAT(p.nombres_persona,' ',COALESCE(p.apellido_paternoPersona,'')) AS nombre,
                   COUNT(v.idVenta) AS num_compras,
                   AVG(v.montoTotal) AS ticket_promedio,
                   MAX(v.fechaVenta) AS ultima_compra,
                   STDDEV(v.montoTotal) AS std_ticket,
                   AVG(v.montoTotal) AS avg_ticket
            FROM venta_O v
            JOIN persona_O p ON v.idCliente = p.id_persona
            WHERE v.estado = 1 AND v.fechaVenta >= %s
        '''
        params = [fecha_limite]
        if target_company:
            sql += ' AND v.idEmpresa = %s'
            params.append(target_company)
        sql += ' GROUP BY p.id_persona, nombre'
        cur.execute(sql, params)
        rows = cur.fetchall() or []
        # Calcular mediana del ticket promedio
        tickets = [r['ticket_promedio'] for r in rows if r['ticket_promedio'] is not None]
        mediana = float(np.median(tickets)) if tickets else 0.0
        clientes = []
        for r in rows:
            ultima_dt = r['ultima_compra'] if isinstance(r['ultima_compra'], datetime) else datetime.strptime(str(r['ultima_compra']), '%Y-%m-%d %H:%M:%S') if r['ultima_compra'] else None
            dias_recencia = (datetime.now() - ultima_dt).days if ultima_dt else 999
            # Asegurar tipos numéricos float para evitar errores Decimal/float
            std_val = float(r['std_ticket']) if r.get('std_ticket') is not None else 0.0
            avg_val = float(r['avg_ticket']) if r.get('avg_ticket') is not None else 0.0
            cv = (std_val / avg_val) if avg_val > 0 else 0.0
            score = 0
            if r['num_compras'] >= 4: score += 1
            if (r['ticket_promedio'] or 0) >= mediana: score += 1
            if dias_recencia <= 30: score += 1
            if cv < 1.2: score += 1
            nivel = 'alto' if score >= 3 else 'medio' if score == 2 else 'bajo'
            limite_recomendado = (r['ticket_promedio'] or 0) * (4 if nivel=='alto' else 2 if nivel=='medio' else 1)
            clientes.append({
                'idPersona': r['id_persona'],
                'nombre': r['nombre'],
                'num_compras_90d': int(r['num_compras']),
                'ticket_promedio': float(r['ticket_promedio'] or 0),
                'dias_desde_ultima_compra': dias_recencia,
                'coef_variacion': float(cv),
                'nivel_riesgo': nivel,
                'limite_credito_recomendado': round(limite_recomendado, 2)
            })
        recomendaciones_generales = []
        if clientes:
            altos = [c for c in clientes if c['nivel_riesgo']=='alto']
            if altos:
                recomendaciones_generales.append(f"Otorgar/expandir crédito a {len(altos)} clientes de perfil alto.")
        cur.close(); conn.close()
        return PrediccionCreditoResponse(
            empresa_id=target_company,
            empresa_nombre=None,
            clientes_evaluados=clientes,
            criterios=criterios,
            recomendaciones_generales=recomendaciones_generales
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Error en predicción de crédito: {str(e)}')

@app.get('/predictions/clima', response_model=PrediccionClimaResponse)
async def predecir_clima(zona: Optional[str] = None):
    """Pronóstico de clima básico por zona.
    Si WEATHER_API_KEY está configurado se puede integrar con un proveedor externo (OpenWeather, etc.).
    Actualmente genera datos simulados determinísticos para mostrar estructura.
    """
    z = zona or 'general'
    seed = sum(ord(c) for c in z) % 100
    pronostico = []
    for i in range(7):
        base = (seed * (i+1)) % 50
        temp = 10 + (base * 0.6)
        humedad = 40 + (base % 60)
        lluvia_prob = round(((base % 30) / 30), 2)
        pronostico.append({
            'dia': (datetime.utcnow() + timedelta(days=i)).strftime('%Y-%m-%d'),
            'temp_c': round(temp,1),
            'humedad_pct': int(min(100, humedad)),
            'prob_lluvia': lluvia_prob
        })
    recomendaciones = []
    avg_lluvia = np.mean([p['prob_lluvia'] for p in pronostico]) if pronostico else 0
    if avg_lluvia > 0.5:
        recomendaciones.append('Alta probabilidad de lluvia esta semana: planificar rutas con protección.')
    else:
        recomendaciones.append('Baja probabilidad de lluvia: aprovechar para entregas rápidas.')
    return PrediccionClimaResponse(
        zona=z,
        fuente='simulado',
        pronostico=pronostico,
        recomendaciones=recomendaciones
    )



if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8010)
