import React, { useEffect, useMemo, useState } from 'react';
import EmpresaSelector from './EmpresaSelector';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

export default function Predicciones({ userRole }) {
  // Helpers: simple iconography based on rain probability and temperature
  const WeatherIcon = ({ prob = 0, temp = 25 }) => {
    const p = Math.min(100, Math.max(0, Math.round((prob || 0) * 100)));
    const isRainy = p >= 50;
    const isCloudy = p >= 20 && p < 50;
    const isHot = temp >= 28;
    const sunColor = isHot ? '#fde047' : '#fbbf24';

    if (isRainy) {
      return (
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 15a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.2A4.5 4.5 0 1 1 19 15H7z" fill="#93c5fd"/>
          <path d="M8 19c0 .6-.4 1-1 1s-1-.4-1-1 .4-1 1-1 1 .4 1 1zm5 0c0 .6-.4 1-1 1s-1-.4-1-1 .4-1 1-1 1 .4 1 1zm5 0c0 .6-.4 1-1 1s-1-.4-1-1 .4-1 1-1 1 .4 1 1z" fill="#60a5fa"/>
        </svg>
      );
    }
    if (isCloudy) {
      return (
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 16a4 4 0 0 1 0-8 5 5 0 0 1 9.6-1.2A4.5 4.5 0 1 1 19 16H7z" fill="#cbd5e1"/>
        </svg>
      );
    }
    return (
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="12" r="5" fill={sunColor} />
        <line x1="12" y1="1" x2="12" y2="4" stroke={sunColor} strokeWidth="2" strokeLinecap="round"/>
        <line x1="12" y1="20" x2="12" y2="23" stroke={sunColor} strokeWidth="2" strokeLinecap="round"/>
        <line x1="1" y1="12" x2="4" y2="12" stroke={sunColor} strokeWidth="2" strokeLinecap="round"/>
        <line x1="20" y1="12" x2="23" y2="12" stroke={sunColor} strokeWidth="2" strokeLinecap="round"/>
        <line x1="4.2" y1="4.2" x2="6.5" y2="6.5" stroke={sunColor} strokeWidth="2" strokeLinecap="round"/>
        <line x1="17.5" y1="17.5" x2="19.8" y2="19.8" stroke={sunColor} strokeWidth="2" strokeLinecap="round"/>
        <line x1="4.2" y1="19.8" x2="6.5" y2="17.5" stroke={sunColor} strokeWidth="2" strokeLinecap="round"/>
        <line x1="17.5" y1="6.5" x2="19.8" y2="4.2" stroke={sunColor} strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  };
  const [selectedEmpresa, setSelectedEmpresa] = useState(null);
  const [tipo, setTipo] = useState('ventas'); // 'ventas'|'compras'|'rutas'|'creditos'|'clima'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const [zona, setZona] = useState('');

  const host = (typeof window !== 'undefined' && window.location?.hostname) ? window.location.hostname : 'localhost';
  const proto = (typeof window !== 'undefined' && window.location?.protocol) ? window.location.protocol : 'http:';
  const API_AI = `${proto}//${host}/api/ai`;

  const fetchPred = async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (selectedEmpresa) params.set('idEmpresa', String(selectedEmpresa));
      let url = '';
      if (tipo === 'ventas') url = `${API_AI}/predictions/ventas?${params.toString()}`;
      else if (tipo === 'compras') url = `${API_AI}/predictions/compras?${params.toString()}`;
      else if (tipo === 'rutas') url = `${API_AI}/predictions/rutas?${params.toString()}`;
      else if (tipo === 'creditos') url = `${API_AI}/predictions/creditos?${params.toString()}`;
      else {
        const zp = new URLSearchParams();
        if (zona) zp.set('zona', zona);
        url = `${API_AI}/predictions/clima?${zp.toString()}`;
      }
      const res = await fetch(url, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Error IA:', e);
      setError(e.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPred(); /* eslint-disable-next-line */ }, [tipo, selectedEmpresa]);

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <EmpresaSelector userRole={userRole} selectedEmpresa={selectedEmpresa} onEmpresaChange={setSelectedEmpresa} />

      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-xl sm:text-2xl font-bold dark:text-white">Predicciones con IA</h2>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={tipo} onChange={e=>setTipo(e.target.value)} className="px-3 py-2 border rounded dark:bg-gray-800">
            <option value="ventas">Ventas</option>
            <option value="compras">Compras</option>
            <option value="rutas">Rutas</option>
            <option value="creditos">Créditos</option>
            <option value="clima">Clima</option>
          </select>
          {tipo==='clima' && (
            <input value={zona} onChange={e=>setZona(e.target.value)} placeholder="Zona (opcional)" className="px-3 py-2 border rounded dark:bg-gray-800" />
          )}
          <button onClick={fetchPred} className="px-3 py-2 bg-blue-600 text-white rounded">Actualizar</button>
        </div>
      </div>

      {loading && <div className="text-gray-500">Cargando...</div>}
      {error && <div className="text-red-600">{error}</div>}

      {!loading && !error && data && tipo === 'ventas' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700">
            <h3 className="font-semibold mb-2">Histórico de ventas</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.ventas_historicas}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="total" name="Total Bs" stroke="#3b82f6" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700">
            <h3 className="font-semibold mb-2">Resumen mensual</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.resumen_mensual || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_mes" name="Total Bs" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700">
            <h3 className="font-semibold mb-2">Predicción próximos días</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.predicciones}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="prediccion_total" name="Predicción Bs" stroke="#10b981" dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              Tendencia: <b>{data.tendencia}</b> · Confianza: <b>{Math.round((data.confianza||0)*100)}%</b>
            </div>
          </div>
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700">
            <h3 className="font-semibold mb-2">Recomendaciones</h3>
            <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
              {data.recomendaciones?.map((r,i)=>(<li key={i}>{r}</li>))}
            </ul>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700">
            <h3 className="font-semibold mb-2">Productos top (monto)</h3>
            <div className="space-y-2 max-h-72 overflow-auto">
              {data.productos_top?.map(p => (
                <div key={p.idProducto} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-900">
                  <div className="font-medium">{p.nombre}</div>
                  <div className="text-sm">Bs {Math.round(p.monto_total)}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700">
            <h3 className="font-semibold mb-2">Forecast por producto</h3>
            <div className="space-y-2 max-h-72 overflow-auto">
              {data.productos_forecast?.map((pf,i)=> (
                <div key={i} className="p-2 rounded bg-gray-50 dark:bg-gray-900">
                  <div className="font-medium">{pf.nombre}</div>
                  <div className="text-xs text-gray-600">Próx. 3 meses:</div>
                  <div className="text-xs">
                    {pf.forecast.map(f => (<span key={f.mes} className="inline-block mr-3">{f.mes}: Bs {Math.round(f.prediccion)}</span>))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && !error && data && tipo === 'compras' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700">
            <h3 className="font-semibold mb-2">Productos críticos (stock bajo)</h3>
            <div className="space-y-2 max-h-72 overflow-auto">
              {data.productos_criticos?.map(p=> (
                <div key={p.idProducto} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-900">
                  <div>
                    <div className="font-medium">{p.nombre}</div>
                    <div className="text-xs text-gray-500">Stock: {p.stock_actual} / Mín: {p.stock_minimo}</div>
                  </div>
                  <div className={`text-xs px-2 py-1 rounded ${p.urgencia==='alta'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{p.urgencia}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700">
            <h3 className="font-semibold mb-2">Sugerencias de compra (30 días)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.sugerencias_compra?.slice(0,12) || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nombre" tick={{fontSize:10}} interval={0} angle={-20} textAnchor="end" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="cantidad_sugerida" name="Cajas sugeridas" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700">
            <h3 className="font-semibold mb-2">Compras por mes</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.resumen_mensual || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" tick={{fontSize:10}} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_compras_mes" name="Total Bs" fill="#94a3b8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700">
            <h3 className="font-semibold mb-2">Forecast por producto</h3>
            <div className="space-y-2 max-h-72 overflow-auto">
              {data.productos_forecast?.map((pf,i)=> (
                <div key={i} className="p-2 rounded bg-gray-50 dark:bg-gray-900">
                  <div className="font-medium">{pf.nombre}</div>
                  <div className="text-xs text-gray-600">Próx. 3 meses:</div>
                  <div className="text-xs">
                    {pf.forecast.map(f => (<span key={f.mes} className="inline-block mr-3">{f.mes}: Bs {Math.round(f.prediccion)}</span>))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700">
            <h3 className="font-semibold mb-2">Tendencias de precios</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.tendencias_precios?.slice(0,8).map((t,i)=> (
                <div key={i} className="p-3 rounded bg-gray-50 dark:bg-gray-900">
                  <div className="font-medium">{t.nombre}</div>
                  <div className="text-sm">Actual: Bs {t.precio_actual} · Anterior: Bs {t.precio_anterior}</div>
                  <div className="text-xs text-gray-600">{t.tendencia} ({t.variacion_porcentual}%)</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && !error && data && tipo === 'rutas' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700">
            <h3 className="font-semibold mb-2">Rutas más rentables</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.rutas_mas_rentables || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="nombre" tick={{fontSize:10}} interval={0} angle={-20} textAnchor="end" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="total_ventas" name="Total Bs" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700">
            <h3 className="font-semibold mb-2">Clientes frecuentes</h3>
            <div className="space-y-2 max-h-72 overflow-auto">
              {data.clientes_frecuentes?.map(c=> (
                <div key={c.idPersona} className="flex items-center justify-between p-2 rounded bg-gray-50 dark:bg-gray-900">
                  <div>
                    <div className="font-medium">{c.nombre}</div>
                    <div className="text-xs text-gray-500">Entregas: {c.num_entregas} · Gastado: Bs {c.total_comprado}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700">
            <h3 className="font-semibold mb-2">Sugerencias de optimización</h3>
            <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
              {data.sugerencias_optimizacion?.map((r,i)=>(<li key={i}>{r}</li>))}
            </ul>
          </div>
        </div>
      )}

      {!loading && !error && data && tipo === 'creditos' && (
        <div className="grid grid-cols-1 gap-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700">
            <h3 className="font-semibold mb-2">Recomendaciones generales</h3>
            <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
              {data.recomendaciones_generales?.map((r,i)=>(<li key={i}>{r}</li>))}
            </ul>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700 overflow-auto">
            <h3 className="font-semibold mb-2">Clientes evaluados (últimos 90 días)</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="p-2">Cliente</th>
                  <th className="p-2">Compras</th>
                  <th className="p-2">Ticket prom.</th>
                  <th className="p-2">Recencia (días)</th>
                  <th className="p-2">CV</th>
                  <th className="p-2">Riesgo</th>
                  <th className="p-2">Límite sugerido</th>
                </tr>
              </thead>
              <tbody>
                {data.clientes_evaluados?.map((c,i)=> (
                  <tr key={i} className="border-t border-gray-200 dark:border-gray-700">
                    <td className="p-2">{c.nombre}</td>
                    <td className="p-2">{c.num_compras_90d}</td>
                    <td className="p-2">Bs {Math.round(c.ticket_promedio)}</td>
                    <td className="p-2">{c.dias_desde_ultima_compra}</td>
                    <td className="p-2">{c.coef_variacion.toFixed ? c.coef_variacion.toFixed(2) : c.coef_variacion}</td>
                    <td className="p-2 capitalize">{c.nivel_riesgo}</td>
                    <td className="p-2 font-medium">Bs {Math.round(c.limite_credito_recomendado)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded border dark:border-gray-700">
            <h3 className="font-semibold mb-2">Criterios</h3>
            <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
              {data.criterios?.map((r,i)=>(<li key={i}>{r}</li>))}
            </ul>
          </div>
        </div>
      )}

      {!loading && !error && data && tipo === 'clima' && (
        <div className="grid grid-cols-1 gap-6">
          {/* Hero current conditions */}
          <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-sky-500 via-cyan-500 to-indigo-500 shadow-xl">
            <div className="absolute -top-10 -right-10 w-56 h-56 bg-white/10 rounded-full blur-2xl"/>
            <div className="absolute -bottom-10 -left-10 w-56 h-56 bg-black/10 rounded-full blur-3xl"/>
            <div className="relative flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-white/90 text-sm">Pronóstico 7 días {data.zona ? `(${data.zona})` : ''}</div>
                <div className="text-white text-4xl md:text-5xl font-extrabold tracking-tight">
                  {data.pronostico?.[0]?.temp_c ?? '--'}°C
                </div>
                <div className="mt-1 text-white/90 text-sm flex items-center gap-4">
                  <span className="inline-flex items-center gap-1"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v20" stroke="white" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="16" r="4" stroke="white" strokeWidth="2"/></svg>{data.pronostico?.[0]?.humedad_pct ?? '--'}%</span>
                  <span className="inline-flex items-center gap-1"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C9 6 6 9 6 12a6 6 0 1 0 12 0c0-3-3-6-6-10z" stroke="white" strokeWidth="2" fill="none"/></svg>{Math.round(((data.pronostico?.[0]?.prob_lluvia)||0)*100)}%</span>
                </div>
              </div>
              <div className="flex items-center gap-3 text-white">
                <WeatherIcon prob={data.pronostico?.[0]?.prob_lluvia} temp={data.pronostico?.[0]?.temp_c} />
              </div>
            </div>
          </div>

          {/* Forecast cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {data.pronostico?.map((d,i)=> (
              <div key={i} className="group p-4 rounded-xl bg-white/70 dark:bg-gray-800/70 backdrop-blur border border-white/30 dark:border-gray-700 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-semibold text-gray-800 dark:text-gray-100">{d.dia}</div>
                  <WeatherIcon prob={d.prob_lluvia} temp={d.temp_c} />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{d.temp_c}°</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <div className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-sky-400"/>Humedad</div>
                  <div className="text-right">{d.humedad_pct}%</div>
                  <div className="flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-full bg-indigo-400"/>Lluvia</div>
                  <div className="text-right">{Math.round(((d.prob_lluvia)||0)*100)}%</div>
                </div>
                <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded">
                  <div className="h-1.5 rounded bg-gradient-to-r from-sky-400 to-indigo-400" style={{ width: `${Math.round(((d.prob_lluvia)||0)*100)}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* Temperature trend */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
            <h3 className="font-semibold mb-2 text-gray-800 dark:text-gray-100">Tendencia de temperatura</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.pronostico || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dia" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="temp_c" name="Temp °C" stroke="#06b6d4" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Recommendations */}
          <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border dark:border-gray-700">
            <h3 className="font-semibold mb-2 text-gray-800 dark:text-gray-100">Recomendaciones</h3>
            <ul className="list-disc pl-5 text-sm text-gray-700 dark:text-gray-300">
              {data.recomendaciones?.map((r,i)=>(<li key={i}>{r}</li>))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
