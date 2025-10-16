import React, { useEffect, useState } from 'react'

export default function Empresas({ API = 'http://localhost:8002', userRole='' }){
  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [offset, setOffset] = useState(0)
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ nombre_empresa:'', direccion_empresa:'', estado_empresa:1, id_persona: '' })

  const fetchPage = async ()=>{
    setLoading(true)
    setError(null)
    try{
      const url = new URL(`${API}/empresas`)
      if(q) url.searchParams.set('q', q)
      url.searchParams.set('offset', offset)
      url.searchParams.set('limit', limit)
      const res = await fetch(url.toString(), { credentials: 'include', headers: { 'X-User-Role': userRole } })
      if(!res.ok) throw new Error(`Server ${res.status}`)
      const data = await res.json()
      setItems(data.items || data)
      setTotal(data.total ?? (data.items ? data.items.length : data.length))
    }catch(err){ setError(err.message) }
    finally{ setLoading(false) }
  }

  useEffect(()=>{ fetchPage() }, [q, offset, limit])

  const handleCreate = async ()=>{
    setError(null)
    try{
      const body = { ...form, estado_empresa: Number(form.estado_empresa) }
      const res = await fetch(`${API}/empresas`, { method: 'POST', credentials: 'include', headers: { 'Content-Type':'application/json', 'X-User-Role': userRole }, body: JSON.stringify(body) })
      if(res.status !== 201){
        const txt = await res.text()
        throw new Error(txt || `Status ${res.status}`)
      }
      setForm({ nombre_empresa:'', direccion_empresa:'', estado_empresa:1, id_persona:'' })
      setShowCreate(false)
      fetchPage()
    }catch(e){ setError(e.message) }
  }

  const handleDelete = async (id)=>{
    if(!confirm('Eliminar empresa?')) return
    try{
      const res = await fetch(`${API}/empresas/${id}`, { method: 'DELETE', credentials: 'include', headers: { 'X-User-Role': userRole } })
      if(res.status !== 204) throw new Error('Failed to delete')
      fetchPage()
    }catch(e){ setError(e.message) }
  }

  return (
    <div className="bg-panel p-4 rounded shadow">
      <div className="flex items-center gap-2 mb-4">
        <input placeholder="Buscar empresas..." value={q} onChange={e=>setQ(e.target.value)} className="p-2 border rounded flex-1" />
        <button onClick={()=>{ setOffset(0); fetchPage() }} className="btn btn-secondary">Buscar</button>
        <button onClick={()=>setShowCreate(s=>!s)} className="btn btn-primary">{showCreate ? 'Cancelar' : 'Crear empresa'}</button>
      </div>

      {showCreate && (
        <div className="mb-4 p-3 border rounded bg-gray-50 dark:bg-gray-900">
          <div className="grid grid-cols-1 gap-2">
            <input placeholder="Nombre" value={form.nombre_empresa} onChange={e=>setForm(f=>({...f, nombre_empresa: e.target.value}))} className="p-2 border rounded" />
            <input placeholder="Dirección" value={form.direccion_empresa} onChange={e=>setForm(f=>({...f, direccion_empresa: e.target.value}))} className="p-2 border rounded" />
            <input placeholder="ID Persona" value={form.id_persona} onChange={e=>setForm(f=>({...f, id_persona: e.target.value}))} className="p-2 border rounded" />
            <div className="flex justify-end">
              <button onClick={handleCreate} className="btn btn-primary">Crear</button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="text-red-600 mb-2">{error}</div>}
      {loading ? (
        <div>Cargando...</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="px-2 py-1">ID</th>
                  <th className="px-2 py-1">Nombre</th>
                  <th className="px-2 py-1">Dirección</th>
                  <th className="px-2 py-1">Estado</th>
                  <th className="px-2 py-1">ID Persona</th>
                  <th className="px-2 py-1">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map(it=> (
                  <tr key={it.id_empresa} className="border-t">
                    <td className="px-2 py-1">{it.id_empresa}</td>
                    <td className="px-2 py-1">{it.nombre_empresa}</td>
                    <td className="px-2 py-1">{it.direccion_empresa}</td>
                    <td className="px-2 py-1">{it.estado_empresa ? 'Activo' : 'Inactivo'}</td>
                    <td className="px-2 py-1">{it.id_persona}</td>
                    <td className="px-2 py-1">
                      <button onClick={()=>handleDelete(it.id_empresa)} className="btn btn-danger">Borrar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-500">Mostrando {items.length} de {total}</div>
            <div className="flex items-center gap-2">
              <button onClick={()=> setOffset(o => Math.max(0, o - limit))} disabled={offset===0} className="btn btn-secondary">Anterior</button>
              <button onClick={()=> setOffset(o => o + limit)} disabled={offset + limit >= total} className="btn btn-secondary">Siguiente</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
