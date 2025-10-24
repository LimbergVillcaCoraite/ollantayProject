import React, { useEffect, useState } from 'react';

export default function Cuentas({ API, userRole }) {
  const [cuentas, setCuentas] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/cuentas`, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      .then(res => res.json())
      .then(data => {
        setCuentas(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [API, userRole]);
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2 dark:text-white">Cuentas Corrientes</h2>
      {loading ? <div className="dark:text-gray-300">Cargando...</div> : (
        <table className="min-w-full border dark:border-gray-700">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="p-2 dark:text-gray-200">ID</th>
              <th className="p-2 dark:text-gray-200">Tipo</th>
              <th className="p-2 dark:text-gray-200">Persona</th>
              <th className="p-2 dark:text-gray-200">Empresa</th>
              <th className="p-2 dark:text-gray-200">Saldo</th>
              <th className="p-2 dark:text-gray-200">Estado</th>
            </tr>
          </thead>
          <tbody className="dark:text-gray-300">
            {cuentas.map(c => (
              <tr key={c.idCuenta} className="border-t dark:border-gray-700">
                <td className="p-2">{c.idCuenta}</td>
                <td className="p-2">{c.tipoCuenta}</td>
                <td className="p-2">{c.nombrePersona}</td>
                <td className="p-2">{c.nombreEmpresa}</td>
                <td className="p-2">{c.saldo}</td>
                <td className="p-2">{c.estado === 1 ? 'Activa' : 'Cerrada'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
