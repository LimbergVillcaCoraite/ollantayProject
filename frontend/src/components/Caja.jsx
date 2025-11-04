import React, { useEffect, useMemo, useState } from 'react';
import { useToast } from '../ToastContext';

export default function Caja() {
  const [period, setPeriod] = useState('day');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [idEmpresa, setIdEmpresa] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [showMovimientoModal, setShowMovimientoModal] = useState(false);
  const [tiposPago, setTiposPago] = useState([]);
  const [personas, setPersonas] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [movForm, setMovForm] = useState({ tipo: 'cobro', idPersona: '', idProveedor: '', monto: '', idTipoPago: '', fechaPago: '', numeroReferencia: '', observaciones: '' });
  
  const { showToast } = useToast();

  useEffect(() => {
    fetchEmpresas();
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
        const errorText = await response.text();
        let detail = errorText;
        try {
          const j = JSON.parse(errorText);
          detail = j.detail || errorText;
        } catch {}
        throw new Error(detail || `Error ${response.status}`);
      }

      const result = await response.json();
      setData(result);

      // Cargar detalle en paralelo
      const detResp = await fetch(`/api/reportes/caja/detalle?${params.toString()}`, { credentials: 'include' });
      if (detResp.ok) {
        const det = await detResp.json();
        setDetalle(det);
      } else {
        setDetalle(null);
      }
    } catch (error) {
      showToast(error?.message || 'Error al cargar reporte', 'error');
      console.error(error);
    } finally {
      setLoading(false);
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
        </div>
      </div>

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
            <Card 
              title="💵 Cobros" 
              value={data.ingresosCobros}
              icon="💵"
            />
            <Card 
              title="📤 Egresos Totales" 
              value={data.egresos}
              className="border-l-4 border-red-500"
              icon="📤"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card 
              title="🛍️ Compras Contado" 
              value={data.egresosComprasContado}
              icon="🛍️"
            />
            <Card 
              title="💸 Pagos" 
              value={data.egresosPagos}
              icon="💸"
            />
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

              {/* Cobros */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold dark:text-white">💵 Cobros</h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{detalle.cobros?.length || 0} reg.</span>
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
                      {(detalle.cobros || []).map(c => (
                        <tr key={`c-${c.idPago}`} className="border-t dark:border-gray-700">
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

              {/* Compras Contado */}
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

              {/* Pagos */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold dark:text-white">💸 Pagos</h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">{detalle.pagos?.length || 0} reg.</span>
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
                      {(detalle.pagos || []).map(p => (
                        <tr key={`p-${p.idPago}`} className="border-t dark:border-gray-700">
                          <td className="px-3 py-2">{p.fechaPago}</td>
                          <td className="px-3 py-2">{p.nombreProveedor || p.idProveedor}</td>
                          <td className="px-3 py-2 text-right">Bs {Number(p.monto||0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
