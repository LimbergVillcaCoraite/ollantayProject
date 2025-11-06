import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../ToastContext';

export default function Caja() {
  const [period, setPeriod] = useState('day');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [idEmpresa, setIdEmpresa] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [userRole, setUserRole] = useState('');
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [tiposPago, setTiposPago] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [movForm, setMovForm] = useState({ tipo: 'cobro', idPersona: '', idProveedor: '', monto: '', idTipoPago: '', fechaPago: '', numeroReferencia: '', observaciones: '' });
  
  // Calendar state
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [resumenPorDia, setResumenPorDia] = useState({});
  
  const { showToast } = useToast();

  useEffect(() => {
    fetchEmpresas();
    fetchUserRole();
  }, []);

  useEffect(() => {
    reload();
  }, [period, fecha, idEmpresa]);

  const fetchEmpresas = async () => {
    try {
      const response = await fetch('/api/personas/empresas', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        const list = (data && Array.isArray(data.items)) ? data.items : (Array.isArray(data) ? data : []);
        setEmpresas(list);
      }
    } catch (error) {
      console.error('Error al cargar empresas:', error);
    }
  };

  const fetchUserRole = async () => {
    try {
      const response = await fetch('/api/personas/me', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setUserRole(data.role || '');
      }
    } catch (error) {
      console.error('Error al cargar rol de usuario:', error);
    }
  };

  const reload = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('period', period);
      if (fecha) params.set('fecha', fecha);
      if (idEmpresa) params.set('idEmpresa', idEmpresa);

      const response = await fetch(`/api/reportes/caja/resumen?${params.toString()}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const status = response.status;
        const errorText = await response.text();
        let detail = `Error ${status}`;
        // Try JSON detail
        try {
          const j = JSON.parse(errorText);
          if (j && j.detail) detail = j.detail;
        } catch {
          // Friendly messages for gateway errors to avoid dumping HTML
          if (status === 502) detail = '502 Bad Gateway: servicio temporalmente no disponible';
          else if (status === 504) detail = '504 Gateway Timeout: el servicio tardó demasiado en responder';
        }
        throw new Error(detail);
      }

      const result = await response.json();
      setData(result);

      // Cargar detalle en paralelo
      const detResp = await fetch(`/api/reportes/caja/detalle?${params.toString()}`, { credentials: 'include' });
      if (detResp.ok) {
        const det = await detResp.json();
        setDetalle(det);
      }
    } catch (error) {
      showToast(error?.message || 'Error al cargar reporte', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar resúmenes de un mes completo para el calendario
  const loadResumenDelMes = async (year, month) => {
    try {
      const primerDia = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const ultimoDia = new Date(year, month + 1, 0);
      const ultimoDiaStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(ultimoDia.getDate()).padStart(2, '0')}`;
      
      const resumenMes = {};
      
      // Cargar día por día (podríamos optimizar con un endpoint que devuelva el mes completo)
      for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
        const fechaDia = `${year}-${String(month + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
        
        const params = new URLSearchParams();
        params.set('period', 'day');
        params.set('fecha', fechaDia);
        if (idEmpresa) params.set('idEmpresa', idEmpresa);
        
        try {
          const response = await fetch(`/api/reportes/caja/resumen?${params.toString()}`, {
            credentials: 'include',
          });
          
          if (response.ok) {
            const result = await response.json();
            resumenMes[fechaDia] = result;
          }
        } catch (e) {
          console.error(`Error cargando día ${fechaDia}:`, e);
        }
      }
      
      setResumenPorDia(resumenMes);
    } catch (e) {
      console.error('Error cargando resumen del mes:', e);
    }
  };

  const Card = ({ title, value, className = '', icon = '' }) => (
    <div className={`p-6 rounded-lg shadow-lg bg-white dark:bg-gray-800 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      <div className="text-3xl font-bold text-gray-900 dark:text-white">
        Bs {Number(value || 0).toFixed(2)}
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reporte de Caja</h1>
        <button
          onClick={reload}
          disabled={loading}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? '🔄 Cargando...' : '🔄 Actualizar'}
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 dark:text-white">Filtros</h3>
        
        {/* Botones de acceso rápido */}
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            onClick={() => setFecha(new Date().toISOString().slice(0, 10))}
            className="px-3 py-1 text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded hover:bg-blue-200 dark:hover:bg-blue-800"
          >
            Hoy
          </button>
          <button
            onClick={() => {
              const ayer = new Date();
              ayer.setDate(ayer.getDate() - 1);
              setFecha(ayer.toISOString().slice(0, 10));
            }}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Ayer
          </button>
          <button
            onClick={() => {
              const hace7 = new Date();
              hace7.setDate(hace7.getDate() - 7);
              setFecha(hace7.toISOString().slice(0, 10));
              setPeriod('week');
            }}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Última Semana
          </button>
          <button
            onClick={() => {
              const hace30 = new Date();
              hace30.setDate(hace30.getDate() - 30);
              setFecha(hace30.toISOString().slice(0, 10));
              setPeriod('month');
            }}
            className="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            Último Mes
          </button>
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="px-3 py-1 text-sm bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded hover:bg-purple-200 dark:hover:bg-purple-800"
          >
            📅 {showCalendar ? 'Ocultar' : 'Calendario'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
              Periodo
            </label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            >
              <option value="day">Día</option>
              <option value="week">Semana</option>
              <option value="month">Mes</option>
              <option value="year">Año</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
              Fecha base
            </label>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          {userRole === 'superadmin' && (
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
                Empresa (opcional)
              </label>
              <select
                value={idEmpresa}
                onChange={(e) => setIdEmpresa(e.target.value)}
                className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="">Todas las empresas</option>
                {empresas.map((emp) => (
                  <option key={emp.id_empresa} value={emp.id_empresa}>
                    {emp.nombre_empresa}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Calendario de Caja */}
      {showCalendar && (
        <CalendarioCaja 
          resumenPorDia={resumenPorDia}
          onSelectDate={(dateStr) => {
            setSelectedDate(selectedDate === dateStr ? null : dateStr);
            if (dateStr && dateStr !== selectedDate) {
              setFecha(dateStr);
              setPeriod('day');
            }
          }}
          selectedDate={selectedDate}
          loadResumenDelMes={loadResumenDelMes}
        />
      )}

      {/* Resumen de Caja */}
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card 
              title="💰 Ingresos Totales" 
              value={data.ingresos} 
              className="border-l-4 border-green-500"
              icon="💰"
            />
            <Card 
              title="🛒 Ventas Contado" 
              value={data.ingresosVentasContado}
              icon="🛒"
            />
            {(data.ingresosVentasRuta > 0) && (
              <Card 
                title="🚚 Ventas Ruta" 
                value={data.ingresosVentasRuta}
                icon="🚚"
              />
            )}
            {(data.ventasCredito > 0) && (
              <Card 
                title="⏳ Ventas Crédito" 
                value={data.ventasCredito}
                icon="⏳"
              />
            )}
            {(data.ingresosCobrosEfectivo > 0) && (
              <Card 
                title="💵 Cobros Efectivo" 
                value={data.ingresosCobrosEfectivo}
                icon="💵"
              />
            )}
            {(data.ingresosCobrosTransferencia > 0) && (
              <Card 
                title="🏦 Cobros Transferencia" 
                value={data.ingresosCobrosTransferencia}
                icon="🏦"
              />
            )}
            <Card 
              title="📤 Egresos Totales" 
              value={data.egresos}
              className="border-l-4 border-red-500"
              icon="📤"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {(data.egresosComprasContado > 0) && (
              <Card 
                title="🛍️ Compras Contado" 
                value={data.egresosComprasContado}
                icon="🛍️"
              />
            )}
            {(data.egresosPagosEfectivo > 0) && (
              <Card 
                title="💸 Pagos Efectivo" 
                value={data.egresosPagosEfectivo}
                icon="💸"
              />
            )}
            {(data.egresosPagosTransferencia > 0) && (
              <Card 
                title="🏦 Pagos Transferencia" 
                value={data.egresosPagosTransferencia}
                icon="🏦"
              />
            )}
            <Card 
              title="⚖️ Balance Final" 
              value={data.balance}
              className={`border-4 ${Number(data.balance) >= 0 ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-red-500 bg-red-50 dark:bg-red-900/20'}`}
              icon="⚖️"
            />
          </div>

          {/* Acciones rápidas */}
          <div className="flex justify-end">
            <button
              onClick={async () => {
                // Cargar catálogos antes de abrir modal
                try {
                  // Base URLs
                  const host = (typeof window !== 'undefined' && window.location?.hostname) ? window.location.hostname : 'localhost';
                  const proto = (typeof window !== 'undefined' && window.location?.protocol) ? window.location.protocol : 'http:';
                  const API_VENTAS = `${proto}//${host}/api/ventas`;
                  const API_PERSONAS = `${proto}//${host}/api/personas`;
                  const API_PROVEEDORES = `${proto}//${host}/api/proveedores`;
                  
                  // Tipos pago
                  const rTP = await fetch(`${API_VENTAS}/tipos-pago`, { credentials: 'include' });
                  const tp = rTP.ok ? await rTP.json() : [];
                  setTiposPago(Array.isArray(tp) ? tp : []);
                  
                  // Personas y proveedores (limit básico)
                  const rPers = await fetch(`${API_PERSONAS}/persons`, { credentials: 'include' });
                  setPersonas(rPers.ok ? await rPers.json() : []);
                  const rProv = await fetch(`${API_PROVEEDORES}/proveedores`, { credentials: 'include' });
                  setProveedores(rProv.ok ? await rProv.json() : []);
                } catch (e) { console.warn('Catálogos caja:', e); }
                setMovForm({ tipo: 'cobro', idPersona: '', idProveedor: '', monto: '', idTipoPago: '', fechaPago: fecha, numeroReferencia: '', observaciones: '' });
                setShowMovimientoModal(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded"
            >
              + Registrar Movimiento
            </button>
          </div>

          {/* Información adicional */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Información del Reporte</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-semibold text-gray-600 dark:text-gray-400">Fecha Inicio:</span>
                <span className="ml-2 dark:text-white">{data.desde}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-600 dark:text-gray-400">Fecha Fin:</span>
                <span className="ml-2 dark:text-white">{data.hasta}</span>
              </div>
              <div>
                <span className="font-semibold text-gray-600 dark:text-gray-400">Empresa:</span>
                <span className="ml-2 dark:text-white">
                  {idEmpresa ? empresas.find(e => e.id_empresa == idEmpresa)?.nombre_empresa || idEmpresa : 'Todas'}
                </span>
              </div>
            </div>
          </div>

          {/* Resumen visual */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 dark:text-white">Resumen Visual</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Ingresos vs Egresos</span>
                  <span className="text-sm font-semibold dark:text-white">
                    {Number(data.ingresos) > 0 
                      ? `${((Number(data.egresos) / Number(data.ingresos)) * 100).toFixed(1)}%`
                      : '0%'
                    } de egresos
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
                  <div className="flex h-full">
                    <div 
                      className="bg-green-500 h-full transition-all"
                      style={{ width: `${Number(data.ingresos) > 0 ? (Number(data.ingresos) / (Number(data.ingresos) + Number(data.egresos))) * 100 : 0}%` }}
                    ></div>
                    <div 
                      className="bg-red-500 h-full transition-all"
                      style={{ width: `${Number(data.egresos) > 0 ? (Number(data.egresos) / (Number(data.ingresos) + Number(data.egresos))) * 100 : 0}%` }}
                    ></div>
                  </div>
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <span className="text-green-600 dark:text-green-400">
                    ↑ Bs {Number(data.ingresos).toFixed(2)}
                  </span>
                  <span className="text-red-600 dark:text-red-400">
                    ↓ Bs {Number(data.egresos).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Detalle de Movimientos */}
          {detalle && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Ventas Contado */}
              {(detalle.ventasContado && detalle.ventasContado.length > 0) && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold dark:text-white">🛒 Ventas Contado</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{detalle.ventasContado?.length || 0} reg.</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left">Fecha</th>
                          <th className="px-3 py-2 text-left">Número</th>
                          <th className="px-3 py-2 text-left">Cliente</th>
                          <th className="px-3 py-2 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detalle.ventasContado || []).map(v => (
                          <tr key={`v-${v.idVenta}`} className="border-t dark:border-gray-700">
                            <td className="px-3 py-2">{v.fechaVenta}</td>
                            <td className="px-3 py-2">{v.codigoVenta || v.numeroVenta || v.idVenta}</td>
                            <td className="px-3 py-2">{v.nombreCliente || v.idCliente}</td>
                            <td className="px-3 py-2 text-right">Bs {Number(v.montoTotal||0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Ventas Crédito (no suman a caja) */}
              {(detalle.ventasCredito && detalle.ventasCredito.length > 0) && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold dark:text-white">⏳ Ventas Crédito</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{detalle.ventasCredito?.length || 0} reg.</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left">Fecha</th>
                          <th className="px-3 py-2 text-left">Número</th>
                          <th className="px-3 py-2 text-left">Cliente</th>
                          <th className="px-3 py-2 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detalle.ventasCredito || []).map(v => (
                          <tr key={`vc-${v.idVenta}`} className="border-t dark:border-gray-700">
                            <td className="px-3 py-2">{v.fechaVenta}</td>
                            <td className="px-3 py-2">{v.codigoVenta || v.numeroVenta || v.idVenta}</td>
                            <td className="px-3 py-2">{v.nombreCliente || v.idCliente}</td>
                            <td className="px-3 py-2 text-right">Bs {Number(v.montoTotal||0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Ventas en Ruta */}
              {(detalle.ventasRuta && detalle.ventasRuta.length > 0) && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold dark:text-white">🚚 Ventas en Ruta</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{detalle.ventasRuta?.length || 0} reg.</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left">Fecha retorno</th>
                          <th className="px-3 py-2 text-left">Número</th>
                          <th className="px-3 py-2 text-left">Ruta</th>
                          <th className="px-3 py-2 text-left">Encargado</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detalle.ventasRuta || []).map(vr => (
                          <tr key={`vr-${vr.idEntrega}`} className="border-t dark:border-gray-700">
                            <td className="px-3 py-2">{vr.fechaRetorno}</td>
                            <td className="px-3 py-2">{vr.numeroEntrega || vr.idEntrega}</td>
                            <td className="px-3 py-2">{vr.nombreRuta || '-'}</td>
                            <td className="px-3 py-2">{vr.nombreEncargado || vr.idEncargado}</td>
                            <td className="px-3 py-2 text-right">Bs {Number(vr.totalVendido||0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Cobros Efectivo */}
              {(detalle.cobrosEfectivo && detalle.cobrosEfectivo.length > 0) && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold dark:text-white">💵 Cobros (Efectivo)</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{detalle.cobrosEfectivo?.length || 0} reg.</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left">Fecha</th>
                          <th className="px-3 py-2 text-left">Número</th>
                          <th className="px-3 py-2 text-left">Cliente</th>
                          <th className="px-3 py-2 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detalle.cobrosEfectivo || []).map(c => (
                          <tr key={`ce-${c.idPago}`} className="border-t dark:border-gray-700">
                            <td className="px-3 py-2">{c.fechaPago}</td>
                            <td className="px-3 py-2">{c.numeroPago || c.idPago}</td>
                            <td className="px-3 py-2">{c.nombrePersona || c.idPersona}</td>
                            <td className="px-3 py-2 text-right">Bs {Number(c.monto||0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Cobros Transferencia */}
              {(detalle.cobrosTransferencia && detalle.cobrosTransferencia.length > 0) && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold dark:text-white">🏦 Cobros (Transferencia)</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{detalle.cobrosTransferencia?.length || 0} reg.</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left">Fecha</th>
                          <th className="px-3 py-2 text-left">Número</th>
                          <th className="px-3 py-2 text-left">Cliente</th>
                          <th className="px-3 py-2 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detalle.cobrosTransferencia || []).map(c => (
                          <tr key={`ct-${c.idPago}`} className="border-t dark:border-gray-700">
                            <td className="px-3 py-2">{c.fechaPago}</td>
                            <td className="px-3 py-2">{c.numeroPago || c.idPago}</td>
                            <td className="px-3 py-2">{c.nombrePersona || c.idPersona}</td>
                            <td className="px-3 py-2 text-right">Bs {Number(c.monto||0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Compras Contado */}
              {(detalle.comprasContado && detalle.comprasContado.length > 0) && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold dark:text-white">🛍️ Compras Contado</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{detalle.comprasContado?.length || 0} reg.</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left">Fecha</th>
                          <th className="px-3 py-2 text-left">Proveedor</th>
                          <th className="px-3 py-2 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detalle.comprasContado || []).map(c => (
                          <tr key={`cc-${c.idCompra}`} className="border-t dark:border-gray-700">
                            <td className="px-3 py-2">{c.fechaCompra}</td>
                            <td className="px-3 py-2">{c.nombreProveedor || c.idProveedor}</td>
                            <td className="px-3 py-2 text-right">Bs {Number(c.montoTotal||0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pagos Efectivo */}
              {(detalle.pagosEfectivo && detalle.pagosEfectivo.length > 0) && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold dark:text-white">💸 Pagos (Efectivo)</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{detalle.pagosEfectivo?.length || 0} reg.</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left">Fecha</th>
                          <th className="px-3 py-2 text-left">Proveedor</th>
                          <th className="px-3 py-2 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detalle.pagosEfectivo || []).map(p => (
                          <tr key={`pe-${p.idPago}`} className="border-t dark:border-gray-700">
                            <td className="px-3 py-2">{p.fechaPago}</td>
                            <td className="px-3 py-2">{p.nombreProveedor || p.idProveedor}</td>
                            <td className="px-3 py-2 text-right">Bs {Number(p.monto||0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Pagos Transferencia */}
              {(detalle.pagosTransferencia && detalle.pagosTransferencia.length > 0) && (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-lg font-semibold dark:text-white">🏦 Pagos (Transferencia)</h3>
                    <span className="text-sm text-gray-500 dark:text-gray-400">{detalle.pagosTransferencia?.length || 0} reg.</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left">Fecha</th>
                          <th className="px-3 py-2 text-left">Proveedor</th>
                          <th className="px-3 py-2 text-right">Monto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(detalle.pagosTransferencia || []).map(p => (
                          <tr key={`pt-${p.idPago}`} className="border-t dark:border-gray-700">
                            <td className="px-3 py-2">{p.fechaPago}</td>
                            <td className="px-3 py-2">{p.nombreProveedor || p.idProveedor}</td>
                            <td className="px-3 py-2 text-right">Bs {Number(p.monto||0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {!data && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Seleccione los filtros y haga clic en Actualizar para ver el reporte
          </p>
        </div>
      )}
    </div>
  );
}

// Componente de Calendario para Caja
function CalendarioCaja({ resumenPorDia, onSelectDate, selectedDate, loadResumenDelMes }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  // Cargar resúmenes del mes cuando cambie el mes o al montar el componente
  useEffect(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    if (loadResumenDelMes) {
      loadResumenDelMes(year, month);
    }
  }, [currentMonth, loadResumenDelMes]);
  
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
  
  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };
  
  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  const getDateString = (day) => {
    return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const hasData = (dateStr) => {
    return resumenPorDia[dateStr] && (
      (resumenPorDia[dateStr].ingresos > 0) || 
      (resumenPorDia[dateStr].egresos > 0)
    );
  };

  const getBalance = (dateStr) => {
    if (!resumenPorDia[dateStr]) return 0;
    return Number(resumenPorDia[dateStr].balance || 0);
  };

  return (
    <div className="mb-4 p-4 bg-white dark:bg-gray-800 rounded-lg border dark:border-gray-700 shadow">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="px-3 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white">
          ← Anterior
        </button>
        <h3 className="text-lg font-semibold dark:text-white">
          {monthNames[month]} {year}
        </h3>
        <button onClick={nextMonth} className="px-3 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 dark:text-white">
          Siguiente →
        </button>
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {dayNames.map(day => (
          <div key={day} className="text-center text-sm font-semibold text-gray-600 dark:text-gray-400 p-2">
            {day}
          </div>
        ))}
        
        {Array.from({ length: startingDayOfWeek }).map((_, i) => (
          <div key={`empty-${i}`} className="p-2"></div>
        ))}
        
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dateStr = getDateString(day);
          const balance = getBalance(dateStr);
          const hasMovements = hasData(dateStr);
          const isSelected = selectedDate === dateStr;
          const isPositive = balance > 0;
          const isNegative = balance < 0;
          
          return (
            <button
              key={day}
              onClick={() => onSelectDate(dateStr)}
              className={`
                p-2 rounded text-center transition-all relative
                ${hasMovements ? 'font-bold' : ''}
                ${isSelected ? 'bg-blue-500 text-white ring-2 ring-blue-600' : 
                  hasMovements && isPositive ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800/60' :
                  hasMovements && isNegative ? 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 hover:bg-red-200 dark:hover:bg-red-800/60' :
                  hasMovements ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600' :
                  'hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300'}
              `}
              title={hasMovements ? `Balance: Bs ${balance.toFixed(2)}` : 'Sin movimientos'}
            >
              <div className="text-sm">{day}</div>
              {hasMovements && (
                <div className="text-xs mt-1">
                  <div className={`font-bold text-[10px] leading-none ${isPositive ? 'text-green-600 dark:text-green-400' : isNegative ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {balance >= 0 ? '+' : ''}Bs {balance.toFixed(0)}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && resumenPorDia[selectedDate] && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">
            Resumen del {selectedDate}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-700">
              <div className="text-xs text-gray-600 dark:text-gray-400">Ingresos</div>
              <div className="text-lg font-bold text-green-600 dark:text-green-400">
                Bs {Number(resumenPorDia[selectedDate].ingresos || 0).toFixed(2)}
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-700">
              <div className="text-xs text-gray-600 dark:text-gray-400">Egresos</div>
              <div className="text-lg font-bold text-red-600 dark:text-red-400">
                Bs {Number(resumenPorDia[selectedDate].egresos || 0).toFixed(2)}
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-700">
              <div className="text-xs text-gray-600 dark:text-gray-400">Balance</div>
              <div className={`text-lg font-bold ${
                Number(resumenPorDia[selectedDate].balance || 0) >= 0 
                  ? 'text-green-600 dark:text-green-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                Bs {Number(resumenPorDia[selectedDate].balance || 0).toFixed(2)}
              </div>
            </div>
          </div>
          
          {/* Detalles adicionales */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            {resumenPorDia[selectedDate].ventasContado > 0 && (
              <div className="p-2 bg-white dark:bg-gray-800 rounded">
                <div className="text-gray-600 dark:text-gray-400">Ventas Contado</div>
                <div className="font-semibold dark:text-gray-200">Bs {Number(resumenPorDia[selectedDate].ventasContado).toFixed(2)}</div>
              </div>
            )}
            {resumenPorDia[selectedDate].ventasRuta > 0 && (
              <div className="p-2 bg-white dark:bg-gray-800 rounded">
                <div className="text-gray-600 dark:text-gray-400">Ventas Ruta</div>
                <div className="font-semibold dark:text-gray-200">Bs {Number(resumenPorDia[selectedDate].ventasRuta).toFixed(2)}</div>
              </div>
            )}
            {resumenPorDia[selectedDate].cobrosEfectivo > 0 && (
              <div className="p-2 bg-white dark:bg-gray-800 rounded">
                <div className="text-gray-600 dark:text-gray-400">Cobros Efectivo</div>
                <div className="font-semibold dark:text-gray-200">Bs {Number(resumenPorDia[selectedDate].cobrosEfectivo).toFixed(2)}</div>
              </div>
            )}
            {resumenPorDia[selectedDate].cobrosTransferencia > 0 && (
              <div className="p-2 bg-white dark:bg-gray-800 rounded">
                <div className="text-gray-600 dark:text-gray-400">Cobros Transferencia</div>
                <div className="font-semibold dark:text-gray-200">Bs {Number(resumenPorDia[selectedDate].cobrosTransferencia).toFixed(2)}</div>
              </div>
            )}
            {resumenPorDia[selectedDate].comprasContado > 0 && (
              <div className="p-2 bg-white dark:bg-gray-800 rounded">
                <div className="text-gray-600 dark:text-gray-400">Compras</div>
                <div className="font-semibold dark:text-gray-200">Bs {Number(resumenPorDia[selectedDate].comprasContado).toFixed(2)}</div>
              </div>
            )}
            {resumenPorDia[selectedDate].pagosEfectivo > 0 && (
              <div className="p-2 bg-white dark:bg-gray-800 rounded">
                <div className="text-gray-600 dark:text-gray-400">Pagos Efectivo</div>
                <div className="font-semibold dark:text-gray-200">Bs {Number(resumenPorDia[selectedDate].pagosEfectivo).toFixed(2)}</div>
              </div>
            )}
            {resumenPorDia[selectedDate].pagosTransferencia > 0 && (
              <div className="p-2 bg-white dark:bg-gray-800 rounded">
                <div className="text-gray-600 dark:text-gray-400">Pagos Transferencia</div>
                <div className="font-semibold dark:text-gray-200">Bs {Number(resumenPorDia[selectedDate].pagosTransferencia).toFixed(2)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
