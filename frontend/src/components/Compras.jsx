import React, { useEffect, useState } from 'react';

export default function Compras({ API, userRole }) {
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/compras`, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      .then(res => res.json())
      .then(data => {
        setCompras(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [API, userRole]);
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2 dark:text-white">Compras</h2>
      {loading ? <div className="dark:text-gray-300">Cargando...</div> : (
        <table className="min-w-full border dark:border-gray-700">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="p-2 dark:text-gray-200">ID</th>
              <th className="p-2 dark:text-gray-200">Fecha</th>
              <th className="p-2 dark:text-gray-200">Proveedor</th>
              <th className="p-2 dark:text-gray-200">Empresa</th>
              <th className="p-2 dark:text-gray-200">Monto</th>
              <th className="p-2 dark:text-gray-200">Estado</th>
            </tr>
          </thead>
          <tbody className="dark:text-gray-300">
            {compras.map(c => (
              <tr key={c.idCompra} className="border-t dark:border-gray-700">
                <td className="p-2">{c.idCompra}</td>
                <td className="p-2">{c.fechaCompra}</td>
                <td className="p-2">{c.nombreProveedor}</td>
                <td className="p-2">{c.nombreEmpresa}</td>
                <td className="p-2">{c.montoTotal}</td>
                <td className="p-2">{c.estado === 1 ? 'Activa' : 'Anulada'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
