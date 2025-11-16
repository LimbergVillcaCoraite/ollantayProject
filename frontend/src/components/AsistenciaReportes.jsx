import React, { useState, useEffect } from 'react';
import { useToast } from '../ToastContext';

const AsistenciaReportes = ({ API, userRole, dark }) => {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [estadisticas, setEstadisticas] = useState([]);
  const [detalles, setDetalles] = useState([]);
  const [loadingDetalles, setLoadingDetalles] = useState(false);
  const [registrosPorDia, setRegistrosPorDia] = useState([]);
  const [loadingPorDia, setLoadingPorDia] = useState(false);
  
  // Filtros
  const [desde, setDesde] = useState(() => {
    const d = new Date();
    d.setDate(1); // Primer día del mes
    return d.toISOString().split('T')[0];
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().split('T')[0]);
  const [idPersonaFiltro, setIdPersonaFiltro] = useState('');
  
  // Datos adicionales
  const [empleados, setEmpleados] = useState([]);
  const [view, setView] = useState('pordia'); // 'pordia' | 'estadisticas' | 'detalles'

  useEffect(() => {
    loadEmpleados();
    loadRegistrosPorDia(); // Auto-load por dia on mount
  }, [API, userRole]);

  const loadEmpleados = async () => {
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (userRole) headers['X-User-Role'] = userRole;
      const res = await fetch(`${API}/empleados`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        setEmpleados(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error loading empleados:', err);
    }
  };

  const loadEstadisticas = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (desde) params.append('desde', desde);
      if (hasta) params.append('hasta', hasta);
      if (idPersonaFiltro) params.append('id_persona', idPersonaFiltro);

      const headers = {};
      if (userRole) headers['X-User-Role'] = userRole;

      const res = await fetch(`${API}/asistencia/estadisticas?${params.toString()}`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Error desconocido' }));
        throw new Error(errorData.detail || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setEstadisticas(data.items || []);
    } catch (err) {
      console.error('Error loading estadisticas:', err);
      toast.push('Error cargando estadísticas: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadRegistrosPorDia = async () => {
    setLoadingPorDia(true);
    try {
      const params = new URLSearchParams();
      if (desde) params.append('desde', desde + ' 00:00:00');
      if (hasta) params.append('hasta', hasta + ' 23:59:59');
      if (idPersonaFiltro) params.append('id_persona', idPersonaFiltro);

      const headers = {};
      if (userRole) headers['X-User-Role'] = userRole;

      const res = await fetch(`${API}/asistencia/registros?${params.toString()}`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      const registros = data.items || [];
      
      // Agrupar por persona y día
      const agrupado = {};
      registros.forEach(reg => {
        const fecha = reg.timestamp ? new Date(reg.timestamp).toLocaleDateString('es-ES') : 'Sin fecha';
        const key = `${reg.id_persona}_${fecha}`;
        
        if (!agrupado[key]) {
          agrupado[key] = {
            id_persona: reg.id_persona,
            nombre_empleado: reg.nombre_empleado,
            fecha: fecha,
            entrada: null,
            salida: null
          };
        }
        
        if (reg.tipo === 'entrada') {
          if (!agrupado[key].entrada || new Date(reg.timestamp) > new Date(agrupado[key].entrada.timestamp)) {
            agrupado[key].entrada = reg;
          }
        } else {
          if (!agrupado[key].salida || new Date(reg.timestamp) > new Date(agrupado[key].salida.timestamp)) {
            agrupado[key].salida = reg;
          }
        }
      });
      
      setRegistrosPorDia(Object.values(agrupado).sort((a, b) => {
        const dateA = a.entrada?.timestamp || a.salida?.timestamp;
        const dateB = b.entrada?.timestamp || b.salida?.timestamp;
        return new Date(dateB) - new Date(dateA);
      }));
    } catch (err) {
      console.error('Error loading registros por dia:', err);
      toast.push('Error cargando registros por día: ' + err.message, 'error');
    } finally {
      setLoadingPorDia(false);
    }
  };

  const loadDetalles = async () => {
    setLoadingDetalles(true);
    try {
      const params = new URLSearchParams();
      if (desde) params.append('desde', desde + ' 00:00:00');
      if (hasta) params.append('hasta', hasta + ' 23:59:59');
      if (idPersonaFiltro) params.append('id_persona', idPersonaFiltro);

      const headers = {};
      if (userRole) headers['X-User-Role'] = userRole;

      // Endpoint hipotético para obtener registros detallados
      // Si no existe, se puede crear fácilmente en backend
      const res = await fetch(`${API}/asistencia/registros?${params.toString()}`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      setDetalles(data.items || []);
    } catch (err) {
      console.error('Error loading detalles:', err);
      toast.push('Error cargando detalles: ' + err.message, 'error');
    } finally {
      setLoadingDetalles(false);
    }
  };

  const exportarExcel = () => {
    // Implementación básica de export a CSV
    let data, csv = '';
    
    if (view === 'pordia') {
      data = registrosPorDia;
      if (data.length === 0) {
        toast.push('No hay datos para exportar', 'warning');
        return;
      }
      csv = 'Fecha,Empleado,Hora Entrada,Ubicación Entrada,Hora Salida,Ubicación Salida,Horas Trabajadas\n';
      data.forEach(item => {
        const horaEntrada = item.entrada ? new Date(item.entrada.timestamp).toLocaleTimeString('es-ES') : '-';
        const horaSalida = item.salida ? new Date(item.salida.timestamp).toLocaleTimeString('es-ES') : '-';
        const latEntrada = item.entrada?.geo_lat || '';
        const lngEntrada = item.entrada?.geo_lng || '';
        const latSalida = item.salida?.geo_lat || '';
        const lngSalida = item.salida?.geo_lng || '';
        const ubicEntrada = latEntrada && lngEntrada ? `${latEntrada},${lngEntrada}` : '';
        const ubicSalida = latSalida && lngSalida ? `${latSalida},${lngSalida}` : '';
        
        let horas = '-';
        if (item.entrada?.timestamp && item.salida?.timestamp) {
          const diff = new Date(item.salida.timestamp) - new Date(item.entrada.timestamp);
          const h = Math.floor(diff / 3600000);
          const m = Math.floor((diff % 3600000) / 60000);
          horas = `${h}h ${m}m`;
        }
        
        csv += `${item.fecha},"${item.nombre_empleado}",${horaEntrada},"${ubicEntrada}",${horaSalida},"${ubicSalida}",${horas}\n`;
      });
    } else if (view === 'estadisticas') {
      data = estadisticas;
      if (data.length === 0) {
        toast.push('No hay datos para exportar', 'warning');
        return;
      }
      csv = 'ID Persona,Nombre,Entradas,Salidas\n';
      data.forEach(item => {
        const emp = empleados.find(e => e.id_persona === item.id_persona);
        const nombre = emp ? `${emp.nombres_persona} ${emp.apellido_paternoPersona || ''}`.trim() : `Persona ${item.id_persona}`;
        csv += `${item.id_persona},"${nombre}",${item.entradas},${item.salidas}\n`;
      });
    } else {
      data = detalles;
      if (data.length === 0) {
        toast.push('No hay datos para exportar', 'warning');
        return;
      }
      csv = 'ID,ID Persona,Nombre,Tipo,Fecha/Hora,Latitud,Longitud,Nota\n';
      data.forEach(item => {
        const nombre = item.nombre_empleado || getEmpleadoNombre(item.id_persona);
        csv += `${item.id_asistencia},${item.id_persona},"${nombre}",${item.tipo},${item.timestamp},${item.geo_lat || ''},${item.geo_lng || ''},"${item.nota || ''}"\n`;
      });
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `asistencia_${view}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.push('Reporte exportado exitosamente', 'success');
  };

  const getEmpleadoNombre = (id_persona) => {
    const emp = empleados.find(e => e.id_persona === id_persona);
    if (!emp) return `Persona ${id_persona}`;
    return `${emp.nombres_persona || ''} ${emp.apellido_paternoPersona || ''} ${emp.apellido_maternoPer || ''}`.trim();
  };

  return (
    <div className={`${dark ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'} min-h-screen p-6`}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-teal-400 to-blue-500 bg-clip-text text-transparent">
            📊 Reportes de Asistencia
          </h1>
          <p className={dark ? 'text-gray-400' : 'text-gray-600'}>
            Visualiza y exporta estadísticas de entradas y salidas
          </p>
        </div>

        {/* Filtros */}
        <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6 mb-6`}>
          <h2 className="text-xl font-bold mb-4">Filtros</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Desde</label>
              <input
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg ${
                  dark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                }`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Hasta</label>
              <input
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg ${
                  dark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                }`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Empleado (opcional)</label>
              <select
                value={idPersonaFiltro}
                onChange={(e) => setIdPersonaFiltro(e.target.value)}
                className={`w-full px-3 py-2 border rounded-lg ${
                  dark ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-300'
                }`}
              >
                <option value="">Todos</option>
                {empleados.map(emp => (
                  <option key={emp.id_persona} value={emp.id_persona}>
                    {getEmpleadoNombre(emp.id_persona)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() => {
                  if (view === 'pordia') loadRegistrosPorDia();
                  else if (view === 'estadisticas') loadEstadisticas();
                  else loadDetalles();
                }}
                disabled={loading || loadingDetalles || loadingPorDia}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white rounded-lg font-medium transition-all disabled:opacity-50"
              >
                {(loading || loadingDetalles || loadingPorDia) ? 'Cargando...' : 'Consultar'}
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setView('pordia')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              view === 'pordia'
                ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg'
                : dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            📅 Por Día
          </button>
          <button
            onClick={() => setView('estadisticas')}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              view === 'estadisticas'
                ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg'
                : dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            📈 Estadísticas
          </button>
          <button
            onClick={() => { setView('detalles'); loadDetalles(); }}
            className={`px-6 py-3 rounded-xl font-semibold transition-all ${
              view === 'detalles'
                ? 'bg-gradient-to-r from-teal-500 to-teal-600 text-white shadow-lg'
                : dark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            📋 Registros Detallados
          </button>
        </div>

        {/* Contenido */}
        {view === 'pordia' && (
          <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Asistencia por Día</h2>
              {registrosPorDia.length > 0 && (
                <button
                  onClick={exportarExcel}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  📥 Exportar Excel
                </button>
              )}
            </div>

            {loadingPorDia ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mx-auto"></div>
                <p className="mt-4 text-gray-500">Cargando registros por día...</p>
              </div>
            ) : registrosPorDia.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No se encontraron registros para el período seleccionado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={`${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider rounded-tl-lg">Fecha</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Empleado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Entrada</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Ubicación Entrada</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Salida</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Ubicación Salida</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider rounded-tr-lg">Horas Trabajadas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrosPorDia.map((item, idx) => {
                      const horasTrabajadas = item.entrada?.timestamp && item.salida?.timestamp
                        ? (() => {
                            const diff = new Date(item.salida.timestamp) - new Date(item.entrada.timestamp);
                            const h = Math.floor(diff / 3600000);
                            const m = Math.floor((diff % 3600000) / 60000);
                            return `${h}h ${m}m`;
                          })()
                        : '-';

                      return (
                        <tr
                          key={idx}
                          className={`border-b ${dark ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}
                        >
                          <td className="px-4 py-4 font-semibold">{item.fecha}</td>
                          <td className="px-4 py-4">
                            <div>
                              <div className="font-semibold">{item.nombre_empleado || getEmpleadoNombre(item.id_persona)}</div>
                              <div className="text-xs text-gray-500">ID: {item.id_persona}</div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {item.entrada ? (
                              <div>
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                                  🟢 {new Date(item.entrada.timestamp).toLocaleTimeString('es-ES')}
                                </span>
                                {item.entrada.nota && (
                                  <div className="text-xs text-gray-500 mt-1">{item.entrada.nota}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">Sin entrada</span>
                            )}
                          </td>
                          <td className="px-4 py-4 font-mono text-xs">
                            {item.entrada?.geo_lat && item.entrada?.geo_lng ? (
                              <a
                                href={`https://www.google.com/maps?q=${item.entrada.geo_lat},${item.entrada.geo_lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700 underline"
                              >
                                📍 {item.entrada.geo_lat.toFixed(6)}, {item.entrada.geo_lng.toFixed(6)}
                              </a>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            {item.salida ? (
                              <div>
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                                  🔴 {new Date(item.salida.timestamp).toLocaleTimeString('es-ES')}
                                </span>
                                {item.salida.nota && (
                                  <div className="text-xs text-gray-500 mt-1">{item.salida.nota}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">Sin salida</span>
                            )}
                          </td>
                          <td className="px-4 py-4 font-mono text-xs">
                            {item.salida?.geo_lat && item.salida?.geo_lng ? (
                              <a
                                href={`https://www.google.com/maps?q=${item.salida.geo_lat},${item.salida.geo_lng}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700 underline"
                              >
                                📍 {item.salida.geo_lat.toFixed(6)}, {item.salida.geo_lng.toFixed(6)}
                              </a>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                              horasTrabajadas !== '-'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                            }`}>
                              {horasTrabajadas}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === 'estadisticas' && (
          <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Resumen de Asistencia</h2>
              {estadisticas.length > 0 && (
                <button
                  onClick={exportarExcel}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  📥 Exportar Excel
                </button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mx-auto"></div>
                <p className="mt-4 text-gray-500">Cargando estadísticas...</p>
              </div>
            ) : estadisticas.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No se encontraron registros para el período seleccionado
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className={`${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <th className="px-4 py-3 text-left rounded-tl-lg">ID</th>
                      <th className="px-4 py-3 text-left">Empleado</th>
                      <th className="px-4 py-3 text-center">Entradas</th>
                      <th className="px-4 py-3 text-center">Salidas</th>
                      <th className="px-4 py-3 text-center rounded-tr-lg">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {estadisticas.map((stat, idx) => (
                      <tr 
                        key={idx}
                        className={`border-b ${dark ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}
                      >
                        <td className="px-4 py-4 font-mono text-sm">{stat.id_persona}</td>
                        <td className="px-4 py-4 font-semibold">
                          {getEmpleadoNombre(stat.id_persona)}
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 font-bold text-lg">
                            {stat.entradas}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 font-bold text-lg">
                            {stat.salidas}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-center">
                          {stat.entradas - stat.salidas !== 0 && (
                            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                              stat.entradas > stat.salidas
                                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                            }`}>
                              {stat.entradas - stat.salidas > 0 ? '+' : ''}{stat.entradas - stat.salidas}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {view === 'detalles' && (
          <div className={`${dark ? 'bg-gray-800' : 'bg-white'} rounded-2xl shadow-xl p-6`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Registros Detallados</h2>
              {detalles.length > 0 && (
                <button
                  onClick={exportarExcel}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                >
                  📥 Exportar Excel
                </button>
              )}
            </div>

            {loadingDetalles ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mx-auto"></div>
                <p className="mt-4 text-gray-500">Cargando registros...</p>
              </div>
            ) : detalles.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-lg font-semibold mb-2">No hay registros</p>
                <p className="text-sm">Ajusta los filtros e intenta nuevamente</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className={`${dark ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Empleado</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Tipo</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Fecha y Hora</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Ubicación GPS</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">Nota</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detalles.map((det, idx) => (
                      <tr 
                        key={idx}
                        className={`border-b ${dark ? 'border-gray-700 hover:bg-gray-700/50' : 'border-gray-200 hover:bg-gray-50'} transition-colors`}
                      >
                        <td className="px-4 py-4 font-mono text-sm">{det.id_asistencia}</td>
                        <td className="px-4 py-4">
                          <div>
                            <div className="font-semibold">{det.nombre_empleado || getEmpleadoNombre(det.id_persona)}</div>
                            <div className="text-xs text-gray-500">ID: {det.id_persona}</div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            det.tipo === 'entrada'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}>
                            {det.tipo === 'entrada' ? '🟢 Entrada' : '🔴 Salida'}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm">
                            <div>{det.timestamp ? new Date(det.timestamp).toLocaleDateString('es-ES') : '-'}</div>
                            <div className="text-xs text-gray-500">
                              {det.timestamp ? new Date(det.timestamp).toLocaleTimeString('es-ES') : '-'}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-mono text-xs">
                          {det.geo_lat && det.geo_lng ? (
                            <a
                              href={`https://www.google.com/maps?q=${det.geo_lat},${det.geo_lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-500 hover:text-blue-700 underline"
                            >
                              📍 {det.geo_lat.toFixed(6)}, {det.geo_lng.toFixed(6)}
                            </a>
                          ) : (
                            <span className="text-gray-400">Sin ubicación</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {det.nota || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AsistenciaReportes;
