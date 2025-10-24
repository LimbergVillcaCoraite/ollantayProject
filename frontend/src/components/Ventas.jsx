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
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2 dark:text-white">Ventas</h2>
      {loading ? <div className="dark:text-gray-300">Cargando...</div> : (
        <table className="min-w-full border dark:border-gray-700">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="p-2 dark:text-gray-200">ID</th>
              <th className="p-2 dark:text-gray-200">Fecha</th>
              <th className="p-2 dark:text-gray-200">Cliente</th>
              <th className="p-2 dark:text-gray-200">Empresa</th>
              <th className="p-2 dark:text-gray-200">Monto</th>
              <th className="p-2 dark:text-gray-200">Estado</th>
            </tr>
          </thead>
          <tbody className="dark:text-gray-300">
            {ventas.map(v => (
              <tr key={v.idVenta} className="border-t dark:border-gray-700">
                <td className="p-2">{v.idVenta}</td>
                <td className="p-2">{v.fechaVenta}</td>
                <td className="p-2">{v.nombreCliente}</td>
                <td className="p-2">{v.nombreEmpresa}</td>
                <td className="p-2">{v.montoTotal}</td>
                <td className="p-2">{v.estado === 1 ? 'Activa' : 'Anulada'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
