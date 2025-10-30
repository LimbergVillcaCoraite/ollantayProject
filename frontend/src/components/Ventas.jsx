import React, { useEffect, useState } from 'react';

export default function Ventas({ API, userRole }) {
  const [ventas, setVentas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetch(`${API}/ventas`, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      .then(res => res.json())
      .then(data => {
        setVentas(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [API, userRole]);

  const formatMoney = (amount) => {
    const num = Number(amount || 0);
    try {
      return num.toLocaleString('es-BO', { style: 'currency', currency: 'BOB', maximumFractionDigits: 2 });
    } catch {
      return `Bs ${num.toFixed(2)}`;
    }
  };

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <h2 className="text-xl sm:text-2xl font-bold dark:text-white">Ventas</h2>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          Total: {ventas.length} ventas
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">Cargando...</div>
      ) : (
        <>
          {/* Desktop Table View - Hidden on mobile */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
            <table className="min-w-full border dark:border-gray-700">
              <thead className="bg-gray-100 dark:bg-gray-800">
                <tr>
                  <th className="p-3 text-left dark:text-gray-200">ID</th>
                  <th className="p-3 text-left dark:text-gray-200">Fecha</th>
                  <th className="p-3 text-left dark:text-gray-200">Cliente</th>
                  <th className="p-3 text-left dark:text-gray-200">Empresa</th>
                  <th className="p-3 text-right dark:text-gray-200">Monto</th>
                  <th className="p-3 text-center dark:text-gray-200">Estado</th>
                </tr>
              </thead>
              <tbody className="dark:text-gray-300">
                {ventas.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-gray-500 dark:text-gray-400">
                      No hay ventas registradas
                    </td>
                  </tr>
                ) : (
                  ventas.map(v => (
                    <tr key={v.idVenta} className="border-t dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="p-3">{v.idVenta}</td>
                      <td className="p-3">{v.fechaVenta}</td>
                      <td className="p-3">{v.nombreCliente}</td>
                      <td className="p-3">{v.nombreEmpresa}</td>
                      <td className="p-3 text-right font-semibold">{formatMoney(v.montoTotal)}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          v.estado === 1 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' 
                            : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                        }`}>
                          {v.estado === 1 ? 'Activa' : 'Anulada'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View - Visible only on mobile */}
          <div className="md:hidden space-y-4">
            {ventas.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow">
                No hay ventas registradas
              </div>
            ) : (
              ventas.map(v => (
                <div key={v.idVenta} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-gray-900 dark:text-white">#{v.idVenta}</span>
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                        v.estado === 1 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' 
                          : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'
                      }`}>
                        {v.estado === 1 ? 'Activa' : 'Anulada'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start">
                      <span className="font-semibold text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Fecha:</span>
                      <span className="text-gray-900 dark:text-gray-100">{v.fechaVenta}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="font-semibold text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Cliente:</span>
                      <span className="text-gray-900 dark:text-gray-100">{v.nombreCliente}</span>
                    </div>
                    <div className="flex items-start">
                      <span className="font-semibold text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Empresa:</span>
                      <span className="text-gray-900 dark:text-gray-100">{v.nombreEmpresa}</span>
                    </div>
                    <div className="flex items-start pt-2 border-t border-gray-200 dark:border-gray-700">
                      <span className="font-semibold text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Monto:</span>
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">{formatMoney(v.montoTotal)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
