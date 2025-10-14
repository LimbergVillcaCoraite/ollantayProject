import React from 'react'

export default function Tipos({types, loading, error, onEdit, onDelete}){
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Tipos</h2>
      {loading && <p>Cargando tipos...</p>}
      {error && <p className="text-red-600">{error}</p>}
      <div className="bg-white rounded shadow">
        <table className="w-full divide-y">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2 text-left">Tipo</th>
              <th className="px-4 py-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {types.length === 0 && <tr><td className="p-4" colSpan={3}>No hay tipos</td></tr>}
            {types.map(t => (
              <tr key={t.id} className="border-t">
                <td className="px-4 py-2">{t.id}</td>
                <td className="px-4 py-2">{t.tipo}</td>
                <td className="px-4 py-2">
                  <button onClick={()=>onEdit(t)} className="mr-2 text-sm px-2 py-1 border rounded">Editar</button>
                  <button onClick={()=>onDelete(t.id)} className="text-sm px-2 py-1 bg-red-500 text-white rounded">Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
