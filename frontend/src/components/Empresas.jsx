import React, { useEffect, useState } from 'react'

export default function Empresas({ API = 'http://localhost:8002', userRole='', permissions=[], onOpenPersonasForEmpresa }){
  const has = (res, act) => permissions.includes(`${res}:${act}`)
  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ nombre_empresa:'', direccion_empresa:'', estado_empresa:1 })
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({})

  const fetchPage = async ()=>{
    setLoading(true)
    setError(null)
    try{
      const url = new URL(`${API}/empresas`)
      if(q) url.searchParams.set('q', q)
      url.searchParams.set('offset', offset)
      url.searchParams.set('limit', limit)
      url.searchParams.set('include_counts', '1')
      const res = await fetch(url.toString())
      if(!res.ok) throw new Error(`Server ${res.status}`)
      const data = await res.json()
      setItems(data.items || data)
      setTotal(data.total ?? (data.items ? data.items.length : data.length))
    }catch(err){ setError(err.message) }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ fetchPage() }, [q, offset, limit])

  // Propietarios ya no se asignan ni muestran; personas referencian empresa via id_empresa

  const handleCreate = async ()=>{
    setError(null)
    try{
  const body = { nombre_empresa: form.nombre_empresa, direccion_empresa: form.direccion_empresa, estado_empresa: Number(form.estado_empresa) }
  const res = await fetch(`${API}/empresas`, { method: 'POST', headers: { 'Content-Type':'application/json', ...(userRole ? {'X-User-Role': userRole} : {}) }, body: JSON.stringify(body) })
      if(res.status !== 201){
        const txt = await res.text()
        throw new Error(txt || `Status ${res.status}`)
      }
  setForm({ nombre_empresa:'', direccion_empresa:'', estado_empresa:1 })
      setShowCreate(false)
      fetchPage()
    }catch(e){ setError(e.message) }
  }

  const handleUpdate = async (id)=>{
    setError(null)
    try{
  const body = { nombre_empresa: editForm.nombre_empresa, direccion_empresa: editForm.direccion_empresa, estado_empresa: Number(editForm.estado_empresa) }
  const res = await fetch(`${API}/empresas/${id}`, { method: 'PUT', headers: { 'Content-Type':'application/json', ...(userRole ? {'X-User-Role': userRole} : {}) }, body: JSON.stringify(body) })
      if(!res.ok){
        const txt = await res.text()
        throw new Error(txt || `Status ${res.status}`)
      }
      setEditingId(null)
      setEditForm({})
      fetchPage()
    }catch(e){ setError(e.message) }
  }

  const handleDelete = async (id)=>{
    if(!confirm('Eliminar empresa?')) return
    try{
  const res = await fetch(`${API}/empresas/${id}`, { method: 'DELETE', headers: { ...(userRole ? {'X-User-Role': userRole} : {}) } })
      if(res.status !== 204) throw new Error('Failed to delete')
      fetchPage()
    }catch(e){ setError(e.message) }
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg">
      {/* Header con búsqueda y botón crear */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <input 
          placeholder="Buscar empresas..." 
          value={q} 
          onChange={e=>setQ(e.target.value)} 
          className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
        />
        <button 
          onClick={()=>{ setOffset(0); fetchPage() }} 
          className="btn btn-secondary"
        >
          Buscar
        </button>
        {has('empresas','create') && (
          <button 
            onClick={()=>setShowCreate(s=>!s)} 
            className={`btn ${showCreate ? 'btn-danger' : 'btn-primary'}`}
          >
            {showCreate ? 'Cancelar' : '+ Nueva Empresa'}
          </button>
        )}
      </div>

      {/* Formulario de creación */}
  {has('empresas','create') && showCreate && (
        <div className="mb-6 p-4 sm:p-6 border-2 border-blue-200 dark:border-blue-800 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Nueva Empresa</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input 
              placeholder="Nombre de la empresa" 
              value={form.nombre_empresa} 
              onChange={e=>setForm(f=>({...f, nombre_empresa: e.target.value}))} 
              className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <input 
              placeholder="Dirección" 
              value={form.direccion_empresa} 
              onChange={e=>setForm(f=>({...f, direccion_empresa: e.target.value}))} 
              className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            {/* Estado (Activo/Inactivo) */}
            <select
              value={String(form.estado_empresa)}
              onChange={e=>setForm(f=>({...f, estado_empresa: e.target.value}))}
              className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="1">Activo</option>
              <option value="0">Inactivo</option>
            </select>
            {/* Propietario: ya no se asigna aquí; se puede gestionar desde Personas */}
          </div>
          <div className="flex justify-end mt-4">
            <button 
              onClick={handleCreate} 
              className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              ✓ Crear Empresa
            </button>
          </div>
        </div>
      )}

      {/* Mensajes de error */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-300 rounded">
          <p className="font-medium">Error:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Contenido principal */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          {/* Desktop Table View - Hidden on mobile */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Dirección</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Personas</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {items.map(it=> {
                  const isEditing = editingId === it.id_empresa
                  return (
                  <tr key={it.id_empresa} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{it.id_empresa}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {isEditing ? (
                        <input 
                          value={editForm.nombre_empresa} 
                          onChange={e=>setEditForm(f=>({...f, nombre_empresa: e.target.value}))} 
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700"
                        />
                      ) : it.nombre_empresa}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                      {isEditing ? (
                        <input 
                          value={editForm.direccion_empresa} 
                          onChange={e=>setEditForm(f=>({...f, direccion_empresa: e.target.value}))} 
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700"
                        />
                      ) : it.direccion_empresa}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      {isEditing ? (
                        <select
                          value={String(editForm.estado_empresa)}
                          onChange={e=>setEditForm(f=>({...f, estado_empresa: e.target.value}))}
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700"
                        >
                          <option value="1">Activo</option>
                          <option value="0">Inactivo</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${it.estado_empresa ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                          {it.estado_empresa ? 'Activo' : 'Inactivo'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs">
                        {Number.isFinite(it.personas_count) ? it.personas_count : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button 
                              onClick={()=>handleUpdate(it.id_empresa)} 
                              className="btn btn-green text-xs"
                            >
                              ✓ Guardar
                            </button>
                            <button 
                              onClick={()=>{setEditingId(null); setEditForm({})}} 
                              className="btn btn-secondary text-xs"
                            >
                              ✕ Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            {has('empresas','update') && (
                              <button 
                                onClick={()=>{setEditingId(it.id_empresa); setEditForm({...it})}} 
                                className="btn btn-blue text-xs"
                              >
                                ✎ Editar
                              </button>
                            )}
                            {has('empresas','delete') && (
                              <button 
                                onClick={()=>handleDelete(it.id_empresa)} 
                                className="btn btn-danger text-xs"
                              >
                                ✕ Borrar
                              </button>
                            )}
                            {onOpenPersonasForEmpresa && (
                              <button 
                                onClick={()=>onOpenPersonasForEmpresa(it.id_empresa, it.nombre_empresa)} 
                                className="btn btn-purple text-xs"
                                title="Ver personas de esta empresa"
                              >
                                👥 Ver Personas
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View - Visible only on mobile */}
          <div className="md:hidden space-y-4">
            {items.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg shadow">
                No se encontraron empresas
              </div>
            ) : (
              items.map(it => {
                const isEditing = editingId === it.id_empresa
                return (
                  <div key={it.id_empresa} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700">
                    {isEditing ? (
                      /* Modo Edición Mobile */
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
                          <input 
                            value={editForm.nombre_empresa} 
                            onChange={e=>setEditForm(f=>({...f, nombre_empresa: e.target.value}))} 
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Dirección</label>
                          <input 
                            value={editForm.direccion_empresa} 
                            onChange={e=>setEditForm(f=>({...f, direccion_empresa: e.target.value}))} 
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estado</label>
                          <select
                            value={String(editForm.estado_empresa)}
                            onChange={e=>setEditForm(f=>({...f, estado_empresa: e.target.value}))}
                            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                          >
                            <option value="1">Activo</option>
                            <option value="0">Inactivo</option>
                          </select>
                        </div>
                        <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <button 
                            onClick={()=>handleUpdate(it.id_empresa)} 
                            className="flex-1 btn btn-green text-sm justify-center"
                          >
                            ✓ Guardar
                          </button>
                          <button 
                            onClick={()=>{setEditingId(null); setEditForm({})}} 
                            className="flex-1 btn btn-secondary text-sm justify-center"
                          >
                            ✕ Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Modo Vista Mobile */
                      <>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <div className="font-bold text-lg text-gray-900 dark:text-white mb-1">
                              {it.nombre_empresa}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              ID: {it.id_empresa}
                            </div>
                          </div>
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${it.estado_empresa ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'}`}>
                            {it.estado_empresa ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                        
                        <div className="space-y-2 text-sm mb-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                          {it.direccion_empresa && (
                            <div className="flex items-start">
                              <span className="font-semibold text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Dirección:</span>
                              <span className="text-gray-900 dark:text-gray-100">{it.direccion_empresa}</span>
                            </div>
                          )}
                          <div className="flex items-start">
                            <span className="font-semibold text-gray-600 dark:text-gray-400 w-24 flex-shrink-0">Personas:</span>
                            <span className="text-gray-900 dark:text-gray-100">
                              {Number.isFinite(it.personas_count) ? `${it.personas_count} registradas` : 'No disponible'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex flex-col gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
                          <div className="grid grid-cols-2 gap-2">
                            {has('empresas','update') && (
                              <button 
                                onClick={()=>{setEditingId(it.id_empresa); setEditForm({...it})}} 
                                className="btn btn-blue text-sm justify-center"
                              >
                                ✎ Editar
                              </button>
                            )}
                            {has('empresas','delete') && (
                              <button 
                                onClick={()=>handleDelete(it.id_empresa)} 
                                className="btn btn-danger text-sm justify-center"
                              >
                                ✕ Borrar
                              </button>
                            )}
                          </div>
                          {onOpenPersonasForEmpresa && (
                            <button 
                              onClick={()=>onOpenPersonasForEmpresa(it.id_empresa, it.nombre_empresa)} 
                              className="w-full btn btn-purple text-sm justify-center"
                            >
                              👥 Ver Personas
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Paginación */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Mostrando <span className="font-semibold">{items.length}</span> de <span className="font-semibold">{total}</span> empresas
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={()=> setOffset(o => Math.max(0, o - limit))} 
                disabled={offset===0} 
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                ← Anterior
              </button>
              <button 
                onClick={()=> setOffset(o => o + limit)} 
                disabled={offset + limit >= total} 
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors"
              >
                Siguiente →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
