import React from 'react'
import { useToast } from '../ToastContext'

export default function Tipos({types, loading, error, onEdit, onDelete, onRefresh, API, userRole='admin'}){
  const [showNew, setShowNew] = React.useState(false)
  const [newTipo, setNewTipo] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [editingId, setEditingId] = React.useState(null)
  const [editingTipo, setEditingTipo] = React.useState('')
  const [editingSaving, setEditingSaving] = React.useState(false)
  const toast = useToast()

  const handleCreate = async ()=>{
    if(!newTipo.trim()) return
    setSaving(true)
    try{
      const api = API || (import.meta.env.VITE_API_TYPES || 'http://localhost:8001')
  const res = await fetch(`${api}/types`, {method:'POST', headers:{'Content-Type':'application/json', 'X-User-Role': userRole}, body: JSON.stringify({tipo: newTipo})})
      if(!res.ok) throw new Error('Error creando tipo')
      setNewTipo('')
      setShowNew(false)
      if(onRefresh) await onRefresh()
    }catch(err){ console.error(err); toast.push('Error creando tipo: '+err.message,'error') }
    finally{ setSaving(false) }
  }

  const startEdit = (t)=>{
    setEditingId(t.id)
    setEditingTipo(t.tipo)
  }

  const cancelEdit = ()=>{
    setEditingId(null)
    setEditingTipo('')
    setEditingSaving(false)
  }

  const saveEdit = async (id)=>{
    if(!editingTipo.trim()) return
    setEditingSaving(true)
    try{
      const api = API || (import.meta.env.VITE_API_TYPES || 'http://localhost:8001')
  const res = await fetch(`${api}/types/${id}`, {method:'PUT', headers:{'Content-Type':'application/json', 'X-User-Role': userRole}, body: JSON.stringify({tipo: editingTipo})})
      if(!res.ok){ const j = await res.json().catch(()=>null); throw new Error(j?.detail || 'Error updating') }
      toast.push('Tipo actualizado','success')
      if(onRefresh) await onRefresh()
      cancelEdit()
    }catch(err){ console.error(err); toast.push('Error actualizando tipo: '+err.message,'error') }
    finally{ setEditingSaving(false) }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold mb-2">Tipos</h2>
      {loading && <p>Cargando tipos...</p>}
      {error && <p className="text-red-600">{error}</p>}
  <div className="bg-panel rounded shadow overflow-x-auto text-panel p-4">
  <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="font-medium">Listado de Tipos</h3>
          <p className="text-sm text-gray-600">Gestiona los tipos de persona aquí</p>
        </div>
        <div>
          {userRole !== 'viewer' && !showNew && <button onClick={()=>setShowNew(true)} className="btn btn-primary">Nuevo Tipo</button>}
        </div>
      </div>
      {showNew && (
        <div className="mb-4 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
          <input className="p-2 border col-span-2" placeholder="Nombre del tipo" value={newTipo} onChange={e=>setNewTipo(e.target.value)} />
          <div className="flex gap-2">
            <button disabled={saving} onClick={handleCreate} className="btn btn-primary">{saving ? 'Guardando...' : 'Guardar'}</button>
            <button disabled={saving} onClick={()=>{ setShowNew(false); setNewTipo('') }} className="btn btn-secondary">Cancelar</button>
          </div>
        </div>
      )}
        <table className="min-w-full divide-y">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left">ID</th>
              <th className="px-4 py-2 text-left">Tipo</th>
              <th className="px-4 py-2 text-right w-48">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {types.length === 0 && <tr><td className="p-4" colSpan={3}>No hay tipos</td></tr>}
            {types.map(t => (
              <tr key={t.id} className="border-t">
                <td className="px-4 py-2">{t.id}</td>
                <td className="px-4 py-2">
                  {editingId === t.id ? (
                    <input className="p-2 border w-full" value={editingTipo} onChange={e=>setEditingTipo(e.target.value)} />
                  ) : (
                    t.tipo
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex items-center justify-end gap-2">
                    {editingId === t.id ? (
                      <>
                        <button disabled={editingSaving} onClick={()=>saveEdit(t.id)} className="btn btn-primary">{editingSaving ? 'Guardando...' : 'Guardar'}</button>
                        <button disabled={editingSaving} onClick={cancelEdit} className="btn btn-secondary">Cancelar</button>
                      </>
                    ) : (
                      <>
                        {userRole !== 'viewer' && <button onClick={()=>startEdit(t)} className="btn btn-primary" title="Editar">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 010 2.828L8.414 14.414 4 16l1.586-4.414L14.586 2.586a2 2 0 012.828 0z"/></svg>
                          Editar
                        </button>}
                        {userRole === 'admin' && <button onClick={()=>onDelete(t.id)} className="btn btn-danger" title="Eliminar">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-1 1v1H4a1 1 0 000 2h12a1 1 0 100-2h-4V3a1 1 0 00-1-1H9zM6 7a1 1 0 011 1v7a1 1 0 11-2 0V8a1 1 0 011-1zm6 0a1 1 0 011 1v7a1 1 0 11-2 0V8a1 1 0 011-1z" clipRule="evenodd"/></svg>
                          Eliminar
                        </button>}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
