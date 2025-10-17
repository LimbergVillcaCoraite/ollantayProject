import React, { useEffect, useState } from 'react'

export default function Empresas({ API = 'http://localhost:8002', userRole='', permissions=[] }){
  const has = (res, act) => permissions.includes(`${res}:${act}`)
  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ nombre_empresa:'', direccion_empresa:'', estado_empresa:1, id_persona: '' })
  const [propietarios, setPropietarios] = useState([])
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
  const res = await fetch(url.toString(), { credentials: 'include' })
      if(!res.ok) throw new Error(`Server ${res.status}`)
      const data = await res.json()
      setItems(data.items || data)
      setTotal(data.total ?? (data.items ? data.items.length : data.length))
    }catch(err){ setError(err.message) }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ fetchPage() }, [q, offset, limit])

  useEffect(()=>{
    // Cargar personas con tipo "Propietario" (id_tipoPersona = 3)
    const fetchPropietarios = async ()=>{
      try{
        const res = await fetch(`${API}/persons?tipo=3`, { credentials: 'include' })
        if(res.ok){
          const data = await res.json()
          setPropietarios(data)
        }
      }catch(err){ console.error('Error cargando propietarios:', err) }
    }
    fetchPropietarios()
  }, [])

  const handleCreate = async ()=>{
    setError(null)
    try{
      const body = { ...form, estado_empresa: Number(form.estado_empresa) }
  const res = await fetch(`${API}/empresas`, { method: 'POST', credentials: 'include', headers: { 'Content-Type':'application/json', ...(userRole ? {'X-User-Role': userRole} : {}) }, body: JSON.stringify(body) })
      if(res.status !== 201){
        const txt = await res.text()
        throw new Error(txt || `Status ${res.status}`)
      }
      setForm({ nombre_empresa:'', direccion_empresa:'', estado_empresa:1, id_persona:'' })
      setShowCreate(false)
      fetchPage()
    }catch(e){ setError(e.message) }
  }

  const handleUpdate = async (id)=>{
    setError(null)
    try{
      const body = { ...editForm, estado_empresa: Number(editForm.estado_empresa) }
  const res = await fetch(`${API}/empresas/${id}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type':'application/json', ...(userRole ? {'X-User-Role': userRole} : {}) }, body: JSON.stringify(body) })
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
  const res = await fetch(`${API}/empresas/${id}`, { method: 'DELETE', credentials: 'include', headers: { ...(userRole ? {'X-User-Role': userRole} : {}) } })
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
          className="px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
        >
          Buscar
        </button>
        {has('empresas','create') && (
          <button 
            onClick={()=>setShowCreate(s=>!s)} 
            className={`px-4 py-3 rounded-lg font-medium transition-colors ${showCreate ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white`}
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
            <select 
              value={form.id_persona} 
              onChange={e=>setForm(f=>({...f, id_persona: e.target.value}))} 
              className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 sm:col-span-2"
            >
              <option value="">Seleccionar propietario...</option>
              {propietarios.map(p => (
                <option key={p.id_persona} value={p.id_persona}>
                  {p.nombres_persona} {p.apellido_paternoPersona || ''} {p.apellido_maternoPer || ''}
                </option>
              ))}
            </select>
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
          {/* Tabla responsive */}
          <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-100 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Nombre</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider hidden sm:table-cell">Dirección</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider hidden md:table-cell">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider hidden lg:table-cell">Propietario</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {items.map(it=> {
                  const isEditing = editingId === it.id_empresa
                  const propietario = propietarios.find(p => p.id_persona === it.id_persona)
                  const propietarioNombre = propietario ? `${propietario.nombres_persona} ${propietario.apellido_paternoPersona || ''}`.trim() : it.id_persona
                  
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
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 hidden sm:table-cell">
                      {isEditing ? (
                        <input 
                          value={editForm.direccion_empresa} 
                          onChange={e=>setEditForm(f=>({...f, direccion_empresa: e.target.value}))} 
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700"
                        />
                      ) : it.direccion_empresa}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm hidden md:table-cell">
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
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 hidden lg:table-cell">
                      {isEditing ? (
                        <select 
                          value={editForm.id_persona} 
                          onChange={e=>setEditForm(f=>({...f, id_persona: e.target.value}))} 
                          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700"
                        >
                          <option value="">Seleccionar propietario...</option>
                          {propietarios.map(p => (
                            <option key={p.id_persona} value={p.id_persona}>
                              {p.nombres_persona} {p.apellido_paternoPersona || ''} {p.apellido_maternoPer || ''}
                            </option>
                          ))}
                        </select>
                      ) : propietarioNombre}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button 
                              onClick={()=>handleUpdate(it.id_empresa)} 
                              className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium transition-colors"
                            >
                              ✓ Guardar
                            </button>
                            <button 
                              onClick={()=>{setEditingId(null); setEditForm({})}} 
                              className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-xs font-medium transition-colors"
                            >
                              ✕ Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            {has('empresas','update') && (
                              <button 
                                onClick={()=>{setEditingId(it.id_empresa); setEditForm({...it})}} 
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition-colors"
                              >
                                ✎ Editar
                              </button>
                            )}
                            {has('empresas','delete') && (
                              <button 
                                onClick={()=>handleDelete(it.id_empresa)} 
                                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-medium transition-colors"
                              >
                                ✕ Borrar
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
