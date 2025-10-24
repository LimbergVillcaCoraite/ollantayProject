import React, { useEffect, useState } from 'react';

export default function Proveedores({ API, userRole }) {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(`${API}/proveedores`, { credentials: 'include', headers: userRole ? { 'X-User-Role': userRole } : {} })
      .then(res => res.json())
      .then(data => {
        setProveedores(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [API, userRole]);
  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-2 dark:text-white">Proveedores</h2>
      {loading ? <div className="dark:text-gray-300">Cargando...</div> : (
        <table className="min-w-full border dark:border-gray-700">
          <thead className="bg-gray-100 dark:bg-gray-800">
            <tr>
              <th className="p-2 dark:text-gray-200">ID</th>
              <th className="p-2 dark:text-gray-200">Nombre Comercial</th>
              <th className="p-2 dark:text-gray-200">Contacto</th>
              <th className="p-2 dark:text-gray-200">Teléfono</th>
              <th className="p-2 dark:text-gray-200">Email</th>
              <th className="p-2 dark:text-gray-200">Estado</th>
            </tr>
          </thead>
          <tbody className="dark:text-gray-300">
            {proveedores.map(p => (
              <tr key={p.idProveedor} className="border-t dark:border-gray-700">
                <td className="p-2">{p.idProveedor}</td>
                <td className="p-2">{p.nombreComercial}</td>
                <td className="p-2">{p.contacto}</td>
                <td className="p-2">{p.telefono}</td>
                <td className="p-2">{p.email}</td>
                <td className="p-2">{p.estado === 1 ? 'Activo' : 'Inactivo'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
